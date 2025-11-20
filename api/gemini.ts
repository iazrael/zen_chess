import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
import { BoardState, Color } from "../types";
import { analyzeBoard, buildSystemPrompt, buildUserPrompt, parseLLMMove, generateFallbackMove, isValidPostMethod, areValidParams } from "../utils/llmChessUtils";

// 从环境变量获取API密钥
const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Gemini AI 中国象棋移动生成API
 * POST /api/gemini
 * @param req 请求体包含：board (棋盘状态), turn (当前回合颜色), modelName (模型名称)
 * @param res 返回：from (起始位置), to (目标位置), reason (移动原因)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许POST请求
  if (!isValidPostMethod(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed', message: '只支持POST请求' });
  }

  try {
    // 解析请求体
    const { board, turn, modelName } = req.body;

    // 验证请求参数
    if (!board || !turn || !modelName || !areValidParams(board, turn)) {
      return res.status(400).json({ error: 'Bad Request', message: '缺少必要的参数：board, turn, modelName' });
    }

    // 检查API密钥
    if (!apiKey) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'API密钥未配置' });
    }

    // 分析棋盘，生成FEN和合法移动列表
    const { fen, legalMoves, legalMovesStr } = analyzeBoard(board, turn as Color);

    if (legalMoves.length === 0) {
      return res.status(200).json(null);
    }

    // 构建提示词
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(fen, turn as Color, legalMovesStr);

    // 调用Gemini API
    const response = await ai.models.generateContent({
      model: modelName === 'gemini-pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
      contents: [
        { role: 'system', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
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
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Gemini API返回空响应' });
    }

    // 解析LLM返回的移动
    const moveResult = parseLLMMove(text, legalMoves);
    if (moveResult) {
      return res.status(200).json(moveResult);
    } else {
      return res.status(200).json({ ...legalMoves[0], reason: "Fallback move" });
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // 回退到随机合法移动
    try {
      const { board, turn } = req.body;
      const fallbackMove = generateFallbackMove(board, turn as Color);
      if (fallbackMove) {
        return res.status(200).json(fallbackMove);
      }
    } catch (fallbackError) {
      console.error("回退机制失败:", fallbackError);
    }

    return res.status(500).json({ error: 'Internal Server Error', message: '处理请求时发生错误' });
  }
}
