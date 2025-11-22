import React from 'react';
import { Users, Bot } from 'lucide-react';

interface HomeViewProps {
  onStartGame: (mode: 'pvp' | 'ai') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onStartGame }) => (
  <div className="flex flex-col items-center justify-center min-h-screen animate-fade-in">
    <h1 className="flex items-center justify-center gap-2 md:gap-4 text-amber-500 mb-2 text-center">
      <span className="text-6xl md:text-8xl font-bold font-calligraphy drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">中国</span>
      <img 
        src="./logo.svg" 
        alt="中国象棋 Logo" 
        className="w-16 h-16 md:w-24 md:h-24 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]"
      />
      <span className="text-6xl md:text-8xl font-bold font-calligraphy drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">象棋</span>
    </h1>
    <p className="text-stone-400 tracking-[0.5em] uppercase mb-12 text-sm md:text-base"></p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl p-4">
      <button
        onClick={() => onStartGame('pvp')}
        className="group relative overflow-hidden rounded-2xl bg-stone-800 border border-stone-700 p-8 hover:border-amber-500 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]"
      >
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-amber-900/30 text-amber-500 group-hover:scale-110 transition-transform">
            <Users className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-stone-200">双人对弈</h2>
          <p className="text-stone-500 text-sm">Local PvP</p>
        </div>
      </button>

      <button
        onClick={() => onStartGame('ai')}
        className="group relative overflow-hidden rounded-2xl bg-stone-800 border border-stone-700 p-8 hover:border-purple-500 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]"
      >
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-purple-900/30 text-purple-500 group-hover:scale-110 transition-transform">
            <Bot className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-stone-200">挑战 AI</h2>
          <p className="text-stone-500 text-sm">Vs Minimax / Deepseek / OpenAI</p>
        </div>
      </button>
    </div>
  </div>
);