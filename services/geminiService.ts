import { BoardState, Color, Position } from "../types";

export const getGeminiMove = async (board: BoardState, turn: Color, modelName: string): Promise<{ from: Position; to: Position; reason: string } | null> => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board,
        turn,
        modelName
      }),
    });

    if (!response.ok) {
      console.error("API Error:", response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.error("API returned error:", data.error);
      return null;
    }

    return data;

  } catch (error) {
    console.error("Network Error:", error);
    return null;
  }
};
