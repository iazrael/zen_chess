import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Board } from './components/Board';
import { Confetti } from './components/Confetti';
import { GameTimer } from './components/GameTimer';
import { GameSettingsModal, GameSettings } from './components/GameSettingsModal';
import { INITIAL_BOARD, PIECE_CHARS, COL_NUMERALS, MOVE_DIRECTIONS } from './api/common/constants';
import { BoardState, Color, Position, Move, GameStatus, AIModel, Piece, PieceType, CaptureAnimationState } from './api/common/types';
import { getLegalMoves, applyMove, isCheck } from './api/chessRules';
import { getMinimaxMove } from './services/minimaxService';
import { getOpenAIMove } from './services/openaiService';
import { playMoveSound, playCaptureSound, playWinSound, playSelectSound, playInvalidMoveSound, setGlobalVolume } from './utils/sound';
import { Undo2, RotateCcw, Sparkles, ScrollText, Settings, Volume2, VolumeX, X, Users, Bot, ChevronLeft, Home, History as HistoryIcon, Zap } from 'lucide-react';

// --- Theme Definitions (Simplified for Zen focus) ---
const THEME = {
    bgApp: 'bg-stone-900',
    textMain: 'text-stone-100',
    textMuted: 'text-stone-400',
    panelBg: 'bg-stone-800/80',
    panelBorder: 'border-stone-700',
    highlightBg: 'bg-stone-700/50',
    accentText: 'text-amber-500',
    boardBg: 'bg-wood-500',
    boardBorder: 'border-wood-700',
    gridColor: '#543d18',
    woodTexture: true
};

type ViewState = 'home' | 'game';

