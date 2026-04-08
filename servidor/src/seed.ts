import { Role, Sector, User, UserSector, sequelize } from './models/models.js';

// Generador de códigos simples: 3 letras del sector + 4 números/letras aleatorios
const generarCodigo = (nombre: string) => {
    const prefijo = nombre.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefijo}-${random}`;
};

async function seed() {
    try {
        console.log('🌱 Iniciando el proceso de seeding para Norbridge...');
        
        // Sincronizamos los modelos con la base de datos de Neon
        await sequelize.sync({ alter: true });

        // 1. Cargar Roles
        console.log('\n--- Verificando Roles ---');
        const rolesNombres = ['Docente', 'Preceptor', 'Administrativo', 'Mantenimiento', 'Maestranza', 'Admin'];
        for (const nombre of rolesNombres) {
            await Role.findOrCreate({ where: { nombre } });
        }
        console.log('✅ Roles verificados/creados.');

        // 2. Cargar Sectores
        console.log('\n--- Verificando Sectores ---');
        const sectoresNombres = ['Inicial', 'Primaria', 'Secundaria', 'Multi Sector'];
        for (const nombre of sectoresNombres) {
            // CORRECCIÓN AQUÍ: Pasamos 'nombre' también en defaults para satisfacer a TS
            const [sector, created] = await Sector.findOrCreate({ 
                where: { nombre },
                defaults: { 
                    nombre: nombre, 
                    codigoAcceso: generarCodigo(nombre)
                } as any
            });
            if (created) console.log(`✅ Sector creado: ${nombre} | Código: ${sector.codigoAcceso}`);
        }

        // 3. Crear Usuario Admin Maestro y vincularlo
        console.log('\n--- Configurando Usuario Administrador ---');
        
        const adminRole = await Role.findOne({ where: { nombre: 'Admin' } });
        const multiSector = await Sector.findOne({ where: { nombre: 'Multi Sector' } });

        if (adminRole && multiSector) {
            // RECUERDA: Cambia este número por tu WhatsApp real para las pruebas
            const miTelefono = '541112345678'; 

            const [admin, created] = await User.findOrCreate({
                where: { telefono: miTelefono },
                defaults: {
                    nombreCompleto: 'Admin Maestro',
                    email: 'admin@norbridge.edu.ar',
                    roleId: adminRole.id,
                    esAdmin: true,
                    registroCompleto: true,
                    pasoRegistro: 100, 
                    activo: true
                } as any
            });

            // Vinculamos en la tabla intermedia
            await UserSector.findOrCreate({
                where: { 
                    // @ts-ignore
                    userTelefono: admin.telefono, 
                    sectorId: multiSector.id 
                }
            });

            if (created) {
                console.log(`👑 Admin Maestro creado exitosamente.`);
            } else {
                console.log(`ℹ️ El Admin Maestro ya existe.`);
            }
        }

        console.log('\n🚀 Base de datos de Norbridge lista para operar.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error crítico durante el seeding:', error);
        process.exit(1);
    }
}

seed();