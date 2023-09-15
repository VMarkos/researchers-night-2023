const N_ROWS = 8;
const N_COLS = 8;

let BOARD; // 0 = empty, 1 = white, -1 = black.
let LEGAL_MOVES; // String array, containing all cell ids that are legal moves.
let TO_BE_FLIPPED; // List of cell ids that should be flipped.
let LAST_MOVE;
let ALL_DIRECTIONS = [
    [1, -1], [1, 0], [1, 1],
    [0, -1], [0, 1],
    [-1, -1], [-1, 0], [-1, 1],
];
let PLAYING = true;
let EMPTY_CELLS;
let NO_LEGAL_MOVES = false;

let EXPLANATION = document.createElement("li");
EXPLANATION.classList.add("why");

let CONTRASTIVE_EXPLANATION = document.createElement("li");
CONTRASTIVE_EXPLANATION.classList.add("why");

const TEST_POLICY = `@KnowledgeBase
D1 :: legalMove(X,Y) implies move(X,Y);
D2 :: legalMove(X,Y), legalMove(Z,W), corner(Z,W), -?=(X,Z) implies -move(X,Y);
D3 :: legalMove(X,Y), legalMove(Z,W), corner(Z,W), -?=(Y,W) implies -move(X,Y);
C1 :: implies corner(0, 0);
C2 :: implies corner(0,7);
C3 :: implies corner(7,0);
C4 :: implies corner(7,7);
R1 :: legalMove(X,Y), corner(X,Y) implies move(X,Y);
R2 :: corner(X,Y), legalMove(Z,W), ?isAdj(X,Y,Z,W) implies -move(Z,W);

@Procedures
function isAdj(x,y,z,w) {
    const X = parseInt(x);
    const Y = parseInt(y);
    const Z = parseInt(z);
    const W = parseInt(w);
    return Z-X < 2 && X-Z < 2 && W-Y < 2 && Y-W < 2 && (X != Z || Y != W);
}`

const TEST_DICT = {
    "D1": "Play any legal move available, resolving ties at random.",
    "D2": "If there is a move to a corner available, then do not play any other move.",
    "D3": "If there is a move to a corner available, then do not play any other move.",
    "C1": "Square at (0,0) is a corner square.",
    "C2": "Square at (0,7) is a corner square.",
    "C3": "Square at (7,0) is a corner square.",
    "C4": "Square at (7,7) is a corner square.",
    "R1": "If there is a legal move to a corner, prefer that move.",
    "R2": "If there is a legal move next to a corner, avoid that move.",
};

const TEST_LITERAL_DICT = {
    "move": (x, y) => {return `move to (${x + 1}, ${y + 1})`;},
};

function initializeBoard() {
    document.getElementById("blacks").innerText = 2;
    document.getElementById("whites").innerText = 2;
    EMPTY_CELLS = N_ROWS * N_COLS - 4;
    const boardContainer = document.getElementById("board-container");
    let othelloCell;
    boardContainer.style.gridTemplateColumns = "repeat(" + N_COLS + ", 1fr)";
    BOARD = new Array(N_ROWS);
    for (let i=0; i < N_ROWS; i++) {
        BOARD[i] = [];
        for (let j=0; j < N_COLS; j++) {
            BOARD[i].push(0);
            othelloCell = document.createElement("div");
            othelloCell.classList.add("othello-cell");
            othelloCell.id = "oc-" + i + "-" + j;
            boardContainer.append(othelloCell);
        }
    }
    setUpPosition(boardContainer);
    calculateLegalMoves();
    // debugger;
    drawLegalMoves();
}

function machineMove(e) {
    const move = prudensMove(1);
    e.target.classList.add("inactive");
    e.target.removeEventListener("click", machineMove);
}

