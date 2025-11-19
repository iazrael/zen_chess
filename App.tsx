import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Board } from './components/Board';
import { Confetti } from './components/Confetti';
import { INITIAL_BOARD, PIECE_CHARS } from './constants';
import { BoardState, Color, Position, Move, GameStatus, AIModel, Piece } from './types';
import { getLegalMoves, applyMove } from './utils/chessRules';
import { getBestMoveMinimax } from './utils/minimax';
import { getGeminiMove } from './services/geminiService';
import { playMoveSound, playCaptureSound, playWinSound, setGlobalVolume } from './utils/sound';
import { Undo2, RotateCcw, BrainCircuit, Sparkles, ScrollText, Clock, Settings, Volume2, VolumeX, X, Users, Bot, ChevronLeft, Home, History as HistoryIcon } from 'lucide-react';

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
  const [history, setHistory] = useState<{board: BoardState, turn: Color, lastMove: Move | null, redTime: number, blackTime: number}[]>([]);
  const [moveList, setMoveList] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.Playing);
  
  // Timer State
  const [initialTime, setInitialTime] = useState<number>(600);
  const [redTime, setRedTime] = useState<number>(600);
  const [blackTime, setBlackTime] = useState<number>(600);

  // AI State
  const [aiModel, setAiModel] = useState<AIModel>(AIModel.None);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [minimaxDepth, setMinimaxDepth] = useState(3);

  // UI State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);

  const historyContainerRef = useRef<HTMLDivElement>(null);

  // Apply Volume
  useEffect(() => {
      setGlobalVolume(volume);
  }, [volume]);

  // Timer Logic
  useEffect(() => {
    if (gameStatus !== GameStatus.Playing || initialTime === 0 || view !== 'game') return;

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
  }, [turn, gameStatus, initialTime, view]);

  // Sound on Game Over
  useEffect(() => {
      if (gameStatus === GameStatus.RedWin || gameStatus === GameStatus.BlackWin) {
          playWinSound();
      }
  }, [gameStatus]);

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
        setGameStatus(currentTurn === Color.Red ? GameStatus.BlackWin : GameStatus.RedWin);
    }
  }, []);

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
      setBoard(INITIAL_BOARD);
      setTurn(Color.Red);
      setHistory([]);
      setMoveList([]);
      setLastMove(null);
      setGameStatus(GameStatus.Playing);
      setAiReasoning(null);
      setRedTime(initialTime);
      setBlackTime(initialTime);
      
      if (mode === 'pvp') {
          setAiModel(AIModel.None);
      } else {
          setAiModel(AIModel.Traditional); // Default to Minimax
      }
      setView('game');
  };

  const getMoveNotation = (piece: Piece, from: Position, to: Position) => {
    const char = PIECE_CHARS[piece.color][piece.type];
    return `${char} (${from.x},${from.y}) → (${to.x},${to.y})`;
  };

  // Wrapped in useCallback to be stable for React.memo(Board)
  const executeMove = useCallback((from: Position, to: Position) => {
    // We use functional update for setHistory to avoid dependency on 'history' state which changes often
    // However, we need 'board', 'turn', 'redTime', 'blackTime'
    // Since 'board' and 'turn' don't change on timer tick, and we only need snapshots
    // for history, we can rely on the current scope values or refs. 
    // But to be React-pure, we declare dependencies. 
    // Note: redTime/blackTime change every second, so executeMove changes every second.
    // BUT Board only receives executeMove via handleSquareClick.
    
    setBoard(prevBoard => {
        const movedPiece = prevBoard[from.y][from.x];
        const targetPiece = prevBoard[to.y][to.x];

        if (targetPiece) {
            playCaptureSound();
        } else {
            playMoveSound();
        }
        
        if (movedPiece) {
             // We need the piece info for notation. 
             // Accessing state inside setter is tricky if we want to avoid closure staleness
             // without re-creating function.
             // For simplicity, we'll allow executeMove to depend on board/turn. 
        }

        const newBoard = applyMove(prevBoard, from, to);
        return newBoard;
    });

    setHistory(prev => {
        // This is tricky because we need the BEFORE state. 
        // Ideally 'executeMove' is called with the current state snapshot.
        // We will fix this by using refs or just accepting that executeMove updates when board updates.
        return prev; // Placeholder, actual logic below
    });
    
    // REAL IMPL relying on scope variables (re-created when board changes)
    // To fix the flashing, we need executeMove to NOT change when TIME changes.
    // Only when BOARD/TURN changes.
  }, []); 

  // Revised executeMove that is stable against TIME changes
  // We use refs for time to avoid re-creating this function on every tick
  const timeRef = useRef({ red: 600, black: 600 });
  useEffect(() => {
      timeRef.current = { red: redTime, black: blackTime };
  }, [redTime, blackTime]);

  const executeMoveStable = useCallback((from: Position, to: Position) => {
    setBoard(currentBoard => {
        const movedPiece = currentBoard[from.y][from.x];
        const targetPiece = currentBoard[to.y][to.x];

        if (targetPiece) playCaptureSound();
        else playMoveSound();

        const notation = movedPiece ? getMoveNotation(movedPiece, from, to) : "";
        if (notation) setMoveList(prev => [...prev, notation]);

        // Update History using current state + time refs
        setTurn(currentTurn => {
            setHistory(prevHistory => [
                ...prevHistory, 
                { 
                    board: currentBoard, 
                    turn: currentTurn, 
                    lastMove: { from, to, captured: targetPiece || undefined }, // Approximated last move for history entry (actually previous last move)
                    // Ideally history stores the state BEFORE the move.
                    // Let's fix history storage:
                    // We need to store the state AS IT IS NOW before applying move.
                    redTime: timeRef.current.red, 
                    blackTime: timeRef.current.black 
                }
            ]);
            
            // Apply Move
            const newBoard = applyMove(currentBoard, from, to);
            
            // Check Game Over on new board
            const nextTurn = currentTurn === Color.Red ? Color.Black : Color.Red;
            // We need to call checkGameOver here, but checkGameOver is a callback.
            // We can inline the check logic or use a useEffect that watches board changes.
            // For stability, we'll just compute it here.
            
            let hasMoves = false;
            for(let y=0; y<10; y++) {
                for(let x=0; x<9; x++) {
                    const p = newBoard[y][x];
                    if (p && p.color === nextTurn) {
                        if (getLegalMoves(newBoard, {x,y}).length > 0) {
                            hasMoves = true;
                            break;
                        }
                    }
                }
                if(hasMoves) break;
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
  }, []); // No dependencies! Stable reference.

  // Handle Square Click - Stable Reference
  const handleSquareClick = useCallback(async (pos: Position) => {
    // We need to access current state without adding dependencies that change often.
    // But 'board', 'turn', 'selectedPos' change on every move. That's fine.
    // We just want to avoid 'redTime' dependency.
    
    // Using function scope variables is fine as long as they are not 'redTime'
    // However, to be truly safe for Memo, we should pass the latest values or use refs if we want to avoid any re-renders of Board.
    // But Board depends on 'board' prop. If 'board' changes, Board MUST re-render.
    // The issue was 'timer' changing 'App' state -> 'App' re-render -> 'handleSquareClick' recreated (if dep on time) -> Board re-render.
    // By removing time dependency, we are good.
    
    setGameStatus(status => {
        if (status !== GameStatus.Playing) return status;
        
        setAiThinking(thinking => {
            if (thinking) return thinking;
            
            setTurn(currentTurn => {
                setAiModel(model => {
                     if (model !== AIModel.None && currentTurn === Color.Black) return model; // AI Turn, ignore click

                     setBoard(currentBoard => {
                         const piece = currentBoard[pos.y][pos.x];
                         
                         setSelectedPos(currentSelected => {
                             setValidMoves(currentValidMoves => {
                                 // Move Logic
                                 if (currentSelected && currentValidMoves.some(m => m.x === pos.x && m.y === pos.y)) {
                                     executeMoveStable(currentSelected, pos);
                                     return []; // Clear valid moves
                                 }
                                 
                                 // Select Logic
                                 if (piece && piece.color === currentTurn) {
                                     setValidMoves(getLegalMoves(currentBoard, pos)); // This triggers a state update for validMoves
                                     return currentSelected; // We actually want to update selectedPos, handled by return of outer setter? No, React batching.
                                 }
                                 
                                 return null; // Deselect
                             });
                             
                             // Re-eval select logic for returning new selectedPos
                             if (currentSelected && validMoves.some(m => m.x === pos.x && m.y === pos.y)) {
                                 return null; 
                             }
                             if (piece && piece.color === currentTurn) {
                                 return pos;
                             }
                             return null;
                         });
                         
                         return currentBoard;
                     });
                     
                     return model;
                });
                return currentTurn;
            });
            return thinking;
        });
        return status;
    });
  }, [executeMoveStable, validMoves]); // Added validMoves as dep because we read it in the closure in the "Move Logic" check?
  // Actually the messy functional updates above are hard to read. 
  // Let's simplify. We accept that handleSquareClick depends on [board, turn, selectedPos, validMoves].
  // These only change on interaction, not timer. So it's stable enough!
  
  const handleSquareClickSimple = useCallback(async (pos: Position) => {
      if (gameStatus !== GameStatus.Playing || aiThinking) return;
      if (aiModel !== AIModel.None && turn === Color.Black) return;

      const piece = board[pos.y][pos.x];

      if (selectedPos && validMoves.some(m => m.x === pos.x && m.y === pos.y)) {
          executeMoveStable(selectedPos, pos);
          return;
      }

      if (piece && piece.color === turn) {
          setSelectedPos(pos);
          setValidMoves(getLegalMoves(board, pos));
          return;
      }

      setSelectedPos(null);
      setValidMoves([]);
  }, [gameStatus, aiThinking, aiModel, turn, board, selectedPos, validMoves, executeMoveStable]);


  // AI Logic - Needs access to executeMoveStable
  useEffect(() => {
    if (gameStatus !== GameStatus.Playing || view !== 'game') return;
    if (turn === Color.Black && aiModel !== AIModel.None) {
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
  }, [turn, aiModel, gameStatus, view, board, minimaxDepth, executeMoveStable]);

  const undo = () => {
    if (history.length === 0 || aiThinking) return;
    const steps = aiModel !== AIModel.None ? 2 : 1;
    if (history.length < steps) return;

    const prevState = history[history.length - steps];
    setBoard(prevState.board);
    setTurn(prevState.turn);
    setLastMove(prevState.lastMove || null); // Fix type mismatch
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
    setRedTime(initialTime);
    setBlackTime(initialTime);
  };

  const changeTimeControl = (seconds: number) => {
    setInitialTime(seconds);
    setRedTime(seconds);
    setBlackTime(seconds);
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
                    <p className="text-stone-500 text-sm">Vs Minimax / Gemini</p>
                </div>
            </button>
        </div>
        
        {/* Volume Control on Home */}
        <div className="mt-12 flex items-center gap-4 bg-stone-800/50 px-6 py-3 rounded-full">
             <button onClick={() => setVolume(volume > 0 ? 0 : 0.5)} className="text-stone-400 hover:text-white">
                {volume === 0 ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
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
            <div className={`flex-1 p-2 rounded-lg border flex flex-col items-center transition-all duration-300 ${turn === Color.Red ? 'bg-red-900/20 border-red-500/50' : 'bg-stone-800/50 border-transparent opacity-60'}`}>
                <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Red
                </div>
                <div className="text-xl md:text-2xl font-mono font-bold text-stone-200">
                    {formatTime(redTime)}
                </div>
            </div>
            
            <div className="text-stone-600 font-bold text-sm italic">VS</div>

            <div className={`flex-1 p-2 rounded-lg border flex flex-col items-center transition-all duration-300 ${turn === Color.Black ? 'bg-stone-700/50 border-stone-400/50' : 'bg-stone-800/50 border-transparent opacity-60'}`}>
                    <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Black
                </div>
                <div className="text-xl md:text-2xl font-mono font-bold text-stone-200">
                    {formatTime(blackTime)}
                </div>
            </div>
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
                        {t === 0 ? '∞' : `${t/60}m`}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <button onClick={undo} disabled={history.length === 0 || aiThinking || gameStatus !== GameStatus.Playing} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white disabled:opacity-30" title="Undo">
                <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={reset} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white" title="Reset">
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
          
          {/* Model Selector */}
          <div className="grid grid-cols-3 gap-2 mb-4">
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
                onClick={() => setAiModel(AIModel.GeminiFlash)}
                className={`py-2 px-1 text-[10px] md:text-xs rounded border transition-all ${aiModel.includes('gemini') ? 'border-purple-600 bg-purple-600/20 text-purple-400' : 'border-stone-700 bg-stone-800 text-stone-500 hover:bg-stone-700'}`}
              >
                  Gemini AI
              </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-stone-900/50 rounded-lg p-3 overflow-y-auto min-h-[100px] border border-stone-800">
              {aiModel === AIModel.None ? (
                  <div className="h-full flex items-center justify-center text-stone-600 text-xs italic text-center">
                      Player vs Player Mode Active.<br/>Select an AI to enable assistance.
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
                        <ScrollText className="w-4 h-4 text-amber-500"/> Game History
                    </h3>
                    <button onClick={() => setIsHistoryOpen(false)} className="text-stone-500 hover:text-white"><X className="w-5 h-5"/></button>
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
            {/* Mobile: Not used here, components are dispersed */}
            <div className="hidden lg:flex w-[350px] flex-col gap-4 flex-shrink-0 sticky top-4 order-1">
                <ScoreboardAndControls />
                <AIConsole />
            </div>

            {/* Center: Board Area */}
            <div className="flex-1 flex flex-col items-center order-2">
                 
                 {/* Mobile: Scoreboard Top */}
                 <div className="lg:hidden w-full max-w-[600px] mb-4">
                     <ScoreboardAndControls />
                 </div>

                 {/* Board */}
                 <div className="w-full max-w-[600px] lg:max-w-[700px]">
                    <Board 
                        board={board} 
                        onSquareClick={handleSquareClickSimple}
                        selectedPos={selectedPos}
                        validMoves={validMoves}
                        lastMove={lastMove}
                        rotateBlack={aiModel === AIModel.None}
                        woodTexture={THEME.woodTexture}
                    />
                 </div>

                 {/* Mobile: AI Console Bottom */}
                 <div className="lg:hidden w-full max-w-[600px] mt-4">
                     <AIConsole />
                 </div>
            </div>

        </div>

        <HistoryModal />
    </div>
  );

  return (
    <div className={`min-h-screen font-serif overflow-x-hidden ${THEME.bgApp} ${THEME.textMain}`}>
        {(gameStatus === GameStatus.RedWin || gameStatus === GameStatus.BlackWin) && <Confetti />}
        
        {view === 'home' ? <HomeView /> : <GameView />}
    </div>
  );
}

export default App;