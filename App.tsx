import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HomeView } from './components/HomeView';
import { GameView } from './components/GameView';
import { Confetti } from './components/Confetti';
import { HistoryModal } from './components/HistoryModal';
import { GameSettingsModal, GameSettings } from './components/GameSettingsModal';
import { INITIAL_BOARD, PIECE_CHARS, COL_NUMERALS, MOVE_DIRECTIONS } from './api/common/constants';
import { BoardState, Color, Position, Move, GameStatus, AIModel, Piece, PieceType, CaptureAnimationState } from './api/common/types';
import { getLegalMoves, applyMove, isCheck } from './api/chessRules';
import { getMinimaxMove } from './services/minimaxService';
import { getOpenAIMove } from './services/openaiService';
import { playMoveSound, playCaptureSound, playWinSound, playSelectSound, playInvalidMoveSound, setGlobalVolume } from './utils/sound';
import { Volume2, VolumeX, X, ScrollText } from 'lucide-react';

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
    // 新增：悔棋次数
    const [undoCount, setUndoCount] = useState(0);

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
        captureAnimation,
        undoCount
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
            captureAnimation,
            undoCount
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
        setUndoCount(0); // Reset undo count
    };

    const getMoveNotation = (piece: Piece, from: Position, to: Position, targetPiece?: Piece | null) => {
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

        let notation = `${pieceChar}${colStr}${dir}${valStr}`;
        
        // 5. Add captured piece info if applicable
        if (targetPiece) {
            const capturedPieceChar = PIECE_CHARS[targetPiece.color][targetPiece.type];
            notation += `(吃${capturedPieceChar})`;
        }
        
        return notation;
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
        const notation = movedPiece ? getMoveNotation(movedPiece, from, to, targetPiece) : "";
        if (notation) setMoveList(prev => [...prev, notation]);
        
        // 设置最后一步棋
        setLastMove({ from, to, captured: targetPiece || undefined, notation });
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
                        move = await getOpenAIMove(board, turn, aiProvider, lastMove);
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
    }, [turn, aiModel, aiProvider, gameStatus, view, board, minimaxDepth, minimaxVersion, executeMoveStable, isAnimating, lastMove, moveList]);

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
        
        // 增加悔棋次数
        setUndoCount(prev => prev + 1);

        setGameStatus(GameStatus.Playing);
    };

    const changeTimeControl = (seconds: number) => {
        setInitialTime(seconds);
        resetGameLogic();
    };

    // --- Components ---
    return (
      <div className={`${THEME.bgApp} ${THEME.textMain} min-h-screen`}>
        {view === 'home' ? (
          <HomeView onStartGame={startGame} />
        ) : (
          <GameView
            // Game State
            board={board}
            turn={turn}
            selectedPos={selectedPos}
            validMoves={validMoves}
            lastMove={lastMove}
            gameStatus={gameStatus}
            captureAnimation={captureAnimation}
            historyLength={history.length}
            undoCount={undoCount}
            totalMoves={moveList.length}
            
            // Timer State
            initialTime={initialTime}
            gameResetKey={gameResetKey}
            
            // AI State
            aiModel={aiModel}
            aiThinking={aiThinking}
            aiReasoning={aiReasoning}
            gameMode={gameMode}
            
            // Handlers
            onSquareClick={handleSquareClickStable}
            onTimeOut={handleTimeOut}
            onUndo={undo}
            onReset={resetGameLogic}
            onNavigateHome={() => setView('home')}
            onToggleHistory={() => setIsHistoryOpen(true)}
            isHistoryOpen={isHistoryOpen}
            
            // Theme
            boardBgClass={THEME.boardBg}
            boardBorderClass={THEME.boardBorder}
            gridColor={THEME.gridColor}
            woodTexture={THEME.woodTexture}
          />
        )}
        <HistoryModal 
          isOpen={isHistoryOpen} 
          moveList={moveList} 
          onClose={() => setIsHistoryOpen(false)} 
        />
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