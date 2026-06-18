import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import Device from '../../models/Device';
import SensorData from '../../models/SensorData';
import House from '../../models/House';

export class ChatService {
    private ai: GoogleGenAI;

    constructor() {
        // Khởi tạo Gemini client với API Key từ file env
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    /**
     * Lấy câu trả lời phân tích từ AI dựa trên bối cảnh nhà nấm thực tế
     */
    async getAIChatResponse(userId: string, message: string, houseId?: string): Promise<string> {
        let systemContext = `Bạn là một chuyên gia nông nghiệp thông minh và là trợ lý ảo hỗ trợ quản lý nhà nấm (Smart Garden). 
        Hãy trả lời thân thiện, ngắn gọn và cung cấp giải pháp thực tế.`;

        // Nếu người dùng có gửi houseId kèm theo và là ObjectId hợp lệ
        if (houseId && mongoose.Types.ObjectId.isValid(houseId)) {
            const house = await House.findOne({ _id: houseId, owner: userId });
            
            if (house) {
                // Tìm thiết bị và nạp cấu hình giống cây trồng đang chạy
                const device = await Device.findOne({ house: houseId }).populate('activePreset');
                
                let sensorInfo = "Không có dữ liệu cảm biến hiện tại.";
                let presetInfo = "Chưa thiết lập cấu hình cây trồng.";

                if (device) {
                    // Lấy dữ liệu cảm biến mới nhất
                    const latestData = await SensorData.findOne({ device: device._id })
                        .sort({ createdAt: -1 });

                    if (latestData) {
                        const readings = Object.fromEntries(latestData.readings);
                        sensorInfo = JSON.stringify(readings);
                    }

                    if (device.activePreset) {
                        const preset: any = device.activePreset;
                        presetInfo = `Đang trồng loại nấm/cây: "${preset.name}". 
                        Ngưỡng lý tưởng: Nhiệt độ (${preset.tempMin}°C - ${preset.tempMax}°C), Độ ẩm đất (${preset.soilMoistureMin}% - ${preset.soilMoistureMax}%).`;
                    }
                }

                // Gắn ngữ cảnh chi tiết vào System Instruction
                systemContext += `\n\n[BỐI CẢNH THỰC TẾ]:
                Người dùng đang xem nhà nấm có tên: "${house.name}".
                Cấu hình đang chạy: ${presetInfo}
                Thông số cảm biến thực tế mới nhất: ${sensorInfo}
                
                Hãy so sánh các thông số cảm biến thực tế với ngưỡng lý tưởng của cấu hình đang chạy để phân tích xem vườn đang "ỔN" hay "KHÔNG ỔN". Nếu không ổn, chỉ ra thông số nào vượt ngưỡng và đưa ra lời khuyên cụ thể.`;
            }
        }

        // Gọi API Gemini
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
                systemInstruction: systemContext
            }
        });

        return response.text || "Xin lỗi, tôi không thể xử lý câu trả lời lúc này.";
    }
}