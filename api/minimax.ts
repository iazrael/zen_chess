import { BoardState, Color, Position } from "./common/types.js";
import { getLegalMoves, applyMove, evaluateBoard, cloneBoard } from "./chessRules.js";

// Simple Minimax with Alpha-Beta Pruning
// Note: In a real app, this should be a Web Worker to avoid freezing UI.
// For this demo, we keep depth low (2 or 3).

export const getBestMoveMinimax = async (board: BoardState, turn: Color, depth: number = 3): Promise<{ from: Position; to: Position } | null> => {
  // Delay slightly to let UI render before freezing
  await new Promise(resolve => setTimeout(resolve, 100));

  let bestScore = -Infinity;
  let bestMove: { from: Position; to: Position } | null = null;
  const alpha = -Infinity;
  const beta = Infinity;

  const isMaximizing = true; // The AI calling this is always maximizing its own score

  // Collect all moves
  const allMoves: { from: Position; to: Position }[] = [];
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[0].length; x++) {
      const p = board[y][x];
      if (p && p.color === turn) {
        const moves = getLegalMoves(board, { x, y });
        moves.forEach(to => allMoves.push({ from: { x, y }, to }));
      }
    }
  }

  // Simple shuffling to add variety if scores are equal
  allMoves.sort(() => Math.random() - 0.5);

  for (const move of allMoves) {
    const nextBoard = applyMove(board, move.from, move.to);
    const score = minimax(nextBoard, depth - 1, alpha, beta, !isMaximizing, turn);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
};

const minimax = (board: BoardState, depth: number, alpha: number, beta: number, isMaximizing: boolean, aiColor: Color): number => {
  if (depth === 0) {
    return evaluateBoard(board, aiColor);
  }

  const turn = isMaximizing ? aiColor : (aiColor === Color.Red ? Color.Black : Color.Red);

  // Get moves
  const allMoves: { from: Position; to: Position }[] = [];
  let hasMoves = false;

  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[0].length; x++) {
      const p = board[y][x];
      if (p && p.color === turn) {
        const moves = getLegalMoves(board, { x, y });
        for (const to of moves) {
          hasMoves = true;
          const nextBoard = applyMove(board, { x, y }, to);

          if (isMaximizing) {
            const score = minimax(nextBoard, depth - 1, alpha, beta, false, aiColor);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) return alpha; // Prune
          } else {
            const score = minimax(nextBoard, depth - 1, alpha, beta, true, aiColor);
            beta = Math.min(beta, score);
            if (beta <= alpha) return beta; // Prune
          }
        }
      }
    }
  }

  if (!hasMoves) {
    // Checkmate or Stalemated
    // If maximizing player has no moves, they lose -> return low score
    return isMaximizing ? -100000 : 100000;
  }

  return isMaximizing ? alpha : beta;
};
