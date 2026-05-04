import { User, Sector, Ticket, Role } from '../models/models.js';
import { ejecutarAccion } from './actions.js';

/**
 * SISTEMA DE COMMANDS DIRECTOS (SIN IA)
 * Estas funciones se ejecutan sin llamar a Groq, ahorrando tokens.
 */

interface CommandResult {
    handled: boolean;
    reply?: string;
}

/**
 * Normaliza el historial: si es string JSON, lo parsea.
 * Si es null/undefined, devuelve array vacio.
 */
const getHistorial = (ticket: any): any[] => {
    if (!ticket.historial) return [];
    if (Array.isArray(ticket.historial)) return ticket.historial;
    if (typeof ticket.historial === 'string') {
        try {
            const parsed = JSON.parse(ticket.historial);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

export const processCommand = async (msg: any, user: any): Promise<CommandResult> => {
    const texto = msg.body.trim();

    // Confirmacion pendiente de una accion de IA (SI/NO)
    const pendiente = user.context?.pendienteConfirmacion;
    if (pendiente) {
        const respuesta = texto.toLowerCase();
        const confirmaciones = ['si', 'sí', 'confirmo', 'confirmar', 'dale', 'ok', 'dale que si'];
        const cancelaciones = ['no', 'cancelo', 'cancelar', 'no quiero', 'dale que no'];

        if (confirmaciones.some(c => respuesta === c || respuesta.includes(c))) {
            user.context = { ...(user.context || {}), pendienteConfirmacion: null };
            user.changed('context', true);
            await user.save();

            await ejecutarAccion(msg, user, user.telefono, pendiente.accion, pendiente.datos.ticketData);
            return { handled: true };
        }

        if (cancelaciones.some(c => respuesta === c || respuesta.includes(c))) {
            user.context = { ...(user.context || {}), pendienteConfirmacion: null };
            user.changed('context', true);
            await user.save();
            return { handled: true, reply: 'Entendido, se cancelo la accion.' };
        }
    }

    // Comando: /ayuda
    if (texto === '/ayuda' || texto === '/help') {
        return {
            handled: true,
            reply: `Comandos disponibles:

/mis-tickets - Ver tus tickets activos
/estado [id] - Ver estado de un ticket (ej: /estado 5)
/comentarios [id] - Ver todo el historial de un ticket (ej: /comentarios 5)
/cerrar [id] - Cerrar un ticket (ej: /cerrar 3)
/ayuda - Mostrar esta lista

Tambien podes:
- Reportar un problema nuevo escribiendolo normalmente
- Agregar un comentario escribiendo "ticket #[numero] [tu comentario]"
- Decir "ver comentarios del 5" para ver el historial
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

        const historial = getHistorial(ticket);
        const emoji = ticket.estado === 'abierto' ? '🟠' : ticket.estado === 'en_proceso' ? '🔵' : '🟢';
        return {
            handled: true,
            reply: `${emoji} *Ticket #${ticket.id}*

Asunto: ${ticket.asunto}
Estado: ${ticket.estado.replace('_', ' ').toUpperCase()}
Prioridad: ${ticket.prioridad}
Ubicacion: ${ticket.ubicacion}

${historial.length > 0 ? 'Ultimas notas:\n' + historial.slice(-2).map((h: any) => `- ${h.fecha}: ${h.nota}`).join('\n') : 'Sin notas registradas.'}`
        };
    }

    // Comando: /comentarios [id] o /historial [id]
    if (texto.startsWith('/comentarios ') || texto.startsWith('/comentarios#') || texto.startsWith('/historial ') || texto.startsWith('/historial#')) {
        const idStr = texto.split(/[\s#]+/)[1];
        const ticketId = parseInt(idStr, 10);

        if (isNaN(ticketId)) {
            return { handled: true, reply: 'Formato incorrecto. Usá: /comentarios [numero]' };
        }

        const ticket = await Ticket.findOne({
            where: { id: ticketId, userTelefono: user.telefono }
        });

        if (!ticket) {
            return { handled: true, reply: `No se encontro el ticket #${ticketId}.` };
        }

        const historial = getHistorial(ticket);
        if (historial.length === 0) {
            return { handled: true, reply: `El ticket *#${ticket.id}* no tiene notas registradas.` };
        }

        const notasTexto = historial.map((h: any, i: number) =>
            `*${i + 1}.* ${h.autor} (${h.fecha}):\n${h.nota}`
        ).join('\n\n');

        return {
            handled: true,
            reply: `📋 *Historial del ticket #${ticket.id}*: "${ticket.asunto}"

${notasTexto}`
        };
    }

    // Patron natural: "ver comentarios del ticket X", "historial del 5", "ver notas del ticket 3"
    const matchVerComentarios = texto.match(/(?:ver|mostrar|leer|consultar)\s*(?:los\s*)?(?:comentarios?|notas?|historial|seguimiento)(?:\s*del\s*|\s*de\s*|)(?:ticket\s*)?#?(\d+)/i);
    if (matchVerComentarios) {
        const ticketId = parseInt(matchVerComentarios[1], 10);

        const ticket = await Ticket.findOne({
            where: { id: ticketId, userTelefono: user.telefono }
        });

        if (!ticket) {
            return { handled: true, reply: `No se encontro el ticket #${ticketId}.` };
        }

        const historial = getHistorial(ticket);
        if (historial.length === 0) {
            return { handled: true, reply: `El ticket *#${ticket.id}* no tiene notas registradas.` };
        }

        const notasTexto = historial.map((h: any, i: number) =>
            `*${i + 1}.* ${h.autor} (${h.fecha}):\n${h.nota}`
        ).join('\n\n');

        return {
            handled: true,
            reply: `📋 *Historial del ticket #${ticket.id}*: "${ticket.asunto}"

${notasTexto}`
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

        const historial = getHistorial(ticket);
        const notaCierre = {
            fecha: new Date().toLocaleString('es-AR'),
            autor: user.nombreCompleto || 'Usuario',
            nota: 'Ticket cerrado por el usuario.'
        };

        ticket.estado = 'cerrado';
        ticket.historial = [...historial, notaCierre];
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

    // Frases de cierre (se usa en el patron de comentarios y en el de cierre directo)
    const frasesCierre = ['se arreglo', 'ya funciona', 'ya esta listo', 'ya se resolvio', 'problema resuelto', 'solucionado'];

    // Palabras de consulta que indican que el usuario QUIERE VER info, NO agregar
    const palabrasConsulta = ['ver comentarios', 'ver notas', 'ver historial', 'mostrar comentarios', 'mostrar notas', 'mostrar historial', 'leer comentarios', 'leer notas', 'leer historial', 'consultar historial', 'seguimiento del ticket'];

    // Patron: detectar referencia a ticket + comentario directo
    // Ejemplos: "ticket #5 comentario", "el 5 sigue roto", "agrega al ticket 3 que..."
    const matchTicket = texto.match(/(?:ticket\s*#?|ticket|#)(\d+)\s*[,\-:]?\s*(.+)/i);
    if (matchTicket) {
        const ticketId = parseInt(matchTicket[1], 10);
        const resto = matchTicket[2].trim();

        // Ignorar si el texto parece un comando
        if (texto.startsWith('/')) {
            return { handled: false };
        }

        // Ignorar si parece consulta de comentarios/notas
        if (palabrasConsulta.some(p => texto.toLowerCase().includes(p))) {
            return { handled: false };
        }

        // Ignorar si el resto empieza con palabras de consulta
        const inicioConsulta = ['ver', 'mostrar', 'leer', 'consultar', 'historial', 'comentarios', 'notas', 'seguimiento'];
        if (inicioConsulta.some(p => resto.toLowerCase().startsWith(p))) {
            return { handled: false };
        }

        // Ignorar si parece un cierre ("5 se arreglo")
        if (frasesCierre.some(f => resto.toLowerCase().includes(f))) {
            return { handled: false };
        }

        const ticket = await Ticket.findOne({
            where: { id: ticketId, userTelefono: user.telefono }
        });

        if (!ticket) {
            return { handled: true, reply: `No se encontro el ticket #${ticketId} asociado a tu numero.` };
        }

        if (ticket.estado === 'cerrado') {
            return { handled: true, reply: `El ticket #${ticketId} esta cerrado. Si necesitas ayuda, crea un ticket nuevo.` };
        }

        const historial = getHistorial(ticket);
        const nuevaNota = {
            fecha: new Date().toLocaleString('es-AR'),
            autor: user.nombreCompleto || 'Usuario',
            nota: resto
        };

        ticket.historial = [...historial, nuevaNota];
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
                const historial = getHistorial(ticket);
                const notaCierre = {
                    fecha: new Date().toLocaleString('es-AR'),
                    autor: user.nombreCompleto || 'Usuario',
                    nota: 'Ticket cerrado por el usuario.'
                };
                ticket.estado = 'cerrado';
                ticket.historial = [...historial, notaCierre];
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

    // Ningun command coincidio -> dejar que la IA lo procese
    return { handled: false };
};
