import assert from "node:assert/strict";
import test from "node:test";
import {
  behaviorCheck,
  createWorkshopTrace,
  dialogueGrader,
  outcomeGrader,
  runWorkshopBehaviorSuite,
  trajectoryGrader,
} from "./workshop-behavior-harness.mjs";

test("Workshop behavior harness grades outcomes, bounded trajectories, and persistent corrections", async () => {
  const task = {
    id: "reference",
    title: "Reference behavior trial",
    trials: 2,
    graders: [
      trajectoryGrader({
        requiredTools: [{ name: "codex.update_entry", min: 1, max: 1 }],
        forbiddenTools: ["codex.create_entry"],
        noToolsOnTurns: [1],
        confirmWrites: true,
        noDuplicateSuccessfulWrites: true,
      }),
      dialogueGrader({
        forbiddenAssistantPatterns: [/codex\.update_entry/iu, /tool call/iu],
        persistedBoundaries: [{ afterTurn: 1, include: ["黑发"], exclude: ["红发"] }],
      }),
      outcomeGrader("authority", (outcome) => behaviorCheck(
        "authority contains the corrected value",
        outcome.description === "黑发",
      )),
    ],
  };
  const result = await runWorkshopBehaviorSuite({
    tasks: [task],
    async runTrial(currentTask, trialIndex) {
      const trace = createWorkshopTrace(currentTask.id, trialIndex);
      trace.add({ type: "author", turn: 1, content: "不要红发，改成黑发。" });
      trace.add({ type: "assistant", turn: 1, content: "好，后续按黑发处理。" });
      trace.add({ type: "author", turn: 2, content: "把这个变化记录下来。" });
      trace.add({
        type: "tool-call",
        turn: 2,
        callId: `write-${trialIndex}`,
        name: "codex.update_entry",
        effect: "write",
        arguments: { patch: { description: "黑发" } },
        requestIdentity: `identity-${trialIndex}`,
      });
      trace.add({ type: "confirmation", turn: 2, callId: `write-${trialIndex}`, status: "approved" });
      trace.add({ type: "tool-result", turn: 2, callId: `write-${trialIndex}`, name: "codex.update_entry", effect: "write", status: "succeeded" });
      trace.add({ type: "assistant", turn: 2, content: "已经按黑发更新。" });
      return { trace, outcome: { description: "黑发" } };
    },
  });
  assert.equal(result.passed, true);
  assert.equal(result.tasks[0].trials, 2);
  assert.equal(result.tasks[0].passRate, 1);
});

test("Workshop behavior harness reports over-triggering instead of hiding it in a final answer", async () => {
  const task = {
    id: "negative",
    title: "Negative trigger",
    graders: [trajectoryGrader({ noToolsOnTurns: [1] })],
  };
  const result = await runWorkshopBehaviorSuite({
    tasks: [task],
    async runTrial(currentTask, trialIndex) {
      const trace = createWorkshopTrace(currentTask.id, trialIndex);
      trace.add({ type: "author", turn: 1, content: "只讨论，不要写入。" });
      trace.add({ type: "tool-call", turn: 1, callId: "bad", name: "codex.create_entry", effect: "write", arguments: {} });
      trace.add({ type: "assistant", turn: 1, content: "完成。" });
      return { trace, outcome: {} };
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.trials[0].grades[0].checks[0].passed, false);
});
