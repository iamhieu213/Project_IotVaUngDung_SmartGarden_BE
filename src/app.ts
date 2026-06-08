import express from 'express';
import cors from 'cors';
import authRouter from './modules/auth/auth.route';
import houseRouter from './modules/house/house.route';

const app = express();

app.use(cors());
app.use(express.json());

// Đăng ký các tuyến đường (routes)
app.use('/auth', authRouter);
app.use('/houses', houseRouter);

export default app;