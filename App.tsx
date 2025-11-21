import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Board } from './components/Board';
import { Confetti } from './components/Confetti';
import { GameTimer } from './components/GameTimer';
import { INITIAL_BOARD, PIECE_CHARS } from './api/common/constants';
import { BoardState, Color, Position, Move, GameStatus, AIModel, Piece } from './api/common/types';
import { getLegalMoves, applyMove, isCheck } from './api/chessRules';
import { getBestMoveMinimax } from './api/minimax';
import { getGeminiMove } from './services/geminiService';
import { getOpenAIMove } from './services/openaiService';
import { playMoveSound, playCaptureSound, playWinSound, playSelectSound, playInvalidMoveSound, setGlobalVolume } from './utils/sound';
import { Undo2, RotateCcw, BrainCircuit, Sparkles, ScrollText, Settings, Volume2, VolumeX, X, Users, Bot, ChevronLeft, Home, History as HistoryIcon, Zap } from 'lucide-react';

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

    // Timer State (Only initial settings, running time is inside GameTimer)
    const [initialTime, setInitialTime] = useState<number>(600);
    // We need a key to force reset timers when game resets
    const [gameResetKey, setGameResetKey] = useState(0);

    // AI State
    const [aiModel, setAiModel] = useState<AIModel>(AIModel.None);
    const [aiProvider, setAiProvider] = useState<string>('deepseek'); // New state for AI provider
    const [aiThinking, setAiThinking] = useState(false);
    const [aiReasoning, setAiReasoning] = useState<string | null>(null);
    const [minimaxDepth, setMinimaxDepth] = useState(3);

    // UI State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [volume, setVolume] = useState(0.5);

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
        isAnimating
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
            isAnimating
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
        resetGameLogic();
        if (mode === 'pvp') {
            setAiModel(AIModel.None);
        } else {
            setAiModel(AIModel.Traditional); // Default to Minimax
        }
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
        const char = PIECE_CHARS[piece.color][piece.type];
        return `${char} (${from.x},${from.y}) → (${to.x},${to.y})`;
    };

    const executeMoveStable = useCallback((from: Position, to: Position) => {
        setIsAnimating(true);
        setBoard(currentBoard => {
            const movedPiece = currentBoard[from.y][from.x];
            const targetPiece = currentBoard[to.y][to.x];

            if (targetPiece) playCaptureSound();
            else playMoveSound();

            const notation = movedPiece ? getMoveNotation(movedPiece, from, to) : "";
            if (notation) setMoveList(prev => [...prev, notation]);

            // Update History using current state
            setTurn(currentTurn => {
                setHistory(prevHistory => [
                    ...prevHistory,
                    {
                        board: currentBoard,
                        turn: currentTurn,
                        lastMove: { from, to, captured: targetPiece || undefined },
                    }
                ]);

                // Apply Move
                const newBoard = applyMove(currentBoard, from, to);

                // Check Game Over on new board
                const nextTurn = currentTurn === Color.Red ? Color.Black : Color.Red;

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

                return nextTurn;
            });

            setLastMove({ from, to, captured: targetPiece || undefined });
            setSelectedPos(null);
            setValidMoves([]);

            return applyMove(currentBoard, from, to);
        });

        // 重置动画状态，给动画一些时间完成
        setTimeout(() => {
            setIsAnimating(false);
        }, 300); // 300ms 应该足够动画完成
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
                        move = await getBestMoveMinimax(board, turn, minimaxDepth);
                    } else if (aiModel === AIModel.GeminiFlash || aiModel === AIModel.GeminiPro) {
                        move = await getGeminiMove(board, turn, aiModel);
                        if (move?.reason) setAiReasoning(move.reason);
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
    }, [turn, aiModel, aiProvider, gameStatus, view, board, minimaxDepth, executeMoveStable, isAnimating]); // Add aiProvider to dependencies

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
            <h1 className="text-6xl md:text-8xl font-bold font-calligraphy text-amber-500 mb-2 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] text-center">
                中国象棋
            </h1>
            <p className="text-stone-400 tracking-[0.5em] uppercase mb-12 text-sm md:text-base">Zen Xiangqi</p>

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
                        <p className="text-stone-500 text-sm">Vs Minimax / Gemini / OpenAI</p>
                    </div>
                </button>
            </div>

            {/* Volume Control on Home */}
            <div className="mt-12 flex items-center gap-4 bg-stone-800/50 px-6 py-3 rounded-full">
                <button onClick={() => setVolume(volume > 0 ? 0 : 0.5)} className="text-stone-400 hover:text-white">
                    {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                    type="range" min="0" max="1" step="0.1" value={volume}
                    onChange={e => setVolume(parseFloat(e.target.value))}
                    className="w-32 h-1.5 bg-stone-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
            </div>
        </div>
    );

    const ScoreboardAndControls = () => (
        <div className={`${THEME.panelBg} rounded-xl p-3 shadow-lg border ${THEME.panelBorder} backdrop-blur-sm w-full mb-4`}>
            {/* Clocks */}
            <div className="flex items-center justify-between gap-2 mb-3">
                <GameTimer
                    initialTime={initialTime}
                    isActive={gameStatus === GameStatus.Playing && turn === Color.Red}
                    onTimeOut={() => handleTimeOut(Color.Red)}
                    label="Red"
                    colorClass="text-red-400"
                    resetKey={gameResetKey}
                />

                <div className="text-stone-600 font-bold text-sm italic">VS</div>

                <GameTimer
                    initialTime={initialTime}
                    isActive={gameStatus === GameStatus.Playing && turn === Color.Black}
                    onTimeOut={() => handleTimeOut(Color.Black)}
                    label="Black"
                    colorClass="text-stone-400"
                    resetKey={gameResetKey}
                />
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-2 pt-2 border-t border-stone-700">
                {/* Time Selection */}
                <div className="flex gap-1 bg-stone-900/40 p-1 rounded-lg mr-auto">
                    {[0, 600, 1200].map(t => (
                        <button
                            key={t}
                            onClick={() => changeTimeControl(t)}
                            className={`px-3 py-1 text-[10px] rounded transition-all ${initialTime === t ? 'bg-stone-600 text-stone-100 shadow' : 'text-stone-500 hover:text-stone-300'}`}
                        >
                            {t === 0 ? '∞' : `${t / 60}m`}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <button onClick={undo} disabled={history.length === 0 || aiThinking || gameStatus !== GameStatus.Playing} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white disabled:opacity-30" title="Undo">
                    <Undo2 className="w-4 h-4" />
                </button>
                <button onClick={resetGameLogic} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white" title="Reset">
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>

            {gameStatus !== GameStatus.Playing && (
                <div className="mt-2 p-2 bg-amber-900/30 border border-amber-700 rounded text-center animate-bounce">
                    <span className="text-sm font-bold text-amber-400">
                        {getWinMessage()}
                    </span>
                </div>
            )}
        </div>
    );

    const AIConsole = () => (
        <div className={`${THEME.panelBg} rounded-xl p-4 border ${THEME.panelBorder} backdrop-blur-sm w-full h-full flex flex-col min-h-[200px]`}>
            <h2 className="text-sm font-bold text-stone-300 flex items-center gap-2 mb-3">
                <BrainCircuit className="w-4 h-4 text-purple-500" /> AI Console
            </h2>

            {/* Model Selector - Updated grid to 4 cols or auto flow */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                    onClick={() => setAiModel(AIModel.None)}
                    className={`py-2 px-1 text-[10px] md:text-xs rounded border transition-all ${aiModel === AIModel.None ? 'border-amber-600 bg-amber-600/20 text-amber-500' : 'border-stone-700 bg-stone-800 text-stone-500 hover:bg-stone-700'}`}
                >
                    PvP Mode
                </button>
                <button
                    onClick={() => setAiModel(AIModel.Traditional)}
                    className={`py-2 px-1 text-[10px] md:text-xs rounded border transition-all ${aiModel === AIModel.Traditional ? 'border-blue-600 bg-blue-600/20 text-blue-400' : 'border-stone-700 bg-stone-800 text-stone-500 hover:bg-stone-700'}`}
                >
                    Minimax
                </button>
                <button
                    onClick={() => setAiModel(AIModel.OpenAI)}
                    className={`py-2 px-1 text-[10px] md:text-xs rounded border transition-all ${aiModel === AIModel.OpenAI ? 'border-green-600 bg-green-600/20 text-green-400' : 'border-stone-700 bg-stone-800 text-stone-500 hover:bg-stone-700'}`}
                >
                    OpenAI
                </button>
            </div>

            {/* AI Provider Selector - Only show when AI model is OpenAI */}
            {aiModel === AIModel.OpenAI && (
                <div className="mb-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-stone-400">AI Provider</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {[
                            { id: 'deepseek', name: 'DeepSeek' },
                            { id: 'gemini', name: 'Gemini' },
                            { id: 'qianwen', name: 'Qwen' }
                        ].map(provider => (
                            <button
                                key={provider.id}
                                onClick={() => setAiProvider(provider.id)}
                                className={`py-1 px-1 text-[10px] rounded border transition-all ${aiProvider === provider.id ? 'border-green-500 bg-green-500/20 text-green-300' : 'border-stone-700 bg-stone-800/50 text-stone-500 hover:bg-stone-700'}`}
                            >
                                {provider.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Minimax Difficulty Selector */}
            {aiModel === AIModel.Traditional && (
                <div className="mb-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-stone-400">Difficulty (Depth)</span>
                        <span className="text-xs text-blue-400 font-bold">{minimaxDepth}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {[2, 3, 4].map(depth => (
                            <button
                                key={depth}
                                onClick={() => setMinimaxDepth(depth)}
                                className={`py-1 px-1 text-[10px] rounded border transition-all ${minimaxDepth === depth ? 'border-blue-500 bg-blue-500/20 text-blue-300' : 'border-stone-700 bg-stone-800/50 text-stone-500 hover:bg-stone-700'}`}
                            >
                                {depth === 2 ? 'Easy' : depth === 3 ? 'Med' : 'Hard'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 bg-stone-900/50 rounded-lg p-3 overflow-y-auto min-h-[100px] border border-stone-800">
                {aiModel === AIModel.None ? (
                    <div className="h-full flex items-center justify-center text-stone-600 text-xs italic text-center">
                        Player vs Player Mode Active.<br />Select an AI to enable assistance.
                    </div>
                ) : (
                    <>
                        {aiThinking ? (
                            <div className="flex items-center gap-3 text-amber-500">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <span className="text-xs animate-pulse">AI is thinking...</span>
                            </div>
                        ) : aiReasoning ? (
                            <div className="animate-fade-in">
                                <div className="flex items-center gap-2 text-purple-400 mb-2">
                                    <Sparkles className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Analysis</span>
                                </div>
                                <p className="text-xs text-stone-300 italic leading-relaxed">
                                    "{aiReasoning}"
                                </p>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-stone-600 text-xs italic">
                                Waiting for AI turn...
                            </div>
                        )}
                    </>
                )}
            </div>
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

            <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 lg:items-start">

                {/* Desktop: Left Sidebar (Scoreboard + AI) */}
                <div className="hidden lg:flex w-[350px] flex-col gap-4 flex-shrink-0 sticky top-4 order-1">
                    {ScoreboardAndControls()}
                    {AIConsole()}
                </div>

                {/* Center: Board Area */}
                <div className="flex-1 flex flex-col items-center order-2">

                    {/* Mobile: Scoreboard Top */}
                    <div className="lg:hidden w-full max-w-[600px] mb-4">
                        {ScoreboardAndControls()}
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
                        />
                    </div>

                    {/* Mobile: AI Console Bottom */}
                    <div className="lg:hidden w-full max-w-[600px] mt-4">
                        {AIConsole()}
                    </div>
                </div>

                {/* Desktop: Right Sidebar (History) - Hidden on mobile */}
                <div className="hidden lg:flex w-[300px] flex-col gap-4 flex-shrink-0 order-3 sticky top-4">
                    <div className={`${THEME.panelBg} rounded-xl p-4 border ${THEME.panelBorder} backdrop-blur-sm`}>
                        <h2 className="text-sm font-bold text-stone-300 flex items-center gap-2 mb-3">
                            <ScrollText className="w-4 h-4 text-amber-500" /> History
                        </h2>
                        <div ref={historyContainerRef} className="h-[400px] overflow-y-auto space-y-1 scrollbar-thin">
                            {moveList.length === 0 ? (
                                <div className="text-stone-600 text-center py-10 italic text-xs">No moves yet</div>
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
            </div>
        </div>
    );

    return (
        <div className={`${THEME.bgApp} ${THEME.textMain} min-h-screen`}>
            {view === 'home' ? <HomeView /> : <GameView />}
            <HistoryModal />
            {gameStatus !== GameStatus.Playing && <Confetti />}
        </div>
    );
}

export default App;