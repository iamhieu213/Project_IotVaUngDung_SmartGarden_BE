// src/modules/auth.route.ts
import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const authController = new AuthController();

// Đăng ký tài khoản (Luồng OTP 2 bước)
router.post('/register-request', authController.registerRequest);
router.post('/register-verify', authController.registerVerify);

// Đăng nhập tài khoản (Trả về Access và Refresh Token)
router.post('/login', authController.login);

// Làm mới Access Token bằng Refresh Token
router.post('/refresh-token', authController.refreshToken);

// Đăng xuất tài khoản (Xóa Refresh Token ở Redis)
router.post('/logout', authController.logout);

// Quên mật khẩu & Reset (Luồng OTP 3 bước)
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

export default router;