import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  house: mongoose.Types.ObjectId;
  deviceId: string;
  deviceName: string;
  title: string;
  message: string;
  type: 'critical' | 'warning';
  resolved: boolean;
  createdAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    house: {
      type: Schema.Types.ObjectId,
      ref: 'House',
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    deviceName: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['critical', 'warning'],
      default: 'warning',
    },
    resolved: {
      type: Boolean,
      default: false, 
    },
  },
  {
    timestamps: true, // Tự động quản lý createdAt và updatedAt
  }
);

export default mongoose.model<IAlert>('Alert', AlertSchema);