const mqtt = require('mqtt');

// Kết nối tới Mosquitto Broker chạy cục bộ
const client = mqtt.connect('mqtt://localhost:1883', {
  username: 'smart_garden_user',
  password: 'hieu21032004'
});

client.on('connect', () => {
  console.log('Đã kết nối tới MQTT Broker thành công!');
  
  const deviceId = 'SG-PUMP-001'; // Bạn hãy thay bằng deviceId thực tế trong DB của bạn

  // 1. Gửi trạng thái online để kích hoạt thiết bị
  client.publish(`smartgarden/devices/${deviceId}/status`, 'online');
  console.log(`Đã báo thiết bị [${deviceId}] ONLINE`);

  // 2. Thiết lập dữ liệu cảm biến (Nhiệt độ 35 độ C vượt ngưỡng an toàn để kích hoạt cảnh báo)
  const mockData = {
    temperature: 28,   // Ngưỡng an toàn là 15 - 32 (gửi 35 để báo Nhiệt độ quá cao)
    humidity: 85,      // Ngưỡng an toàn 70 - 98
    soilMoisture: 60,  // Ngưỡng an toàn >= 50
    lightLevel: 400
  };

  // Gửi gói tin dữ liệu cảm biến dạng JSON
  client.publish(`smartgarden/devices/${deviceId}/data`, JSON.stringify(mockData));
  console.log('Đã gửi dữ liệu đo đạc:', mockData);

  // Đợi 1 giây rồi ngắt kết nối
  setTimeout(() => {
    client.end();
    console.log('Đã đóng kết nối MQTT.');
  }, 1000);
});

client.on('error', (err) => {
  console.error('Lỗi kết nối MQTT:', err);
});