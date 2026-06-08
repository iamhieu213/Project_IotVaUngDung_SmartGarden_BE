import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice extends Document {
    deviceId: string;
    name: string;
    status: 'online' | 'offline';
    house: mongoose.Types.ObjectId;
    lastSeen?: Date;
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
            required: true, // 1 house can have multiple devices
        },

        lastSeen: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IDevice>('Device', DeviceSchema);