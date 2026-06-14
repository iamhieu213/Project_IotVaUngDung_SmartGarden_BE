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
    // Tránh trùng lặp cảnh báo đang kích hoạt (chưa được resolve)
    const existingAlert = await Alert.findOne({
      house: houseId,
      deviceId,
      title,
      resolved: false
    });
    if (existingAlert) {
      return this.mapToAlertResponse(existingAlert);
    }

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

  // Hàm chuyên trách kiểm tra các ngưỡng đo đạc môi trường (Hỗ trợ nhiều cảm biến động)
  async checkTelemetryThresholds(
    houseId: string,
    deviceId: string,
    deviceName: string,
    readings: Map<string, number> | Record<string, number>
  ): Promise<void> {
    const readingsMap = readings instanceof Map ? readings : new Map(Object.entries(readings));

    // 1. Kiểm tra Nhiệt độ (quét mọi cảm biến bắt đầu bằng 'temperature')
    let maxTemp = -999;
    let minTemp = 999;
    let hasTemp = false;

    readingsMap.forEach((val, key) => {
      if (key.startsWith('temperature') && typeof val === 'number') {
        hasTemp = true;
        if (val > maxTemp) maxTemp = val;
        if (val < minTemp) minTemp = val;
      }
    });

    if (hasTemp) {
      if (maxTemp > 32) {
        await this.createAndEmitAlert(
          houseId,
          deviceId,
          deviceName,
          'Nhiệt độ quá cao',
          `Nhiệt độ đo được là ${maxTemp}°C, vượt ngưỡng an toàn (32°C) tại mạch "${deviceName}".`,
          'warning'
        );
      } else if (minTemp < 15) {
        await this.createAndEmitAlert(
          houseId,
          deviceId,
          deviceName,
          'Nhiệt độ quá thấp',
          `Nhiệt độ hạ xuống ${minTemp}°C, thấp hơn ngưỡng tối thiểu (15°C) tại mạch "${deviceName}".`,
          'warning'
        );
      } else {
        // Nằm trong dải an toàn: Tự động khôi phục các cảnh báo nhiệt độ cũ
        await this.resolveActiveAlerts(
          houseId,
          deviceId,
          'Nhiệt độ',
          `Nhiệt độ tại mạch "${deviceName}" đã trở lại ngưỡng an toàn: ${maxTemp}°C.`
        );
      }
    }

    // 2. Kiểm tra Độ ẩm không khí (quét mọi cảm biến bắt đầu bằng 'humidity')
    let maxHum = -999;
    let minHum = 999;
    let hasHum = false;

    readingsMap.forEach((val, key) => {
      if (key.startsWith('humidity') && typeof val === 'number') {
        hasHum = true;
        if (val > maxHum) maxHum = val;
        if (val < minHum) minHum = val;
      }
    });

    if (hasHum) {
      if (minHum < 70) {
        await this.createAndEmitAlert(
          houseId,
          deviceId,
          deviceName,
          'Độ ẩm không khí thấp',
          `Độ ẩm không khí giảm còn ${minHum}%, phôi nấm có nguy cơ bị héo khô!`,
          'critical'
        );
      } else if (maxHum > 98) {
        await this.createAndEmitAlert(
          houseId,
          deviceId,
          deviceName,
          'Độ ẩm không khí quá cao',
          `Độ ẩm không khí bão hòa ${maxHum}%, cần mở quạt thông gió tránh úng nước gốc nấm.`,
          'warning'
        );
      } else {
        // Nằm trong dải an toàn: Tự động khôi phục cảnh báo độ ẩm không khí
        await this.resolveActiveAlerts(
          houseId,
          deviceId,
          'Độ ẩm không khí',
          `Độ ẩm không khí tại mạch "${deviceName}" đã trở lại ngưỡng an toàn: ${minHum}%.`
        );
      }
    }

    // 3. Kiểm tra Độ ẩm đất (quét mọi cảm biến bắt đầu bằng 'soilMoisture')
    let minSoil = 999;
    let hasSoil = false;

    readingsMap.forEach((val, key) => {
      if (key.startsWith('soilMoisture') && typeof val === 'number') {
        hasSoil = true;
        if (val < minSoil) minSoil = val;
      }
    });

    if (hasSoil) {
      if (minSoil < 50) {
        await this.createAndEmitAlert(
          houseId,
          deviceId,
          deviceName,
          'Độ ẩm giá thể khô',
          `Độ ẩm đất/giá thể đang ở mức thấp ${minSoil}%. Hãy bật hệ thống tưới.`,
          'warning'
        );
      } else {
        // Nằm trong dải an toàn: Tự động khôi phục cảnh báo độ ẩm đất
        await this.resolveActiveAlerts(
          houseId,
          deviceId,
          'Độ ẩm giá thể',
          `Độ ẩm đất/giá thể tại mạch "${deviceName}" đã trở lại ngưỡng an toàn: ${minSoil}%.`
        );
      }
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
