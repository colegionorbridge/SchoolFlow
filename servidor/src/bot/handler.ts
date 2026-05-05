import { User, Role, Sector, Ticket } from '../models/models.js';
import { consultarGroq } from './groq.js';
import { manejarRegistro } from './registro.js';
import { processCommand } from './commands.js';
import { ejecutarAccion } from './actions.js';
import { io } from '../socket/server.js'; 

// 1. Definimos la forma de la respuesta de la IA para que TS no proteste
interface RespuestaIA {
    respuesta: string;
    accion: 'CREAR_TICKET' | 'AGREGAR_COMENTARIO' | 'CERRAR_TICKET' | 'NINGUNA';
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
    // Tipamos como 'any' para facilitar el uso de modelos de Sequelize, 
    // pero lo inicializamos fuera del try.
    let user: any = null;

    try {
        const contacto = await msg.getContact();
        const telefono: string = contacto.number; 

        user = await User.findByPk(telefono, {
            include: [
                { model: Role, as: 'rol' }, 
                { model: Sector, as: 'sectores' }
            ]
        });

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

            if (cancela) {
                user.context = { ...(user.context || {}), pendienteConfirmacion: null };
                user.changed('context', true);
                await user.save();
                await msg.reply('Entendido, se cancelo la accion.');
                return;
            }

            if (confirma) {
                const datos = pendienteConfirmacion.datos;
                try {
                    await ejecutarAccion(msg, user, telefono, datos.accion, datos.ticketData);
                } finally {
                    user.context = { ...(user.context || {}), pendienteConfirmacion: null };
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
            // Limpia el flag de procesando antes de responder
            user.context = { ...(user.context || {}), procesando: false };
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
        const chat = await msg.getChat();
        const mensajesPrevios = await chat.fetchMessages({ limit: 10 });

        const historialParaIA = mensajesPrevios
            .filter((m: any) => m.body && m.body.trim() !== "")
            .map((m: any) => ({
                role: m.fromMe ? 'model' as const : 'user' as const,
                parts: [{ text: m.body }]
            }));

        const resultadoIA = await consultarGroq(msg.body, historialParaIA, user) as RespuestaIA;

        // Si la respuesta de la IA NO tiene una accion que requiera confirmacion, respondemos normal
        const { accion, ticketData } = resultadoIA;

        if (accion === 'NINGUNA' || !accion) {
            // Solo respondemos, no hay accion pendiente
            await msg.reply(resultadoIA.respuesta);
            return;
        }

        // Si la IA quiere ejecutar una accion, guardamos en contexto y pedimos confirmacion
        if (accion === 'CREAR_TICKET' || accion === 'AGREGAR_COMENTARIO' || accion === 'CERRAR_TICKET') {
            console.log('📋 [Confirmacion] Guardando pendiente:', accion, '| ticketData:', JSON.stringify(ticketData));
            user.context = {
                ...(user.context || {}),
                pendienteConfirmacion: {
                    accionOriginal: accion,
                    datos: { accion, ticketData }
                }
            };
            user.changed('context', true);
            await user.save();

            // Mostramos resumen y pedimos confirmacion
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
