import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Piece as PieceType, Color, Position } from '../api/common/types';
import { PIECE_CHARS } from '../api/common/constants';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  onSquareClick: (pos: Position) => void;
  position: Position;
  isLastMoveSource?: boolean;
  isLastMoveDest?: boolean;
  rotate?: boolean;
  isCaptured?: boolean;
}

export const PieceComponent: React.FC<PieceProps> = memo(({ piece, isSelected, onSquareClick, position, isLastMoveSource, isLastMoveDest, rotate, isCaptured = false }) => {
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
      className={`
        relative w-[90%] h-[90%] rounded-full flex items-center justify-center cursor-pointer select-none
        ${isRed ? 'border-red-700 text-red-700' : 'border-stone-800 text-stone-900'}
        border-[3px]
        bg-gradient-to-br from-amber-100 to-amber-200
        ${(isLastMoveSource || isLastMoveDest) ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent' : ''}
        ${isCaptured ? 'shadow-piece-captured animate-explode' : (isSelected ? 'shadow-piece-selected' : '')}
        ${isCaptured ? 'animate-explode animate-shake' : ''}
      `}
      style={{
        boxShadow: defaultShadow,
        zIndex: isSelected ? 30 : (isCaptured ? 5 : 20),
      }}
      animate={{
        boxShadow: isSelected ? selectedShadow : defaultShadow,
        scale: isCaptured ? 0 : (isSelected ? 1.1 : 1),
        opacity: isCaptured ? 0 : 1,
        rotate: isCaptured ? 45 : 0,
      }}
      transition={{
        layout: { type: "spring", stiffness: 200, damping: 35 }, // 降低stiffness，增加damping使动画更缓慢平滑
        boxShadow: { duration: 0.2 }, // 增加阴影变化的持续时间
        duration: isSelected ? 0.3 : 0.5, // 增加动画持续时间，尤其是非选中状态的移动动画
        ease: isCaptured ? 'easeOut' : 'easeInOut',
      }}
      onClick={handleClick}
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