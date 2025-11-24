import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Clock, Zap, BrainCircuit, Sparkles } from 'lucide-react';
import { buildApiUrl, getRuntimeEnvironment, RuntimeEnvironment } from '@/utils/env';
import { MinimaxVersion } from '@/services/types';

export interface GameSettings {
    gameMode: 'pvp' | 'ai';
    gameTime: number;
    volume: number;
    // AI specific settings
    algorithmType?: 'traditional' | 'llm';
    minimaxVersion?: MinimaxVersion;
    difficulty?: 3 | 4 | 5;
    llmProvider?: string;
}

interface Provider {
    id: string;
    name: string;
    available: boolean;
}

interface GameSettingsModalProps {
    isOpen: boolean;
    mode: 'pvp' | 'ai';
    initialSettings: Partial<GameSettings>;
    onClose: () => void;
    onConfirm: (settings: GameSettings) => void;
}

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
    isOpen,
    mode,
    initialSettings,
    onClose,
    onConfirm
}) => {
    const runtimeEnv = getRuntimeEnvironment();
    const [gameTime, setGameTime] = useState(initialSettings.gameTime || 600);
    const [volume, setVolume] = useState(initialSettings.volume || 0.5);
    
    // AI specific states
    const [algorithmType, setAlgorithmType] = useState<'traditional' | 'llm'>(
        (runtimeEnv !== RuntimeEnvironment.GITHUB_PAGES && initialSettings.algorithmType) || 'traditional'
    );
    const [minimaxVersion, setMinimaxVersion] = useState<MinimaxVersion>(
        initialSettings.minimaxVersion || MinimaxVersion.V2
    );
    const [difficulty, setDifficulty] = useState<3 | 4 | 5>(
        initialSettings.difficulty || 4
    );
    const [llmProvider, setLlmProvider] = useState(
        initialSettings.llmProvider || 'deepseek'
    );
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(false);

    // Fetch providers when modal opens and mode is AI with LLM
    useEffect(() => {
        if (isOpen && mode === 'ai' && algorithmType === 'llm') {
            fetchProviders();
        }
    }, [isOpen, mode, algorithmType]);

    const fetchProviders = async () => {
        setLoadingProviders(true);
        try {
            const response = await fetch(buildApiUrl('/api/providers'));
            if (response.ok) {
                const data = await response.json();
                setProviders(data.providers || []);
                
                // Set first available provider as default if current one is not available
                const availableProviders = data.providers.filter((p: Provider) => p.available);
                if (availableProviders.length > 0 && !availableProviders.find((p: Provider) => p.id === llmProvider)) {
                    setLlmProvider(availableProviders[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch providers:', error);
        } finally {
            setLoadingProviders(false);
        }
    };

    const handleConfirm = () => {
        const settings: GameSettings = {
            gameMode: mode,
            gameTime,
            volume
        };

        if (mode === 'ai') {
            settings.algorithmType = algorithmType;
            if (algorithmType === 'traditional') {
                settings.minimaxVersion = minimaxVersion;
                settings.difficulty = difficulty;
            } else {
                settings.llmProvider = llmProvider;
            }
        }

        onConfirm(settings);
    };

    if (!isOpen) return null;

    const timeOptions = [
        { label: '无限', value: 0, icon: '∞' },
        { label: '10分钟', value: 600, icon: '10m' },
        { label: '20分钟', value: 1200, icon: '20m' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div 
                className="bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-stone-800 p-4 border-b border-stone-700 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-stone-200 flex items-center gap-2">
                        {mode === 'pvp' ? (
                            <>
                                <span className="text-amber-500">双人对弈</span> 设置
                            </>
                        ) : (
                            <>
                                <span className="text-purple-500">挑战 AI</span> 设置
                            </>
                        )}
                    </h2>
                    <button 
                        onClick={onClose}
                        className="text-stone-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    
                    {/* AI Algorithm Selection - Only for AI mode */}
                    {mode === 'ai' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-stone-300 flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4 text-purple-500" />
                                算法类型
                            </h3>
                            <div className={runtimeEnv === RuntimeEnvironment.GITHUB_PAGES ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
                                <button
                                    onClick={() => setAlgorithmType('traditional')}
                                    className={`p-3 rounded-lg border transition-all ${
                                        algorithmType === 'traditional'
                                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                            : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                    }`}
                                >
                                    <Zap className="w-5 h-5 mx-auto mb-1" />
                                    <div className="text-xs font-medium">传统算法</div>
                                </button>
                                {runtimeEnv !== RuntimeEnvironment.GITHUB_PAGES && (
                                    <button
                                        onClick={() => setAlgorithmType('llm')}
                                        className={`p-3 rounded-lg border transition-all ${
                                            algorithmType === 'llm'
                                                ? 'border-green-500 bg-green-500/20 text-green-300'
                                                : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                        }`}
                                    >
                                        <Sparkles className="w-5 h-5 mx-auto mb-1" />
                                        <div className="text-xs font-medium">大语言模型</div>
                                    </button>
                                )}
                            </div>

                            {/* Traditional Algorithm Options */}
                            {algorithmType === 'traditional' && (
                                <div className="space-y-3 animate-fade-in">
                                    <div>
                                        <label className="text-xs text-stone-400 mb-2 block">算法版本</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                onClick={() => setMinimaxVersion(MinimaxVersion.V1)}
                                                className={`py-2 px-3 text-sm rounded border transition-all ${
                                                    minimaxVersion === MinimaxVersion.V1
                                                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                                        : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                                }`}
                                            >
                                                Minimax V1
                                            </button>
                                            <button
                                                onClick={() => setMinimaxVersion(MinimaxVersion.V2)}
                                                className={`py-2 px-3 text-sm rounded border transition-all ${
                                                    minimaxVersion === MinimaxVersion.V2
                                                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                                        : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                                }`}
                                            >
                                                Minimax V2
                                            </button>
                                            <button
                                                onClick={() => setMinimaxVersion(MinimaxVersion.V3)}
                                                className={`py-2 px-3 text-sm rounded border transition-all ${
                                                    minimaxVersion === MinimaxVersion.V3
                                                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                                        : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                                }`}
                                            >
                                                Minimax V3
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-stone-400 mb-2 block">难度等级</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { label: '简单', value: 3 },
                                                { label: '中等', value: 4 },
                                                { label: '困难', value: 5 }
                                            ].map(({ label, value }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setDifficulty(value as 3 | 4 | 5)}
                                                    className={`py-2 px-3 text-sm rounded border transition-all ${
                                                        difficulty === value
                                                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                                            : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* LLM Provider Options */}
                            {algorithmType === 'llm' && (
                                <div className="animate-fade-in">
                                    <label className="text-xs text-stone-400 mb-2 block">LLM 供应商</label>
                                    {loadingProviders ? (
                                        <div className="text-center py-4 text-stone-500 text-sm">
                                            加载中...
                                        </div>
                                    ) : providers.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {providers.filter(p => p.available).map(provider => (
                                                <button
                                                    key={provider.id}
                                                    onClick={() => setLlmProvider(provider.id)}
                                                    className={`py-2 px-3 text-sm rounded border transition-all ${
                                                        llmProvider === provider.id
                                                            ? 'border-green-500 bg-green-500/20 text-green-300'
                                                            : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                                    }`}
                                                >
                                                    {provider.name}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-stone-500 text-sm">
                                            暂无可用供应商
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Time Control */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-stone-300 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            对战时间
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {timeOptions.map(({ label, value, icon }) => (
                                <button
                                    key={value}
                                    onClick={() => setGameTime(value)}
                                    className={`py-3 px-2 rounded-lg border transition-all ${
                                        gameTime === value
                                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                            : 'border-stone-700 bg-stone-800 text-stone-400 hover:bg-stone-700'
                                    }`}
                                >
                                    <div className="text-lg font-bold mb-1">{icon}</div>
                                    <div className="text-[10px]">{label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Volume Control */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-stone-300 flex items-center gap-2">
                            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            音量设置
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setVolume(volume > 0 ? 0 : 0.5)}
                                className="text-stone-400 hover:text-white transition-colors"
                            >
                                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={volume}
                                onChange={e => setVolume(parseFloat(e.target.value))}
                                className="flex-1 h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <span className="text-sm text-stone-400 w-10 text-right">
                                {Math.round(volume * 100)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-stone-800 p-4 border-t border-stone-700 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-stone-400 hover:text-white transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                    >
                        开始游戏
                    </button>
                </div>
            </div>
        </div>
    );
};
