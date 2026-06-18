import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { HouseService } from './house.service';
import { CreateHouseSchema, UpdateHouseSchema } from './house.dto';
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

  getHouseById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, message: 'Thiếu mã nhà nấm (id)' });
        return;
      }
      const result = await this.houseService.getHouseById(id as string, req.user.id);
      if (!result) {
        res.status(404).json({ success: false, message: 'Không tìm thấy nhà nấm hoặc bạn không có quyền truy cập' });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Lấy thông tin chi tiết nhà nấm thành công',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Lấy chi tiết nhà nấm thất bại',
      });
    }
  };

  updateHouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, message: 'Thiếu mã nhà nấm (id)' });
        return;
      }
      // 1. Validate dữ liệu body gửi lên bằng Zod
      const updateData = UpdateHouseSchema.parse(req.body);

      // 2. Gọi service cập nhật
      const result = await this.houseService.updateHouse(id as string, req.user.id, updateData);
      res.status(200).json({
        success: true,
        message: 'Cập nhật nhà nấm thành công',
        data: result,
      });
    } catch (error: any) {
      // Xử lý lỗi validate dữ liệu đầu vào của Zod
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dữ liệu cập nhật không hợp lệ',
          errors: error.issues.map((err) => ({
            field: String(err.path[0] || ''),
            message: err.message,
          })),
        });
        return;
      }

      // Xử lý lỗi hệ thống hoặc không tìm thấy nhà nấm
      res.status(400).json({
        success: false,
        message: error.message || 'Cập nhật nhà nấm thất bại',
      });
    }
  };
}