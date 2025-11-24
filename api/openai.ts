// --- START OF FILE openai.ts ---

import { parseMoveString, boardToFEN, fenToMoveString, getLegalMoves, applyMove, getValidMovesForPiece } from "./chessRules.js";
import { getAIProviderConfig } from "./common/config.js";
import { BoardState, Color, Position, PieceType, Move } from "./common/types.js";
import { BOARD_ROWS, BOARD_COLS, PIECE_CHARS, COL_NUMERALS, MOVE_DIRECTIONS } from "./common/constants.js";

// ==================== 核心处理函数 ====================

export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { board, turn, lastMove, provider = 'openai' } = req.body;
    const config = getAIProviderConfig(provider);

    if (!config.apiKey) {
        res.status(500).json({ error: `API Key missing configuration for ${provider}` });
        return;
    }

    try {
        // 1. 获取包含战术分析的上下文
        const { fen, allLegalMoves } = getGameContext(board, turn);

        if (allLegalMoves.length === 0) {
            res.status(200).json({ move: null, message: "No legal moves" });
            return;
        }

        // 2. 构建三维坐标系 Prompt
        const prompt = constructPrompt(fen, turn, board, allLegalMoves, lastMove);

        // 3. 配置 API 请求
        const body = JSON.stringify({
            model: config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.1, // 极低温度，强制逻辑性
            response_format: { type: "json_object" }
        });

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        console.log(`${provider} Request: Valid Moves: ${allLegalMoves.length}`);
        
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: headers,
            body: body
        });

        console.log(`${provider} API Request:`, body);

        if (!response.ok) {
            const err = await response.text();
            console.error(`${provider} API Error:`, err);
            res.status(200).json({ ...allLegalMoves[0], reason: `API Error: ${err}` });
            return;
        }

        const data: any = await response.json();
        console.log(`${provider} API Response:`, JSON.stringify(data));

        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            res.status(200).json({ ...allLegalMoves[0], reason: "Empty response" });
            return;
        }

        console.log(`${provider} Response:`, content);

        // 4. 解析结果
        let result;
        try {
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(jsonStr);
        } catch (e) {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                try { result = JSON.parse(match[0]); } catch (e2) {}
            }
        }

        if (!result || !result.selectedMove) {
            // 兜底：如果有吃子且安全的步，优先走；否则随机
            const safeCapture = allLegalMoves.find(m => m.desc.includes("吃") && !m.risk);
            const fallback = safeCapture || allLegalMoves[0];
            res.status(200).json({ ...fallback, reason: "Fallback: AI response invalid" });
            return;
        }

        const moveData = parseMoveString(result.selectedMove);

        if (moveData) {
            res.status(200).json({ ...moveData, reason: result.reasoning });
        } else {
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback: Invalid Move Format" });
        }

    } catch (error) {
        console.error(`Handler Error:`, error);
        res.status(502).json({ error: "Internal Server Error" });
    }
}

// ==================== 战术分析引擎 ====================

export interface LegalMove {
    moveStr: string; 
    notation: string; 
    from: Position;
    to: Position;
    desc: string; // 描述：吃子信息
    risk: boolean; // 是否有去无回（被反杀）
    value: number; // 粗略价值排序用
}

// 检查某个位置是否被特定颜色的棋子攻击
const isSquareUnderAttack = (board: BoardState, targetPos: Position, attackerColor: Color): boolean => {
    for (let y = 0; y < BOARD_ROWS; y++) {
        for (let x = 0; x < BOARD_COLS; x++) {
            const p = board[y][x];
            if (p && p.color === attackerColor) {
                // 这里直接复用规则里的 ValidMoves
                // 注意：这只是伪合法移动检查（比如不考虑蹩马腿的复杂情况可能不够完美，但在 nodejs 端复用 chessRules 足够了）
                const moves = getValidMovesForPiece(board, { x, y });
                if (moves.some(m => m.x === targetPos.x && m.y === targetPos.y)) {
                    return true;
                }
            }
        }
    }
    return false;
};

