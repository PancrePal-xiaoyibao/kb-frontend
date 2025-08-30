import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { UserInput, LoginInput } from '../models/user.model.js';
import { createLogger } from '../utils/logger.js';

// 创建认证控制器日志器
const logger = createLogger('AuthController');

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  register = async (req: Request, res: Response) => {
    try {
      const userInput: UserInput = req.body;
      logger.info('收到用户注册请求', { 
        username: userInput.username, 
        email: userInput.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      if (!userInput.username || !userInput.email || !userInput.password) {
        logger.warn('注册请求缺少必要字段', { 
          hasUsername: !!userInput.username, 
          hasEmail: !!userInput.email, 
          hasPassword: !!userInput.password 
        });
        return res.status(400).json({
          message: 'Username, email, and password are required'
        });
      }

      if (userInput.password.length < 6) {
        logger.warn('密码长度不符合要求', { 
          username: userInput.username, 
          passwordLength: userInput.password.length 
        });
        return res.status(400).json({
          message: 'Password must be at least 6 characters long'
        });
      }

      // 获取真实IP地址
      const forwarded = req.headers['x-forwarded-for'];
      const uploadIp = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.ip || '');
      
      const userData: UserInput = {
        ...userInput,
        uploadIp
      };

      logger.dev('开始处理用户注册', { username: userInput.username, uploadIp });
      const result = await this.authService.register(userData);
      
      logger.info('用户注册成功', { 
        userId: result.user.id, 
        username: result.user.username,
        role: result.user.role
      });
      
      res.status(201).json({
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          const userInput = req.body;
          logger.warn('用户注册失败：用户名或邮箱已存在', { 
            username: userInput?.username, 
            email: userInput?.email 
          });
          return res.status(409).json({ message: error.message });
        }
      }
      logger.errorWithStack('用户注册时发生内部错误', error as Error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const loginInput: LoginInput = req.body;
      logger.info('收到用户登录请求', { 
        username: loginInput.username, 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      if (!loginInput.username || !loginInput.password) {
        logger.warn('登录请求缺少必要字段', { 
          hasUsername: !!loginInput.username, 
          hasPassword: !!loginInput.password 
        });
        return res.status(400).json({
          message: 'Username and password are required'
        });
      }

      logger.dev('开始验证用户凭据', { username: loginInput.username });
      const result = await this.authService.login(loginInput.username, loginInput.password);
      
      logger.info('用户登录成功', { 
        userId: result.user.id, 
        username: result.user.username,
        role: result.user.role
      });
      
      res.json({
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid credentials') || error.message.includes('User not found')) {
          const loginInput = req.body;
          logger.warn('用户登录失败：凭据无效', { 
            username: loginInput?.username,
            ip: req.ip
          });
          return res.status(401).json({ message: 'Invalid username or password' });
        }
      }
      logger.errorWithStack('用户登录时发生内部错误', error as Error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  getProfile = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        logger.warn('获取用户资料失败：用户未认证');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      logger.dev('获取用户资料', { userId });
      const user = await this.authService.getUserById(userId);
      if (!user) {
        logger.warn('用户资料不存在', { userId });
        return res.status(404).json({ message: 'User not found' });
      }

      logger.info('成功获取用户资料', { 
        userId: user._id?.toString(), 
        username: user.username,
        role: user.role
      });

      res.json({
        user: {
          id: user._id?.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      logger.errorWithStack('获取用户资料时发生内部错误', error as Error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}