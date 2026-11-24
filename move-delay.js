const ranges = {
  fast: [300, 900],
  normal: [800, 2400],
  slow: [1500, 4500],
};

export function moveDelay(tempo, random = Math.random) {
  if (tempo === "off") return 0;
  const [min, max] = ranges[tempo] || ranges.normal;
  return Math.round(min + random() * (max - min));
}

export class MoveDelay {
  constructor(clock = globalThis) {
    this.clock = clock;
    this.timer = null;
  }

  get pending() {
    return this.timer !== null;
  }

  cancel() {
    if (this.pending) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(ms, valid, play) {
    this.cancel();
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      if (valid()) play();
    }, ms);
  }
}