function drawLegalMoves(color = -1) {
    let cellContainer, legalMove, coords, row, col;
    for (const cellId of LEGAL_MOVES) {
        // console.log(cellId);
        // debugger;
        cellContainer = document.getElementById(cellId);
        legalMove = document.createElement("div");
        legalMove.classList.add("legal-moves-black");
        if (color === -1) {
            legalMove.addEventListener("mouseup", () => {
                coords = cellId.split("-");
                row = parseInt(coords[1]);
                col = parseInt(coords[2]);
                const autoplayCheckbox = document.getElementById("autoplay-checkbox");
                if (autoplayCheckbox.checked) {
                    makeDoubleMove(row, col);
                } else {
                    makeSingleMove(row, col, -1);
                    const playButton = document.getElementById("prudens-play-button");
                    playButton.classList.remove("inactive");
                    playButton.addEventListener("click", machineMove);
                }
                // makeDoubleMove(row, col);
            });
        } else {
            legalMove.style.cursor = "auto";
            const playButton = document.getElementById("prudens-play-button");
            playButton.removeEventListener("click", machineMove);
            playButton.classList.add("inactive");
        }
        cellContainer.append(legalMove);
    }
}

function eraseLegalMoves() {
    let cellContainer;
    for (const cellId of LEGAL_MOVES) {
        cellContainer = document.getElementById(cellId);
        while (cellContainer.firstChild) {
            cellContainer.removeChild(cellContainer.lastChild);
        }
    }
}

function flipPieces() {
    let coords, currentPiece, row, col;
    // console.log("TO_BE_FLIPPED:", TO_BE_FLIPPED);
    // console.log("LAST_MOVE:", LAST_MOVE);
    for (const cellId of TO_BE_FLIPPED[LAST_MOVE]) {
        currentPiece = document.getElementById(cellId).lastChild;
        // console.log("cellId:", cellId);
        coords = cellId.split("-");
        row = coords[1];
        col = coords[2];
        // console.log("row:", row, "col:", col);
        if (BOARD[row][col] === -1) {
            currentPiece.classList.remove("othello-piece-black");
            currentPiece.classList.add("othello-piece-white");
            BOARD[row][col] = 1;
        } else {
            currentPiece.classList.remove("othello-piece-white");
            currentPiece.classList.add("othello-piece-black");
            BOARD[row][col] = -1;
        }
    }
}

function setUpPosition() {
    let xc1, xc2, yc1, yc2, cell, piece;
    if (N_ROWS % 2 === 0) {
        xc1 = N_ROWS / 2 - 1;
        xc2 = xc1 + 1;
    } else {
        xc1 = (N_ROWS - 1) / 2;
        xc2 = xc1 + 1;
    }
    if (N_COLS % 2 === 0) {
        yc1 = N_COLS / 2 - 1;
        yc2 = yc1 + 1;
    } else {
        yc1 = (N_COLS - 1) / 2;
        yc2 = yc1 + 1;
    }
    BOARD[xc1][yc1] = 1;
    cell = document.getElementById("oc-" + xc1 + "-" + yc1);
    piece = document.createElement("div");
    piece.classList.add("othello-piece-white");
    cell.append(piece);
    BOARD[xc1][yc2] = -1;
    cell = document.getElementById("oc-" + xc1 + "-" + yc2);
    piece = document.createElement("div");
    piece.classList.add("othello-piece-black");
    cell.append(piece);
    BOARD[xc2][yc1] = -1;
    cell = document.getElementById("oc-" + xc2 + "-" + yc1);
    piece = document.createElement("div");
    piece.classList.add("othello-piece-black");
    cell.append(piece);
    BOARD[xc2][yc2] = 1;
    cell = document.getElementById("oc-" + xc2 + "-" + yc2);
    piece = document.createElement("div");
    piece.classList.add("othello-piece-white");
    cell.append(piece);
}

function calculateLegalMoves(opponent = 1) {
    LEGAL_MOVES = [];
    TO_BE_FLIPPED = {};
    let toBeFlipped, currentCellId;
    for (let i = 0; i < N_ROWS; i++) {
        for (let j = 0; j < N_COLS; j++) {
            currentCellId = "oc-" + i + "-" + j;
            toBeFlipped = [];
            for (const direction of ALL_DIRECTIONS) {
                toBeFlipped.push(...isLegalMoveInDirection(currentCellId, direction[0], direction[1], opponent));
            }
            if (toBeFlipped.length !== 0) {
                LEGAL_MOVES.push(currentCellId);
                TO_BE_FLIPPED[currentCellId] = toBeFlipped;
            }
        }
    }
    if (LEGAL_MOVES.length === 0 && opponent === 1) {
        calculateLegalMoves((-1) * opponent);
    }
}

