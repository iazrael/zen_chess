import { parseMoveString, boardToFEN, fenToMoveString, getLegalMoves } from "./chessRules.js";
import { getAIProviderConfig } from "./common/config.js";
import { BoardState, Color, Position } from "./common/types.js";

export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { board, turn, provider = 'openai' } = req.body;

    // Get configuration for the specified provider
    const config = getAIProviderConfig(provider);

    if (!config.apiKey) {
        res.status(500).json({ error: `API Key missing configuration for ${provider}` });
        return;
    }

    try {
        const { fen, allLegalMoves, legalMovesStr } = getGameContext(board, turn);

        if (allLegalMoves.length === 0) {
            res.status(200).json({ move: null, message: "No legal moves" });
            return;
        }

        const prompt = constructPrompt(fen, turn, legalMovesStr);

        let body;
        let headers;

        // Configure request
        body = JSON.stringify({
            model: config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        const response = await fetch(`${config.apiUrl}${provider === 'gemini' ? `/${config.model}:generateContent?key=${config.apiKey}` : ''}`, {
            method: 'POST',
            headers: headers,
            body: body
        });

        // 打印一下请求体
        console.log(`${provider} API Request:`, body);

        if (!response.ok) {
            const err = await response.text();
            console.error(`${provider} API Error:`, err);
            res.status(500).json({ error: `${provider} API Error`, details: err });
            return;
        }

        const data: any = await response.json();
        let content;

        // Extract content based on provider
        if (provider === 'gemini') {
            content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else if (provider === 'qianwen') {
            content = data.output?.choices?.[0]?.message?.content;
        } else {
            content = data.choices?.[0]?.message?.content;
        }

        if (!content) {
            res.status(500).json({ error: "Empty response from AI" });
            return;
        }

        console.log(`${provider} API Response:`, content);

        let result;
        try {
            result = JSON.parse(content);
        } catch (e) {
            console.warn(`Failed to parse JSON from ${provider}`, content);
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback (JSON parse error)" });
            return;
        }

        const moveData = parseMoveString(result.selectedMove);

        if (moveData) {
            res.status(200).json({ ...moveData, reason: result.reasoning });
        } else {
            console.warn(`${provider} returned invalid move format, picking first legal move`);
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback move (invalid format)" });
        }

    } catch (error) {
        console.error(`${provider} API Error:`, error);
        res.status(500).json({ error: "Internal Server Error", details: error });
    }
}


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
                    'r': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'c': '砲', 'p': '卒',
                    'R': '俥', 'N': '傌', 'B': '相', 'A': '仕', 'K': '帥', 'C': '炮', 'P': '兵'
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
  "reasoning": "Concise analysis in Chinese (max 3 sentences)"
}`;
};
