import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Lỗi kết nối Redis Client:', err));

// Kết nối tự động
(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Đã kết nối thành công tới Redis!');
  }
})();

export default redisClient;