import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { UserInput, LoginInput } from '../models/user.model.js';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  register = async (req: Request, res: Response) => {
    try {
      const userInput: UserInput = req.body;

      if (!userInput.username || !userInput.email || !userInput.password) {
        return res.status(400).json({
          message: 'Username, email, and password are required'
        });
      }

      if (userInput.password.length < 6) {
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

      const result = await this.authService.register(userData);
      res.status(201).json({
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return res.status(409).json({ message: error.message });
        }
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const loginInput: LoginInput = req.body;

      if (!loginInput.username || !loginInput.password) {
        return res.status(400).json({
          message: 'Username and password are required'
        });
      }

      const result = await this.authService.login(loginInput.username, loginInput.password);
      res.json({
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid credentials') || error.message.includes('User not found')) {
          return res.status(401).json({ message: 'Invalid username or password' });
        }
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  getProfile = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const user = await this.authService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

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
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}