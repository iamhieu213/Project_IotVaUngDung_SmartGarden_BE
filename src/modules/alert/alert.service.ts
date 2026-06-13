import Alert, { IAlert } from '../../models/Alert';
import { io } from '../../server';
import { AlertResponse } from './alert.dto';

export class AlertService {
  private mapToAlertResponse(alert: IAlert): AlertResponse {
    return {
      id: (alert._id as any).toString(),
      houseId: alert.house.toString(),
      deviceId: alert.deviceId,
      deviceName: alert.deviceName,
      title: alert.title,
      message: alert.message,
      type: alert.type,
      resolved: alert.resolved,
      createdAt: alert.createdAt,
    };
  }

  // Hàm tạo cảnh báo và phát Socket.io thời gian thực
  async createAndEmitAlert(
    houseId: string,
    deviceId: string,
    deviceName: string,
    title: string,
    message: string,
    type: 'critical' | 'warning'
  ): Promise<AlertResponse> {
    const newAlert = new Alert({
      house: houseId,
      deviceId,
      deviceName,
      title,
      message,
      type,
    });
    const savedAlert = await newAlert.save();

    // Phát sự kiện về Frontend
    io.emit('new_alert', this.mapToAlertResponse(savedAlert));

    return this.mapToAlertResponse(savedAlert);
  }

  // Hàm tự động quét và đóng các cảnh báo cũ khi chỉ số đã về dải an toàn
  async resolveActiveAlerts(
    houseId: string,
    deviceId: string,
    alertTitleKeyword: string,
    recoveryMessage: string
  ): Promise<void> {
    try {
      // 1. Tìm các cảnh báo chưa xử lý (resolved: false) của thiết bị này có tiêu đề chứa từ khóa
      const activeAlert = await Alert.findOne({
        house: houseId,
        deviceId,
        resolved: false,
        title: new RegExp(alertTitleKeyword, 'i')
      });

      // 2. Nếu tìm thấy, đánh dấu là đã giải quyết
      if (activeAlert) {
        activeAlert.resolved = true;
        await activeAlert.save();

        // 3. Bắn Socket.io báo cho Frontend biết cảnh báo này đã được giải quyết
        io.emit('alert_resolved', {
          id: activeAlert._id,
          houseId,
          deviceId,
          message: recoveryMessage,
        });

        console.log(`[Khôi phục] Đã tự động đóng cảnh báo: "${activeAlert.title}" cho mạch ${deviceId}`);
      }
    } catch (err) {
      console.error('Lỗi khi tự động giải quyết cảnh báo:', err);
    }
  }

  // Hàm chuyên trách kiểm tra các ngưỡng đo đạc môi trường
  async checkTelemetryThresholds(
    houseId: string,
    deviceId: string,
    deviceName: string,
    telemetry: { temperature: number; humidity: number; soilMoisture: number }
  ): Promise<void> {
    const { temperature, humidity, soilMoisture } = telemetry;

    // 1. Kiểm tra nhiệt độ (15°C - 32°C)
    if (temperature > 32) {
      await this.createAndEmitAlert(
        houseId,
        deviceId,
        deviceName,
        'Nhiệt độ quá cao',
        `Nhiệt độ đo được là ${temperature}°C, vượt ngưỡng an toàn (32°C) tại mạch "${deviceName}".`,
        'warning'
      );
    } else if (temperature < 15) {
      await this.createAndEmitAlert(
        houseId,
        deviceId,
        deviceName,
        'Nhiệt độ quá thấp',
        `Nhiệt độ hạ xuống ${temperature}°C, thấp hơn ngưỡng tối thiểu (15°C) tại mạch "${deviceName}".`,
        'warning'
      );
    } else {
      // Nằm trong dải an toàn: Tự động khôi phục các cảnh báo nhiệt độ cũ
      await this.resolveActiveAlerts(
        houseId,
        deviceId,
        'Nhiệt độ',
        `Nhiệt độ tại mạch "${deviceName}" đã trở lại ngưỡng an toàn: ${temperature}°C.`
      );
    }

    // 2. Kiểm tra độ ẩm không khí (70% - 98%)
    if (humidity < 70) {
      await this.createAndEmitAlert(
        houseId,
        deviceId,
        deviceName,
        'Độ ẩm không khí thấp',
        `Độ ẩm không khí giảm còn ${humidity}%, phôi nấm có nguy cơ bị héo khô!`,
        'critical'
      );
    } else if (humidity > 98) {
      await this.createAndEmitAlert(
        houseId,
        deviceId,
        deviceName,
        'Độ ẩm không khí quá cao',
        `Độ ẩm không khí bão hòa ${humidity}%, cần mở quạt thông gió tránh úng nước gốc nấm.`,
        'warning'
      );
    } else {
      // Nằm trong dải an toàn: Tự động khôi phục cảnh báo độ ẩm không khí
      await this.resolveActiveAlerts(
        houseId,
        deviceId,
        'Độ ẩm không khí',
        `Độ ẩm không khí tại mạch "${deviceName}" đã trở lại ngưỡng an toàn: ${humidity}%.`
      );
    }

    // 3. Kiểm tra độ ẩm đất/giá thể (>= 50%)
    if (soilMoisture < 50) {
      await this.createAndEmitAlert(
        houseId,
        deviceId,
        deviceName,
        'Độ ẩm giá thể khô',
        `Độ ẩm đất/giá thể đang ở mức thấp ${soilMoisture}%. Hãy bật hệ thống tưới.`,
        'warning'
      );
    } else {
      // Nằm trong dải an toàn: Tự động khôi phục cảnh báo độ ẩm đất
      await this.resolveActiveAlerts(
        houseId,
        deviceId,
        'Độ ẩm giá thể',
        `Độ ẩm đất/giá thể tại mạch "${deviceName}" đã trở lại ngưỡng an toàn: ${soilMoisture}%.`
      );
    }
  }

  // Lấy lịch sử cảnh báo của một nhà nấm
  async getAlertsByHouse(houseId: string): Promise<AlertResponse[]> {
    const alerts = await Alert.find({ house: houseId }).sort({ createdAt: -1 });
    return alerts.map(this.mapToAlertResponse);
  }

  // Đánh dấu cảnh báo đã giải quyết
  async resolveAlert(alertId: string): Promise<AlertResponse | null> {
    const alert = await Alert.findByIdAndUpdate(
      alertId,
      { resolved: true },
      { new: true }
    );
    if (!alert) return null;
    return this.mapToAlertResponse(alert);
  }
}
