// --- START OF FILE minimaxV3.ts ---

import { BoardState, Color, Position, PieceType } from './common/types.js';
import { getLegalMoves, getValidMovesForPiece, applyMoveEx, undoMove, isInCheck, computeHash, REP_TABLE, RESET_REP, isCheck } from './chessRules.js';
import { BOARD_ROWS, BOARD_COLS } from './common/constants.js';

// =================配置参数=================
const MAX_DEPTH = 64;           // 极限深度
const TIME_CHECK_INTERVAL = 2048; 
const ASPIRATION_WINDOW = 50;   
const R_NULL_MOVE = 2;          // 空步裁剪 R值
const FUTILITY_MARGIN = [0, 200, 400, 600]; // 深度1-3的剪枝容忍度

// =================子力价值=================
// 重新调整价值，拉大子力差距，避免随意弃子
const MG_VAL: Record<string, number> = { // 中局价值
  k: 20000, r: 900, n: 430, c: 450, a: 200, b: 200, p: 100
};
// 简单的动态价值修正（机动性每步加分）
const MOBILITY_BONUS: Record<string, number> = {
  r: 4, n: 3, c: 2, k: 0, a: 0, b: 0, p: 0
};

// =================类型定义=================
interface TTEntry {
  key: number;
  depth: number;
  flag: 0 | 1 | 2; // 0:Exact, 1:Lower(Alpha), 2:Upper(Beta)
  score: number;
  bestMove: MoveSimple | null;
}
interface MoveSimple { from: Position; to: Position }

// =================全局变量=================
const TT = new Map<number, TTEntry>(); 
let searchNodes = 0;
let searchStartTime = 0;
let searchTimeLimit = 0;
let stopSearch = false;
// 杀手走法 [ply][2]
let killerMoves: (MoveSimple | null)[][] = [];
// 历史表 [from][to] (简化为一维数组索引 90*90 优化性能)
let historyTable: number[] = new Array(90 * 90).fill(0);

// 索引辅助
const idx = (x: number, y: number) => y * 9 + x;

// 检查是否超时
function checkTime() {
  if ((searchNodes & 2047) === 0) { // 每2048个节点检查一次
    if (performance.now() - searchStartTime > searchTimeLimit) {
      stopSearch = true;
    }
  }
}
// ================= 核心 1: 静态交换评估 (SEE) =================
// 这是一个简化版的 SEE，用于判断吃子是否划算
// 返回值 > 0 表示赚了， < 0 表示亏了
function staticExchangeEvaluation(board: BoardState, move: MoveSimple, color: Color): number {
  const target = board[move.to.y][move.to.x];
  if (!target) return 0;

  const attackerVal = MG_VAL[board[move.from.y][move.from.x]!.type];
  const victimVal = MG_VAL[target.type];

  // 1. 如果是用低价值子吃高价值子（如兵吃车），永远是赚的
  if (victimVal > attackerVal) return victimVal - attackerVal;

  // 2. 检查是否有根（受保护）
  const defended = isSquareDefended(board, move.to, color === Color.Red ? Color.Black : Color.Red);

  // 如果没根，直接白吃
  if (!defended) return victimVal;

  // 3. 如果有根，计算交换损益
  const tradeScore = victimVal - attackerVal;

  // === 关键修复：节奏惩罚 ===
  // 如果是等价交换（如炮换马 450换450，车换车 900换900）
  // 进攻方通常是亏的（浪费了走子机会，且往往帮对方调整了阵型）
  if (tradeScore === 0) {
    // 给予 -50 的惩罚，告诉 AI：除非没棋走了，否则别主动去换子
    return -50;
  }

  // 如果是亏损交换（如车换马），直接返回负值
  return tradeScore;
}

// 检查 pos 是否被 defenderColor 保护
function isSquareDefended(board: BoardState, pos: Position, defenderColor: Color): boolean {
  // 遍历防守方所有棋子，看是否有人能走到 pos
  // 为了性能，只检查周围和直线
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (p && p.color === defenderColor) {
        // 这里为了速度，我们假设所有能攻击到该点的都是保护者
        // 严谨做法是调 getValidMoves，但太慢。
        // V3 优化：只做简单几何判断
        const dx = Math.abs(x - pos.x);
        const dy = Math.abs(y - pos.y);
        
        // 车/炮：直线且中间无阻隔(车)或一个阻隔(炮) -> 简化为只检查直线
        if ((p.type === 'r' || p.type === 'c') && (x === pos.x || y === pos.y)) return true;
        // 马：日字 (简化不看蹩腿)
        if (p.type === 'n' && ((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) return true;
        // 将/士：在九宫
        if ((p.type === 'k' || p.type === 'a') && dx <= 1 && dy <= 1) return true;
        // 象：田字
        if (p.type === 'b' && dx === 2 && dy === 2) return true;
        // 兵：过河前直线，过河后横线
        if (p.type === 'p') {
            // 简化：只要挨着就算保护
            if (dx + dy === 1) return true;
        }
      }
    }
  }
  return false;
}

