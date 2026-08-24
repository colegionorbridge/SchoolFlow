import { User, Ticket, Conversacion } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';
import { enviarTexto } from './enviar.js';

export async function ejecutarAccion(
    msg: any,
    user: any,
    telefono: string,
    accion: string,
    ticketData: any
) {
    logger.info({ accion, ticketData }, '[ejecutarAccion]');

    if (accion === 'CREAR_TICKET') {
        if (!ticketData?.asunto) {
            logger.warn({ ticketData }, '[ejecutarAccion] CREAR_TICKET sin asunto');
            await msg.reply('❌ No se pudo crear el ticket porque falta el asunto.');
            return;
        }

        logger.info({ ticketData: ticketData.asunto }, '[ejecutarAccion] Creando ticket');
        const nuevoTicket = await Ticket.create({
            asunto: ticketData.asunto,
            descripcion: ticketData.descripcion || "Sin descripcion adicional",
            ubicacion: ticketData.ubicacion || "No especificada",
            userTelefono: telefono,
            estado: 'abierto',
            historial: []
        });

        logger.info({ ticketId: nuevoTicket.id }, '[ejecutarAccion] Ticket creado');

        // Asociar los mensajes recientes de la conversación al ticket recién creado
        await Conversacion.update(
            { ticketId: nuevoTicket.id },
            { where: { userTelefono: telefono, ticketId: null } }
        ).catch(e => logger.error({ err: e?.message }, '[ejecutarAccion] asociar conversacion'));

        const ticketConData = await Ticket.findByPk(nuevoTicket.id, {
            include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
        });

        getIO()?.emit('nuevo-ticket', ticketConData);
        await enviarTexto(telefono, `✅ Ticket *#${nuevoTicket.id}* creado exitosamente.`, nuevoTicket.id);
    }

    if ((accion === 'AGREGAR_COMENTARIO' || accion === 'CERRAR_TICKET') && ticketData?.id != null) {
        const ticket = await Ticket.findByPk(ticketData.id);

        if (!ticket) {
            await msg.reply(`❌ No se encontró el ticket #${ticketData.id}.`);
            return;
        }

        // Validar que el ticket pertenezca al usuario
        if (ticket.userTelefono !== telefono) {
            await msg.reply(`❌ El ticket #${ticketData.id} no está asociado a tu número.`);
            return;
        }

        if (ticket) {
            let historialActual: any[] = [];
            if (Array.isArray(ticket.historial)) {
                historialActual = ticket.historial;
            } else if (typeof ticket.historial === 'string') {
                try { historialActual = JSON.parse(ticket.historial); } catch { historialActual = []; }
            }

            const nuevaNota = {
                fecha: new Date().toLocaleString('es-AR'),
                autor: user.nombreCompleto || 'Usuario',
                nota: ticketData.comentario || (accion === 'CERRAR_TICKET' ? "Ticket cerrado por el usuario." : "Nota anadida por el usuario.")
            };

            ticket.historial = [...historialActual, nuevaNota];
            if (accion === 'CERRAR_TICKET') ticket.estado = 'cerrado';

            await ticket.save();

            const ticketActualizado = await Ticket.findByPk(ticket.id, {
                include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
            });

            getIO()?.emit('ticket-actualizado', ticketActualizado);

            if (accion === 'CERRAR_TICKET') {
                await msg.reply(`✅ Ticket *#${ticket.id}* cerrado exitosamente.`);
            } else {
                await msg.reply(`✅ Comentario agregado al ticket *#${ticket.id}*.`);
            }
        }
    }
}