export const getGameContext = (board: BoardState, turn: Color) => {
    const fen = boardToFEN(board, turn);
    const allLegalMoves: LegalMove[] = [];
    const opponentColor = turn === Color.Red ? Color.Black : Color.Red;

    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[0].length; x++) {
            const p = board[y][x];
            if (p && p.color === turn) {
                const moves = getLegalMoves(board, { x, y });
                
                moves.forEach(to => {
                    const from = { x, y };
                    const target = board[to.y][to.x];
                    
                    let desc = "";
                    let value = 0;
                    let risk = false;

                    // 1. 吃子分析
                    if (target) {
                        const victimName = getPiecename(target.type, target.color);
                        desc = `(吃${victimName})`;
                        value += getPieceValue(target.type);
                    }

                    // 2. 风险分析 (预判)
                    // 模拟这一步走完
                    const nextBoard = applyMove(board, from, to);
                    // 检查到达的位置 `to` 是否在对方火力覆盖下
                    // 注意：如果是吃子，我们不仅要看是否被攻击，还要看是不是"赚了"。
                    // 简单逻辑：只要目标点被攻击，就标记风险，交给 Prompt 决定是否值得
                    if (isSquareUnderAttack(nextBoard, to, opponentColor)) {
                        risk = true;
                        desc += " [有根!小心!]";
                        value -= 5; // 风险惩罚
                    }

                    const notation = getXiangqiNotation(board, from, to, turn);

                    allLegalMoves.push({
                        moveStr: fenToMoveString(from, to),
                        notation,
                        from,
                        to,
                        desc,
                        risk,
                        value
                    });
                });
            }
        }
    }

    // 排序：高价值且低风险的排前面
    allLegalMoves.sort((a, b) => b.value - a.value);

    return { fen, allLegalMoves };
};

const getPieceValue = (type: PieceType): number => {
    const values = { 'k': 1000, 'r': 90, 'n': 45, 'c': 45, 'b': 20, 'a': 20, 'p': 10 };
    return values[type] || 0;
};

const getPiecename = (type: PieceType, color?: Color) => {
    if (color) {
        return PIECE_CHARS[color][type] || '子';
    }
    // 默认返回黑方棋子名称
    return PIECE_CHARS[Color.Black][type] || '子';
}

// 生成中国象棋标准记谱法
const getXiangqiNotation = (board: BoardState, from: Position, to: Position, color: Color): string => {
    const piece = board[from.y][from.x];
    if (!piece) return "";

    // 1. 确定棋子名称 (中文)
    const pieceName = PIECE_CHARS[color][piece.type] || "";

    // 2. 确定列号 (1-9)
    // 红方：从右向左数 (0->9, 8->1) => col = 9 - x
    // 黑方：从右向左数 (自分视角) => 在数组中是 0->1, 8->9 => col = x + 1
    const fromColNum = color === Color.Red ? (9 - from.x) : (from.x + 1);
    const toColNum = color === Color.Red ? (9 - to.x) : (to.x + 1);

    // 数字字符：红方用中文，黑方用阿拉伯
    const fromColStr = COL_NUMERALS[color][fromColNum];
    const toColStr = COL_NUMERALS[color][toColNum];

    // 3. 确定动作 (进、退、平)
    // 红方 y 减小是进，y 增加是退
    // 黑方 y 增加是进，y 减小是退
    let action = '';
    if (from.y === to.y) {
        action = MOVE_DIRECTIONS[color]['Horizontal'];
    } else {
        const isMovingUp = to.y < from.y; 
        if (color === Color.Red) action = isMovingUp ? MOVE_DIRECTIONS[color]['Forward'] : MOVE_DIRECTIONS[color]['Backward'];
        else action = isMovingUp ? MOVE_DIRECTIONS[color]['Backward'] : MOVE_DIRECTIONS[color]['Forward'];
    }

    // 4. 确定第四个字 (目标列号 或 进退步数)
    // 马(n)、相(b)、士(a)、帅(k) 斜线或仕相走法：总是用"目标列号"
    // 车(r)、炮(c)、兵(p) 直线走法：
    //   - 如果是平，用"目标列号"
    //   - 如果是进/退，用"步数" (绝对值)
    let lastChar = '';
    const isLinearPiece = ['r', 'c', 'p'].includes(piece.type);

    if (action === MOVE_DIRECTIONS[color]['Horizontal']) {
        lastChar = toColStr!;
    } else {
        if (isLinearPiece) {
            // 进退步数
            const steps = Math.abs(to.y - from.y);
            lastChar = color === Color.Red ? COL_NUMERALS[color][steps]! : steps.toString();
        } else {
            // 斜线子力 (马、象、士、将) 进退也用列号
            lastChar = toColStr!;
        }
    }

    return `${pieceName}${fromColStr}${action}${lastChar}`;
};

// ==================== Prompt 构建 ====================

