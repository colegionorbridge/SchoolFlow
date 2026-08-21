import 'dotenv/config';

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    console.error(`❌ Variable de entorno requerida no definida: ${key}`);
    process.exit(1);
  }
  return val;
};

export const config = {
  port: parseInt(process.env.PORT || '4001', 10),
  jwt: {
    secret: required('JWT_SECRET'),
  },
  adminPassword: process.env.ADMIN_PASSWORD || '',
  masterCode: process.env.MASTER_CODE || '',
  frontendUrl: process.env.FRONTEND_URL || 'https://school-flow-inky.vercel.app',
};
