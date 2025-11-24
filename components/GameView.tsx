import React, { useRef, useEffect } from "react";
import { ChevronLeft, Home, History as HistoryIcon } from "lucide-react";
import { Board } from "./Board";
import { TimeAndControlsModule } from "./TimeAndControlsModule";
import { AIThinkingModule } from "./AIThinkingModule";
import {
  BoardState,
  Color,
  Position,
  Move,
  GameStatus,
  AIModel,
  CaptureAnimationState,
} from "@/api/common/types";

interface GameViewProps {
  // Game State
  board: BoardState;
  turn: Color;
  selectedPos: Position | null;
  validMoves: Position[];
  lastMove: Move | null;
  gameStatus: GameStatus;
  captureAnimation: CaptureAnimationState | null;
  historyLength: number;

  // Timer State
  initialTime: number;
  gameResetKey: number;

  // AI State
  aiModel: AIModel;
  aiThinking: boolean;
  aiReasoning: string | null;
  gameMode: "pvp" | "ai";

  // Handlers
  onSquareClick: (pos: Position) => void;
  onTimeOut: (color: Color) => void;
  onUndo: () => void;
  onReset: () => void;
  onNavigateHome: () => void;
  onToggleHistory: () => void;
  isHistoryOpen: boolean;

  // Theme
  boardBgClass: string;
  boardBorderClass: string;
  gridColor: string;
  woodTexture: boolean;
}

export const GameView: React.FC<GameViewProps> = ({
  // Game State
  board,
  turn,
  selectedPos,
  validMoves,
  lastMove,
  gameStatus,
  captureAnimation,
  historyLength,

  // Timer State
  initialTime,
  gameResetKey,

  // AI State
  aiModel,
  aiThinking,
  aiReasoning,
  gameMode,

  // Handlers
  onSquareClick,
  onTimeOut,
  onUndo,
  onReset,
  onNavigateHome,
  onToggleHistory,
  isHistoryOpen,

  // Theme
  boardBgClass,
  boardBorderClass,
  gridColor,
  woodTexture,
}) => {
  // 处理超时的辅助函数
  const handleRedTimeOut = () => {
    onTimeOut(Color.Red);
  };

  const handleBlackTimeOut = () => {
    onTimeOut(Color.Black);
  };

  // 根据游戏模式生成标题文本
  const getTitleText = () => {
    if (gameMode === "pvp") {
      return "双人对弈";
    } else if (gameMode === "ai") {
      return "挑战 AI";
    }
    return "Zen 象棋";
  };

  const rotateBlack = gameMode === "pvp";

  return (
    <div className="min-h-screen flex flex-col p-2 md:p-4">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-stone-400 hover:text-amber-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> <Home className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-calligraphy text-stone-200 tracking-widest">
          {getTitleText()}
        </h2>
        <button
          onClick={onToggleHistory}
          className={`p-2 rounded-full transition-colors ${
            isHistoryOpen
              ? "bg-amber-600 text-white"
              : "bg-stone-800 text-stone-400 hover:text-white"
          }`}
        >
          <HistoryIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start">
        {/* Desktop: Left Sidebar (Time + AI Thinking) */}
        <div className="hidden lg:flex w-[350px] flex-col gap-3 flex-shrink-0 sticky top-4 order-1">
          <TimeAndControlsModule
            initialTime={initialTime}
            gameResetKey={gameResetKey}
            turn={turn}
            gameStatus={gameStatus}
            onRedTimeOut={handleRedTimeOut}
            onBlackTimeOut={handleBlackTimeOut}
            onUndo={onUndo}
            onReset={onReset}
            historyLength={historyLength}
            aiThinking={aiThinking}
          />
          <AIThinkingModule
            aiModel={aiModel}
            aiThinking={aiThinking}
            aiReasoning={aiReasoning}
          />
        </div>

        {/* Center: Board Area */}
        <div className="flex-1 flex flex-col items-center order-2">
          {/* Mobile: Time Controls */}
          <div className="lg:hidden w-full max-w-[600px] mb-3">
            <TimeAndControlsModule
              initialTime={initialTime}
              gameResetKey={gameResetKey}
              turn={turn}
              gameStatus={gameStatus}
              onRedTimeOut={handleRedTimeOut}
              onBlackTimeOut={handleBlackTimeOut}
              onUndo={onUndo}
              onReset={onReset}
              historyLength={historyLength}
              aiThinking={aiThinking}
            />
          </div>

          {/* Board */}
          <div className="w-full max-w-[600px] lg:max-w-[700px]">
            <Board
              board={board}
              onSquareClick={onSquareClick}
              selectedPos={selectedPos}
              validMoves={validMoves}
              lastMove={lastMove}
              boardBgClass={boardBgClass}
              boardBorderClass={boardBorderClass}
              gridColor={gridColor}
              woodTexture={woodTexture}
              captureAnimation={captureAnimation}
              rotateBlack={rotateBlack}
            />
          </div>

          {/* Mobile: AI Thinking Module */}
          <div className="lg:hidden w-full max-w-[600px] mt-3">
            <AIThinkingModule
              aiModel={aiModel}
              aiThinking={aiThinking}
              aiReasoning={aiReasoning}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
