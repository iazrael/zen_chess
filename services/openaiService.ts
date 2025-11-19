import { BoardState, Color, Position } from "../types";
import { boardToFEN, fenToMoveString, getLegalMoves, parseMoveString } from "../utils/chessRules";

// Environment variables must be configured in .env or deployment settings
const apiKey = process.env.OPENAI_API_KEY || '';
const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export const getOpenAIMove = async (board: BoardState, turn: Color): Promise<{ from: Position; to: Position; reason: string } | null> => {
  if (!apiKey) {
    console.error("OpenAI API Key missing");
    // You might want to return a dummy move or throw an error to show in UI
    return { from: {x:0, y:0}, to: {x:0, y:0}, reason: "Error: OPENAI_API_KEY is not configured." };
  }

  // 1. Generate FEN
  const fen = boardToFEN(board, turn);

  // 2. Generate list of all legal moves
  const allLegalMoves: { moveStr: string; from: Position; to: Position }[] = [];
  
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

  if (allLegalMoves.length === 0) return null;

  const legalMovesStr = allLegalMoves.map(m => m.moveStr).join(", ");

  const systemPrompt = `You are a Chinese Chess (Xiangqi) Grandmaster engine.
  Analyze the board position provided in FEN notation.
  You MUST return a valid JSON object strictly following this schema:
  {
    "selectedMove": "string", // The exact move string from the Valid Legal Moves list provided
    "reasoning": "string" // A short explanation in Chinese (max 2 sentences)
  }
  Do not include markdown formatting (like \`\`\`json). Just the raw JSON object.`;

  const userPrompt = `Current Board FEN: ${fen}
  
  Color to move: ${turn === Color.Red ? "RED" : "BLACK"}.
  
  Valid Legal Moves: [${legalMovesStr}]
  
  Select the best move to win.`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("OpenAI API Error:", err);
        throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;

    let result;
    try {
        result = JSON.parse(content);
    } catch (e) {
        // Fallback if model didn't return strict JSON despite instructions
        console.warn("Failed to parse JSON from OpenAI, trying basic extraction", content);
        // Simple regex fallback could go here, or just fail
        return null;
    }

    const moveData = parseMoveString(result.selectedMove);
    
    if (moveData) {
      return { ...moveData, reason: result.reasoning };
    } else {
        console.warn("OpenAI returned move not in legal list or invalid format:", result.selectedMove);
        // Fallback to random legal move if the LLM hallucinates a format
        const randomIdx = Math.floor(Math.random() * allLegalMoves.length);
        return { ...allLegalMoves[randomIdx], reason: `(Fallback) AI format error: ${result.reasoning}` };
    }

  } catch (error: any) {
    console.error("OpenAI Service Error:", error);
    // Fallback
    const randomIdx = Math.floor(Math.random() * allLegalMoves.length);
    return { ...allLegalMoves[randomIdx], reason: `Network Error: ${error.message || 'Unknown'}` };
  }
};