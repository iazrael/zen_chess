import React from 'react';
import { History } from 'lucide-react';

interface GameStatsBarProps {
  undoCount: number;
  totalMoves: number;
  onOpenHistory: () => void;
}

export const GameStatsBar: React.FC<GameStatsBarProps> = ({
  undoCount,
  totalMoves,
  onOpenHistory
}) => {
  return (
    <div className="w-full mt-3">
      {/* 分割线 */}
      <div className="border-t border-stone-700 pt-3"></div>
      
      <div className="flex items-center justify-between gap-4">
        <div className="text-stone-300 text-sm">
          <span>悔棋：{undoCount}</span>
        </div>
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1 text-stone-300 hover:text-amber-400 transition-colors"
        >
          <History className="w-4 h-4" />
          <span>总步数：{totalMoves}</span>
        </button>
      </div>
    </div>
  );
};