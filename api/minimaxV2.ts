import { BoardState, Color, Position, Piece } from './common/types.js';
import { getLegalMoves, applyMoveEx, undoMove, evaluateBoard, isInCheck, computeHash, REP_TABLE, RESET_REP } from './chessRules.js';

// 配置参数
const MAX_DEPTH = 12;          // 迭代加深上限
const TT_SIZE   = 1 << 20;     // 百万条目，约 16 MB
const EXTENSION = 1;           // 将军延伸层数

// 置换表条目接口
interface TTEntry {
  depth: number;
  flag : 'exact' | 'lower' | 'upper';
  score: number;
  best : { from: Position; to: Position } | null;
}

// 置换表
const TT: (TTEntry | undefined)[] = new Array(TT_SIZE);

// 节点计数
let nodes = 0;

// 历史表 - 用于走子顺序优化
let historyTable: number[][][][] = []; // historyTable[y1][x1][y2][x2]

// 初始化历史表
function initHistory() {
  historyTable = Array(10).fill(0).map(() =>
    Array(9).fill(0).map(() =>
      Array(10).fill(0).map(() => Array(9).fill(0))));
}

// 走子排序函数 - 基于吃子价值、将军状态和历史启发
function sortMoves(moves: { from: Position; to: Position }[], board: BoardState, ttBestMove: { from: Position; to: Position } | null) {
  const moveScores: { move: { from: Position; to: Position }; score: number }[] = [];
  
  // 给每个走法打分
  for (const move of moves) {
    let score = 0;
    
    // 1. 如果是置换表推荐的最佳走法，给最高分
    if (ttBestMove && 
        move.from.x === ttBestMove.from.x && 
        move.from.y === ttBestMove.from.y && 
        move.to.x === ttBestMove.to.x && 
        move.to.y === ttBestMove.to.y) {
      score = 1000000;
    }
    
    // 2. 吃子评分
    const targetPiece = board[move.to.y][move.to.x];
    if (targetPiece) {
      // 简化的MVV-LVA（Most Valuable Victim - Least Valuable Aggressor）
      const pieceValues: Record<string, number> = {
        'k': 10000,
        'a': 20,
        'b': 20,
        'n': 40,
        'r': 90,
        'c': 45,
        'p': 10
      };
      const attackerValue = pieceValues[board[move.from.y][move.from.x]!.type] || 0;
      const victimValue = pieceValues[targetPiece.type] || 0;
      score = victimValue * 10 - attackerValue;
    }
    
    // 3. 历史启发评分
    score += historyTable[move.from.y][move.from.x][move.to.y][move.to.x];
    
    // 4. 将军检查（需要模拟走子后检查）
    const tempBoard = board.map(row => row.slice());
    const { captured: capturedPiece } = applyMoveEx(tempBoard, move.from, move.to);
    const turnColor = board[move.from.y][move.from.x]!.color;
    const opponentColor = turnColor === Color.Red ? Color.Black : Color.Red;
    if (isInCheck(tempBoard, opponentColor)) {
      score += 100; // 将军加分
    }
    undoMove(tempBoard, move.from, move.to, capturedPiece);
    
    moveScores.push({ move, score });
  }
  
  // 按分数降序排序
  moveScores.sort((a, b) => b.score - a.score);
  
  // 返回排序后的走法
  return moveScores.map(ms => ms.move);
}

