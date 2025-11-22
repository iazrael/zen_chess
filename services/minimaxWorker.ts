/// <reference lib="webworker" />   // 告诉 TS 这是 worker 上下文

import { expose } from 'comlink';
import {MinimaxWorkerAPI} from './types.js';
import { getBestMoveMinimax as getBestMoveV2 } from '@/api/minimaxV2.js';
import { getBestMoveMinimax as getBestMoveV1 } from '@/api/minimax.js';
import { BoardState, Color, Position } from '@/api/common/types.js';

const minimaxWorkerAPI: MinimaxWorkerAPI = {
  getBestMoveMinimax: async (board: BoardState, turn: Color, depth: number, version: 'v1' | 'v2' = 'v2') => {
    if (version === 'v1') {
      return await getBestMoveV1(board, turn, depth);
    } else {
      return await getBestMoveV2(board, turn, depth);
    }
  },
};

expose(minimaxWorkerAPI);   // 把 api 暴露给主线程