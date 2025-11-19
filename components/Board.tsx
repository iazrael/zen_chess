import React from 'react';
import { BoardState, Position, Color, Move } from '../types';
import { PieceComponent } from './Piece';

interface BoardProps {
  board: BoardState;
  onSquareClick: (pos: Position) => void;
  selectedPos: Position | null;
  validMoves: Position[];
  lastMove: Move | null;
}

export const Board: React.FC<BoardProps> = ({ board, onSquareClick, selectedPos, validMoves, lastMove }) => {
  
  return (
    // Outer Frame (Wood texture, padding, border, shadow)
    <div className="relative w-full max-w-[600px] bg-wood-500 rounded-lg shadow-2xl p-1 md:p-3 border-[4px] border-wood-700 select-none">
      
      {/* Inner Coordinate System Container (Strict Aspect Ratio, No Padding) */}
      <div className="relative w-full aspect-[9/10]">
        
        {/* 1. The Grid Lines (SVG) - Absolute Background */}
        <svg className="absolute inset-0 w-full h-full z-0" viewBox="0 0 90 100" preserveAspectRatio="none">
            <defs>
                <filter id="wood-grain">
                    <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0.1" />
                    <feBlend mode="multiply" in2="SourceGraphic" />
                </filter>
            </defs>
            
            {/* Horizontal Lines */}
            {Array.from({ length: 10 }).map((_, i) => (
            <line key={`h-${i}`} x1="5" y1={5 + i * 10} x2="85" y2={5 + i * 10} stroke="#543d18" strokeWidth="0.5" />
            ))}

            {/* Vertical Lines (Top Half) */}
            {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v-top-${i}`} x1={5 + i * 10} y1="5" x2={5 + i * 10} y2="45" stroke="#543d18" strokeWidth="0.5" />
            ))}

            {/* Vertical Lines (Bottom Half) */}
            {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v-bot-${i}`} x1={5 + i * 10} y1="55" x2={5 + i * 10} y2="95" stroke="#543d18" strokeWidth="0.5" />
            ))}
            
            {/* River Borders */}
            <line x1="5" y1="45" x2="5" y2="55" stroke="#543d18" strokeWidth="0.5" />
            <line x1="85" y1="45" x2="85" y2="55" stroke="#543d18" strokeWidth="0.5" />

            {/* Palace Crosses (Top) */}
            <line x1="35" y1="5" x2="55" y2="25" stroke="#543d18" strokeWidth="0.5" />
            <line x1="55" y1="5" x2="35" y2="25" stroke="#543d18" strokeWidth="0.5" />

            {/* Palace Crosses (Bottom) */}
            <line x1="35" y1="75" x2="55" y2="95" stroke="#543d18" strokeWidth="0.5" />
            <line x1="55" y1="75" x2="35" y2="95" stroke="#543d18" strokeWidth="0.5" />

            {/* River Text */}
            <text x="20" y="51.5" fontSize="4" fill="#543d18" fontFamily="serif" dominantBaseline="middle" opacity="0.7">楚 河</text>
            <text x="70" y="51.5" fontSize="4" fill="#543d18" fontFamily="serif" dominantBaseline="middle" textAnchor="end" opacity="0.7">汉 界</text>
            
            {/* Position Markers (Little corners) */}
            {[
                [1,2], [7,2], // Cannons Top
                [0,3], [2,3], [4,3], [6,3], [8,3], // Soldiers Top
                [1,7], [7,7], // Cannons Bottom
                [0,6], [2,6], [4,6], [6,6], [8,6] // Soldiers Bottom
            ].map(([gx, gy], idx) => {
                const cx = 5 + gx * 10;
                const cy = 5 + gy * 10;
                const s = 1; // size
                const g = 0.5; // gap
                return (
                    <g key={idx} stroke="#543d18" strokeWidth="0.5" fill="none">
                        <path d={`M ${cx-g-s} ${cy-g} L ${cx-g} ${cy-g} L ${cx-g} ${cy-g-s}`} />
                        <path d={`M ${cx+g+s} ${cy-g} L ${cx+g} ${cy-g} L ${cx+g} ${cy-g-s}`} />
                        <path d={`M ${cx-g-s} ${cy+g} L ${cx-g} ${cy+g} L ${cx-g} ${cy+g+s}`} />
                        <path d={`M ${cx+g+s} ${cy+g} L ${cx+g} ${cy+g} L ${cx+g} ${cy+g+s}`} />
                    </g>
                )
            })}
        </svg>

        {/* 2. Interactive Grid Layer - Absolutely positioned on top */}
        <div className="absolute inset-0 z-10 grid grid-rows-10 grid-cols-9 w-full h-full">
            {board.map((row, y) => (
                row.map((piece, x) => {
                    const isSelected = selectedPos?.x === x && selectedPos?.y === y;
                    const isValidMove = validMoves.some(m => m.x === x && m.y === y);
                    const isLastSource = lastMove?.from.x === x && lastMove?.from.y === y;
                    const isLastDest = lastMove?.to.x === x && lastMove?.to.y === y;

                    return (
                        <div 
                            key={`${x}-${y}`} 
                            className="relative flex items-center justify-center"
                            onClick={() => onSquareClick({ x, y })}
                        >
                            {/* Move Indicator Dot */}
                            {isValidMove && !piece && (
                                <div className="absolute w-[20%] h-[20%] bg-green-600/50 rounded-full animate-pulse pointer-events-none shadow-[0_0_5px_rgba(22,163,74,0.5)]"></div>
                            )}
                            
                            {/* Capture Indicator Ring */}
                            {isValidMove && piece && (
                                <div className="absolute w-[90%] h-[90%] border-2 md:border-4 border-red-500/60 rounded-full animate-pulse pointer-events-none"></div>
                            )}

                            {/* The Piece */}
                            {piece && (
                                <PieceComponent 
                                    piece={piece} 
                                    isSelected={isSelected} 
                                    onClick={() => onSquareClick({x,y})}
                                    isLastMoveSource={isLastSource}
                                    isLastMoveDest={isLastDest}
                                />
                            )}
                        </div>
                    );
                })
            ))}
        </div>
      </div>
    </div>
  );
};