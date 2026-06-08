// src/modules/auth.route.ts
import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const authController = new AuthController();

// Đăng ký tài khoản
router.post('/register', authController.register);

// Đăng nhập tài khoản (Trả về Access và Refresh Token)
router.post('/login', authController.login);

// Làm mới Access Token bằng Refresh Token
router.post('/refresh-token', authController.refreshToken);

// Đăng xuất tài khoản (Xóa Refresh Token ở Redis)
router.post('/logout', authController.logout);

// Yêu cầu lấy mã quên mật khẩu (Lưu Redis)
router.post('/forgot-password', authController.forgotPassword);

// Xác nhận đặt lại mật khẩu mới
router.post('/reset-password', authController.resetPassword);

export default router;