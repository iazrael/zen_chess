import { BoardState, Color } from "../types";
import { boardToFEN, fenToMoveString, getLegalMoves, parseMoveString } from "./chessRules";

/**
 * 合法移动项类型定义
 */
export interface LegalMove {
  moveStr: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/**
 * LLM移动建议结果类型定义
 */
export interface LLMResponse {
  selectedMove: string;
  reasoning: string;
}

/**
 * 生成棋盘分析数据
 * @param board 棋盘状态
 * @param turn 当前回合颜色
 * @returns 包含FEN和合法移动的分析结果
 */
export const analyzeBoard = (board: BoardState, turn: Color): { fen: string; legalMoves: LegalMove[]; legalMovesStr: string } => {
  // 生成FEN
  const fen = boardToFEN(board, turn);

  // 生成所有合法移动的列表
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

  // 生成合法移动字符串
  const legalMovesStr = allLegalMoves.map(m => m.moveStr).join(", ");

  return { fen, legalMoves: allLegalMoves, legalMovesStr };
};

/**
 * 构建中国象棋AI系统提示词
 * @returns 系统提示词
 */
export const buildSystemPrompt = (): string => {
  return `You are a Chinese Chess (Xiangqi) Grandmaster engine.
Analyze the board position provided in FEN notation.
You MUST return a valid JSON object strictly following this schema:
{
  "selectedMove": "string", // The exact move string from the Valid Legal Moves list provided
  "reasoning": "string" // A short explanation in Chinese (max 2 sentences)
}
Do not include markdown formatting (like \`\`\`json). Just the raw JSON object.`;
};

/**
 * 构建中国象棋AI用户提示词
 * @param fen 棋盘FEN表示
 * @param turn 当前回合颜色
 * @param legalMovesStr 合法移动列表字符串
 * @returns 用户提示词
 */
export const buildUserPrompt = (fen: string, turn: Color, legalMovesStr: string): string => {
  return `Current Board FEN: ${fen}
  
Color to move: ${turn === Color.Red ? "RED" : "BLACK"}.
  
Valid Legal Moves: [${legalMovesStr}]
  
Select the best move to win.`;
};

/**
 * 解析LLM返回的移动结果
 * @param llmResponse LLM返回的响应字符串
 * @param allLegalMoves 所有合法移动列表
 * @returns 解析后的移动结果或回退移动
 */
export const parseLLMMove = (llmResponse: string, allLegalMoves: LegalMove[]): { from: { x: number; y: number }; to: { x: number; y: number }; reason: string } | null => {
  try {
    const result = JSON.parse(llmResponse) as LLMResponse;
    const moveData = parseMoveString(result.selectedMove);
    
    if (moveData) {
      return { ...moveData, reason: result.reasoning };
    } else {
      // 回退到第一个合法移动
      console.warn("LLM返回无效的移动格式，使用第一个合法移动");
      return { ...allLegalMoves[0], reason: "Fallback move" };
    }
  } catch (error) {
    console.warn("无法解析LLM返回的JSON，使用随机合法移动", error);
    // 回退到随机合法移动
    const randomIdx = Math.floor(Math.random() * allLegalMoves.length);
    return { ...allLegalMoves[randomIdx], reason: "模型返回格式错误，使用随机移动" };
  }
};

/**
 * 生成随机回退移动
 * @param board 棋盘状态
 * @param turn 当前回合颜色
 * @returns 随机移动结果或null
 */
export const generateFallbackMove = (board: BoardState, turn: Color): { from: { x: number; y: number }; to: { x: number; y: number }; reason: string } | null => {
  try {
    const { legalMoves } = analyzeBoard(board, turn);

    if (legalMoves.length > 0) {
      const randomIdx = Math.floor(Math.random() * legalMoves.length);
      return { ...legalMoves[randomIdx], reason: "网络错误，使用随机移动" };
    }
    return null;
  } catch (error) {
    console.error("生成回退移动失败:", error);
    return null;
  }
};

/**
 * 验证请求方法
 * @param method 请求方法
 * @returns 是否为POST方法
 */
export const isValidPostMethod = (method: string | undefined): boolean => {
  return method?.toUpperCase() === 'POST';
};

/**
 * 验证请求参数
 * @param board 棋盘状态
 * @param turn 当前回合颜色
 * @returns 参数是否有效
 */
export const areValidParams = (board: any, turn: any): boolean => {
  return !!board && !!turn && Array.isArray(board) && typeof turn === 'string';
};
