import mqtt from 'mqtt';
import axios from 'axios';
import Device from '../models/Device';
import SensorData from '../models/SensorData';
import redisClient from '../configs/redis';
import { io } from '../server';
import { DeviceService } from '../modules/device/device.service';
import Alert from '../models/Alert'

export class MqttService {
  private client: mqtt.MqttClient | null = null;
  private brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  private thingsboardHost = process.env.THINGSBOARD_HOST || 'http://localhost:8080';
  private deviceService = new DeviceService(); // Khởi tạo service để dùng chung hàm map dữ liệu chuẩn

  private async createAndEmitAlert(
    houseId: string,
    deviceId: string,
    deviceName: string,
    title: string,
    message: string,
    type: 'critical' | 'warning'
  ): Promise<void> {
    try {
      // 1. Lưu cảnh báo vào Database
      const newAlert = new Alert({
        house: houseId,
        deviceId,
        deviceName,
        title,
        message,
        type,
      });
      const savedAlert = await newAlert.save();
      // 2. Phát thông báo thời gian thực về Frontend qua Socket.io
      io.emit('new_alert', {
        id: savedAlert._id,
        houseId,
        deviceId,
        deviceName,
        title,
        message,
        type,
        createdAt: savedAlert.createdAt
      });
      console.log(`[Cảnh báo] Đã lưu & phát cảnh báo: "${title}" cho mạch "${deviceName}" (${deviceId})`);
    } catch (err) {
      console.error('[Cảnh báo Error] Không thể tạo và phát cảnh báo:', err);
    }
  }

  connect(): void {
    console.log(`[MQTT] Đang kết nối tới Broker tại: ${this.brokerUrl}...`);

    const options = {
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || ''
    };

    this.client = mqtt.connect(this.brokerUrl, options);

    this.client.on('connect', () => {
      console.log('--- [MQTT] Backend đã kết nối thành công tới Mosquitto Broker! ---');

      // 1. Đăng ký lắng nghe dữ liệu đo cảm biến (5 phút/lần)
      this.client?.subscribe('smartgarden/devices/+/data', (err) => {
        if (!err) {
          console.log('[MQTT] Đăng ký topic dữ liệu thành công: smartgarden/devices/+/data');
        }
      });

      // 2. Đăng ký lắng nghe trạng thái hoạt động trực tuyến/ngoại tuyến (LWT & Connect)
      this.client?.subscribe('smartgarden/devices/+/status', (err) => {
        if (!err) {
          console.log('[MQTT] Đăng ký topic trạng thái thành công: smartgarden/devices/+/status');
        }
      });
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Lỗi kết nối:', err);
    });

    this.client.on('message', async (topic, message) => {
      try {
        const topicParts = topic.split('/');
        const deviceId = topicParts[2]; // Lấy MAC/deviceId từ topic
        const messageType = topicParts[3]; // 'data' hoặc 'status'

        if (!deviceId) return;

        // ==========================================
        // TRƯỜNG HỢP 1: TIN NHẮN TRẠNG THÁI (LWT / CONNECT)
        // ==========================================
        if (messageType === 'status') {
          const statusVal = message.toString(); // "online" hoặc "offline"
          console.log(`[MQTT Trạng thái] Thiết bị ${deviceId} báo trạng thái: ${statusVal}`);

          // Tìm thiết bị trong MongoDB
          const device = await Device.findOne({ deviceId });
          if (device) {
            // Cập nhật trạng thái
            device.status = statusVal as 'online' | 'offline';
            if (statusVal === 'online') {
              device.lastSeen = new Date();
            }
            const savedDevice = await device.save();

            // Ánh xạ dữ liệu đầy đủ (gồm cả tọa độ sensorPositions) để gửi qua WebSockets
            const deviceResponse = await this.deviceService.mapToDeviceResponse(savedDevice);
            io.emit('device_update', deviceResponse);

            console.log(`[MQTT Trạng thái] Đã cập nhật trạng thái ${statusVal} và đồng bộ Socket.io cho ${deviceId}.`);

            //Phat canh bao neu thiet bi bi mat ket noi
            if (statusVal === 'offline' && device) {
              // 1. Lấy tên nhà nấm và ID nhà nấm từ quan hệ đã populate
              const houseName = (device.house as any).name || 'Chưa xác định';
              const houseId = (device.house as any)._id.toString();
              await this.createAndEmitAlert(
                houseId, // Truyền ID nhà nấm
                deviceId,
                device.name,
                'Mạch điều khiển Offline',
                `Thiết bị "${device.name}" (ID: ${deviceId}) thuộc nhà nấm "${houseName}" đã bị mất kết nối với hệ thống.`,
                'critical'
              );
            }
          }
          return;
        }

        // ==========================================
        // TRƯỜNG HỢP 2: TIN NHẮN DỮ LIỆU TELEMETRY (5 PHÚT/LẦN)
        // ==========================================
        if (messageType === 'data') {
          const payload = JSON.parse(message.toString());
          const { temperature, humidity, soilMoisture, lightLevel } = payload;

          console.log(`[MQTT Dữ liệu] Nhận dữ liệu từ ${deviceId}: Nhệt độ: ${temperature}°C, Độ ẩm: ${humidity}%, Độ ẩm đất: ${soilMoisture}, Ánh sáng: ${lightLevel} lx`);

          // 1. Kiểm tra thiết bị trong MongoDB
          const device = await Device.findOne({ deviceId });

          if (!device) {
            // AUTO-DISCOVERY: Thiết bị chưa đăng ký -> Lưu vào Redis hàng chờ trong 5 phút
            await redisClient.set(`unregistered_device:${deviceId}`, new Date().toISOString(), { EX: 300 });
            console.log(`[MQTT Auto-Discovery] Phát hiện thiết bị mới: ${deviceId}. Đã đưa vào hàng chờ.`);
            return;
          }

          // 2. Lưu dữ liệu cảm biến vào MongoDB
          const newSensorData = new SensorData({
            device: device._id,
            temperature: temperature || 0,
            humidity: humidity || 0,
            soilMoisture: soilMoisture || 0,
            lightIntensity: lightLevel || 0,
          });
          await newSensorData.save();
          console.log(`[MQTT Cục Bộ] Đã lưu dữ liệu đo cho ${deviceId} vào MongoDB.`);

          // 3. Cập nhật lastSeen và status online (đề phòng trường hợp LWT bị miss gói tin online)
          device.status = 'online';
          device.lastSeen = new Date();
          const savedDevice = await device.save();

          // Ánh xạ dữ liệu đầy đủ để gửi Socket.io về Frontend
          const deviceResponse = await this.deviceService.mapToDeviceResponse(savedDevice);
          io.emit('device_update', deviceResponse);

          // 4. CHUYỂN TIẾP LÊN THINGSBOARD CLOUD
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
        }
      } catch (err: any) {
        console.error('[MQTT Error] Lỗi xử lý tin nhắn:', err.message);
      }
    });
  }
}
