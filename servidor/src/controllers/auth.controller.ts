import type { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/models.js';
import { config } from '../config/index.js';
import { getSetting } from '../config/settings.js';
import { getBotStatus } from '../socket/server.js';
import { logger } from '../config/logger.js';

const codigos = new Map<string, { codigo: string; expires: number }>();
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutos

function limpiarExpirados() {
  const now = Date.now();
  for (const [key, val] of codigos) {
    if (val.expires < now) codigos.delete(key);
  }
}
setInterval(limpiarExpirados, 60000);

export async function solicitarCodigo(req: Request, res: Response) {
  try {
    const { telefono } = req.body;
    if (!telefono) return res.status(400).json({ error: 'ID requerido' });

    const bot = getBotStatus();
    if (!bot.connected) {
      return res.status(503).json({ error: 'Bot de WhatsApp desconectado. Usá el código maestro para ingresar.' });
    }

    const user = await User.findByPk(telefono);
    if (!user || !user.registroCompleto) {
      return res.status(404).json({ error: 'Usuario no registrado.' });
    }

    const codigo = crypto.randomInt(100000, 999999).toString();
    codigos.set(`auth:${telefono}`, { codigo, expires: Date.now() + OTP_EXPIRY });

    const { enviarTexto } = await import('../bot/enviar.js');
    await enviarTexto(telefono,
      `🔐 *Código de acceso*\n\nTu código es: *${codigo}*\n\nExpira en 5 minutos.\nSi no lo pediste vos, ignorá este mensaje.`);
    logger.info({ telefono }, 'Código OTP generado');

    res.json({ message: 'Código enviado a tu WhatsApp' });
  } catch (e) {
    logger.error({ err: e }, 'Error en solicitarCodigo');
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function verificarCodigo(req: Request, res: Response) {
  try {
    const { telefono, codigo } = req.body;
    if (!telefono || !codigo) return res.status(400).json({ error: 'Teléfono y código requeridos' });

    const esMasterCode = getSetting('masterCode') && codigo === getSetting('masterCode');

    if (esMasterCode) {
      const token = jwt.sign(
        { telefono, esAdmin: true, superAdmin: true, nombre: 'Admin' },
        config.jwt.secret,
        { expiresIn: '24h' },
      );
      return res.json({ token, esAdmin: true, superAdmin: true, nombre: 'Admin' });
    }

    const almacenado = codigos.get(`auth:${telefono}`);
    if (!almacenado || almacenado.expires < Date.now() || almacenado.codigo !== codigo) {
      return res.status(401).json({ error: 'Código inválido o expirado' });
    }
    codigos.delete(`auth:${telefono}`);

    const user = await User.findByPk(telefono);
    const esAdmin = user?.esAdmin || false;
    const token = jwt.sign(
      { telefono, esAdmin, nombre: user?.nombreCompleto || telefono },
      config.jwt.secret,
      { expiresIn: '24h' },
    );

    res.json({ token, esAdmin, superAdmin: false, nombre: user?.nombreCompleto || telefono });
  } catch (e) {
    logger.error({ err: e }, 'Error en verificarCodigo');
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function listarAdmins(_req: Request, res: Response) {
  const admins = await User.findAll({
    where: { esAdmin: true, registroCompleto: true },
    attributes: ['telefono', 'nombreCompleto'],
    order: [['nombreCompleto', 'ASC']],
  });

  const lista = admins.map(u => ({
    id: u.telefono,
    nombre: u.nombreCompleto || 'Admin',
  }));

  if (config.superAdminPhone && !lista.find(a => a.id === config.superAdminPhone)) {
    const sa = await User.findByPk(config.superAdminPhone, { attributes: ['telefono', 'nombreCompleto'] });
    lista.unshift({
      id: config.superAdminPhone,
      nombre: sa?.nombreCompleto || 'Super Admin',
    });
  }

  res.json(lista);
}
