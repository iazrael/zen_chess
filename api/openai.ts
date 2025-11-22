// --- START OF FILE openai.ts ---

import { parseMoveString, boardToFEN, fenToMoveString, getLegalMoves } from "./chessRules.js";
import { getAIProviderConfig } from "./common/config.js";
import { BoardState, Color, Position, PieceType } from "./common/types.js";

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

    const { board, turn, provider = 'openai' } = req.body;
    const config = getAIProviderConfig(provider);

    if (!config.apiKey) {
        res.status(500).json({ error: `API Key missing configuration for ${provider}` });
        return;
    }

    try {
        // 1. 获取包含记谱法的上下文
        const { fen, allLegalMoves } = getGameContext(board, turn);

        if (allLegalMoves.length === 0) {
            res.status(200).json({ move: null, message: "No legal moves" });
            return;
        }

        // 2. 构建增强型 Prompt
        const prompt = constructPrompt(fen, turn, board, allLegalMoves);

        // 3. 调用 AI API
        const body = JSON.stringify({
            model: config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.1, // 降低温度以保证逻辑严密
            response_format: { type: "json_object" }
        });

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        console.log(`${provider} Request Payload (Brief):`, `Moves count: ${allLegalMoves.length}`);

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
            // 尝试修复可能存在的 Markdown 格式
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(jsonStr);
        } catch (e) {
            // 如果 JSON 解析失败，尝试正则提取
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                try { result = JSON.parse(match[0]); } catch (e2) { }
            }
        }

        if (!result || !result.selectedMove) {
            console.error("Failed to parse AI response", content);
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback: Parse Error" });
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

// ==================== 辅助类型与工具 ====================

export interface LegalMove {
    moveStr: string; // "(0,0)->(0,1)"
    notation: string; // "车1进1"
    from: Position;
    to: Position;
    desc?: string; // "(吃马)"
}

const getPiecename = (type: PieceType) => {
    const names: Record<string, string> = {
        'k': '将', 'a': '士', 'b': '象', 'n': '马', 'r': '车', 'c': '炮', 'p': '卒'
    };
    return names[type] || '子';
}

// 生成中国象棋标准记谱法 (简化版，不处理前后兵/前后车等复杂歧义，但足够LLM理解)
const getXiangqiNotation = (board: BoardState, from: Position, to: Position, color: Color): string => {
    const piece = board[from.y][from.x];
    if (!piece) return "";

    // 1. 确定棋子名称 (中文)
    const nameMap: Record<string, string> = {
        [Color.Red]: { 'r': '车', 'n': '马', 'b': '相', 'a': '仕', 'k': '帅', 'c': '炮', 'p': '兵' },
        [Color.Black]: { 'r': '车', 'n': '马', 'b': '象', 'a': '士', 'k': '将', 'c': '炮', 'p': '卒' },
        // [Color.Red]: { 'r': '俥', 'n': '傌', 'b': '相', 'a': '仕', 'k': '帥', 'c': '炮', 'p': '兵' },
        // [Color.Black]: { 'r': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'c': '砲', 'p': '卒' }
    }[color] as any;
    const pieceName = nameMap[piece.type] || "";

    // 2. 确定列号 (1-9)
    // 红方：从右向左数 (0->9, 8->1) => col = 9 - x
    // 黑方：从右向左数 (自分视角) => 在数组中是 0->1, 8->9 => col = x + 1
    const fromColNum = color === Color.Red ? (9 - from.x) : (from.x + 1);
    const toColNum = color === Color.Red ? (9 - to.x) : (to.x + 1);

    // 数字字符：红方用中文，黑方用阿拉伯
    const nums = color === Color.Red
        ? [null, '一', '二', '三', '四', '五', '六', '七', '八', '九']
        : [null, '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    const fromColStr = nums[fromColNum];
    const toColStr = nums[toColNum];

    // 3. 确定动作 (进、退、平)
    // 红方 y 减小是进，y 增加是退
    // 黑方 y 增加是进，y 减小是退
    let action = '';
    if (from.y === to.y) {
        action = '平';
    } else {
        const isMovingUp = to.y < from.y; // 物理向上
        if (color === Color.Red) {
            action = isMovingUp ? '进' : '退';
        } else {
            action = isMovingUp ? '退' : '进';
        }
    }

    // 4. 确定第四个字 (目标列号 或 进退步数)
    // 马(n)、相(b)、士(a)、帅(k) 斜线或仕相走法：总是用"目标列号"
    // 车(r)、炮(c)、兵(p) 直线走法：
    //   - 如果是平，用"目标列号"
    //   - 如果是进/退，用"步数" (绝对值)
    let lastChar = '';

    const isLinearPiece = ['r', 'c', 'p'].includes(piece.type);

    if (action === '平') {
        lastChar = toColStr!;
    } else {
        if (isLinearPiece) {
            // 进退步数
            const steps = Math.abs(to.y - from.y);
            lastChar = color === Color.Red ? nums[steps]! : steps.toString();
        } else {
            // 斜线子力 (马、象、士、将) 进退也用列号
            lastChar = toColStr!;
        }
    }

    return `${pieceName}${fromColStr}${action}${lastChar}`;
};

export const getGameContext = (board: BoardState, turn: Color) => {
    const fen = boardToFEN(board, turn);
    const allLegalMoves: LegalMove[] = [];

    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[0].length; x++) {
            const p = board[y][x];
            if (p && p.color === turn) {
                const moves = getLegalMoves(board, { x, y });
                moves.forEach(to => {
                    const from = { x, y };
                    const target = board[to.y][to.x];

                    // 生成描述
                    let desc = "";
                    if (target) desc = `(吃${getPiecename(target.type)})`;

                    // 生成记谱
                    const notation = getXiangqiNotation(board, from, to, turn);

                    allLegalMoves.push({
                        moveStr: fenToMoveString(from, to),
                        notation,
                        from,
                        to,
                        desc
                    });
                });
            }
        }
    }

    // 排序优化：优先把吃子的走法排在前面，方便 AI 第一眼看到战术机会
    allLegalMoves.sort((a, b) => {
        const aScore = a.desc ? 1 : 0;
        const bScore = b.desc ? 1 : 0;
        return bScore - aScore;
    });

    return { fen, allLegalMoves };
};

