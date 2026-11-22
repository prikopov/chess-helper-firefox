import { Chess } from "./vendor/chess.js";
export { Chess };
export const placement = (chess) => chess.fen().split(" ")[0];
export class Tracker {
  constructor(fen) {
    this.chess = new Chess(fen);
  }
  sync(fen) {
    this.chess = new Chess(fen);
  }
  update(target) {
    if (target === placement(this.chess)) return "same";
    if (target === placement(new Chess())) {
      this.chess = new Chess();
      return "reset";
    }
    // A fast reply by a bot may make two plies appear between DOM samples.
    const paths = [];
    for (const move of this.chess.moves()) {
      this.chess.move(move);
      if (placement(this.chess) === target) paths.push([move]);
      this.chess.undo();
    }
    if (!paths.length) {
      for (const first of this.chess.moves()) {
        this.chess.move(first);
        for (const second of this.chess.moves()) {
          this.chess.move(second);
          if (placement(this.chess) === target) paths.push([first, second]);
          this.chess.undo();
        }
        this.chess.undo();
      }
    }
    if (paths.length !== 1) return "desync";
    for (const move of paths[0]) this.chess.move(move);
    return "move";
  }
}
export function readPlacement(board) {
  const squares = new Map();
  for (const node of board.querySelectorAll(".piece")) {
    const piece = [...node.classList].find((c) => /^[wb][prnbqk]$/.test(c));
    const square = [...node.classList].find((c) =>
      /^square-[1-8][1-8]$/.test(c),
    );
    if (!piece || !square) return null;
    const key = square.slice(7);
    if (squares.has(key)) return null; // Animation/capture in progress.
    squares.set(key, piece[0] === "w" ? piece[1].toUpperCase() : piece[1]);
  }
  if (
    ![...squares.values()].includes("K") ||
    ![...squares.values()].includes("k")
  )
    return null;
  return Array.from({ length: 8 }, (_, row) => {
    let rank = "",
      empty = 0;
    for (let file = 1; file <= 8; file++) {
      const piece = squares.get(`${file}${8 - row}`);
      if (!piece) empty++;
      else {
        if (empty) rank += empty;
        empty = 0;
        rank += piece;
      }
    }
    return rank + (empty || "");
  }).join("/");
}
