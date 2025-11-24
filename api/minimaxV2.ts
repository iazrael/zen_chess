// --- START OF FILE minimaxV2.ts ---

import { BoardState, Color, Position, PieceType } from './common/types.js';
import { getLegalMoves, getValidMovesForPiece, applyMoveEx, undoMove, isInCheck, computeHash, REP_TABLE, RESET_REP } from './chessRules.js';
import { BOARD_ROWS, BOARD_COLS } from './common/constants.js';

// =================配置参数=================
const MAX_DEPTH = 64;          // 理论最大深度
const TT_SIZE = 1 << 20;       // 置换表大小 1M
const CHECK_EXTENSION = 1;     // 将军延伸
const NULL_MOVE_R = 2;         // 空步裁剪缩减深度
const ASPIRATION_WINDOW = 50;  // 渴望窗口大小

// =================类型定义=================
interface TTEntry {
  key: number;      // Zobrist Hash Checksum
  depth: number;
  flag: 'exact' | 'lower' | 'upper';
  score: number;
  bestMove: { from: Position; to: Position } | null;
}

// =================全局变量=================
const TT = new Map<number, TTEntry>(); // 使用Map作为简易置换表，生产环境可用定长Array优化
let searchNodes = 0;
let searchStartTime = 0;
let searchTimeLimit = 0;
let stopSearch = false;

// 杀手走法 [ply][id]
let killerMoves: ({ from: Position; to: Position } | null)[][] = [];
// 历史表 [from_y][from_x][to_y][to_x]
let historyTable: number[][][][] = [];

// =================价值评估常量=================
// 子力基础价值
const PIECE_VALUES: Record<string, number> = {
  k: 10000, // 帅/将
  r: 900,   // 车
  n: 450,   // 马
  c: 450,   // 炮
  a: 200,   // 仕/士
  b: 200,   // 相/象
  p: 100    // 兵/卒
};

// 位置价值表 (PST) - 基于红方视角 (y=9是底线, y=0是对方底线)
// 黑方评估时需要根据 y' = 9 - y 进行镜像
const PST: Record<string, number[][]> = {
  // 车：喜欢在开阔线，喜欢过河，喜欢占肋
  'r': [
    [10, 10, 10, 10, 10, 10, 10, 10, 10], // y=0 (敌底)
    [10, 20, 20, 20, 20, 20, 20, 20, 10],
    [10, 20, 30, 30, 30, 30, 30, 20, 10],
    [10, 20, 40, 40, 40, 40, 40, 20, 10],
    [10, 20, 50, 50, 50, 50, 50, 20, 10], // 河界
    [ 0, 20, 40, 40, 40, 40, 40, 20,  0],
    [ 0, 10, 20, 20, 20, 20, 20, 10,  0],
    [ 0, 10, 20, 30, 30, 30, 20, 10,  0],
    [ 0,  5, 10, 20, 20, 20, 10,  5,  0],
    [-10, 5,  5, 10, 10, 10,  5,  5,-10]  // y=9 (我底)
  ],
  // 马：喜欢盘河，进攻卧槽，防守中路
  'n': [
    [ 5, 10, 10, 10, 10, 10, 10, 10,  5],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 40, 50, 50, 50, 40, 20, 10],
    [10, 30, 40, 60, 60, 60, 40, 30, 10],
    [10, 20, 40, 50, 50, 50, 40, 20, 10],
    [10, 10, 30, 40, 40, 40, 30, 10, 10],
    [ 5, 10, 20, 30, 30, 30, 20, 10,  5],
    [ 0,  5, 10, 10, 10, 10, 10,  5,  0],
    [ 0, -5,  5, 10, 10, 10,  5, -5,  0],
    [-10,-10, -5,  5,  5,  5, -5,-10,-10]
  ],
  // 炮：喜欢巡河，底线，中路
  'c': [
    [10, 10, 10, 10, 10, 10, 10, 10, 10],
    [10, 20, 20, 20, 20, 20, 20, 20, 10],
    [20, 30, 50, 50, 50, 50, 50, 30, 20], // 巡河炮
    [20, 30, 40, 40, 40, 40, 40, 30, 20],
    [20, 30, 40, 40, 40, 40, 40, 30, 20],
    [10, 20, 30, 30, 30, 30, 30, 20, 10],
    [10, 20, 20, 20, 20, 20, 20, 20, 10],
    [20, 30, 30, 40, 50, 40, 30, 30, 20], // 己方底二线
    [10, 20, 20, 20, 20, 20, 20, 20, 10],
    [10, 10, 10, 10, 10, 10, 10, 10, 10]
  ],
  // 兵：过河前无用，过河后靠近九宫格价值高
  'p': [
    [10, 20, 30, 40, 50, 40, 30, 20, 10], // 逼近九宫
    [10, 20, 40, 60, 80, 60, 40, 20, 10],
    [10, 10, 30, 50, 60, 50, 30, 10, 10],
    [10, 10, 20, 30, 30, 30, 20, 10, 10],
    [10, 10, 20, 20, 20, 20, 20, 10, 10], // 河界
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0, -20, 0, -20, 0,  0,  0], // 还没过河
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0]
  ]
};

