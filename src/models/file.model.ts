import { ObjectId } from 'mongodb';

/**
 * 文件模型接口
 * 定义上传文件在数据库中的基础结构
 */
export interface FileModel {
  _id?: ObjectId;
  shortCode: string;          // 六位短码（大写字母+数字）
  originalName: string;        // 原始文件名
  mimeType: string;           // MIME类型
  size: number;               // 文件大小（字节）
  filename: string;           // 存储后的文件名
  uploaderId?: ObjectId;      // 上传者ID（关联用户）
  uploadIp: string;           // 上传者IP地址
  status: FileStatus;         // 文件状态
  categories: string[];       // 文件分类（前端提供）
  tags?: string[];            // 文件标签
  description?: string;        // 文件描述
  uploadedAt: Date;           // 上传时间
  updatedAt: Date;            // 更新时间
  // 链接相关字段
  isLink?: boolean;           // 是否为链接类型
  linkUrl?: string;           // 链接URL
  linkTitle?: string;         // 链接标题
  linkDescription?: string;   // 链接描述
  linkThumbnail?: string;     // 链接缩略图URL
  // 元数据处理状态
  metadataStatus?: MetadataStatus;  // 元数据处理状态
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
 * 元数据处理状态枚举
 */
export enum MetadataStatus {
  PENDING = 'pending',         // 等待处理
  PROCESSING = 'processing',   // 处理中
  COMPLETED = 'completed',     // 处理完成
  FAILED = 'failed'            // 处理失败
}

/**
 * 文件输入接口
 */
export interface FileInput {
  shortCode: string;          // 六位短码
  originalName: string;
  mimeType: string;
  size: number;
  filename: string;
  uploaderId?: ObjectId;
  uploadIp: string;
  categories: string[];       // 文件分类（前端提供）
  tags?: string[];
  description?: string;
  // 链接相关字段
  isLink?: boolean;
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkThumbnail?: string;
  // 元数据处理状态
  metadataStatus?: MetadataStatus;
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

/**
 * 链接上传输入接口
 */
export interface LinkUploadInput {
  url: string;                // 链接URL
  title?: string;             // 链接标题
  description?: string;        // 链接描述
  categories: string[];       // 分类
  tags?: string[];            // 标签
  uploaderId?: ObjectId;      // 上传者ID
  uploadIp: string;           // 上传者IP
}

/**
 * 批量链接上传输入接口
 */
export interface BatchLinkUploadInput {
  links: LinkUploadInput[];
  categories?: string[];      // 全局分类（应用到所有链接）
  tags?: string[];            // 全局标签（应用到所有链接）
}
