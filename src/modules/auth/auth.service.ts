import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AuthRepository } from "./auth.repository";
import { 
  RegisterDto, 
  UserResponse, 
  LoginDto, 
  LoginResponse, 
  ForgotPasswordDto, 
  ResetPasswordDto, 
  RefreshTokenDto, 
  RefreshTokenResponse,
  RegisterVerifyDto,
  VerifyResetOtpDto
} from "./auth.dto";
import User, { IUser } from "../../models/User";
import redisClient from "../../configs/redis";
import { sendEmail } from '../../utils/email.service';

export class AuthService {
  private authRepository: AuthRepository;
  private jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'access_secret_key_123';
  private jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_456';

  constructor() {
    this.authRepository = new AuthRepository();
  }

  // Ánh xạ từ DB User sang định dạng phản hồi sạch
  private mapToUserResponse(user: IUser): UserResponse {
    return {
      id: (user._id as any).toString(),
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  // ====================================================
  // 1. LUỒNG ĐĂNG KÝ XÁC THỰC OTP GMAIL (2 BƯỚC)
  // ====================================================

  // Bước 1: Validate thông tin, sinh OTP và lưu tạm vào Redis
  async registerRequest(dto: RegisterDto): Promise<void> {
    const { username, email, password } = dto;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // Kiểm tra trùng lặp email/username trong DB thực tế
    const emailExists = await this.authRepository.findByEmail(normalizedEmail);
    if (emailExists) throw new Error('Email này đã được sử dụng đăng ký tài khoản');

    const usernameExists = await this.authRepository.findByUsername(normalizedUsername);
    if (usernameExists) {
      throw new Error('Tên đăng nhập này đã tồn tại trên hệ thống');
    }

    // Sinh mã OTP 6 chữ số
    const otpCode = (100000 + Math.floor(Math.random() * 900000)).toString();

    // Mã hóa mật khẩu trước khi lưu tạm vào Redis
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Lưu thông tin đăng ký nháp vào Redis (Hết hạn sau 5 phút = 300 giây)
    const redisKey = `temp_register:${normalizedEmail}`;
    const tempData = {
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      otp: otpCode
    };
    
    await redisClient.set(redisKey, JSON.stringify(tempData), { EX: 300 });

    // Gửi email OTP xác nhận
    await sendEmail(normalizedEmail, otpCode, 'register');
  }

  // Bước 2: Xác nhận mã OTP để lưu tài khoản vào MongoDB
  async registerVerify(dto: RegisterVerifyDto): Promise<UserResponse> {
    const { email, otp } = dto;
    const normalizedEmail = email.toLowerCase().trim();
    const redisKey = `temp_register:${normalizedEmail}`;

    // Lấy thông tin đăng ký nháp từ Redis
    const rawData = await redisClient.get(redisKey);
    if (!rawData) {
      throw new Error('Mã xác thực OTP đã hết hạn hoặc không tồn tại. Vui lòng đăng ký lại.');
    }

    const tempData = JSON.parse(rawData);

    // Kiểm tra khớp mã OTP
    if (tempData.otp !== otp) {
      throw new Error('Mã xác thực OTP không chính xác');
    }

    // Tạo user chính thức vào Database
    const createUser = await User.create({
      username: tempData.username,
      email: tempData.email,
      password: tempData.password // Đã được hash ở bước 1
    });

    // Xóa dữ liệu tạm trong Redis
    await redisClient.del(redisKey);

    return this.mapToUserResponse(createUser);
  }

  // ====================================================
  // 2. LUỒNG ĐĂNG NHẬP / ĐĂNG XUẤT / REFRESH TOKEN
  // ====================================================

  async login(dto: LoginDto): Promise<LoginResponse> {
    const { email, password } = dto;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.authRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new Error('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) throw new Error('Email hoặc mật khẩu không chính xác');

    const userId = (user._id as any).toString();

    const accessToken = jwt.sign(
      { id: userId, username: user.username, email: user.email },
      this.jwtAccessSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      this.jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    const redisKey = `refresh_token:${userId}`;
    await redisClient.set(redisKey, refreshToken, {
      EX: 7 * 24 * 60 * 60 // 7 ngày
    });

    return {
      accessToken,
      refreshToken,
      user: this.mapToUserResponse(user),
    };
  }

  async refreshToken(tokenDto: { refreshToken: string }): Promise<RefreshTokenResponse> {
    const { refreshToken } = tokenDto;
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as { id: string };
      const userId = decoded.id;
      
      const redisKey = `refresh_token:${userId}`;
      const savedRefreshToken = await redisClient.get(redisKey);
      if (!savedRefreshToken || savedRefreshToken !== refreshToken) {
        throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
      }
      
      const user = await User.findById(userId);
      if (!user) throw new Error('Không tìm thấy người dùng');
      
      const newAccessToken = jwt.sign(
        { id: userId, username: user.username, email: user.email },
        this.jwtAccessSecret,
        { expiresIn: '15m' }
      );
      const newRefreshToken = jwt.sign(
        { id: userId },
        this.jwtRefreshSecret,
        { expiresIn: '7d' }
      );
      
      await redisClient.set(redisKey, newRefreshToken, {
        EX: 7 * 24 * 60 * 60
      });
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error: any) {
      throw new Error('RefreshToken không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  async logout(userId: string): Promise<void> {
    const redisKey = `refresh_token:${userId}`;
    await redisClient.del(redisKey);
  }

  // ====================================================
  // 3. LUỒNG QUÊN MẬT KHẨU XÁC THỰC OTP (3 BƯỚC)
  // ====================================================

  // Bước 1: Yêu cầu khôi phục, gửi mã OTP 6 số về Gmail
  async forgotPassword(forgotDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotDto;
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await this.authRepository.findByEmail(normalizedEmail);
    if (!user) throw new Error('Không tìm thấy tài khoản liên kết với email này');
    
    const otpCode = (100000 + Math.floor(Math.random() * 900000)).toString();
    
    const redisKey = `reset_otp:${normalizedEmail}`;
    await redisClient.set(redisKey, otpCode, { EX: 300 }); // Hết hạn trong 5 phút

    await sendEmail(normalizedEmail, otpCode, 'forgotpassword');
  }

  // Bước 2: Xác nhận mã OTP và cấp Reset Token tạm thời
  async verifyResetOtp(dto: VerifyResetOtpDto): Promise<string> {
    const { email, otp } = dto;
    const normalizedEmail = email.toLowerCase().trim();

    const otpKey = `reset_otp:${normalizedEmail}`;
    const savedOtp = await redisClient.get(otpKey);

    if (!savedOtp) {
      throw new Error('Mã OTP khôi phục đã hết hạn hoặc không tồn tại. Vui lòng gửi lại yêu cầu.');
    }

    if (savedOtp !== otp) {
      throw new Error('Mã xác thực OTP không chính xác');
    }

    // Xóa mã OTP
    await redisClient.del(otpKey);

    // Tạo Reset Token tạm thời
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Lưu Token vào Redis map với email (Hết hạn sau 10 phút)
    const tokenKey = `reset_verified_token:${resetToken}`;
    await redisClient.set(tokenKey, normalizedEmail, { EX: 600 });

    return resetToken;
  }

  // Bước 3: Đặt lại mật khẩu mới bằng Reset Token
  async resetPassword(resetDto: ResetPasswordDto): Promise<void> {
    const { resetToken, newPassword, confirmPassword } = resetDto;
    if (newPassword !== confirmPassword) throw new Error('Mật khẩu không khớp');

    const tokenKey = `reset_verified_token:${resetToken}`;
    const email = await redisClient.get(tokenKey);
    if (!email) throw new Error('Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.');

    const isUpdated = await this.authRepository.updatePassword(email, newPassword);
    if (!isUpdated) throw new Error('Cập nhật mật khẩu mới thất bại.');

    await redisClient.del(tokenKey);
  }
}