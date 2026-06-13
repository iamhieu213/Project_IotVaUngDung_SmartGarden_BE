import { Router } from 'express';
import { DeviceController } from './device.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const deviceController = new DeviceController();


router.use(authMiddleware as any);

// Định nghĩa route lấy danh sách chờ tự động phát hiện trước
router.get('/unregistered', deviceController.getUnregisteredDevices as any);

router.post('/create', deviceController.createDevice as any);
router.get('/house/:houseId', deviceController.getDevicesByHouse as any);
router.delete('/:id', deviceController.deleteDevice as any);
router.put('/:id/sensor-position', deviceController.updateSensorPosition as any);

// 1. API lấy dữ liệu lịch sử môi trường gộp nhóm theo khoảng thời gian (24h, 7 ngày, 30 ngày)
router.get('/house/:houseId/telemetry-history', deviceController.getTelemetryHistory as any);
// 2. API phân tích trung bình chỉ số của tất cả nhà nấm để so sánh hiệu năng
router.get('/houses/comparison', deviceController.getHousesComparison as any);

export default router;