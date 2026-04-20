import { Router } from 'express';
// Importamos los controladores. 
// Usamos .js al final porque tu proyecto usa ESM (módulos nativos)
import { getTickets, getUsuarios } from '../controllers/dashboard.controller.js';

const router: Router = Router();

/**
 * @route GET /api/tickets
 * @desc Obtener todos los incidentes con los datos de sus autores
 */
router.get('/tickets', getTickets);

/**
 * @route GET /api/usuarios
 * @desc Obtener la lista de personal registrado (docentes, admin, etc)
 */
router.get('/usuarios', getUsuarios);

export default router;