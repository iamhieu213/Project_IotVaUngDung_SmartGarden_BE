import { Router } from 'express';
import { AlertController } from './alert.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const alertController = new AlertController();

// Yêu cầu xác thực đăng nhập trước khi gọi các API cảnh báo
router.use(authMiddleware as any);

router.get('/house/:houseId', alertController.getAlerts as any);
router.put('/:id/resolve', alertController.resolveAlert as any);

export default router;
