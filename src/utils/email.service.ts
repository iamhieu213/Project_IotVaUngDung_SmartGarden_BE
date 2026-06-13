import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
    },
});


export const sendEmail = async (toEmail: string, otpCode: string, type: 'register' | 'forgotpassword'): Promise<void> => {
    const subject = type === 'register'
        ? 'Mã OTP xác thực đăng ký tài khoản Smart Garden'
        : 'Mã OTP đặt lại mật khẩu Smart Garden';

    const title = type === 'register'
        ? 'XÁC THỰC ĐĂNG KÝ TÀI KHOẢN'
        : 'YÊU CẦU ĐẶT LẠI MẬT KHẨU';

    const bodyContent = type === 'register'
        ? 'Cảm ơn bạn đã đăng ký tài khoản Smart Garden. Vui lòng nhập mã OTP dưới đây để hoàn tất đăng ký (mã có hiệu lực trong 5 phút):'
        : 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu của bạn. Vui lòng sử dụng mã OTP dưới đây để tiến hành thiết lập mật khẩu mới (mã có hiệu lực trong 5 phút):';

    const mailOptions = {
        from: `"Smart Garden System" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: subject,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #f9f9f9;">
        <div style="text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 15px;">
          <h2 style="color: #4CAF50; margin: 0; letter-spacing: 1px;">SMART GARDEN SYSTEM</h2>
        </div>
        <div style="padding: 20px 0;">
          <h3 style="color: #333333; margin-top: 0;">Kính chào Quý khách,</h3>
          <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
            ${bodyContent}
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; padding: 12px 30px; background-color: #e8f5e9; border: 1px dashed #4CAF50; border-radius: 8px; display: inline-block;">
              ${otpCode}
            </span>
          </div>
          <p style="color: #ff5722; font-size: 13px; font-style: italic;">
            * Lưu ý: Không chia sẻ mã này cho bất kỳ ai để bảo vệ thông tin tài khoản của bạn. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
          </p>
        </div>
        <div style="border-top: 1px solid #e0e0e0; padding-top: 15px; text-align: center; font-size: 12px; color: #999999;">
          <p style="margin: 0 0 5px 0;">Hệ thống giám sát và quản lý nhà nấm thông minh Smart Garden</p>
          <p style="margin: 0;">© 2026 Smart Garden. All rights reserved.</p>
        </div>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);

}
