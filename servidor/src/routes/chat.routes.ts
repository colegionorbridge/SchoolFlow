import { Router } from 'express';
import {
  iniciarChat,
  enviarMensaje,
  finalizarChat,
  estadoChat,
  getConversacion,
} from '../controllers/chat.controller.js';

const router: Router = Router();

router.get('/:id/chat', estadoChat);
router.post('/:id/chat/iniciar', iniciarChat);
router.post('/:id/chat/enviar', enviarMensaje);
router.post('/:id/chat/finalizar', finalizarChat);
router.get('/:id/conversacion', getConversacion);

export default router;
