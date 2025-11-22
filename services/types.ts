import { BoardState, Color, Position } from "@/api/common/types.js";

export type MinimaxWorkerAPI = {
    getBestMoveMinimax: (board: BoardState, turn: Color, depth?: number, version?: 'v1' | 'v2') => Promise<{ from: Position, to: Position } | null>
};