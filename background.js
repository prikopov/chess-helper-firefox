/* One cancellable engine per tab. No position data leaves the browser. */
const jobs = new Map();
function cancel(tab) {
  const job = jobs.get(tab);
  if (job) {
    job.finish({ cancelled: true });
  }
}
browser.runtime.onMessage.addListener((message, sender) => {
  const tab = sender.tab?.id;
  if (tab === undefined) return;
  if (message.type === "stop") {
    cancel(tab);
    return Promise.resolve({});
  }
  if (message.type !== "analyze") return;
  cancel(tab);
  if (typeof message.fen !== "string" || message.fen.length > 150)
    return Promise.resolve({ error: "Некорректный FEN" });
  return new Promise((resolve) => {
    const worker = new Worker(
      browser.runtime.getURL("engine/stockfish-19-lite-single.js"),
    );
    let timer,
      done = false,
      lastInfo = "";
    const job = {
      finish(result) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        worker.terminate();
        if (jobs.get(tab) === job) jobs.delete(tab);
        resolve(result);
      },
    };
    jobs.set(tab, job);
    timer = setTimeout(
      () => job.finish({ error: "Движок не ответил за 15 секунд" }),
      15000,
    );
    worker.onerror = (event) =>
      job.finish({ error: event.message || "Ошибка загрузки Stockfish" });
    worker.onmessage = (event) => {
      for (const line of String(event.data).split("\n")) {
        if (line === "uciok") {
          worker.postMessage("setoption name Hash value 32");
          worker.postMessage("isready");
        } else if (line === "readyok") {
          worker.postMessage("position fen " + message.fen);
          worker.postMessage(
            "go movetime " +
              Math.max(300, Math.min(5000, Number(message.ms) || 1200)),
          );
        } else if (line.startsWith("info ") && line.includes(" pv "))
          lastInfo = line;
        else if (line.startsWith("bestmove "))
          job.finish({ move: line.split(" ")[1], info: lastInfo });
      }
    };
    worker.postMessage("uci");
  });
});
browser.tabs.onRemoved.addListener(cancel);
