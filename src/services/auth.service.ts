import { Collection, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserInput, AuthResponse } from '../models/user.model.js';

export class AuthService {
  private usersCollection: Collection<User>;

  constructor(db: Db) {
    this.usersCollection = db.collection<User>('users');
  }

  async register(userInput: UserInput): Promise<AuthResponse> {
    const { username, email, password, uploadIp } = userInput;

    // 检查用户名是否已存在
    const existingUser = await this.usersCollection.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建新用户
    const newUser: Omit<User, '_id'> = {
      username,
      email,
      password: hashedPassword,
      role: 'user',
      uploadIp,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.usersCollection.insertOne(newUser as User);
    const user = await this.usersCollection.findOne({ _id: result.insertedId });

    if (!user) {
      throw new Error('Failed to create user');
    }

    // 生成JWT token
    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    };
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    // 首先检查是否是管理员登录
    if (username === process.env.ADMIN_USERNAME) {
      if (password === process.env.ADMIN_PASSWORD) {
        // 检查管理员用户是否已存在
        let adminUser = await this.usersCollection.findOne({ username });
        
        if (!adminUser) {
          // 创建管理员用户
          const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD as string, 10);
          const newAdmin: Omit<User, '_id'> = {
            username: process.env.ADMIN_USERNAME as string,
            email: 'admin@system.local',
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const result = await this.usersCollection.insertOne(newAdmin as User);
          adminUser = await this.usersCollection.findOne({ _id: result.insertedId });
        }

        if (!adminUser) {
          throw new Error('Failed to create admin user');
        }

        const token = jwt.sign(
          { id: adminUser._id.toString(), username: adminUser.username, role: adminUser.role },
          process.env.JWT_SECRET as string,
          { expiresIn: '7d' }
        );

        return {
          user: {
            id: adminUser._id.toString(),
            username: adminUser.username,
            email: adminUser.email,
            role: adminUser.role
          },
          token
        };
      } else {
        throw new Error('Invalid credentials');
      }
    }

    // 普通用户登录
    const user = await this.usersCollection.findOne({ username });
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    };
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.usersCollection.findOne({ _id: new ObjectId(id) });
  }
}