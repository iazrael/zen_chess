import { BoardState, Color, Position } from "../server/common/types";

export const getOpenAIMove = async (board: BoardState, turn: Color): Promise<{ from: Position; to: Position; reason: string } | null> => {
  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board,
        turn
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