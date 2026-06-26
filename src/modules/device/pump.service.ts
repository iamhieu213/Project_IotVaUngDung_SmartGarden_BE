import { mqttService } from '../../mqtt/mqtt.service';
import Device, { IDevice } from '../../models/Device';
import Preset from '../../models/Preset';
import { io } from '../../server';
import { DeviceService } from './device.service';

export class PumpService {
  private deviceService = new DeviceService();

  async evaluateAndControl(device: IDevice, readings: Map<string, number>): Promise<void> {
    console.log(`\n[Pump Service] Bắt đầu kiểm tra tự động bơm cho thiết bị ${device.deviceId}...`);
    
    if (!device.activePreset) {
      console.log(`[Pump Service] Thiết bị ${device.deviceId} chưa cấu hình Preset (tự động tưới). Bỏ qua.`);
      return;
    }

    try {
      const preset = await Preset.findById(device.activePreset);
      if (!preset) {
        console.log(`[Pump Service] Không tìm thấy Preset ID: ${device.activePreset} trong cơ sở dữ liệu.`);
        return;
      }

      const soilMoisture = readings.get('soilMoisture1');
      if (soilMoisture === undefined) {
        console.warn(`[Pump Service] Thiết bị ${device.deviceId} không gửi dữ liệu độ ẩm đất "soilMoisture1"`);
        return;
      }

      console.log(`[Pump Service] Thiết bị: ${device.deviceId} | Độ ẩm đất hiện tại: ${soilMoisture}% (Ngưỡng bật: <${preset.soilMoistureMin}%, Ngưỡng tắt: >=${preset.soilMoistureMax}%) | Trạng thái bơm hiện tại: ${device.pumpState}`);

      const topic = `smartgarden/devices/${device.deviceId}/control`;
      let newAction: 'on' | 'off' | null = null;

      // Logic bảo vệ máy bơm: Nếu phát hiện cạn nước (waterLevel1 < 5mm), ép trạng thái tắt bơm và không cho phép bật tự động
      const waterLevel = readings.get('waterLevel1');
      const bypassWaterCheck = true; // Đặt thành true để tạm thời test tự động tưới không cần cảm biến nước
      if (!bypassWaterCheck && waterLevel !== undefined && waterLevel < 5) {
        console.log(`[Pump Service] CẢNH BÁO: Mực nước bể (${waterLevel}mm) < 5mm (cạn nước). Không tự động bật bơm để bảo vệ thiết bị.`);
        if (device.pumpState !== 'off') {
          newAction = 'off';
        }
      } else if (soilMoisture < preset.soilMoistureMin) {
        if (device.pumpState !== 'on') {
          newAction = 'on';
        } else {
          console.log(`[Pump Service] Độ ẩm đất (${soilMoisture}%) < Ngưỡng tối thiểu (${preset.soilMoistureMin}%) nhưng bơm đã BẬT từ trước. Không gửi lệnh.`);
        }
      } else if (soilMoisture >= preset.soilMoistureMax) {
        if (device.pumpState !== 'off') {
          newAction = 'off';
        } else {
          console.log(`[Pump Service] Độ ẩm đất (${soilMoisture}%) >= Ngưỡng tối đa (${preset.soilMoistureMax}%) và bơm đã TẮT từ trước. Không gửi lệnh.`);
        }
      } else {
        console.log(`[Pump Service] Độ ẩm đất (${soilMoisture}%) nằm trong khoảng an toàn (${preset.soilMoistureMin}% - ${preset.soilMoistureMax}%). Không cần điều chỉnh.`);
      }

      if (newAction) {
        const mqttVal = newAction === 'on' ? 1 : 0;
        const payload = JSON.stringify({ pump: mqttVal });

        // Gửi lệnh MQTT tới ESP32
        console.log(`[Pump Service] Gửi lệnh tự động tưới -> Topic: ${topic} | Payload: ${payload}`);
        mqttService.publish(topic, payload);

        // Cập nhật trạng thái máy bơm
        device.pumpState = newAction;
        const savedDevice = await device.save();

        // Đồng bộ socket về UI frontend
        const response = await this.deviceService.mapToDeviceResponse(savedDevice);
        io.emit('device_update', response);

        console.log(`[Pump Service] Tự động điều chỉnh thiết bị ${device.deviceId} -> BƠM ${newAction.toUpperCase()} (Độ ẩm đất hiện tại: ${soilMoisture}%, Ngưỡng Preset: ${preset.soilMoistureMin}% - ${preset.soilMoistureMax}%)`);
      }
    } catch (err: any) {
      console.error(`[Pump Service Error] Lỗi tự động kiểm tra bơm trên ${device.deviceId}:`, err.message);
    }
  }
}

export const pumpService = new PumpService();
