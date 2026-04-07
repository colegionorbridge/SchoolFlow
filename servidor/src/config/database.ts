import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Usamos la URL del .env
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    throw new Error('DATABASE_URL no está definida en el archivo .env');
}

export const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: false, // Para no ensuciar la consola con SQL
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false // Necesario para conexiones seguras con Neon
        }
    }
});