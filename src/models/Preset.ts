import mongoose, { Schema, Document } from 'mongoose';

export interface IPreset extends Document {
  name: string;
  owner: mongoose.Types.ObjectId;
  tempMin?: number;
  tempMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  soilMoistureMin: number;
  soilMoistureMax: number;
  createdAt: Date;
  updatedAt: Date;
}

const PresetSchema = new Schema<IPreset>(
  {
    name: {
      type: String,
      required: [true, 'Tên cấu hình không được để trống'],
      trim: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Chủ sở hữu cấu hình là bắt buộc'],
    },
    tempMin: {
      type: Number,
    },
    tempMax: {
      type: Number,
    },
    humidityMin: {
      type: Number,
    },
    humidityMax: {
      type: Number,
    },
    soilMoistureMin: {
      type: Number,
      required: [true, 'Độ ẩm đất tối thiểu là bắt buộc'],
      min: [0, 'Độ ẩm đất tối thiểu phải từ 0%'],
      max: [100, 'Độ ẩm đất tối thiểu tối đa là 100%'],
    },
    soilMoistureMax: {
      type: Number,
      required: [true, 'Độ ẩm đất tối đa là bắt buộc'],
      min: [0, 'Độ ẩm đất tối đa phải từ 0%'],
      max: [100, 'Độ ẩm đất tối đa tối đa là 100%'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IPreset>('Preset', PresetSchema);