// 增强的评估函数
function enhancedEvaluateBoard(board: BoardState, playerColor: Color): number {
  let score = 0;
  
  // 基础子力价值
  const values: Record<string, number> = {
    k: 10000,
    a: 20,
    b: 20,
    n: 40,
    r: 90,
    c: 45,
    p: 10
  };
  
  // 位置价值表 - 基于经验值
  const positionBonus: Record<string, number[][]> = {
    // 红方车的位置价值
    'r': [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [2, 2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 3, 3, 3, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ],
    // 红方马的位置价值
    'n': [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 3, 0, 3, 0, 0, 0],
      [0, 0, 3, 4, 3, 4, 3, 0, 0],
      [0, 0, 0, 3, 4, 3, 0, 0, 0],
      [0, 0, 3, 4, 3, 4, 3, 0, 0],
      [0, 0, 0, 3, 4, 3, 0, 0, 0],
      [0, 0, 2, 0, 0, 0, 2, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ],
    // 红方炮的位置价值
    'c': [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0, 0, 2, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 0, 3, 0, 0, 1, 1],
      [1, 1, 0, 2, 0, 2, 0, 1, 1],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ],
    // 红方兵的位置价值（过河前）
    'p': [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [2, 0, 2, 0, 5, 0, 2, 0, 2],
      [1, 0, 1, 0, 3, 0, 1, 0, 1],
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
  };
  
  // 机动性评分（每个棋子能走多少步）
  let mobilityScore = 0;
  
  // 将帅安全评分
  let kingSafetyScore = 0;
  
  // 遍历棋盘
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[0].length; x++) {
      const piece = board[y][x];
      if (!piece) continue;
      
      const pieceValue = values[piece.type] || 0;
      const colorFactor = (piece.color === playerColor) ? 1 : -1;
      
      // 1. 子力价值
      score += pieceValue * colorFactor;
      
      // 2. 位置价值
      if (positionBonus[piece.type] && piece.color === Color.Red) {
        score += positionBonus[piece.type][y][x] * colorFactor;
      } else if (positionBonus[piece.type] && piece.color === Color.Black) {
        // 黑方位置价值是红方的镜像
        const mirrorY = 9 - y;
        score += positionBonus[piece.type][mirrorY][x] * colorFactor;
      }
      
      // 3. 过河兵奖励
      if (piece.type === 'p') {
        if (piece.color === Color.Red && y < 5) {
          score += 10 * colorFactor; // 红兵过河
        } else if (piece.color === Color.Black && y > 4) {
          score += 10 * colorFactor; // 黑兵过河
        }
        
        // 高线兵奖励
        if (piece.color === Color.Red && y < 3) {
          score += 20 * colorFactor; // 红兵到对方九宫附近
        } else if (piece.color === Color.Black && y > 6) {
          score += 20 * colorFactor; // 黑兵到对方九宫附近
        }
      }
      
      // 4. 机动性评分
      const legalMoves = getLegalMoves(board, { x, y });
      mobilityScore += legalMoves.length * colorFactor * 0.5; // 机动性权重
    }
  }
  
  // 5. 将军安全评分
  const isPlayerInCheck = isInCheck(board, playerColor);
  const isOpponentInCheck = isInCheck(board, playerColor === Color.Red ? Color.Black : Color.Red);
  
  if (isPlayerInCheck) {
    kingSafetyScore -= 50; // 被将军扣分
  }
  if (isOpponentInCheck) {
    kingSafetyScore += 50; // 将军对方加分
  }
  
  // 6. 基本棋型识别
  // 这里可以添加更多棋型识别，如连环马、空头炮等
  
  // 组合所有评分因素
  score += mobilityScore;
  score += kingSafetyScore;
  
  return score;
}

