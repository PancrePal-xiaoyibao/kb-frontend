import { Collection, Db, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserInput, AuthResponse } from '../models/user.model.js';
import { createLogger } from '../utils/logger.js';

// 创建认证服务日志器
const logger = createLogger('AuthService');

export class AuthService {
  private usersCollection: Collection<User>;

  constructor(db: Db) {
    this.usersCollection = db.collection<User>('users');
  }

  async register(userInput: UserInput): Promise<AuthResponse> {
    const { username, email, password, uploadIp } = userInput;
    
    logger.dev('开始用户注册流程', { username, email, uploadIp });

    // 检查用户名是否已存在
    const existingUser = await this.usersCollection.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      logger.warn('用户注册失败：用户名或邮箱已存在', { 
        username, 
        email, 
        existingUserId: existingUser._id?.toString() 
      });
      throw new Error('Username or email already exists');
    }

    // 加密密码
    logger.dev('加密用户密码');
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

    logger.dev('插入新用户到数据库');
    const result = await this.usersCollection.insertOne(newUser as User);
    const user = await this.usersCollection.findOne({ _id: result.insertedId });

    if (!user) {
      logger.error('用户创建失败：无法从数据库获取新创建的用户');
      throw new Error('Failed to create user');
    }

    // 生成JWT token
    logger.dev('生成JWT令牌', { userId: user._id.toString(), role: user.role });
    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    logger.info('用户注册成功', { 
      userId: user._id.toString(), 
      username: user.username,
      role: user.role,
      uploadIp
    });

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
    logger.dev('开始用户登录流程', { username });
    
    // 首先检查是否是管理员登录
    if (username === process.env.ADMIN_USERNAME) {
      logger.dev('检测到管理员登录尝试');
      if (password === process.env.ADMIN_PASSWORD) {
        // 检查管理员用户是否已存在
        let adminUser = await this.usersCollection.findOne({ username });
        
        if (!adminUser) {
          logger.info('创建新的管理员用户');
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
          logger.error('管理员用户创建失败');
          throw new Error('Failed to create admin user');
        }

        logger.dev('生成管理员JWT令牌');
        const token = jwt.sign(
          { id: adminUser._id.toString(), username: adminUser.username, role: adminUser.role },
          process.env.JWT_SECRET as string,
          { expiresIn: '7d' }
        );

        logger.info('管理员登录成功', { 
          userId: adminUser._id.toString(), 
          username: adminUser.username,
          role: adminUser.role
        });

        return {
          user: {
            id: adminUser._id.toString(),
            username: adminUser.username,
            email: adminUser.email,
            role: adminUser.role
          },
          token
        };
      }
    }

    // 普通用户登录
    logger.dev('查找用户记录', { username });
    const user = await this.usersCollection.findOne({ username });

    if (!user) {
      logger.warn('用户登录失败：用户不存在', { username });
      throw new Error('User not found');
    }

    logger.dev('验证用户密码');
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      logger.warn('用户登录失败：密码错误', { username });
      throw new Error('Invalid credentials');
    }

    // 生成JWT token
    logger.dev('生成用户JWT令牌', { userId: user._id.toString(), role: user.role });
    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    logger.info('用户登录成功', { 
      userId: user._id.toString(), 
      username: user.username,
      role: user.role
    });

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

  async getUserById(userId: string): Promise<User | null> {
    try {
      logger.dev('根据ID查找用户', { userId });
      const user = await this.usersCollection.findOne({ _id: new ObjectId(userId) });
      
      if (user) {
        logger.dev('用户查找成功', { userId, username: user.username });
      } else {
        logger.warn('用户不存在', { userId });
      }
      
      return user;
    } catch (error) {
      logger.errorWithStack('查找用户时发生错误', error as Error);
      return null;
    }
  }
}