// Unicode symbols for pieces
const PIECE_UNICODES = {
    'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
    'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
};

const BOARD_SIZE = 8;

class Piece {
    constructor(type, color) {
        this.type = type; // K, Q, R, B, N, P
        this.color = color; // 'w' or 'b'
        this.hasMoved = false; // For castling & pawn moves
    }

    get symbol() {
        return PIECE_UNICODES[this.color + this.type];
    }
}

class Board {
    constructor() {
        this.grid = this.createStartBoard();
        this.enPassant = null; // {x, y}
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;
    }

    createStartBoard() {
        // Empty 8x8
        let grid = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        let back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

        // Put black pieces
        for (let i = 0; i < 8; i++) {
            grid[0][i] = new Piece(back[i], 'b');
            grid[1][i] = new Piece('P', 'b');
        }
        // Put white pieces
        for (let i = 0; i < 8; i++) {
            grid[7][i] = new Piece(back[i], 'w');
            grid[6][i] = new Piece('P', 'w');
        }
        // Rest empty
        return grid;
    }

    inBounds(x, y) {
        return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
    }

    getPiece(x, y) {
        if (!this.inBounds(x, y)) return null;
        return this.grid[x][y];
    }

    setPiece(x, y, piece) {
        this.grid[x][y] = piece;
    }

    clone() {
        let b = new Board();
        b.grid = this.grid.map(row => row.map(piece => piece ? Object.assign(new Piece(), piece) : null));
        b.enPassant = this.enPassant ? { ...this.enPassant } : null;
        b.halfmoveClock = this.halfmoveClock;
        b.fullmoveNumber = this.fullmoveNumber;
        return b;
    }

    findKing(color) {
        for (let x = 0; x < 8; x++)
            for (let y = 0; y < 8; y++) {
                let p = this.getPiece(x, y);
                if (p && p.type === 'K' && p.color === color) return { x, y };
            }
        return null;
    }

    isAttacked(x, y, attackerColor) {
        // Brute force: For all pieces of attackerColor, see if can move to (x, y)
        for (let i = 0; i < 8; i++)
            for (let j = 0; j < 8; j++) {
                let p = this.getPiece(i, j);
                if (p && p.color === attackerColor) {
                    let moves = generateRawMoves(this, i, j, true);
                    for (let m of moves) if (m.x === x && m.y === y) return true;
                }
            }
        return false;
    }
}