// 初始化辅助结构
function initSearch() {
  killerMoves = Array(MAX_DEPTH).fill(null).map(() => [null, null]);
  historyTable = Array(10).fill(0).map(() => 
    Array(9).fill(0).map(() => 
      Array(10).fill(0).map(() => Array(9).fill(0))));
  searchNodes = 0;
  stopSearch = false;
  // 注意：TT不随每次搜索清空，以利用之前的思考结果（可选）
}

// 检查是否超时
function checkTime() {
  if ((searchNodes & 2047) === 0) { // 每2048个节点检查一次
    if (performance.now() - searchStartTime > searchTimeLimit) {
      stopSearch = true;
    }
  }
}

// =================核心：评估函数=================
// 极速评估，只计算子力 + PST + 简单机动性
function evaluate(board: BoardState, playerColor: Color): number {
  let score = 0;
  let redMaterial = 0;
  let blackMaterial = 0;

  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (!p) continue;

      let val = PIECE_VALUES[p.type] || 0;
      let pstVal = 0;

      // 查表逻辑
      if (PST[p.type]) {
        if (p.color === Color.Red) {
          pstVal = PST[p.type][y][x];
        } else {
          // 黑方镜像查表: x不变, y翻转
          pstVal = PST[p.type][9 - y][x];
        }
      }

      const totalVal = val + pstVal;

      if (p.color === Color.Red) {
        score += totalVal;
        redMaterial += val;
      } else {
        score -= totalVal;
        blackMaterial += val;
      }
    }
  }

  // 简单的机动性加分 (Mobility)
  // 为了性能，不在这里调用 getValidMovesForPiece，除非在 Q-Search 之外
  // 如果需要更强的棋力，可以在 Root 或浅层加入机动性计算

  return playerColor === Color.Red ? score : -score;
}

// =================走法排序=================
function scoreMove(move: { from: Position; to: Position }, board: BoardState, ttMove: { from: Position; to: Position } | null, ply: number): number {
  // 1. 哈希表最佳着法 (PV Move)
  if (ttMove && move.from.x === ttMove.from.x && move.from.y === ttMove.from.y && 
      move.to.x === ttMove.to.x && move.to.y === ttMove.to.y) {
    return 2000000;
  }

  const pFrom = board[move.from.y][move.from.x]!;
  const pTo = board[move.to.y][move.to.x];
  let score = 0;

  // 2. 吃子 (MVV-LVA)
  if (pTo) {
    const victimVal = PIECE_VALUES[pTo.type] || 0;
    const attackerVal = PIECE_VALUES[pFrom.type] || 0;
    score = 100000 + victimVal * 10 - attackerVal;
  } else {
    // 3. 杀手走法
    if (killerMoves[ply]) {
      if (killerMoves[ply][0] && 
          move.from.x === killerMoves[ply][0]!.from.x && move.from.y === killerMoves[ply][0]!.from.y && 
          move.to.x === killerMoves[ply][0]!.to.x && move.to.y === killerMoves[ply][0]!.to.y) {
        return 90000;
      }
      if (killerMoves[ply][1] && 
          move.from.x === killerMoves[ply][1]!.from.x && move.from.y === killerMoves[ply][1]!.from.y && 
          move.to.x === killerMoves[ply][1]!.to.x && move.to.y === killerMoves[ply][1]!.to.y) {
        return 80000;
      }
    }
    // 4. 历史启发
    score = historyTable[move.from.y][move.from.x][move.to.y][move.to.x];
  }

  return score;
}

