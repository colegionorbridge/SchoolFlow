import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    throw new Error('DATABASE_URL no está definida en el archivo .env');
}

const isLocal = dbUrl.includes('localhost') || dbUrl.includes('@db:');

export const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: false,
    ...(isLocal
        ? {}
        : {
              dialectOptions: {
                  ssl: {
                      require: true,
                      rejectUnauthorized: false
                  }
              }
          })
});