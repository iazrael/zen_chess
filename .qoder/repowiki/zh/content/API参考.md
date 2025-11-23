# API参考

<cite>
**本文引用的文件**
- [api/openai.ts](file://api/openai.ts)
- [api/minimax.ts](file://api/minimax.ts)
- [api/providers.ts](file://api/providers.ts)
- [api/common/config.ts](file://api/common/config.ts)
- [api/common/types.ts](file://api/common/types.ts)
- [api/chessRules.ts](file://api/chessRules.ts)
- [services/openaiService.ts](file://services/openaiService.ts)
- [services/minimaxService.ts](file://services/minimaxService.ts)
- [services/minimaxWorker.ts](file://services/minimaxWorker.ts)
- [utils/env.ts](file://utils/env.ts)
- [server/index.ts](file://server/index.ts)
- [README.md](file://README.md)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件为后端REST API的完整参考，涵盖以下端点：
- POST /api/openai：基于LLM的AI走子决策，支持多提供商（OpenAI、Gemini、DeepSeek、Qwen），返回最佳走法及分析理由。
- POST /api/minimax：基于Minimax算法的AI走子决策，返回最佳走法。
- GET /api/providers：返回可用AI提供商列表及其可用性状态。

同时说明这些API在服务层如何被调用（openaiService.ts、minimaxService.ts），以及如何通过环境变量配置提供商、如何构建API URL等。

## 项目结构
后端API由Express服务器路由转发至Vercel风格的函数处理器，核心逻辑位于api/目录，服务层封装在services/目录，类型定义位于api/common/types.ts，环境变量工具位于utils/env.ts。

```mermaid
graph TB
subgraph "前端"
FE["React 应用"]
end
subgraph "后端服务器"
Srv["Express 服务器<br/>server/index.ts"]
OA["/api/openai 处理器<br/>api/openai.ts"]
MM["/api/minimax 处理器<br/>api/minimax.ts"]
PR["/api/providers 处理器<br/>api/providers.ts"]
end
subgraph "服务层"
SOA["openaiService.ts"]
SMM["minimaxService.ts"]
SW["minimaxWorker.ts"]
end
subgraph "通用模块"
CFG["AI提供商配置<br/>api/common/config.ts"]
TYP["类型定义<br/>api/common/types.ts"]
RUL["棋规与评估<br/>api/chessRules.ts"]
ENV["环境与URL构建<br/>utils/env.ts"]
end
FE --> Srv
Srv --> OA
Srv --> MM
Srv --> PR
SOA --> OA
SMM --> MM
SMM --> SW
OA --> CFG
OA --> RUL
MM --> RUL
PR --> CFG
SOA --> ENV
SMM --> ENV
```

图表来源
- [server/index.ts](file://server/index.ts#L22-L41)
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [api/minimax.ts](file://api/minimax.ts#L1-L125)
- [api/providers.ts](file://api/providers.ts#L1-L41)
- [services/openaiService.ts](file://services/openaiService.ts#L1-L37)
- [services/minimaxService.ts](file://services/minimaxService.ts#L1-L66)
- [services/minimaxWorker.ts](file://services/minimaxWorker.ts#L1-L19)
- [api/common/config.ts](file://api/common/config.ts#L1-L49)
- [api/common/types.ts](file://api/common/types.ts#L1-L68)
- [api/chessRules.ts](file://api/chessRules.ts#L1-L390)
- [utils/env.ts](file://utils/env.ts#L1-L51)

章节来源
- [server/index.ts](file://server/index.ts#L1-L64)
- [README.md](file://README.md#L71-L82)

## 核心组件
- /api/openai：接收棋盘、当前回合、上一步等信息，构造提示词，调用选定AI提供商的聊天补全接口，解析JSON并返回最佳走法与理由。
- /api/minimax：接收棋盘、当前回合、搜索深度，执行Minimax+Alpha-Beta剪枝，返回最佳走法。
- /api/providers：读取配置中的提供商列表，返回可用性状态。
- 服务层封装：openaiService.ts与minimaxService.ts分别封装对上述API的调用，便于前端复用。

章节来源
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [api/minimax.ts](file://api/minimax.ts#L1-L125)
- [api/providers.ts](file://api/providers.ts#L1-L41)
- [services/openaiService.ts](file://services/openaiService.ts#L1-L37)
- [services/minimaxService.ts](file://services/minimaxService.ts#L1-L66)

## 架构总览
后端采用“Express路由 + Vercel风格函数处理器”的组合：Express负责路由与CORS、健康检查等，具体业务逻辑在api/*中实现；服务层在前端或独立服务中调用这些API。

```mermaid
sequenceDiagram
participant C as "客户端"
participant E as "Express 服务器<br/>server/index.ts"
participant H as "处理器<br/>api/openai.ts"
participant P as "AI提供商API"
participant S as "服务层<br/>services/openaiService.ts"
C->>E : POST /api/openai
E->>H : 转发请求
H->>H : 校验方法/参数
H->>H : 构造提示词与上下文
H->>P : 发起聊天补全请求
P-->>H : 返回JSON响应
H->>H : 解析并兜底策略
H-->>E : 返回最佳走法与理由
E-->>C : 200 OK
Note over S,H : 服务层封装调用，自动拼接API基础URL
```

图表来源
- [server/index.ts](file://server/index.ts#L22-L31)
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [services/openaiService.ts](file://services/openaiService.ts#L1-L37)
- [utils/env.ts](file://utils/env.ts#L31-L51)

## 详细组件分析

### POST /api/openai
- 方法与路径
  - POST /api/openai
- 请求体字段
  - board: 棋盘二维数组，见类型定义
  - turn: 当前回合颜色
  - lastMove: 上一步走法（可选）
  - provider: AI提供商标识，默认openai
- 成功响应
  - from: 起点坐标
  - to: 终点坐标
  - reason: AI给出的分析理由
  - notation: 走法的中国象棋记谱（可选）
- 错误处理
  - 405: 方法不允许
  - 500: 配置缺失（API Key未配置）
  - 200: API返回错误或空响应时，返回首个合法走法并附带兜底理由
  - 502: 服务内部异常
- 关键流程
  - 生成FEN与合法走法列表
  - 构造可视化棋盘与提示词
  - 调用提供商API（含模型、温度、响应格式）
  - 解析JSON并校验格式，失败则兜底
- curl示例
  - curl -X POST "$API_BASE_URL/api/openai" -H "Content-Type: application/json" -d '{"board":[...],"turn":"w","provider":"openai"}'

```mermaid
flowchart TD
Start(["进入 /api/openai"]) --> CheckMethod["校验HTTP方法为POST"]
CheckMethod --> ParseBody["解析请求体: board, turn, lastMove, provider"]
ParseBody --> GetCfg["读取提供商配置"]
GetCfg --> HasKey{"API Key存在?"}
HasKey --> |否| Err500["返回500: 配置缺失"]
HasKey --> |是| BuildCtx["生成FEN与合法走法列表"]
BuildCtx --> NoMoves{"是否有合法走法?"}
NoMoves --> |否| RespNull["返回null走法与提示"]
NoMoves --> |是| BuildPrompt["构造提示词与棋盘可视化"]
BuildPrompt --> CallAPI["调用提供商聊天补全"]
CallAPI --> Ok{"响应成功?"}
Ok --> |否| Fallback["返回首个合法走法并附兜底理由"]
Ok --> |是| ParseJSON["解析JSON并提取selectedMove与reasoning"]
ParseJSON --> Valid{"格式有效?"}
Valid --> |否| Fallback
Valid --> |是| ParseCoord["解析坐标字符串为from/to"]
ParseCoord --> Resp["返回最佳走法与理由"]
Err500 --> End(["结束"])
RespNull --> End
Fallback --> End
Resp --> End
```

图表来源
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [api/chessRules.ts](file://api/chessRules.ts#L196-L257)
- [api/common/config.ts](file://api/common/config.ts#L1-L49)

章节来源
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [api/chessRules.ts](file://api/chessRules.ts#L196-L257)
- [api/common/config.ts](file://api/common/config.ts#L1-L49)
- [services/openaiService.ts](file://services/openaiService.ts#L1-L37)
- [utils/env.ts](file://utils/env.ts#L31-L51)

### POST /api/minimax
- 方法与路径
  - POST /api/minimax
- 请求体字段
  - board: 棋盘二维数组
  - turn: 当前回合颜色
  - depth: 搜索深度（默认3）
- 成功响应
  - from: 起点坐标
  - to: 终点坐标
- 错误处理
  - 405: 方法不允许
  - 500: 内部错误（包含details）
- 关键流程
  - 收集所有合法走法
  - 执行Minimax+Alpha-Beta剪枝
  - 返回最佳走法
- curl示例
  - curl -X POST "$API_BASE_URL/api/minimax" -H "Content-Type: application/json" -d '{"board":[...],"turn":"w","depth":3}'

```mermaid
flowchart TD
Start(["进入 /api/minimax"]) --> CheckMethod["校验HTTP方法为POST"]
CheckMethod --> ParseBody["解析请求体: board, turn, depth"]
ParseBody --> GenMoves["遍历棋盘收集合法走法"]
GenMoves --> Shuffle["随机打散以增加多样性"]
Shuffle --> Loop["遍历每一步: 生成新棋盘并递归Minimax"]
Loop --> AB["Alpha-Beta剪枝"]
AB --> Best["更新最佳分数与走法"]
Best --> Done["返回最佳走法"]
CheckMethod --> |方法不为POST| Err405["返回405"]
ParseBody --> |异常| Err500["返回500"]
Err405 --> End(["结束"])
Err500 --> End
Done --> End
```

图表来源
- [api/minimax.ts](file://api/minimax.ts#L1-L125)
- [api/chessRules.ts](file://api/chessRules.ts#L196-L205)

章节来源
- [api/minimax.ts](file://api/minimax.ts#L1-L125)
- [api/chessRules.ts](file://api/chessRules.ts#L196-L205)
- [services/minimaxService.ts](file://services/minimaxService.ts#L1-L66)

### GET /api/providers
- 方法与路径
  - GET /api/providers
- 成功响应
  - providers: 数组，元素包含
    - id: 供应商标识
    - name: 名称
    - available: 是否可用（由API Key是否存在决定）
- 错误处理
  - 405: 方法不允许
  - 500: 内部错误
- curl示例
  - curl "$API_BASE_URL/api/providers"

```mermaid
sequenceDiagram
participant C as "客户端"
participant E as "Express 服务器"
participant H as "处理器"
participant CFG as "提供商配置"
C->>E : GET /api/providers
E->>H : 转发请求
H->>CFG : 读取所有提供商
CFG-->>H : 返回配置对象
H->>H : 逐个检查API Key可用性
H-->>E : 返回providers数组
E-->>C : 200 OK
```

图表来源
- [api/providers.ts](file://api/providers.ts#L1-L41)
- [api/common/config.ts](file://api/common/config.ts#L1-L49)

章节来源
- [api/providers.ts](file://api/providers.ts#L1-L41)
- [api/common/config.ts](file://api/common/config.ts#L1-L49)

### 服务层调用关系
- openaiService.ts
  - 调用POST /api/openai，传入board、turn、provider、lastMove
  - 返回最佳走法与reason
- minimaxService.ts
  - 调用POST /api/minimax，传入board、turn、depth
  - 返回最佳走法
  - 也可通过Web Worker方式调用minimaxWorker.ts，支持v1/v2版本切换
- URL构建
  - 使用utils/env.ts的buildApiUrl拼接API基础URL与路径

```mermaid
classDiagram
class OpenAIService {
+getOpenAIMove(board, turn, provider, lastMove) Promise
}
class MinimaxService {
+getMinimaxMoveAPI(board, turn, depth) Promise
+getMinimaxMoveWorker(board, turn, depth, version) Promise
}
class MinimaxWorker {
+getBestMoveMinimax(board, turn, depth, version) Promise
}
class EnvUtil {
+buildApiUrl(path) string
}
OpenAIService --> EnvUtil : "构建API URL"
MinimaxService --> EnvUtil : "构建API URL"
MinimaxService --> MinimaxWorker : "委托Worker"
```

图表来源
- [services/openaiService.ts](file://services/openaiService.ts#L1-L37)
- [services/minimaxService.ts](file://services/minimaxService.ts#L1-L66)
- [services/minimaxWorker.ts](file://services/minimaxWorker.ts#L1-L19)
- [utils/env.ts](file://utils/env.ts#L31-L51)

章节来源
- [services/openaiService.ts](file://services/openaiService.ts#L1-L37)
- [services/minimaxService.ts](file://services/minimaxService.ts#L1-L66)
- [services/minimaxWorker.ts](file://services/minimaxWorker.ts#L1-L19)
- [utils/env.ts](file://utils/env.ts#L31-L51)

## 依赖关系分析
- 处理器依赖
  - /api/openai.ts 依赖：棋规（生成FEN、合法走法、坐标解析）、提供商配置、类型定义
  - /api/minimax.ts 依赖：棋规（合法走法、应用走法、评估棋盘）
  - /api/providers.ts 依赖：提供商配置
- 服务层依赖
  - openaiService.ts 依赖：utils/env.ts（构建URL）
  - minimaxService.ts 依赖：utils/env.ts（构建URL），comlink Worker包装
- Express路由
  - server/index.ts 将 /api/openai 与 /api/providers 路由转发到对应处理器

```mermaid
graph LR
OA["api/openai.ts"] --> RUL["api/chessRules.ts"]
OA --> CFG["api/common/config.ts"]
OA --> TYP["api/common/types.ts"]
MM["api/minimax.ts"] --> RUL
MM --> TYP
PR["api/providers.ts"] --> CFG
SOA["services/openaiService.ts"] --> ENV["utils/env.ts"]
SMM["services/minimaxService.ts"] --> ENV
SMM --> SW["services/minimaxWorker.ts"]
Srv["server/index.ts"] --> OA
Srv --> MM
Srv --> PR
```

图表来源
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [api/minimax.ts](file://api/minimax.ts#L1-L125)
- [api/providers.ts](file://api/providers.ts#L1-L41)
- [api/chessRules.ts](file://api/chessRules.ts#L1-L390)
- [api/common/config.ts](file://api/common/config.ts#L1-L49)
- [api/common/types.ts](file://api/common/types.ts#L1-L68)
- [services/openaiService.ts](file://services/openaiService.ts#L1-L37)
- [services/minimaxService.ts](file://services/minimaxService.ts#L1-L66)
- [services/minimaxWorker.ts](file://services/minimaxWorker.ts#L1-L19)
- [utils/env.ts](file://utils/env.ts#L1-L51)
- [server/index.ts](file://server/index.ts#L22-L41)

章节来源
- [server/index.ts](file://server/index.ts#L22-L41)
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [api/minimax.ts](file://api/minimax.ts#L1-L125)
- [api/providers.ts](file://api/providers.ts#L1-L41)

## 性能考量
- /api/openai
  - 使用较低temperature与JSON响应格式，提升稳定性与可解析性
  - 对AI响应进行兜底策略，避免因外部API不稳定导致的失败
- /api/minimax
  - 默认深度较小，避免UI冻结；实际部署建议使用Worker或更高并发策略
  - Alpha-Beta剪枝减少无效分支，提高搜索效率
- 服务层
  - openaiService与minimaxService统一构建URL，便于在不同环境（本地/生产）切换

[本节为通用指导，无需列出章节来源]

## 故障排查指南
- 常见HTTP状态码
  - 405 Method Not Allowed：请求方法不被允许（仅支持POST或GET）
  - 500 Internal Server Error：服务器内部错误或配置缺失
  - 502 Bad Gateway：上游API返回错误
  - 200 OK：正常响应，但需注意部分情况下会返回兜底走法
- 常见问题定位
  - Provider配置缺失：确认环境变量OPENAI_API_KEY等已设置
  - API返回非JSON或为空：处理器会返回兜底走法并附带原因
  - Minimax计算异常：检查board与turn格式，确认深度合理
- 日志与调试
  - 处理器内包含关键步骤的日志输出，便于定位问题

章节来源
- [api/openai.ts](file://api/openai.ts#L1-L127)
- [api/minimax.ts](file://api/minimax.ts#L1-L125)
- [api/providers.ts](file://api/providers.ts#L1-L41)
- [server/index.ts](file://server/index.ts#L44-L58)

## 结论
本API参考文档梳理了后端暴露的三个核心REST端点与其在服务层的调用方式。通过明确的请求体、响应格式与错误处理策略，开发者可以稳定地集成AI走子能力。建议在生产环境中结合Worker与缓存策略优化Minimax性能，并通过环境变量集中管理各提供商的密钥与模型。

[本节为总结性内容，无需列出章节来源]

## 附录

### 环境变量与提供商配置
- 支持的提供商与环境变量前缀
  - OpenAI: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_API_URL
  - Gemini: GEMINI_API_KEY, GEMINI_MODEL, GEMINI_API_URL
  - DeepSeek: DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_API_URL
  - 阿里云千问: QIANWEN_API_KEY, QIANWEN_MODEL, QIANWEN_API_URL
- curl示例（示例中使用$API_BASE_URL替换为实际基础URL）
  - POST /api/openai
    - curl -X POST "$API_BASE_URL/api/openai" -H "Content-Type: application/json" -d '{"board":[...],"turn":"w","provider":"openai"}'
  - POST /api/minimax
    - curl -X POST "$API_BASE_URL/api/minimax" -H "Content-Type: application/json" -d '{"board":[...],"turn":"w","depth":3}'
  - GET /api/providers
    - curl "$API_BASE_URL/api/providers"

章节来源
- [README.md](file://README.md#L21-L43)
- [api/common/config.ts](file://api/common/config.ts#L1-L49)
- [utils/env.ts](file://utils/env.ts#L31-L51)