import { Router } from 'express';
import { PresetController } from './preset.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const presetController = new PresetController();

router.use(authMiddleware as any);

router.post('/', presetController.createPreset as any);
router.get('/', presetController.getPresets as any);
router.get('/:id', presetController.getPresetById as any);
router.put('/:id', presetController.updatePreset as any);
router.delete('/:id', presetController.deletePreset as any);

export default router;