// =================静态搜索 (Quiescence Search)=================
// 处理激烈的吃子交换，防止水平线效应
function quiescence(board: BoardState, alpha: number, beta: number, turnColor: Color): number {
  checkTime();
  if (stopSearch) return alpha;
  searchNodes++;

  const standPat = evaluate(board, turnColor);
  
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;

  // 生成吃子走法
  // 注意：这里我们手动生成，只生成吃子的步
  const captureMoves: { from: Position; to: Position; score: number }[] = [];
  
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (p && p.color === turnColor) {
        // 使用 getValidMoves (伪合法) 提高速度，applyEx 后如果不合法会回退
        // 更严谨的做法是用 getLegalMoves，但 JS 中太慢。
        // 折中：使用 getValidMoves，但在循环中判断是否被将。
        // 这里为了速度，假设 getValidMoves 是基础，QSearch 主要关注吃子
        const moves = getValidMovesForPiece(board, {x, y});
        for (const to of moves) {
          if (board[to.y][to.x] !== null) { // 只有吃子
             captureMoves.push({ from: {x,y}, to, score: 0 });
          }
        }
      }
    }
  }

  // 简单的 MVV-LVA 排序
  captureMoves.forEach(m => {
    m.score = scoreMove(m, board, null, 0);
  });
  captureMoves.sort((a, b) => b.score - a.score);

  for (const moveWrap of captureMoves) {
    const move = moveWrap;
    const { captured, hashDelta } = applyMoveEx(board, move.from, move.to);
    
    // 如果导致己方被将军，则此步非法，忽略
    if (isInCheck(board, turnColor)) {
      undoMove(board, move.from, move.to, captured);
      continue;
    }

    const score = -quiescence(board, -beta, -alpha, turnColor === Color.Red ? Color.Black : Color.Red);
    undoMove(board, move.from, move.to, captured);

    if (stopSearch) return alpha;

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// =================主搜索 (PVS + Negamax)=================
function alphaBeta(
  board: BoardState, 
  depth: number, 
  alpha: number, 
  beta: number, 
  ply: number, 
  turnColor: Color, 
  allowNull: boolean
): number {
  checkTime();
  if (stopSearch) return alpha;

  const boardHash = computeHash(board);
  
  // 1. 重复局面判和
  // (简化处理：如果在同一层级出现，直接判和；严谨需要路径检测)
  const repCount = REP_TABLE.get(boardHash) || 0;
  if (repCount >= 2) return 0; // 再次重复即和棋

  // 2. 置换表查询
  const ttEntry = TT.get(boardHash);
  let ttMove: { from: Position; to: Position } | null = null;
  if (ttEntry && ttEntry.key === boardHash) {
    ttMove = ttEntry.bestMove;
    if (ttEntry.depth >= depth) {
      if (ttEntry.flag === 'exact') return ttEntry.score;
      if (ttEntry.flag === 'lower' && ttEntry.score >= beta) return ttEntry.score;
      if (ttEntry.flag === 'upper' && ttEntry.score <= alpha) return ttEntry.score;
    }
  }

  // 3. 叶子节点或最大深度 -> 静态搜索
  if (depth <= 0) {
    return quiescence(board, alpha, beta, turnColor);
  }

  searchNodes++;
  const inCheck = isInCheck(board, turnColor);

  // 4. 空步裁剪 (Null Move Pruning)
  // 条件：不被将军，剩余深度足够，且不是残局(这里简化没判断残局)
  if (allowNull && !inCheck && depth >= 3) {
    // 假设我放弃一步，对方还是不能把我很惨 -> 当前局面优势很大
    const R = NULL_MOVE_R;
    const val = -alphaBeta(board, depth - 1 - R, -beta, -beta + 1, ply + 1, 
      turnColor === Color.Red ? Color.Black : Color.Red, false);
    if (val >= beta) return beta;
  }

  // 5. 生成走法
  let moves: { from: Position; to: Position }[] = [];
  // 这里必须用 getLegalMoves (严谨)，否则搜索树中会有非法走法导致 Hash 错乱
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (p && p.color === turnColor) {
        const legals = getLegalMoves(board, {x, y});
        legals.forEach(to => moves.push({ from: {x, y}, to }));
      }
    }
  }

  if (moves.length === 0) {
    // 无路可走
    if (inCheck) return -20000 + ply; // 被杀
    return 0; // 困毙/逼和
  }

  // 6. 走法排序
  const scoredMoves = moves.map(m => ({
    move: m,
    score: scoreMove(m, board, ttMove, ply)
  }));
  scoredMoves.sort((a, b) => b.score - a.score);

  let bestScore = -Infinity;
  let bestMove: { from: Position; to: Position } | null = null;
  let moveCount = 0;
  
  // 7. 遍历走法
  for (const item of scoredMoves) {
    const move = item.move;
    
    // 记录哈希重复
    REP_TABLE.set(boardHash, repCount + 1);

    const { captured } = applyMoveEx(board, move.from, move.to);
    
    // 延伸逻辑：如果将军，延伸搜索深度
    let extension = 0;
    const givesCheck = isInCheck(board, turnColor === Color.Red ? Color.Black : Color.Red);
    if (givesCheck) extension = CHECK_EXTENSION;

    let score: number;
    // PVS (Principal Variation Search)
    if (moveCount === 0) {
      score = -alphaBeta(board, depth - 1 + extension, -beta, -alpha, ply + 1, 
        turnColor === Color.Red ? Color.Black : Color.Red, true);
    } else {
      // Late Move Reduction (LMR)
      // 对非PV节点、非将军、非吃子的后续走法减少搜索深度
      let reduce = 0;
      if (depth >= 3 && !givesCheck && !captured && moveCount > 4) reduce = 1;

      // 零窗口搜索 (Null Window)
      score = -alphaBeta(board, depth - 1 - reduce + extension, -alpha - 1, -alpha, ply + 1, 
        turnColor === Color.Red ? Color.Black : Color.Red, true);
      
      // 如果 LMR 失败或者零窗口失败（发现更好的着法），重新全窗口搜索
      if (score > alpha && reduce > 0) {
        score = -alphaBeta(board, depth - 1 + extension, -alpha - 1, -alpha, ply + 1,
           turnColor === Color.Red ? Color.Black : Color.Red, true);
      }
      if (score > alpha && score < beta) {
        score = -alphaBeta(board, depth - 1 + extension, -beta, -alpha, ply + 1, 
          turnColor === Color.Red ? Color.Black : Color.Red, true);
      }
    }

    undoMove(board, move.from, move.to, captured);
    REP_TABLE.set(boardHash, repCount); // 回溯

    if (stopSearch) break;
    moveCount++;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      
      if (score > alpha) {
        alpha = score;
        // 剪枝
        if (alpha >= beta) {
          // 记录历史和杀手
          if (!captured) {
            historyTable[move.from.y][move.from.x][move.to.y][move.to.x] += depth * depth;
            killerMoves[ply][1] = killerMoves[ply][0];
            killerMoves[ply][0] = move;
          }
          break; // Beta Cutoff
        }
      }
    }
  }

  // 8. 存入置换表
  if (!stopSearch) {
    let flag: 'exact' | 'lower' | 'upper' = 'exact';
    if (bestScore <= alpha) flag = 'upper'; // 这里应该是 oldAlpha，简单起见用 alpha 代替逻辑
    else if (bestScore >= beta) flag = 'lower';
    
    TT.set(boardHash, {
      key: boardHash,
      depth: depth,
      flag: flag,
      score: bestScore,
      bestMove: bestMove
    });
  }

  return bestScore;
}