// ================= 核心 2: 增强评估函数 =================
function evaluateV3(board: BoardState, playerColor: Color): number {
  let redScore = 0;
  let blackScore = 0;
  
  // 寻找将的位置，用于计算将帅安全
  let redKingPos = { x: 4, y: 9 };
  let blackKingPos = { x: 4, y: 0 };

  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (!p) continue;
      
      // 1. 基础材质分
      let score = MG_VAL[p.type];
      
      // 2. 位置分 (PST) - 沿用 V2 的 PST 数据，但逻辑内联以提速
      score += getPstValue(p.type, p.color, x, y);

      if (p.type === 'k') {
        if (p.color === Color.Red) redKingPos = {x, y};
        else blackKingPos = {x, y};
      }

      if (p.color === Color.Red) redScore += score;
      else blackScore += score;
    }
  }

  // 3. 动态机动性与威胁评估 (只对大子计算)
  // 这是一个 O(N) 的遍历，为了性能，我们不使用 getLegalMoves，而是简单统计
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (!p || (p.type !== 'r' && p.type !== 'n' && p.type !== 'c')) continue;

      const isRed = p.color === Color.Red;
      const enemyKing = isRed ? blackKingPos : redKingPos;
      
      // A. 进攻威胁：大子距离敌方将帅的距离
      const dist = Math.abs(x - enemyKing.x) + Math.abs(y - enemyKing.y);
      let threatBonus = 0;
      if (dist < 4) threatBonus = 30; // 逼近九宫
      else if (dist < 6) threatBonus = 15;

      // B. 简单机动性 (Mobility)
      // 这里的计算非常简略，只看周围空位，避免 heavy logic
      let mobility = 0;
      if (p.type === 'r') mobility = 5; // 车假设机动性好
      if (p.type === 'n') mobility = 3; 
      
      const total = threatBonus + mobility * MOBILITY_BONUS[p.type];
      
      if (isRed) redScore += total;
      else blackScore += total;
    }
  }

  return playerColor === Color.Red ? (redScore - blackScore) : (blackScore - redScore);
}

// 简化的 PST 查找
function getPstValue(type: string, color: Color, x: number, y: number): number {
  // 复用 V2 的 PST 表结构，这里硬编码减少依赖
  // 如果是黑方，y = 9 - y
  const py = color === Color.Red ? y : 9 - y;
  
  // 简单示例：兵过河加分，车占肋道加分
  if (type === 'p') {
    if (py < 5) return 30 + (py < 3 ? 20 : 0); // 过河且逼近底线
    return 0;
  }
  if (type === 'r') {
    if (x === 4) return -10; // 占中反而不好（容易被炮打）
    if (x === 3 || x === 5) return 10; // 肋道好
    return 0;
  }
  if (type === 'n') {
     if (py < 5) return 15; // 卧槽马/过河马
     return 0;
  }
  if (type === 'c') {
      if (x === 4) return 20; // 中炮
      return 0;
  }
  return 0;
}


// ================= 搜索辅助 =================

function orderMoves(moves: MoveSimple[], board: BoardState, ttMove: MoveSimple | null, ply: number, turnColor: Color) {
  return moves.map(move => {
    let score = 0;
    
    // 1. Hash Move (PV)
    if (ttMove && move.from.x === ttMove.from.x && move.from.y === ttMove.from.y && 
        move.to.x === ttMove.to.x && move.to.y === ttMove.to.y) {
      score = 2000000;
    } else {
        const pFrom = board[move.from.y][move.from.x]!;
        const pTo = board[move.to.y][move.to.x];

        // 2. 吃子 (MVV-LVA + SEE)
        if (pTo) {
            const mvv = MG_VAL[pTo.type] * 10 - MG_VAL[pFrom.type];
            // 使用 SEE 修正：如果亏损交换，分值大幅降低
            const see = staticExchangeEvaluation(board, move, turnColor);
            if (see < 0) score = -10000 + see; // 亏损
            else score = 100000 + mvv + see;   // 赚钱
        } else {
            // 3. 杀手走法
            if (killerMoves[ply] && killerMoves[ply][0] && isSameMove(move, killerMoves[ply][0]!)) score = 9000;
            else if (killerMoves[ply] && killerMoves[ply][1] && isSameMove(move, killerMoves[ply][1]!)) score = 8000;
            else {
                // 4. 历史启发
                const hIdx = idx(move.from.x, move.from.y) * 90 + idx(move.to.x, move.to.y);
                score = historyTable[hIdx];
            }
        }
    }
    return { move, score };
  }).sort((a, b) => b.score - a.score).map(x => x.move);
}

