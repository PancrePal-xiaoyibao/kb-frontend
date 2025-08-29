# 文件上传功能重构说明

## 重构概述

本次重构将原有的单一上传中间件拆分为更清晰的模块化架构，提高了代码的可维护性和可扩展性。

## 重构后的架构

### 1. 模型层 (Models)
- **`src/models/file.model.ts`** - 文件数据模型
  - 定义了完整的文件数据结构
  - 包含文件状态枚举
  - 支持标签、描述等元数据

### 2. 中间件层 (Middlewares)
- **`src/middlewares/upload.middleware.ts`** - 文件上传中间件
  - 支持可配置的文件大小、类型限制
  - 提供单文件、多文件上传支持
  - 包含完整的错误处理机制

### 3. 服务层 (Services)
- **`src/services/file.service.ts`** - 文件管理服务
  - 处理文件的CRUD操作
  - 支持分页查询和条件筛选
  - 提供软删除和硬删除功能
  - 支持批量操作和统计功能

- **`src/services/upload.service.ts`** - 文件上传服务
  - 处理文件上传的业务逻辑
  - 自动提取文件标签
  - 生成文件描述信息
  - 支持IP地址获取

### 4. 控制器层 (Controllers)
- **`src/controllers/file.controller.ts`** - 文件控制器
  - 统一的HTTP响应格式
  - 完整的错误处理
  - 支持RESTful API设计

### 5. 容器服务 (Container)
- **`src/services/container.ts`** - 服务容器
  - 统一管理所有服务实例
  - 支持依赖注入
  - 单例模式确保服务唯一性

## 主要特性

### 文件上传
- 支持单文件和多文件上传
- 可配置的文件大小限制
- 支持多种文件类型
- 自动生成唯一文件名
- 完整的错误处理

### 文件管理
- 文件元数据存储
- 支持标签和描述
- 文件状态管理
- 分页查询支持
- 批量操作支持

### 安全性
- 文件类型验证
- 文件大小限制
- IP地址记录
- 用户权限控制

## API 接口

### 文件上传
```
POST /api/v1/file/upload/single    - 单文件上传
POST /api/v1/file/upload/multiple  - 多文件上传
```

### 文件管理
```
GET    /api/v1/file              - 获取文件列表
GET    /api/v1/file/:id          - 获取文件详情
GET    /api/v1/file/stats        - 获取文件统计
PUT    /api/v1/file/:id          - 更新文件信息
DELETE /api/v1/file/:id          - 删除文件
POST   /api/v1/file/batch/status - 批量更新状态
```

## 配置选项

### 上传配置
```typescript
interface UploadConfig {
  maxFileSize: number;        // 最大文件大小（字节）
  allowedMimeTypes: string[]; // 允许的MIME类型
  maxFiles: number;           // 最大文件数量
}
```

### 默认配置
- 最大文件大小: 10MB
- 支持的文件类型: 图片、PDF、文档等
- 最大文件数量: 5个

## 使用示例

### 创建自定义上传中间件
```typescript
import { createUploadMiddleware } from './upload.middleware';

const customUpload = createUploadMiddleware({
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['image/*'],
  maxFiles: 10
});
```

### 使用文件服务
```typescript
import { container } from './container';

const fileService = container.getFileService();
const files = await fileService.findFiles({
  page: 1,
  limit: 20,
  status: FileStatus.ACTIVE
});
```

## 数据库集合

### files 集合结构
```typescript
interface FileModel {
  _id: ObjectId;
  originalName: string;        // 原始文件名
  mimeType: string;           // MIME类型
  size: number;               // 文件大小
  filename: string;           // 存储文件名
  filepath: string;           // 文件路径
  uploaderId?: ObjectId;      // 上传者ID
  uploadIp: string;           // 上传IP
  status: FileStatus;         // 文件状态
  tags?: string[];            // 文件标签
  description?: string;        // 文件描述
  uploadedAt: Date;           // 上传时间
  updatedAt: Date;            // 更新时间
}
```

## 迁移说明

### 从旧版本迁移
1. 更新导入路径
2. 使用新的控制器方法
3. 配置新的中间件
4. 更新数据库集合名称（从 `file` 到 `files`）

### 注意事项
- 旧的上传中间件已被删除
- 文件集合名称从 `file` 改为 `files`
- 新增了文件状态管理
- 支持软删除功能

## 未来扩展

### 计划功能
- 文件预览功能
- 文件版本管理
- 文件分享功能
- 云存储支持
- 文件压缩和优化

### 技术改进
- 异步文件处理
- 文件上传进度
- 断点续传支持
- 文件去重功能
