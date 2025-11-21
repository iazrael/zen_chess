/// <reference lib="webworker" />   // 告诉 TS 这是 worker 上下文

import { expose } from 'comlink';
import {MinimaxWorkerAPI} from './types.js';
import { getBestMoveMinimax } from '@/api/minimaxV2.js';

const minimaxWorkerAPI: MinimaxWorkerAPI = {
  getBestMoveMinimax,
};

expose(minimaxWorkerAPI);   // 把 api 暴露给主线程