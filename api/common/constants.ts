import { PieceType, Color, Piece, BoardState } from './types.js';

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

// Standard starting FEN for Xiangqi
// rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1
// Uppercase = Red, Lowercase = Black

const createPiece = (type: PieceType, color: Color, x: number, y: number): Piece => ({
  type,
  color,
  id: `${color}-${type}-${x}-${y}`,
});

export const PIECE_CHARS: Record<string, Record<string, string>> = {
  [Color.Red]: {
    [PieceType.General]: '帅',
    [PieceType.Advisor]: '仕',
    [PieceType.Elephant]: '相',
    [PieceType.Horse]: '马',
    [PieceType.Chariot]: '车',
    [PieceType.Cannon]: '炮',
    [PieceType.Soldier]: '兵',
  },
  [Color.Black]: {
    [PieceType.General]: '将',
    [PieceType.Advisor]: '士',
    [PieceType.Elephant]: '象',
    [PieceType.Horse]: '马',
    [PieceType.Chariot]: '车',
    [PieceType.Cannon]: '炮',
    [PieceType.Soldier]: '卒',
  }
};

export const INITIAL_BOARD: BoardState = (() => {
  const board: BoardState = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));

  const setupRow = (row: number, color: Color, types: PieceType[]) => {
    types.forEach((type, col) => {
      board[row][col] = createPiece(type, color, col, row);
    });
  };

  const backRow = [
    PieceType.Chariot, PieceType.Horse, PieceType.Elephant, PieceType.Advisor, PieceType.General,
    PieceType.Advisor, PieceType.Elephant, PieceType.Horse, PieceType.Chariot
  ];

  // Black Setup (Top, rows 0-4)
  setupRow(0, Color.Black, backRow);
  board[2][1] = createPiece(PieceType.Cannon, Color.Black, 1, 2);
  board[2][7] = createPiece(PieceType.Cannon, Color.Black, 7, 2);
  [0, 2, 4, 6, 8].forEach(col => {
    board[3][col] = createPiece(PieceType.Soldier, Color.Black, col, 3);
  });

  // Red Setup (Bottom, rows 5-9)
  setupRow(9, Color.Red, backRow);
  board[7][1] = createPiece(PieceType.Cannon, Color.Red, 1, 7);
  board[7][7] = createPiece(PieceType.Cannon, Color.Red, 7, 7);
  [0, 2, 4, 6, 8].forEach(col => {
    board[6][col] = createPiece(PieceType.Soldier, Color.Red, col, 6);
  });

  return board;
})();