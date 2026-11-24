import { test } from "node:test";
import assert from "node:assert/strict";
import { MoveDelay, moveDelay } from "../move-delay.js";

class Clock {
  now = 0;
  id = 0;
  tasks = new Map();
  setTimeout(fn, ms) {
    const id = ++this.id;
    this.tasks.set(id, { fn, at: this.now + ms });
    return id;
  }
  clearTimeout(id) {
    this.tasks.delete(id);
  }
  tick(ms) {
    this.now += ms;
    for (const [id, task] of [...this.tasks]) {
      if (task.at <= this.now) {
        this.tasks.delete(id);
        task.fn();
      }
    }
  }
}

test("tempo ranges are bounded and off has no delay", () => {
  for (const [tempo, min, max] of [
    ["fast", 300, 900],
    ["normal", 800, 2400],
    ["slow", 1500, 4500],
  ]) {
    assert.equal(
      moveDelay(tempo, () => 0),
      min,
    );
    assert.equal(
      moveDelay(tempo, () => 1),
      max,
    );
  }
  assert.equal(
    moveDelay("off", () => {
      throw Error("unnecessary random call");
    }),
    0,
  );
  assert.equal(
    moveDelay("unknown", () => 0),
    800,
  );
});

test("move waits for its deadline and is sent only once", () => {
  const clock = new Clock(),
    delay = new MoveDelay(clock);
  let moves = 0;
  delay.schedule(
    1500,
    () => true,
    () => moves++,
  );
  clock.tick(1499);
  assert.equal(moves, 0);
  clock.tick(1);
  assert.equal(moves, 1);
  clock.tick(5000);
  assert.equal(moves, 1);
  assert.equal(delay.pending, false);
});

test("disabling auto cancels a queued move", () => {
  const clock = new Clock(),
    delay = new MoveDelay(clock);
  delay.schedule(
    1000,
    () => true,
    () => assert.fail("cancelled move"),
  );
  delay.cancel();
  clock.tick(2000);
  assert.equal(delay.pending, false);
});

test("position is checked again when the delay expires", () => {
  const clock = new Clock(),
    delay = new MoveDelay(clock);
  let position = "before";
  delay.schedule(
    1000,
    () => position === "before",
    () => assert.fail("stale move"),
  );
  position = "after";
  clock.tick(1000);
  assert.equal(delay.pending, false);
});

test("a replacement cancels the previous queued move", () => {
  const clock = new Clock(),
    delay = new MoveDelay(clock);
  let moves = 0;
  delay.schedule(
    1000,
    () => true,
    () => assert.fail("replaced move"),
  );
  delay.schedule(
    2000,
    () => true,
    () => moves++,
  );
  clock.tick(1000);
  assert.equal(moves, 0);
  clock.tick(1000);
  assert.equal(moves, 1);
});
