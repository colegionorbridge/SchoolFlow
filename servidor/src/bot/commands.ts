import { User, Sector, Ticket, Role } from '../models/models.js';
import { ejecutarAccion } from './actions.js';
import { io } from '../socket/server.js';

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
    const textoLower = texto.toLowerCase();
    
    // Patrón: "se arregló", "ya funciona" -> Cerrar ticket (manejo rápido sin comando)
    const frasesCierreRapido = ['se arreglo', 'ya funciona', 'ya esta listo', 'ya se resolvio', 'problema resuelto', 'solucionado'];
    if (frasesCierreRapido.some(frase => textoLower.includes(frase)) && user.context?.pendienteConfirmacion) {
        // Si ya hay una confirmación pendiente, delegar a handler.ts
        return { handled: false };
    }

    // Confirmación pendiente de cierre (usar mismo sistema que handler.ts)
    const pendiente = user.context?.pendienteConfirmacion;
    if (pendiente && pendiente.datos?.accion === 'CERRAR_TICKET') {
        const respuesta = texto.toLowerCase();
        const confirmaciones = ['si', 'sí', 'confirmo', 'confirmar', 'dale', 'ok'];
        const cancelaciones = ['no', 'cancelo', 'cancelar', 'no quiero'];
        
        if (confirmaciones.some(c => respuesta === c || respuesta.includes(c))) {
            // La ejecución real la hace handler.ts, aquí solo limpiamos
            return { handled: false }; // Dejar que handler.ts maneje
        }
        if (cancelaciones.some(c => respuesta === c || respuesta.includes(c))) {
            user.context = { ...(user.context || {}), pendienteConfirmacion: null };
            user.changed('context', true);
            await user.save();
            return { handled: true, reply: 'OK, el ticket sigue abierto.' };
        }
    }

    // Detección de cortesía (gracias, perfecto, ok) - después de confirmaciones pendientes
    const cortesias = ['gracias', 'muchas gracias', 'perfecto', 'genial', 'de nada'];
    if (cortesias.some(c => textoLower === c || textoLower.includes(c))) {
        return { handled: true, reply: '¡De nada! Si necesitás algo más, avisame 😊' };
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

    // Comando: /tickets - Ver tickets activos (abiertos/en proceso)
    if (texto === '/tickets' || texto === '/tickets-activos') {
        const tickets = await Ticket.findAll({
            where: { 
                userTelefono: user.telefono,
                estado: ['abierto', 'en_proceso'] 
            },
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        if (tickets.length === 0) {
            return { handled: true, reply: 'No tenés tickets activos.' };
        }

        const lista = tickets.map(t => {
            const emoji = t.estado === 'abierto' ? '🟠' : '🔵';
            const fecha = new Date(t.createdAt).toLocaleString('es-AR');
            const historial = getHistorial(t);
            const comentarios = historial.length > 0 ? '💬 Con comentarios' : '📭 Sin comentarios';
            return `${emoji} *#${t.id}* - ${t.asunto}
📍 ${t.ubicacion}
🕒 ${fecha}
${comentarios}`;
        }).join('\n\n');
        
        return {
            handled: true,
            reply: `📋 *Tickets activos:*\n\n${lista}`
        };
    }

    // Comando: /todos - Ver TODOS los tickets
    if (texto === '/todos' || texto === '/todos-tickets') {
        const tickets = await Ticket.findAll({
            where: { userTelefono: user.telefono },
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        if (tickets.length === 0) {
            return { handled: true, reply: 'No tenés tickets registrados.' };
        }

        const lista = tickets.map(t => {
            const emoji = t.estado === 'abierto' ? '🟠' : t.estado === 'en_proceso' ? '🔵' : '🟢';
            const fecha = new Date(t.createdAt).toLocaleString('es-AR');
            const historial = getHistorial(t);
            const comentarios = historial.length > 0 ? '💬 Con comentarios' : '📭 Sin comentarios';
            return `${emoji} *#${t.id}* - ${t.asunto}
📍 ${t.ubicacion}
🕒 ${fecha}
${comentarios}`;
        }).join('\n\n');

        return {
            handled: true,
            reply: `📋 *Todos tus tickets:*\n\n${lista}`
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
            reply: `${emoji} *Ticket #${ticket.id}*\n\n` +
                `📌 *Asunto:* ${ticket.asunto}\n` +
                `📊 *Estado:* ${ticket.estado.replace('_', ' ').toUpperCase()}\n` +
                `🔴 *Prioridad:* ${ticket.prioridad}\n` +
                `📍 *Ubicación:* ${ticket.ubicacion}\n\n` +
                `${historial.length > 0 ? '📝 *Últimas notas:*\n' + historial.slice(-2).map((h: any) => `• ${h.fecha}: ${h.nota}`).join('\n') : 'Sin notas registradas.'}`
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

    // Comando: /cerrar [id] o cerrar ticket [id] (con o sin /)
    // Enfoque simple: si contiene "cerrar", extraer el número
    let ticketId = 0;
    if (texto.toLowerCase().includes('cerrar')) {
        const numeros = texto.match(/\d+/g);
        if (numeros && numeros.length > 0) {
            // El último número debería ser el ID del ticket
            ticketId = parseInt(numeros[numeros.length - 1], 10);
            console.log(`🔍 [Cerrar] Texto: "${texto}" | Números encontrados: ${JSON.stringify(numeros)} | ID: ${ticketId}`);
        }
    }
    
    if (ticketId > 0) {

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

    // Patron: "ticket" solo o "tickets" -> mostrar tickets activos
    if (textoLower === 'ticket' || textoLower === 'tickets' || textoLower === 'mis tickets') {
        return { handled: false }; // Dejar que IA muestre los tickets o comando /mis-tickets
    }

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

        // Si parece un cierre ("5 se arreglo"), manejar cierre con este ID específico
        if (frasesCierre.some(f => resto.toLowerCase().includes(f))) {
            const ticketParaCerrar = await Ticket.findOne({
                where: { id: ticketId, userTelefono: user.telefono }
            });

            if (!ticketParaCerrar) {
                return { handled: true, reply: `No se encontro el ticket #${ticketId} asociado a tu numero.` };
            }

            if (ticketParaCerrar.estado === 'cerrado') {
                return { handled: true, reply: `El ticket #${ticketId} ya esta cerrado.` };
            }

            // Confirmar antes de cerrar usando el ID específico
            user.context = {
                ...(user.context || {}),
                esperandoCierreConfirmacion: {
                    ticketId: ticketParaCerrar.id,
                    asunto: ticketParaCerrar.asunto
                }
            };
            user.changed('context', true);
            await user.save();

            return {
                handled: true,
                reply: `¿Queres cerrar el ticket *#${ticketParaCerrar.id}*: "${ticketParaCerrar.asunto}"?\n\nRespondé *SI* para confirmar o *NO* para cancelar.`
            };
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

        if (io) {
            const ticketActualizado = await Ticket.findByPk(ticket.id, {
                include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
            });
            io.emit('ticket-actualizado', ticketActualizado);
        }

        return {
            handled: true,
            reply: `✅ Comentario agregado al ticket *#${ticket.id}*: "${ticket.asunto}"`
        };
    }

    // Patron: "se arreglo", "ya funciona", "ya esta listo" -> Cerrar ticket mas reciente
    if (frasesCierre.some(frase => texto.toLowerCase().includes(frase))) {
        // Si ya hay una confirmacion pendiente, no sobreescribir
        if (user.context?.pendienteConfirmacion) {
            return { handled: false };
        }

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

        // Usar el mismo sistema que handler.ts
        user.context = {
            ...(user.context || {}),
            pendienteConfirmacion: {
                accionOriginal: 'CERRAR_TICKET',
                datos: {
                    accion: 'CERRAR_TICKET',
                    ticketData: { id: ticketReciente.id, asunto: ticketReciente.asunto }
                }
            }
        };
        user.changed('context', true);
        await user.save();

        return {
            handled: true,
            reply: `¿Queres cerrar el ticket *#${ticketReciente.id}*: "${ticketReciente.asunto}"?\n\nRespondé *SI* para confirmar o *NO* para cancelar.`
        };
    }

    // Ningun command coincidio -> dejar que la IA lo procese
    return { handled: false };
};
