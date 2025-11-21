// minimaxV2.ts  ——  中国象棋 α-β + ID + TT + History + CheckExtension
import { BoardState, Color, Position, Piece } from '../api/common/types.js';
import { getLegalMoves, applyMove, undoMove, evaluateBoard, isInCheck, computeHash, REP_TABLE, RESET_REP } from '../api/chessRules.js';

const MAX_DEPTH = 12;          // 迭代加深上限
const TT_SIZE = 1 << 20;     // 百万条目，约 16 MB
const EXTENSION = 1;           // 将军延伸层数

interface TTEntry {
    depth: number;
    flag: 'exact' | 'lower' | 'upper';
    score: number;
    best: { from: Position; to: Position } | null;
}

const TT: TTEntry[] = new Array(TT_SIZE);

let nodes = 0;
let historyTable: number[][][][] = []; // historyTable[y1][x1][y2][x2]

function initHistory() {
    historyTable = Array(10).fill(0).map(() =>
        Array(9).fill(0).map(() =>
            Array(10).fill(0).map(() => Array(9).fill(0))));
}

/**
 * 对外保持原签名：
 * board  当前局面
 * turn   走子方
 * depth  UI 难度 1-10（对应旧版的“固定深度”）
 * 返回值 最佳走法或 null
 */
export const getBestMoveMinimax = async (
    board: BoardState,
    turn: Color,
    depth: number = 3
): Promise<{ from: Position; to: Position } | null> => {
    // 把 depth∈[1,10] 线性映射到搜索时间：0.5s – 8s
    const timeMs = 500 + (depth - 1) * 850; // 1→500ms, 10→8150ms
    return getBestMoveV2(board, turn, timeMs);
};

// 迭代加深入口，返回最佳走法
export async function getBestMoveV2(board: BoardState, aiColor: Color, timeLimitMs = 3000)
    : Promise<{ from: Position; to: Position } | null> {
    nodes = 0;
    RESET_REP();                       // 清空重复检测
    initHistory();
    const start = performance.now();
    let best = null;

    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        const [score, move] = pvSearch(board, depth, -Infinity, Infinity, true, aiColor, 0);
        if (move) best = move;

        const elapsed = performance.now() - start;
        if (elapsed > timeLimitMs * 0.8) break; // 留 20% 余量
    }
    return best;
}

// 带 PVS + TT + History + Extension 的主搜索
function pvSearch(
    board: BoardState,
    depth: number,
    alpha: number,
    beta: number,
    isMax: boolean,
    aiColor: Color,
    ply: number
): [number, { from: Position; to: Position } | null] {
    nodes++;
    const turn = isMax ? aiColor : (aiColor === Color.Red ? Color.Black : Color.Red);
    const hash = computeHash(board);

    // 重复局面 / 长将判和
    const rep = REP_TABLE.get(hash);
    if (rep && rep >= 3) return [0, null];

    // 查置换表
    const ttIdx = hash & (TT_SIZE - 1);
    const ttHit = TT[ttIdx];
    if (ttHit && ttHit.depth >= depth) {
        if (ttHit.flag === 'exact') return [ttHit.score, ttHit.best];
        if (ttHit.flag === 'lower' && ttHit.score >= beta) return [ttHit.score, ttHit.best];
        if (ttHit.flag === 'upper' && ttHit.score <= alpha) return [ttHit.score, ttHit.best];
    }

    // 叶子或深度耗尽
    if (depth <= 0) {
        const raw = evaluateBoard(board, aiColor);
        return [raw, null];
    }

    // 将军延伸
    const inCheck = isInCheck(board, turn);
    const newDepth = inCheck ? depth + EXTENSION : depth;

    // 生成全部走法
    const moves: { from: Position; to: Position }[] = [];
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const pc = board[y][x];
            if (pc && pc.color === turn) {
                const tos = getLegalMoves(board, { x, y });
                tos.forEach(t => moves.push({ from: { x, y }, to: t }));
            }
        }
    }

    // History +  Killer 排序（简易）
    moves.sort((a, b) => historyTable[b.from.y][b.from.x][b.to.y][b.to.x]
        - historyTable[a.from.y][a.from.x][a.to.y][a.to.x]);

    let bestMove: { from: Position; to: Position } | null = null;
    let bestScore = isMax ? -Infinity : Infinity;
    let oldAlpha = alpha;

    for (const m of moves) {
        const { captured, hashDelta } = applyMove(board, m.from, m.to);
        REP_TABLE.set(hash, (REP_TABLE.get(hash) || 0) + 1);

        let score: number;
        // PVS 小窗口
        if (isMax) {
            score = pvSearch(board, newDepth - 1, alpha, alpha + 1, false, aiColor, ply + 1)[0];
            if (score > alpha && score < beta) { // 重新开全窗口
                score = pvSearch(board, newDepth - 1, score, beta, false, aiColor, ply + 1)[0];
            }
            alpha = Math.max(alpha, score);
        } else {
            score = pvSearch(board, newDepth - 1, beta - 1, beta, true, aiColor, ply + 1)[0];
            if (score < beta && score > alpha) {
                score = pvSearch(board, newDepth - 1, alpha, score, true, aiColor, ply + 1)[0];
            }
            beta = Math.min(beta, score);
        }

        REP_TABLE.set(hash, REP_TABLE.get(hash)! - 1);
        undoMove(board, m.from, m.to, captured);

        // 剪断
        if (alpha >= beta) {
            // History  bonus
            historyTable[m.from.y][m.from.x][m.to.y][m.to.x] += newDepth * newDepth;
            break;
        }

        // 更新 best
        if (isMax && score > bestScore) { bestScore = score; bestMove = m; }
        if (!isMax && score < bestScore) { bestScore = score; bestMove = m; }
    }

    if (moves.length === 0) { // 被将死
        bestScore = isMax ? -100000 + ply : 100000 - ply;
    }

    // 写回置换表
    let flag: 'exact' | 'lower' | 'upper' =
        bestScore <= oldAlpha ? 'upper' : (bestScore >= beta ? 'lower' : 'exact');
    TT[ttIdx] = { depth, flag, score: bestScore, best: bestMove };

    return [bestScore, bestMove];
}