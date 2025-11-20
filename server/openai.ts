import { parseMoveString } from "./chessRules.js";
import { getGameContext, constructPrompt } from "./utils.js";

const apiKey = process.env.OPENAI_API_KEY || '';
const apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

    const { board, turn } = req.body;

    if (!apiKey) {
        res.status(500).json({ error: "API Key missing configuration" });
        return;
    }

    try {
        const { fen, allLegalMoves, legalMovesStr } = getGameContext(board, turn);

        if (allLegalMoves.length === 0) {
            res.status(200).json({ move: null, message: "No legal moves" });
            return;
        }

        const prompt = constructPrompt(fen, turn, legalMovesStr);

        const body = JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: "You are a Chinese Chess (Xiangqi) Grandmaster engine. Return JSON only." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: body
        });

        // 打印一下请求体
        console.log("OpenAI API Request:", body);

        if (!response.ok) {
            const err = await response.text();
            console.error("OpenAI API Error:", err);
            res.status(500).json({ error: "OpenAI API Error", details: err });
            return;
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            res.status(500).json({ error: "Empty response from AI" });
            return;
        }

        let result;
        try {
            result = JSON.parse(content);
        } catch (e) {
            console.warn("Failed to parse JSON from OpenAI", content);
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback (JSON parse error)" });
            return;
        }

        const moveData = parseMoveString(result.selectedMove);

        if (moveData) {
            res.status(200).json({ ...moveData, reason: result.reasoning });
        } else {
            console.warn("OpenAI returned invalid move format, picking first legal move");
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback move (invalid format)" });
        }

    } catch (error) {
        console.error("OpenAI API Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error });
    }
}
