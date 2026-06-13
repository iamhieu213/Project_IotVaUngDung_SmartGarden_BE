// src/modules/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { 
  RegisterDto, 
  LoginDto, 
  ForgotPasswordDto, 
  ResetPasswordDto,
  RegisterVerifyDto,
  VerifyResetOtpDto
} from './auth.dto';
import { z } from 'zod';

// Định nghĩa các bộ lọc Validate dữ liệu đầu vào bằng thư viện Zod
const RegisterRequestSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải chứa ít nhất 3 ký tự'),
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự'),
});

const RegisterVerifySchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  otp: z.string().length(6, 'Mã OTP phải chứa đúng 6 chữ số'),
});

const LoginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'RefreshToken không được để trống'),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
});

const VerifyResetOtpSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  otp: z.string().length(6, 'Mã OTP phải chứa đúng 6 chữ số'),
});

const ResetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Mã Token xác thực không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải chứa ít nhất 6 ký tự'),
  confirmPassword: z.string().min(6, 'Mật khẩu xác nhận phải chứa ít nhất 6 ký tự'),
});

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // 1. API Yêu cầu Đăng ký tài khoản (Gửi OTP)
  registerRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const registerData: RegisterDto = RegisterRequestSchema.parse(req.body);
      await this.authService.registerRequest(registerData);
      
      res.status(200).json({
        success: true,
        message: 'Mã OTP xác thực đã được gửi về Gmail của bạn.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Yêu cầu đăng ký tài khoản thất bại'
      });
    }
  };

  // 2. API Xác nhận OTP Đăng ký (Tạo tài khoản chính thức)
  registerVerify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const verifyData: RegisterVerifyDto = RegisterVerifySchema.parse(req.body);
      const result = await this.authService.registerVerify(verifyData);
      
      res.status(201).json({
        success: true,
        message: 'Đăng ký tài khoản thành công',
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Xác thực mã OTP thất bại'
      });
    }
  };

  // 3. API Đăng nhập
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginDto = LoginSchema.parse(req.body);
      const result = await this.authService.login(loginData);
      
      res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công',
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(401).json({
        success: false,
        message: error.message || 'Đăng nhập thất bại'
      });
    }
  };

  // 4. API Làm mới Access Token
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokenData = RefreshTokenSchema.parse(req.body);
      const result = await this.authService.refreshToken(tokenData);

      res.status(200).json({
        success: true,
        message: 'Làm mới token thành công',
        data: result
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(401).json({
        success: false,
        message: error.message || 'Làm mới token thất bại'
      });
    }
  };

  // 5. API Đăng xuất
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'Thiếu thông tin mã người dùng (userId)'
        });
        return;
      }
      
      await this.authService.logout(userId);
      
      res.status(200).json({
        success: true,
        message: 'Đăng xuất và hủy phiên làm việc thành công'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Có lỗi xảy ra khi xử lý đăng xuất'
      });
    }
  };

  // 6. API Yêu cầu khôi phục mật khẩu - Bước 1: Gửi OTP Gmail
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const forgotData: ForgotPasswordDto = ForgotPasswordSchema.parse(req.body);
      await this.authService.forgotPassword(forgotData);
      
      res.status(200).json({
        success: true,
        message: 'Mã OTP đặt lại mật khẩu đã được gửi về Gmail của bạn.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Yêu cầu khôi phục mật khẩu thất bại'
      });
    }
  };

  // 7. API Xác nhận OTP Quên mật khẩu - Bước 2: Trả về Reset Token tạm thời
  verifyResetOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const verifyData: VerifyResetOtpDto = VerifyResetOtpSchema.parse(req.body);
      const resetToken = await this.authService.verifyResetOtp(verifyData);
      
      res.status(200).json({
        success: true,
        message: 'Xác thực mã OTP thành công. Vui lòng đặt lại mật khẩu mới.',
        data: { resetToken }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Xác thực mã OTP thất bại'
      });
    }
  };

  // 8. API Xác nhận mật khẩu mới - Bước 3: Đặt mật khẩu mới qua Reset Token
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resetData: ResetPasswordDto = ResetPasswordSchema.parse(req.body);
      await this.authService.resetPassword(resetData);
      
      res.status(200).json({
        success: true,
        message: 'Đặt lại mật khẩu mới thành công',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Đặt lại mật khẩu mới thất bại'
      });
    }
  };

  // Hàm helper xử lý format lỗi validate từ Zod
  private handleValidationError(res: Response, error: z.ZodError): void {
    res.status(400).json({
      success: false,
      message: 'Dữ liệu đầu vào không hợp lệ',
      errors: error.issues.map((err) => ({
        field: String(err.path[0] || ''),
        message: err.message
      }))
    });
  }
}