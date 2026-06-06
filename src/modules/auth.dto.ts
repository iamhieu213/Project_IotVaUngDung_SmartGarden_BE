export interface RegisterDto {
    username : string;
    email: string;
    password: string;
}

export interface UserResponse {
    id: string;
    username: string;
    email : string;
    createdAt : Date;
}

export interface LoginDto {
    email : string;
    password: string;
}

// DTO phản hồi khi Đăng nhập thành công (Trả về cả 2 token)
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}
// DTO đầu vào cho API làm mới token
export interface RefreshTokenDto {
  refreshToken: string;
}
// DTO phản hồi từ API làm mới token
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordDto {
    email : string;
}

export interface ResetPasswordDto {
    token : string;
    newPassword: string;
    confirmPassword: string;
}

