import { mqttService } from '../../mqtt/mqtt.service';
import Device, { IDevice } from '../../models/Device';
import Preset from '../../models/Preset';
import { io } from '../../server';
import { DeviceService } from './device.service';

export class PumpService {
  private deviceService = new DeviceService();

  async evaluateAndControl(device: IDevice, readings: Map<string, number>): Promise<void> {
    if (!device.activePreset) return;

    try {
      const preset = await Preset.findById(device.activePreset);
      if (!preset) return;

      const soilMoisture = readings.get('soilMoisture1');
      if (soilMoisture === undefined) {
        console.warn(`[Pump Service] Không tìm thấy dữ liệu độ ẩm đất "soilMoisture1" trên thiết bị ${device.deviceId}`);
        return;
      }

      const topic = `smartgarden/devices/${device.deviceId}/control`;
      let newAction: 'on' | 'off' | null = null;

      if (soilMoisture < preset.soilMoistureMin) {
        if (device.pumpState !== 'on') {
          newAction = 'on';
        }
      } else if (soilMoisture >= preset.soilMoistureMax) {
        if (device.pumpState !== 'off') {
          newAction = 'off';
        }
      }

      if (newAction) {
        const mqttVal = newAction === 'on' ? 1 : 0;
        const payload = JSON.stringify({ pump: mqttVal });

        // Gửi lệnh MQTT tới ESP32
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
