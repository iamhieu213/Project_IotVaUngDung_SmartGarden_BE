import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const chatController = new ChatController();

router.use(authMiddleware as any);

// Gọi đến method chatWithAI của Controller
router.post('/', chatController.chatWithAI as any);

export default router;