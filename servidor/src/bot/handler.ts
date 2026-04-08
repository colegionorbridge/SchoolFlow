import { User, Role, Sector } from '../models/models.js';
import { consultarGroq } from './groq.js';

export const handleIncomingMessage = async (msg: any) => {
    try {
        // 1. Obtenemos el contacto y el número
        const contacto = await msg.getContact();
        const telefono = contacto.number; 

        console.log(`📩 Mensaje de: ${telefono}`);

        // 2. Buscamos al usuario en la DB
        // Agregamos 'as any' al final de la consulta para que TS no se queje de las relaciones (rol, sectores)
        const user = await User.findByPk(telefono, {
            include: [
                { model: Role, as: 'rol' },
                { model: Sector, as: 'sectores' }
            ]
        }) as any;

        // --- SI EL USUARIO NO EXISTE ---
        if (!user) {
            await msg.reply('Hola, bienvenido al Colegio Norbridge. No reconozco tu número. Pronto implementaremos el registro automático.');
            return;
        }

        // --- SI EL USUARIO EXISTE ---
        // Verificamos pasoRegistro o esAdmin
        if (user.pasoRegistro >= 4 || user.esAdmin) {
            
            // Obtenemos el chat
            const chat = await msg.getChat();
            
            // Traemos los mensajes previos
            const mensajesPrevios = await chat.fetchMessages({ limit: 6 });

            // Formateamos el historial
            // Forzamos el tipo de 'role' para que coincida con lo que espera Gemini (user | model)
          // Filtramos solo los mensajes que tienen texto y mapeamos
const historialParaIA = mensajesPrevios
    .filter((m: any) => m.body && m.body.trim() !== "") // Evita mensajes vacíos
    .map((m: any) => ({
        role: m.fromMe ? 'model' as const : 'user' as const,
        parts: [{ text: m.body }]
    }));

            // Consultamos a la IA
            const respuestaIA = await consultarGroq(msg.body, historialParaIA, user);
            
            await msg.reply(respuestaIA);
            return;
        }

        await msg.reply('Tu perfil está siendo configurado. Aguarda un momento.');

    } catch (error) {
        // Agregamos un log más detallado por si el error es de la DB o de la IA
        console.error('❌ Error en el handler:', error);
    }
};