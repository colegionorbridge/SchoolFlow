import { User, Ticket } from '../models/models.js';
import { io } from '../socket/server.js';

export async function ejecutarAccion(
    msg: any,
    user: any,
    telefono: string,
    accion: string,
    ticketData: any
) {
    if (accion === 'CREAR_TICKET' && ticketData?.asunto) {
        const nuevoTicket = await Ticket.create({
            asunto: ticketData.asunto,
            descripcion: ticketData.descripcion || "Sin descripcion adicional",
            ubicacion: ticketData.ubicacion || "No especificada",
            userTelefono: telefono,
            estado: 'abierto',
            historial: []
        });

        const ticketConData = await Ticket.findByPk(nuevoTicket.id, {
            include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
        });

        if (io) io.emit('nuevo-ticket', ticketConData);
        await msg.reply(`✅ Ticket *#${nuevoTicket.id}* creado exitosamente.`);
    }

    if ((accion === 'AGREGAR_COMENTARIO' || accion === 'CERRAR_TICKET') && ticketData?.id) {
        const ticket = await Ticket.findByPk(ticketData.id);

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

            if (io) io.emit('ticket-actualizado', ticketActualizado);

            if (accion === 'CERRAR_TICKET') {
                await msg.reply(`✅ Ticket *#${ticket.id}* cerrado exitosamente.`);
            } else {
                await msg.reply(`✅ Comentario agregado al ticket *#${ticket.id}*.`);
            }
        }
    }
}
