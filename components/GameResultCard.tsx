import React, { useRef } from 'react';
import { Color, AIModel, GameStatus } from '@/api/common/types';
import { Star, Trophy, Heart, Sparkles, Download, History as HistoryIcon } from 'lucide-react';
import html2canvas from 'html2canvas';

interface GameResultCardProps {
  gameStatus: GameStatus;
  gameMode: 'pvp' | 'ai';
  aiModel: AIModel;
  difficulty?: number;
  minimaxVersion?: 'v1' | 'v2';
  llmProvider?: string;
  totalTime: number; // 总耗时（秒）
  undoCount: number; // 悔棋次数
  checkCount: number; // 将军次数
  totalMoves: number; // 总步数
  onClose: () => void;
  onViewHistory: () => void;
}

export const GameResultCard: React.FC<GameResultCardProps> = ({
  gameStatus,
  gameMode,
  aiModel,
  difficulty,
  minimaxVersion,
  llmProvider,
  totalTime,
  undoCount,
  checkCount,
  totalMoves,
  onClose,
  onViewHistory,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // 判断是否是胜利（对于AI模式）
  const isVictory = gameMode === 'ai' && gameStatus === GameStatus.RedWin;
  const isDefeat = gameMode === 'ai' && gameStatus === GameStatus.BlackWin;
  const isPvpRedWin = gameMode === 'pvp' && gameStatus === GameStatus.RedWin;
  const isPvpBlackWin = gameMode === 'pvp' && gameStatus === GameStatus.BlackWin;

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  // 获取难度文字
  const getDifficultyText = () => {
    if (aiModel === AIModel.Traditional) {
      const difficultyMap: { [key: number]: string } = {
        3: '入门',
        4: '进阶',
        5: '大师',
      };
      return difficultyMap[difficulty || 4] || '进阶';
    } else if (aiModel === AIModel.OpenAI) {
      return 'AI智能';
    }
    return '';
  };

  // 获取算法类型文字
  const getAlgorithmText = () => {
    if (aiModel === AIModel.Traditional) {
      return `传统算法 (${minimaxVersion?.toUpperCase()})`;
    } else if (aiModel === AIModel.OpenAI) {
      const providerNames: { [key: string]: string } = {
        'deepseek': 'DeepSeek',
        'openai': 'OpenAI',
        'claude': 'Claude',
      };
      return `${providerNames[llmProvider || 'deepseek'] || 'LLM'} AI`;
    }
    return '';
  };

  // 获取祝贺或鼓励语句
  const getMessage = () => {
    if (gameMode === 'ai') {
      if (isVictory) {
        const messages = [
          '🎉 太棒了！你成功战胜了AI！',
          '👏 真厉害！再接再厉！',
          '🌟 完美胜利！你是象棋高手！',
          '💪 干得漂亮！继续挑战更高难度吧！',
        ];
        return messages[Math.floor(Math.random() * messages.length)];
      } else {
        const messages = [
          '💪 别灰心，再来一局！',
          '🌈 失败是成功之母，加油！',
          '⭐ 每一次对弈都是进步！',
          '🎯 继续努力，你会越来越强！',
        ];
        return messages[Math.floor(Math.random() * messages.length)];
      }
    } else {
      // PVP模式
      if (isPvpRedWin) {
        return '🎊 红方获胜！精彩对弈！';
      } else {
        return '🎊 黑方获胜！精彩对弈！';
      }
    }
  };

  // 保存卡片为图片
  const handleSaveCard = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `zen_chess_result_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* 外部容器 */}
      <div className="relative flex flex-col items-center gap-4 animate-scale-in">
        {/* 结果卡片 */}
        <div
          ref={cardRef}
          className={`relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden ${
            isVictory || isPvpRedWin || isPvpBlackWin
              ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50'
              : 'bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300'
          }`}
        >
          {/* 装饰性背景图案 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 blur-3xl"></div>
            <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 blur-2xl"></div>
          </div>

          {/* 卡片内容 */}
          <div className="relative p-8">
            {/* 顶部装饰 - 小图标 */}
            <div className="flex justify-center gap-2 mb-4">
              {(isVictory || isPvpRedWin || isPvpBlackWin) ? (
                <>
                  <Star className="w-5 h-5 text-yellow-500 animate-pulse" fill="currentColor" />
                  <Sparkles className="w-6 h-6 text-amber-500 animate-bounce" />
                  <Star className="w-5 h-5 text-yellow-500 animate-pulse" fill="currentColor" />
                </>
              ) : (
                <>
                  <Heart className="w-5 h-5 text-gray-400" />
                  <Heart className="w-6 h-6 text-gray-500" />
                  <Heart className="w-5 h-5 text-gray-400" />
                </>
              )}
            </div>

            {/* 主标题 */}
            <div className="text-center mb-6">
              {gameMode === 'ai' ? (
                <h2
                  className={`text-5xl font-black mb-2 ${
                    isVictory
                      ? 'bg-gradient-to-r from-yellow-600 via-orange-500 to-red-500 text-transparent bg-clip-text'
                      : 'text-gray-500'
                  }`}
                  style={{ fontFamily: 'Impact, sans-serif' }}
                >
                  {isVictory ? 'VICTORY' : 'DEFEAT'}
                </h2>
              ) : (
                <h2
                  className="text-5xl font-black mb-2 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 text-transparent bg-clip-text"
                  style={{ fontFamily: 'Impact, sans-serif' }}
                >
                  {isPvpRedWin ? '红方胜利' : '黑方胜利'}
                </h2>
              )}
              
              {(isVictory || isPvpRedWin || isPvpBlackWin) && (
                <Trophy className="w-12 h-12 mx-auto text-yellow-600 animate-bounce" />
              )}
            </div>

            {/* 对战设定 */}
            {gameMode === 'ai' && (
              <div className={`mb-6 p-4 rounded-2xl ${
                isVictory
                  ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-300'
                  : 'bg-gray-200 border-2 border-gray-400'
              }`}>
                <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                  isVictory ? 'text-amber-800' : 'text-gray-700'
                }`}>
                  <Sparkles className="w-4 h-4" />
                  对战配置
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className={isVictory ? 'text-amber-700' : 'text-gray-600'}>智能等级：</span>
                    <span className={`font-semibold ${isVictory ? 'text-amber-900' : 'text-gray-800'}`}>
                      {getDifficultyText()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isVictory ? 'text-amber-700' : 'text-gray-600'}>算法引擎：</span>
                    <span className={`font-semibold ${isVictory ? 'text-amber-900' : 'text-gray-800'}`}>
                      {getAlgorithmText()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isVictory ? 'text-amber-700' : 'text-gray-600'}>对弈时长：</span>
                    <span className={`font-semibold ${isVictory ? 'text-amber-900' : 'text-gray-800'}`}>
                      {formatTime(totalTime)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* PVP 模式对战数据 */}
            {gameMode === 'pvp' && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-300">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-amber-800">
                  <Sparkles className="w-4 h-4" />
                  对战时长
                </h3>
                <div className="text-center">
                  <span className="text-2xl font-bold text-amber-900">
                    {formatTime(totalTime)}
                  </span>
                </div>
              </div>
            )}

            {/* 对战数据统计 */}
            <div className={`mb-6 p-4 rounded-2xl ${
              isVictory || isPvpRedWin || isPvpBlackWin
                ? 'bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300'
                : 'bg-gray-200 border-2 border-gray-400'
            }`}>
              <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${
                isVictory || isPvpRedWin || isPvpBlackWin ? 'text-orange-800' : 'text-gray-700'
              }`}>
                <Star className="w-4 h-4" />
                对战数据
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    isVictory || isPvpRedWin || isPvpBlackWin ? 'text-orange-600' : 'text-gray-600'
                  }`}>
                    {totalMoves}
                  </div>
                  <div className={`text-xs ${
                    isVictory || isPvpRedWin || isPvpBlackWin ? 'text-orange-700' : 'text-gray-600'
                  }`}>
                    总步数
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    isVictory || isPvpRedWin || isPvpBlackWin ? 'text-orange-600' : 'text-gray-600'
                  }`}>
                    {checkCount}
                  </div>
                  <div className={`text-xs ${
                    isVictory || isPvpRedWin || isPvpBlackWin ? 'text-orange-700' : 'text-gray-600'
                  }`}>
                    将军次数
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    isVictory || isPvpRedWin || isPvpBlackWin ? 'text-orange-600' : 'text-gray-600'
                  }`}>
                    {undoCount}
                  </div>
                  <div className={`text-xs ${
                    isVictory || isPvpRedWin || isPvpBlackWin ? 'text-orange-700' : 'text-gray-600'
                  }`}>
                    悔棋次数
                  </div>
                </div>
              </div>
            </div>

            {/* 祝贺/鼓励语句 */}
            <div className={`text-center p-4 rounded-2xl ${
              isVictory || isPvpRedWin || isPvpBlackWin
                ? 'bg-gradient-to-r from-pink-100 to-purple-100'
                : 'bg-gray-200'
            }`}>
              <p className={`text-lg font-bold ${
                isVictory || isPvpRedWin || isPvpBlackWin ? 'text-purple-700' : 'text-gray-600'
              }`}>
                {getMessage()}
              </p>
            </div>

            {/* 小朋友喜欢的装饰元素 */}
            <div className="flex justify-center gap-2 mt-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    isVictory || isPvpRedWin || isPvpBlackWin
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                      : 'bg-gray-400'
                  }`}
                  style={{
                    animation: `bounce ${1 + i * 0.1}s infinite`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* 外部操作按钮 */}
        <div className="flex flex-wrap justify-center gap-3">
          {/* <button
            onClick={handleSaveCard}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            <Download className="w-5 h-5" />
            保存战绩
          </button> */}
          <button
            onClick={onViewHistory}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            <HistoryIcon className="w-5 h-5" />
            查看棋谱
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
