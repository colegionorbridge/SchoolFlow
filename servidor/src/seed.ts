import { Role, Sector, sequelize } from './models/models.js';

// Generador de códigos simples
const generarCodigo = (nombre: string) => {
    const prefijo = nombre.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefijo}-${random}`;
};

async function seed() {
    try {
        console.log('🌱 Iniciando el proceso de seeding para Norbridge...');
        
        // Usamos force: true solo si realmente borraste todo y querés recrear tablas desde cero.
        // Si no, 'alter: true' es más seguro.
        await sequelize.sync({ alter: true });

        // 1. Cargar Roles con sus códigos de acceso
        console.log('\n--- Verificando Roles ---');
        
        // Definimos los roles y cuáles llevan código
        const rolesConfig = [
            { nombre: 'Docente', codigo: null },
            { nombre: 'Preceptor', codigo: null },
            { nombre: 'Administrativo', codigo: null },
            { nombre: 'Mantenimiento', codigo: null },
            { nombre: 'Maestranza', codigo: null },
            { nombre: 'Apoyo', codigo: null }, // Agregamos Apoyo para la psicopedagoga
            { nombre: 'Directivo', codigo: 'DIR-2026' }, // Clave específica
            { nombre: 'Admin', codigo: 'MASTER-IT' }      // Clave específica
        ];
        
        for (const r of rolesConfig) {
            const [role, created] = await Role.findOrCreate({ 
                where: { nombre: r.nombre },
                defaults: { 
                    nombre: r.nombre,
                    codigoAcceso: r.codigo // Se guarda null si no tiene
                } as any
            });

            if (created) {
                console.log(`✅ Rol creado: ${r.nombre} ${r.codigo ? `(Protegido con: ${r.codigo})` : '(Libre)'}`);
            }
        }

        // 2. Cargar Sectores
        console.log('\n--- Verificando Sectores ---');
        const sectoresNombres = ['Inicial', 'Primaria', 'Secundaria', 'Multi Sector',];
        
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

        console.log('\n🚀 Estructura de base de datos lista y blindada.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error crítico durante el seeding:', error);
        process.exit(1);
    }
}

seed();