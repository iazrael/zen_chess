import { parseMoveString } from "./chessRules.js";
import { getGameContext, constructPrompt, systemPrompt } from "./utils.js";
import { getAIProviderConfig } from "./common/config.js";

export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { board, turn, provider = 'openai' } = req.body;

    // Get configuration for the specified provider
    const config = getAIProviderConfig(provider);

    if (!config.apiKey) {
        res.status(500).json({ error: `API Key missing configuration for ${provider}` });
        return;
    }

    try {
        const { fen, allLegalMoves, legalMovesStr } = getGameContext(board, turn);

        if (allLegalMoves.length === 0) {
            res.status(200).json({ move: null, message: "No legal moves" });
            return;
        }

        const prompt = constructPrompt(fen, turn, legalMovesStr);

        let body;
        let headers;

        // Configure request
        body = JSON.stringify({
            model: config.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        const response = await fetch(`${config.apiUrl}${provider === 'gemini' ? `/${config.model}:generateContent?key=${config.apiKey}` : ''}`, {
            method: 'POST',
            headers: headers,
            body: body
        });

        // 打印一下请求体
        console.log(`${provider} API Request:`, body);

        if (!response.ok) {
            const err = await response.text();
            console.error(`${provider} API Error:`, err);
            res.status(500).json({ error: `${provider} API Error`, details: err });
            return;
        }

        const data: any = await response.json();
        let content;

        // Extract content based on provider
        if (provider === 'gemini') {
            content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else if (provider === 'qianwen') {
            content = data.output?.choices?.[0]?.message?.content;
        } else {
            content = data.choices?.[0]?.message?.content;
        }

        if (!content) {
            res.status(500).json({ error: "Empty response from AI" });
            return;
        }

        console.log(`${provider} API Response:`, content);

        let result;
        try {
            result = JSON.parse(content);
        } catch (e) {
            console.warn(`Failed to parse JSON from ${provider}`, content);
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback (JSON parse error)" });
            return;
        }

        const moveData = parseMoveString(result.selectedMove);

        if (moveData) {
            res.status(200).json({ ...moveData, reason: result.reasoning });
        } else {
            console.warn(`${provider} returned invalid move format, picking first legal move`);
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback move (invalid format)" });
        }

    } catch (error) {
        console.error(`${provider} API Error:`, error);
        res.status(500).json({ error: "Internal Server Error", details: error });
    }
}