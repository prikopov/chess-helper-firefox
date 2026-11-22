import { Tracker, Chess, placement, readPlacement } from "./tracker.js";
import { createPanel } from "./panel.js";
(() => {
  if (document.getElementById("chess-experiment-panel")) return;
  const root = createPanel();
  const $ = (id) => root.getElementById(id);
  const tracker = new Tracker();
  let enabled = false;
  let board = null;
  let lastSample = null;
  let stableSince = 0;
  let currentKey = "";
  let generation = 0;
  let marks = [];
  let hintMove = null;
  let geometry = "";
  function clearMarks() {
    for (const mark of marks) mark.remove();
    marks = [];
  }
  function clearResult() {
    hintMove = null;
    $("move").textContent = "—";
    $("score").textContent = "";
    $("move").title = "";
    $("score").title = "";
    clearMarks();
  }
  function invalidate() {
    generation++;
    currentKey = "";
    clearResult();
    browser.runtime.sendMessage({ type: "stop" }).catch(() => {});
  }
  function draw(move) {
    clearMarks();
    if (!board) return;
    hintMove = move;
    const rect = board.getBoundingClientRect();
    const flipped =
      board.classList.contains("flipped") || !!board.closest(".flipped");
    geometry = `${rect.left},${rect.top},${rect.width},${rect.height},${flipped}`;
    for (const [index, square] of [
      move.slice(0, 2),
      move.slice(2, 4),
    ].entries()) {
      let x = square.charCodeAt(0) - 97,
        y = 8 - Number(square[1]);
      if (flipped) {
        x = 7 - x;
        y = 7 - y;
      }
      const mark = document.createElement("div");
      Object.assign(mark.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "2147483646",
        left: `${rect.left + (x * rect.width) / 8}px`,
        top: `${rect.top + (y * rect.height) / 8}px`,
        width: `${rect.width / 8}px`,
        height: `${rect.height / 8}px`,
        boxSizing: "border-box",
        border: `5px solid ${index ? "#9bea62" : "#ffd461"}`,
        background: index ? "#9bea6233" : "#ffd46122",
      });
      document.documentElement.appendChild(mark);
      marks.push(mark);
    }
  }
  async function analyze() {
    const fen = tracker.chess.fen();
    if (currentKey === fen) return;
    currentKey = fen;
    const id = ++generation;
    clearResult();
    if (tracker.chess.isGameOver()) {
      $("status").textContent = tracker.chess.isCheckmate() ? "Мат" : "Ничья";
      return;
    }
    $("status").textContent = "…";
    try {
      const result = await browser.runtime.sendMessage({
        type: "analyze",
        fen,
        ms: Number($("time").value),
      });
      if (!enabled || id !== generation) return;
      if (result?.error) throw new Error(result.error);
      if (!result?.move || result.cancelled) return;
      const chess = new Chess(fen),
        move = chess.move({
          from: result.move.slice(0, 2),
          to: result.move.slice(2, 4),
          promotion: result.move[4],
        });
      if (!move) throw new Error("Движок вернул нелегальный ход");
      $("move").textContent =
        `${move.from}–${move.to}${move.promotion ? " = " + move.promotion.toUpperCase() : ""}`;
      const score = result.info.match(/score (cp|mate) (-?\d+)/),
        depth = result.info.match(/\bdepth (\d+)/);
      if (score) {
        const value =
          Number(score[2]) * (tracker.chess.turn() === "w" ? 1 : -1);
        const sign = value >= 0 ? "+" : "";
        $("score").textContent =
          score[1] === "mate"
            ? `M${sign}${value}`
            : `${sign}${(value / 100).toFixed(2)}`;
        $("score").title = `За белых${depth ? ` · глубина ${depth[1]}` : ""}`;
      }
      $("move").title =
        `${tracker.chess.turn() === "w" ? "Белые" : "Чёрные"} · ${move.san}`;
      $("status").textContent = "";
      draw(result.move);
    } catch (error) {
      if (id === generation) {
        $("status").textContent = error.message;
        currentKey = "";
      }
    }
  }
  $("toggle").onclick = () => {
    enabled = !enabled;
    invalidate();
    const label = enabled ? "Выключить анализ" : "Включить анализ";
    $("toggle").textContent = enabled ? "Ⅱ" : "▶";
    $("toggle").title = label;
    $("toggle").setAttribute("aria-label", label);
    $("toggle").setAttribute("aria-pressed", String(enabled));
    $("status").textContent = "";
  };
  $("settings").onclick = () => {
    $("drawer").hidden = !$("drawer").hidden;
    $("settings").setAttribute("aria-expanded", String(!$("drawer").hidden));
  };
  $("time").onchange = () => invalidate();
  $("sync").onclick = () => {
    try {
      const candidate = new Chess($("fen").value.trim());
      if (!board || readPlacement(board) !== placement(candidate))
        throw new Error("FEN не совпадает");
      tracker.sync(candidate.fen());
      invalidate();
      $("status").textContent = "";
    } catch (e) {
      $("status").textContent = e.message;
    }
  };
  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(tracker.chess.fen());
      $("status").textContent = "Скопировано";
    } catch {
      $("fen").value = tracker.chess.fen();
      $("fen").select();
    }
  };
  $("fen").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("sync").click();
  });
  window.addEventListener("resize", clearMarks);
  window.addEventListener("scroll", clearMarks, true);
  function tick() {
    if (!enabled) return;
    const nextBoard = [
      ...document.querySelectorAll("wc-chess-board, chess-board, .board"),
    ].find(
      (b) => b.querySelector(".piece") && b.getBoundingClientRect().width > 100,
    );
    if (!nextBoard) {
      if (board) invalidate();
      board = null;
      $("status").textContent = "Нет доски";
      return;
    }
    if (nextBoard !== board) {
      board = nextBoard;
      invalidate();
      lastSample = null;
    }
    if (hintMove) {
      const rect = board.getBoundingClientRect(),
        flipped =
          board.classList.contains("flipped") || !!board.closest(".flipped");
      const nextGeometry = `${rect.left},${rect.top},${rect.width},${rect.height},${flipped}`;
      if (!marks.length || nextGeometry !== geometry) draw(hintMove);
    }
    const sample = readPlacement(board);
    if (sample !== lastSample) {
      lastSample = sample;
      stableSince = Date.now();
      invalidate();
    }
    if (!sample || Date.now() - stableSince < 180) return;
    const result = tracker.update(sample);
    if (result === "desync") {
      $("status").textContent = "Нужен FEN";
      return;
    }
    analyze();
  }

  setInterval(tick, 300);
})();
