// minimaxWorkerClient.ts
// 客户端封装，用于与minimaxWorker通信

import { wrap } from 'comlink';

// 定义Worker的API接口
interface MinimaxWorkerAPI {
  getBestMoveMinimax: (board: any, turn: any, depth?: number) => Promise<{from: {x: number, y: number}, to: {x: number, y: number}} | null>;
}

// 创建Worker实例，使用JavaScript版本的Worker文件
const worker = new Worker(new URL('../services/minimaxWorker.js', import.meta.url));

// 包装Worker通信API
const minimaxWorker = wrap<MinimaxWorkerAPI>(worker);

// 导出getBestMoveMinimax函数，通过Worker调用minimax算法
export const getBestMoveMinimax = async (board: any, turn: any, depth = 3) => {
  try {
    return await minimaxWorker.getBestMoveMinimax(board, turn, depth);
  } catch (error) {
    console.error('Error calling minimax worker:', error);
    return null;
  }
};

// 导出清理函数，用于终止Worker
export const terminateMinimaxWorker = () => {
  worker.terminate();
};