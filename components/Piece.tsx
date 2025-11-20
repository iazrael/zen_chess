import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Piece as PieceType, Color, Position } from '../types';
import { PIECE_CHARS } from '../constants';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  onSquareClick: (pos: Position) => void;
  position: Position;
  isLastMoveSource?: boolean;
  isLastMoveDest?: boolean;
  rotate?: boolean;
}

export const PieceComponent: React.FC<PieceProps> = memo(({ piece, isSelected, onSquareClick, position, isLastMoveSource, isLastMoveDest, rotate }) => {
  const isRed = piece.color === Color.Red;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSquareClick(position);
  };

  // Define stable shadows
  const defaultShadow = '2px 4px 8px rgba(0,0,0,0.4), inset 0 0 10px rgba(255,255,255,0.6)';
  const selectedShadow = '0 0 20px rgba(255, 215, 0, 0.9), inset 0 0 10px rgba(0,0,0,0.1)';

  return (
    <motion.div
      layoutId={piece.id}
      // Use style for static properties that shouldn't animate drastically on mount
      style={{
        boxShadow: defaultShadow // Base shadow always applied via style
      }}
      animate={{ 
        // Only animate the shadow CHANGE when selected, otherwise keep it stable
        boxShadow: isSelected ? selectedShadow : defaultShadow,
        zIndex: isSelected ? 30 : 20,
        scale: isSelected ? 1.1 : 1 // Subtle scale for selection feedback
      }}
      transition={{ 
        layout: { type: "spring", stiffness: 300, damping: 30 }, // Smooth movement
        boxShadow: { duration: 0.2 },
        scale: { duration: 0.2 }
      }}
      onClick={handleClick}
      className={`
        relative w-[90%] h-[90%] rounded-full flex items-center justify-center cursor-pointer select-none
        ${isRed ? 'border-red-700 text-red-700' : 'border-stone-800 text-stone-900'}
        border-[3px]
        bg-gradient-to-br from-amber-100 to-amber-200
        ${(isLastMoveSource || isLastMoveDest) ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent' : ''}
      `}
    >
      {/* Inner Ring for aesthetics */}
      <div className={`absolute w-[85%] h-[85%] rounded-full border border-dashed ${isRed ? 'border-red-300' : 'border-stone-400'} opacity-50`}></div>
      
      {/* Character */}
      <span 
        className={`text-2xl md:text-3xl lg:text-4xl font-calligraphy font-bold drop-shadow-sm pb-1 transition-transform duration-500 ${rotate ? 'rotate-180' : ''}`}
        style={{ 
          textShadow: '0px 1px 1px rgba(255,255,255,0.8)' 
        }}
      >
        {PIECE_CHARS[piece.color][piece.type]}
      </span>
      
      {/* Wood grain overlay effect */}
      <div className="absolute inset-0 rounded-full bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-20 pointer-events-none"></div>
    </motion.div>
  );
});

PieceComponent.displayName = 'PieceComponent';