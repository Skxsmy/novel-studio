import assert from "node:assert/strict";

const EVENT_TYPES = new Set([
  "author",
  "assistant",
  "tool-call",
  "confirmation",
  "tool-result",
]);

export function createWorkshopTrace(taskId, trialIndex) {
  assert.equal(typeof taskId, "string");
  assert(Number.isInteger(trialIndex) && trialIndex > 0);
  const events = [];
  return {
    taskId,
    trialIndex,
    events,
    add(event) {
      assert(EVENT_TYPES.has(event.type), `Unknown Workshop trace event: ${event.type}`);
      assert(Number.isInteger(event.turn) && event.turn > 0, "Trace events require a positive turn");
      events.push({ sequence: events.length + 1, ...event });
    },
  };
}

function check(message, passed, details = {}) {
  return { message, passed: Boolean(passed), details };
}

function graderResult(name, checks) {
  return { name, passed: checks.every((item) => item.passed), checks };
}

function countTools(events, name) {
  return events.filter((event) => event.type === "tool-call" && event.name === name).length;
}

function isOrderedSubsequence(actual, expected) {
  let expectedIndex = 0;
  for (const value of actual) {
    if (value === expected[expectedIndex]) expectedIndex += 1;
    if (expectedIndex === expected.length) return true;
  }
  return expected.length === 0;
}

export function trajectoryGrader(specification) {
  return async (trial) => {
    const checks = [];
    const calls = trial.trace.events.filter((event) => event.type === "tool-call");
    for (const required of specification.requiredTools ?? []) {
      const count = countTools(trial.trace.events, required.name);
      const minimum = required.min ?? 1;
      const maximum = required.max ?? Number.POSITIVE_INFINITY;
      checks.push(check(
        `${required.name} count is ${minimum}-${Number.isFinite(maximum) ? maximum : "unbounded"}`,
        count >= minimum && count <= maximum,
        { count, minimum, maximum: Number.isFinite(maximum) ? maximum : null },
      ));
    }
    for (const forbidden of specification.forbiddenTools ?? []) {
      const count = countTools(trial.trace.events, forbidden);
      checks.push(check(`${forbidden} is not called`, count === 0, { count }));
    }
    for (const turn of specification.noToolsOnTurns ?? []) {
      const turnCalls = calls.filter((event) => event.turn === turn);
      checks.push(check(`turn ${turn} has no tool call`, turnCalls.length === 0, {
        tools: turnCalls.map((event) => event.name),
      }));
    }
    if (specification.orderedTools) {
      const actual = calls.map((event) => event.name);
      checks.push(check("required tool ordering is preserved", isOrderedSubsequence(
        actual,
        specification.orderedTools,
      ), { actual, expected: specification.orderedTools }));
    }
    if (specification.confirmWrites) {
      for (const call of calls.filter((event) => event.effect === "write")) {
        const confirmation = trial.trace.events.find((event) =>
          event.type === "confirmation" &&
          event.callId === call.callId &&
          event.sequence > call.sequence
        );
        const result = trial.trace.events.find((event) =>
          event.type === "tool-result" &&
          event.callId === call.callId &&
          event.sequence > (confirmation?.sequence ?? call.sequence)
        );
        checks.push(check(`${call.name} waits for approval`, confirmation?.status === "approved", {
          confirmationStatus: confirmation?.status ?? null,
        }));
        checks.push(check(`${call.name} settles after approval`, result?.status === "succeeded", {
          resultStatus: result?.status ?? null,
        }));
      }
    }
    if (specification.noDuplicateSuccessfulWrites) {
      const successfulKeys = new Set();
      let duplicate = null;
      for (const event of trial.trace.events.filter((candidate) =>
        candidate.type === "tool-result" && candidate.effect === "write" && candidate.status === "succeeded")) {
        const call = calls.find((candidate) => candidate.callId === event.callId);
        const key = call?.requestIdentity ?? event.callId;
        if (successfulKeys.has(key)) duplicate = key;
        successfulKeys.add(key);
      }
      checks.push(check("successful writes are not replayed", duplicate === null, { duplicate }));
    }
    return graderResult(specification.name ?? "trajectory", checks);
  };
}

