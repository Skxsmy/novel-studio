import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  ResearchToolAuditEventSchema,
  type ResearchToolAuditEvent,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { runSeriesFileTransaction } from "./fileTransactions.js";
import { assertInside } from "./fileSystem.js";
import { getModelCallLog } from "./aiFiles.js";
import {
  readJsonAuthorityFile,
  serializeJsonAuthority,
} from "./jsonAuthority.js";

const STUDIO_DIRECTORY = ".studio";
const RESEARCH_TOOL_AUDITS_DIRECTORY = "research-tool-audits";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const AUDIT_FILE_PATTERN = /^(\d{6})-([0-9a-f-]{36})\.json$/iu;

function parseModelCallId(modelCallId: string): string {
  if (!UUID_PATTERN.test(modelCallId)) {
    throw new StorageError("Research tool audit model call identity is invalid", "INVALID_DATA", {
      modelCallId,
    });
  }
  return modelCallId;
}

export function researchToolAuditsRoot(seriesRoot: string): string {
  return assertInside(
    seriesRoot,
    path.join(seriesRoot, STUDIO_DIRECTORY, RESEARCH_TOOL_AUDITS_DIRECTORY),
  );
}

export function researchToolAuditLaneRoot(seriesRoot: string, rawModelCallId: string): string {
  const modelCallId = parseModelCallId(rawModelCallId);
  return assertInside(seriesRoot, path.join(researchToolAuditsRoot(seriesRoot), modelCallId));
}

function researchToolAuditEventPath(
  seriesRoot: string,
  modelCallId: string,
  sequence: number,
  eventId: string,
): string {
  const sequencePrefix = sequence.toString().padStart(6, "0");
  return assertInside(
    seriesRoot,
    path.join(researchToolAuditLaneRoot(seriesRoot, modelCallId), `${sequencePrefix}-${eventId}.json`),
  );
}

async function readAuditEventsUnlocked(
  seriesRoot: string,
  modelCallId: string,
  expectedSeriesId: string,
): Promise<ResearchToolAuditEvent[]> {
  const laneRoot = researchToolAuditLaneRoot(seriesRoot, modelCallId);
  let entries;
  try {
    entries = await readdir(laneRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const events: ResearchToolAuditEvent[] = [];
  const sortedEntries = entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const [index, entry] of sortedEntries.entries()) {
    const match = entry.isFile() ? AUDIT_FILE_PATTERN.exec(entry.name) : null;
    if (!match) {
      throw new StorageError("Research tool audit lane contains an unexpected entry", "INVALID_DATA", {
        modelCallId,
        entryName: entry.name,
      });
    }
    const expectedSequence = index + 1;
    const fileSequence = Number.parseInt(match[1]!, 10);
    if (fileSequence !== expectedSequence) {
      throw new StorageError("Research tool audit sequence is not contiguous", "INVALID_DATA", {
        modelCallId,
        expectedSequence,
        actualSequence: fileSequence,
      });
    }
    const filePath = assertInside(seriesRoot, path.join(laneRoot, entry.name));
    let event: ResearchToolAuditEvent;
    try {
      event = (await readJsonAuthorityFile(
        laneRoot,
        filePath,
        (value) => ResearchToolAuditEventSchema.parse(value),
        "Research tool audit event",
      )).data;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("Research tool audit event is invalid", "INVALID_DATA", {
        modelCallId,
        entryName: entry.name,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (
      event.sequence !== expectedSequence ||
      event.id !== match[2] ||
      event.modelCallId !== modelCallId ||
      event.seriesId !== expectedSeriesId
    ) {
      throw new StorageError("Research tool audit identity does not match its authority path", "INVALID_DATA", {
        modelCallId,
        entryName: entry.name,
      });
    }
    events.push(event);
  }
  return events;
}

export async function listResearchToolAuditEvents(
  seriesRoot: string,
  rawModelCallId: string,
): Promise<ResearchToolAuditEvent[]> {
  const modelCallId = parseModelCallId(rawModelCallId);
  const modelCall = await getModelCallLog(seriesRoot, modelCallId);
  return readAuditEventsUnlocked(seriesRoot, modelCallId, modelCall.seriesId);
}

export async function appendResearchToolAuditEvent(
  seriesRoot: string,
  rawEvent: ResearchToolAuditEvent,
): Promise<ResearchToolAuditEvent> {
  const event = ResearchToolAuditEventSchema.parse(rawEvent);
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const modelCall = await getModelCallLog(seriesRoot, event.modelCallId);
    if (modelCall.seriesId !== event.seriesId) {
      throw new StorageError("Research tool audit Series does not match its Model Call Log", "INVALID_DATA", {
        modelCallId: event.modelCallId,
        eventSeriesId: event.seriesId,
        modelCallSeriesId: modelCall.seriesId,
      });
    }
    const existing = await readAuditEventsUnlocked(seriesRoot, event.modelCallId, modelCall.seriesId);
    const expectedSequence = existing.length + 1;
    if (event.sequence !== expectedSequence) {
      throw new StorageError("Research tool audit append sequence is stale", "CONFLICT", {
        modelCallId: event.modelCallId,
        expectedSequence,
        actualSequence: event.sequence,
      });
    }
    if (existing.some((candidate) => candidate.id === event.id)) {
      throw new StorageError("Research tool audit event identity already exists", "CONFLICT", {
        modelCallId: event.modelCallId,
        eventId: event.id,
      });
    }
    await commit([{
      targetPath: researchToolAuditEventPath(
        seriesRoot,
        event.modelCallId,
        event.sequence,
        event.id,
      ),
      content: serializeJsonAuthority(event),
    }]);
    return event;
  });
}
