import {
  continueWorkshopAgentAfterToolResult,
  retryWorkshopAgent,
  runWorkshopAgent,
  type WorkshopAgentRunnerInput,
  type WorkshopAgentRunnerResult,
} from "./workshopAgentRunner.js";

type ContinuationInput = Parameters<typeof continueWorkshopAgentAfterToolResult>[0];
type RetryInput = Parameters<typeof retryWorkshopAgent>[0];

export class WorkshopAgentCoordinator {
  private readonly sessionTails = new Map<string, Promise<unknown>>();

  start(input: WorkshopAgentRunnerInput): Promise<WorkshopAgentRunnerResult> {
    return this.serialize(input.sessionId, () => runWorkshopAgent(input));
  }

  continueAfterToolResult(input: ContinuationInput): Promise<WorkshopAgentRunnerResult> {
    return this.serialize(input.sessionId, () => continueWorkshopAgentAfterToolResult(input));
  }

  retry(input: RetryInput): Promise<WorkshopAgentRunnerResult> {
    return this.serialize(input.sessionId, () => retryWorkshopAgent(input));
  }

  private serialize<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.sessionTails.get(sessionId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.sessionTails.set(sessionId, current);
    void current.finally(() => {
      if (this.sessionTails.get(sessionId) === current) {
        this.sessionTails.delete(sessionId);
      }
    }).catch(() => undefined);
    return current;
  }
}
