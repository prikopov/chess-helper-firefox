import { Tracker, Chess, placement, readPlacement } from "./tracker.js";
import { createPanel } from "./panel.js";
import { playMove, choosePromotion } from "./auto-move.js";
import { MoveDelay, moveDelay } from "./move-delay.js";
(() => {
  if (document.getElementById("chess-experiment-panel")) return;
  const root = createPanel();
  const $ = (id) => root.getElementById(id);
  const tracker = new Tracker();
  const delayedMove = new MoveDelay();
  let enabled = false;
  let board = null;
  let lastSample = null;
  let stableSince = 0;
  let currentKey = "";
  let generation = 0;
  let marks = [];
  let hintMove = null;
  let geometry = "";
  let pendingMove = null;
  let attemptedFen = "";
  let autoSide = null;
  let hiddenSince = document.hidden ? Date.now() : null;

  function findBoard() {
    return [
      ...document.querySelectorAll("wc-chess-board, chess-board, .board"),
    ].find(
      (node) =>
        node.querySelector(".piece") &&
        node.getBoundingClientRect().width > 100,
    );
  }

  function boardSide(candidate = board) {
    if (
      !candidate?.isConnected ||
      !candidate.matches("wc-chess-board, chess-board")
    )
      return null;
    return candidate.closest(".flipped") ? "b" : "w";
  }

  function updateSideLabel(candidate = board) {
    const side = $("side").value === "auto" && autoSide ? autoSide : boardSide(candidate);
    const label =
      side === "w" ? "Авто · белые" : side === "b" ? "Авто · чёрные" : "Авто";
    if ($("auto-side").textContent !== label)
      $("auto-side").textContent = label;
  }

  function stopAuto(message = "") {
    delayedMove.cancel();
    $("auto").checked = false;
    pendingMove = null;
    autoSide = null;
    updateSideLabel();
    $("status").textContent = message;
  }

  function autoMove(move, fen) {
    if (
      !enabled ||
      document.hidden ||
      !$("auto").checked ||
      pendingMove ||
      delayedMove.pending ||
      attemptedFen === fen
    )
      return;
    if (tracker.chess.turn() !== autoSide) return;
    if (!board?.isConnected || readPlacement(board) !== fen.split(" ")[0])
      return;
    const targetBoard = board;
    const id = generation;
    delayedMove.schedule(
      moveDelay($("tempo").value),
      () =>
        enabled &&
        !document.hidden &&
        $("auto").checked &&
        id === generation &&
        board === targetBoard &&
        targetBoard.isConnected &&
        tracker.chess.fen() === fen &&
        tracker.chess.turn() === autoSide &&
        readPlacement(targetBoard) === fen.split(" ")[0],
      () => {
        attemptedFen = fen;
        pendingMove = {
          fen,
          move,
          board: targetBoard,
          started: Date.now(),
          promoted: false,
        };
        try {
          playMove(targetBoard, move);
        } catch (error) {
          stopAuto(error.message);
        }
      },
    );
  }
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
    delayedMove.cancel();
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
      stopAuto();
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
      autoMove(move, fen);
    } catch (error) {
      if (id === generation) {
        $("status").textContent = error.message;
        currentKey = "";
      }
    }
  }
  $("toggle").onclick = () => {
    enabled = !enabled;
    if (!enabled) stopAuto();
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
    if (!$("drawer").hidden) updateSideLabel(findBoard());
  };
  $("time").onchange = () => invalidate();
  $("tempo").onchange = () => invalidate();
  $("auto").onchange = () => {
    pendingMove = null;
    attemptedFen = "";
    invalidate();
    autoSide = null;
    if ($("auto").checked) {
      const selected = $("side").value;
      autoSide = selected === "auto" ? boardSide(findBoard()) : selected;
      if (!autoSide) stopAuto("Выбери сторону");
    }
    updateSideLabel();
  };
  $("side").onchange = () => {
    stopAuto();
    invalidate();
  };
  $("sync").onclick = () => {
    try {
      const candidate = new Chess($("fen").value.trim());
      if (!board || readPlacement(board) !== placement(candidate))
        throw new Error("FEN не совпадает");
      tracker.sync(candidate.fen());
      stopAuto();
      attemptedFen = "";
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
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) stopAuto();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenSince ??= Date.now();
      if (enabled) {
        invalidate();
        if ($("auto").checked) $("status").textContent = "Пауза";
      }
      return;
    }
    if (hiddenSince === null) return;
    const now = Date.now();
    // Time spent hidden doesn't count toward verifying a submitted move.
    if (pendingMove) pendingMove.started += now - hiddenSince;
    hiddenSince = null;
    stableSince = now;
    if ($("status").textContent === "Пауза") $("status").textContent = "";
  });
  window.addEventListener("scroll", clearMarks, true);
  function tick() {
    if (!enabled || document.hidden || hiddenSince !== null) return;
    const nextBoard = findBoard();
    if (!nextBoard) {
      stopAuto("Нет доски");
      if (board) invalidate();
      board = null;
      updateSideLabel();
      $("status").textContent = "Нет доски";
      return;
    }
    if (nextBoard !== board) {
      if (board) stopAuto();
      board = nextBoard;
      invalidate();
      lastSample = null;
    }
    updateSideLabel();
    if (hintMove) {
      const rect = board.getBoundingClientRect(),
        flipped =
          board.classList.contains("flipped") || !!board.closest(".flipped");
      const nextGeometry = `${rect.left},${rect.top},${rect.width},${rect.height},${flipped}`;
      if (!marks.length || nextGeometry !== geometry) draw(hintMove);
    }
    let sample = readPlacement(board);
    if (pendingMove) {
      const pending = pendingMove;
      if (pending.board !== board) {
        stopAuto("Доска изменилась");
        return;
      }
      if (pending.move.promotion && !pending.promoted) {
        pending.promoted = choosePromotion(
          board,
          pending.move.color,
          pending.move.promotion,
        );
        sample = readPlacement(board);
      }
      // A promotion can temporarily leave an unpromoted pawn on the last rank.
      if (
        !sample ||
        sample === pending.fen.split(" ")[0] ||
        (pending.move.promotion &&
          !pending.promoted &&
          board.querySelector(
            ".promotion-window, .promotion-menu, .promotion-piece",
          ))
      ) {
        if (Date.now() - pending.started > 3000) stopAuto("Ход не принят");
        return;
      }
    }
    if (sample !== lastSample) {
      lastSample = sample;
      stableSince = Date.now();
      invalidate();
    }
    if (!sample || Date.now() - stableSince < 180) return;
    const result = tracker.update(sample);
    if (result === "desync") {
      stopAuto();
      $("status").textContent = "Нужен FEN";
      return;
    }
    if (pendingMove && result !== "same") {
      const accepted = tracker.chess
        .history({ verbose: true })
        .some(
          (move) =>
            move.before === pendingMove.fen &&
            move.from === pendingMove.move.from &&
            move.to === pendingMove.move.to &&
            move.promotion === pendingMove.move.promotion,
        );
      if (!accepted) stopAuto("Позиция изменилась");
      pendingMove = null;
    }
    if (result === "reset") {
      stopAuto();
      attemptedFen = "";
    }
    analyze();
  }

  setInterval(tick, 300);
})();
