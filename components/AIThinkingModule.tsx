import React from 'react';
import { Sparkles } from 'lucide-react';
import { AIModel } from '@/api/common/types';

interface AIThinkingModuleProps {
  aiModel: AIModel;
  aiThinking: boolean;
  aiReasoning: string | null;
}

export const AIThinkingModule: React.FC<AIThinkingModuleProps> = ({ 
  aiModel, 
  aiThinking, 
  aiReasoning 
}) => {
  if (aiModel === AIModel.None) return null;

  return (
    <div className="bg-stone-800/80 rounded-xl p-3 shadow-lg border border-stone-700 backdrop-blur-sm w-full">
      {/* 统一容器，避免跳动 */}
      <div className="min-h-[44px] flex items-center">
        {aiThinking ? (
          <div className="flex items-center justify-center gap-3 text-amber-500 w-full">
            <div className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span className="text-xs animate-pulse">AI 思考中...</span>
          </div>
        ) : aiReasoning ? (
          <div className="animate-fade-in w-full">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Sparkles className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">分析</span>
            </div>
            <p className="text-xs text-stone-300 italic leading-relaxed line-clamp-2">
              "{aiReasoning}"
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center text-stone-600 text-xs italic w-full">
            等待 AI 行动...
          </div>
        )}
      </div>
    </div>
  );
};