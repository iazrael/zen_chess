import { getAIProviders } from './common/config.js';

/**
 * Vercel Serverless Function: 返回可用的 LLM 供应商列表
 */
export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const all_providers = getAIProviders();
        // 从配置中读取所有供应商并检查可用性
        const providers = Object.entries(all_providers).map(([id, config]) => ({
            id,
            name: config.name,
            available: !!config.apiKey && config.apiKey.length > 0
        }));

        res.status(200).json({ providers });
    } catch (error) {
        console.error('Error fetching providers:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
