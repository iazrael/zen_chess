import { BoardState, Color, Position } from "./common/types.js";
import { boardToFEN, fenToMoveString, getLegalMoves } from "./chessRules.js";

export interface MoveRequest {
    board: BoardState;
    turn: Color;
    modelName?: string;
}

export interface MoveResponse {
    from: Position;
    to: Position;
    reason: string;
}

export interface LegalMove {
    moveStr: string;
    from: Position;
    to: Position;
}

export const getGameContext = (board: BoardState, turn: Color) => {
    // 1. Generate FEN
    const fen = boardToFEN(board, turn);

    // 2. Generate list of all legal moves
    const allLegalMoves: LegalMove[] = [];

    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[0].length; x++) {
            const p = board[y][x];
            if (p && p.color === turn) {
                const moves = getLegalMoves(board, { x, y });
                moves.forEach(to => {
                    const from = { x, y };
                    allLegalMoves.push({
                        moveStr: fenToMoveString(from, to),
                        from,
                        to
                    });
                });
            }
        }
    }

    const legalMovesStr = allLegalMoves.map(m => m.moveStr).join(", ");

    return { fen, allLegalMoves, legalMovesStr };
};

export const constructPrompt = (fen: string, turn: Color, legalMovesStr: string) => {
    return `
      You are a Chinese Chess (Xiangqi) Grandmaster engine.
      
      Current Board FEN: ${fen}
      
      Color to move: ${turn === Color.Red ? "RED (Uppercase in FEN)" : "BLACK (Lowercase in FEN)"}.
      
      Valid Legal Moves: [${legalMovesStr}]
      
      Analyze the position and select the absolute best move to win.
      You MUST select one move from the provided Valid Legal Moves list.
      
      Return a JSON object with:
      - "selectedMove": The exact string from the valid moves list.
      - "reasoning": A short explanation of why this move is best (max 2 sentences, in Chinese).
    `;
};
