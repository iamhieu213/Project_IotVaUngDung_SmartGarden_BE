// src/modules/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { z } from 'zod';

// Định nghĩa các bộ lọc Validate dữ liệu đầu vào bằng thư viện Zod
const RegisterSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải chứa ít nhất 3 ký tự'),
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự'),
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

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Mã token khôi phục không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải chứa ít nhất 6 ký tự'),
  confirmPassword: z.string().min(6, 'Mật khẩu xác nhận phải chứa ít nhất 6 ký tự'),
});

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // API Đăng ký tài khoản mới
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate định dạng đầu vào bằng Zod
      const registerData: RegisterDto = RegisterSchema.parse(req.body);
      
      // 2. Gọi tầng Service xử lý logic lưu Database
      const result = await this.authService.register(registerData);
      
      // 3. Trả về response thành công kèm thông tin UserResponse sạch
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
        message: error.message || 'Đăng ký tài khoản thất bại'
      });
    }
  };

  // API Đăng nhập (Trả về AccessToken và RefreshToken)
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate định dạng đầu vào bằng Zod
      const loginData: LoginDto = LoginSchema.parse(req.body);
      
      // 2. Gọi Service xử lý so khớp và tạo Token
      const result = await this.authService.login(loginData);
      
      // 3. Trả phản hồi thành công và cặp token
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

  // API Làm mới Access Token (sử dụng Refresh Token lưu trong Redis)
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate định dạng đầu vào bằng Zod
      const tokenData = RefreshTokenSchema.parse(req.body);
      
      // 2. Gọi Service xác minh và sinh cặp Token mới
      const result = await this.authService.refreshToken(tokenData);

      // 3. Trả về cặp Token mới
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

  // API Đăng xuất (Hủy bỏ phiên làm việc, xóa Refresh Token khỏi Redis)
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
      
      // Thu hồi RefreshToken của người dùng trong Redis
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

  // API Yêu cầu mã khôi phục mật khẩu (Quên mật khẩu)
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate email gửi lên bằng Zod
      const forgotData: ForgotPasswordDto = ForgotPasswordSchema.parse(req.body);
      
      // 2. Gọi Service tạo mã token khôi phục tạm thời trong Redis
      const token = await this.authService.forgotPassword(forgotData);
      
      res.status(200).json({
        success: true,
        message: 'Mã khôi phục mật khẩu đã được tạo thành công',
        data: { token },
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

  // API Xác nhận mật khẩu mới bằng mã token
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate dữ liệu mật khẩu mới và xác nhận mật khẩu
      const resetData: ResetPasswordDto = ResetPasswordSchema.parse(req.body);
      
      // 2. Gọi Service kiểm tra tính hợp lệ của token trong Redis và tiến hành cập nhật DB
      await this.authService.resetPassword(resetData);
      
      res.status(200).json({
        success: true,
        message: 'Đổi mật khẩu mới thành công',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return this.handleValidationError(res, error);
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Đổi mật khẩu mới thất bại'
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