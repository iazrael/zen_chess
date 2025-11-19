import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Board } from './components/Board';
import { Confetti } from './components/Confetti';
import { INITIAL_BOARD, PIECE_CHARS } from './constants';
import { BoardState, Color, Position, Move, GameStatus, AIModel, Piece } from './types';
import { getLegalMoves, applyMove } from './utils/chessRules';
import { getBestMoveMinimax } from './utils/minimax';
import { getGeminiMove } from './services/geminiService';
import { playMoveSound, playCaptureSound, playWinSound, setGlobalVolume } from './utils/sound';
import { Undo2, RotateCcw, BrainCircuit, Sparkles, ScrollText, Clock, Settings, Volume2, Volume1, VolumeX, X } from 'lucide-react';

// --- Theme Definitions ---
const THEMES = {
    zen: {
        id: 'zen',
        name: 'Zen (Dark)',
        bgApp: 'bg-stone-900',
        textMain: 'text-stone-100',
        textMuted: 'text-stone-400',
        panelBg: 'bg-stone-800/50',
        panelBorder: 'border-stone-700',
        highlightBg: 'bg-stone-700/50',
        accentText: 'text-amber-500',
        boardBg: 'bg-wood-500',
        boardBorder: 'border-wood-700',
        gridColor: '#543d18',
        woodTexture: true
    },
    ink: {
        id: 'ink',
        name: 'Ink (Light)',
        bgApp: 'bg-[#f2f0e9]',
        textMain: 'text-stone-800',
        textMuted: 'text-stone-500',
        panelBg: 'bg-white/60',
        panelBorder: 'border-stone-300',
        highlightBg: 'bg-stone-200/50',
        accentText: 'text-red-800',
        boardBg: 'bg-[#e6dcc3]',
        boardBorder: 'border-[#b8a888]',
        gridColor: '#4a4a4a',
        woodTexture: false
    }
};

type ThemeKey = keyof typeof THEMES;

