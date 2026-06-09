import { z } from 'zod';

export const CreateDeviceSchema = z.object({
  deviceId: z.string().min(1, 'Mã định danh thiết bị (MAC) không được để trống'),
  name: z.string().min(1, 'Tên thiết bị không được để trống'),
  houseId: z.string().min(1, 'Mã nhà nấm không được để trống'),
  thingsboardAccessToken: z.string().optional(), // Token ThingsBoard có thể có hoặc không
});

export type CreateDeviceDto = z.infer<typeof CreateDeviceSchema>;

export interface DeviceResponse {
    id: string;
    deviceId: string;
    name: string;
    status: 'online' | 'offline'
    house: string;
    lastSeen?: Date;
    thingsboardAccessToken?: string;
    createdAt: Date;
    latestTelemetry?: {
        temperature: number;
        humidity: number;
        soilMoisture: number;
        lightIntensity: number;
        createdAt: Date;
    } | null;
}
