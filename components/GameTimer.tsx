import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface GameTimerProps {
  initialTime: number;
  isActive: boolean;
  onTimeOut: () => void;
  label: string;
  colorClass: string; // e.g., 'text-red-400'
  resetKey: number; // Used to force reset the timer when game restarts
}

export const GameTimer: React.FC<GameTimerProps> = ({ initialTime, isActive, onTimeOut, label, colorClass, resetKey }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  // Reset timer when initialTime or resetKey changes
  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime, resetKey]);

  useEffect(() => {
    if (!isActive || initialTime === 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, initialTime, onTimeOut]);

  const formatTime = (seconds: number) => {
    if (initialTime === 0) return "∞";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex-1 p-2 rounded-lg border flex flex-col items-center transition-all duration-300 ${isActive ? 'bg-stone-700/50 border-stone-500' : 'bg-stone-800/30 border-transparent opacity-60'}`}>
        <div className={`text-[10px] ${colorClass} font-bold uppercase tracking-wider flex items-center gap-1`}>
            <Clock className="w-3 h-3" /> {label}
        </div>
        <div className={`text-xl md:text-2xl font-mono font-bold text-stone-200 ${isActive && timeLeft < 30 && initialTime > 0 ? 'animate-pulse text-red-500' : ''}`}>
            {formatTime(timeLeft)}
        </div>
    </div>
  );
};