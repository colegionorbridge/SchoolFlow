import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import * as tickets from '../controllers/tickets.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', tickets.getAll);
router.get('/:id', tickets.getById);
router.post('/', tickets.create);
router.patch('/:id', adminMiddleware, tickets.update);

export default router;
