import { User, Role, Sector, Ticket } from '../models/models.js';
import { consultarGroq } from './groq.js';
import { manejarRegistro } from './registro.js';

export const handleIncomingMessage = async (msg: any) => {
    // Definimos la variable user fuera para poder usarla en el catch/finally
    let user: any = null;

    try {
        const contacto = await msg.getContact();
        const telefono = contacto.number; 

        // 1. Buscar usuario con sus relaciones
        user = await User.findByPk(telefono, {
            include: [
                { model: Role, as: 'rol' }, 
                { model: Sector, as: 'sectores' }
            ]
        });

        // 2. Lógica de registro
        if (!user || (!user.registroCompleto && !user.esAdmin)) {
            await manejarRegistro(msg, user, telefono);
            return;
        }

        // --- BLOQUEO DE SEGURIDAD (ANTI-DUPLICADOS) ---
        // Si ya hay un proceso activo para este número, ignoramos este nuevo mensaje
        if (user.context?.procesando === true) {
            console.log(`⚠️ Ignorando mensaje duplicado de ${telefono} (proceso en curso)`);
            return;
        }

        // Marcamos el inicio del proceso
        user.context = { ...user.context, procesando: true };
        user.changed('context', true);
        await user.save();

        // --- 3. FLUJO CON IA ---
        const chat = await msg.getChat();
        const mensajesPrevios = await chat.fetchMessages({ limit: 10 });

        const historialParaIA = mensajesPrevios
            .filter((m: any) => m.body && m.body.trim() !== "")
            .map((m: any) => ({
                role: m.fromMe ? 'model' as const : 'user' as const,
                parts: [{ text: m.body }]
            }));

        const resultadoIA = await consultarGroq(msg.body, historialParaIA, user);

        // A. Enviamos la respuesta de la IA (Confirmación de palabra)
        await msg.reply(resultadoIA.respuesta);

        // B. Ejecución de Acciones Técnicas
        const { accion, ticketData } = resultadoIA;

        // ACCIÓN 1: CREAR TICKET
        if (accion === 'CREAR_TICKET' && ticketData.asunto) {
            const nuevoTicket = await Ticket.create({
                asunto: ticketData.asunto,
                descripcion: ticketData.descripcion || "Sin descripción adicional",
                ubicacion: ticketData.ubicacion,
                userTelefono: telefono,
                estado: 'abierto',
                historial: [] 
            });
            await msg.reply(`✅ **Ticket #${nuevoTicket.id} generado.**\nYa podés consultarlo en cualquier momento.`);
        }

        // ACCIÓN 2 y 3: AGREGAR COMENTARIO o CERRAR TICKET
        if (accion === 'AGREGAR_COMENTARIO' || accion === 'CERRAR_TICKET') {
            const ticket = await Ticket.findByPk(ticketData.id);

            if (!ticket) {
                await msg.reply(`⚠️ No se encontró el Ticket #${ticketData.id}.`);
            } else {
                const nuevaNota = {
                    fecha: new Date().toLocaleString('es-AR'),
                    autor: user.nombreCompleto,
                    nota: ticketData.comentario || (accion === 'CERRAR_TICKET' ? "Ticket cerrado por el usuario." : "Información adicional")
                };

                const nuevoHistorial = [...(ticket.historial || []), nuevaNota];
                ticket.historial = nuevoHistorial;

                if (accion === 'CERRAR_TICKET') {
                    ticket.estado = 'cerrado';
                }

                await ticket.save();
                
                const txtExito = accion === 'CERRAR_TICKET' ? 'cerrado' : 'actualizado';
                await msg.reply(`✅ **Ticket #${ticket.id} ${txtExito}** correctamente.`);
            }
        }

    } catch (error) {
        console.error('❌ Error crítico en el handler:', error);
    } finally {
        // --- LIBERACIÓN FINAL ---
        // Pase lo que pase, al final del flujo liberamos al usuario 
        // para que pueda volver a enviar mensajes.
        if (user) {
            user.context = { ...user.context, procesando: false };
            user.changed('context', true);
            await user.save();
        }
    }
};