function isSameMove(a: MoveSimple, b: MoveSimple) {
    return a.from.x === b.from.x && a.from.y === b.from.y && a.to.x === b.to.x && a.to.y === b.to.y;
}

// ================= 静态搜索 (Q-Search) =================
function qSearch(board: BoardState, alpha: number, beta: number, turnColor: Color): number {
    checkTime();
    if (stopSearch) return alpha;
    searchNodes++;

    const standPat = evaluateV3(board, turnColor);
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    // 生成吃子走法
    const captures: MoveSimple[] = [];
    for (let y = 0; y < BOARD_ROWS; y++) {
        for (let x = 0; x < BOARD_COLS; x++) {
            const p = board[y][x];
            if (p && p.color === turnColor) {
                const moves = getValidMovesForPiece(board, {x,y});
                for (const to of moves) {
                    if (board[to.y][to.x]) captures.push({from: {x,y}, to});
                }
            }
        }
    }

    // SEE 剪枝与排序
    const goodCaptures = captures.filter(m => {
        // 剪枝：如果 SEE < 0 (亏损交换)，不仅不搜，而且大概率是坏棋
        return staticExchangeEvaluation(board, m, turnColor) >= 0;
    });

    // 简单排序
    goodCaptures.sort((a, b) => {
        const valA = MG_VAL[board[a.to.y][a.to.x]!.type];
        const valB = MG_VAL[board[b.to.y][b.to.x]!.type];
        return valB - valA;
    });

    for (const move of goodCaptures) {
        const { captured, hashDelta } = applyMoveEx(board, move.from, move.to);
        
        // 合法性检查
        if (isCheck(board, turnColor)) {
            undoMove(board, move.from, move.to, captured);
            continue;
        }

        const score = -qSearch(board, -beta, -alpha, turnColor === Color.Red ? Color.Black : Color.Red);
        undoMove(board, move.from, move.to, captured);

        if (stopSearch) return alpha;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }

    return alpha;
}