function isLegalMoveInDirection(cellId, xStep, yStep, opponent = 1) {
    const coords = cellId.split("-");
    // console.log(cellId);
    const cellX = parseInt(coords[1]);
    const cellY = parseInt(coords[2]);
    const opponentCells = [];
    if (BOARD[cellX][cellY] !== 0) {
        return [];
    }
    let currentX = cellX + xStep, currentY = cellY + yStep, isPreviousWhite = false;
    while (currentX < N_ROWS && currentX >= 0 && currentY < N_COLS && currentY >= 0 && BOARD[currentX][currentY] !== 0) {
        if (isPreviousWhite && BOARD[currentX][currentY] === -opponent) {
            return opponentCells;
        }
        if (!isPreviousWhite) {
            if (BOARD[currentX][currentY] === -opponent) {
                return [];
            }
            isPreviousWhite = true;
        }
        opponentCells.push("oc-" + currentX + "-" + currentY);
        currentX += xStep;
        currentY += yStep;
    }
    return [];
}

function makeSingleMove(row, col, color = -1) {
    const lastMoveDot = document.getElementById("last-move");
    if (lastMoveDot) {
        lastMoveDot.remove();
    }
    eraseLegalMoves();
    const pieceClass = `othello-piece-${color === 1 ? "white" : "black"}`;
    const cell = document.getElementById("oc-" + row + "-" + col);
    const piece = document.createElement("div");
    const redDot = document.createElement("div");
    redDot.id = "last-move";
    redDot.classList.add("othello-last-move");
    piece.append(redDot);
    piece.classList.add(pieceClass);
    cell.append(piece);
    BOARD[row][col] = color;
    LAST_MOVE = "oc-" + row + "-" + col;
    flipPieces();
    updateScore(color);
    calculateLegalMoves(color);
    // if (LEGAL_MOVES.length === 0 && color === 1) {
    //     console.log("You have no move!", LEGAL_MOVES);
    //     calculateLegalMoves((-1) * color);
    //     console.log("Opponent moves!", LEGAL_MOVES);
    //     debugger;
    //     const prMove = prudensMove(color);
    //     if (prMove === 0) {
    //         LEGAL_MOVES = [];
    //         console.log("The End!");
    //     }
    // }
    drawLegalMoves((-1) * color);
    EMPTY_CELLS -= 1;
}

function updateScore(color) {
    const flipped = TO_BE_FLIPPED[LAST_MOVE].length;
    const blacksElement = document.getElementById("blacks");
    const whitesElement = document.getElementById("whites");
    const oldBlacks = parseInt(blacksElement.innerText);
    const oldWhites = parseInt(whitesElement.innerText);
    if (color === 1) {
        blacksElement.innerText = oldBlacks - flipped;
        whitesElement.innerText = oldWhites + flipped + 1;
    } else {
        blacksElement.innerText = oldBlacks + flipped + 1;
        whitesElement.innerText = oldWhites - flipped;
    }
}

function updateLastMove(cellId) {
	// const cell = document.getElementById(cellId);
	if (LAST_MOVE) {
        const coords = LAST_MOVE.split("-");
        const row = coords[1];
        const col = coords[2];
        if (BOARD[row][col] === 1) {
            const previousCell = document.getElementById(LAST_MOVE);
            const previousPiece = previousCell.lastChild;
            // console.log(previousPiece);
            previousPiece.removeChild(previousPiece.lastChild);
        }
	}
	LAST_MOVE = cellId;
}

function isGameOver() {
    // console.log("EMPTY_CELLS:", EMPTY_CELLS);
    return EMPTY_CELLS === 0;
}

function startNewGameDialogue(result) {
	const newGame = confirm(`${result} Start another game?`);
		if (newGame) {
            PLAYING = true;
            const boardContainer = document.getElementById("board-container");
            while (boardContainer.firstChild) {
                boardContainer.removeChild(boardContainer.lastChild);
            }
			initializeBoard();
		}
}

