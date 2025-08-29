import { ObjectId } from 'mongodb';

/**
 * 文件模型接口
 * 定义上传文件在数据库中的基础结构
 */
export interface FileModel {
  _id?: ObjectId;
  originalName: string;        // 原始文件名
  mimeType: string;           // MIME类型
  size: number;               // 文件大小（字节）
  filename: string;           // 存储后的文件名
  filepath: string;           // 文件存储路径
  uploaderId?: ObjectId;      // 上传者ID（关联用户）
  uploadIp: string;           // 上传者IP地址
  status: FileStatus;         // 文件状态
  categories: string[];       // 文件分类（前端提供）
  tags?: string[];            // 文件标签
  description?: string;        // 文件描述
  uploadedAt: Date;           // 上传时间
  updatedAt: Date;            // 更新时间
}

/**
 * 文件状态枚举
 */
export enum FileStatus {
  ACTIVE = 'active',           // 正常
  DELETED = 'deleted',         // 已删除
  PROCESSING = 'processing',   // 处理中
  ERROR = 'error'              // 错误
}

/**
 * 文件输入接口
 */
export interface FileInput {
  originalName: string;
  mimeType: string;
  size: number;
  filename: string;
  filepath: string;
  uploaderId?: ObjectId;
  uploadIp: string;
  categories: string[];       // 文件分类（前端提供）
  tags?: string[];
  description?: string;
}

/**
 * 文件查询接口
 */
export interface FileQuery {
  uploaderId?: ObjectId;
  status?: FileStatus;
  categories?: string[];      // 按分类筛选
  tags?: string[];
  mimeType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * 文件更新接口
 */
export interface FileUpdate {
  categories?: string[];      // 更新分类
  tags?: string[];
  description?: string;
  status?: FileStatus;
}
