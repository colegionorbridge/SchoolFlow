import { Op } from 'sequelize';
import { User, Role, Sector, Ticket } from '../models/models.js';
import { consultarGroq } from './groq.js';
import { manejarRegistro } from './registro.js';
import { processCommand } from './commands.js';
import { ejecutarAccion } from './actions.js';
import { io } from '../socket/server.js'; 

// Escudo anti-duplicados: evita que reconexiones o re-emisiones
// de whatsapp-web.js procesen el mismo mensaje dos veces.
const mensajesProcesados = new Set<string>();
const TTL_MENSAJE = 15_000; // 15 segundos

// 1. Definimos la forma de la respuesta de la IA para que TS no proteste
interface RespuestaIA {
    respuesta: string;
    accion: 'CREAR_TICKET' | 'AGREGAR_COMENTARIO' | 'CERRAR_TICKET' | 'MOSTRAR_TICKETS' | 'NINGUNA';
    ticketData?: {
        id?: number;
        asunto?: string;
        descripcion?: string;
        ubicacion?: string;
        comentario?: string;
    };
}

// Tiempo máximo de bloqueo "procesando" (2 minutos)
const TIMEOUT_PROCESANDO = 2 * 60 * 1000;

export const handleIncomingMessage = async (msg: any) => {
    // --- ESCUDO ANTI-DUPLICADOS ---
    const msgId = msg.id?.id || msg.id?._serialized;
    if (msgId) {
        if (mensajesProcesados.has(msgId)) {
            console.log(`🛡️ [Deduplicado] Mensaje ${msgId} ignorado (ya procesado).`);
            return;
        }
        mensajesProcesados.add(msgId);
        setTimeout(() => mensajesProcesados.delete(msgId), TTL_MENSAJE);
    }

    // Tipamos como 'any' para facilitar el uso de modelos de Sequelize, 
    // pero lo inicializamos fuera del try.
    let user: any = null;

    try {
        const contacto = await msg.getContact();
        let telefono: string = contacto.number; 

        // Normalizar teléfono: agregar 549 si no está presente
        if (!telefono.startsWith('549')) {
            telefono = '549' + telefono;
        }

        user = await User.findByPk(telefono, {
            include: [
                { model: Role, as: 'rol' }, 
                { model: Sector, as: 'sectores' }
            ]
        });

        // Historial de conversación para la IA (solo si el usuario existe)
        const historialConversacion = (user && user.context?.historialConversacion) || [];

        if (!user || (!user.registroCompleto && !user.esAdmin)) {
            await manejarRegistro(msg, user, telefono);
            return;
        }

        // Bloqueo de seguridad con timeout automático
        if (user.context?.procesando) {
            const ultimaActualizacion = user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
            const ahora = Date.now();
            if (ahora - ultimaActualizacion > TIMEOUT_PROCESANDO) {
                // Timeout: limpiar flag automáticamente
                user.context = { ...(user.context || {}), procesando: false };
                user.changed('context', true);
                await user.save();
                console.log(`⏱️ [Timeout] Liberando flag procesando para ${telefono}`);
            } else {
                return; // Sigue procesando, ignorar
            }
        }

        // Actualizamos estado "procesando"
        user.context = { ...(user.context || {}), procesando: true };
        user.changed('context', true);
        await user.save();
        
        if (io) io.emit('usuario-actualizado', user);

        // 2. Verificar si hay confirmacion pendiente y el usuario responde
        const pendienteConfirmacion = user.context?.pendienteConfirmacion;
        if (pendienteConfirmacion) {
            const msgLower = msg.body.toLowerCase();
            const confirma = ['si', 'sí', 'confirmo', 'dale', 'ok', 'vamos', 'hagamoslo', 'perfecto'].some(c => msgLower.includes(c));
            const cancela = ['no', 'cancelo', 'mejor no', 'no quiero'].some(c => msgLower.includes(c));

            // Obtener historial actual
            const historialActual = user.context?.historialConversacion || [];

            if (cancela) {
                const nuevoHistorial = [
                    ...historialActual,
                    { role: 'user', content: msg.body },
                    { role: 'assistant', content: 'Entendido, se cancelo la accion.' }
                ].slice(-10);

                user.context = { ...(user.context || {}), pendienteConfirmacion: null, historialConversacion: nuevoHistorial };
                user.changed('context', true);
                await user.save();
                await msg.reply('Entendido, se cancelo la accion.');
                return;
            }

            if (confirma) {
                const datos = pendienteConfirmacion.datos;
                let mensajeHistorial = 'Accion confirmada.';
                
                try {
                    await ejecutarAccion(msg, user, telefono, datos.accion, datos.ticketData);
                    // Generar mensaje específico según la acción
                    if (datos.accion === 'CREAR_TICKET') {
                        mensajeHistorial = `Ticket #${datos.ticketData?.id || ''} creado exitosamente.`;
                    } else if (datos.accion === 'AGREGAR_COMENTARIO') {
                        mensajeHistorial = `Comentario agregado al ticket #${datos.ticketData?.id || ''}.`;
                    } else if (datos.accion === 'CERRAR_TICKET') {
                        mensajeHistorial = `Ticket #${datos.ticketData?.id || ''} cerrado exitosamente.`;
                    }
                } finally {
                    // Limpiar COMPLETAMENTE el contexto después de ejecutar
                    const historialDespues = user.context?.historialConversacion || [];
                    const nuevoHistorial = [
                        ...historialDespues,
                        { role: 'user', content: msg.body },
                        { role: 'assistant', content: mensajeHistorial }
                    ].slice(-10);

                    user.context = { 
                        ...(user.context || {}), 
                        pendienteConfirmacion: null,
                        historialConversacion: nuevoHistorial,
                        procesando: false  // Asegurar que se limpia
                    };
                    user.changed('context', true);
                    await user.save();
                }
                return;
            }

            // Si no confirma ni cancela claramente, pedimos de nuevo
            await msg.reply('Por favor, respondé *SI* para confirmar o *NO* para cancelar.');
            return;
        }

        // 3. SISTEMA DE COMMANDS DIRECTOS (SIN IA)
        // Primero intentamos resolver como commando/flow directo para ahorrar tokens
        const commandResult = await processCommand(msg, user);
        if (commandResult.handled) {
            // Guardar historial también para comandos (para mantener contexto)
            const historialActual = user.context?.historialConversacion || [];
            const nuevoHistorial = [
                ...historialActual,
                { role: 'user', content: msg.body },
                { role: 'assistant', content: commandResult.reply || 'Comando ejecutado' }
            ].slice(-10);

            // Limpia el flag de procesando antes de responder
            user.context = { ...(user.context || {}), procesando: false, historialConversacion: nuevoHistorial };
            user.changed('context', true);
            await user.save();
            if (io) {
                const userFinal = await User.findByPk(user.telefono, {
                    include: [{ model: Role, as: 'rol' }]
                });
                if (userFinal) io.emit('usuario-actualizado', userFinal);
            }
            // Solo enviamos reply si existe (ejecutarAccion ya envio su propio mensaje)
            if (commandResult.reply) {
                await msg.reply(commandResult.reply);
            }
            return;
        }

        // 4. Si no es un comando, usamos IA
        const resultadoIA = await consultarGroq(msg.body, historialConversacion, user) as RespuestaIA;

        // Si la respuesta de la IA NO tiene una accion que requiera confirmacion, respondemos normal
        const { accion, ticketData } = resultadoIA;

        if (accion === 'NINGUNA' || !accion) {
            // Guardar historial y responder
            const nuevoHistorial = [
                ...historialConversacion,
                { role: 'user', content: msg.body },
                { role: 'assistant', content: resultadoIA.respuesta }
            ].slice(-10);

            user.context = { ...(user.context || {}), historialConversacion: nuevoHistorial };
            user.changed('context', true);
            await user.save();

            await msg.reply(resultadoIA.respuesta);
            return;
        }

        // Accion: MOSTRAR_TICKETS - IA pidio mostrar tickets, consultamos DB directo
        if (accion === 'MOSTRAR_TICKETS') {
            const tickets = await Ticket.findAll({
                where: { 
                    userTelefono: user.telefono,
                    estado: { [Op.in]: ['abierto', 'en_proceso'] }
                },
                order: [['createdAt', 'DESC']],
                limit: 10
            });

            let reply = '';
            if (tickets.length === 0) {
                reply = 'No tenés tickets activos.';
            } else {
                const lista = tickets.map((t: any) => {
                    const emoji = t.estado === 'abierto' ? '🟠' : '🔵';
                    const fecha = new Date(t.createdAt).toLocaleString('es-AR');
                    const historial = t.historial ? (Array.isArray(t.historial) ? t.historial : JSON.parse(t.historial)) : [];
                    const comentarios = historial.length > 0 ? '💬 Con comentarios' : '📭 Sin comentarios';
                    return `${emoji} *Ticket #${t.id}*\n📌 *Asunto:* ${t.asunto}\n📍 *Ubicación:* ${t.ubicacion}\n🕒 *Creado:* ${fecha}\n${comentarios}`;
                }).join('\n\n');
                reply = `📋 *Tickets activos:*\n\n${lista}`;
            }

            const nuevoHistorial = [
                ...historialConversacion,
                { role: 'user', content: msg.body },
                { role: 'assistant', content: reply }
            ].slice(-10);

            user.context = { ...(user.context || {}), historialConversacion: nuevoHistorial };
            user.changed('context', true);
            await user.save();
            await msg.reply(reply);
            return;
        }

        // Si la IA quiere ejecutar una accion, guardamos en contexto y pedimos confirmacion
        if (accion === 'CREAR_TICKET' || accion === 'AGREGAR_COMENTARIO' || accion === 'CERRAR_TICKET') {
            console.log('📋 [Confirmacion] Guardando pendiente:', accion, '| ticketData:', JSON.stringify(ticketData));

            // Crear resumen para confirmacion
            let resumen = '';
            if (accion === 'CREAR_TICKET') {
                resumen = `Resumen del ticket a crear:\n\n` +
                    `📌 Asunto: ${ticketData?.asunto}\n` +
                    `📝 Descripcion: ${ticketData?.descripcion}\n` +
                    `📍 Ubicacion: ${ticketData?.ubicacion}\n\n` +
                    `Respondé *SI* para confirmar o *NO* para cancelar.`;
            } else if (accion === 'AGREGAR_COMENTARIO') {
                resumen = `Vas a agregar un comentario al ticket *#${ticketData?.id}*: "${ticketData?.asunto}"\n\n` +
                    `💬 Comentario: "${ticketData?.comentario}"\n\n` +
                    `Respondé *SI* para confirmar o *NO* para cancelar.`;
            } else if (accion === 'CERRAR_TICKET') {
                resumen = `Vas a cerrar el ticket *#${ticketData?.id}*: "${ticketData?.asunto}"\n\n` +
                    `Respondé *SI* para confirmar o *NO* para cancelar.`;
            }

            // Guardar historial con el resumen que se enviará al usuario
            const nuevoHistorial = [
                ...historialConversacion,
                { role: 'user', content: msg.body },
                { role: 'assistant', content: resumen }
            ].slice(-10);

            user.context = {
                ...(user.context || {}),
                pendienteConfirmacion: {
                    accionOriginal: accion,
                    datos: { accion, ticketData }
                },
                historialConversacion: nuevoHistorial
            };
            user.changed('context', true);
            await user.save();

            await msg.reply(resumen);
            return;
        }

        // Si no es ninguna de las acciones anteriores, respondemos normal
        await msg.reply(resultadoIA.respuesta);
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        // Chequeamos que 'user' no sea null antes de operar
        if (user) {
            try {
                // Usamos spread seguro para no romper si context es null
                const contextLimpio = { ...(user.context || {}), procesando: false };
                user.context = contextLimpio;
                user.changed('context', true);
                await user.save();
                
                // Avisamos al front del cambio de estado del usuario
                const userFinal = await User.findByPk(user.telefono, {
                    include: [{ model: Role, as: 'rol' }]
                });
                
                if (io && userFinal) {
                    io.emit('usuario-actualizado', userFinal);
                }
            } catch (e) {
                console.error('❌ Error en finally:', e);
            }
        }
    }
};
