// --- START OF FILE openai.ts ---

import { parseMoveString, boardToFEN, fenToMoveString, getLegalMoves, applyMove, getValidMovesForPiece } from "./chessRules.js";
import { getAIProviderConfig } from "./common/config.js";
import { BoardState, Color, Position, PieceType } from "./common/types.js";
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
        const { fen, allLegalMoves } = getGameContext(board, turn, lastMove);

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

export const getGameContext = (board: BoardState, turn: Color, lastMove: {from: Position, to: Position} | null) => {
    const fen = boardToFEN(board, turn);
    const allLegalMoves: LegalMove[] = [];
    const opponentColor = turn === Color.Red ? Color.Black : Color.Red;

    // 上一步的记谱
    let lastMoveNotation = "无";
    if (lastMove) {
        lastMoveNotation = getXiangqiNotation(board, lastMove.from, lastMove.to, opponentColor); // 注意：棋子已经动过了，这里生成的记谱可能不准，因为 board 已经是动后的。但对于提示词来说，坐标更重要。
        // 修正：由于 board 已经是 lastMove 后的状态，直接生成记谱会找不到 from 的棋子。
        // 简单起见，我们只显示坐标，或者在前端传过来 notation。
        // 这里我们在 prompt 里用坐标描述上一步。
    }

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

export const systemPrompt = `你是一个中国象棋特级大师。请根据盘面分析选择**唯一最佳**走法。

**核心原则**:
1. **拒绝送子**: 列表里标有 "[有根!小心!]" 的走法意味着你吃子后会被反杀（比如用车换马，或者炮打有根马）。除非你能算出这是弃子攻杀，否则**绝对不要走**。
2. **大局观**:开局抢出车,中局控肋道,残局兵归心。
3. **关于坐标**: 输入的 X 轴坐标是 0-8。
   - 你的记谱习惯是 1-9。
   - 红色方(Red)的 "一" 对应 X=8, "九" 对应 X=0。
   - 黑色方(Black)的 "1" 对应 X=0, "9" 对应 X=8。
   - 请务必参考棋盘图上的坐标尺。

**输出格式**:
JSON 格式: { "selectedMove": "(x1,y1)->(x2,y2)", "notation": "炮二平五", "reasoning": "中文分析对方的意图和你的应对，不要超过3句话" }`;

export const constructPrompt = (fen: string, turn: Color, board: BoardState, legalMoves: LegalMove[], lastMove: any) => {
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

    return `局势信息:
- 轮到: ${turnStr}
- 上一步对手走法: ${lastMoveInfo}
- 当前FEN: ${fen}

可视化棋盘 (请严格对齐坐标):
${visualBoard}

可选走法 (已按推荐度排序):
-------------------------------------
${movesListStr}
-------------------------------------

**决策指令**:
1. 观察棋盘，结合上一步对方的意图（是捉子、还是叫杀？）。
2. 检查列表中带有 **[有根!小心!]** 标记的走法。这表示目标受保护，吃子会导致你丢子（除非拿小子换大子，否则不要走）。
3. 选择一步最符合棋理的走法。


请以 JSON 格式返回你的选择。`;
};
// --- END OF FILE openai.ts ---