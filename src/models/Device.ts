import mongoose, { Schema, Document } from 'mongoose';

export interface ISensorPosition {
    spaceX: number;
    spaceY: number;
    displayName?: string;
}

export interface IDevice extends Document {
    deviceId: string;
    name: string;
    status: 'online' | 'offline';
    house: mongoose.Types.ObjectId;
    lastSeen?: Date;
    pumpState?: 'on' | 'off'; 
    activePreset?: mongoose.Types.ObjectId | null;
    
    sensorPositions?: Map<string, ISensorPosition>;
}

const DeviceSchema = new Schema<IDevice>(
    {
        deviceId: {
            type: String,
            required: true,
            unique: true,
        },

        name: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            enum: ['online', 'offline'],
            default: 'offline',
        },

        house: {
            type: Schema.Types.ObjectId,
            ref: 'House',
            required: true,
        },

        lastSeen: {
            type: Date,
        },

        // Lưu vị trí riêng của từng cảm biến thành phần dưới dạng Map (Key-Value)
        sensorPositions: {
            type: Map,
            of: {
                spaceX: { type: Number, required: true },
                spaceY: { type: Number, required: true },
                displayName: { type: String, required: false }
            },
            default: {}
        },

        pumpState: {
            type: String,
            enum: ['on', 'off'],
            default: 'off', // Mặc định máy bơm ở trạng thái tắt
        },

        activePreset: {
            type: Schema.Types.ObjectId,
            ref: 'Preset',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IDevice>('Device', DeviceSchema);