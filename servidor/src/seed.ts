import { Role, Sector, sequelize } from './models/models.js';

// Generador de códigos simples: 3 letras del sector + 4 caracteres aleatorios
const generarCodigo = (nombre: string) => {
    const prefijo = nombre.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefijo}-${random}`;
};

async function seed() {
    try {
        console.log('🌱 Iniciando el proceso de seeding para Norbridge...');
        
        // Sincronizamos los modelos. 
        // 'alter: true' ajusta tablas existentes, 'force: true' borraría todo (usar con cuidado).
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
            const [sector, created] = await Sector.findOrCreate({ 
                where: { nombre },
                defaults: { 
                    nombre: nombre, 
                    codigoAcceso: generarCodigo(nombre)
                } as any
            });

            if (created) {
                console.log(`✅ Sector creado: ${nombre} | Código: ${sector.codigoAcceso}`);
            } else {
                console.log(`ℹ️ Sector existente: ${nombre} | Código actual: ${sector.codigoAcceso}`);
            }
        }

        console.log('\n🚀 Estructura de base de datos lista para operar.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error crítico durante el seeding:', error);
        process.exit(1);
    }
}

seed();