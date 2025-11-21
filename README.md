# Zen Chess - 中国象棋AI对弈平台

一个基于React和AI的中国象棋游戏，支持多种AI服务提供商。

## 功能特性

- 完整的中国象棋规则实现
- 支持多种AI服务提供商：
  - OpenAI (GPT系列)
  - Google Gemini
  - DeepSeek
  - 阿里云千问(Qwen)
- 传统Minimax算法AI
- 双人对弈模式
- 游戏计时器
- 悔棋功能
- 胜负判定

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

## 使用说明

1. 启动游戏后，选择"挑战 AI"模式
2. 在AI控制台中选择AI模型（OpenAI）
3. 在AI提供商中选择想要使用的AI服务
4. 开始对弈！

## API端点

- POST `/api/openai` - AI走子决策接口，支持通过provider参数指定AI服务提供商

## 支持的AI提供商

| 提供商 | provider值 | 环境变量前缀 |
|--------|------------|-------------|
| OpenAI | openai | OPENAI_ |
| Google Gemini | gemini | GEMINI_ |
| DeepSeek | deepseek | DEEPSEEK_ |
| 阿里云千问 | qianwen | QIANWEN_ |