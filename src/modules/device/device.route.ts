import { Router } from 'express';
import { DeviceController } from './device.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const deviceController = new DeviceController();

router.get('/unregistered', deviceController.getUnregisteredDevices as any);

router.use(authMiddleware as any);

// Định nghĩa route lấy danh sách chờ tự động phát hiện trước
// router.get('/unregistered', deviceController.getUnregisteredDevices as any);

router.post('/create', deviceController.createDevice as any);
router.get('/house/:houseId', deviceController.getDevicesByHouse as any);
router.delete('/:id', deviceController.deleteDevice as any);
router.put('/:id/sensor-position', deviceController.updateSensorPosition as any);

export default router;