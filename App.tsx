import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Board } from './components/Board';
import { Confetti } from './components/Confetti';
import { INITIAL_BOARD, PIECE_CHARS } from './constants';
import { BoardState, Color, Position, Move, GameStatus, AIModel, Piece } from './types';
import { getValidMovesForPiece, getLegalMoves, applyMove, isCheck } from './utils/chessRules';
import { getBestMoveMinimax } from './utils/minimax';
import { getGeminiMove } from './services/geminiService';
import { playMoveSound, playCaptureSound, playWinSound } from './utils/sound';
import { Undo2, RotateCcw, BrainCircuit, Sparkles, ScrollText, Clock, Timer } from 'lucide-react';

function App() {
  const [board, setBoard] = useState<BoardState>(INITIAL_BOARD);
  const [turn, setTurn] = useState<Color>(Color.Red); // Red goes first
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [history, setHistory] = useState<{board: BoardState, turn: Color, lastMove: Move | null, redTime: number, blackTime: number}[]>([]);
  const [moveList, setMoveList] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.Playing);
  
  // Timer State (in seconds)
  const [initialTime, setInitialTime] = useState<number>(600); // Default 10 mins
  const [redTime, setRedTime] = useState<number>(600);
  const [blackTime, setBlackTime] = useState<number>(600);

  // AI State
  const [aiModel, setAiModel] = useState<AIModel>(AIModel.None);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  const movesEndRef = useRef<HTMLDivElement>(null);

  // Timer Logic
  useEffect(() => {
    if (gameStatus !== GameStatus.Playing || initialTime === 0) return;

    const timer = setInterval(() => {
        if (turn === Color.Red) {
            setRedTime(prev => {
                if (prev <= 1) {
                    setGameStatus(GameStatus.BlackWin);
                    return 0;
                }
                return prev - 1;
            });
        } else {
            setBlackTime(prev => {
                if (prev <= 1) {
                    setGameStatus(GameStatus.RedWin);
                    return 0;
                }
                return prev - 1;
            });
        }
    }, 1000);

    return () => clearInterval(timer);
  }, [turn, gameStatus, initialTime]);

  // Effect to play sound on game over
  useEffect(() => {
      if (gameStatus === GameStatus.RedWin || gameStatus === GameStatus.BlackWin) {
          playWinSound();
      }
  }, [gameStatus]);

  // Check for game over conditions (Checkmate/Stalemate)
  const checkGameOver = useCallback((currentBoard: BoardState, currentTurn: Color) => {
    let hasMoves = false;
    for(let y=0; y<10; y++) {
        for(let x=0; x<9; x++) {
            const p = currentBoard[y][x];
            if (p && p.color === currentTurn) {
                if (getLegalMoves(currentBoard, {x,y}).length > 0) {
                    hasMoves = true;
                    break;
                }
            }
        }
        if(hasMoves) break;
    }

    if (!hasMoves) {
        // Current player cannot move. If checked, checkmate. Else stalemate (loss in Xiangqi usually).
        setGameStatus(currentTurn === Color.Red ? GameStatus.BlackWin : GameStatus.RedWin);
    }
  }, []);

  const scrollToBottom = () => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [moveList]);

  const handleSquareClick = async (pos: Position) => {
    if (gameStatus !== GameStatus.Playing) return;
    if (aiThinking) return;
    if (aiModel !== AIModel.None && turn === Color.Black) return; // Wait for AI

    const piece = board[pos.y][pos.x];

    // If clicking a valid move target (move piece)
    if (selectedPos && validMoves.some(m => m.x === pos.x && m.y === pos.y)) {
        executeMove(selectedPos, pos);
        return;
    }

    // If clicking own piece (select)
    if (piece && piece.color === turn) {
      setSelectedPos(pos);
      setValidMoves(getLegalMoves(board, pos));
      return;
    }

    // Deselect
    setSelectedPos(null);
    setValidMoves([]);
  };

  const getMoveNotation = (piece: Piece, from: Position, to: Position) => {
    const char = PIECE_CHARS[piece.color][piece.type];
    // Simple coordinate notation for now
    return `${char} (${from.x},${from.y}) → (${to.x},${to.y})`;
  };

  const executeMove = (from: Position, to: Position) => {
    // Save history with current times
    setHistory(prev => [...prev, { board, turn, lastMove, redTime, blackTime }]);

    const movedPiece = board[from.y][from.x];
    const targetPiece = board[to.y][to.x];

    // Sound Effects
    if (targetPiece) {
        playCaptureSound();
    } else {
        playMoveSound();
    }

    if (movedPiece) {
      const notation = getMoveNotation(movedPiece, from, to);
      setMoveList(prev => [...prev, notation]);
    }

    const newBoard = applyMove(board, from, to);
    
    setBoard(newBoard);
    setLastMove({ from, to, captured: targetPiece || undefined });
    setSelectedPos(null);
    setValidMoves([]);
    
    const nextTurn = turn === Color.Red ? Color.Black : Color.Red;
    setTurn(nextTurn);

    checkGameOver(newBoard, nextTurn);
  };

  // AI Turn Effect
  useEffect(() => {
    if (gameStatus !== GameStatus.Playing) return;
    if (turn === Color.Black && aiModel !== AIModel.None) {
        const runAI = async () => {
            setAiThinking(true);
            setAiReasoning(null);
            
            let move: { from: Position, to: Position, reason?: string } | null = null;

            try {
                if (aiModel === AIModel.Traditional) {
                    move = await getBestMoveMinimax(board, turn);
                } else if (aiModel === AIModel.GeminiFlash || aiModel === AIModel.GeminiPro) {
                    move = await getGeminiMove(board, turn, aiModel);
                    if (move?.reason) setAiReasoning(move.reason);
                }
            } catch (e) {
                console.error("AI Error", e);
            }

            if (move) {
                executeMove(move.from, move.to);
            } else {
                console.warn("AI could not find a move (Resign?)");
                setGameStatus(GameStatus.RedWin); // AI Resigns
            }
            setAiThinking(false);
        };
        runAI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, aiModel, gameStatus]);

  const undo = () => {
    if (history.length === 0 || aiThinking) return;
    // If AI is playing, undo 2 steps (player + AI), unless it's AI's turn currently (unlikely if async works right)
    const steps = aiModel !== AIModel.None ? 2 : 1;
    if (history.length < steps) return;

    const prevState = history[history.length - steps];
    setBoard(prevState.board);
    setTurn(prevState.turn);
    setLastMove(prevState.lastMove);
    
    // Restore time? Optional. Let's assume time keeps flowing in real life, but for fairness we restore it.
    // Restoring time prevents "thinking on undo time".
    setRedTime(prevState.redTime);
    setBlackTime(prevState.blackTime);
    
    setHistory(prev => prev.slice(0, -steps));
    setMoveList(prev => prev.slice(0, -steps));
    
    setGameStatus(GameStatus.Playing);
  };

  const reset = () => {
    setBoard(INITIAL_BOARD);
    setTurn(Color.Red);
    setHistory([]);
    setMoveList([]);
    setLastMove(null);
    setGameStatus(GameStatus.Playing);
    setSelectedPos(null);
    setValidMoves([]);
    setAiReasoning(null);
    // Reset Timers
    setRedTime(initialTime);
    setBlackTime(initialTime);
  };

  const changeTimeControl = (seconds: number) => {
    setInitialTime(seconds);
    setRedTime(seconds);
    setBlackTime(seconds);
    // Auto reset game to apply new time cleanly
    setBoard(INITIAL_BOARD);
    setTurn(Color.Red);
    setHistory([]);
    setMoveList([]);
    setLastMove(null);
    setGameStatus(GameStatus.Playing);
    setSelectedPos(null);
    setValidMoves([]);
    setAiReasoning(null);
  };

  const formatTime = (seconds: number) => {
      if (initialTime === 0) return "∞";
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getWinMessage = () => {
      if (gameStatus === GameStatus.RedWin) {
          return blackTime === 0 ? "Time Out! Red Wins!" : "Checkmate! Red Wins!";
      }
      if (gameStatus === GameStatus.BlackWin) {
          return redTime === 0 ? "Time Out! Black Wins!" : "Checkmate! Black Wins!";
      }
      return "";
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col lg:flex-row items-center justify-center p-4 font-serif">
        
        {(gameStatus === GameStatus.RedWin || gameStatus === GameStatus.BlackWin) && <Confetti />}

        {/* Left Panel: Controls & Info */}
        <div className="w-full lg:w-1/4 max-w-[400px] p-4 flex flex-col gap-6 order-2 lg:order-1 z-10">
            
            <div className="bg-stone-800/50 rounded-xl p-6 shadow-lg border border-stone-700 backdrop-blur-sm">
                <h1 className="text-4xl font-bold mb-2 font-calligraphy text-amber-500">中国象棋</h1>
                <p className="text-stone-400 text-sm uppercase tracking-widest mb-6">Zen Xiangqi</p>
                
                {/* Timers / Scoreboard */}
                <div className="flex items-center justify-between gap-4 mb-4">
                    {/* Red Clock */}
                    <div className={`flex-1 p-3 rounded-lg border flex flex-col items-center transition-all duration-300 ${turn === Color.Red ? 'bg-red-900/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-stone-800 border-stone-700 opacity-60'}`}>
                        <div className="text-xs text-red-400 font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Red
                        </div>
                        <div className={`text-3xl font-mono font-bold tracking-wider ${redTime < 30 && initialTime > 0 ? 'text-red-500 animate-pulse' : 'text-stone-200'}`}>
                            {formatTime(redTime)}
                        </div>
                    </div>
                    
                    {/* VS */}
                    <div className="text-stone-600 font-bold text-xl font-serif italic">VS</div>

                    {/* Black Clock */}
                    <div className={`flex-1 p-3 rounded-lg border flex flex-col items-center transition-all duration-300 ${turn === Color.Black ? 'bg-stone-700/50 border-stone-400/50 shadow-[0_0_15px_rgba(168,162,158,0.2)]' : 'bg-stone-800 border-stone-700 opacity-60'}`}>
                         <div className="text-xs text-stone-400 font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Black
                        </div>
                        <div className={`text-3xl font-mono font-bold tracking-wider ${blackTime < 30 && initialTime > 0 ? 'text-red-500 animate-pulse' : 'text-stone-200'}`}>
                            {formatTime(blackTime)}
                        </div>
                    </div>
                </div>

                {gameStatus !== GameStatus.Playing && (
                         <div className="p-4 bg-amber-900/30 border border-amber-700 rounded text-center animate-bounce">
                             <span className="text-xl font-bold text-amber-400">
                                 {getWinMessage()}
                             </span>
                         </div>
                )}
            </div>

            <div className="bg-stone-800/50 rounded-xl p-6 shadow-lg border border-stone-700 backdrop-blur-sm">
                <h2 className="text-lg font-bold mb-4 text-stone-300 flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5" /> Game Settings
                </h2>

                {/* Opponent Selector */}
                <label className="text-xs text-stone-500 uppercase font-bold mb-2 block">Opponent</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button 
                        onClick={() => setAiModel(AIModel.None)}
                        className={`p-2 text-xs lg:text-sm rounded transition-all ${aiModel === AIModel.None ? 'bg-amber-600 text-white' : 'bg-stone-700 hover:bg-stone-600'}`}
                    >
                        Local PvP
                    </button>
                    <button 
                        onClick={() => setAiModel(AIModel.Traditional)}
                        className={`p-2 text-xs lg:text-sm rounded transition-all ${aiModel === AIModel.Traditional ? 'bg-amber-600 text-white' : 'bg-stone-700 hover:bg-stone-600'}`}
                    >
                        Minimax AI
                    </button>
                    <button 
                        onClick={() => setAiModel(AIModel.GeminiFlash)}
                        className={`p-2 text-xs lg:text-sm rounded transition-all flex items-center justify-center gap-1 ${aiModel === AIModel.GeminiFlash ? 'bg-blue-600 text-white' : 'bg-stone-700 hover:bg-stone-600'}`}
                    >
                        <Sparkles className="w-3 h-3" /> Gemini Flash
                    </button>
                    <button 
                        onClick={() => setAiModel(AIModel.GeminiPro)}
                        className={`p-2 text-xs lg:text-sm rounded transition-all flex items-center justify-center gap-1 ${aiModel === AIModel.GeminiPro ? 'bg-purple-600 text-white' : 'bg-stone-700 hover:bg-stone-600'}`}
                    >
                        <Sparkles className="w-3 h-3" /> Gemini Pro
                    </button>
                </div>

                {/* Time Control Selector */}
                <label className="text-xs text-stone-500 uppercase font-bold mb-2 block">Time Control</label>
                <div className="flex gap-1 mb-6 bg-stone-900/40 p-1 rounded-lg">
                    {[0, 300, 600, 1800].map(t => (
                        <button
                            key={t}
                            onClick={() => changeTimeControl(t)}
                            className={`flex-1 py-1 text-xs rounded transition-all ${initialTime === t ? 'bg-stone-600 text-stone-100 shadow ring-1 ring-stone-500' : 'text-stone-500 hover:text-stone-300'}`}
                        >
                            {t === 0 ? '∞' : `${t/60}m`}
                        </button>
                    ))}
                </div>
                
                <div className="flex gap-2">
                    <button onClick={undo} disabled={history.length === 0 || aiThinking || gameStatus !== GameStatus.Playing} className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Undo2 className="w-4 h-4" /> Undo
                    </button>
                    <button onClick={reset} className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded flex items-center justify-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                </div>
            </div>
            
            {/* AI Reasoning Output */}
            {aiReasoning && (
                <div className="bg-stone-800/50 rounded-xl p-4 shadow-lg border border-purple-500/30 backdrop-blur-sm animate-fade-in">
                    <h3 className="text-xs font-bold text-purple-400 uppercase mb-1">Gemini Analysis</h3>
                    <p className="text-sm text-stone-300 italic leading-relaxed">"{aiReasoning}"</p>
                </div>
            )}

            {aiThinking && (
                <div className="flex items-center gap-3 text-amber-400 animate-pulse">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    <span className="text-sm">AI Thinking...</span>
                </div>
            )}
        </div>

        {/* Center: Game Board */}
        <div className="order-1 lg:order-2 p-4 flex items-center justify-center w-full max-w-[800px] z-10">
            <Board 
                board={board} 
                onSquareClick={handleSquareClick}
                selectedPos={selectedPos}
                validMoves={validMoves}
                lastMove={lastMove}
            />
        </div>
        
        {/* Right Panel: Move List */}
        <div className="hidden lg:block w-1/4 h-[600px] order-3 max-w-[400px] p-4 z-10">
            <div className="h-full bg-stone-800/50 rounded-xl shadow-lg border border-stone-700 backdrop-blur-sm flex flex-col overflow-hidden">
                 <div className="p-4 border-b border-stone-700 bg-stone-800 flex items-center gap-2 text-stone-300 font-bold">
                    <ScrollText className="w-5 h-5 text-amber-500" />
                    Game History
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                    {moveList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-stone-500">
                            <div className="text-4xl font-calligraphy mb-2">观棋不语</div>
                            <p className="text-sm">No moves yet</p>
                        </div>
                    ) : (
                        moveList.map((move, index) => {
                            // moveList index 0 is Red's first move (usually)
                            const isRedMove = index % 2 === 0;
                            return (
                                <div key={index} className={`flex items-center gap-3 p-2 rounded text-sm ${index === moveList.length - 1 ? 'bg-amber-900/30 ring-1 ring-amber-700/50' : 'hover:bg-stone-700/30'}`}>
                                    <span className="text-stone-500 w-6 text-right font-mono">{index + 1}.</span>
                                    <div className={`flex items-center gap-2 ${isRedMove ? 'text-red-300' : 'text-stone-300'}`}>
                                        <span className="text-lg w-5">{isRedMove ? '🔴' : '⚫'}</span>
                                        <span className="font-serif tracking-wide">{move}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={movesEndRef} />
                 </div>
            </div>
        </div>

    </div>
  );
}

export default App;