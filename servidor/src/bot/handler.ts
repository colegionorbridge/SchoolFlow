import { User, Role, Sector, Ticket } from '../models/models.js';
import { consultarGroq } from './groq.js';
import { manejarRegistro } from './registro.js';
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

        // Bloqueo de seguridad con chequeo opcional
        if (user.context?.procesando) return;

        // Actualizamos estado "procesando"
        user.context = { ...(user.context || {}), procesando: true };
        user.changed('context', true);
        await user.save();
        
        if (io) io.emit('usuario-actualizado', user);

        const chat = await msg.getChat();
        const mensajesPrevios = await chat.fetchMessages({ limit: 10 });

        const historialParaIA = mensajesPrevios
            .filter((m: any) => m.body && m.body.trim() !== "")
            .map((m: any) => ({
                role: m.fromMe ? 'model' as const : 'user' as const,
                parts: [{ text: m.body }]
            }));

        // 2. ERROR SOLUCIONADO: Forzamos el tipo de retorno de la IA
        const resultadoIA = await consultarGroq(msg.body, historialParaIA, user) as RespuestaIA;

        // Ahora TS sabe que 'respuesta' existe
        await msg.reply(resultadoIA.respuesta);

        // Ahora TS sabe que 'accion' y 'ticketData' existen
        const { accion, ticketData } = resultadoIA;

        // ACCIÓN: CREAR
        if (accion === 'CREAR_TICKET' && ticketData?.asunto) {
            const nuevoTicket = await Ticket.create({
                asunto: ticketData.asunto,
                descripcion: ticketData.descripcion || "Sin descripción adicional",
                ubicacion: ticketData.ubicacion || "No especificada",
                userTelefono: telefono,
                estado: 'abierto',
                historial: [] 
            });

            const ticketConData = await Ticket.findByPk(nuevoTicket.id, {
                include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
            });

            if (io) io.emit('nuevo-ticket', ticketConData);
            await msg.reply(`✅ **Ticket #${nuevoTicket.id} generado.**`);
        }

        // ACCIÓN: EDITAR / CERRAR
        if ((accion === 'AGREGAR_COMENTARIO' || accion === 'CERRAR_TICKET') && ticketData?.id) {
            const ticket = await Ticket.findByPk(ticketData.id);

            if (ticket) {
                const nuevaNota = {
                    fecha: new Date().toLocaleString('es-AR'),
                    autor: user.nombreCompleto || 'Usuario', // <--- Usamos nombreCompleto
                    nota: ticketData.comentario || (accion === 'CERRAR_TICKET' ? "Ticket cerrado." : "Nota añadida.")
                };

                ticket.historial = [...(Array.isArray(ticket.historial) ? ticket.historial : []), nuevaNota];
                if (accion === 'CERRAR_TICKET') ticket.estado = 'cerrado';
                
                await ticket.save();

                const ticketActualizado = await Ticket.findByPk(ticket.id, {
                    include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
                });

                if (io) io.emit('ticket-actualizado', ticketActualizado);
                await msg.reply(`✅ **Ticket #${ticket.id} actualizado.**`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        // 3. ERROR SOLUCIONADO EN FINALLY:
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