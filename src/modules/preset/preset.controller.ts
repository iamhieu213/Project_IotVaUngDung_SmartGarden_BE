import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { PresetService } from './preset.service';
import { CreatePresetSchema, UpdatePresetSchema } from './preset.dto';
import { z } from 'zod';

export class PresetController {
  private presetService: PresetService;

  constructor() {
    this.presetService = new PresetService();
  }

  createPreset = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }

      const presetData = CreatePresetSchema.parse(req.body);
      const result = await this.presetService.createPreset(presetData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Tạo cấu hình preset thành công',
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
      res.status(400).json({
        success: false,
        message: error.message || 'Tạo cấu hình preset thất bại',
      });
    }
  };

  getPresets = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const result = await this.presetService.getPresetsByOwner(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách cấu hình thành công',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách cấu hình thất bại',
      });
    }
  };

  getPresetById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      const result = await this.presetService.getPresetById(id as string, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Lấy chi tiết cấu hình thành công',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Lấy chi tiết cấu hình thất bại',
      });
    }
  };

  updatePreset = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      const presetData = UpdatePresetSchema.parse(req.body);
      const result = await this.presetService.updatePreset(id as string, presetData, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Cập nhật cấu hình thành công',
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
      res.status(400).json({
        success: false,
        message: error.message || 'Cập nhật cấu hình thất bại',
      });
    }
  };

  deletePreset = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      await this.presetService.deletePreset(id as string, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Xóa cấu hình thành công và đã hủy kích hoạt trên các thiết bị liên quan',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Xóa cấu hình thất bại',
      });
    }
  };
}
