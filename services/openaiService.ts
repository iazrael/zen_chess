import { BoardState, Color, Position } from "@/api/common/types";
import { buildApiUrl } from '@/utils/env';

export const getOpenAIMove = async (board: BoardState, turn: Color, provider: string = 'deepseek'): Promise<{ from: Position; to: Position; reason: string } | null> => {
  try {
    const response = await fetch(buildApiUrl('/api/openai'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board,
        turn,
        provider
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