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

export const systemPrompt = `You are a Chinese Chess (Xiangqi) Grandmaster engine. 
Analyze the board position provided in FEN notation. 
You MUST return a valid JSON object strictly following this schema: {"selectedMove": "string", "reasoning": "string"}. 
Do not include markdown formatting (like \`\`\`json). Just the raw JSON object. The reasoning should be in Chinese.`;

export const constructPrompt = (fen: string, turn: Color, legalMovesStr: string) => {
    // Generate visual board representation
    const fenRows = fen.split(' ')[0].split('/');
    let visualBoard = '\n  0 1 2 3 4 5 6 7 8\n';
    
    for (let y = 0; y < fenRows.length; y++) {
        let rowStr = `${y} `;
        let fenRow = fenRows[y];
        let x = 0;
        
        for (let i = 0; i < fenRow.length; i++) {
            const char = fenRow[i];
            if (/[0-9]/.test(char)) {
                const emptyCount = parseInt(char);
                for (let j = 0; j < emptyCount; j++) {
                    rowStr += '〇';
                    x++;
                }
            } else {
                // Map FEN characters to visual representation
                const visualChar = {
                    'r': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '将', 'c': '炮', 'p': '卒',
                    'R': '車', 'N': '馬', 'B': '相', 'A': '仕', 'K': '帅', 'C': '炮', 'P': '兵'
                }[char] || char;
                rowStr += visualChar;
                x++;
            }
        }
        visualBoard += rowStr + '\n';
    }
    
    return `Current Board FEN: ${fen}
  
Color to move: ${turn === Color.Red ? "RED" : "BLACK"}.
  
Visual Board Representation:
${visualBoard}
  
Valid Legal Moves: [${legalMovesStr}]
  
IMPORTANT INSTRUCTIONS:
1. Select the BEST move from the Valid Legal Moves list above.
2. Your selectedMove MUST be in EXACTLY the same format as shown in the list.
3. Consider:
   - Material balance
   - King safety
   - Tactical opportunities (captures, forks, pins)
   - Piece activity and coordination
   - Positional advantages
4. Prioritize moves that:
   - Protect your own General
   - Attack the opponent's General when possible
   - Improve piece positioning
   - Control key central squares
5. Avoid moves that:
   - Leave your General exposed to checks
   - Result in immediate material loss
  
OUTPUT FORMAT (JSON):
{
  "selectedMove": "EXACT move string from the legal moves list",
  "reasoning": "Concise analysis in Chinese (max 2 sentences)"
}`;
};
