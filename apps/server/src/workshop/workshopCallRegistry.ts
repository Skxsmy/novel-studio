import type { WorkshopCallResult } from "@novel-studio/contracts";
import { StorageError } from "@novel-studio/storage";

const COMPLETED_CALL_LIMIT = 256;

interface ActiveWorkshopCall {
  seriesId: string;
  sessionId: string;
  controller: AbortController;
  terminal: Promise<WorkshopCallResult>;
  resolve: (result: WorkshopCallResult) => void;
  reject: (error: unknown) => void;
}

interface CompletedWorkshopCall {
  seriesId: string;
  sessionId: string;
  result: WorkshopCallResult | null;
}

export interface WorkshopCallHandle {
  operationId: string;
  abortSignal: AbortSignal;
  complete: (result: WorkshopCallResult) => void;
  fail: (error: unknown) => void;
  release: () => void;
}

export class WorkshopCallRegistry {
  private readonly active = new Map<string, ActiveWorkshopCall>();
  private readonly completed = new Map<string, CompletedWorkshopCall>();
  private readonly exclusiveSessions = new Set<string>();

  private sessionKey(seriesId: string, sessionId: string): string {
    return `${seriesId}:${sessionId}`;
  }

  private hasActiveSession(seriesId: string, sessionId: string): boolean {
    return Array.from(this.active.values()).some((call) => (
      call.seriesId === seriesId && call.sessionId === sessionId
    ));
  }

  begin(operationId: string, seriesId: string, sessionId: string): WorkshopCallHandle {
    if (this.exclusiveSessions.has(this.sessionKey(seriesId, sessionId))) {
      throw new StorageError("Workshop session has another active operation", "CONFLICT", {
        code: "WORKSHOP_SESSION_ACTIVITY_CONFLICT",
        sessionId,
      });
    }
    if (this.active.has(operationId) || this.completed.has(operationId)) {
      throw new StorageError("Workshop operation ID has already been used", "CONFLICT", {
        code: "WORKSHOP_CALL_OPERATION_CONFLICT",
        operationId,
      });
    }
    if (this.hasActiveSession(seriesId, sessionId)) {
      throw new StorageError("Workshop session already has an active model call", "CONFLICT", {
        code: "WORKSHOP_CALL_ACTIVE",
        sessionId,
      });
    }
    const controller = new AbortController();
    let resolve!: (result: WorkshopCallResult) => void;
    let reject!: (error: unknown) => void;
    const terminal = new Promise<WorkshopCallResult>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    terminal.catch(() => undefined);
    const active: ActiveWorkshopCall = {
      seriesId,
      sessionId,
      controller,
      terminal,
      resolve,
      reject,
    };
    this.active.set(operationId, active);
    let settled = false;
    return {
      operationId,
      abortSignal: controller.signal,
      complete: (result) => {
        if (settled) return;
        settled = true;
        if (this.active.get(operationId) === active) this.active.delete(operationId);
        this.rememberCompleted(operationId, {
          seriesId,
          sessionId,
          result,
        });
        resolve(result);
      },
      fail: (error) => {
        if (settled) return;
        settled = true;
        if (this.active.get(operationId) === active) this.active.delete(operationId);
        this.rememberCompleted(operationId, {
          seriesId,
          sessionId,
          result: null,
        });
        reject(error);
      },
      release: () => {
        if (this.active.get(operationId) === active) this.active.delete(operationId);
      },
    };
  }

  async guardSessionLifecycle<T>(
    seriesId: string,
    sessionId: string,
    mutation: () => Promise<T>,
  ): Promise<T> {
    return this.guardSessionActivity(seriesId, sessionId, mutation);
  }

  async guardSessionActivity<T>(
    seriesId: string,
    sessionId: string,
    activity: () => Promise<T>,
  ): Promise<T> {
    const key = this.sessionKey(seriesId, sessionId);
    if (this.exclusiveSessions.has(key) || this.hasActiveSession(seriesId, sessionId)) {
      throw new StorageError("Workshop session has another active operation", "CONFLICT", {
        code: "WORKSHOP_SESSION_ACTIVITY_CONFLICT",
        sessionId,
      });
    }
    this.exclusiveSessions.add(key);
    try {
      return await activity();
    } finally {
      this.exclusiveSessions.delete(key);
    }
  }

  async cancel(
    operationId: string,
    seriesId: string,
    sessionId: string,
  ): Promise<WorkshopCallResult | null> {
    const active = this.active.get(operationId);
    if (active) {
      if (active.seriesId !== seriesId || active.sessionId !== sessionId) return null;
      active.controller.abort();
      return active.terminal;
    }
    const completed = this.completed.get(operationId);
    if (!completed || completed.seriesId !== seriesId || completed.sessionId !== sessionId) return null;
    if (!completed.result) {
      throw new StorageError("Workshop operation has already completed", "CONFLICT", {
        code: "WORKSHOP_CALL_ALREADY_COMPLETED",
        operationId,
      });
    }
    return completed.result;
  }

  abort(operationId: string): void {
    this.active.get(operationId)?.controller.abort();
  }

  private rememberCompleted(operationId: string, call: CompletedWorkshopCall): void {
    this.completed.delete(operationId);
    this.completed.set(operationId, call);
    while (this.completed.size > COMPLETED_CALL_LIMIT) {
      const oldest = this.completed.keys().next().value as string | undefined;
      if (!oldest) break;
      this.completed.delete(oldest);
    }
  }
}
