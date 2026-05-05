import { Router } from 'express';
import {
  getTickets,
  getUsuarios,
  updateTicket,
  updateUsuario,
  getRoles,
  getSectores,
  createSector,
  updateSector,
  deleteSector
} from '../controllers/dashboard.controller.js';

const router: Router = Router();

// Tickets
router.get('/tickets', getTickets);
router.patch('/tickets/:id', updateTicket);

// Usuarios
router.get('/usuarios', getUsuarios);
router.patch('/usuarios/:telefono', updateUsuario);

// Roles
router.get('/roles', getRoles);

// Sectores
router.get('/sectores', getSectores);
router.post('/sectores', createSector);
router.patch('/sectores/:id', updateSector);
router.delete('/sectores/:id', deleteSector);

export default router;