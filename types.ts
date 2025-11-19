export enum PieceType {
  General = 'k', // King/General (帅/将)
  Advisor = 'a', // Advisor (仕/士)
  Elephant = 'b', // Elephant/Minister (相/象) - 'b' for bishop equivalent in standard FEN usually, using b/e convention
  Horse = 'n',   // Horse/Knight (马)
  Chariot = 'r', // Chariot/Rook (车)
  Cannon = 'c',  // Cannon (炮)
  Soldier = 'p', // Pawn/Soldier (兵/卒)
}

export enum Color {
  Red = 'w', // FEN standard uses 'w' for red (moves first) usually, or 'r'. Let's stick to 'w' internally as "first player" to align with generic chess logic often, but visually it is RED.
  Black = 'b',
}

export interface Position {
  x: number; // 0-8 (Column)
  y: number; // 0-9 (Row)
}

export interface Piece {
  type: PieceType;
  color: Color;
  id: string; // Unique ID for animations
}

// Board is 10 rows (0-9) x 9 cols (0-8)
// Red usually starts at bottom (rows 7-9), Black at top (rows 0-2)
export type BoardState = (Piece | null)[][];

export interface Move {
  from: Position;
  to: Position;
  captured?: Piece;
}

export enum GameStatus {
  Playing,
  RedWin,
  BlackWin,
  Draw,
}

export enum AIModel {
  None = 'none',
  Traditional = 'minimax',
  GeminiFlash = 'gemini-flash',
  GeminiPro = 'gemini-pro',
  OpenAI = 'openai',
}

export interface GameContextType {
  board: BoardState;
  turn: Color;
  selectedPos: Position | null;
  lastMove: Move | null;
  validMoves: Position[]; // For the selected piece
  status: GameStatus;
  makeMove: (from: Position, to: Position) => void;
  resetGame: () => void;
  undoMove: () => void;
}