// ==================== Prompt 构建 ====================

export const systemPrompt = `你是一个中国象棋特级大师 AI (Grandmaster)。
你的任务是根据当前的盘面 (FEN) 和可选走法列表，选出当前局面下**最优**的一步棋。

**思维准则**:
1. **术语感知**: 请利用列表提供的“中国象棋记谱” (如 "炮二平五") 来理解棋路。这符合你的训练数据直觉。
2. **绝对不送子**: 除非是弃子战术（必须在推理中说明），否则严禁把子力（车马炮）移动到对方火力范围内。
3. **根的判断**: 如果你要吃子，必须检查那个子是否有“根”（被保护）。用车换马是亏的，用炮打有根马也是亏的。
4. **大局观**: 开局抢出车，中局控肋道，残局兵归心。

**输出要求**:
- 返回纯 JSON 格式。
- "selectedMove": 必须完全复制列表中对应的坐标字符串，例如 "(1,2)->(4,2)"。
- "notation": 用中文表示的中国象棋标准记谱法，例如 "炮二平五"。
- "reasoning": 用中文简要分析局势和选择这么走的理由理由 (不要超过5句话)。

JSON 示例:
{
  "selectedMove": "(1,2)->(4,2)",
  "notation": "炮二平五",
  "reasoning": "黑方炮8平5，架起中炮，我要反击中路，执行XXX。"
}`;

export const constructPrompt = (fen: string, turn: Color, board: BoardState, legalMoves: LegalMove[]) => {
    // 1. 可视化棋盘
    let visualBoard = '\n    0 1 2 3 4 5 6 7 8  (X轴)\n';
    visualBoard += '  +-------------------+\n';

    for (let y = 0; y < 10; y++) {
        let rowStr = `${y} | `;
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) {
                rowStr += '· ';
            } else {
                // 视觉上区分红黑：红字显示为全角，或者带括号，这里直接用传统汉字
                const char = {
                    [Color.Red]: { 'r': '俥', 'n': '傌', 'b': '相', 'a': '仕', 'k': '帥', 'c': '炮', 'p': '兵' },
                    [Color.Black]: { 'r': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'c': '砲', 'p': '卒' }
                }[p.color][p.type];
                rowStr += char + ' ';
            }
        }
        // 右侧标注区域
        if (y === 0) rowStr += ' [黑方底线]';
        if (y === 2) rowStr += ' [黑方河岸]';
        if (y === 4) rowStr += ' [楚河]';
        if (y === 5) rowStr += ' [汉界]';
        if (y === 7) rowStr += ' [红方河岸]';
        if (y === 9) rowStr += ' [红方底线]';

        visualBoard += rowStr + '\n';
    }
    visualBoard += '  +-------------------+\n';

    // 2. 构造带记谱的走法列表
    // 格式: "坐标" : 记谱 [吃子]
    const movesListStr = legalMoves.map(m =>
        `"${m.moveStr}": ${m.notation} ${m.desc || ''}`
    ).join('\n');

    const turnStr = turn === Color.Red
        ? "红方 (RED, 棋盘下方 y=9, 记谱用中文数字)"
        : "黑方 (BLACK, 棋盘上方 y=0, 记谱用阿拉伯数字)";

    return `当前盘面 (FEN): ${fen}

轮到: ${turnStr} 走棋。

${visualBoard}

合法走法列表 (请从中选择):
-------------------------------------
${movesListStr}
-------------------------------------

**特别警告**:
1. **不要送子！** 仔细检查你移动到的位置是否被对方棋子攻击。
2. **看清吃子**: 列表标注了"(吃...)"的走法。吃子前确认是否是“拿大子换小子”（亏损交换）。
3. 优先考虑符合棋理的走法 (如: "马2进3", "车1平2", "炮2平5" 等)。

请以 JSON 格式返回你的选择。`;
};
// --- END OF FILE openai.ts ---