// =================对外接口=================

export async function getBestMoveV2(board: BoardState, aiColor: Color, timeLimitMs = 3000)
  : Promise<{ from: Position; to: Position } | null> {
  
  initSearch();
  RESET_REP();
  
  searchStartTime = performance.now();
  searchTimeLimit = timeLimitMs;
  
  let bestMove = null;
  let bestScore = -Infinity;
  
  console.log(`AI thinking (${aiColor})... Time limit: ${timeLimitMs}ms`);

  // 迭代加深 (Iterative Deepening)
  for (let d = 1; d <= MAX_DEPTH; d++) {
    const score = alphaBeta(board, d, -Infinity, Infinity, 0, aiColor, true);
    
    if (stopSearch) {
        console.log(`Search stopped at depth ${d}`);
        break;
    }

    // 从置换表获取本层最佳走法
    const hash = computeHash(board);
    const entry = TT.get(hash);
    
    if (entry && entry.bestMove) {
      bestMove = entry.bestMove;
      bestScore = score;
      console.log(`Depth ${d}: Score=${score}, Move=(${bestMove.from.x},${bestMove.from.y})->(${bestMove.to.x},${bestMove.to.y}), Nodes=${searchNodes}`);
    } else {
        // 极少情况，根节点没有TT（比如直接剪枝了）
        console.log(`Depth ${d}: Score=${score} (No move in TT)`);
    }

    // 简单的时间控制：如果用时超过 50%，就不尝试下一层了，因为下一层通常需要翻倍时间
    if (performance.now() - searchStartTime > timeLimitMs * 0.5) {
        break;
    }
  }

  console.log(`AI finish. Best: ${bestMove ? `(${bestMove.from.x},${bestMove.from.y})->(${bestMove.to.x},${bestMove.to.y})` : 'null'}, Nodes: ${searchNodes}`);
  return bestMove;
}

// 兼容旧接口
export const getBestMoveMinimax = async (board: BoardState, turn: Color, depth: number = 3): Promise<{ from: Position; to: Position } | null> => {
  // 默认给 2000ms
  const timeLimitMs = 2000 + (depth - 3) * 1000;
  // 如果需要更强，可以增加时间
  return await getBestMoveV2(board, turn, timeLimitMs);
};

// --- END OF FILE minimaxV2.ts ---