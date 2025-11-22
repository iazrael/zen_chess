// AI Providers Configuration
export interface AIProviderConfig {
    name: string;
    model: string;
    apiUrl: string;
    apiKey: string;
}

// Supported AI Providers
let _AI_PROVIDERS: Record<string, AIProviderConfig> = null;

// Get all supported AI providers
export const getAIProviders = (): Record<string, AIProviderConfig> => {
    if (!_AI_PROVIDERS) {
        _AI_PROVIDERS = {
            openai: {
                name: 'OpenAI',
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
                apiKey: process.env.OPENAI_API_KEY || ''
            },
            gemini: {
                name: 'Gemini',
                model: process.env.GEMINI_MODEL || 'gemini-pro',
                apiUrl: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
                apiKey: process.env.GEMINI_API_KEY || ''
            },
            deepseek: {
                name: 'DeepSeek',
                model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
                apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
                apiKey: process.env.DEEPSEEK_API_KEY || ''
            },
            qianwen: {
                name: 'Qwen',
                model: process.env.QIANWEN_MODEL || 'qwen-plus',
                apiUrl: process.env.QIANWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                apiKey: process.env.QIANWEN_API_KEY || ''
            }
        }
    }
    return _AI_PROVIDERS;
}

// Get configuration for a specific provider
export const getAIProviderConfig = (provider: string): AIProviderConfig => {
    const providers = getAIProviders();
    return providers[provider] || providers.openai;
};