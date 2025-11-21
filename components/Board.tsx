import React, { memo } from 'react';
import { BoardState, Position, Color, Move, Piece, CaptureAnimationState } from '../api/common/types';
import { PieceComponent } from './Piece';

interface BoardProps {
    board: BoardState;
    onSquareClick: (pos: Position) => void;
    selectedPos: Position | null;
    validMoves: Position[];
    lastMove: Move | null;
    rotateBlack?: boolean;
    captureAnimation?: CaptureAnimationState | null;
    // Theme Props
    boardBgClass?: string;
    boardBorderClass?: string;
    gridColor?: string;
    woodTexture?: boolean;
}

interface BoardCellProps {
    x: number;
    y: number;
    piece: Piece | null;
    isSelected: boolean;
    isValidMove: boolean;
    isLastSource: boolean;
    isLastDest: boolean;
    onSquareClick: (pos: Position) => void;
    rotateBlack?: boolean;
    isCaptured?: boolean;
}

// Memoized cell component to prevent unnecessary re-renders
const BoardCell = memo(({ x, y, piece, isSelected, isValidMove, isLastSource, isLastDest, onSquareClick, rotateBlack, isCaptured = false }: BoardCellProps) => {
    return (
        <div
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
                        onSquareClick={onSquareClick}
                        position={{ x, y }}
                        isLastMoveSource={isLastSource}
                        isLastMoveDest={isLastDest}
                        rotate={rotateBlack && piece.color === Color.Black}
                        isCaptured={isCaptured}
                    />
            )}
        </div>
    );
});
BoardCell.displayName = 'BoardCell';


// Use memo to prevent re-renders when parent state (like timer) changes but board props do not
export const Board = memo(({
    board,
    onSquareClick,
    selectedPos,
    validMoves,
    lastMove,
    rotateBlack,
    captureAnimation,
    boardBgClass = "bg-wood-500",
    boardBorderClass = "border-wood-700",
    gridColor = "#543d18",
    woodTexture = true
}: BoardProps) => {

    return (
        // Outer Frame
        <div className={`relative w-full rounded-lg shadow-2xl p-1 md:p-3 border-[4px] select-none transition-colors duration-500 ${boardBgClass} ${boardBorderClass}`}>

            {/* Inner Coordinate System Container (Strict Aspect Ratio, No Padding) */}
            <div className="relative w-full aspect-[9/10]">

                {/* 1. The Grid Lines (SVG) - Absolute Background */}
                <svg className="absolute inset-0 w-full h-full z-0" viewBox="0 0 90 100" preserveAspectRatio="none">
                    <defs>
                        {woodTexture && (
                            <filter id="wood-grain">
                                <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" stitchTiles="stitch" />
                                <feColorMatrix type="saturate" values="0.1" />
                                <feBlend mode="multiply" in2="SourceGraphic" />
                            </filter>
                        )}
                    </defs>

                    {/* Horizontal Lines */}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <line key={`h-${i}`} x1="5" y1={5 + i * 10} x2="85" y2={5 + i * 10} stroke={gridColor} strokeWidth="0.5" />
                    ))}

                    {/* Vertical Lines (Top Half) */}
                    {Array.from({ length: 9 }).map((_, i) => (
                        <line key={`v-top-${i}`} x1={5 + i * 10} y1="5" x2={5 + i * 10} y2="45" stroke={gridColor} strokeWidth="0.5" />
                    ))}

                    {/* Vertical Lines (Bottom Half) */}
                    {Array.from({ length: 9 }).map((_, i) => (
                        <line key={`v-bot-${i}`} x1={5 + i * 10} y1="55" x2={5 + i * 10} y2="95" stroke={gridColor} strokeWidth="0.5" />
                    ))}

                    {/* River Borders */}
                    <line x1="5" y1="45" x2="5" y2="55" stroke={gridColor} strokeWidth="0.5" />
                    <line x1="85" y1="45" x2="85" y2="55" stroke={gridColor} strokeWidth="0.5" />

                    {/* Palace Crosses (Top) */}
                    <line x1="35" y1="5" x2="55" y2="25" stroke={gridColor} strokeWidth="0.5" />
                    <line x1="55" y1="5" x2="35" y2="25" stroke={gridColor} strokeWidth="0.5" />

                    {/* Palace Crosses (Bottom) */}
                    <line x1="35" y1="75" x2="55" y2="95" stroke={gridColor} strokeWidth="0.5" />
                    <line x1="55" y1="75" x2="35" y2="95" stroke={gridColor} strokeWidth="0.5" />

                    {/* River Text */}
                    <text x="20" y="51.5" fontSize="4" fill={gridColor} fontFamily="serif" dominantBaseline="middle" opacity="0.7" style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: rotateBlack ? 'rotate(180deg)' : 'none' }}>楚 河</text>
                    <text x="70" y="51.5" fontSize="4" fill={gridColor} fontFamily="serif" dominantBaseline="middle" textAnchor="end" opacity="0.7" style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: rotateBlack ? 'rotate(180deg)' : 'none' }}>汉 界</text>

                    {/* Position Markers (Little corners) */}
                    {[
                        [1, 2], [7, 2], // Cannons Top
                        [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], // Soldiers Top
                        [1, 7], [7, 7], // Cannons Bottom
                        [0, 6], [2, 6], [4, 6], [6, 6], [8, 6] // Soldiers Bottom
                    ].map(([gx, gy], idx) => {
                        const cx = 5 + gx * 10;
                        const cy = 5 + gy * 10;
                        const s = 1; // size
                        const g = 0.5; // gap
                        return (
                            <g key={idx} stroke={gridColor} strokeWidth="0.5" fill="none">
                                <path d={`M ${cx - g - s} ${cy - g} L ${cx - g} ${cy - g} L ${cx - g} ${cy - g - s}`} />
                                <path d={`M ${cx + g + s} ${cy - g} L ${cx + g} ${cy - g} L ${cx + g} ${cy - g - s}`} />
                                <path d={`M ${cx - g - s} ${cy + g} L ${cx - g} ${cy + g} L ${cx - g} ${cy + g + s}`} />
                                <path d={`M ${cx + g + s} ${cy + g} L ${cx + g} ${cy + g} L ${cx + g} ${cy + g + s}`} />
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
                            
                            // 检查当前位置是否有吃子动画正在进行
                            const isCaptured = captureAnimation?.position.x === x && 
                                             captureAnimation?.position.y === y && 
                                             captureAnimation?.isAnimating && 
                                             captureAnimation?.piece.id === piece?.id;

                            return (
                                <BoardCell
                                    key={`${x}-${y}`}
                                    x={x}
                                    y={y}
                                    piece={piece}
                                    isSelected={isSelected}
                                    isValidMove={isValidMove}
                                    isLastSource={isLastSource}
                                    isLastDest={isLastDest}
                                    onSquareClick={onSquareClick}
                                    rotateBlack={rotateBlack}
                                    isCaptured={isCaptured}
                                />
                            );
                        })
                    ))}
                </div>
            </div>
        </div>
    );
});

Board.displayName = 'Board';