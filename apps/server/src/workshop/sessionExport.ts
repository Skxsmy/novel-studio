import type { ProviderPrompt } from "@novel-studio/ai";
import type {
  ContextBundle,
  ContextItem,
  ModelCallLog,
  WorkshopAgentRunDocument,
  WorkshopProviderHistoryMessage,
  WorkshopMessage,
  WorkshopMessageAttachment,
  WorkshopSession,
} from "@novel-studio/contracts";
import type { ProjectRepository } from "@novel-studio/storage";
import { contextPrompt } from "../routes/modelCalls.js";
import { workshopProviderPrompt } from "./workshopPrompts.js";

export interface WorkshopSessionExportOptions {
  includeReasoning: boolean;
  includePromptAudit: boolean;
}

const WORKSHOP_PROMPT_CONTEXT_KINDS = new Set([
  "role-instruction",
  "prompt-template",
  "user-request",
]);

function shouldFilterPromptContext(message: WorkshopMessage): boolean {
  return message.mode === "general-chat" || message.mode === "agent";
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

function markdownText(value: string): string {
  const normalized = normalizeNewlines(value);
  const maxFenceRun = Math.max(2, ...Array.from(normalized.matchAll(/`+/gu), (match) => match[0].length));
  const fence = "`".repeat(maxFenceRun + 1);
  return `${fence}text\n${normalized}\n${fence}`;
}

function inlineValue(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  return normalized ? normalized.replace(/\r?\n/gu, " ") : "-";
}

function bullet(label: string, value: string | number | null | undefined): string {
  return `- ${label}: ${inlineValue(String(value ?? ""))}`;
}

function messageTitle(index: number, message: WorkshopMessage): string {
  return [
    `### ${index + 1}. ${message.role}`,
    message.mode,
    message.status,
    message.createdAt,
  ].join(" | ");
}

function promptForMessageMode(message: WorkshopMessage, contextBundle: ContextBundle): ProviderPrompt {
  if (message.mode === "agent") {
    return workshopProviderPrompt({
      mode: "agent",
      userRequest: contextBundle.userRequest,
    });
  }
  if (message.mode !== "general-chat") {
    return contextPrompt(contextBundle);
  }
  const roleInstruction = contextBundle.items.find((item) => item.kind === "role-instruction");
  return {
    system: roleInstruction?.content.trim() ?? "",
    instructions: "",
    user: contextBundle.userRequest,
  };
}

function redactWorkshopHistoryAttachmentContent(value: string): string {
  const lines = normalizeNewlines(value).split("\n");
  const output: string[] = [];
  let omittingAttachment = false;
  for (const line of lines) {
    if (/^Attachment \d+: /u.test(line)) {
      output.push(line);
      output.push("[attachment content omitted from export]");
      omittingAttachment = true;
      continue;
    }
    if (omittingAttachment) {
      if (line === "---" || /^\[\d+\] /u.test(line)) {
        omittingAttachment = false;
        output.push(line);
      }
      continue;
    }
    output.push(line);
  }
  return output.join("\n").trim();
}

function contextItemForExport(item: ContextItem): ContextItem {
  if (item.kind === "message-attachment") {
    return {
      ...item,
      content: "[attachment content omitted from export; see attachment records]",
    };
  }
  if (item.kind === "workshop-chat-history") {
    return {
      ...item,
      content: redactWorkshopHistoryAttachmentContent(item.content),
    };
  }
  return item;
}

function isSessionBoundContextItemForExport(
  item: ContextItem,
  sessionId: string,
  attachmentIds: Set<string>,
): boolean {
  if (item.kind === "workshop-chat-history") {
    return item.source.type === "workshop-session" && item.source.id === sessionId;
  }
  if (item.kind === "message-attachment") {
    if (item.source.type !== "workshop-message-attachment") return true;
    return Boolean(item.source.id && attachmentIds.has(item.source.id));
  }
  return true;
}

function contextBundleForExport(
  contextBundle: ContextBundle,
  sessionId: string,
  attachmentIds: Set<string>,
): ContextBundle {
  const items = contextBundle.items
    .filter((item) => isSessionBoundContextItemForExport(item, sessionId, attachmentIds))
    .map(contextItemForExport);
  const inputTokens = items.reduce((sum, item) => sum + item.tokenEstimate, 0);
  return {
    ...contextBundle,
    items,
    estimatedUsage: {
      inputTokens,
      outputTokens: 0,
      totalTokens: inputTokens,
    },
  };
}

function providerContextItems(message: WorkshopMessage, contextBundle: ContextBundle): ContextItem[] {
  const items = shouldFilterPromptContext(message)
    ? contextBundle.items.filter((item) => !WORKSHOP_PROMPT_CONTEXT_KINDS.has(item.kind))
    : contextBundle.items;
  return items;
}

async function optionalModelCall(
  repository: ProjectRepository,
  seriesId: string,
  modelCallId: string | null,
): Promise<{ log: ModelCallLog | null; error: string | null }> {
  if (!modelCallId) return { log: null, error: null };
  try {
    return { log: await repository.getModelCallLog(seriesId, modelCallId), error: null };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error";
    return { log: null, error: message };
  }
}

async function optionalContextBundle(
  repository: ProjectRepository,
  seriesId: string,
  contextBundleId: string | null,
): Promise<{ contextBundle: ContextBundle | null; error: string | null }> {
  if (!contextBundleId) return { contextBundle: null, error: null };
  try {
    return { contextBundle: await repository.getContextBundle(seriesId, contextBundleId), error: null };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error";
    return { contextBundle: null, error: message };
  }
}

function attachmentsForMessage(
  message: WorkshopMessage,
  attachmentsById: Map<string, WorkshopMessageAttachment>,
): WorkshopMessageAttachment[] {
  return message.attachmentIds
    .map((attachmentId) => attachmentsById.get(attachmentId))
    .filter((attachment): attachment is WorkshopMessageAttachment => Boolean(attachment));
}

function appendSessionHeader(lines: string[], session: WorkshopSession, options: WorkshopSessionExportOptions): void {
  lines.push(`# Workshop Export: ${session.title}`);
  lines.push("");
  lines.push(bullet("Session ID", session.id));
  lines.push(bullet("Kind", session.kind));
  lines.push(bullet("Status", session.status));
  lines.push(bullet("Created", session.createdAt));
  lines.push(bullet("Updated", session.updatedAt));
  lines.push(bullet("Include reasoning", options.includeReasoning ? "yes" : "no"));
  lines.push(bullet("Include prompt audit", options.includePromptAudit ? "yes" : "no"));
  lines.push("");
  lines.push("## Messages");
  lines.push("");
}

function appendAttachments(lines: string[], attachments: WorkshopMessageAttachment[]): void {
  if (attachments.length === 0) return;
  lines.push("Attachments:");
  for (const attachment of attachments) {
    lines.push(`- ${attachment.fileName} (${attachment.parseStatus}, ${attachment.mediaType}, ${attachment.sizeBytes} bytes)`);
  }
  lines.push("");
}

function appendModelCall(lines: string[], message: WorkshopMessage, log: ModelCallLog | null, error: string | null): void {
  if (!message.modelCallId && !error && !log) return;
  lines.push("Model Call:");
  lines.push(bullet("Message modelCallId", message.modelCallId));
  if (error) {
    lines.push(bullet("Model call load error", error));
  }
  if (log) {
    lines.push(bullet("Provider", log.provider));
    lines.push(bullet("Model", log.model));
    lines.push(bullet("Status", log.status));
    lines.push(bullet("Started", log.startedAt));
    lines.push(bullet("Completed", log.completedAt));
    lines.push(bullet("Estimated usage", JSON.stringify(log.estimatedUsage)));
    lines.push(bullet("Actual usage", log.actualUsage ? JSON.stringify(log.actualUsage) : null));
  }
  lines.push("");
}

function appendPrompt(lines: string[], message: WorkshopMessage, contextBundle: ContextBundle | null, error: string | null): void {
  if (!message.contextBundleId && !contextBundle && !error) return;
  lines.push("Provider Prompt:");
  lines.push(bullet("Message contextBundleId", message.contextBundleId));
  if (error) {
    lines.push(bullet("Context bundle load error", error));
    lines.push("");
    return;
  }
  if (!contextBundle) {
    lines.push("");
    return;
  }
  const prompt = promptForMessageMode(message, contextBundle);
  lines.push("");
  lines.push("System:");
  lines.push(markdownText(prompt.system));
  lines.push("");
  lines.push("Instructions:");
  lines.push(markdownText(prompt.instructions));
  lines.push("");
  lines.push("User:");
  lines.push(markdownText(prompt.user));
  lines.push("");

  const sentItems = providerContextItems(message, contextBundle);
  lines.push("Context Items Sent To Provider:");
  if (sentItems.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }
  for (const item of sentItems) {
    lines.push(`#### ${item.kind} | ${item.title}`);
    lines.push(bullet("Source", `${item.source.type}:${item.source.id ?? "-"} ${item.source.label}`.trim()));
    lines.push(bullet("Inclusion", item.inclusion));
    lines.push(bullet("Token estimate", item.tokenEstimate));
    lines.push(markdownText(item.content));
    lines.push("");
  }
}

function compactToolRequestLines(content: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const request = parsed as Record<string, unknown>;
  if (request.schemaVersion !== 1 || typeof request.tool !== "string") return null;
  const draft = request.draft && typeof request.draft === "object"
    ? request.draft as Record<string, unknown>
    : {};
  const lines = ["Tool Request:"];
  lines.push(bullet("Tool", request.tool));
  if (request.tool === "codex.create_entry") {
    lines.push(bullet("Name", typeof draft.name === "string" ? draft.name : null));
    lines.push(bullet("Category", typeof draft.categoryId === "string" ? draft.categoryId : null));
    lines.push(bullet("Details", Array.isArray(draft.details) ? draft.details.length : 0));
    return lines;
  }
  if (request.tool === "codex.update_entry") {
    const target = draft.target && typeof draft.target === "object"
      ? draft.target as Record<string, unknown>
      : {};
    const patch = draft.patch && typeof draft.patch === "object"
      ? draft.patch as Record<string, unknown>
      : {};
    lines.push(bullet("Target", typeof target.entryId === "string" ? target.entryId : String(target.name ?? "")));
    lines.push(bullet("Patch fields", Object.keys(patch).join(", ")));
    lines.push(bullet("Details", Array.isArray(patch.details) ? patch.details.length : 0));
    return lines;
  }
  return lines;
}

function appendMessageContent(
  lines: string[],
  message: WorkshopMessage,
  options: WorkshopSessionExportOptions,
): void {
  if (!options.includePromptAudit && message.role === "tool") {
    const compactToolRequest = compactToolRequestLines(message.content);
    if (compactToolRequest) {
      lines.push(...compactToolRequest);
      lines.push("");
      return;
    }
  }
  if (!options.includePromptAudit && message.role === "result") {
    lines.push("Tool Result:");
    lines.push(message.content.trim() || "-");
    lines.push("");
    return;
  }
  lines.push(markdownText(message.content));
  lines.push("");
}

async function appendMessage(
  lines: string[],
  input: {
    attachmentsById: Map<string, WorkshopMessageAttachment>;
    currentSessionAttachmentIds: Set<string>;
    index: number;
    message: WorkshopMessage;
    options: WorkshopSessionExportOptions;
    repository: ProjectRepository;
    seriesId: string;
    sessionId: string;
  },
): Promise<void> {
  const { attachmentsById, currentSessionAttachmentIds, index, message, options, repository, seriesId, sessionId } = input;
  lines.push(messageTitle(index, message));
  lines.push("");
  appendMessageContent(lines, message, options);
  if (options.includeReasoning && message.reasoningContent.trim()) {
    lines.push("Reasoning:");
    lines.push(markdownText(message.reasoningContent));
    lines.push("");
  }
  appendAttachments(lines, attachmentsForMessage(message, attachmentsById));

  if (!options.includePromptAudit) return;
  if (message.agentRunId) return;
  const [modelCall, bundle] = await Promise.all([
    optionalModelCall(repository, seriesId, message.modelCallId),
    optionalContextBundle(repository, seriesId, message.contextBundleId),
  ]);
  appendModelCall(lines, message, modelCall.log, modelCall.error);
  appendPrompt(
    lines,
    message,
    bundle.contextBundle
      ? contextBundleForExport(bundle.contextBundle, sessionId, currentSessionAttachmentIds)
      : null,
    bundle.error,
  );
}

function historyForExport(
  history: WorkshopProviderHistoryMessage[],
  includeReasoning: boolean,
): unknown[] {
  return history.map((message) => {
    if (message.role !== "assistant" || includeReasoning) return message;
    const { reasoningContent: _reasoningContent, ...safe } = message;
    return safe;
  });
}

async function appendAgentRunAudit(
  lines: string[],
  input: {
    currentSessionAttachmentIds: Set<string>;
    options: WorkshopSessionExportOptions;
    repository: ProjectRepository;
    runs: WorkshopAgentRunDocument[];
    seriesId: string;
    sessionId: string;
  },
): Promise<void> {
  if (!input.options.includePromptAudit || input.runs.length === 0) return;
  lines.push("## Agent Run Audit");
  lines.push("");
  const runs = [...input.runs].sort((left, right) =>
    left.run.createdAt.localeCompare(right.run.createdAt)
  );
  for (const document of runs) {
    const run = document.run;
    lines.push(`### Run ${run.id}`);
    lines.push(bullet("Status", run.status));
    lines.push(bullet("Model profile", run.modelProfileId));
    lines.push(bullet("Model override", run.modelOverride));
    lines.push(bullet("Created", run.createdAt));
    lines.push(bullet("Completed", run.completedAt));
    lines.push("");

    const bundle = await optionalContextBundle(input.repository, input.seriesId, run.contextBundleId);
    lines.push("Context Bundle Sent To Provider:");
    lines.push(bullet("Context bundle ID", run.contextBundleId));
    if (bundle.error) {
      lines.push(bullet("Context bundle load error", bundle.error));
    } else if (bundle.contextBundle) {
      const exportedBundle = contextBundleForExport(
        bundle.contextBundle,
        input.sessionId,
        input.currentSessionAttachmentIds,
      );
      const sentItems = exportedBundle.items.filter((item) =>
        !WORKSHOP_PROMPT_CONTEXT_KINDS.has(item.kind)
      );
      if (sentItems.length === 0) {
        lines.push("- none");
      } else {
        for (const item of sentItems) {
          lines.push(`#### ${item.kind} | ${item.title}`);
          lines.push(bullet("Source", `${item.source.type}:${item.source.id ?? "-"} ${item.source.label}`.trim()));
          lines.push(bullet("Inclusion", item.inclusion));
          lines.push(markdownText(item.content));
        }
      }
    }
    lines.push("");

    for (const step of run.steps) {
      lines.push(`#### Step ${step.index + 1} | ${step.kind} | attempt ${step.attempt}`);
      lines.push(bullet("Status", step.status));
      lines.push(bullet("Started", step.startedAt));
      lines.push(bullet("Completed", step.completedAt));
      lines.push(bullet("Input message IDs", step.inputMessageIds.join(", ")));
      if (step.errorCode || step.errorMessage) {
        lines.push(bullet("Error", `${step.errorCode ?? "-"}: ${step.errorMessage ?? "-"}`));
      }
      if (step.modelCallId) {
        const modelCall = await optionalModelCall(input.repository, input.seriesId, step.modelCallId);
        lines.push(bullet("Model call ID", step.modelCallId));
        if (modelCall.error) {
          lines.push(bullet("Model call load error", modelCall.error));
        } else if (modelCall.log) {
          lines.push(bullet("Provider", modelCall.log.provider));
          lines.push(bullet("Model", modelCall.log.model));
          lines.push(bullet("Model call status", modelCall.log.status));
          lines.push(bullet("Estimated usage", JSON.stringify(modelCall.log.estimatedUsage)));
          lines.push(bullet("Actual usage", modelCall.log.actualUsage ? JSON.stringify(modelCall.log.actualUsage) : null));
        }
      }
      if (step.promptSnapshot) {
        lines.push("Prompt Snapshot:");
        lines.push("System:");
        lines.push(markdownText(step.promptSnapshot.system));
        lines.push("Instructions:");
        lines.push(markdownText(step.promptSnapshot.instructions));
        lines.push("User:");
        lines.push(markdownText(step.promptSnapshot.user));
        lines.push("Provider History Snapshot:");
        if (step.historySnapshot.length === 0) {
          lines.push("- none");
        } else {
          lines.push(markdownText(JSON.stringify(
            historyForExport(step.historySnapshot, input.options.includeReasoning),
            null,
            2,
          )));
        }
      }
      lines.push("");
    }
  }
}

export async function exportWorkshopSessionMarkdown(
  repository: ProjectRepository,
  seriesId: string,
  sessionId: string,
  options: WorkshopSessionExportOptions,
): Promise<string> {
  const [session, messages, attachments, agentRuns] = await Promise.all([
    repository.getWorkshopSession(seriesId, sessionId),
    repository.listWorkshopMessages(seriesId, sessionId),
    repository.listWorkshopAttachments(seriesId, sessionId),
    repository.listWorkshopAgentRuns(seriesId, sessionId),
  ]);
  const sessionMessages = messages
    .filter((message) => message.seriesId === seriesId && message.sessionId === session.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const sessionAttachments = attachments.filter((attachment) =>
    attachment.seriesId === seriesId && attachment.sessionId === session.id,
  ).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const attachmentsById = new Map(sessionAttachments.map((attachment) => [attachment.id, attachment]));
  const currentSessionAttachmentIds = new Set(sessionAttachments.map((attachment) => attachment.id));
  const lines: string[] = [];
  appendSessionHeader(lines, session, options);
  for (let index = 0; index < sessionMessages.length; index += 1) {
    await appendMessage(lines, {
      attachmentsById,
      currentSessionAttachmentIds,
      index,
      message: sessionMessages[index]!,
      options,
      repository,
      seriesId,
      sessionId: session.id,
    });
  }
  await appendAgentRunAudit(lines, {
    currentSessionAttachmentIds,
    options,
    repository,
    runs: agentRuns.runs,
    seriesId,
    sessionId: session.id,
  });
  if (options.includePromptAudit && agentRuns.diagnostics.length) {
    lines.push("## Agent Run Diagnostics");
    lines.push("");
    for (const diagnostic of agentRuns.diagnostics) {
      lines.push(`- ${diagnostic.fileName}: ${diagnostic.code} - ${diagnostic.message}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n{4,}/gu, "\n\n\n").trimEnd()}\n`;
}
