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
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IDevice>('Device', DeviceSchema);