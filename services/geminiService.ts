import { GoogleGenAI, Type } from "@google/genai";
import { BoardState, Color, Position } from "../types";
import { boardToFEN, fenToMoveString, getLegalMoves, parseMoveString } from "../utils/chessRules";

// IMPORTANT: We need to handle the case where API key might not be present gracefully or mocked for UI demo if strict.
// The prompt instructions say "Assume this variable is pre-configured... accessible in the execution context".
const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

export const getGeminiMove = async (board: BoardState, turn: Color, modelName: string): Promise<{ from: Position; to: Position; reason: string } | null> => {
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }

  // 1. Generate FEN
  const fen = boardToFEN(board, turn);

  // 2. Generate list of all legal moves for the prompt
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

  const prompt = `
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

  try {
    const response = await ai.models.generateContent({
      model: modelName === 'gemini-pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedMove: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ["selectedMove", "reasoning"]
        },
        // Use thinking for Pro model if available/desired, but keeping it simple for stability
        // thinkingConfig: modelName === 'gemini-pro' ? { thinkingBudget: 1024 } : undefined
      }
    });

    const text = response.text;
    if (!text) return null;

    const result = JSON.parse(text);
    const moveData = parseMoveString(result.selectedMove);
    
    if (moveData) {
      return { ...moveData, reason: result.reasoning };
    } else {
        // Fallback if hallucinated format
        console.warn("Gemini returned invalid move format, picking first legal move");
        return { ...allLegalMoves[0], reason: "Fallback move" };
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback to random legal move on error
    const randomIdx = Math.floor(Math.random() * allLegalMoves.length);
    return { ...allLegalMoves[randomIdx], reason: "Network error, random move." };
  }
};
