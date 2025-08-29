# 知识库上传系统后端

基于Express.js和MongoDB构建的知识库文件上传系统后端服务。

## 🚀 项目启动

### 环境要求
- Node.js >= 18.0.0
- MongoDB >= 5.0
- npm 或 yarn

### 快速开始

1. **克隆项目**
   ```bash
   git clone https://github.com/PancrePal-xiaoyibao/kb-frontend.git
   cd kb-frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   复制 `.env.dev` 为 `.env` 并修改配置：
   ```bash
   cp .env.dev .env
   ```

4. **启动MongoDB**
   确保本地MongoDB服务已启动，或使用Docker：
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **启动开发服务器**
   ```bash
   npm run dev
   ```

   服务器将在 `http://localhost:3000` 启动

## 🔧 调试指南

### 开发模式
- 使用 `npm run dev` 启动，支持热重载
- 使用 `npm run build` 构建生产版本
- 使用 `npm start` 启动生产版本

### 测试API
使用项目根目录的 `user.http` 文件进行API测试：
- 安装REST Client插件（VS Code）
- 打开 `user.http` 文件
- 点击 "Send Request" 测试各个接口