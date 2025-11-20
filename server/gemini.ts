import { GoogleGenAI, Type } from "@google/genai";
import { parseMoveString } from "./chessRules.js";
import { getGameContext, constructPrompt } from "./utils.js";

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

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

    const { board, turn, modelName } = req.body;

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

        const response = await ai.models.generateContent({
            model: modelName === 'gemini-pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        selectedMove: { type: Type.STRING },
                        reasoning: { type: Type.STRING }
                    },
                    required: ["selectedMove", "reasoning"]
                },
            }
        });

        const text = response.text;
        if (!text) {
            res.status(500).json({ error: "Empty response from AI" });
            return;
        }

        const result = JSON.parse(text);
        const moveData = parseMoveString(result.selectedMove);

        if (moveData) {
            res.status(200).json({ ...moveData, reason: result.reasoning });
        } else {
            console.warn("Gemini returned invalid move format, picking first legal move");
            res.status(200).json({ ...allLegalMoves[0], reason: "Fallback move (invalid format)" });
        }

    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error });
    }
}
