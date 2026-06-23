import { Router } from 'express';
import {
  getResumen,
  getPorSector,
  getPorMes,
  getUsuariosTop
} from '../controllers/stats.controller.js';

const router: Router = Router();

router.get('/stats/resumen', getResumen);
router.get('/stats/por-sector', getPorSector);
router.get('/stats/por-mes', getPorMes);
router.get('/stats/usuarios-top', getUsuariosTop);

export default router;