// ================= 主搜索 Alpha-Beta =================
function search(
    board: BoardState, 
    depth: number, 
    alpha: number, 
    beta: number, 
    ply: number, 
    turnColor: Color, 
    canNull: boolean
): number {
    checkTime();
    if (stopSearch) return alpha;

    // 1. 判和与重复
    const boardHash = computeHash(board);
    const rep = REP_TABLE.get(boardHash) || 0;
    if (rep >= 2) return 0; // 0分表示和棋

    // 2. 置换表 (TT)
    const ttEntry = TT.get(boardHash);
    let ttMove: MoveSimple | null = null;
    if (ttEntry && ttEntry.key === boardHash) {
        ttMove = ttEntry.bestMove;
        if (ttEntry.depth >= depth) {
            if (ttEntry.flag === 0) return ttEntry.score;
            if (ttEntry.flag === 1 && ttEntry.score >= beta) return ttEntry.score; // Lower bound
            if (ttEntry.flag === 2 && ttEntry.score <= alpha) return ttEntry.score; // Upper bound
        }
    }

    if (depth <= 0) return qSearch(board, alpha, beta, turnColor);

    searchNodes++;
    const inCheck = isCheck(board, turnColor);

    // 3. 无用剪枝 (Futility Pruning) - V3 新增
    // 如果不被将军，且静态估值远低于 Alpha，且没有杀手步，直接剪掉
    if (!inCheck && depth <= 3 && !ttMove) {
        const staticEval = evaluateV3(board, turnColor);
        if (staticEval + FUTILITY_MARGIN[depth] < alpha) {
            // 这是一个悲观剪枝，假设最好的几步棋也加不了这么多分
             // 慎用：中国象棋战术复杂，剪枝过于激进会漏杀。这里只在浅层尝试。
             // return qSearch(board, alpha, beta, turnColor); // 也可以转入QS
        }
    }

    // 4. 空步裁剪 (Null Move)
    if (canNull && !inCheck && depth >= 3) {
        // 尝试放弃一步
        const R = R_NULL_MOVE + (depth > 6 ? 1 : 0);
        const nmScore = -search(board, depth - 1 - R, -beta, -beta + 1, ply + 1, turnColor === Color.Red ? Color.Black : Color.Red, false);
        if (nmScore >= beta) return beta;
    }

    // 5. 生成并排序走法
    const rawMoves: MoveSimple[] = [];
    // V3: 必须使用 LegalMoves 以保证哈希正确性，但为了速度，我们可以优化 getLegalMoves 的内部实现
    // 这里还是调用通用的 getLegalMoves
    const pieces: MoveSimple[] = [];
    for(let y=0; y<BOARD_ROWS; y++) 
        for(let x=0; x<BOARD_COLS; x++) 
            if(board[y][x] && board[y][x]!.color === turnColor) pieces.push({from:{x,y}, to:{x,y}}); // to is dummy
    
    for(const p of pieces) {
        const moves = getLegalMoves(board, p.from);
        for(const to of moves) rawMoves.push({from: p.from, to});
    }

    if (rawMoves.length === 0) {
        return inCheck ? -20000 + ply : 0;
    }

    const moves = orderMoves(rawMoves, board, ttMove, ply, turnColor);

    // 6. 遍历
    let bestScore = -Infinity;
    let bestMove: MoveSimple | null = null;
    let moveCount = 0;

    for (const move of moves) {
        // 更新哈希计数
        REP_TABLE.set(boardHash, rep + 1);

        const { captured } = applyMoveEx(board, move.from, move.to);
        
        let score: number;
        let extension = 0;
        // 进阶：如果将军，或者杀到对方大子，延伸搜索
        const givesCheck = isCheck(board, turnColor === Color.Red ? Color.Black : Color.Red);
        if (givesCheck) extension = 1;

        // PVS
        if (moveCount === 0) {
            score = -search(board, depth - 1 + extension, -beta, -alpha, ply + 1, 
                turnColor === Color.Red ? Color.Black : Color.Red, true);
        } else {
            // LMR (Late Move Reduction)
            let reduce = 0;
            if (depth >= 3 && !givesCheck && !captured && moveCount > 4) reduce = 1;
            if (moveCount > 10) reduce = 2;

            score = -search(board, depth - 1 - reduce + extension, -alpha - 1, -alpha, ply + 1,
                turnColor === Color.Red ? Color.Black : Color.Red, true);
            
            if (score > alpha && reduce > 0) {
                 score = -search(board, depth - 1 + extension, -alpha - 1, -alpha, ply + 1,
                    turnColor === Color.Red ? Color.Black : Color.Red, true);
            }
            if (score > alpha && score < beta) {
                score = -search(board, depth - 1 + extension, -beta, -alpha, ply + 1, 
                    turnColor === Color.Red ? Color.Black : Color.Red, true);
            }
        }

        undoMove(board, move.from, move.to, captured);
        REP_TABLE.set(boardHash, rep);

        if (stopSearch) break;
        moveCount++;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
            if (score > alpha) {
                alpha = score;
                if (alpha >= beta) {
                    // History & Killer
                    if (!captured) {
                        const hIdx = idx(move.from.x, move.from.y) * 90 + idx(move.to.x, move.to.y);
                        historyTable[hIdx] += depth * depth;
                        if(historyTable[hIdx] > 10000000) historyTable = historyTable.map(h => h >> 1); // Aging

                        killerMoves[ply] = killerMoves[ply] || [null, null];
                        killerMoves[ply][1] = killerMoves[ply][0];
                        killerMoves[ply][0] = move;
                    }
                    break;
                }
            }
        }
    }

    // 存 TT
    if (!stopSearch) {
        TT.set(boardHash, {
            key: boardHash,
            depth: depth,
            flag: bestScore <= alpha ? 2 : (bestScore >= beta ? 1 : 0), // Upper : Lower : Exact
            score: bestScore,
            bestMove: bestMove
        });
    }

    return bestScore;
}


// ================= 入口 =================
export async function getBestMoveV3(board: BoardState, aiColor: Color, timeLimitMs = 3000)
  : Promise<{ from: Position; to: Position } | null> {
  
  // 初始化
  killerMoves = Array(MAX_DEPTH).fill(null);
  searchNodes = 0;
  stopSearch = false;
  searchStartTime = performance.now();
  searchTimeLimit = timeLimitMs;
  RESET_REP();

  let bestMove = null;
  let bestScore = -Infinity;

  console.log(`[Minimax V3] Start. Color: ${aiColor}, Time: ${timeLimitMs}`);

  // 迭代加深
  for (let d = 1; d <= MAX_DEPTH; d++) {
    const score = search(board, d, -Infinity, Infinity, 0, aiColor, true);
    
    if (stopSearch) break;

    // 提取最佳步
    const hash = computeHash(board);
    const entry = TT.get(hash);
    if (entry && entry.bestMove) {
        bestMove = entry.bestMove;
        bestScore = score;
        console.log(`Depth ${d}: Score ${score}, Move ${bestMove.from.x},${bestMove.from.y}->${bestMove.to.x},${bestMove.to.y}, Nodes ${searchNodes}`);
    }

    // 时间检查
    if (performance.now() - searchStartTime > timeLimitMs * 0.4) break; 
  }

  return bestMove;
}

export const getBestMoveMinimax = async (board: BoardState, turn: Color, depth: number = 3): Promise<{ from: Position; to: Position } | null> => {
    // 默认给 3秒思考时间
    const timeLimitMs = 3000 + (depth - 3) * 1000;
    return await getBestMoveV3(board, turn, timeLimitMs);
};

// --- END OF FILE minimaxV3.ts ---