/* Agents */

function randomMove(color = -1) {
    EXPLANATION.innerHTML = "";
    CONTRASTIVE_EXPLANATION.innerHTML = "";
    const explanationsUl = document.createElement("ul");
    explanationsUl.classList.add("explanations-list");
    explanationsUl.classList.add("hidden");
    currentLi = document.createElement("li");
    currentLi.innerText = "I had no idea about what to do, so I chose a move randomly.";
    explanationsUl.appendChild(currentLi);
    const whySpan = document.createElement("span");
    whySpan.innerHTML = "<b>Why?</b>";
    whySpan.classList.add("why");
    whySpan.id = "why-span";
    whySpan.onmouseup = () => {showSiblings("why-span");};
    EXPLANATION.appendChild(whySpan);
    EXPLANATION.appendChild(explanationsUl);
    const contrastiveUl = document.createElement("ul");
    contrastiveUl.classList.add("contrastive-explanations-list");
    contrastiveUl.classList.add("hidden");
    const whyNotSpan = document.createElement("span");
    whyNotSpan.innerHTML = "<b>Why not...</b>";
    whyNotSpan.classList.add("why");
    whyNotSpan.id = "why-not-span";
    whyNotSpan.onmouseup = () => {showSiblings("why-not-span");};
    CONTRASTIVE_EXPLANATION.appendChild(whyNotSpan);
    CONTRASTIVE_EXPLANATION.appendChild(contrastiveUl);
    if (LEGAL_MOVES.length === 0) {
        return 0;
        // calculateLegalMoves((-1) * color);
        // if (LEGAL_MOVES.length === 0) {
        //     return 1;
        // }
    }
	let row, col;
	do {
		row = Math.floor(N_ROWS * Math.random());
		col = Math.floor(N_COLS * Math.random());
	} while (!LEGAL_MOVES.includes("oc-" + row + "-" + col));
	const cellId = "oc-" + row + "-" + col;
	updateLastMove(cellId);
	makeSingleMove(row, col, color);
	if (isGameOver()) {
		return 1;
	}
	return 0;
}

function makeDoubleMove(row, col, color = -1) {
    const explanationContainer = document.getElementById("explanation-text");
    explanationContainer.innerHTML = "";
    let gameOverCounter = 0;
    if (LEGAL_MOVES.length > 0) {
        makeSingleMove(row, col, color);
    } else {
        // console.log("NO LEGAL MOVES (human)");
        calculateLegalMoves(color);
        drawLegalMoves((-1) * color);
        gameOverCounter++;
    }
    if (LEGAL_MOVES.length > 0) {
        setTimeout(() => {
            const move = prudensMove((-1) * color);
        }, 500);
    } else {
        // console.log("NO LEGAL MOVES (Prudens)");
        calculateLegalMoves((-1) * color);
        drawLegalMoves(color);
        gameOverCounter++;
    }
    if (gameOverCounter === 2) {
        return;
    } else {
        gameOverCounter = 0;
    }
}

function reset() {
    const board = document.getElementById("board-container");
    board.innerHTML = "";
    const explainText = document.getElementById("explanation-text");
    explainText.innerHTML = "";
    EXPLANATION.innerHTML = "";
    CONTRASTIVE_EXPLANATION.innerHTML = "";
    initializeBoard();
}

function prudensMove(color = 1) { // Infers all legible moves according to the provided policy and then choses at random (this might need to be changed).
    if (LEGAL_MOVES.length === 0) {
        return 0;
    }
	const outObj = otDeduce();
    const output = outObj["output"];
    const inferences = outObj["inferences"].split(/\s*;\s*/).filter(Boolean);
	const suggestedMoves = [];
	// console.log("inferences:", inferences);
	for (const literal of inferences) {
        // console.log(literal.trim().substring(0, 5));
		if (literal.trim().substring(0, 5) === "move(") {
			suggestedMoves.push(literal.trim());
		}
	}
    // console.log(suggestedMoves);
	if (suggestedMoves.length === 0) {
        // randomMove();
		return randomMove(color);
	}
	const moveLiteral = suggestedMoves[Math.floor(suggestedMoves.length * Math.random())].trim();
    generateExplanation(moveLiteral, output);
    generateContrastiveExplanation(moveLiteral, output);
    // console.log("moveLiteral:", moveLiteral);
	const coords = moveLiteral.substring(5, moveLiteral.length - 1).split(",");
	const row = coords[0].trim();
	const col = coords[1].trim();
	const cellId = "oc-" + row + "-" + col;
	updateLastMove(cellId);
	if (!LEGAL_MOVES.includes(cellId)) { // Need to throw exception at this point.
        // console.log("Not legal:", LEGAL_MOVES, cellId);
		return -1;
	}
	makeSingleMove(row, col, color);
    // randomMove(1);
    // console.log(isGameOver());
	if (isGameOver()) {
		return 1;
	}
	return 0;
}

