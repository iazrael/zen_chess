import { BoardState, Color, Position } from "@/api/common/types.js";

/**
 * Minimax算法版本枚举
 */
export enum MinimaxVersion {
    V1 = 'v1',
    V2 = 'v2',
    V3 = 'v3'
}

export type MinimaxWorkerAPI = {
    getBestMoveMinimax: (board: BoardState, turn: Color, depth?: number, version?: MinimaxVersion) => Promise<{ from: Position, to: Position } | null>
};