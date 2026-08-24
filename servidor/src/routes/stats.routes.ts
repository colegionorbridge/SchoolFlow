import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getResumen,
  getPorSector,
  getPorMes,
  getUsuariosTop
} from '../controllers/stats.controller.js';

const router: Router = Router();
router.use(authMiddleware);

router.get('/resumen', getResumen);
router.get('/por-sector', getPorSector);
router.get('/por-mes', getPorMes);
router.get('/usuarios-top', getUsuariosTop);

export default router;
