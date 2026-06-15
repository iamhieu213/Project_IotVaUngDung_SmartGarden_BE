import Preset, { IPreset } from '../../models/Preset';
import Device from '../../models/Device';
import { CreatePresetDto, UpdatePresetDto, PresetResponse } from './preset.dto';
import mongoose from 'mongoose';

export class PresetService {
  async mapToPresetResponse(preset: IPreset): Promise<PresetResponse> {
    return {
      id: (preset._id as any).toString(),
      name: preset.name,
      tempMin: preset.tempMin,
      tempMax: preset.tempMax,
      humidityMin: preset.humidityMin,
      humidityMax: preset.humidityMax,
      soilMoistureMin: preset.soilMoistureMin,
      soilMoistureMax: preset.soilMoistureMax,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    };
  }

  async createPreset(dto: CreatePresetDto, ownerId: string): Promise<PresetResponse> {
    const preset = new Preset({
      ...dto,
      owner: new mongoose.Types.ObjectId(ownerId),
    });
    const saved = await preset.save();
    return this.mapToPresetResponse(saved);
  }

  async getPresetsByOwner(ownerId: string): Promise<PresetResponse[]> {
    const presets = await Preset.find({ owner: new mongoose.Types.ObjectId(ownerId) }).sort({ createdAt: -1 });
    return Promise.all(presets.map((p) => this.mapToPresetResponse(p)));
  }

  async getPresetById(id: string, ownerId: string): Promise<PresetResponse> {
    const preset = await Preset.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(ownerId),
    });
    if (!preset) {
      throw new Error('Cấu hình không tồn tại hoặc bạn không có quyền truy cập');
    }
    return this.mapToPresetResponse(preset);
  }

  async updatePreset(id: string, dto: UpdatePresetDto, ownerId: string): Promise<PresetResponse> {
    const preset = await Preset.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(ownerId),
    });
    if (!preset) {
      throw new Error('Cấu hình không tồn tại hoặc bạn không có quyền chỉnh sửa');
    }

    // Gán các thay đổi
    Object.assign(preset, dto);
    const saved = await preset.save();
    return this.mapToPresetResponse(saved);
  }

  async deletePreset(id: string, ownerId: string): Promise<boolean> {
    const preset = await Preset.findOne({
      _id: new mongoose.Types.ObjectId(id),
      owner: new mongoose.Types.ObjectId(ownerId),
    });
    if (!preset) {
      throw new Error('Cấu hình không tồn tại hoặc bạn không có quyền xóa');
    }

    // Xóa preset
    await Preset.findByIdAndDelete(id);

    // Gỡ cấu hình này khỏi toàn bộ thiết bị đang liên kết
    await Device.updateMany(
      { activePreset: new mongoose.Types.ObjectId(id) },
      { $unset: { activePreset: "" } }
    );

    return true;
  }
}
