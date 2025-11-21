import { BoardState, Color, Position } from "../api/common/types";

/**
 * Minimax服务类，提供与minimax.ts API交互的方法
 */
export const getMinimaxMove = async (board: BoardState, turn: Color, depth: number = 3): Promise<{ from: Position; to: Position } | null> => {
  try {
    const response = await fetch('/api/minimax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board,
        turn,
        depth
      }),
    });

    if (!response.ok) {
      console.error("Minimax API Error:", response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.error("Minimax API returned error:", data.error);
      return null;
    }

    return data;

  } catch (error) {
    console.error("Network Error:", error);
    return null;
  }
};