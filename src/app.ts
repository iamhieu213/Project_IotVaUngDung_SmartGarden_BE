import express from 'express';
import cors from 'cors';
import authRouter from './modules/auth/auth.route';
import houseRouter from './modules/house/house.route';
import deviceRouter from './modules/device/device.route'
import alertRouter from './modules/alert/alert.route';
import presetRouter from './modules/preset/preset.route';
const app = express();

app.use(cors());
app.use(express.json());

// Đăng ký các tuyến đường (routes)
app.use('/auth', authRouter);
app.use('/houses', houseRouter);
app.use('/devices', deviceRouter);
app.use('/alerts', alertRouter);
app.use('/presets', presetRouter);

export default app;