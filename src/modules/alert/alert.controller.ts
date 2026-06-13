import { Request, Response } from 'express';
import { AlertService } from './alert.service';

export class AlertController {
  private alertService = new AlertService();

  // Lấy danh sách cảnh báo của nhà nấm
  getAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { houseId } = req.params;
      if (!houseId) {
        res.status(400).json({ success: false, message: 'Thiếu mã nhà nấm (houseId)' });
        return;
      }
      const result = await this.alertService.getAlertsByHouse(houseId as string);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Lỗi lấy lịch sử cảnh báo' });
    }
  };

  // Đánh dấu giải quyết cảnh báo
  resolveAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, message: 'Thiếu mã cảnh báo (id)' });
        return;
      }
      const result = await this.alertService.resolveAlert(id as string);
      if (!result) {
        res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
        return;
      }
      res.status(200).json({ success: true, message: 'Đã xử lý cảnh báo thành công', data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Lỗi xử lý cảnh báo' });
    }
  };
}
