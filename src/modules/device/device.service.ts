import Device, { IDevice } from '../../models/Device'
import House from '../../models/House'
import redisClient from '../../configs/redis'
import SensorData from '../../models/SensorData'
import { CreateDeviceDto, DeviceResponse } from './device.dto'
import axios from 'axios'

export class DeviceService {
    async mapToDeviceResponse(device: IDevice): Promise<DeviceResponse> {
        // Đọc token từ Redis ra để trả về cho Client
        const tbToken = await redisClient.get(`tb_token:${device.deviceId}`) || undefined;
        // Lấy dữ liệu cảm biến mới nhất
        const latestData = await SensorData.findOne({ device: device._id }).sort({ createdAt: -1 });

        // Chuyển đổi Map trong Mongoose sang Plain Object để gửi về Client
        const sensorPositionsObj: Record<string, { spaceX: number; spaceY: number; displayName?: string }> = {};
        if (device.sensorPositions) {
            device.sensorPositions.forEach((value, key) => {
                sensorPositionsObj[key] = {
                    spaceX: value.spaceX,
                    spaceY: value.spaceY,
                    displayName: value.displayName || '' // <-- Trả thêm tên hiển thị về Frontend
                };
            });
        }

        return {
            id: (device._id as any).toString(),
            deviceId: device.deviceId,
            name: device.name,
            status: device.status,
            house: device.house.toString(),
            lastSeen: device.lastSeen,
            thingsboardAccessToken: tbToken,
            sensorPositions: sensorPositionsObj,
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

    // SAU KHI SỬA (Chỉ lấy danh sách và trả về trực tiếp, tin cậy tuyệt đối vào DB):
    async getDevicesByHouse(houseId: string, ownerId: string): Promise<DeviceResponse[]> {
        const house = await House.findOne({ _id: houseId, owner: ownerId });
        if (!house) throw new Error('Nhà nấm không tồn tại hoặc bạn không có quyền truy cập');

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

    // Hàm cập nhật tọa độ cho từng cảm biến thành phần
    async updateSensorPosition(
        deviceId: string,
        sensorType: string,
        spaceX: number,
        spaceY: number,
        displayName: string | undefined,
        ownerId: string
    ): Promise<DeviceResponse> {
        const device = await Device.findById(deviceId);
        if (!device) throw new Error('Thiết bị không tồn tại');

        const house = await House.findOne({ _id: device.house, owner: ownerId });
        if (!house) throw new Error('Bạn không có quyền chỉnh sửa vị trí thiết bị này');

        if (!device.sensorPositions) {
            device.sensorPositions = new Map();
        }

        const existing = device.sensorPositions.get(sensorType);
        device.sensorPositions.set(sensorType, {
            spaceX,
            spaceY,
            displayName: displayName !== undefined ? displayName : (existing?.displayName || '')
        });

        const savedDevice = await device.save();
        return this.mapToDeviceResponse(savedDevice);
    }

    // Nghiệp vụ A: Tính toán lịch sử gộp nhóm
    async getTelemetryHistory(houseId: string, range: string, ownerId: string) {
        // 1. Xác thực quyền sở hữu nhà nấm
        const house = await House.findOne({ _id: houseId, owner: ownerId });
        if (!house) throw new Error('Nhà nấm không tồn tại hoặc bạn không có quyền truy cập');
        // 2. Lấy danh sách ID của các thiết bị thuộc nhà nấm này
        const devices = await Device.find({ house: houseId });
        const deviceIds = devices.map(d => d._id);
        if (deviceIds.length === 0) {
            return []; // Nhà nấm chưa có thiết bị nào
        }
        // 3. Tính mốc thời gian bắt đầu quét dữ liệu dựa vào range
        const now = new Date();
        let startDate = new Date();
        let groupByFormat: any = {}; // Định dạng để group dữ liệu
        if (range === '24h') {
            startDate.setHours(now.getHours() - 24);
            // Group theo Năm - Tháng - Ngày - Giờ
            groupByFormat = {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' },
                hour: { $hour: '$createdAt' }
            };
        } else if (range === '7d') {
            startDate.setDate(now.getDate() - 7);
            // Group theo Năm - Tháng - Ngày
            groupByFormat = {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
        } else if (range === '30d') {
            startDate.setDate(now.getDate() - 30);
            // Group theo Năm - Tháng - Ngày
            groupByFormat = {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
        } else {
            throw new Error('Khoảng thời gian (range) không được hỗ trợ');
        }
        // 4. Chạy MongoDB Aggregation Pipeline
        const rawData = await SensorData.aggregate([
            // Bước 1: Lọc dữ liệu theo mốc thời gian và danh sách thiết bị thuộc nhà nấm
            {
                $match: {
                    device: { $in: deviceIds },
                    createdAt: { $gte: startDate }
                }
            },
            // Bước 2: Group và tính trung bình cộng ($avg) của các cảm biến trong khung giờ/ngày
            {
                $group: {
                    _id: groupByFormat,
                    avgTemperature: { $avg: '$temperature' },
                    avgHumidity: { $avg: '$humidity' },
                    avgSoilMoisture: { $avg: '$soilMoisture' },
                    avgLightIntensity: { $avg: '$lightIntensity' }
                }
            },
            // Bước 3: Sắp xếp theo thứ tự thời gian tăng dần (cũ đến mới)
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1,
                    '_id.hour': 1
                }
            }
        ]);
        // 5. Format lại kết quả gửi về cho Frontend dễ vẽ biểu đồ
        return rawData.map(item => {
            let label = '';
            if (range === '24h') {
                // Ví dụ label: "14:00"
                label = `${String(item._id.hour).padStart(2, '0')}:00`;
            } else {
                // Ví dụ label: "12/06"
                label = `${String(item._id.day).padStart(2, '0')}/${String(item._id.month).padStart(2, '0')}`;
            }
            return {
                time: label,
                // Làm tròn đến 1 chữ số thập phân
                temperature: Math.round(item.avgTemperature * 10) / 10,
                humidity: Math.round(item.avgHumidity * 10) / 10,
                soilMoisture: Math.round(item.avgSoilMoisture * 10) / 10,
                lightIntensity: Math.round(item.avgLightIntensity),
            };
        });
    }
    // Nghiệp vụ B: So sánh chỉ số trung bình 7 ngày qua giữa các nhà nấm
    async getHousesComparison(ownerId: string) {
        // 1. Tìm toàn bộ nhà nấm của User
        const userHouses = await House.find({ owner: ownerId });
        if (userHouses.length === 0) return [];
        const comparisonResults = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        // Quét từng nhà nấm để tính trung bình cộng chỉ số trong 7 ngày
        for (const house of userHouses) {
            const devices = await Device.find({ house: house._id });
            const deviceIds = devices.map(d => d._id);
            let avgTemp = 0;
            let avgHum = 0;
            if (deviceIds.length > 0) {
                const stats = await SensorData.aggregate([
                    {
                        $match: {
                            device: { $in: deviceIds },
                            createdAt: { $gte: sevenDaysAgo }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            temp: { $avg: '$temperature' },
                            hum: { $avg: '$humidity' }
                        }
                    }
                ]);
                if (stats.length > 0) {
                    avgTemp = Math.round(stats[0].temp * 10) / 10;
                    avgHum = Math.round(stats[0].hum * 10) / 10;
                }
            }
            comparisonResults.push({
                houseId: house._id,
                houseName: house.name,
                averageTemperature: avgTemp || null,
                averageHumidity: avgHum || null,
            });
        }
        return comparisonResults;
    }
}