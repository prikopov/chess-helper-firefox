function squareCenter(board, square) {
  const rect = board.getBoundingClientRect();
  const flipped = !!board.closest(".flipped");
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return {
    x: rect.left + (((flipped ? 7 - file : file) + 0.5) * rect.width) / 8,
    y: rect.top + (((flipped ? rank : 7 - rank) + 0.5) * rect.height) / 8,
  };
}

function targetAt(board, point) {
  const target = document.elementFromPoint(point.x, point.y);
  if (!target || (target !== board && !board.contains(target))) {
    throw new Error("Доска перекрыта");
  }
  return target;
}

function mouse(target, type, point, buttons = 0) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: point.x,
      clientY: point.y,
      button: 0,
      buttons,
    }),
  );
}

function click(target, point) {
  const pointer = (type, buttons) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: point.x,
        clientY: point.y,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
  pointer("pointerdown", 1);
  mouse(target, "mousedown", point, 1);
  pointer("pointerup", 0);
  mouse(target, "mouseup", point);
  mouse(target, "click", point);
}

export function playMove(board, move) {
  const from = squareCenter(board, move.from);
  const to = squareCenter(board, move.to);
  // Check both squares before selecting a piece.
  const source = targetAt(board, from);
  targetAt(board, to);
  click(source, from);
  click(targetAt(board, to), to);
}

export function choosePromotion(board, color, piece) {
  const candidates = document.querySelectorAll(
    ".promotion-window .piece, .promotion-piece, .promotion-menu .piece",
  );
  const choice = [...candidates].find((node) => {
    const rect = node.getBoundingClientRect();
    return (
      node.classList.contains(color + piece) &&
      rect.width &&
      rect.height &&
      (board.contains(node) ||
        node.closest(".promotion-window, .promotion-menu"))
    );
  });
  if (!choice) return false;
  const rect = choice.getBoundingClientRect();
  const point = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const target = document.elementFromPoint(point.x, point.y);
  if (target !== choice && !choice.contains(target)) return false;
  click(choice, point);
  return true;
}
