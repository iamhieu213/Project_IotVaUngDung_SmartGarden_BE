import { z } from 'zod';

const BasePresetSchema = z.object({
  name: z.string().min(1, 'Tên cấu hình không được để trống'),
  tempMin: z.number().optional(),
  tempMax: z.number().optional(),
  humidityMin: z.number().min(0, 'Độ ẩm không khí tối thiểu phải từ 0%').max(100, 'Độ ẩm không khí tối thiểu tối đa là 100%').optional(),
  humidityMax: z.number().min(0, 'Độ ẩm không khí tối đa phải từ 0%').max(100, 'Độ ẩm không khí tối đa tối đa là 100%').optional(),
  soilMoistureMin: z.number().min(0, 'Độ ẩm đất tối thiểu phải từ 0%').max(100, 'Độ ẩm đất tối thiểu tối đa là 100%'),
  soilMoistureMax: z.number().min(0, 'Độ ẩm đất tối đa phải từ 0%').max(100, 'Độ ẩm đất tối đa tối đa là 100%'),
});

export const CreatePresetSchema = BasePresetSchema.refine((data) => data.soilMoistureMin <= data.soilMoistureMax, {
  message: 'Độ ẩm đất tối thiểu phải nhỏ hơn hoặc bằng độ ẩm đất tối đa',
  path: ['soilMoistureMin'],
}).refine((data) => {
  if (data.tempMin !== undefined && data.tempMax !== undefined) {
    return data.tempMin <= data.tempMax;
  }
  return true;
}, {
  message: 'Nhiệt độ tối thiểu phải nhỏ hơn hoặc bằng nhiệt độ tối đa',
  path: ['tempMin'],
}).refine((data) => {
  if (data.humidityMin !== undefined && data.humidityMax !== undefined) {
    return data.humidityMin <= data.humidityMax;
  }
  return true;
}, {
  message: 'Độ ẩm không khí tối thiểu phải nhỏ hơn hoặc bằng độ ẩm không khí tối đa',
  path: ['humidityMin'],
});

export type CreatePresetDto = z.infer<typeof CreatePresetSchema>;

export const UpdatePresetSchema = BasePresetSchema.partial().refine((data) => {
  if (data.soilMoistureMin !== undefined && data.soilMoistureMax !== undefined) {
    return data.soilMoistureMin <= data.soilMoistureMax;
  }
  return true;
}, {
  message: 'Độ ẩm đất tối thiểu phải nhỏ hơn hoặc bằng độ ẩm đất tối đa',
  path: ['soilMoistureMin'],
}).refine((data) => {
  if (data.tempMin !== undefined && data.tempMax !== undefined) {
    return data.tempMin <= data.tempMax;
  }
  return true;
}, {
  message: 'Nhiệt độ tối thiểu phải nhỏ hơn hoặc bằng nhiệt độ tối đa',
  path: ['tempMin'],
}).refine((data) => {
  if (data.humidityMin !== undefined && data.humidityMax !== undefined) {
    return data.humidityMin <= data.humidityMax;
  }
  return true;
}, {
  message: 'Độ ẩm không khí tối thiểu phải nhỏ hơn hoặc bằng độ ẩm không khí tối đa',
  path: ['humidityMin'],
});

export type UpdatePresetDto = z.infer<typeof UpdatePresetSchema>;

export interface PresetResponse {
  id: string;
  name: string;
  tempMin?: number;
  tempMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  soilMoistureMin: number;
  soilMoistureMax: number;
  createdAt: Date;
  updatedAt: Date;
}
