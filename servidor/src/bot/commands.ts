import { User, Sector, Ticket, Role } from '../models/models.js';

/**
 * SISTEMA DE COMMANDS DIRECTOS (SIN IA)
 * Estas funciones se ejecutan sin llamar a Groq, ahorrando tokens.
 */

interface CommandResult {
    handled: boolean;
    reply?: string;
}

export const processCommand = async (msg: any, user: any): Promise<CommandResult> => {
    const texto = msg.body.trim();

    // Comando: /ayuda
    if (texto === '/ayuda' || texto === '/help') {
        return {
            handled: true,
            reply: `Comandos disponibles:

/mis-tickets - Ver tus tickets activos
/estado [id] - Ver estado de un ticket (ej: /estado 5)
/cerrar [id] - Cerrar un ticket (ej: /cerrar 3)
/ayuda - Mostrar esta lista

Tambien podes:
- Reportar un problema nuevo escribiendolo normalmente
- Agregar un comentario escribiendo "ticket #[numero] [tu comentario]"
- Decir "se arreglo" o "ya funciona" para cerrar un ticket`
        };
    }

    // Comando: /mis-tickets
    if (texto === '/mis-tickets' || texto === '/mistickets') {
        const tickets = await Ticket.findAll({
            where: { userTelefono: user.telefono },
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        if (tickets.length === 0) {
            return { handled: true, reply: 'No tenes tickets registrados.' };
        }

        const lista = tickets.map(t => {
            const emoji = t.estado === 'abierto' ? '🟠' : t.estado === 'en_proceso' ? '🔵' : '🟢';
            return `${emoji} *#${t.id}* - ${t.asunto}\n   Estado: ${t.estado.replace('_', ' ')} | Prioridad: ${t.prioridad}`;
        }).join('\n');

        return {
            handled: true,
            reply: `Tus tickets recientes:\n\n${lista}`
        };
    }

    // Comando: /estado [id]
    if (texto.startsWith('/estado ') || texto.startsWith('/estado#')) {
        const idStr = texto.split(/[\s#]+/)[1];
        const ticketId = parseInt(idStr, 10);

        if (isNaN(ticketId)) {
            return { handled: true, reply: 'Formato incorrecto. Usá: /estado [numero]' };
        }

        const ticket = await Ticket.findOne({
            where: { id: ticketId, userTelefono: user.telefono }
        });

        if (!ticket) {
            return { handled: true, reply: `No se encontro el ticket #${ticketId}.` };
        }

        const emoji = ticket.estado === 'abierto' ? '🟠' : ticket.estado === 'en_proceso' ? '🔵' : '🟢';
        return {
            handled: true,
            reply: `${emoji} *Ticket #${ticket.id}*

Asunto: ${ticket.asunto}
Estado: ${ticket.estado.replace('_', ' ').toUpperCase()}
Prioridad: ${ticket.prioridad}
Ubicacion: ${ticket.ubicacion}

${ticket.historial && ticket.historial.length > 0 ? 'Ultimas notas:\n' + ticket.historial.slice(-2).map((h: any) => `- ${h.fecha}: ${h.nota}`).join('\n') : 'Sin notas registradas.'}`
        };
    }

    // Comando: /cerrar [id]
    if (texto.startsWith('/cerrar ') || texto.startsWith('/cerrar#')) {
        const idStr = texto.split(/[\s#]+/)[1];
        const ticketId = parseInt(idStr, 10);

        if (isNaN(ticketId)) {
            return { handled: true, reply: 'Formato incorrecto. Usá: /cerrar [numero]' };
        }

        const ticket = await Ticket.findOne({
            where: { id: ticketId, userTelefono: user.telefono }
        });

        if (!ticket) {
            return { handled: true, reply: `No se encontro el ticket #${ticketId}.` };
        }

        if (ticket.estado === 'cerrado') {
            return { handled: true, reply: `El ticket #${ticketId} ya esta cerrado.` };
        }

        const notaCierre = {
            fecha: new Date().toLocaleString('es-AR'),
            autor: user.nombreCompleto || 'Usuario',
            nota: 'Ticket cerrado por el usuario.'
        };

        ticket.estado = 'cerrado';
        ticket.historial = [...(Array.isArray(ticket.historial) ? ticket.historial : []), notaCierre];
        ticket.changed('historial', true);
        await ticket.save();

        // Emitir por socket
        const { io } = await import('../socket/server.js');
        const ticketActualizado = await Ticket.findByPk(ticket.id, {
            include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
        });
        if (io) io.emit('ticket-actualizado', ticketActualizado);

        return {
            handled: true,
            reply: `✅ Ticket *#${ticket.id}* cerrado correctamente.`
        };
    }

    // Patron: "ticket #[id] [comentario]" -> Agregar comentario directo
    const matchTicket = texto.match(/^ticket\s*#?(\d+)\s+(.+)/i);
    if (matchTicket) {
        const ticketId = parseInt(matchTicket[1], 10);
        const comentario = matchTicket[2].trim();

        const ticket = await Ticket.findOne({
            where: { id: ticketId, userTelefono: user.telefono }
        });

        if (!ticket) {
            return { handled: true, reply: `No se encontro el ticket #${ticketId} asociado a tu numero.` };
        }

        if (ticket.estado === 'cerrado') {
            return { handled: true, reply: `El ticket #${ticketId} esta cerrado. Si necesitas ayuda, crea un ticket nuevo.` };
        }

        const nuevaNota = {
            fecha: new Date().toLocaleString('es-AR'),
            autor: user.nombreCompleto || 'Usuario',
            nota: comentario
        };

        ticket.historial = [...(Array.isArray(ticket.historial) ? ticket.historial : []), nuevaNota];
        ticket.changed('historial', true);
        await ticket.save();

        const { io } = await import('../socket/server.js');
        const ticketActualizado = await Ticket.findByPk(ticket.id, {
            include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
        });
        if (io) io.emit('ticket-actualizado', ticketActualizado);

        return {
            handled: true,
            reply: `✅ Comentario agregado al ticket *#${ticket.id}*: "${ticket.asunto}"`
        };
    }

    // Patron: "se arreglo", "ya funciona", "ya esta listo" -> Cerrar ticket mas reciente
    const frasesCierre = ['se arreglo', 'ya funciona', 'ya esta listo', 'ya se resolvio', 'problema resuelto', 'solucionado'];
    if (frasesCierre.some(frase => texto.toLowerCase().includes(frase))) {
        const ticketReciente = await Ticket.findOne({
            where: {
                userTelefono: user.telefono,
                estado: ['abierto', 'en_proceso']
            },
            order: [['createdAt', 'DESC']]
        });

        if (!ticketReciente) {
            return { handled: false }; // No hay ticket, dejar que IA responda
        }

        // Confirmar antes de cerrar
        user.context = {
            ...(user.context || {}),
            esperandoCierreConfirmacion: {
                ticketId: ticketReciente.id,
                asunto: ticketReciente.asunto
            }
        };
        user.changed('context', true);
        await user.save();

        return {
            handled: true,
            reply: `¿Queres cerrar el ticket *#${ticketReciente.id}*: "${ticketReciente.asunto}"?\n\nRespondé *SI* para confirmar o *NO* para cancelar.`
        };
    }

    // Confirmacion de cierre: "SI" o "NO"
    if (user.context?.esperandoCierreConfirmacion) {
        const { ticketId } = user.context.esperandoCierreConfirmacion;
        const respuesta = texto.toLowerCase();

        // Limpiar contexto
        user.context = { ...(user.context || {}), esperandoCierreConfirmacion: null };
        user.changed('context', true);
        await user.save();

        if (respuesta === 'si' || respuesta === 'sí' || respuesta === 'confirmo' || respuesta === 'confirmar') {
            const ticket = await Ticket.findByPk(ticketId);
            if (ticket && ticket.estado !== 'cerrado') {
                const notaCierre = {
                    fecha: new Date().toLocaleString('es-AR'),
                    autor: user.nombreCompleto || 'Usuario',
                    nota: 'Ticket cerrado por el usuario.'
                };
                ticket.estado = 'cerrado';
                ticket.historial = [...(Array.isArray(ticket.historial) ? ticket.historial : []), notaCierre];
                ticket.changed('historial', true);
                await ticket.save();

                const { io } = await import('../socket/server.js');
                const ticketActualizado = await Ticket.findByPk(ticket.id, {
                    include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
                });
                if (io) io.emit('ticket-actualizado', ticketActualizado);
            }
            return { handled: true, reply: `✅ Ticket *#${ticketId}* cerrado correctamente.` };
        } else {
            return { handled: true, reply: 'OK, el ticket sigue abierto. Si necesitas algo más, avisanos.' };
        }
    }

    // Patron: "SI" despues de notificacion de comentario -> Mostrar ticket
    // Detectamos si hay tickets con comentarios recientes del tecnico
    if (texto.toLowerCase() === 'si' || texto.toLowerCase() === 'sí') {
        const ticketsConNotas = await Ticket.findAll({
            where: {
                userTelefono: user.telefono,
                estado: ['abierto', 'en_proceso']
            },
            order: [['updatedAt', 'DESC']],
            limit: 1
        });

        if (ticketsConNotas.length > 0 && ticketsConNotas[0].historial && ticketsConNotas[0].historial.length > 0) {
            const ticket = ticketsConNotas[0];
            const ultimaNota = ticket.historial[ticket.historial.length - 1];

            const historialTexto = ticket.historial.map((h: any) =>
                `📝 *${h.autor}* (${h.fecha}):\n${h.nota}`
            ).join('\n\n');

            return {
                handled: true,
                reply: `*Ticket #${ticket.id}*: ${ticket.asunto}
Estado: ${ticket.estado.replace('_', ' ').toUpperCase()}
Ubicacion: ${ticket.ubicacion}

${historialTexto}`
            };
        }
    }

    // Ningun command coincidio -> dejar que la IA lo procese
    return { handled: false };
};
