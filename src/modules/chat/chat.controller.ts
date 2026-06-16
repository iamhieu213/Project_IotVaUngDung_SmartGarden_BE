import { Response } from 'express';
// 1. Nhập AuthRequest từ middleware xác thực của bạn
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ChatService } from './chat.service';

export class ChatController {
    private chatService: ChatService;

    constructor() {
        this.chatService = new ChatService();
    }

    /**
     * Endpoint API xử lý chat với AI
     * 2. Đổi kiểu của req từ Request thành AuthRequest
     */
    chatWithAI = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const { message, houseId } = req.body;
            const userId = req.user?.id; // Bây giờ TS sẽ hiểu req.user mà không báo lỗi nữa!

            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: "Bạn cần đăng nhập để thực hiện chức năng này." 
                });
            }

            if (!message) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Tin nhắn không được để trống." 
                });
            }

            // Gọi logic xử lý từ ChatService
            const reply = await this.chatService.getAIChatResponse(userId, message, houseId);

            return res.status(200).json({
                success: true,
                reply
            });

        } catch (error: any) {
            console.error("Lỗi tại ChatController:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Lỗi hệ thống khi xử lý hội thoại AI.",
                error: error.message,
                stack: error.stack
            });
        }
    }
}