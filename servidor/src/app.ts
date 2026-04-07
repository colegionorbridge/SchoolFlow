import express from 'express';
import dotenv from 'dotenv';
// Aquí importarás tus rutas cuando las crees
// import whatsappRoutes from './routes/whatsapp.routes.js';

dotenv.config();

const app = express();

/**
 * MIDDLEWARES
 */
app.use(express.json()); // Para procesar JSON en el cuerpo de las peticiones

/**
 * RUTAS
 */
// Ruta de salud del sistema
app.get('/ping', (_req, res) => {
    res.json({ 
        status: 'online', 
        message: 'Servidor del Colegio Norbridge funcionando' 
    });
});

// Ejemplo de dónde irían tus rutas de WhatsApp
// app.use('/webhook', whatsappRoutes);

export default app;