export const systemPrompt = `你是一个中国象棋大师级AI。你的目标是选择最符合象棋棋理的一步棋。

## 象棋核心战略原则（按优先级）

### 第一优先级 - 致命威胁
1. **对方将死或马上将死**: 寻找可以立即或两步内将军的走法
2. **保护自己的帅/将**: 如果帅/将在对方火力范围内，必须立即躲避或反击
3. **止损**: 如果有价值高的棋子（车、马、炮）要被吃，且无法反杀，考虑移开或反吃

### 第二优先级 - 主动进攻
1. **吃子获利**: 优先吃掉对方的核心棋子（排序：车90分 > 马/炮45分 > 象/士20分 > 兵/卒10分）
2. **连环将军**: 寻找可以连续将军、打乱对方阵脚的走法
3. **占据关键位置**: 中心、河界、对方底线等战略要点

### 第三优先级 - 防守和排兵布阵
1. **激活消极的棋子**: 把还没参加战斗的棋子快速投入战场
2. **连接棋子**: 形成互相保护的阵型，避免被各个击破
3. **保持灵活性**: 留下多个进攻选项，不要过早僵化

## 标记说明
- **[有根!小心!]**: 该位置被对方棋子攻击，吃了会被反杀。只在"以小博大"（如吃掉对方车却被吃掉炮）时值得考虑。
- **无标记的吃子走法**: 是安全的赚棋行为，强烈建议优先执行。

## 坐标系统（重要）
- X轴：0-8（左到右）
  - 红方视角："一"在X=8，"九"在X=0
  - 黑方视角："1"在X=0，"9"在X=8
- Y轴：0-9（上到下）
  - Y=0: 黑方底线
  - Y=4-5: 楚河汉界
  - Y=9: 红方底线

## 决策流程
1. **扫描棋盘**: 识别双方的关键棋子位置和防守空隙
2. **列举机会**: 从第一优先级开始，列出所有可行的走法
3. **评估收益**: 计算吃子价值、进攻强度、风险等级
4. **做出选择**: 选择优先级最高、收益最大的走法
5. **验证**: 再次确认这步棋不会导致更大的损失

## 输出格式
必须返回JSON: { "selectedMove": "(x1,y1)->(x2,y2)", "notation": "炮二平五", "reasoning": "50字以内的决策理由" }`;

export const constructPrompt = (fen: string, turn: Color, board: BoardState, legalMoves: LegalMove[], lastMove: Move) => {
    // 1. 构造多维坐标棋盘
    let visualBoard = '\n';
    
    // 顶部坐标尺 (黑方视角)
    visualBoard += '      1 2 3 4 5 6 7 8 9  (黑方记谱)\n';
    visualBoard += '      0 1 2 3 4 5 6 7 8  (程序坐标 X轴)\n';
    visualBoard += '    +-------------------+\n';

    for (let y = 0; y < 10; y++) {
        let rowStr = ` ${y}  | `;
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) {
                rowStr += '· ';
            } else {
                const char = PIECE_CHARS[p.color][p.type];
                rowStr += char + ' ';
            }
        }
        rowStr += '|';
        
        // 右侧区域标注
        if (y === 0) rowStr += ' [黑方底线]';
        if (y === 4) rowStr += ' [楚河]';
        if (y === 5) rowStr += ' [汉界]';
        if (y === 9) rowStr += ' [红方底线]';
        
        visualBoard += rowStr + '\n';
    }
    visualBoard += '    +-------------------+\n';
    visualBoard += '      九 八 七 六 五 四 三 二 一  (红方记谱)\n';

    // 2. 上一步信息
    let lastMoveInfo = "无";
    if (lastMove) {
        lastMoveInfo = `${lastMove.notation || '(未知)'} (从 ${lastMove.from.x},${lastMove.from.y}) 到 (${lastMove.to.x},${lastMove.to.y})`;
    }

    // 3. 走法列表
    const movesListStr = legalMoves.map(m => 
        `"${m.moveStr}": ${m.notation} ${m.desc}`
    ).join('\n');

    const turnStr = turn === Color.Red 
        ? "红方 (RED, 下方)" 
        : "黑方 (BLACK, 上方)";

    return `## 当前局面
**轮到**: ${turnStr}
**上一步对手**: ${lastMoveInfo}
**当前FEN**: ${fen}

## 可视化棋盘
${visualBoard}

## 可选走法 (已按推荐度排序)
-------------------------------------
${movesListStr}
-------------------------------------

请按照"象棋核心战略原则"逐步分析，选择最优走法。`;
};
// --- END OF FILE openai.ts ---