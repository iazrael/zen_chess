import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BoardState, Color } from "../types";
import { analyzeBoard, buildSystemPrompt, buildUserPrompt, parseLLMMove, generateFallbackMove, isValidPostMethod, areValidParams } from "../utils/llmChessUtils";

// 从环境变量获取API配置
const apiKey = process.env.OPENAI_API_KEY || '';
const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!apiKey) {
  console.error("OPENAI_API_KEY is not set in environment variables");
}

/**
 * OpenAI 中国象棋移动生成API
 * POST /api/openai
 * @param req 请求体包含：board (棋盘状态), turn (当前回合颜色)
 * @param res 返回：from (起始位置), to (目标位置), reason (移动原因)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许POST请求
  if (!isValidPostMethod(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed', message: '只支持POST请求' });
  }

  try {
    // 解析请求体
    const { board, turn } = req.body;

    // 验证请求参数
    if (!board || !turn || !areValidParams(board, turn)) {
      return res.status(400).json({ error: 'Bad Request', message: '缺少必要的参数：board, turn' });
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

    // 构建系统提示和用户提示
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(fen, turn as Color, legalMovesStr);

    // 调用OpenAI API
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
    
    if (!content) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'OpenAI API返回空响应' });
    }

    // 解析LLM返回的移动
    const moveResult = parseLLMMove(content, legalMoves);
    if (moveResult) {
      return res.status(200).json(moveResult);
    } else {
      console.warn("OpenAI返回的移动不在合法列表中或格式无效");
      // 回退到随机合法移动
      const randomIdx = Math.floor(Math.random() * legalMoves.length);
      return res.status(200).json({ ...legalMoves[randomIdx], reason: "模型返回格式错误，使用随机移动" });
    }

  } catch (error: any) {
    console.error("OpenAI Service Error:", error);
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
