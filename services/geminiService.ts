import { BoardState, Color, Position } from "../types";

/**
 * Gemini AI 中国象棋移动生成服务
 * 调用服务端API获取AI移动建议
 */
export const getGeminiMove = async (board: BoardState, turn: Color, modelName: string): Promise<{ from: Position; to: Position; reason: string } | null> => {
  try {
    // 调用服务端API
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ board, turn, modelName }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};
