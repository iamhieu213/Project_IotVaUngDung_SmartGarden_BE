import { Router } from 'express';
import { HouseController } from './house.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const houseController = new HouseController();

// Áp dụng middleware JWT xác thực cho tất cả routes nhà nấm
router.use(authMiddleware as any);

router.post('/create', houseController.createHouse as any);
router.get('/', houseController.getHouses as any);
router.get('/:id', houseController.getHouseById as any);

export default router;