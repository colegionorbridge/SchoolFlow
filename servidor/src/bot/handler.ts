import { User, Role, Sector } from '../models/models.js';

export const handleIncomingMessage = async (msg: any) => {
    // 1. OBTENER EL NÚMERO REAL
    // Si el ID contiene 'lid', le pedimos a WhatsApp el número real de contacto
    let contacto = await msg.getContact();
    const telefono = contacto.number; // Esto te devuelve el número limpio (ej: 54911...)

    console.log(`🔎 Procesando mensaje de: ${telefono} (ID Original: ${msg.from})`);

    try {
        // 2. Buscamos al usuario en Neon usando el número real
        const user = await User.findByPk(telefono, {
            include: [
                { model: Role, as: 'rol' },
                { model: Sector, as: 'sectores' }
            ]
        }) as any;

        if (!user) {
            await msg.reply('¡Hola! Bienvenido al asistente del Colegio Norbridge. No reconozco tu número en nuestro sistema.');
            return;
        }

        if (user.pasoRegistro >= 4) {
            const nombre = user.nombreCompleto || 'Usuario';
            const nombreRol = user.rol?.nombre || 'Personal';
            
            await msg.reply(`Hola ${nombre}. Veo que sos ${nombreRol} en el colegio. Recibí tu mensaje: "${msg.body}".`);
            return;
        }

        await msg.reply('Hola, estamos terminando de configurar tu perfil.');

    } catch (error) {
        console.error('❌ Error en el handler:', error);
    }
};