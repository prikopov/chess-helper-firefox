export function createPanel() {
  const host = document.createElement("div");
  host.id = "chess-experiment-panel";
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 228px; color: #e8e8e8; font: 13px/1.4 system-ui; }
      * { box-sizing: border-box; }
      section { padding: 10px; background: #202020; border: 1px solid #414141; border-radius: 9px; box-shadow: 0 4px 16px #0003; }
      .row { display: flex; align-items: center; gap: 9px; }
      button, select, input { color: inherit; font: inherit; background: #292929; border: 1px solid #464646; border-radius: 5px; }
      button { min-width: 28px; height: 28px; padding: 0 7px; cursor: pointer; }
      button:hover { background: #383838; }
      button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #a5c784; outline-offset: 2px; }
      #toggle { border: 0; background: transparent; color: #aaa; }
      #toggle[aria-pressed="true"] { color: #b5d690; }
      #move { flex: 1; white-space: nowrap; font-size: 19px; font-weight: 500; font-variant-numeric: tabular-nums; }
      #score { color: #aaa; font-size: 12px; font-variant-numeric: tabular-nums; }
      #settings { border: 0; background: transparent; font-size: 19px; }
      #status { margin: 6px 3px 0; color: #aaa; font-size: 12px; }
      #status:empty { display: none; }
      #drawer { margin-top: 10px; padding-top: 10px; border-top: 1px solid #383838; }
      #drawer[hidden] { display: none; }
      #drawer .row { justify-content: space-between; }
      label { color: #aaa; }
      select { padding: 4px; }
      input { width: 100%; margin: 8px 0; padding: 6px; }
      input[type="checkbox"] { width: auto; margin: 0; accent-color: #b5d690; }
      #drawer .row + .row { margin-top: 8px; }
    </style>
    <section aria-label="Stockfish">
      <div class="row">
        <button id="toggle" aria-label="Включить анализ" title="Включить анализ" aria-pressed="false">▶</button>
        <div id="move">—</div>
        <span id="score"></span>
        <button id="settings" aria-label="Настройки" title="Настройки" aria-expanded="false">⋯</button>
      </div>
      <div id="status" role="status"></div>
      <div id="drawer" hidden>
        <div class="row">
          <label for="auto">Автоход</label>
          <input id="auto" type="checkbox" role="switch">
        </div>
        <div class="row">
          <label for="side">Сторона</label>
          <select id="side">
            <option id="auto-side" value="auto" selected>Авто</option>
            <option value="w">Белые</option>
            <option value="b">Чёрные</option>
          </select>
        </div>
        <div class="row">
          <label for="time">Анализ</label>
          <select id="time">
            <option value="600">0,6 с</option>
            <option value="1200" selected>1,2 с</option>
            <option value="3000">3 с</option>
          </select>
        </div>
        <div class="row">
          <label for="tempo">Темп</label>
          <select id="tempo" title="Пауза после анализа">
            <option value="off">Без паузы</option>
            <option value="fast">Быстрый</option>
            <option value="normal" selected>Обычный</option>
            <option value="slow">Спокойный</option>
          </select>
        </div>
        <input id="fen" placeholder="FEN" aria-label="Полный FEN" spellcheck="false">
        <div class="row">
          <button id="sync" title="Применить FEN" aria-label="Применить FEN">↵</button>
          <button id="copy" title="Копировать FEN" aria-label="Копировать FEN">⧉</button>
        </div>
      </div>
    </section>`;

  document.documentElement.appendChild(host);
  return root;
}
