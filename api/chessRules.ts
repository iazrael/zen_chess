import { BoardState, Position, Piece, PieceType, Color, Move } from './common/types.js';
import { BOARD_ROWS, BOARD_COLS } from './common/constants.js';

// Helper to check bounds
const isValidPos = (x: number, y: number) => x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS;

// Get piece at position
const getPiece = (board: BoardState, pos: Position): Piece | null => {
  if (!isValidPos(pos.x, pos.y)) return null;
  return board[pos.y][pos.x];
};

// Check if position is within the palace (Red: x 3-5, y 7-9; Black: x 3-5, y 0-2)
const isPalace = (x: number, y: number, color: Color) => {
  if (x < 3 || x > 5) return false;
  if (color === Color.Red) return y >= 7 && y <= 9;
  return y >= 0 && y <= 2;
};

// Has crossed river? (Red crosses if y < 5, Black crosses if y > 4)
const crossedRiver = (y: number, color: Color) => {
  if (color === Color.Red) return y < 5;
  return y > 4;
};

export const getValidMovesForPiece = (board: BoardState, pos: Position): Position[] => {
  const piece = getPiece(board, pos);
  if (!piece) return [];

  const moves: Position[] = [];
  const { x, y } = pos;
  const color = piece.color;

  const addMove = (tx: number, ty: number) => {
    if (!isValidPos(tx, ty)) return;
    const target = getPiece(board, { x: tx, y: ty });
    if (target && target.color === color) return; // Blocked by friendly
    moves.push({ x: tx, y: ty });
  };

  switch (piece.type) {
    case PieceType.General: // Orthogonal 1 step, stay in palace
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        const tx = x + dx, ty = y + dy;
        if (isPalace(tx, ty, color)) addMove(tx, ty);
      });
      // Flying General Rule: check vertical line for opponent general
      let flyY = y + (color === Color.Red ? -1 : 1);
      while (flyY >= 0 && flyY < BOARD_ROWS) {
        const p = board[flyY][x];
        if (p) {
          if (p.type === PieceType.General && p.color !== color) {
            moves.push({ x, y: flyY });
          }
          break;
        }
        flyY += (color === Color.Red ? -1 : 1);
      }
      break;

    case PieceType.Advisor: // Diagonal 1 step, stay in palace
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
        const tx = x + dx, ty = y + dy;
        if (isPalace(tx, ty, color)) addMove(tx, ty);
      });
      break;

    case PieceType.Elephant: // Diagonal 2 steps, no river crossing, blockable eye
      [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dx, dy]) => {
        const tx = x + dx, ty = y + dy;
        // Check river boundary
        if (color === Color.Red && ty < 5) return;
        if (color === Color.Black && ty > 4) return;

        // Check eye (midpoint)
        const eyeX = x + dx / 2;
        const eyeY = y + dy / 2;
        if (!getPiece(board, { x: eyeX, y: eyeY })) {
          addMove(tx, ty);
        }
      });
      break;

    case PieceType.Horse: // L-move, blockable legs
      [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(([dx, dy]) => {
        const tx = x + dx, ty = y + dy;
        // Check leg (orthogonal adjacent)
        const legX = x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0);
        const legY = y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0);
        if (!getPiece(board, { x: legX, y: legY })) {
          addMove(tx, ty);
        }
      });
      break;

    case PieceType.Chariot: // Orthogonal any distance
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        let i = 1;
        while (true) {
          const tx = x + dx * i, ty = y + dy * i;
          if (!isValidPos(tx, ty)) break;
          const target = getPiece(board, { x: tx, y: ty });
          if (!target) {
            moves.push({ x: tx, y: ty });
          } else {
            if (target.color !== color) moves.push({ x: tx, y: ty });
            break;
          }
          i++;
        }
      });
      break;

    case PieceType.Cannon: // Move like chariot, capture needs screen
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        let i = 1;
        let screenFound = false;
        while (true) {
          const tx = x + dx * i, ty = y + dy * i;
          if (!isValidPos(tx, ty)) break;
          const target = getPiece(board, { x: tx, y: ty });
          if (!screenFound) {
            if (!target) {
              moves.push({ x: tx, y: ty });
            } else {
              screenFound = true;
            }
          } else {
            if (target) {
              if (target.color !== color) moves.push({ x: tx, y: ty });
              break;
            }
          }
          i++;
        }
      });
      break;

    case PieceType.Soldier: // Forward 1, sideways 1 after river
      const forwardY = y + (color === Color.Red ? -1 : 1);
      addMove(x, forwardY);
      if (crossedRiver(y, color)) {
        addMove(x + 1, y);
        addMove(x - 1, y);
      }
      break;
  }

  return moves;
};

