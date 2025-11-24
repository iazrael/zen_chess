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
        const { fen, allLegalMoves, isChecked } = getGameContext(board, turn);

        if (allLegalMoves.length === 0) {
            res.status(200).json({ move: null, message: "No legal moves" });
            return;
        }

        // 2. 构建三维坐标系 Prompt
        const prompt = constructPrompt(fen, turn, board, allLegalMoves, lastMove, isChecked);

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
        const startTime = Date.now();
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
        console.log(`${provider} API Response time:`, Date.now() - startTime, "ms", JSON.stringify(data));

        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            res.status(200).json({ ...allLegalMoves[0], reason: "Empty response" });
            return;
        }

        console.log(`${provider} Response:`, content);

        // 4. 解析结果
        let result: AnalysisResult | undefined;
        try {
            const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(jsonStr);
        } catch (e) {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                try { result = JSON.parse(match[0]); } catch (e2) { }
            }
        }

        if (!result || !result.selectedMove) {
            // 兜底：如果有吃子且安全的步，优先走；否则随机
            const safeCapture = allLegalMoves.find(m => m.desc.includes("吃") && !m.risk);
            const fallback = safeCapture || allLegalMoves[0];
            res.status(200).json({ ...fallback, reason: "Fallback: AI response invalid" });
            return;
        }

        const { selectedMove, reasoning, notation, analysis } = result;

        const moveData = parseMoveString(selectedMove);

        if (moveData) {
            res.status(200).json({ ...moveData, reason: reasoning, notation, analysis });
        } else {
            res.status(200).json({ ...allLegalMoves[0], analysis, reason: "Fallback: Invalid Move Format" });
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

export interface GameContext {
    fen: string;
    allLegalMoves: LegalMove[];
    isChecked: boolean;
}

export interface AnalysisResult {
    selectedMove: string;
    notation: string;
    reasoning: string;
    analysis: string;
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

export const getGameContext = (board: BoardState, turn: Color):GameContext => {
    const fen = boardToFEN(board, turn);
    const allLegalMoves: LegalMove[] = [];
    const opponentColor = turn === Color.Red ? Color.Black : Color.Red;

    // 简单的将军检测 (King Check Detection)
    let isChecked = false;
    // 找到己方老将位置
    let kingPos: Position | null = null;
    for (let y = 0; y < BOARD_ROWS; y++) {
        for (let x = 0; x < BOARD_COLS; x++) {
            const p = board[y][x];
            if (p && p.color === turn && p.type === 'k') {
                kingPos = { x, y };
                break;
            }
        }
    }
    if (kingPos && isSquareUnderAttack(board, kingPos, opponentColor)) {
        isChecked = true;
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
                        desc = `[吃${victimName}]`; // 简化标记
                        value += getPieceValue(target.type);
                    }

                    // 2. 风险预判 (原有逻辑)
                    const nextBoard = applyMove(board, from, to);
                    if (isSquareUnderAttack(nextBoard, to, opponentColor)) {
                        risk = true;
                        desc += " [有根]"; // 简化标记，节省Token
                        value -= 5;
                    }

                    // 3. 将军判断 (新增：如果这步棋能将军对方，加分)
                    // (此处略去复杂的模拟逻辑，简化为：如果目标位置能攻击到对方老将，视为将军倾向)
                    // 实际项目中建议完整模拟 applyMove 后检查对方老将是否被攻击

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

    // 排序逻辑优化：
    // 1. 如果被将军，优先筛选出能够"解将"的棋（这里暂用原逻辑，但在Prompt里强调）
    // 2. 也就是通过 value 排序
    allLegalMoves.sort((a, b) => b.value - a.value);

    return { fen, allLegalMoves, isChecked }; // 返回 isChecked 状态
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

export const systemPrompt = `你是一个世界级的中国象棋AI大师（ELO 2800+）。
你的任务是根据当前盘面，分析局势并选出最佳的一步棋。

## 思考逻辑（必须严格遵守）
在做出决定前，你必须进行以下思维链分析：
1. **威胁评估**: 我方老将是否安全？对方是否有叫杀（Checkmate）威胁？如果有，必须优先解决。
2. **战术计算**: 
   - 检查是否有"高价值吃子"的机会（吃车、吃马炮）。
   - 检查是否存在"弃子攻杀"的陷阱。
3. **位置评估**: 如果没有激烈的战术冲突，寻找能够控制中心、限制对方子力或打通车路的走法。

## 棋子价值参考
- 帅(King): ∞ (输赢关键)
- 车(Rook): 900
- 炮(Cannon): 450
- 马(Knight): 400
- 兵(Pawn): 过河前 100, 过河后 200
- 士/象(Guard/Bishop): 200

## 输出要求
请返回纯 JSON 格式，不要包含 Markdown 标记。格式如下：
{
  "analysis": "这里写你的详细分析...例如：对方马卧槽威胁很大，我必须平炮阻挡...",
  "selectedMove": "(x1,y1)->(x2,y2)", 
  "notation": "走法的中文记谱描述，如：炮二平五",
  "reasoning": "一句话总结理由，例如：平炮拦马，兼顾防守与反击。"
}
注意：selectedMove 必须严格从提供的【候选走法】列表中选择，不可通过幻觉创造。
`;

export const constructPrompt = (fen: string, turn: Color, board: BoardState, legalMoves: LegalMove[], lastMove: Move, isChecked: boolean) => {
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

    // 2. 关键局势情报
    const turnStr = turn === Color.Red ? "红方 (RED)" : "黑方 (BLACK)";
    const statusAlert = isChecked
        ? `⚠️⚠️⚠️ 警告：${turnStr} 正在被将军！你必须立即采取行动保护老将！ ⚠️⚠️⚠️`
        : "局势平稳";

    // 3. 智能筛选走法 (Candidate Selection)
    // 大模型不需要看 40 个平庸的走法。我们只给它看 Top 15 + 随机几个防止死循环
    const topMoves = legalMoves.slice(0, 15);
    const otherMoves = legalMoves.slice(15, 20); // 再多给一点点备选

    const formatMove = (m: LegalMove) => {
        // 格式: "(x1,y1)->(x2,y2) : 炮二平五 [吃马] (评分: 40)"
        return `   - "${m.moveStr}": ${m.notation} ${m.desc} ${m.risk ? '(注意:落点被攻击)' : ''}`;
    };

    // 将走法分组，帮助 AI 聚焦
    const captureMoves = topMoves.filter(m => m.desc.includes("吃"));
    const normalMoves = topMoves.filter(m => !m.desc.includes("吃"));

    let movesPrompt = "";
    if (captureMoves.length > 0) {
        movesPrompt += "【进攻/吃子选项】(优先考虑):\n" + captureMoves.map(formatMove).join('\n') + "\n";
    }
    movesPrompt += "【战术/移动选项】:\n" + normalMoves.map(formatMove).join('\n') + "\n";

    if (otherMoves.length > 0) {
        movesPrompt += "【其他备选】:\n" + otherMoves.map(formatMove).join('\n');
    }

    // 4. 最终 Prompt 组装
    return `## 当前战况
**执红/执黑**: ${turnStr}
**当前状态**: ${statusAlert}
**对手上一步**: ${lastMove ? lastMove.notation : '开局'}
**FEN**: ${fen}

## 棋盘快照 (Visual Board)
${visualBoard}

## 候选走法列表 (已过滤)
请从以下列表中选择最合理的一步。注意：如果处于【被将军】状态，只能选择能够解围的走法。
------------------------------------------------
${movesPrompt}
------------------------------------------------

请开始分析局面（Analysis），然后给出决策（SelectedMove）。`;
};
// --- END OF FILE openai.ts ---