# Zen Chess - 中国象棋AI对弈平台

一个基于React 19和AI的中国象棋游戏，支持多种AI服务提供商和传统Minimax算法。

## 功能特性

- 🎯 **完整中国象棋规则实现** - 支持所有棋子走法规则，包括将帅照面、蹩马腿、象眼等
- 🤖 **双AI模式支持** 
  - 传统Minimax算法 (V1/V2版本)
  - 大语言模型AI (LLM) - 支持多种提供商
- 🧠 **多AI提供商支持**
  - OpenAI (GPT系列)
  - Google Gemini
  - DeepSeek
  - 阿里云千问(Qwen)
- 👥 **双人对弈模式** - 本地PvP对战
- ⏱️ **游戏计时器** - 可配置对战时间
- 🔁 **悔棋功能** - 支持撤回上一步
- 🏆 **胜负判定** - 自动判断游戏结果
- 🎨 **精美UI设计** - 响应式布局，支持深色主题
- 🎵 **音效系统** - 走子、吃子等交互音效
- 📱 **移动端适配** - 支持手机和平板设备

## 技术栈

- **前端**: React 19, TypeScript, Vite, Framer Motion
- **后端**: Node.js, Express
- **AI算法**: Minimax (V1/V2), LLM集成
- **部署**: Vercel

## 环境变量配置

在项目根目录创建 `.env.local` 文件，并添加以下环境变量：

```bash
# OpenAI 配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_URL=https://api.openai.com/v1/chat/completions

# Gemini 配置
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-pro
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# DeepSeek 配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions

# 阿里云千问 配置
QIANWEN_API_KEY=your_qianwen_api_key
QIANWEN_MODEL=qwen-plus
QIANWEN_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
```

## 安装和运行

1. 安装依赖：
```bash
npm install
cd server && npm install
```

2. 配置环境变量（如上所示）

3. 启动开发服务器：
```bash
# 启动前端
npm run dev

# 启动后端API服务器（在另一个终端）
cd server && npm run dev
```

4. 构建生产版本：
```bash
# 构建前端
npm run build

# 构建后端API
npm run build:api

# 部署到Vercel
npm run deploy
```

## 使用说明

1. 启动游戏后，选择游戏模式：
   - "双人对弈" - 本地两人对战
   - "挑战 AI" - 与AI对战

2. AI模式设置：
   - 选择AI算法类型：传统算法或大语言模型
   - 传统算法可选择版本(V1/V2)和难度(3-5级)
   - 大语言模型可选择提供商(OpenAI/Gemini/DeepSeek/Qwen)

3. 游戏操作：
   - 点击棋子选择，再次点击合法位置移动
   - 可以悔棋和重置游戏
   - 查看游戏历史记录

## API端点

- POST `/api/openai` - AI走子决策接口，支持通过provider参数指定AI服务提供商
- GET `/api/providers` - 获取可用的AI提供商列表

## 支持的AI提供商

| 提供商 | provider值 | 环境变量前缀 |
|--------|------------|-------------|
| OpenAI | openai | OPENAI_ |
| Google Gemini | gemini | GEMINI_ |
| DeepSeek | deepseek | DEEPSEEK_ |
| 阿里云千问 | qianwen | QIANWEN_ |

## 项目结构

```
zen_chess/
├── api/                 # AI逻辑和规则实现
│   ├── common/          # 公共类型和配置
│   ├── chessRules.ts    # 中国象棋规则实现
│   ├── minimax.ts       # Minimax算法V1
│   ├── minimaxV2.ts     # Minimax算法V2（优化版）
│   ├── openai.ts        # LLM AI集成
│   └── providers.ts     # AI提供商列表
├── components/          # React UI组件
├── public/              # 静态资源
├── server/              # 后端API服务
├── services/            # 前端服务封装
├── utils/               # 工具函数
├── App.tsx             # 主应用组件
├── index.tsx           # 应用入口
└── vite.config.ts      # Vite配置
```

## 开发指南

### 添加新的AI提供商

1. 在 `api/common/config.ts` 中添加新的提供商配置
2. 在 `api/providers.ts` 中更新提供商列表接口
3. 更新环境变量配置
4. 在前端设置界面添加新的选项

### 扩展Minimax算法

- `api/minimax.ts` - 基础版本
- `api/minimaxV2.ts` - 优化版本（包含置换表、杀手走法、历史启发等）

### 部署到Vercel

```bash
npm run deploy
```

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送分支
5. 创建Pull Request

## 许可证

[MIT License](LICENSE)