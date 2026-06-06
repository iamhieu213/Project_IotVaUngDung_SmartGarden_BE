import mongoose, { Schema, Document } from 'mongoose';

export interface IHouse extends Document {
    name: string;
    address: string;
    width: number;
    height: number;
    owner: mongoose.Types.ObjectId;
}

const HouseSchema = new Schema<IHouse>(
    {
        name: {
            type: String,
            required: true,
        },

        address: {
            type: String,
            required: true,
        },

        width: {
            type: Number,
            default: 0,
        },

        height: {
            type: Number,
            default: 0,
        },

        owner: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IHouse>('House', HouseSchema);