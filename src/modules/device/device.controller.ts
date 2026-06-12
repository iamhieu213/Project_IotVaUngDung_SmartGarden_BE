import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { DeviceService } from './device.service';
import { CreateDeviceSchema, UpdateSensorPositionSchema } from './device.dto';
import { z } from 'zod';

export class DeviceController {
  private deviceService: DeviceService;

  constructor() {
    this.deviceService = new DeviceService();
  }

  createDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const deviceData = CreateDeviceSchema.parse(req.body);
      const result = await this.deviceService.createDevice(deviceData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Gắn thiết bị vào nhà nấm thành công',
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
        message: error.message || 'Thêm thiết bị thất bại',
      });
    }
  };

  getDevicesByHouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { houseId } = req.params;
      if (!houseId) {
        res.status(400).json({ success: false, message: 'Thiếu mã nhà nấm (houseId)' });
        return;
      }
      const result = await this.deviceService.getDevicesByHouse(houseId as string, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách thiết bị thành công',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Lấy danh sách thiết bị thất bại',
      });
    }
  };

  // Lấy danh sách thiết bị chưa đăng ký để đưa vào dropdown ở Frontend
  getUnregisteredDevices = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deviceService.getUnregisteredDevices();
      res.status(200).json({
        success: true,
        message: 'Lấy danh sách thiết bị chưa đăng ký thành công',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách thiết bị chưa đăng ký thất bại',
      });
    }
  };

  // Xóa thiết bị khỏi nhà nấm
  deleteDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, message: 'Thiếu mã thiết bị (id)' });
        return;
      }
      await this.deviceService.deleteDevice(id as string, req.user.id);
      res.status(200).json({
        success: true,
        message: 'Xóa thiết bị thành công',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Xóa thiết bị thất bại',
      });
    }
  };

  // Cập nhật vị trí cảm biến thành phần
  updateSensorPosition = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      const { sensorType, spaceX, spaceY, displayName } = req.body;

      if (!sensorType || spaceX === undefined || spaceY === undefined) {
        res.status(400).json({ success: false, message: 'Thiếu thông tin sensorType, spaceX hoặc spaceY' });
        return;
      }

      // Kiểm tra tính hợp lệ của tọa độ qua Zod Schema
      UpdateSensorPositionSchema.parse({ 
        sensorType, 
        spaceX: Number(spaceX), 
        spaceY: Number(spaceY), 
        displayName: displayName !== undefined ? String(displayName) : undefined 
      });

      const result = await this.deviceService.updateSensorPosition(
        id as string,
        String(sensorType),
        Number(spaceX),
        Number(spaceY),
        displayName !== undefined ? String(displayName) : undefined,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Cập nhật vị trí cảm biến thành công',
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Tọa độ hoặc thông tin cảm biến không hợp lệ',
          errors: error.issues.map((err) => ({
            field: String(err.path[0] || ''),
            message: err.message,
          })),
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Cập nhật vị trí cảm biến thất bại',
      });
    }
  };
}