// Check if the General is in check
export const isCheck = (board: BoardState, kingColor: Color): boolean => {
  // Find King
  let kingPos: Position | null = null;
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (p && p.type === PieceType.General && p.color === kingColor) {
        kingPos = { x, y };
        break;
      }
    }
    if (kingPos) break;
  }
  if (!kingPos) return true; // Should not happen usually

  // Check if any enemy piece can attack King
  const enemyColor = kingColor === Color.Red ? Color.Black : Color.Red;
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (p && p.color === enemyColor) {
        const moves = getValidMovesForPiece(board, { x, y });
        if (moves.some(m => m.x === kingPos!.x && m.y === kingPos!.y)) {
          return true;
        }
      }
    }
  }
  return false;
};

// Helper to clone board
export const cloneBoard = (board: BoardState): BoardState => board.map(row => row.slice());

// Apply move to a new board
export const applyMove = (board: BoardState, from: Position, to: Position): BoardState => {
  const newBoard = cloneBoard(board);
  newBoard[to.y][to.x] = newBoard[from.y][from.x];
  newBoard[from.y][from.x] = null;
  return newBoard;
};

// Get all strictly legal moves (prevent self-check)
export const getLegalMoves = (board: BoardState, pos: Position): Position[] => {
  const potentialMoves = getValidMovesForPiece(board, pos);
  const piece = getPiece(board, pos);
  if (!piece) return [];

  return potentialMoves.filter(to => {
    const nextBoard = applyMove(board, pos, to);
    return !isCheck(nextBoard, piece.color);
  });
};

// Convert board to FEN (Simple version for LLM)
export const boardToFEN = (board: BoardState, turn: Color): string => {
  let fen = '';
  for (let y = 0; y < BOARD_ROWS; y++) {
    let empty = 0;
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        const char = p.type === PieceType.Horse ? 'n' : // FEN standard for Horse is 'n'
          p.type === PieceType.Elephant ? 'b' : // Elephant usually 'b'
            p.type === PieceType.General ? 'k' :
              p.type === PieceType.Advisor ? 'a' :
                p.type === PieceType.Chariot ? 'r' :
                  p.type === PieceType.Cannon ? 'c' :
                    p.type === PieceType.Soldier ? 'p' : '?';
        fen += p.color === Color.Red ? char.toUpperCase() : char.toLowerCase();
      }
    }
    if (empty > 0) fen += empty;
    if (y < BOARD_ROWS - 1) fen += '/';
  }
  fen += ` ${turn} - - 0 1`;
  return fen;
};

export const fenToMoveString = (from: Position, to: Position): string => {
  // x=0 is file 'a', x=8 is file 'i'
  // y=0 is rank 9 (top), y=9 is rank 0 (bottom) - common notation varies, let's use simple coordinates
  const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const rows = ['9', '8', '7', '6', '5', '4', '3', '2', '1', '0']; // 0-9 index map to 9-0 logic rank
  // Actually standard xiangqi notation is different, but for LLM/Internal use, algebraic is fine: a0-i9
  // Let's use pure coordinate string "x,y to x,y" for clarity to LLM to avoid ambiguity
  return `(${from.x},${from.y})->(${to.x},${to.y})`;
};

