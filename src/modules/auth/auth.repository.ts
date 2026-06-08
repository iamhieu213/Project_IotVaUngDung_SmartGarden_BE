import User, { IUser } from '../../models/User'
import { RegisterDto } from './auth.dto'

export class AuthRepository {
  //Tim kiem User thong qua Email
  async findByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  //Tim kiem User bang ten dang nhap
  async findByUsername(username: string): Promise<IUser | null> {
    return await User.findOne({ username });
  }

  //Luu tai khoan vao co so du lieu
  async createUser(userData : RegisterDto): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  } 

  //Cap nhat mat khau moi cua nguoi dung theo email
  async updatePassword(email: string, newPassword : string): Promise<boolean> {
    const user = await User.findOne({ email });
    if(!user) return false;
    user.password = newPassword;

    await user.save();

    return true;
  }

}