import { z } from 'zod';

export const CreateDeviceSchema = z.object({
  deviceId: z.string().min(1, 'Mã định danh thiết bị (MAC) không được để trống'),
  name: z.string().min(1, 'Tên thiết bị không được để trống'),
  houseId: z.string().min(1, 'Mã nhà nấm không được để trống'),
  thingsboardAccessToken: z.string().optional(), // Token ThingsBoard có thể có hoặc không
});

export type CreateDeviceDto = z.infer<typeof CreateDeviceSchema>;

export const UpdateSensorPositionSchema = z.object({
  sensorType: z.string().min(1, 'Loại cảm biến không được để trống'),
  spaceX: z.number().min(0).max(100, 'Tọa độ X phải từ 0 đến 100%'),
  spaceY: z.number().min(0).max(100, 'Tọa độ Y phải từ 0 đến 100%'),
  displayName: z.string().optional(),
});

export type UpdateSensorPositionDto = z.infer<typeof UpdateSensorPositionSchema>;

export interface DeviceResponse {
    id: string;
    deviceId: string;
    name: string;
    status: 'online' | 'offline';
    house: string;
    lastSeen?: Date;
    thingsboardAccessToken?: string;
    sensorPositions?: Record<string, { spaceX: number; spaceY: number; displayName?: string }>;
    createdAt: Date;
    latestTelemetry?: {
        createdAt: Date;
        [key: string]: any;
    } | null;
}

