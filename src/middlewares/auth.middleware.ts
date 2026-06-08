import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'access_secret_key_123';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Quyền truy cập bị từ chối. Không tìm thấy token xác thực.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtAccessSecret) as {
      id: string;
      username: string;
      email: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ hoặc đã hết hạn.',
    });
  }
};
