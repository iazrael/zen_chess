export var PieceType;
(function (PieceType) {
    PieceType["General"] = "k";
    PieceType["Advisor"] = "a";
    PieceType["Elephant"] = "b";
    PieceType["Horse"] = "n";
    PieceType["Chariot"] = "r";
    PieceType["Cannon"] = "c";
    PieceType["Soldier"] = "p";
})(PieceType || (PieceType = {}));
export var Color;
(function (Color) {
    Color["Red"] = "w";
    Color["Black"] = "b";
})(Color || (Color = {}));
export var GameStatus;
(function (GameStatus) {
    GameStatus[GameStatus["Playing"] = 0] = "Playing";
    GameStatus[GameStatus["RedWin"] = 1] = "RedWin";
    GameStatus[GameStatus["BlackWin"] = 2] = "BlackWin";
    GameStatus[GameStatus["Draw"] = 3] = "Draw";
})(GameStatus || (GameStatus = {}));
export var AIModel;
(function (AIModel) {
    AIModel["None"] = "none";
    AIModel["Traditional"] = "minimax";
    AIModel["GeminiFlash"] = "gemini-flash";
    AIModel["GeminiPro"] = "gemini-pro";
    AIModel["OpenAI"] = "openai";
})(AIModel || (AIModel = {}));
