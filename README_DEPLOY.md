# Zen Chess - Vercel 部署指南

## 项目简介

Zen Chess 是一个基于 React 的中国象棋应用，集成了 AI 对战功能。为了提高 API 密钥的安全性，我们将 LLM API 调用从前端迁移到了服务端。

## 安全改进

- **前端直接调用（原实现）**：API 密钥暴露在客户端，存在被恶意抓取的风险
- **服务端实现（新架构）**：
  - API 密钥仅存储在服务端环境变量中
  - 前端通过安全的 API 接口与服务端通信
  - 所有 LLM API 调用都在服务端完成

## 项目结构

```
zen_chess/
├── api/                # 服务端 API 路由
│   ├── gemini.ts       # Gemini API 服务端调用
│   └── openai.ts       # OpenAI API 服务端调用
├── services/           # 客户端服务
│   ├── geminiService.ts  # 调用 /api/gemini
│   └── openaiService.ts  # 调用 /api/openai
├── vercel.json         # Vercel 配置文件
└── package.json        # 项目依赖
```

## 部署步骤

### 1. 准备工作

- 确保已安装 Node.js 18.x 或更高版本
- 注册或登录 Vercel 账户
- 将项目代码推送到 GitHub 仓库

### 2. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

| 环境变量名 | 说明 | 示例值 |
|------------|------|--------|
| API_KEY | Google Gemini API 密钥 | `AIzaSy...` |
| OPENAI_API_KEY | OpenAI API 密钥 | `sk-...` |
| OPENAI_BASE_URL | OpenAI API 基础 URL（可选） | `https://api.openai.com/v1` |
| OPENAI_MODEL | 默认使用的 OpenAI 模型（可选） | `gpt-4o-mini` |

### 3. 部署到 Vercel

#### 方法一：通过 Vercel CLI 部署

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login

# 部署项目
vercel deploy
```

#### 方法二：通过 GitHub 集成部署

1. 在 Vercel 控制台创建新项目
2. 选择 GitHub 仓库
3. 配置项目设置（环境变量等）
4. 点击 "Deploy" 按钮

### 4. 配置自动部署

当代码推送到 GitHub 仓库时，Vercel 会自动触发部署。

## API 路由说明

### Gemini API

- **路径**：`/api/gemini`
- **方法**：`POST`
- **请求体**：
  ```json
  {
    "board": BoardState,
    "turn": "red" | "black",
    "modelName": "gemini-pro" | "gemini-flash"
  }
  ```
- **响应**：
  ```json
  {
    "from": { "x": number, "y": number },
    "to": { "x": number, "y": number },
    "reason": string
  }
  ```

### OpenAI API

- **路径**：`/api/openai`
- **方法**：`POST`
- **请求体**：
  ```json
  {
    "board": BoardState,
    "turn": "red" | "black",
    "modelName": "gpt-4o-mini" | "gpt-4o" | "gpt-3.5-turbo"
  }
  ```
- **响应**：
  ```json
  {
    "from": { "x": number, "y": number },
    "to": { "x": number, "y": number },
    "reason": string
  }
  ```

## 本地开发

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env` 文件：

```env
API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### 运行开发服务器

```bash
npm run dev
```

### 测试 API 端点

使用 Postman 或类似工具测试 `/api/gemini` 和 `/api/openai` 端点。

## 注意事项

1. **API 密钥安全**：
   - 永远不要将 API 密钥硬编码到代码中
   - 不要将 `.env` 文件提交到版本控制系统
   - 使用 Vercel 的环境变量管理功能

2. **速率限制**：
   - 注意 LLM API 的速率限制
   - 考虑在服务端添加请求限流

3. **错误处理**：
   - 客户端应妥善处理 API 调用失败的情况
   - 服务端实现了适当的错误处理和回退机制

## 技术栈

- **前端**：React + TypeScript + Vite
- **服务端**：Node.js + Vercel Serverless Functions
- **部署**：Vercel
- **AI 模型**：Google Gemini, OpenAI GPT

## 故障排除

### 部署失败

- 检查环境变量是否正确配置
- 查看 Vercel 部署日志中的错误信息
- 确保 Node.js 版本符合要求（18.x 或更高）

### API 调用失败

- 检查 API 密钥是否有效
- 确认 API 服务是否正常运行
- 查看 Vercel 日志中的详细错误信息

### 前端显示错误

- 打开浏览器开发者工具查看控制台错误
- 检查网络请求是否成功
- 确认 API 端点 URL 是否正确

---

如有任何问题，请参考 Vercel 官方文档或联系项目维护者。