function otDeduce() {
  const kbObject = otKbParser();
  if (kbObject["type"] === "error") {
      return "ERROR: " + kbObject["name"] + ":\n" + kbObject["message"];
  }
  const warnings = kbObject["warnings"];
  const contextObject = otContextParser();
  if (contextObject["type"] === "error") {
      return "ERROR: " + contextObject["name"] + ":\n" + contextObject["message"];
  }
//   console.log(contextObject); // TODO fix some context parsing issue (in propositional cases it includes the semicolon into the name of the prop)
  const output = forwardChaining(kbObject, contextObject["context"]);
  const inferences = output["facts"];
  // console.log(graph);
  return {
    output: output,
    inferences: contextToString(inferences)
  }
}

function otKbParser() {
  const kbAll = TEST_POLICY;
  return parseKB(kbAll);
}

function otContextParser() {
  const context = extractContext();
  const contextList = parseContext(context);
  // console.log(contextList);
  if (contextList["type"] === "error") {
      return contextList;
  }
  return contextList;
}

function extractContext() { // Convert an othello board to a Prudens context.
	let coords, contextString = "";
	for (let row = 0; row < N_ROWS; row++) {
		for (let col = 0; col < N_COLS; col++) {
			contextString += "cell(" + row + "," + col + "," + BOARD[row][col] + ");";
		}
	}
    for (const cellId of LEGAL_MOVES) {
        coords = cellId.split("-");
        contextString += "legalMove(" + coords[1] + "," + coords[2] + ");";
    }
	return contextString;
}

/* Explanations */

function explain() {
    const explainText = document.getElementById("explanation-text");
    explainText.innerHTML = "";
    const explanationUl = document.createElement("ul");
    // const explanationLi = document.createElement("li");
    // const contrastiveLi = document.createElement("li");
    explanationUl.classList.add("explanation");
    if (EXPLANATION.classList.contains("active")) {
        EXPLANATION.classList.remove("active");
    }
    // contrastiveLi.innerHTML = CONTRASTIVE_EXPLANATION;
    explanationUl.appendChild(EXPLANATION);
    explanationUl.appendChild(CONTRASTIVE_EXPLANATION);
    if (CONTRASTIVE_EXPLANATION.classList.contains("active")) {
        CONTRASTIVE_EXPLANATION.classList.remove("active");
    }
    explainText.appendChild(explanationUl);
    // explainText.innerHTML = EXPLANATION + "\n" + CONTRASTIVE_EXPLANATION;
}

function generateExplanation(inference, output) {
    EXPLANATION.innerHTML = "";
    const graph = output["graph"];
    // console.log("graph:", graph);
    const crownRules = graph[inference];
    let explanations = [], currentExplanation, currentLi;
    const explanationsUl = document.createElement("ul");
    explanationsUl.classList.add("explanations-list");
    explanationsUl.classList.add("hidden");
    for (const rule of crownRules) {
        currentExplanation = TEST_DICT[rule["name"]];
        if (!explanations.includes(currentExplanation)) {
            // console.log(currentExplanation);
            currentLi = document.createElement("li");
            currentLi.innerText = currentExplanation;
            explanationsUl.appendChild(currentLi);
        }
    }
    const whySpan = document.createElement("span");
    whySpan.innerHTML = "<b>Why?</b>";
    whySpan.classList.add("why");
    whySpan.id = "why-span";
    whySpan.onmouseup = () => {showSiblings("why-span");};
    EXPLANATION.appendChild(whySpan);
    EXPLANATION.appendChild(explanationsUl);
}

