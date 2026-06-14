import mongoose, { Schema, Document } from 'mongoose';

export interface ISensorData extends Document {
    device: mongoose.Types.ObjectId;
    readings: Map<string, number>; // Map lưu động mọi key số
    createdAt: Date;
}

const SensorDataSchema = new Schema<ISensorData>(
    {
        device: {
            type: Schema.Types.ObjectId,
            ref: 'Device',
            required: true,
        },
        readings: {
            type: Map,
            of: Number,
            default: {}
        }
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<ISensorData>('SensorData', SensorDataSchema);