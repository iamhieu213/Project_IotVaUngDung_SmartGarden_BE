import mqtt from 'mqtt';
import axios from 'axios';
import Device from '../models/Device';
import SensorData from '../models/SensorData';
import redisClient from '../configs/redis';
import { io } from '../server'
export class MqttService {
  private client: mqtt.MqttClient | null = null;
  private brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  private thingsboardHost = process.env.THINGSBOARD_HOST || 'http://localhost:8080';

  connect(): void {
    console.log(`[MQTT] Đang kết nối tới Broker tại: ${this.brokerUrl}...`);

    const options = {
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || ''
    };

    this.client = mqtt.connect(this.brokerUrl, options);

    this.client.on('connect', () => {
      console.log('--- [MQTT] Backend đã kết nối thành công tới Mosquitto Broker! ---');
      
      // Đăng ký lắng nghe dữ liệu từ các thiết bị
      this.client?.subscribe('smartgarden/devices/+/data', (err) => {
        if (!err) {
          console.log('[MQTT] Đăng ký topic thành công: smartgarden/devices/+/data');
        }
      });
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Lỗi kết nối:', err);
    });

    this.client.on('message', async (topic, message) => {
      try {
        const topicParts = topic.split('/');
        const deviceId = topicParts[2]; // Lấy deviceId từ topic

        if (!deviceId) return;

        const payload = JSON.parse(message.toString());
        const { temperature, humidity, soilMoisture, lightLevel } = payload;

        console.log(`[MQTT] Nhận dữ liệu từ ${deviceId}: Nhiệt độ: ${temperature}°C, Độ ẩm: ${humidity}%, Độ ẩm đất: ${soilMoisture}, Ánh sáng: ${lightLevel} lx`);

        // 1. Kiểm tra thiết bị trong MongoDB
        const device = await Device.findOne({ deviceId });
        
        if (!device) {
          // AUTO-DISCOVERY: Thiết bị chưa đăng ký -> Lưu vào Redis trong 5 phút
          await redisClient.set(`unregistered_device:${deviceId}`, new Date().toISOString(), { EX: 300 });
          console.log(`[MQTT Auto-Discovery] Phát hiện thiết bị mới: ${deviceId}. Đã đưa vào hàng chờ.`);
          return;
        }

        // 2. Thiết bị đã đăng ký -> Lưu dữ liệu cảm biến vào MongoDB
        const newSensorData = new SensorData({
          device: device._id,
          temperature: temperature || 0,
          humidity: humidity || 0,
          soilMoisture: soilMoisture || 0,
          lightIntensity: lightLevel || 0, // ánh xạ biến
        });
        await newSensorData.save();
        console.log(`[MQTT Cục Bộ] Đã lưu dữ liệu cho ${deviceId} vào MongoDB.`);

        // 3. Cập nhật trạng thái online và thời gian phản hồi cuối cho thiết bị
        await Device.findByIdAndUpdate(device._id, {
          status: 'online',
          lastSeen: new Date(),
        });

        io.emit('device_update', {
          id: device._id.toString(),
          deviceId: device.deviceId,
          name: device.name,
          status: 'online',
          house: device.house.toString(),
          lastSeen: new Date(),
          latestTelemetry: {
            temperature: temperature || 0,
            humidity: humidity || 0,
            soilMoisture: soilMoisture || 0,
            lightIntensity: lightLevel || 0, // ánh xạ từ biến lightLevel của MQTT
            createdAt: new Date(),
          }
        });

        // 4. CHUYỂN TIẾP LÊN THINGSBOARD (Nếu có token lưu trong Redis)
        const tbToken = await redisClient.get(`tb_token:${deviceId}`);
        if (tbToken) {
          const tbUrl = `${this.thingsboardHost}/api/v1/${tbToken}/telemetry`;
          await axios.post(tbUrl, {
            temperature: temperature || 0,
            humidity: humidity || 0,
            soilMoisture: soilMoisture || 0,
            lightIntensity: lightLevel || 0
          });
          console.log(`[ThingsBoard] Đã chuyển tiếp thành công dữ liệu của ${deviceId} lên ThingsBoard.`);
        }
      } catch (err: any) {
        console.error('[MQTT Error] Lỗi xử lý dữ liệu:', err.message);
      }
    });
  }
}