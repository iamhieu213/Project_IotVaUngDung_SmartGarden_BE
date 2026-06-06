import bcrypt from 'bcryptjs';
import { AuthRepository } from "./auth.repository";
import { RegisterDto, UserResponse, LoginDto, LoginResponse, ForgotPasswordDto, ResetPasswordDto, RefreshTokenDto, RefreshTokenResponse } from "./auth.dto";
import User, { IUser } from "../models/User";
import redisClient from "../configs/redis";
import jwt from 'jsonwebtoken'
import crypto from 'crypto';

export class AuthService {
    private authRepository: AuthRepository;
    private jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'access_secret_key_123';
    private jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_456';
    constructor() {
        this.authRepository = new AuthRepository;
    }

    //Anh xa tu ISER sang UserResponse Dto sach
    private mapToUserResponse(user: IUser): UserResponse {
        return {
            id: (user._id as any).toString(),
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
        };
    }

    //1.Api dang ky
    async register(dto: RegisterDto): Promise<UserResponse> {
        const { username, email } = dto;
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();

        const emailExists = await this.authRepository.findByEmail(normalizedEmail);
        if (emailExists) throw new Error('Email này đã được sử dụng đăng ký tài khoản');

        const usernameExists = await this.authRepository.findByUsername(normalizedUsername);
        if (usernameExists) {
            throw new Error('Tên đăng nhập này đã tồn tại trên hệ thống');
        }

        const createUser = await this.authRepository.createUser({
            ...dto,
            email: normalizedEmail,
            username: normalizedUsername
        });

        return this.mapToUserResponse(createUser);
    }

    //2.Api dang nhap
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
            EX: 7 * 24 * 60 * 60 // 7 days in seconds
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
            // 1. Giải mã và kiểm tra tính hợp lệ của RefreshToken gửi lên
            const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as { id: string };
            const userId = decoded.id;
            // 2. Kiểm tra xem RefreshToken có khớp với Token đang lưu trong Redis không
            const redisKey = `refresh_token:${userId}`;
            const savedRefreshToken = await redisClient.get(redisKey);
            if (!savedRefreshToken || savedRefreshToken !== refreshToken) {
                throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
            }
            // 3. Tìm thông tin User trong DB để sinh Token mới
            const user = await User.findById(userId); // Hoặc viết một hàm findById ở AuthRepository
            if (!user) throw new Error('Không tìm thấy người dùng');
            // 4. Tạo cặp AccessToken mới (15 phút) và RefreshToken mới (7 ngày)
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
            // 5. Cập nhật RefreshToken mới vào Redis (Xóa cái cũ, đè cái mới)
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

    //Api dang xuat
    async logout(userId: string): Promise<void> {
        const redisKey = `refresh_token:${userId}`;
        await redisClient.del(redisKey);
    }

    // --- LOGIC QUÊN MẬT KHẨU (Giữ nguyên) ---
    async forgotPassword(forgotDto: ForgotPasswordDto): Promise<string> {
        const { email } = forgotDto;
        const normalizedEmail = email.toLowerCase().trim();
        const user = await this.authRepository.findByEmail(normalizedEmail);
        if (!user) throw new Error('Không tìm thấy tài khoản liên kết');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const redisKey = `reset_token:${resetToken}`;
        await redisClient.set(redisKey, normalizedEmail, { EX: 600 }); // 10 phút
        return resetToken;
    }
    // --- LOGIC ĐẶT LẠI MẬT KHẨU MỚI (Giữ nguyên) ---
    async resetPassword(resetDto: ResetPasswordDto): Promise<void> {
        const { token, newPassword, confirmPassword } = resetDto;
        if (newPassword !== confirmPassword) throw new Error('Mật khẩu không khớp');
        const redisKey = `reset_token:${token}`;
        const email = await redisClient.get(redisKey);
        if (!email) throw new Error('Mã xác thực không hợp lệ hoặc đã hết hạn');
        const normalizedEmail = email.toLowerCase().trim();
        const isUpdated = await this.authRepository.updatePassword(normalizedEmail, newPassword);
        if (!isUpdated) throw new Error('Cập nhật thất bại');
        await redisClient.del(redisKey);
    }
}