function generateContrastiveExplanation(inference, output) {
    CONTRASTIVE_EXPLANATION.innerHTML = "";
    const graph = output["graph"];
    // const defeatedRules = output["defeatedRules"];
    // const crownRules = graph[inference];
    const splitInference = inference.split(/\(|\)/).filter(Boolean);
    const inferenceName = splitInference[0];
    // const infArgs = splitInference[1].split(/\s*,\s*/).filter(Boolean);
    const oppositeInferenceName = (inference[0] === "-" ? "" : "-") + inferenceName;
    const oppInfLength = oppositeInferenceName.length;
    const contrastiveUl = document.createElement("ul");
    contrastiveUl.classList.add("contrastive-explanations-list");
    contrastiveUl.classList.add("hidden");
    let splitKey, keyArgs, explanations, currentExplanation, literalLi, literalUl, explanationLi, literalSpan;
    for (const key of Object.keys(graph)) {
        if (key.substring(0, oppInfLength) !== oppositeInferenceName) {
            continue;
        }
        splitKey = key.split(/\(|\)/).filter(Boolean);
        keyArgs = splitKey[1].split(/\s*,\s*/).filter(Boolean);
        keyArgs = keyArgs.map((x) => {return parseInt(x);});
        const keyArguments = [...keyArgs];
        literalLi = document.createElement("li");
        literalLi.classList.add("literal");
        literalSpan = document.createElement("span");
        literalSpan.innerText = TEST_LITERAL_DICT[inferenceName].call(this, ...keyArgs) + "?";
        literalSpan.classList.add("contrastive-literal");
        literalSpan.id = key;
        literalSpan.onmouseup = () => {showSiblings(key);};
        literalSpan.onmouseover = () => {shadeCell(...keyArguments);};
        literalSpan.onmouseout = () => {shadeCell(...keyArguments);};
        literalLi.appendChild(literalSpan);
        literalUl = document.createElement("ul");
        literalUl.classList.add("contrastive-explanations");
        literalUl.classList.add("hidden");
        explanations = [];
        for (const rule of graph[key]) {
            currentExplanation = TEST_DICT[rule["name"]];
            if (!explanations.includes(currentExplanation)) {
                explanationLi = document.createElement("li");
                explanations.push(currentExplanation);
                explanationLi.innerText = currentExplanation;
                literalUl.appendChild(explanationLi);
            }
        }
        literalLi.appendChild(literalUl);
        contrastiveUl.appendChild(literalLi);
    }
    const whyNotSpan = document.createElement("span");
    whyNotSpan.innerHTML = "<b>Why not...</b>";
    whyNotSpan.classList.add("why");
    whyNotSpan.id = "why-not-span";
    whyNotSpan.onmouseup = () => {showSiblings("why-not-span");};
    CONTRASTIVE_EXPLANATION.appendChild(whyNotSpan);
    CONTRASTIVE_EXPLANATION.appendChild(contrastiveUl);
}

function showSiblings(id) {
    const element = document.getElementById(id);
    // console.log(element.parentElement.parentElement, element.parentElement.parentElement.classList);
    if (!element.parentElement.classList.contains("active")) {
        element.parentElement.classList.add("active");
    } else {
        element.parentElement.classList.remove("active");
    }
    const children = element.parentElement.children;
    let child;
    for (let i = 1; i < children.length; i++) {
        child = children[i];
        if (child.classList.contains("hidden")) {
            child.classList.remove("hidden");
        } else {
            child.classList.add("hidden");
        }
    }
}

function shadeCell(row, col) {
    // console.log("row:", row, "col:", col);
    // this.row = row;
    // this.col = col;
    const cell = document.getElementById("oc-" + row + "-" + col);
    if (cell.classList.contains("highlighted")) {
        cell.classList.remove("highlighted");
    } else {
        cell.classList.add("highlighted");
    }
}

/* Main */

function main() {
    initializeBoard();
    // console.log(document.getElementById("explanation-p"));
}

window.addEventListener("load", main);