// Generates ALL possible moves for a piece (not checking king safety).
function generateRawMoves(board, x, y, forAttack = false) {
    let p = board.getPiece(x, y);
    if (!p) return [];
    let moves = [];
    const color = p.color, opp = color === 'w' ? 'b' : 'w';

    switch (p.type) {
        case 'P': {
            let dir = (color === 'w') ? -1 : 1;
            // Forward move
            let nx = x + dir;
            if (board.inBounds(nx, y) && !board.getPiece(nx, y) && !forAttack) {
                moves.push({ x: nx, y: y, special: '' });
                // First double step
                if ((color === 'w' && x === 6) || (color === 'b' && x === 1)) {
                    let nnx = x + dir * 2;
                    if (board.inBounds(nnx, y) && !board.getPiece(nnx, y))
                        moves.push({ x: nnx, y: y, special: 'double' });
                }
            }
            // Captures
            for (let dy of [-1, 1]) {
                let nx2 = x + dir, ny2 = y + dy;
                if (board.inBounds(nx2, ny2)) {
                    let capture = board.getPiece(nx2, ny2);
                    if (capture && capture.color === opp)
                        moves.push({ x: nx2, y: ny2, special: '' });
                }
            }
            // En passant
            if (board.enPassant && Math.abs(board.enPassant.x - x) === 0 && Math.abs(board.enPassant.y - y) === 1 && x + dir === board.enPassant.x && board.enPassant.y === y + (board.enPassant.y - y)) {
                moves.push({ x: board.enPassant.x, y: board.enPassant.y, special: 'enpassant' });
            }
            // Promotions (handled during move)
            break;
        }
        case 'N': {
            let dirs = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
            for (let [dx, dy] of dirs) {
                let nx = x + dx, ny = y + dy;
                if (!board.inBounds(nx, ny)) continue;
                let target = board.getPiece(nx, ny);
                if (!target || target.color !== color)
                    moves.push({ x: nx, y: ny, special: '' });
            }
            break;
        }
        case 'B':
        case 'R':
        case 'Q': {
            let dirs = [];
            if (p.type === 'B' || p.type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
            if (p.type === 'R' || p.type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
            for (let [dx, dy] of dirs) {
                let nx = x + dx, ny = y + dy;
                while (board.inBounds(nx, ny)) {
                    let target = board.getPiece(nx, ny);
                    if (!target) {
                        moves.push({ x: nx, y: ny, special: '' });
                    } else {
                        if (target.color !== color)
                            moves.push({ x: nx, y: ny, special: '' });
                        break;
                    }
                    nx += dx;
                    ny += dy;
                }
            }
            break;
        }
        case 'K': {
            let dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
            for (let [dx, dy] of dirs) {
                let nx = x + dx, ny = y + dy;
                if (!board.inBounds(nx, ny)) continue;
                let target = board.getPiece(nx, ny);
                if (!target || target.color !== color)
                    moves.push({ x: nx, y: ny, special: '' });
            }
            // Castling
            if (!p.hasMoved && !forAttack) {
                // King side
                if (canCastle(board, x, y, 'K', color))
                    moves.push({ x: x, y: y + 2, special: 'castleK' });
                // Queen side
                if (canCastle(board, x, y, 'Q', color))
                    moves.push({ x: x, y: y - 2, special: 'castleQ' });
            }
            break;
        }
    }
    return moves;
}

// Check if castling is possible
function canCastle(board, x, y, side, color) {
    // x = row, y = column
    if ((color === 'w' && x !== 7) || (color === 'b' && x !== 0)) return false;
    let row = x;
    let yKing = y;
    if (side === 'K') {
        let rook = board.getPiece(row, 7);
        if (!rook || rook.type !== 'R' || rook.color !== color || rook.hasMoved) return false;
        // Squares between king and rook must be empty
        if (board.getPiece(row, 5) || board.getPiece(row, 6)) return false;
        // Squares king passes through must not be attacked
        for (let col of [4, 5, 6])
            if (board.isAttacked(row, col, color === 'w' ? 'b' : 'w')) return false;
        return true;
    } else {
        let rook = board.getPiece(row, 0);
        if (!rook || rook.type !== 'R' || rook.color !== color || rook.hasMoved) return false;
        if (board.getPiece(row, 1) || board.getPiece(row, 2) || board.getPiece(row, 3)) return false;
        for (let col of [2, 3, 4])
            if (board.isAttacked(row, col, color === 'w' ? 'b' : 'w')) return false;
        return true;
    }
}

// Generate ONLY legal moves, i.e., not leaving own king in check
function generateLegalMoves(board, x, y) {
    let piece = board.getPiece(x, y);
    if (!piece) return [];
    let rawMoves = generateRawMoves(board, x, y);
    let legalMoves = [];
    for (let move of rawMoves) {
        let testBoard = board.clone();
        makeMove(testBoard, x, y, move.x, move.y, move.special, null, false);
        let king = testBoard.findKing(piece.color);
        if (king && !testBoard.isAttacked(king.x, king.y, piece.color === 'w' ? 'b' : 'w')) {
            legalMoves.push(move);
        }
    }
    return legalMoves;
}

// Actually make the move on the board (used for both UI and move testing)
function makeMove(board, x1, y1, x2, y2, special = '', promotion = null, updateFlags = true) {
    let piece = board.getPiece(x1, y1);
    if (!piece) return false;
    // Pawn promotion
    let isPromotion = piece.type === 'P' && (x2 === 0 || x2 === 7);
    let movePiece = piece;
    if (isPromotion && promotion) {
        movePiece = new Piece(promotion, piece.color);
        movePiece.hasMoved = true;
    }
    // En passant
    if (special === 'enpassant') {
        let dir = piece.color === 'w' ? 1 : -1;
        board.setPiece(x2 + dir, y2, null);
    }
    // Castling
    if (special === 'castleK') {
        // King side
        board.setPiece(x2, y2 - 1, board.getPiece(x2, 7));
        board.setPiece(x2, 7, null);
        board.getPiece(x2, y2 - 1).hasMoved = true;
    }
    if (special === 'castleQ') {
        // Queen side
        board.setPiece(x2, y2 + 1, board.getPiece(x2, 0));
        board.setPiece(x2, 0, null);
        board.getPiece(x2, y2 + 1).hasMoved = true;
    }
    // Move the piece
    board.setPiece(x1, y1, null);
    board.setPiece(x2, y2, movePiece);
    if (updateFlags) {
        movePiece.hasMoved = true;
        // Handle en passant
        board.enPassant = null;
        if (piece.type === 'P' && Math.abs(x2 - x1) === 2) {
            board.enPassant = { x: (x1 + x2) / 2, y: y1 };
        }
        // Halfmove clock
        if (piece.type === 'P' || board.getPiece(x2, y2))
            board.halfmoveClock = 0;
        else
            board.halfmoveClock++;
        // Fullmove number
        if (piece.color === 'b')
            board.fullmoveNumber++;
    }
    return true;
}

// Check for check, checkmate, stalemate
function checkGameStatus(board, currentTurn) {
    let kingPos = board.findKing(currentTurn);
    let inCheck = kingPos && board.isAttacked(kingPos.x, kingPos.y, currentTurn === 'w' ? 'b' : 'w');
    // Any legal moves?
    let anyLegal = false;
    for (let x = 0; x < 8; x++)
        for (let y = 0; y < 8; y++) {
            let p = board.getPiece(x, y);
            if (p && p.color === currentTurn && generateLegalMoves(board, x, y).length)
                anyLegal = true;
        }
    if (inCheck && !anyLegal) return 'checkmate';
    if (!inCheck && !anyLegal) return 'stalemate';
    if (inCheck) return 'check';
    return null;
}

// ================= UI & Game ===================
class ChessGame {
    constructor() {
        this.board = new Board();
        this.turn = 'w'; // 'w' or 'b'
        this.selected = null; // {x, y}
        this.legalMoves = [];
        this.isDragging = false;
        this.dragFrom = null;
        this.initBoard();
        this.render();
        this.updateTurnIndicator();
        this.message('');
    }

    initBoard() {
        const boardDiv = document.getElementById('chessboard');
        boardDiv.innerHTML = '';
        for (let x = 0; x < 8; x++)
            for (let y = 0; y < 8; y++) {
                let sq = document.createElement('div');
                sq.className = `square ${(x + y) % 2 === 0 ? 'white' : 'black'}`;
                sq.dataset.x = x;
                sq.dataset.y = y;
                // Drag and Drop events
                sq.draggable = false;
                sq.addEventListener('mousedown', (e) => this.onSquareMouseDown(e, x, y));
                sq.addEventListener('mouseup', (e) => this.onSquareMouseUp(e, x, y));
                sq.addEventListener('mouseover', (e) => this.onSquareMouseOver(e, x, y));
                sq.addEventListener('mouseleave', (e) => this.onSquareMouseLeave(e, x, y));
                sq.addEventListener('click', (e) => this.onSquareClick(e, x, y));
                boardDiv.appendChild(sq);
            }
        // Mouse move for drag
        document.addEventListener('mousemove', (e) => this.onDocumentMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onDocumentMouseUp(e));
    }

    render() {
        for (let x = 0; x < 8; x++)
            for (let y = 0; y < 8; y++) {
                let sq = document.querySelector(`.square[data-x="${x}"][data-y="${y}"]`);
                sq.innerHTML = '';
                sq.classList.remove('highlight', 'selected', 'dragover');
                let p = this.board.getPiece(x, y);
                if (p) {
                    let el = document.createElement('span');
                    el.className = 'piece';
                    el.textContent = p.symbol;
                    sq.appendChild(el);
                }
            }
        if (this.selected) {
            let { x, y } = this.selected;
            let sq = document.querySelector(`.square[data-x="${x}"][data-y="${y}"]`);
            sq.classList.add('selected');
            for (let move of this.legalMoves) {
                let sq2 = document.querySelector(`.square[data-x="${move.x}"][data-y="${move.y}"]`);
                if (sq2) sq2.classList.add('highlight');
            }
        }
    }

    updateTurnIndicator() {
        document.getElementById('turn-indicator').textContent = "Turn: " + (this.turn === 'w' ? 'White' : 'Black');
    }

    message(msg) {
        document.getElementById('message').textContent = msg;
    }

    onSquareClick(e, x, y) {
        let p = this.board.getPiece(x, y);
        if (this.selected) {
            // If click on highlighted move, move
            if (this.legalMoves.some(m => m.x === x && m.y === y)) {
                this.doMove(this.selected.x, this.selected.y, x, y, this.legalMoves.find(m => m.x === x && m.y === y).special);
                this.selected = null;
                this.legalMoves = [];
                this.render();
                return;
            }
            // Deselect or select another own piece
            if (p && p.color === this.turn) {
                this.selected = { x, y };
                this.legalMoves = generateLegalMoves(this.board, x, y);
                this.render();
                return;
            }
            // Else, deselect
            this.selected = null;
            this.legalMoves = [];
            this.render();
            return;
        }
        // Select own piece
        if (p && p.color === this.turn) {
            this.selected = { x, y };
            this.legalMoves = generateLegalMoves(this.board, x, y);
            this.render();
        }
    }

    onSquareMouseDown(e, x, y) {
        // Drag only if own piece and not empty
        let p = this.board.getPiece(x, y);
        if (p && p.color === this.turn) {
            this.isDragging = true;
            this.dragFrom = { x, y };
            this.selected = { x, y };
            this.legalMoves = generateLegalMoves(this.board, x, y);
            this.render();
        }
    }

    onDocumentMouseMove(e) {
        if (!this.isDragging || !this.dragFrom) return;
        // Show dragover highlights for legal moves
        let boardDiv = document.getElementById('chessboard');
        let rect = boardDiv.getBoundingClientRect();
        let ex = e.clientX - rect.left, ey = e.clientY - rect.top;
        let cellSize = rect.width / 8;
        let x = Math.floor(ey / cellSize), y = Math.floor(ex / cellSize);
        for (let i = 0; i < 8; i++)
            for (let j = 0; j < 8; j++)
                document.querySelector(`.square[data-x="${i}"][data-y="${j}"]`).classList.remove('dragover');
        if (this.legalMoves.some(m => m.x === x && m.y === y)) {
            let sq = document.querySelector(`.square[data-x="${x}"][data-y="${y}"]`);
            if (sq) sq.classList.add('dragover');
        }
    }

    onDocumentMouseUp(e) {
        if (!this.isDragging || !this.dragFrom) return;
        let boardDiv = document.getElementById('chessboard');
        let rect = boardDiv.getBoundingClientRect();
        let ex = e.clientX - rect.left, ey = e.clientY - rect.top;
        let cellSize = rect.width / 8;
        let x = Math.floor(ey / cellSize), y = Math.floor(ex / cellSize);
        if (x >= 0 && x < 8 && y >= 0 && y < 8 && this.legalMoves.some(m => m.x === x && m.y === y)) {
            this.doMove(this.dragFrom.x, this.dragFrom.y, x, y, this.legalMoves.find(m => m.x === x && m.y === y).special);
        }
        this.isDragging = false;
        this.dragFrom = null;
        this.selected = null;
        this.legalMoves = [];
        this.render();
    }

    onSquareMouseUp(e, x, y) {
        // Not needed for now, handled globally
    }
    onSquareMouseOver(e, x, y) { /* Optional: hover effect */ }
    onSquareMouseLeave(e, x, y) { /* Optional: hover effect */ }

    doMove(x1, y1, x2, y2, special = '') {
        let piece = this.board.getPiece(x1, y1);
        let promotion = null;
        // Pawn promotion
        if (piece.type === 'P' && (x2 === 0 || x2 === 7)) {
            promotion = prompt('Promosi ke (Q, R, B, N):', 'Q');
            if (!['Q', 'R', 'B', 'N'].includes(promotion)) promotion = 'Q';
        }
        makeMove(this.board, x1, y1, x2, y2, special, promotion, true);
        // After move, check status
        this.turn = this.turn === 'w' ? 'b' : 'w';
        this.updateTurnIndicator();
        let status = checkGameStatus(this.board, this.turn);
        if (status === 'checkmate') {
            this.message('Skakmat! ' + (this.turn === 'w' ? 'Hitam' : 'Putih') + ' kalah.');
        } else if (status === 'stalemate') {
            this.message('Stalemate! Permainan seri.');
        } else if (status === 'check') {
            this.message('Skak!');
        } else {
            this.message('');
        }
    }
}

window.onload = () => {
    new ChessGame();
};