export function dialogueGrader(specification = {}) {
  return async (trial) => {
    const checks = [];
    const assistants = trial.trace.events.filter((event) => event.type === "assistant");
    const visibleText = assistants.map((event) => event.content).join("\n");
    for (const forbidden of specification.forbiddenAssistantPatterns ?? []) {
      const pattern = forbidden instanceof RegExp ? forbidden : new RegExp(forbidden, "iu");
      checks.push(check(`assistant avoids ${pattern}`, !pattern.test(visibleText)));
    }
    for (const boundary of specification.persistedBoundaries ?? []) {
      const later = trial.trace.events.filter((event) =>
        event.turn > boundary.afterTurn &&
        (event.type === "assistant" || event.type === "tool-call"));
      const serialized = JSON.stringify(later);
      for (const value of boundary.exclude ?? []) {
        checks.push(check(`later turns keep rejected value ${value} excluded`, !serialized.includes(value)));
      }
      for (const value of boundary.include ?? []) {
        checks.push(check(`later turns preserve corrected value ${value}`, serialized.includes(value)));
      }
    }
    if (specification.maximumAuthorTurns) {
      const turns = new Set(trial.trace.events
        .filter((event) => event.type === "author")
        .map((event) => event.turn)).size;
      checks.push(check(`author completes within ${specification.maximumAuthorTurns} turns`,
        turns <= specification.maximumAuthorTurns, { turns }));
    }
    return graderResult(specification.name ?? "dialogue", checks);
  };
}

export function outcomeGrader(name, evaluate) {
  return async (trial) => {
    const evaluated = await evaluate(trial.outcome, trial);
    const checks = Array.isArray(evaluated) ? evaluated : [evaluated];
    return graderResult(name, checks.map((item) => check(
      item.message,
      item.passed,
      item.details ?? {},
    )));
  };
}

export async function runWorkshopBehaviorSuite(input) {
  const trialResults = [];
  for (const task of input.tasks) {
    const trialCount = task.trials ?? input.trialsPerTask ?? 1;
    for (let trialIndex = 1; trialIndex <= trialCount; trialIndex += 1) {
      const trial = await input.runTrial(task, trialIndex);
      assert.equal(trial.trace.taskId, task.id);
      assert.equal(trial.trace.trialIndex, trialIndex);
      const grades = [];
      for (const grader of task.graders) grades.push(await grader(trial));
      trialResults.push({
        taskId: task.id,
        trialIndex,
        passed: grades.every((grade) => grade.passed),
        grades,
        metrics: trial.metrics ?? {},
        trace: trial.trace,
        outcome: trial.outcome,
      });
    }
  }
  const tasks = input.tasks.map((task) => {
    const trials = trialResults.filter((trial) => trial.taskId === task.id);
    const passedTrials = trials.filter((trial) => trial.passed).length;
    const passRate = trials.length === 0 ? 0 : passedTrials / trials.length;
    const minimumPassRate = task.minimumPassRate ?? 1;
    return {
      id: task.id,
      title: task.title,
      trials: trials.length,
      passedTrials,
      passRate,
      minimumPassRate,
      passed: passRate >= minimumPassRate,
    };
  });
  return {
    schemaVersion: 1,
    passed: tasks.every((task) => task.passed),
    tasks,
    trials: trialResults,
  };
}

export function publicSuiteSummary(result) {
  return {
    schemaVersion: result.schemaVersion,
    passed: result.passed,
    tasks: result.tasks,
    trials: result.trials.map((trial) => ({
      taskId: trial.taskId,
      trialIndex: trial.trialIndex,
      passed: trial.passed,
      grades: trial.grades,
      metrics: trial.metrics,
      eventCount: trial.trace.events.length,
    })),
  };
}

export { check as behaviorCheck };
