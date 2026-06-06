import mongoose, { Schema, Document } from 'mongoose';

export interface ISensorData extends Document {
    device: mongoose.Types.ObjectId;

    temperature: number;

    humidity: number;

    soilMoisture: number;

    lightIntensity: number;

    createdAt: Date;
}

const SensorDataSchema = new Schema<ISensorData>(
    {
        device: {
            type: Schema.Types.ObjectId,
            ref: 'Device',
            required: true,
        },

        temperature: {
            type: Number,
            default: 0,
        },

        humidity: {
            type: Number,
            default: 0,
        },

        soilMoisture: {
            type: Number,
            default: 0,
        },

        lightIntensity: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<ISensorData>(
    'SensorData',
    SensorDataSchema
);