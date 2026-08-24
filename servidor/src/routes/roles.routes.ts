import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import * as roles from '../controllers/roles.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', roles.getAll);
router.post('/', adminMiddleware, roles.create);
router.patch('/:id', adminMiddleware, roles.update);
router.delete('/:id', adminMiddleware, roles.remove);

export default router;