function App() {
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
  const [aiModel, setAiModel] = useState<AIModel>(AIModel.Traditional);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('zen');
  const [minimaxDepth, setMinimaxDepth] = useState(3); // Default depth

  const historyContainerRef = useRef<HTMLDivElement>(null);

  // Apply Volume
  useEffect(() => {
      setGlobalVolume(volume);
  }, [volume]);

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

  // Auto-scroll history container
  useEffect(() => {
    if (historyContainerRef.current) {
        const { scrollHeight, clientHeight } = historyContainerRef.current;
        if (scrollHeight > clientHeight) {
            historyContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
        }
    }
  }, [moveList]);

  const handleSquareClick = async (pos: Position) => {
    if (gameStatus !== GameStatus.Playing) return;
    if (aiThinking) return;
    if (aiModel !== AIModel.None && turn === Color.Black) return;

    const piece = board[pos.y][pos.x];

    if (selectedPos && validMoves.some(m => m.x === pos.x && m.y === pos.y)) {
        executeMove(selectedPos, pos);
        return;
    }

    if (piece && piece.color === turn) {
      setSelectedPos(pos);
      setValidMoves(getLegalMoves(board, pos));
      return;
    }

    setSelectedPos(null);
    setValidMoves([]);
  };

  const getMoveNotation = (piece: Piece, from: Position, to: Position) => {
    const char = PIECE_CHARS[piece.color][piece.type];
    return `${char} (${from.x},${from.y}) → (${to.x},${to.y})`;
  };

  const executeMove = (from: Position, to: Position) => {
    setHistory(prev => [...prev, { board, turn, lastMove, redTime, blackTime }]);

    const movedPiece = board[from.y][from.x];
    const targetPiece = board[to.y][to.x];

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

  // AI Logic
  useEffect(() => {
    if (gameStatus !== GameStatus.Playing) return;
    if (turn === Color.Black && aiModel !== AIModel.None) {
        const runAI = async () => {
            setAiThinking(true);
            setAiReasoning(null);
            
            let move: { from: Position, to: Position, reason?: string } | null = null;

            try {
                if (aiModel === AIModel.Traditional) {
                    // Pass the dynamic depth from settings
                    move = await getBestMoveMinimax(board, turn, minimaxDepth);
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
                console.warn("AI Resigns");
                setGameStatus(GameStatus.RedWin);
            }
            setAiThinking(false);
        };
        runAI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, aiModel, gameStatus, minimaxDepth]); // Added minimaxDepth dependency

  const undo = () => {
    if (history.length === 0 || aiThinking) return;
    const steps = aiModel !== AIModel.None ? 2 : 1;
    if (history.length < steps) return;

    const prevState = history[history.length - steps];
    setBoard(prevState.board);
    setTurn(prevState.turn);
    setLastMove(prevState.lastMove);
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

  const activeTheme = THEMES[currentTheme];

  // --- Sub Components ---

  const ScoreboardCard = () => (
      <div className={`${activeTheme.panelBg} rounded-xl p-3 md:p-4 shadow-lg border ${activeTheme.panelBorder} backdrop-blur-sm w-full transition-colors`}>
        <div className="flex items-center justify-between gap-2">
            <div className={`flex-1 p-2 rounded-lg border flex flex-col items-center transition-all duration-300 ${turn === Color.Red ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : `${activeTheme.highlightBg} border-transparent opacity-60`}`}>
                <div className="text-[10px] text-red-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Red
                </div>
                <div className={`text-xl md:text-2xl font-mono font-bold tracking-wider ${redTime < 30 && initialTime > 0 ? 'text-red-500 animate-pulse' : activeTheme.textMain}`}>
                    {formatTime(redTime)}
                </div>
            </div>
            
            <div className={`${activeTheme.textMuted} font-bold text-sm italic px-1`}>VS</div>

            <div className={`flex-1 p-2 rounded-lg border flex flex-col items-center transition-all duration-300 ${turn === Color.Black ? `${activeTheme.highlightBg} border-stone-400/50 shadow-[0_0_10px_rgba(168,162,158,0.2)]` : `${activeTheme.highlightBg} border-transparent opacity-60`}`}>
                    <div className={`text-[10px] ${activeTheme.textMuted} font-bold mb-1 uppercase tracking-wider flex items-center gap-1`}>
                    <Clock className="w-3 h-3" /> Black
                </div>
                <div className={`text-xl md:text-2xl font-mono font-bold tracking-wider ${blackTime < 30 && initialTime > 0 ? 'text-red-500 animate-pulse' : activeTheme.textMain}`}>
                    {formatTime(blackTime)}
                </div>
            </div>
        </div>

        {gameStatus !== GameStatus.Playing && (
            <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-center animate-bounce">
                    <span className={`text-base font-bold ${activeTheme.accentText}`}>
                        {getWinMessage()}
                    </span>
                </div>
        )}
    </div>
  );

  const SettingsCard = () => (
    <div className={`${activeTheme.panelBg} rounded-xl p-4 shadow-lg border ${activeTheme.panelBorder} backdrop-blur-sm w-full transition-colors`}>
        <div className="flex items-center justify-between mb-3">
            <h2 className={`text-sm font-bold ${activeTheme.textMain} flex items-center gap-2`}>
                <BrainCircuit className="w-4 h-4" /> Quick Setup
            </h2>
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`p-1.5 rounded-full hover:${activeTheme.highlightBg} ${activeTheme.textMuted} transition-colors`}
                title="All Settings"
            >
                <Settings className="w-4 h-4" />
            </button>
        </div>

        <label className={`text-[10px] ${activeTheme.textMuted} uppercase font-bold mb-1 block`}>Opponent</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
            {[
                { m: AIModel.None, l: 'PvP' },
                { m: AIModel.Traditional, l: 'Minimax' },
                { m: AIModel.GeminiFlash, l: 'Flash', icon: true },
                { m: AIModel.GeminiPro, l: 'Pro', icon: true }
            ].map(opt => (
                <button 
                    key={opt.m}
                    onClick={() => setAiModel(opt.m)}
                    className={`p-1.5 text-[10px] rounded transition-all flex items-center justify-center gap-1 ${aiModel === opt.m ? (opt.m.includes('gemini') ? (opt.m.includes('pro') ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white') : 'bg-amber-600 text-white') : `bg-stone-500/20 hover:bg-stone-500/30 ${activeTheme.textMain}`}`}
                >
                    {opt.icon && <Sparkles className="w-3 h-3" />} {opt.l}
                </button>
            ))}
        </div>

        <label className={`text-[10px] ${activeTheme.textMuted} uppercase font-bold mb-1 block`}>Time</label>
        <div className={`flex gap-1 mb-4 ${activeTheme.highlightBg} p-1 rounded-lg`}>
            {[0, 300, 600].map(t => (
                <button
                    key={t}
                    onClick={() => changeTimeControl(t)}
                    className={`flex-1 py-1 text-[10px] rounded transition-all ${initialTime === t ? 'bg-white/20 shadow ring-1 ring-white/30 text-inherit' : `${activeTheme.textMuted} hover:text-inherit`}`}
                >
                    {t === 0 ? '∞' : `${t/60}m`}
                </button>
            ))}
        </div>
        
        <div className="flex gap-2">
            <button onClick={undo} disabled={history.length === 0 || aiThinking || gameStatus !== GameStatus.Playing} className={`flex-1 py-1.5 bg-stone-500/20 hover:bg-stone-500/30 ${activeTheme.textMain} rounded flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs`}>
                <Undo2 className="w-3 h-3" /> Undo
            </button>
            <button onClick={reset} className={`flex-1 py-1.5 bg-stone-500/20 hover:bg-stone-500/30 ${activeTheme.textMain} rounded flex items-center justify-center gap-2 text-xs`}>
                <RotateCcw className="w-3 h-3" /> Reset
            </button>
        </div>
    </div>
  );

  const HistoryCard = ({ className = "" }: { className?: string }) => (
    <div className={`${activeTheme.panelBg} rounded-xl shadow-lg border ${activeTheme.panelBorder} backdrop-blur-sm flex flex-col overflow-hidden ${className} transition-colors`}>
            <div className={`p-3 border-b ${activeTheme.panelBorder} ${activeTheme.highlightBg} flex items-center gap-2 ${activeTheme.textMain} font-bold text-xs uppercase tracking-wider`}>
            <ScrollText className={`w-4 h-4 ${activeTheme.accentText}`} />
            History
            </div>
            <div 
                ref={historyContainerRef} 
                className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-stone-500/30 scrollbar-track-transparent"
            >
            {moveList.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center opacity-30 ${activeTheme.textMuted}`}>
                    <div className="text-2xl font-calligraphy mb-1">观棋不语</div>
                </div>
            ) : (
                moveList.map((move, index) => {
                    const isRedMove = index % 2 === 0;
                    return (
                        <div key={index} className={`flex items-center gap-2 p-1.5 rounded text-xs ${index === moveList.length - 1 ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : `hover:${activeTheme.highlightBg}`}`}>
                            <span className={`${activeTheme.textMuted} w-4 text-right font-mono text-[10px] transition-colors`}>{index + 1}.</span>
                            <div className={`flex items-center gap-2 ${isRedMove ? 'text-red-400' : activeTheme.textMain}`}>
                                <span className="text-sm">{isRedMove ? '🔴' : '⚫'}</span>
                                <span className="font-serif tracking-wide">{move}</span>
                            </div>
                        </div>
                    );
                })
            )}
            </div>
    </div>
  );

  // Settings Modal
  const SettingsModal = () => {
      if (!isSettingsOpen) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`${activeTheme.panelBg} ${activeTheme.panelBorder} border w-full max-w-md rounded-xl shadow-2xl p-6 relative`}>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className={`absolute top-4 right-4 p-1 rounded-full hover:bg-stone-500/20 ${activeTheme.textMain}`}
                  >
                      <X className="w-5 h-5" />
                  </button>
                  
                  <h2 className={`text-xl font-bold mb-6 ${activeTheme.textMain} flex items-center gap-2`}>
                      <Settings className="w-5 h-5" /> Game Settings
                  </h2>

                  {/* Volume */}
                  <div className="mb-6">
                      <label className={`block text-xs uppercase font-bold ${activeTheme.textMuted} mb-3`}>Audio Volume</label>
                      <div className="flex items-center gap-3">
                          <button onClick={() => setVolume(0)} className={activeTheme.textMain}><VolumeX className="w-4 h-4"/></button>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={volume} 
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="flex-1 h-2 bg-stone-500/30 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <span className={`text-xs font-mono w-8 text-right ${activeTheme.textMain}`}>{Math.round(volume * 100)}%</span>
                      </div>
                  </div>

                  {/* Themes */}
                  <div className="mb-6">
                      <label className={`block text-xs uppercase font-bold ${activeTheme.textMuted} mb-3`}>Visual Theme</label>
                      <div className="grid grid-cols-2 gap-3">
                          {(Object.keys(THEMES) as ThemeKey[]).map((themeKey) => (
                              <button
                                key={themeKey}
                                onClick={() => setCurrentTheme(themeKey)}
                                className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${currentTheme === themeKey ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-500/10' : `border-transparent ${THEMES[themeKey].highlightBg}`}`}
                              >
                                  <span className={`font-bold text-sm ${THEMES[themeKey].textMain}`}>{THEMES[themeKey].name}</span>
                                  <span className="text-[10px] opacity-60">Preview Colors</span>
                                  <div className="flex gap-1 mt-1">
                                      <div className={`w-3 h-3 rounded-full ${THEMES[themeKey].bgApp} border border-gray-500`}></div>
                                      <div className={`w-3 h-3 rounded-full ${THEMES[themeKey].boardBg} border border-gray-500`}></div>
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* AI Difficulty (Minimax) */}
                  {aiModel === AIModel.Traditional && (
                    <div className="mb-2">
                        <label className={`block text-xs uppercase font-bold ${activeTheme.textMuted} mb-3`}>
                            Minimax Depth (Difficulty)
                        </label>
                        <div className="flex items-center gap-2 bg-stone-500/10 p-1 rounded-lg">
                            {[2, 3, 4].map(d => (
                                <button 
                                    key={d}
                                    onClick={() => setMinimaxDepth(d)}
                                    className={`flex-1 py-2 text-xs rounded transition-all ${minimaxDepth === d ? 'bg-amber-600 text-white shadow' : `${activeTheme.textMuted} hover:bg-stone-500/10`}`}
                                >
                                    {d === 2 ? 'Easy (2)' : d === 3 ? 'Medium (3)' : 'Hard (4)'}
                                </button>
                            ))}
                        </div>
                        <p className={`text-[10px] mt-2 ${activeTheme.textMuted} italic`}>
                            Higher depth = stronger play but slower thinking time.
                        </p>
                    </div>
                  )}
              </div>
          </div>
      )
  }

  const AnalysisMessage = () => (
    <div className="w-full max-w-[600px] lg:max-w-[800px] min-h-[50px] mb-2 transition-all">
        {aiThinking ? (
            <div className={`${activeTheme.panelBg} rounded-xl p-2 border border-amber-500/30 flex items-center justify-center gap-3 text-amber-500 animate-pulse`}>
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                <span className="text-xs md:text-sm">AI Thinking...</span>
            </div>
        ) : aiReasoning ? (
            <div className={`${activeTheme.panelBg} rounded-xl p-2 md:p-3 border border-purple-500/30 backdrop-blur-sm animate-fade-in`}>
                <h3 className="text-[10px] md:text-xs font-bold text-purple-500 uppercase mb-1 flex items-center gap-2"><Sparkles className="w-3 h-3"/> Gemini Analysis</h3>
                <p className={`text-xs md:text-sm ${activeTheme.textMain} italic leading-relaxed`}>"{aiReasoning}"</p>
            </div>
        ) : null}
    </div>
  );

  return (
    <div className={`min-h-screen font-serif overflow-x-hidden transition-colors duration-500 ${activeTheme.bgApp} ${activeTheme.textMain}`}>
        
        {(gameStatus === GameStatus.RedWin || gameStatus === GameStatus.BlackWin) && <Confetti />}
        
        <SettingsModal />

        <div className="container mx-auto p-2 md:p-4 lg:p-8 min-h-screen flex flex-col lg:flex-row items-start justify-center gap-4 lg:gap-10">

            {/* Desktop Left Sidebar */}
            <div className="hidden lg:flex flex-col gap-4 w-[360px] shrink-0 h-[calc(100vh-4rem)] sticky top-8">
                <ScoreboardCard />
                <SettingsCard />
                <div className="flex-1 min-h-0">
                    <HistoryCard className="h-full" />
                </div>
            </div>

            {/* Center: Game Board Area */}
            <div className="flex-1 flex flex-col items-center w-full">
                
                {/* Title */}
                <div className="relative w-full text-center mb-2 md:mb-4">
                    <h1 className={`text-3xl md:text-5xl font-bold font-calligraphy ${activeTheme.accentText} drop-shadow-md tracking-widest`}>
                        中国象棋
                    </h1>
                    {/* Mobile Settings Button (Absolute positioned relative to title area) */}
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className={`lg:hidden absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full ${activeTheme.highlightBg} ${activeTheme.textMuted}`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                <AnalysisMessage />

                {/* Mobile: Scoreboard */}
                <div className="lg:hidden w-full max-w-[600px] mb-4">
                   <ScoreboardCard />
                </div>

                {/* Board */}
                <div className="w-full max-w-[600px] lg:max-w-[800px]">
                    <Board 
                        board={board} 
                        onSquareClick={handleSquareClick}
                        selectedPos={selectedPos}
                        validMoves={validMoves}
                        lastMove={lastMove}
                        rotateBlack={aiModel === AIModel.None}
                        // Theme Props
                        boardBgClass={activeTheme.boardBg}
                        boardBorderClass={activeTheme.boardBorder}
                        gridColor={activeTheme.gridColor}
                        woodTexture={activeTheme.woodTexture}
                    />
                </div>

                {/* Mobile: Bottom Settings & History */}
                <div className="lg:hidden w-full max-w-[600px] flex flex-col gap-4 mt-4">
                    <SettingsCard />
                    <HistoryCard className="h-[300px]" />
                </div>
            </div>
        </div>
    </div>
  );
}

export default App;