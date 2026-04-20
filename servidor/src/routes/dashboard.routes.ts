import { Router } from 'express';
import { 
  getTickets, 
  getUsuarios, 
  updateTicket // <-- Importamos el nuevo controlador
} from '../controllers/dashboard.controller.js';

const router: Router = Router();

router.get('/tickets', getTickets);
router.get('/usuarios', getUsuarios);

/**
 * @route PATCH /api/tickets/:id
 * @desc Actualizar estado, prioridad y añadir notas al historial
 */
router.patch('/tickets/:id', updateTicket);

export default router;