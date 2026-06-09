import dotenv from 'dotenv';
import { MqttService } from './mqtt/mqtt.service'
dotenv.config();

import app from './app';
import connectDatabase from './configs/database';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDatabase();

    const mqttService = new MqttService();
    mqttService.connect();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();