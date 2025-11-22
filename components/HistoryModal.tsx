import React, { useRef, useEffect } from 'react';
import { X, ScrollText } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  moveList: string[];
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, 
  moveList, 
  onClose 
}) => {
  const historyContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll history
  useEffect(() => {
    if (historyContainerRef.current && isOpen) {
      const { scrollHeight, clientHeight } = historyContainerRef.current;
      if (scrollHeight > clientHeight) {
        historyContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      }
    }
  }, [moveList, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-fade-in" onClick={onClose}>
      <div className="w-80 h-full bg-stone-900 border-l border-stone-700 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-stone-700 flex items-center justify-between bg-stone-800">
          <h3 className="font-bold text-stone-200 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-amber-500" /> Game History
          </h3>
          <button onClick={onClose} className="text-stone-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div ref={historyContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
          {moveList.length === 0 ? (
            <div className="text-stone-600 text-center py-10 italic">No moves yet</div>
          ) : (
            moveList.map((move, index) => (
              <div key={index} className={`flex items-center gap-3 p-2 rounded text-xs ${index === moveList.length - 1 ? 'bg-amber-900/20 border border-amber-800/50' : 'hover:bg-stone-800'}`}>
                <span className="text-stone-500 w-5 text-right font-mono">{index + 1}.</span>
                <div className={`flex items-center gap-2 ${index % 2 === 0 ? 'text-red-400' : 'text-stone-300'}`}>
                  <span>{index % 2 === 0 ? '🔴' : '⚫'}</span>
                  <span>{move}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};