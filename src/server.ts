import dotenv from 'dotenv';
import { MqttService } from './mqtt/mqtt.service'
dotenv.config();

import app from './app';
import connectDatabase from './configs/database';
import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3000;

// 1. Tạo HTTP Server bọc Express App
const server = http.createServer(app);

// 2. Khởi tạo Socket.io và cấu hình CORS cho phép Frontend kết nối
export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Có client kết nối: ${socket.id}`);
});

// 3. Hàm khởi động hệ thống
const startServer = async () => {
    // Kết nối Database
    await connectDatabase();

    // Khởi động dịch vụ lắng nghe MQTT
    const mqttService = new MqttService();
    mqttService.connect();

    // CHỈ DÙNG DUY NHẤT LỆNH NÀY để lắng nghe cổng (Chạy được cả HTTP và WebSockets)
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT} with WebSockets enabled`);
    });
};

startServer();