import { User, Role, Sector, Ticket } from '../models/models.js';
import { consultarGroq } from './groq.js';
import { manejarRegistro } from './registro.js';

export const handleIncomingMessage = async (msg: any) => {
    try {
        const contacto = await msg.getContact();
        const telefono = contacto.number; 

        // 1. Buscar usuario con sus relaciones
        const user = await User.findByPk(telefono, {
            include: [
                { model: Role, as: 'rol' }, 
                { model: Sector, as: 'sectores' }
            ]
        }) as any;

        // 2. Lógica de registro (Pasos 0 a 4)
        if (!user || (user.pasoRegistro < 5 && !user.esAdmin)) {
            await manejarRegistro(msg, user, telefono);
            return;
        }

        // --- 3. FLUJO CON IA ---
        const chat = await msg.getChat();
        const mensajesPrevios = await chat.fetchMessages({ limit: 10 });

        const historialParaIA = mensajesPrevios
            .filter((m: any) => m.body && m.body.trim() !== "")
            .map((m: any) => ({
                role: m.fromMe ? 'model' as const : 'user' as const,
                parts: [{ text: m.body }]
            }));

        // Llamada a Groq: La IA decidirá si es charla o creación
        const resultadoIA = await consultarGroq(msg.body, historialParaIA, user);

        // A. Enviamos la respuesta de la IA (Ej: "Dale, aguardá que lo registro...")
        await msg.reply(resultadoIA.respuesta);

        // B. Si la IA activó la acción, el Handler toma la posta técnica
        if (resultadoIA.accion === 'CREAR_TICKET') {
            const data = resultadoIA.ticketData;
            
            if (data && data.asunto && data.ubicacion) {
                try {
                    // Creamos el registro real en PostgreSQL
                    const nuevoTicket = await Ticket.create({
                        asunto: data.asunto,
                        descripcion: data.descripcion || "Sin descripción adicional",
                        ubicacion: data.ubicacion,
                        userTelefono: telefono,
                        estado: 'abierto',
                        historial: [] 
                    });

                    // C. Notificación final con el ID real de la base de datos
                    // Esto es lo que el usuario ve como confirmación definitiva
                    await msg.reply(`✅ **Ticket #${nuevoTicket.id} generado con éxito.**\nAlejandro ha sido notificado y lo revisará pronto.`);
                    
                    console.log(`✅ Ticket #${nuevoTicket.id} creado exitosamente para ${telefono}`);
                } catch (dbError) {
                    console.error("❌ Error al guardar ticket en DB:", dbError);
                    await msg.reply("⚠️ Hubo un problema técnico al guardar el ticket. Por favor, contacta a soporte.");
                }
            }
        }

    } catch (error) {
        console.error('❌ Error crítico en el handler:', error);
    }
};