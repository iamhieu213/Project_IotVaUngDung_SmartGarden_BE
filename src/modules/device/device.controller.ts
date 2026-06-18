import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { DeviceService } from './device.service';
import { CreateDeviceSchema, UpdateSensorPositionSchema, AssignPresetSchema } from './device.dto';
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

  // Xóa hoàn toàn cấu hình cảm biến khỏi thiết bị
  deleteSensorPosition = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id, sensorKey } = req.params;

      if (!id || !sensorKey) {
        res.status(400).json({ success: false, message: 'Thiếu mã thiết bị hoặc loại cảm biến' });
        return;
      }

      const result = await this.deviceService.deleteSensorPosition(
        id as string,
        String(sensorKey),
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Xóa cảm biến khỏi thiết bị thành công',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Xóa cảm biến thất bại',
      });
    }
  };

  // 1. Lấy lịch sử dữ liệu môi trường nhà nấm
  getTelemetryHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const houseId = req.params.houseId as string;
      const range = typeof req.query.range === 'string' ? req.query.range : '24h'; // Mặc định là 24h nếu không truyền
      if (!houseId) {
        res.status(400).json({ success: false, message: 'Thiếu mã nhà nấm (houseId)' });
        return;
      }
      // Gọi service xử lý MongoDB Aggregation
      const historyData = await this.deviceService.getTelemetryHistory(houseId, range, req.user.id);
      res.status(200).json({
        success: true,
        message: 'Lấy lịch sử dữ liệu môi trường thành công',
        data: historyData,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Lấy lịch sử thất bại',
      });
    }
  };
  // 2. So sánh chỉ số trung bình hiện tại giữa các nhà nấm của tài khoản sở hữu
  getHousesComparison = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      // Lấy báo cáo so sánh độ ẩm/nhiệt độ trung bình giữa các nhà nấm trong 7 ngày qua
      const comparisonData = await this.deviceService.getHousesComparison(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Lấy dữ liệu so sánh nhà nấm thành công',
        data: comparisonData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Lấy dữ liệu so sánh thất bại',
      });
    }
  };

  controlDevice = async (req: any, res: any): Promise<void> => {
    try {
      const deviceId = req.params.id; // Lấy ID thiết bị từ URL
      const { type, action } = req.body; // Lấy từ Body: { type: "pump", action: "on"/"off" }
      const ownerId = req.user?.id; // Lấy ID người dùng từ token đăng nhập (authMiddleware)

      if (!ownerId) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }

      if (!type || !action) {
        res.status(400).json({ success: false, message: 'Thiếu thông số type hoặc action cần điều khiển.' });
        return;
      }
      const response = await this.deviceService.controlDevice(deviceId, type, action, ownerId);
      res.status(200).json({
        success: true,
        message: 'Gửi lệnh điều khiển thiết bị thành công',
        data: response
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  assignPreset = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
        return;
      }
      const { id } = req.params;
      const { presetId } = AssignPresetSchema.parse(req.body);

      const result = await this.deviceService.assignPreset(id as string, presetId || null, req.user.id);
      res.status(200).json({
        success: true,
        message: 'Gán cấu hình preset cho thiết bị thành công',
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
        message: error.message || 'Gán cấu hình preset thất bại',
      });
    }
  };
}