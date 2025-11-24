import React from 'react';
import { Undo2, RotateCcw } from 'lucide-react';
import { GameTimer } from './GameTimer';
import { GameStatsBar } from './GameStatsBar';
import { Color, GameStatus } from '@/api/common/types';

interface TimeAndControlsModuleProps {
  // Timer props
  initialTime: number;
  gameResetKey: number;
  turn: Color;
  gameStatus: GameStatus;
  
  // Handlers
  onRedTimeOut: () => void;
  onBlackTimeOut: () => void;
  onUndo: () => void;
  onReset: () => void;
  onOpenHistory: () => void;
  
  // State
  historyLength: number;
  aiThinking: boolean;
  undoCount: number;
  totalMoves: number;
}

export const TimeAndControlsModule: React.FC<TimeAndControlsModuleProps> = ({
  // Timer props
  initialTime,
  gameResetKey,
  turn,
  gameStatus,
  
  // Handlers
  onRedTimeOut,
  onBlackTimeOut,
  onUndo,
  onReset,
  onOpenHistory,
  
  // State
  historyLength,
  aiThinking,
  undoCount,
  totalMoves
}) => {
  const getWinMessage = (gameStatus: GameStatus) => {
    if (gameStatus === GameStatus.RedWin) {
      return "Checkmate! Red Wins!";
    }
    if (gameStatus === GameStatus.BlackWin) {
      return "Checkmate! Black Wins!";
    }
    return "";
  };

  return (
    <div className="bg-stone-800/80 rounded-xl p-3 shadow-lg border border-stone-700 backdrop-blur-sm w-full">
      {/* Timers and Controls Row */}
      <div className="flex items-center justify-between gap-2">
        {/* Red Timer */}
        <GameTimer
          initialTime={initialTime}
          isActive={gameStatus === GameStatus.Playing && turn === Color.Red}
          onTimeOut={onRedTimeOut}
          label="Red"
          colorClass="text-red-400"
          resetKey={gameResetKey}
        />
        
        {/* Controls Section */}
        <div className="flex items-center justify-center gap-3">
          {/* Undo Button */}
          <button 
            onClick={onUndo} 
            disabled={historyLength === 0 || aiThinking || gameStatus !== GameStatus.Playing} 
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-stone-700/40 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-stone-300 hover:text-white transition-all duration-200 group"
            title="Undo"
          >
            <Undo2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wider uppercase">悔棋</span>
          </button>
          {/* Reset Button */}
          <button 
            onClick={onReset} 
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-stone-700/40 hover:bg-stone-700 text-stone-300 hover:text-white transition-all duration-200 group"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-semibold tracking-wider uppercase">重来</span>
          </button>
        </div>
        
        {/* Black Timer */}
        <GameTimer
          initialTime={initialTime}
          isActive={gameStatus === GameStatus.Playing && turn === Color.Black}
          onTimeOut={onBlackTimeOut}
          label="Black"
          colorClass="text-stone-400"
          resetKey={gameResetKey}
        />
      </div>

      {gameStatus !== GameStatus.Playing && (
        <div className="p-2 bg-amber-900/30 border border-amber-700 rounded text-center animate-bounce">
          <span className="text-sm font-bold text-amber-400">
            {getWinMessage(gameStatus)}
          </span>
        </div>
      )}

      {/* Game Stats Bar */}
      <GameStatsBar 
        undoCount={undoCount}
        totalMoves={totalMoves}
        onOpenHistory={onOpenHistory}
      />
    </div>
  );
};