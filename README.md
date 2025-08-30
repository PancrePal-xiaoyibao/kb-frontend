# KB Frontend

知识库文件上传和管理系统的前端服务

## 功能特性

- 文件上传和管理
- 链接上传和元数据提取
- 用户认证和授权
- 短链接生成
- 分类和标签管理
- 搜索功能

## 环境配置

复制 `.env.dev` 为 `.env` 并修改配置：

```bash
cp .env.dev .env
```

### 环境变量说明

#### 基础配置
- `PORT`: 服务端口号（默认：3000）
- `NODE_ENV`: 运行环境（development/production/test）
- `BASE_URL`: 服务基础URL（默认：http://localhost:3000）

#### 数据库配置
- `MONGODB_URI`: MongoDB连接字符串（默认：mongodb://127.0.0.1:27017/kb_local）

#### 认证配置
- `JWT_SECRET`: JWT签名密钥
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD`: 管理员密码

#### CORS配置
- `CORS_ORIGIN`: 允许的跨域来源，多个用逗号分隔（默认：*）

#### Open Graph服务配置
- `OG_SERVICE_URL`: 自定义Open Graph服务URL（可选，默认使用内置服务列表）

系统内置了多个Open Graph服务作为备用：
- `https://api.microlink.io?url=`
- `https://opengraph.xyz/api/v1/site-info?url=`

## 安装和运行

### 安装依赖
```bash
npm install
```

### 开发模式运行
```bash
npm run dev
```

### 生产模式运行
```bash
npm run build
npm start
```

### 运行测试
```bash
npm test
```

## API文档

### 文件上传
- `POST /api/files/upload` - 上传文件
- `GET /api/files/:shortCode` - 获取文件信息
- `GET /api/files` - 获取文件列表

### 链接上传
- `POST /api/links/upload` - 上传链接
- `POST /api/links/batch` - 批量上传链接
- `GET /api/links/search` - 搜索链接

### 用户认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/profile` - 获取用户信息

## 技术栈

- Node.js
- TypeScript
- Express.js
- MongoDB
- JWT认证
- Multer文件上传
- Jest测试框架

## 开发说明

### 链接元数据提取

系统支持通过多种Open Graph服务自动提取链接的元数据：

1. **标题提取**: 优先提取 `og:title`，其次提取 `<title>` 标签
2. **描述提取**: 优先提取 `og:description`，其次提取 `meta[name="description"]`
3. **缩略图提取**: 提取 `og:image`，自动处理相对URL转换为绝对URL

### 服务容错机制

- 支持多个备用服务，自动切换
- 请求超时保护（15秒）
- 错误日志记录，不影响上传流程
- 优雅降级，元数据提取失败时仍可正常上传

## 许可证

MIT License