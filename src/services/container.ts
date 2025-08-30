import { Db } from 'mongodb';
import { getDatabase } from '../db.js';
import { AuthService } from './auth.service.js';
import { FileService } from './file.service.js';
import { UploadService } from './upload.service.js';
import { FileStorageService } from './file-storage.service.js';

// 服务统一启动容器

export class ServiceContainer {
  private static instance: ServiceContainer;
  private db: Db | null = null;
  private authService: AuthService | null = null;
  private fileService: FileService | null = null;
  private uploadService: UploadService | null = null;
  private fileStorageService: FileStorageService | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.db = getDatabase();
      this.authService = new AuthService(this.db);
      this.fileService = new FileService(this.db);
      this.fileStorageService = new FileStorageService();
      this.uploadService = new UploadService(this.fileService);
      this.initialized = true;
      console.log('Service container initialized successfully');
    } catch (error) {
      console.error('Failed to initialize service container:', error);
      throw error;
    }
  }

  getAuthService(): AuthService {
    if (!this.initialized || !this.authService) {
      throw new Error('Service container not initialized. Call initialize() first.');
    }
    return this.authService;
  }

  getFileService(): FileService {
    if (!this.initialized || !this.fileService) {
      throw new Error('Service container not initialized. Call initialize() first.');
    }
    return this.fileService;
  }

  getUploadService(): UploadService {
    if (!this.initialized || !this.uploadService) {
      throw new Error('Service container not initialized. Call initialize() first.');
    }
    return this.uploadService;
  }

  getFileStorageService(): FileStorageService {
    if (!this.initialized || !this.fileStorageService) {
      throw new Error('Service container not initialized. Call initialize() first.');
    }
    return this.fileStorageService;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// 导出单例实例
export const container = ServiceContainer.getInstance();