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

export const systemPrompt = `You are a Chinese Chess (Xiangqi) Grandmaster engine with deep strategic understanding. Return ONLY valid JSON.`;

export const constructPrompt = (fen: string, turn: Color, legalMovesStr: string) => {
    return `
      You are a Chinese Chess (Xiangqi) Grandmaster engine with deep strategic understanding.
      
      CURRENT BOARD STATE (FEN): ${fen}
      
      PLAYER TO MOVE: ${turn === Color.Red ? "RED" : "BLACK"}
      
      LEGAL MOVES AVAILABLE: [${legalMovesStr}]
      
      BOARD COORDINATE SYSTEM:
      - Columns (x): 0 to 8 from left to right
      - Rows (y): 0 to 9 from top to bottom
      - Move format: "(from_x,from_y)->(to_x,to_y)"
      
      STRATEGIC INSTRUCTIONS:
      1. Analyze the position thoroughly considering:
         - Material balance
         - Piece activity and coordination
         - King safety (avoid checks)
         - Tactical opportunities (captures, forks, pins)
         - Long-term positional advantages
      2. Prioritize moves that:
         - Protect your own General
         - Attack the opponent's General when possible
         - Improve piece positioning
         - Control key central squares
         - Create threats for the next move
      3. Avoid moves that:
         - Leave your General exposed to checks
         - Allow easy captures of your pieces
         - Result in immediate material loss
         - Violate fundamental tactical principles
      
      CRITICAL RULES:
      - SELECT ONLY ONE MOVE FROM THE PROVIDED LEGAL MOVES LIST
      - YOUR MOVE MUST BE IN EXACTLY THE SAME FORMAT AS IN THE LIST
      - NEVER INVENT NEW MOVE NOTATIONS
      - DO NOT RETURN ANYTHING OTHER THAN THE SPECIFIED JSON RESPONSE
      
      OUTPUT FORMAT (JSON):
      {
        "selectedMove": "EXACT move string from the legal moves list",
        "reasoning": "Concise analysis explaining why this move is strategically optimal (in Chinese, max 2 sentences)"
      }
    `;
};
