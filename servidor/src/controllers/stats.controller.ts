import { type Request, type Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/models.js';

export const getResumen = async (_req: Request, res: Response) => {
  try {
    const data = await sequelize.query(`
      SELECT
        COUNT(*)::int AS "totalTickets",
        COUNT(*) FILTER (WHERE estado = 'abierto')::int AS "abiertos",
        COUNT(*) FILTER (WHERE estado = 'en_proceso')::int AS "enProceso",
        COUNT(*) FILTER (WHERE estado = 'cerrado')::int AS "cerrados",
        COUNT(*) FILTER (WHERE prioridad = 'alta')::int AS "altaPrioridad",
        (SELECT COUNT(*)::int FROM usuarios WHERE "registroCompleto" = true) AS "usuariosRegistrados"
      FROM tickets
    `, { type: QueryTypes.SELECT });
    res.json(data[0]);
  } catch (error) {
    console.error('Error en getResumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};

export const getPorSector = async (_req: Request, res: Response) => {
  try {
    const data = await sequelize.query(`
      SELECT
        CASE UPPER(TRIM(SPLIT_PART(ubicacion, ' - ', 1)))
          WHEN 'PRIMARIA' THEN 'Primaria'
          WHEN 'SECUNDARIA' THEN 'Secundaria'
          WHEN 'SECTOR COMUN' THEN 'Sector Comun'
          WHEN 'SECTOR COMÚN' THEN 'Sector Comun'
          WHEN 'INICIAL' THEN 'Inicial'
          WHEN 'JARDIN' THEN 'Inicial'
          ELSE COALESCE(NULLIF(TRIM(SPLIT_PART(ubicacion, ' - ', 1)), ''), 'Sin sector')
        END AS sector,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'abierto')::int AS abiertos,
        COUNT(*) FILTER (WHERE estado = 'en_proceso')::int AS "enProceso",
        COUNT(*) FILTER (WHERE estado = 'cerrado')::int AS cerrados
      FROM tickets
      GROUP BY sector
      ORDER BY total DESC
    `, { type: QueryTypes.SELECT });
    res.json(data);
  } catch (error) {
    console.error('Error en getPorSector:', error);
    res.status(500).json({ error: 'Error al obtener tickets por sector' });
  }
};

export const getPorMes = async (_req: Request, res: Response) => {
  try {
    const data = await sequelize.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS mes,
        COUNT(*)::int AS creados,
        COUNT(*) FILTER (WHERE estado = 'cerrado')::int AS cerrados
      FROM tickets
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY mes
    `, { type: QueryTypes.SELECT });
    res.json(data);
  } catch (error) {
    console.error('Error en getPorMes:', error);
    res.status(500).json({ error: 'Error al obtener tickets por mes' });
  }
};

export const getUsuariosTop = async (_req: Request, res: Response) => {
  try {
    const data = await sequelize.query(`
      SELECT
        u.telefono,
        u."nombreCompleto",
        COUNT(t.id)::int AS "totalTickets",
        COUNT(*) FILTER (WHERE t.estado IN ('abierto', 'en_proceso'))::int AS "ticketsActivos",
        COUNT(*) FILTER (WHERE t.estado = 'cerrado')::int AS "ticketsCerrados",
        ROUND(AVG(
          CASE
            WHEN t.estado = 'cerrado' THEN EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 60
            ELSE NULL
          END
        ))::int AS "tiempoPromedioMinutos"
      FROM usuarios u
      LEFT JOIN tickets t ON t."userTelefono" = u.telefono
      WHERE u."registroCompleto" = true
      GROUP BY u.telefono, u."nombreCompleto"
      ORDER BY "totalTickets" DESC
      LIMIT 20
    `, { type: QueryTypes.SELECT });
    res.json(data);
  } catch (error) {
    console.error('Error en getUsuariosTop:', error);
    res.status(500).json({ error: 'Error al obtener top usuarios' });
  }
};