// 迭代加深入口，返回最佳走法
export async function getBestMoveV2(board: BoardState, aiColor: Color, timeLimitMs = 3000)
  : Promise<{ from: Position; to: Position } | null> {
  nodes = 0;
  RESET_REP();                       // 清空重复检测
  initHistory();
  
  // 清空置换表
  for (let i = 0; i < TT_SIZE; i++) {
    TT[i] = undefined;
  }
  
  const start = performance.now();
  let bestMove = null;
  let bestScore = -Infinity;
  
  // 迭代加深搜索
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const [score, move] = pvSearch(board, depth, -Infinity, Infinity, true, aiColor, 0);
    
    if (move) {
      bestMove = move;
      bestScore = score;
    }
    
    // 时间控制 - 保留20%余量
    const elapsed = performance.now() - start;
    if (elapsed > timeLimitMs * 0.8) break;
    
    console.log(`Depth ${depth} completed. Score: ${score}, Nodes: ${nodes}, Time: ${elapsed.toFixed(2)}ms`);
  }
  
  console.log(`Final move: ${bestMove ? `(${bestMove.from.x},${bestMove.from.y})->(${bestMove.to.x},${bestMove.to.y})` : 'null'}, Score: ${bestScore}, Total nodes: ${nodes}`);
  
  return bestMove;
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
  
  const turnColor = isMax ? aiColor : (aiColor === Color.Red ? Color.Black : Color.Red);
  const hash = computeHash(board);
  
  // 重复局面判和（三次重复）
  const repCount = REP_TABLE.get(hash) || 0;
  if (ply > 0 && repCount >= 3) {
    return [0, null]; // 和棋
  }
  
  // 置换表查询
  const ttIdx = hash & (TT_SIZE - 1);
  const ttEntry = TT[ttIdx];
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'exact') {
      return [ttEntry.score, ttEntry.best];
    }
    if (ttEntry.flag === 'lower' && ttEntry.score >= beta) {
      return [ttEntry.score, ttEntry.best];
    }
    if (ttEntry.flag === 'upper' && ttEntry.score <= alpha) {
      return [ttEntry.score, ttEntry.best];
    }
  }
  
  // 叶子节点或深度耗尽
  if (depth <= 0) {
    // 使用增强的评估函数
    return [enhancedEvaluateBoard(board, aiColor), null];
  }
  
  // 将军延伸
  const inCheck = isInCheck(board, turnColor);
  const extension = inCheck ? EXTENSION : 0;
  const newDepth = depth + extension;
  
  // 生成所有合法走法
  const allMoves: { from: Position; to: Position }[] = [];
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[0].length; x++) {
      const piece = board[y][x];
      if (piece && piece.color === turnColor) {
        const moves = getLegalMoves(board, { x, y });
        moves.forEach(to => allMoves.push({ from: { x, y }, to }));
      }
    }
  }
  
  // 走子排序优化
  const sortedMoves = sortMoves(allMoves, board, ttEntry?.best || null);
  
  let bestMove: { from: Position; to: Position } | null = null;
  let bestScore = isMax ? -Infinity : Infinity;
  let oldAlpha = alpha;
  let isPVNode = true;
  
  // 遍历所有走法
  for (const move of sortedMoves) {
    // 更新重复局面表
    REP_TABLE.set(hash, repCount + 1);
    
    // 应用走子
    const { captured, hashDelta } = applyMoveEx(board, move.from, move.to);
    
    let score: number;
    
    // PVS搜索 - 第一个走法用全窗口，后续用零窗口
    if (isPVNode) {
      // 主变搜索 - 全窗口
      [score] = pvSearch(board, newDepth - 1, alpha, beta, !isMax, aiColor, ply + 1);
    } else {
      // 零窗口搜索
      [score] = pvSearch(board, newDepth - 1, alpha, alpha + 1, !isMax, aiColor, ply + 1);
      
      // 如果零窗口失败，重新用全窗口搜索
      if (score > alpha && score < beta) {
        [score] = pvSearch(board, newDepth - 1, score, beta, !isMax, aiColor, ply + 1);
      }
    }
    
    // 撤销走子
    undoMove(board, move.from, move.to, captured);
    REP_TABLE.set(hash, repCount);
    
    // 更新最佳值
    if (isMax) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score < beta) {
        beta = score;
      }
    }
    
    // 剪枝检测
    if (alpha >= beta) {
      // 历史表奖励 - 成功剪枝的走法获得高分
      historyTable[move.from.y][move.from.x][move.to.y][move.to.x] += newDepth * newDepth;
      break;
    }
    
    // 不是PV节点了
    isPVNode = false;
  }
  
  // 无合法走法 - 将死或困毙
  if (sortedMoves.length === 0) {
    // 被将死的情况，根据距离根节点的距离调整分数
    return [isMax ? -100000 + ply : 100000 - ply, null];
  }
  
  // 写入置换表
  let ttFlag: 'exact' | 'lower' | 'upper';
  if (bestScore <= oldAlpha) {
    ttFlag = 'upper';
  } else if (bestScore >= beta) {
    ttFlag = 'lower';
  } else {
    ttFlag = 'exact';
  }
  
  TT[ttIdx] = {
    depth,
    flag: ttFlag,
    score: bestScore,
    best: bestMove
  };
  
  return [bestScore, bestMove];
}

// 导出原始的minimax函数接口（保持兼容性）
// 注意：这里直接导出接口，实际实现使用优化后的版本
export const getBestMoveMinimax = async (board: BoardState, turn: Color, depth: number = 3): Promise<{ from: Position; to: Position } | null> => {
  // 调用优化版本，传递参数但忽略depth（使用时间控制代替固定深度）
  return await getBestMoveV2(board, turn, depth * 500); // 根据深度估算时间，每个深度500ms
};
