import { BoardState, Color, Position } from "@/api/common/types.js";

export type MinimaxWorkerAPI = {
    getBestMoveMinimax: (board: BoardState, turn: Color, depth?: number) => Promise<{ from: Position, to: Position } | null>
};