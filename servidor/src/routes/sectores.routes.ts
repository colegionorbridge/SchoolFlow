import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import * as sectores from '../controllers/sectores.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', sectores.getAll);
router.get('/:id', sectores.getById);
router.post('/', adminMiddleware, sectores.create);
router.patch('/:id', adminMiddleware, sectores.update);
router.delete('/:id', adminMiddleware, sectores.remove);

export default router;
