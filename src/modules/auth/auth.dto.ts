export interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordDto {
  email: string;
}

// DTO Bước 2: Xác thực OTP quên mật khẩu (nhập email + OTP)
export interface VerifyResetOtpDto {
  email: string;
  otp: string;
}

// DTO Bước 3: Đặt mật khẩu mới (BỎ dấu ? ở hai trường mật khẩu để bắt buộc truyền dữ liệu)
export interface ResetPasswordDto {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

// DTO Xác thực OTP khi đăng ký tài khoản mới
export interface RegisterVerifyDto {
  email: string;
  otp: string;
}