export const parseMoveString = (str: string): { from: Position, to: Position } | null => {
  const match = str.match(/\((\d+),(\d+)\)->\((\d+),(\d+)\)/);
  if (match) {
    return {
      from: { x: parseInt(match[1]), y: parseInt(match[2]) },
      to: { x: parseInt(match[3]), y: parseInt(match[4]) }
    };
  }
  return null;
};

// Evaluate board state roughly (for Minimax)
export const evaluateBoard = (board: BoardState, playerColor: Color): number => {
  let score = 0;
  const values: Record<string, number> = {
    k: 10000, a: 20, b: 20, n: 40, r: 90, c: 45, p: 10
  };

  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const p = board[y][x];
      if (p) {
        const val = values[p.type] || 0;
        // Positional bonus could be added here
        if (p.color === playerColor) score += val;
        else score -= val;
      }
    }
  }
  return score;
};

// 撤销上一步 applyMove（无易位/兵过路的中国象棋只需要恢复被吃子即可）
export const undoMove = (
  board: BoardState,
  from: Position,
  to: Position,
  captured: Piece | null
): void => {
  // 把棋子搬回去
  board[from.y][from.x] = board[to.y][to.x];
  // 目标格恢复原来可能被吃的子（也可能 null）
  board[to.y][to.x] = captured;
};

// 初始化只跑一次：15 种 PieceType × 2 色 × 90 格 的随机 32 位 key
const ZOBRIST_KEYS: number[][][] = (() => {
  const keys: number[][][] = Array(10).fill(0).map(() =>
    Array(9).fill(0).map(() => Array(30).fill(0)));
  const rng = (() => {
    let x = 123456789;
    return () => (x = Math.imul(x, 1664525) + 1013904223) >>> 0;
  })();
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 9; x++)
      for (let i = 0; i < 30; i++) keys[y][x][i] = rng();
  return keys;
})();

// 把 Piece 映射到 0-29 的索引
const pieceIndex = (p: Piece): number => {
  const t: Record<PieceType, number> = {
    [PieceType.General]: 0,
    [PieceType.Advisor]: 1,
    [PieceType.Elephant]: 2,
    [PieceType.Horse]: 3,
    [PieceType.Chariot]: 4,
    [PieceType.Cannon]: 5,
    [PieceType.Soldier]: 6,
  };
  return t[p.type] * 2 + (p.color === Color.Red ? 0 : 1);
};

// 对外接口：返回 32 位哈希
export const computeHash = (board: BoardState): number => {
  let h = 0;
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p) h ^= ZOBRIST_KEYS[y][x][pieceIndex(p)];
    }
  return h >>> 0; // 保证无符号
};

// 复用已有逻辑：看对方任意子能否走到己方帅/将所在格
export const isInCheck = (board: BoardState, color: Color): boolean => {
  // 先找王
  let kingPos: Position | null = null;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p && p.type === PieceType.General && p.color === color) {
        kingPos = { x, y };
        break;
      }
    }
    if (kingPos) break;
  }
  if (!kingPos) return false; // 不应该发生

  // 枚举对方所有子的合法走法，看是否包含 kingPos
  const enemy = color === Color.Red ? Color.Black : Color.Red;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p && p.color === enemy) {
        const moves = getValidMovesForPiece(board, { x, y });
        if (moves.some(m => m.x === kingPos!.x && m.y === kingPos!.y)) return true;
      }
    }
  }
  return false;
};
// 重复局面计数器：key = 32 位 Zobrist 哈希，value = 出现次数
const repMap = new Map<number, number>();

// 供外部清空（新局、新搜索开始时调用）
export const RESET_REP = (): void => repMap.clear();

// 供外部读写：真正名字叫 REP_TABLE
export const REP_TABLE = {
  get(hash: number): number | undefined { return repMap.get(hash); },
  set(hash: number, cnt: number) {
    if (cnt <= 0) repMap.delete(hash);
    else repMap.set(hash, cnt);
  }
};