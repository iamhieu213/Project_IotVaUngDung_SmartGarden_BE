import Device, { IDevice } from '../../models/Device'
import House from '../../models/House'
import redisClient from '../../configs/redis'
import SensorData from '../../models/SensorData'
import { CreateDeviceDto, DeviceResponse } from './device.dto'

export class DeviceService {
    private async mapToDeviceResponse(device: IDevice): Promise<DeviceResponse> {
        // Đọc token từ Redis ra để trả về cho Client
        const tbToken = await redisClient.get(`tb_token:${device.deviceId}`) || undefined;
        // Lấy dữ liệu cảm biến mới nhất
        const latestData = await SensorData.findOne({ device: device._id }).sort({ createdAt: -1 });

        return {
            id: (device._id as any).toString(),
            deviceId: device.deviceId,
            name: device.name,
            status: device.status,
            house: device.house.toString(),
            lastSeen: device.lastSeen,
            thingsboardAccessToken: tbToken,
            createdAt: (device as any).createdAt,
            latestTelemetry: latestData ? {
                temperature: latestData.temperature,
                humidity: latestData.humidity,
                soilMoisture: latestData.soilMoisture,
                lightIntensity: latestData.lightIntensity,
                createdAt: latestData.createdAt,
            } : null,
        };
    }

    async createDevice(dto: CreateDeviceDto, ownerId: string) {
        const house = await House.findOne({ _id: dto.houseId, owner: ownerId });

        if (!house) {
            throw new Error('Nhà nấm không tồn tại hoặc bạn không có quyền sở hữu');
        }

        //Kiem tra xem deviceId nay da duoc su dung chua
        const deviceExists = await Device.findOne({ deviceId: dto.deviceId });
        if (deviceExists) {
            throw new Error('Thiết bị (deviceId) này đã được đăng ký trên hệ thống');
        }

        //3.Luu thong tin thiet bi moi vao db
        const device = new Device({
            deviceId: dto.deviceId,
            name: dto.name,
            house: dto.houseId,
            status: 'offline',
        });

        const savedDevice = await device.save();

        // 4. Lưu Token Thingsboard vào Redis (nếu có)
        if (dto.thingsboardAccessToken) {
            await redisClient.set(`tb_token:${dto.deviceId}`, dto.thingsboardAccessToken);
        }

        // 5. Xóa thiết bị khỏi danh sách chờ trong Redis sau khi đã đăng ký thành công
        await redisClient.del(`unregistered_device:${dto.deviceId}`);
        return this.mapToDeviceResponse(savedDevice);
    }

    async getDevicesByHouse(houseId: string, ownerId: string): Promise<DeviceResponse[]> {
        const house = await House.findOne({ _id: houseId, owner: ownerId });

        if (!house) {
            throw new Error('Nhà nấm không tồn tại hoặc bạn không có quyền truy cập');
        }

        const devices = await Device.find({ house: houseId });

        return Promise.all(devices.map((d) => this.mapToDeviceResponse(d)));
    }

    // API Đọc danh sách thiết bị đang phát sóng mà chưa đăng ký
    async getUnregisteredDevices(): Promise<string[]> {
        // Quét toàn bộ key có dạng unregistered_device:* trong Redis
        const keys = await redisClient.keys('unregistered_device:*');

        // Trích xuất lấy deviceId
        return keys.map((key) => key.replace('unregistered_device:', ''));
    }
}