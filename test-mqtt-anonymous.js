const mqtt = require('mqtt');

// Kết nối tới MQTT Broker mà KHÔNG dùng username và password (kết nối ẩn danh)
// Bạn có thể thay 'localhost:1883' bằng địa chỉ IP/Host của Broker bạn đang test
const brokerUrl = 'mqtt://localhost:1883'; 

console.log(`[MQTT Test] Đang kết nối tới Broker ẩn danh tại: ${brokerUrl}...`);

const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log('=== KẾT NỐI ẨN DANH THÀNH CÔNG! ===');
  
  const deviceId = 'SG-PUMP-002'; // ID thiết bị chạy thử

  // 1. Gửi trạng thái online
  client.publish(`smartgarden/devices/${deviceId}/status`, 'online');
  console.log(`Đã gửi trạng thái ONLINE cho thiết bị [${deviceId}]`);

  // 2. Dữ liệu cảm biến giả lập
  const mockData = {
    temperature1: 28.5,
    humidity1: 79.5,
    soilMoisture1: 60,
    lightIntensity2: 550
  };

  // Gửi gói tin dữ liệu cảm biến dạng JSON
  client.publish(`smartgarden/devices/${deviceId}/data`, JSON.stringify(mockData));
  console.log('Đã gửi dữ liệu đo đạc ẩn danh:', mockData);

  // Đợi 1.5 giây rồi ngắt kết nối
  setTimeout(() => {
    client.end();
    console.log('Đã đóng kết nối MQTT.');
  }, 1500);
});

client.on('error', (err) => {
  console.error('Lỗi kết nối MQTT (Không thể kết nối ẩn danh):', err.message);
});
