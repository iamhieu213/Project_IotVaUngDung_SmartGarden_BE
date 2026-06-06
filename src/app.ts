import express from 'express';
import cors from 'cors';
import authRouter from './modules/auth.route';

const app = express();

app.use(cors());
app.use(express.json());

// Đăng ký các tuyến đường (routes)
app.use('/auth', authRouter);

export default app;