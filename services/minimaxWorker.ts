/// <reference lib="webworker" />   // 告诉 TS 这是 worker 上下文

import { expose } from 'comlink';
import { MinimaxWorkerAPI, MinimaxVersion } from './types.js';
import { getBestMoveMinimax as getBestMoveV1 } from '@/api/minimax.js';
import { getBestMoveMinimax as getBestMoveV2 } from '@/api/minimaxV2.js';
import { getBestMoveMinimax as getBestMoveV3 } from '@/api/minimaxV3.js';

import { BoardState, Color, Position } from '@/api/common/types.js';

const minimaxWorkerAPI: MinimaxWorkerAPI = {
  getBestMoveMinimax: async (board: BoardState, turn: Color, depth: number, version: MinimaxVersion = MinimaxVersion.V2) => {
    switch (version) {
      case MinimaxVersion.V1:
        return await getBestMoveV1(board, turn, depth);
      case MinimaxVersion.V2:
        return await getBestMoveV2(board, turn, depth);
      case MinimaxVersion.V3:
        return await getBestMoveV3(board, turn, depth);
      default:
        return await getBestMoveV2(board, turn, depth);
    }
  },
};

expose(minimaxWorkerAPI);   // 把 api 暴露给主线程