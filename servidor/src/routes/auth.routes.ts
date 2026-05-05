import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', async (req: any, res: any) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password requerido' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error('❌ ADMIN_PASSWORD no está configurado en .env');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { role: 'admin', exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) }, // 8 horas
      process.env.JWT_SECRET || 'secret-temporal'
    );

    res.json({ 
      success: true, 
      token,
      expiresIn: 8 * 60 * 60 // 8 horas en segundos
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/verify', async (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ valid: false, error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false, error: 'Token faltante' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-temporal');
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
  }
});

export default router;
