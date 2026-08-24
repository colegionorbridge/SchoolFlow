import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import {
  iniciarChat,
  enviarMensaje,
  finalizarChat,
  estadoChat,
  getConversacion,
} from '../controllers/chat.controller.js';

const router: Router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/:id/chat', estadoChat);
router.post('/:id/chat/iniciar', iniciarChat);
router.post('/:id/chat/enviar', enviarMensaje);
router.post('/:id/chat/finalizar', finalizarChat);
router.get('/:id/conversacion', getConversacion);

export default router;
