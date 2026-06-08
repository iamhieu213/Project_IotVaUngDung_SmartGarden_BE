import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { HouseService } from './house.service';
import { CreateHouseSchema } from './house.dto';
import { z } from 'zod';

export class HouseController {
  private houseService: HouseService;

  constructor() {
    this.houseService = new HouseService();
  }

  createHouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      
      // Kiểm tra dữ liệu đầu vào
      const houseData = CreateHouseSchema.parse(req.body);
      const result = await this.houseService.createHouse(houseData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Tạo nhà nấm mới thành công',
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dữ liệu đầu vào không hợp lệ',
          errors: error.issues.map((err) => ({
            field: String(err.path[0] || ''),
            message: err.message,
          })),
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Tạo nhà nấm thất bại',
      });
    }
  };

  getHouses = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const result = await this.houseService.getHousesByOwner(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Lấy danh sách nhà nấm thành công',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách nhà nấm thất bại',
      });
    }
  };
}