import Device, { IDevice } from '../../models/Device'
import House from '../../models/House'
import redisClient from '../../configs/redis'
import SensorData from '../../models/SensorData'
import { CreateDeviceDto, DeviceResponse } from './device.dto'
import axios from 'axios'

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

    private async provisionThingsboardDevice(deviceName: string): Promise<string> {
        const host = process.env.THINGSBOARD_HOST || 'https://thingsboard.cloud';
        const provisionKey = process.env.THINGSBOARD_PROVISION_KEY;
        const provisionSecret = process.env.THINGSBOARD_PROVISION_SECRET;
        if (!provisionKey || !provisionSecret) throw new Error('Chưa cấu hình khóa đăng ký ThingsBoard (THINGSBOARD_PROVISION_KEY và THINGSBOARD_PROVISION_SECRET) trong .env');

        try {
            //gui yeu cau tu dong
            const response = await axios.post(`${host}/api/v1/provision`, {
                deviceName: deviceName,
                provisionDeviceKey: provisionKey,
                provisionDeviceSecret: provisionSecret
            });

            if (response.data.status === 'SUCCESS' && response.data.credentialsValue) {
                return response.data.credentialsValue;
            } else {
                throw new Error(response.data.errorMsg || 'Phản hồi không hợp lệ từ ThingsBoard');
            }
        } catch (error: any) {
            console.error('Lỗi khi đăng ký thiết bị tự động trên ThingsBoard:', error.response?.data || error.message);
            throw new Error('Đăng ký tự động thất bại: ' + (error.response?.data?.message || error.message));
        }

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

        //Kiem tra xem thiet bi co dang nam trong hang cho redis khong
        const isRecentlyActive = await redisClient.exists(`unregistered_device:${dto.deviceId}`);

        //3.Luu thong tin thiet bi moi vao db
        const device = new Device({
            deviceId: dto.deviceId,
            name: dto.name,
            house: dto.houseId,
            status: isRecentlyActive ? 'online' : 'offline',
            lastSeen: isRecentlyActive ? new Date() : undefined,
        });

        const savedDevice = await device.save();

        let tokenToSave = dto.thingsboardAccessToken;

        if (!tokenToSave) {
            try {
                // Sử dụng Tên thiết bị hoặc MAC/Device ID làm tên trên ThingsBoard
                tokenToSave = await this.provisionThingsboardDevice(dto.name);
            } catch (err: any) {
                console.warn('Tự động đăng ký ThingsBoard thất bại, thiết bị sẽ chạy ở chế độ offline trên cloud:', err.message);
            }
        }

        if (tokenToSave) {
            await redisClient.set(`tb_token:${dto.deviceId}`, tokenToSave);
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

        const now = new Date();
        const TIMEOUT_LIMIT = 2 * 60 * 1000;

        for (const device of devices) {
            // Nếu thiết bị đang online nhưng thời gian phản hồi cuối cùng đã quá 2 phút
            if (device.status === 'online' && device.lastSeen) {
                const timeSinceLastSeen = now.getTime() - new Date(device.lastSeen).getTime();

                if (timeSinceLastSeen > TIMEOUT_LIMIT) {
                    device.status = 'offline'; // Chuyển sang offline
                    await device.save(); // Lưu lại vào MongoDB
                }
            }
        }

        return Promise.all(devices.map((d) => this.mapToDeviceResponse(d)));
    }

    // API Đọc danh sách thiết bị đang phát sóng mà chưa đăng ký
    async getUnregisteredDevices(): Promise<string[]> {
        // Quét toàn bộ key có dạng unregistered_device:* trong Redis
        const keys = await redisClient.keys('unregistered_device:*');

        // Trích xuất lấy deviceId
        return keys.map((key) => key.replace('unregistered_device:', ''));
    }

    // Xóa thiết bị khỏi nhà nấm
    async deleteDevice(deviceId: string, ownerId: string): Promise<boolean> {
        const device = await Device.findById(deviceId);
        if (!device) {
            throw new Error('Thiết bị không tồn tại');
        }

        // Kiểm tra quyền sở hữu nhà nấm chứa thiết bị này
        const house = await House.findOne({ _id: device.house, owner: ownerId });
        if (!house) {
            throw new Error('Bạn không có quyền xóa thiết bị này');
        }

        // Xóa thiết bị trong MongoDB
        await Device.findByIdAndDelete(deviceId);

        // Xóa Token của thiết bị này trong Redis (nếu có)
        await redisClient.del(`tb_token:${device.deviceId}`);

        return true;
    }
}