function App() {
    const [view, setView] = useState<ViewState>('home');

    // Game State
    const [board, setBoard] = useState<BoardState>(INITIAL_BOARD);
    const [turn, setTurn] = useState<Color>(Color.Red);
    const [selectedPos, setSelectedPos] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);
    const [history, setHistory] = useState<{ board: BoardState, turn: Color, lastMove: Move | null }[]>([]);
    const [moveList, setMoveList] = useState<string[]>([]);
    const [lastMove, setLastMove] = useState<Move | null>(null);
    const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.Playing);
    const [isAnimating, setIsAnimating] = useState(false);
    // 新增：吃子动画状态，记录当前正在被吃的棋子位置和状态
    const [captureAnimation, setCaptureAnimation] = useState<CaptureAnimationState | null>(null);

    // Timer State (Only initial settings, running time is inside GameTimer)
    const [initialTime, setInitialTime] = useState<number>(600);
    // We need a key to force reset timers when game resets
    const [gameResetKey, setGameResetKey] = useState(0);

    // AI State
    const [aiModel, setAiModel] = useState<AIModel>(AIModel.None);
    const [aiProvider, setAiProvider] = useState<string>('deepseek'); // New state for AI provider
    const [aiThinking, setAiThinking] = useState(false);
    const [aiReasoning, setAiReasoning] = useState<string | null>(null);
    const [minimaxDepth, setMinimaxDepth] = useState(4);
    const [minimaxVersion, setMinimaxVersion] = useState<'v1' | 'v2'>('v2');
    const [gameMode, setGameMode] = useState<'pvp' | 'ai'>('pvp');

    // UI State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [pendingGameMode, setPendingGameMode] = useState<'pvp' | 'ai'>('pvp');

    const historyContainerRef = useRef<HTMLDivElement>(null);

    // State Ref for Stable Event Handlers
    // This allows us to access the latest state in callbacks without updating the callback reference itself
    const gameStateRef = useRef({
        board,
        turn,
        selectedPos,
        validMoves,
        aiModel,
        aiProvider, // Add aiProvider to ref
        aiThinking,
        gameStatus,
        isAnimating,
        captureAnimation
    });

    // Sync ref with state on every render
    useEffect(() => {
        gameStateRef.current = {
            board,
            turn,
            selectedPos,
            validMoves,
            aiModel,
            aiProvider, // Add aiProvider to ref
            aiThinking,
            gameStatus,
            isAnimating,
            captureAnimation
        };
    });

    // Apply Volume
    useEffect(() => {
        setGlobalVolume(volume);
    }, [volume]);

    // Sound on Game Over
    useEffect(() => {
        if (gameStatus === GameStatus.RedWin || gameStatus === GameStatus.BlackWin) {
            playWinSound();
        }
    }, [gameStatus]);

    const handleTimeOut = useCallback((color: Color) => {
        if (gameStatus !== GameStatus.Playing) return;
        setGameStatus(color === Color.Red ? GameStatus.BlackWin : GameStatus.RedWin);
    }, [gameStatus]);

    // Auto-scroll history
    useEffect(() => {
        if (historyContainerRef.current && isHistoryOpen) {
            const { scrollHeight, clientHeight } = historyContainerRef.current;
            if (scrollHeight > clientHeight) {
                historyContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
            }
        }
    }, [moveList, isHistoryOpen]);

    const startGame = (mode: 'pvp' | 'ai') => {
        setPendingGameMode(mode);
        setIsSettingsModalOpen(true);
    };

    const handleSettingsConfirm = (settings: GameSettings) => {
        resetGameLogic();
        
        // Apply settings
        setGameMode(settings.gameMode);
        setInitialTime(settings.gameTime);
        setVolume(settings.volume);
        
        if (settings.gameMode === 'pvp') {
            setAiModel(AIModel.None);
        } else {
            // AI mode
            if (settings.algorithmType === 'traditional') {
                setAiModel(AIModel.Traditional);
                setMinimaxVersion(settings.minimaxVersion || 'v2');
                setMinimaxDepth(settings.difficulty || 4);
            } else {
                setAiModel(AIModel.OpenAI);
                setAiProvider(settings.llmProvider || 'deepseek');
            }
        }
        
        setIsSettingsModalOpen(false);
        setView('game');
    };

    const resetGameLogic = () => {
        setBoard(INITIAL_BOARD);
        setTurn(Color.Red);
        setHistory([]);
        setMoveList([]);
        setLastMove(null);
        setGameStatus(GameStatus.Playing);
        setAiReasoning(null);
        setGameResetKey(prev => prev + 1);
        setSelectedPos(null);
        setValidMoves([]);
    };

    const getMoveNotation = (piece: Piece, from: Position, to: Position) => {
        const isRed = piece.color === Color.Red;

        // 1. Get Piece Character
        const pieceChar = PIECE_CHARS[piece.color][piece.type];

        // 2. Calculate From Column (1-9)
        // Red: Right (x=8) is 1. Black: Right (x=0) is 1.
        const fromCol = isRed ? (9 - from.x) : (from.x + 1);

        // 3. Calculate Direction and Value
        let dir = '';
        let val = 0;

        const isHorizontal = from.y === to.y;

        if (isHorizontal) {
            dir = MOVE_DIRECTIONS[piece.color].Horizontal; // 平
            // Value is Target Column
            val = isRed ? (9 - to.x) : (to.x + 1);
        } else {
            // Vertical
            const isMovingForward = isRed ? (to.y < from.y) : (to.y > from.y);
            dir = isMovingForward ? MOVE_DIRECTIONS[piece.color].Forward : MOVE_DIRECTIONS[piece.color].Backward; // 进/退

            // Value depends on piece type
            // Horse, Elephant, Advisor, General: Always Target Column
            if ([PieceType.Horse, PieceType.Elephant, PieceType.Advisor, PieceType.General].includes(piece.type)) {
                val = isRed ? (9 - to.x) : (to.x + 1);
            } else {
                // Chariot, Cannon, Soldier: Distance
                val = Math.abs(to.y - from.y);
            }
        }

        // 4. Format String
        // Red uses Chinese numerals for everything. Black uses Arabic.
        const colStr = COL_NUMERALS[piece.color][fromCol];
        const valStr = COL_NUMERALS[piece.color][val];

        return `${pieceChar}${colStr}${dir}${valStr}`;
    };

    const executeMoveStable = useCallback((from: Position, to: Position) => {
        const currentBoard = gameStateRef.current.board;
        const movedPiece = currentBoard[from.y][from.x];
        const targetPiece = currentBoard[to.y][to.x];
        
        setIsAnimating(true);
        
        // 如果有目标棋子（吃子），设置吃子动画状态
        if (targetPiece) {
            playCaptureSound();
            // 设置吃子动画状态，包含被吃棋子的信息
            setCaptureAnimation({
                position: to,
                piece: targetPiece,
                isAnimating: true
            });
        } else {
            playMoveSound();
        }
        
        // 记录走法符号
        const notation = movedPiece ? getMoveNotation(movedPiece, from, to) : "";
        if (notation) setMoveList(prev => [...prev, notation]);
        
        // 设置最后一步棋
        setLastMove({ from, to, captured: targetPiece || undefined });
        setSelectedPos(null);
        setValidMoves([]);
        
        // 等待一小段时间让吃子动画开始播放，然后再应用移动
        // 这样可以确保移动的棋子有平滑的动画过渡，而不是直接闪现
        setTimeout(() => {
            // 应用移动到棋盘
            setBoard(prevBoard => applyMove(prevBoard, from, to));
            
            // 更新历史记录和回合
            const currentTurn = gameStateRef.current.turn;
            setHistory(prevHistory => [
                ...prevHistory,
                {
                    board: currentBoard,
                    turn: currentTurn,
                    lastMove: { from, to, captured: targetPiece || undefined },
                }
            ]);
            
            const nextTurn = currentTurn === Color.Red ? Color.Black : Color.Red;
            setTurn(nextTurn);
            
            // 检查游戏是否结束
            const newBoard = applyMove(currentBoard, from, to);
            let hasMoves = false;
            for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 9; x++) {
                    const p = newBoard[y][x];
                    if (p && p.color === nextTurn) {
                        if (getLegalMoves(newBoard, { x, y }).length > 0) {
                            hasMoves = true;
                            break;
                        }
                    }
                }
                if (hasMoves) break;
            }
            
            if (!hasMoves) {
                setGameStatus(nextTurn === Color.Red ? GameStatus.BlackWin : GameStatus.RedWin);
            }
            
            // 重置动画状态，给动画足够的时间完成
            setTimeout(() => {
                setIsAnimating(false);
                // 重置吃子动画状态，但保留足够的时间让动画播放完成
                setTimeout(() => {
                    setCaptureAnimation(null);
                }, 500); // 增加吃子动画的保留时间
            }, 800); // 800ms 应该足够完整的动画效果显示
        }, 50); // 短暂延迟，确保动画能够开始
    }, []);

    // Fully stable handler that doesn't change reference when validMoves changes
    const handleSquareClickStable = useCallback(async (pos: Position) => {
        const { gameStatus, aiThinking, aiModel, aiProvider, turn, board, selectedPos, validMoves, isAnimating } = gameStateRef.current;

        if (gameStatus !== GameStatus.Playing || aiThinking || isAnimating) return;
        if (aiModel !== AIModel.None && turn === Color.Black) return;

        const piece = board[pos.y][pos.x];

        // Move Logic: Use data from ref
        if (selectedPos && validMoves.some(m => m.x === pos.x && m.y === pos.y)) {
            executeMoveStable(selectedPos, pos);
            return;
        }

        // Check for invalid move while in check
        if (isCheck(board, turn)) {
            // If we clicked a square that is NOT a valid move (and we have a selection), OR if we are selecting a piece that has NO valid moves to escape check (optional, but maybe too aggressive).
            // Let's stick to: if we try to move (have selection) and it's not valid, play sound.
            // But wait, if we click a friendly piece, we switch selection. That shouldn't error.
            // So, if we click an empty square or enemy piece AND it's not in validMoves, AND we are in check.
            const targetPiece = board[pos.y][pos.x];
            const isFriendly = targetPiece && targetPiece.color === turn;

            if (selectedPos && !isFriendly && !validMoves.some(m => m.x === pos.x && m.y === pos.y)) {
                playInvalidMoveSound();
                return;
            }
        }

        // Select Logic
        if (piece && piece.color === turn) {
            // Only trigger update if actually changing selection to further reduce renders
            if (selectedPos?.x !== pos.x || selectedPos?.y !== pos.y) {
                playSelectSound(); // Play select sound
                setSelectedPos(pos);
                setValidMoves(getLegalMoves(board, pos));
            }
            return;
        }

        // Deselect Logic
        if (selectedPos) {
            setSelectedPos(null);
            setValidMoves([]);
        }
    }, [executeMoveStable]); // Only depends on executeMoveStable which is also stable


    // AI Logic
    useEffect(() => {
        if (gameStatus !== GameStatus.Playing || view !== 'game') return;
        if (turn === Color.Black && aiModel !== AIModel.None && !isAnimating) {
            const runAI = async () => {
                setAiThinking(true);
                setAiReasoning(null);

                let move: { from: Position, to: Position, reason?: string } | null = null;

                try {
                    if (aiModel === AIModel.Traditional) {
                        move = await getMinimaxMove(board, turn, minimaxDepth, minimaxVersion);
                    } else if (aiModel === AIModel.OpenAI) {
                        move = await getOpenAIMove(board, turn, aiProvider); // Pass aiProvider
                        if (move?.reason) setAiReasoning(move.reason);
                    }
                } catch (e) {
                    console.error("AI Error", e);
                }

                if (move) {
                    executeMoveStable(move.from, move.to);
                } else {
                    console.warn("AI Resigns");
                    setGameStatus(GameStatus.RedWin);
                }
                setAiThinking(false);
            };
            runAI();
        }
    }, [turn, aiModel, aiProvider, gameStatus, view, board, minimaxDepth, minimaxVersion, executeMoveStable, isAnimating]);

    const undo = () => {
        if (history.length === 0 || aiThinking) return;
        const steps = aiModel !== AIModel.None ? 2 : 1;
        if (history.length < steps) return;

        const prevState = history[history.length - steps];
        setBoard(prevState.board);
        setTurn(prevState.turn);
        setLastMove(prevState.lastMove || null);

        setHistory(prev => prev.slice(0, -steps));
        setMoveList(prev => prev.slice(0, -steps));

        setGameStatus(GameStatus.Playing);
    };

    const changeTimeControl = (seconds: number) => {
        setInitialTime(seconds);
        resetGameLogic();
    };

    const getWinMessage = () => {
        if (gameStatus === GameStatus.RedWin) {
            return "Checkmate! Red Wins!"; // Simplified message since we don't track timeout source here easily without more state
        }
        if (gameStatus === GameStatus.BlackWin) {
            return "Checkmate! Black Wins!";
        }
        return "";
    };

    // --- Components ---

    const HomeView = () => (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                <button
                    onClick={() => startGame('pvp')}
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
                    onClick={() => startGame('ai')}
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

    // Time and Controls Module (统一时间和控制)
    const TimeAndControlsModule = () => (
        <div className={`${THEME.panelBg} rounded-xl p-3 shadow-lg border ${THEME.panelBorder} backdrop-blur-sm w-full`}>
            {/* Timers and Controls Row */}
            <div className="flex items-center justify-between gap-2">
                {/* Red Timer */}
                <GameTimer
                    initialTime={initialTime}
                    isActive={gameStatus === GameStatus.Playing && turn === Color.Red}
                    onTimeOut={() => handleTimeOut(Color.Red)}
                    label="Red"
                    colorClass="text-red-400"
                    resetKey={gameResetKey}
                />
                
                {/* Controls Section */}
                <div className="flex items-center justify-center gap-3">
                    {/* Undo Button */}
                    <button 
                        onClick={undo} 
                        disabled={history.length === 0 || aiThinking || gameStatus !== GameStatus.Playing} 
                        className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-stone-700/40 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-stone-300 hover:text-white transition-all duration-200 group"
                        title="Undo"
                    >
                        <Undo2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-semibold tracking-wider uppercase">悔棋</span>
                    </button>
                    {/* Reset Button */}
                    <button 
                        onClick={resetGameLogic} 
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
                    onTimeOut={() => handleTimeOut(Color.Black)}
                    label="Black"
                    colorClass="text-stone-400"
                    resetKey={gameResetKey}
                />
            </div>

            {gameStatus !== GameStatus.Playing && (
                <div className="p-2 bg-amber-900/30 border border-amber-700 rounded text-center animate-bounce">
                    <span className="text-sm font-bold text-amber-400">
                        {getWinMessage()}
                    </span>
                </div>
            )}
        </div>
    );

    // AI Thinking Module (独立组件)
    const AIThinkingModule = () => {
        if (aiModel === AIModel.None) return null;

        return (
            <div className={`${THEME.panelBg} rounded-xl p-3 shadow-lg border ${THEME.panelBorder} backdrop-blur-sm w-full`}>
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

    const ScoreboardAndControls = () => (
        <div className="flex flex-col gap-3 w-full mb-4">
            <TimeAndControlsModule />
            <AIThinkingModule />
        </div>
    );

    const HistoryModal = () => {
        if (!isHistoryOpen) return null;
        return (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-fade-in" onClick={() => setIsHistoryOpen(false)}>
                <div className="w-80 h-full bg-stone-900 border-l border-stone-700 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-stone-700 flex items-center justify-between bg-stone-800">
                        <h3 className="font-bold text-stone-200 flex items-center gap-2">
                            <ScrollText className="w-4 h-4 text-amber-500" /> Game History
                        </h3>
                        <button onClick={() => setIsHistoryOpen(false)} className="text-stone-500 hover:text-white"><X className="w-5 h-5" /></button>
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

    const GameView = () => (
        <div className="min-h-screen flex flex-col p-2 md:p-4">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-4 px-2">
                <button
                    onClick={() => setView('home')}
                    className="flex items-center gap-2 text-stone-400 hover:text-amber-500 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" /> <Home className="w-4 h-4" />
                </button>
                <h2 className="text-xl font-calligraphy text-stone-200 tracking-widest">中国象棋</h2>
                <button
                    onClick={() => setIsHistoryOpen(true)}
                    className={`p-2 rounded-full transition-colors ${isHistoryOpen ? 'bg-amber-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'}`}
                >
                    <HistoryIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start">

                {/* Desktop: Left Sidebar (Time + AI Thinking) */}
                <div className="hidden lg:flex w-[350px] flex-col gap-3 flex-shrink-0 sticky top-4 order-1">
                    <TimeAndControlsModule />
                    <AIThinkingModule />
                </div>

                {/* Center: Board Area */}
                <div className="flex-1 flex flex-col items-center order-2">

                {/* Mobile: Time Controls and AI Thinking */}
                    <div className="lg:hidden w-full max-w-[600px] mb-3 flex flex-col gap-3">
                        <TimeAndControlsModule />
                        <AIThinkingModule />
                    </div>

                    {/* Board */}
                    <div className="w-full max-w-[600px] lg:max-w-[700px]">
                        <Board
                            board={board}
                            onSquareClick={handleSquareClickStable}
                            selectedPos={selectedPos}
                            validMoves={validMoves}
                            lastMove={lastMove}
                            boardBgClass={THEME.boardBg}
                            boardBorderClass={THEME.boardBorder}
                            gridColor={THEME.gridColor}
                            woodTexture={THEME.woodTexture}
                            captureAnimation={captureAnimation}
                        />
                    </div>

                </div>
            </div>
        </div>
    );

    return (
        <div className={`${THEME.bgApp} ${THEME.textMain} min-h-screen`}>
            {view === 'home' ? HomeView() : GameView()}
            {HistoryModal()}
            <GameSettingsModal
                isOpen={isSettingsModalOpen}
                mode={pendingGameMode}
                initialSettings={{
                    gameTime: initialTime,
                    volume: volume,
                    algorithmType: 'traditional',
                    minimaxVersion: minimaxVersion,
                    difficulty: minimaxDepth as 3 | 4 | 5,
                    llmProvider: aiProvider
                }}
                onClose={() => setIsSettingsModalOpen(false)}
                onConfirm={handleSettingsConfirm}
            />
            {gameStatus !== GameStatus.Playing && <Confetti />}
        </div>
    );
}

export default App;