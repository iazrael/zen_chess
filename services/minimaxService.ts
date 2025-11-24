import { BoardState, Color, Position } from "@/api/common/types";

import { wrap } from 'comlink';
import { MinimaxWorkerAPI, MinimaxVersion } from "./types";
import { buildApiUrl } from '@/utils/env';
// import { getBestMoveMinimax } from "@/api/minimaxV2";

export { getMinimaxMoveWorker as  getMinimaxMove};

/**
 * Minimax服务类，提供与minimax.ts API交互的方法
 */
const getMinimaxMoveAPI = async (board: BoardState, turn: Color, depth: number = 3, version: MinimaxVersion = MinimaxVersion.V2): Promise<{ from: Position; to: Position } | null> => {
    try {
        const response = await fetch(buildApiUrl('/api/minimax'), {
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

const getMinimaxMoveWorker = async (board: BoardState, turn: Color, depth: number = 3, version: MinimaxVersion = MinimaxVersion.V2): Promise<{ from: Position; to: Position } | null> => {
    try {
        // 使用import.meta.url语法创建 Worker，确保 Vite能正确处理Worker文件
        const worker = new Worker(new URL('./minimaxWorker.ts', import.meta.url), { type: 'module' });
        const minimaxWorkerAPI = wrap<MinimaxWorkerAPI>(worker);

        const data = await minimaxWorkerAPI.getBestMoveMinimax(board, turn, depth, version);

        if (!data) {
            console.error("Minimax Worker returned error");
            return null;
        }
        return data;

    } catch (error) {
        console.error("Minimax Worker Network Error:", error);
        return null;
    }
};
