# Backend - Smart Garden Server

Đây là máy chủ xử lý trung tâm (Backend Server) của hệ thống Vườn thông minh (Smart Garden). Server được viết bằng **TypeScript** chạy trên nền **Node.js** và **Express**, giao tiếp thời gian thực bằng **WebSockets (Socket.io)** và **MQTT Broker (Mosquitto)**, lưu trữ dữ liệu trong **MongoDB**.

---

## 🛠️ Công Nghệ Sử Dụng

* **Core Stack**: Node.js, Express, TypeScript, ts-node-dev.
* **Database**: MongoDB & Mongoose.
* **Caching & Queue**: Redis (Dùng để cache tạm thời thiết bị tự động phát hiện - Auto Discovery).
* **IoT Protocols**: MQTT (thông qua thư viện `mqtt`).
* **Real-time Communication**: Socket.io (WebSockets).
* **AI Integration**: Google GenAI SDK (`@google/genai`) tích hợp mô hình **Gemini 2.5 Flash**.
* **Notifications**: Nodemailer (Gửi email cảnh báo vượt ngưỡng hoặc sự cố đến hòm thư người dùng).
* **Validation & Security**: Zod, BcryptJS, Jsonwebtoken (JWT).

---

## 📂 Cấu Trúc Mã Nguồn

```text
src/
├── app.ts                # Khởi tạo Express app và định tuyến API router
├── server.ts             # Khởi tạo HTTP server, tích hợp Socket.io, kết nối DB & MQTT
├── configs/              # Cấu hình Database MongoDB, Redis, và các biến môi trường
├── middlewares/          # Các bộ lọc kiểm tra quyền truy cập (Auth Middleware)
├── models/               # Các lược đồ dữ liệu MongoDB (Alert, Device, House, Preset, SensorData, User)
├── modules/              # Các mô-đun nghiệp vụ chính:
│   ├── auth/             # Đăng ký, đăng nhập và xác thực người dùng
│   ├── house/            # Quản lý nhà nấm (thêm, sửa, xóa các khu vực)
│   ├── device/           # Quản lý thiết bị ESP32 kết nối, cấu hình cảm biến, logic rơ-le bơm tự động
│   ├── alert/            # Xử lý tạo và thông báo các cảnh báo hệ thống hoặc vượt ngưỡng
│   ├── preset/           # Thiết lập ngưỡng sinh trưởng lý tưởng cho từng loại cây/nấm
│   └── chat/             # Tích hợp chatbot Gemini AI phân tích sức khỏe vườn thời gian thực
├── mqtt/                 # MQTT Service lắng nghe và xuất bản các tin nhắn IoT
├── types/                # Định nghĩa kiểu dữ liệu TypeScript
└── utils/                # Các tiện ích dùng chung (Mailer gửi mail thông báo)
```

---

## 🔐 Cấu Hình Môi Trường (.env)

Tạo file `.env` tại thư mục gốc của Backend và điền đầy đủ các thông số sau:

```env
PORT=3000

# URI kết nối cơ sở dữ liệu MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/smart_garden

# Khóa bí mật ký token đăng nhập (JWT)
JWT_ACCESS_SECRET=your_access_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key

# Cấu hình MQTT Broker kết nối tới ESP32
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password

# Cấu hình dịch vụ ThingsBoard (nếu có sử dụng)
THINGSBOARD_HOST=https://thingsboard.cloud
THINGSBOARD_PROVISION_KEY=your_key
THINGSBOARD_PROVISION_SECRET=your_secret

# Cấu hình máy chủ gửi Email cảnh báo (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# API Key Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
```

---

## 📡 Cơ Chế Hoạt Động IoT & MQTT Topics

Backend đóng vai trò vừa là HTTP/WebSocket server, vừa là MQTT client đăng ký (Subscribe) và xuất bản (Publish) dữ liệu:

### 1. Dữ liệu cảm biến (`smartgarden/devices/<MAC>/data`)
* **Kiểu:** Subscribe
* **Nội dung:** Nhận JSON payload cảm biến từ ESP32 gửi lên định kỳ (mặc định mỗi 5 phút hoặc 10 giây trong chế độ test).
* **Mẫu tin nhắn:**
  ```json
  {
    "temperature1": 28.5,
    "humidity1": 75.0,
    "soilMoisture1": 1850,
    "waterLevel1": 450,
    "lightIntensity1": 320.0
  }
  ```
* **Logic xử lý:** Lưu vào bảng `SensorData`, kiểm tra các ngưỡng an toàn để kích hoạt cảnh báo qua mail/socket nếu vượt ngưỡng lý tưởng trong `Preset`, chạy `pumpService` để kiểm tra đóng/ngắt bơm tự động, và đồng bộ dữ liệu trực quan lên Frontend qua WebSockets `device_update`.

### 2. Trạng thái hoạt động (`smartgarden/devices/<MAC>/status`)
* **Kiểu:** Subscribe
* **Nội dung:** Nhận trạng thái `online` khi ESP32 khởi động hoặc `offline` từ tin nhắn di chúc LWT (Last Will and Testament) khi thiết bị mất điện/mất mạng đột ngột.
* **Logic xử lý:** Cập nhật trạng thái và phát cảnh báo cấp độ nguy cấp (Critical) nếu thiết bị đột ngột ngoại tuyến.

### 3. Lệnh điều khiển bơm (`smartgarden/devices/<MAC>/control`)
* **Kiểu:** Publish
* **Nội dung:** Gửi lệnh bật/tắt rơ-le máy bơm xuống ESP32.
* **Mẫu tin nhắn:**
  ```json
  {"pump": 1}  // Bật máy bơm
  {"pump": 0}  // Tắt máy bơm
  ```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### 1. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 2. Khởi động môi trường phát triển (Development)
Sử dụng `ts-node-dev` để tự động khởi động lại server khi thay đổi mã nguồn:
```bash
npm run dev
```

### 3. Biên dịch mã nguồn sang Javascript (Build)
```bash
npm run build
```

### 4. Khởi chạy production bundle
Chạy mã nguồn đã được biên dịch trong thư mục `dist`:
```bash
npm run start
```
