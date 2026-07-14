import type { WorkshopMessage } from "@novel-studio/contracts";

export function isEligibleWorkshopBranchSource(
  messages: WorkshopMessage[],
  sourceIndex: number,
): boolean {
  const source = messages[sourceIndex];
  if (!source || source.status === "pending" || source.role === "tool") return false;

  const prefix = messages.slice(0, sourceIndex + 1);
  const includedMessageIds = new Set(prefix.map((message) => message.id));
  return prefix.every((message) => {
    if (message.status === "pending") return false;
    if (message.role !== "tool") return true;
    const execution = message.toolExecution;
    return Boolean(
      execution &&
      execution.status !== "running" &&
      execution.resultMessageId &&
      includedMessageIds.has(execution.resultMessageId),
    );
  });
}

export function workshopGeneralChatTurn(
  messages: WorkshopMessage[],
  sourceIndex: number,
): WorkshopMessage[] | null {
  const source = messages[sourceIndex];
  if (
    !source ||
    source.mode !== "general-chat" ||
    (source.role !== "author" && source.role !== "assistant")
  ) {
    return null;
  }
  let turnStart = sourceIndex;
  while (turnStart >= 0 && messages[turnStart]?.role !== "author") {
    turnStart -= 1;
  }
  if (turnStart < 0) return null;
  let turnEnd = turnStart + 1;
  while (turnEnd < messages.length && messages[turnEnd]?.role !== "author") {
    turnEnd += 1;
  }
  const turn = messages.slice(turnStart, turnEnd);
  return turn.every((message) =>
    message.mode === "general-chat" &&
    (message.role === "author" || message.role === "assistant") &&
    message.status !== "pending" &&
    message.proposalIds.length === 0,
  ) ? turn : null;
}
