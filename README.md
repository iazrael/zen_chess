<div align="center">
  <h1>Zen Xiangqi (中国象棋)</h1>
  <p>一个精美设计的中国象棋网页应用，支持与AI对弈</p>
</div>

## 简介

Zen Xiangqi 是一个功能完整的中国象棋（Xiangqi）网页应用，具有禅意美学设计和流畅动画。它支持多种AI对手，包括传统的Minimax算法和基于大语言模型的Gemini/OpenAI对手。

## 功能特性

- 🎯 **完整中国象棋规则实现** - 遵循标准象棋规则，包括将军、将死判定
- 🤖 **多种AI对手** - 支持传统Minimax算法、Gemini和OpenAI模型
- 🎨 **精美UI设计** - 禅意风格界面，流畅动画效果
- ⏱️ **游戏计时** - 支持计时功能（10分钟或20分钟）
- 🔊 **音效系统** - 移动、吃子、胜利等音效反馈
- 📱 **响应式设计** - 适配桌面和移动设备
- 🎉 **胜利动画** - 胜利时的彩色纸屑效果

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **UI动画**: Framer Motion
- **图标库**: Lucide React
- **AI集成**: Google Gemini API, OpenAI API
- **样式**: Tailwind CSS

## 运行方式

### 本地运行

**前置要求:** Node.js

1. 安装依赖:
   ```bash
   npm install
   ```

2. 配置环境变量:
   - 创建 `.env.local` 文件
   - 设置 `GEMINI_API_KEY` 以使用Gemini AI
   - 设置 `OPENAI_API_KEY` 以使用OpenAI AI

3. 启动开发服务器:
   ```bash
   npm run dev
   ```

4. 在浏览器中访问 `http://localhost:3000`

### 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 游戏模式

- **双人对弈**: 两名玩家在同一设备上轮流下棋
- **挑战AI**: 与AI对弈，可选择不同难度的AI对手
  - Minimax算法（传统AI）
  - Gemini Flash/Pro（Google AI）
  - OpenAI（GPT模型）

## 项目结构

```
├── api/           # AI服务API接口
├── components/    # React组件（棋盘、棋子、计时器等）
├── services/      # AI服务封装
├── utils/         # 工具函数（规则、音效、算法等）
├── App.tsx        # 主应用组件
├── constants.ts   # 游戏常量定义
├── types.ts       # TypeScript类型定义
└── ...
```

## 开发说明

- 棋盘使用9x10格标准中国象棋布局
- 支持悔棋功能（Ctrl+Z）
- 支持音量控制
- 支持无限时和定时模式切换

## 部署

项目支持多种部署方式：
- GitHub Pages（通过GitHub Actions自动部署）
- Vercel（通过vercel.json配置）
- 任何支持静态文件托管的服务
