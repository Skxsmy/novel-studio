import { createHash } from "node:crypto";
import {
  ResearchSourceContentSchema,
  type ResearchLanguageAnalysis,
  type ResearchLanguageSpan,
  type ResearchSourceBlock,
  type ResearchSourceContent,
  type ResearchSourceLocation,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";

export interface PreparedResearchSection {
  order: number;
  parentOrder: number | null;
  title: string;
  location: ResearchSourceLocation;
}

export interface PreparedResearchBlock {
  order: number;
  sectionOrder: number | null;
  kind: ResearchSourceBlock["kind"];
  text: string;
  location: ResearchSourceLocation;
}

export interface PreparedResearchContent {
  title: string;
  parserName: string;
  parserVersion: number;
  warnings: string[];
  sections: PreparedResearchSection[];
  blocks: PreparedResearchBlock[];
}

export function prepareVersion2ResearchContent(
  text: string,
  kind: "txt" | "markdown",
): PreparedResearchContent {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const sections: PreparedResearchSection[] = [];
  const blocks: PreparedResearchBlock[] = [];
  const headingStack: Array<{ level: number; sectionOrder: number }> = [];
  const paragraphPattern = /[^\n](?:.*?)(?=\n{2,}|$)/gsu;
  const locationFor = (startOffset: number, endOffset: number): ResearchSourceLocation => ({
    kind: "text",
    startLine: normalized.slice(0, startOffset).split("\n").length,
    endLine: normalized.slice(0, endOffset).split("\n").length,
    startOffset,
    endOffset,
  });
  for (const match of normalized.matchAll(paragraphPattern)) {
    const raw = match[0];
    const value = raw.replace(/[\t ]+/gu, " ").trim();
    if (!value) continue;
    const startOffset = match.index ?? 0;
    const endOffset = startOffset + raw.length;
    const heading = kind === "markdown" ? /^(#{1,6})\s+(.+)$/u.exec(value) : null;
    let blockKind: PreparedResearchBlock["kind"] = "paragraph";
    let blockText = value;
    let sectionOrder = headingStack.at(-1)?.sectionOrder ?? null;
    if (heading) {
      const level = heading[1]!.length;
      blockText = heading[2]!.trim();
      blockKind = "heading";
      while ((headingStack.at(-1)?.level ?? 0) >= level) headingStack.pop();
      sectionOrder = sections.length;
      sections.push({
        order: sectionOrder,
        parentOrder: headingStack.at(-1)?.sectionOrder ?? null,
        title: blockText,
        location: locationFor(startOffset, endOffset),
      });
      headingStack.push({ level, sectionOrder });
    } else if (kind === "markdown" && /^[-*+]\s+/u.test(value)) {
      blockKind = "list-item";
      blockText = value.replace(/^[-*+]\s+/u, "");
    } else if (kind === "markdown" && /^>\s?/u.test(value)) {
      blockKind = "quote";
      blockText = value.replace(/^>\s?/u, "");
    }
    blocks.push({
      order: blocks.length,
      sectionOrder,
      kind: blockKind,
      text: blockText,
      location: locationFor(startOffset, endOffset),
    });
  }
  if (blocks.length === 0) {
    throw new StorageError("Version 2 Research source has no extractable text", "INVALID_DATA");
  }
  return {
    title: sections[0]?.title ?? "",
    parserName: kind === "markdown" ? "novel-studio-markdown" : "novel-studio-text",
    parserVersion: 1,
    warnings: [],
    sections,
    blocks,
  };
}

const LANGUAGE_DETECTOR_VERSION = "novel-studio-script-v2";
const MAX_CHUNK_LENGTH = 1_200;

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function deterministicUuid(namespace: string, kind: string, order: number): string {
  const bytes = Buffer.from(createHash("sha256").update(`${namespace}:${kind}:${order}`, "utf8").digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type ScriptKind = "kana" | "han" | "latin" | "letter" | "neutral";

function scriptKind(character: string): ScriptKind {
  const value = character.codePointAt(0) ?? 0;
  if ((value >= 0x3040 && value <= 0x30ff) || (value >= 0x31f0 && value <= 0x31ff)) {
    return "kana";
  }
  if (
    (value >= 0x4e00 && value <= 0x9fff)
    || (value >= 0x3400 && value <= 0x4dbf)
    || (value >= 0x20000 && value <= 0x2fa1f)
  ) {
    return "han";
  }
  if (
    (value >= 0x0041 && value <= 0x005a)
    || (value >= 0x0061 && value <= 0x007a)
    || (value >= 0x00c0 && value <= 0x024f)
  ) return "latin";
  if (/\p{L}/u.test(character)) return "letter";
  return "neutral";
}

function scriptLanguage(kind: ScriptKind, declaredLanguage: string | null): string | null {
  if (kind === "kana") return declaredLanguage?.toLocaleLowerCase("und").startsWith("ja") ? declaredLanguage : "ja";
  if (kind === "han") {
    if (declaredLanguage?.toLocaleLowerCase("und").startsWith("ja")) return declaredLanguage;
    if (declaredLanguage?.toLocaleLowerCase("und").startsWith("zh")) return declaredLanguage;
    return null;
  }
  if (kind === "latin") return declaredLanguage?.toLocaleLowerCase("und").startsWith("en") ? declaredLanguage : "en";
  if (kind === "letter") return declaredLanguage ?? "und";
  return null;
}

function analyzeLanguage(text: string, declaredLanguage: string | null): {
  language: ResearchLanguageAnalysis;
  spans: ResearchLanguageSpan[];
} {
  const units: Array<{ start: number; end: number; kind: ScriptKind; language: string | null }> = [];
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index)!;
    const character = String.fromCodePoint(codePoint);
    const end = index + character.length;
    const kind = scriptKind(character);
    units.push({ start: index, end, kind, language: scriptLanguage(kind, declaredLanguage) });
    index = end;
  }
  for (let sentenceStart = 0; sentenceStart < units.length;) {
    let sentenceEnd = sentenceStart;
    while (sentenceEnd + 1 < units.length && !/[。！？!?\r\n]/u.test(text.slice(units[sentenceEnd]!.start, units[sentenceEnd]!.end))) {
      sentenceEnd += 1;
    }
    const sentence = units.slice(sentenceStart, sentenceEnd + 1);
    const inferredHanLanguage = sentence.some((unit) => unit.kind === "kana") ? "ja" : "zh";
    for (const unit of sentence) {
      if (unit.kind === "han" && unit.language === null) unit.language = inferredHanLanguage;
    }
    sentenceStart = sentenceEnd + 1;
  }
  let previous: string | null = null;
  for (const unit of units) {
    if (unit.language) previous = unit.language;
    else if (previous) unit.language = previous;
  }
  let next = declaredLanguage ?? "und";
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index]!;
    if (unit.language) next = unit.language;
    else unit.language = next;
  }
  const spans: ResearchLanguageSpan[] = [];
  for (const unit of units) {
    const languageTag = unit.language ?? declaredLanguage ?? "und";
    const existing = spans.at(-1);
    if (existing?.languageTag === languageTag && existing.end === unit.start) {
      existing.end = unit.end;
      continue;
    }
    spans.push({
      start: unit.start,
      end: unit.end,
      languageTag,
      source: declaredLanguage === languageTag ? "declared" : "detected",
      confidence: languageTag === "und" ? 0.2 : declaredLanguage === languageTag ? 0.8 : 0.98,
      detectorVersion: LANGUAGE_DETECTOR_VERSION,
    });
  }
  const weightByLanguage = new Map<string, number>();
  for (const span of spans) {
    weightByLanguage.set(span.languageTag, (weightByLanguage.get(span.languageTag) ?? 0) + span.end - span.start);
  }
  const languageTag = [...weightByLanguage.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0]
    ?? declaredLanguage
    ?? "und";
  return {
    language: {
      languageTag,
      source: declaredLanguage === languageTag ? "declared" : "detected",
      confidence: languageTag === "und" ? 0.2 : declaredLanguage === languageTag ? 0.8 : 0.95,
      detectorVersion: LANGUAGE_DETECTOR_VERSION,
    },
    spans,
  };
}

function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) return [text];
  const segmenter = new Intl.Segmenter("und", { granularity: "sentence" });
  const chunks: string[] = [];
  let current = "";
  for (const segment of segmenter.segment(text)) {
    const sentence = segment.segment;
    if (current && current.length + sentence.length > MAX_CHUNK_LENGTH) {
      chunks.push(current.trim());
      current = "";
    }
    if (sentence.length > MAX_CHUNK_LENGTH) {
      if (current.trim()) chunks.push(current.trim());
      current = "";
      for (let offset = 0; offset < sentence.length; offset += MAX_CHUNK_LENGTH) {
        const piece = sentence.slice(offset, offset + MAX_CHUNK_LENGTH).trim();
        if (piece) chunks.push(piece);
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function buildResearchSourceContent(input: {
  researchDatabaseId: string;
  sourceId: string;
  originalContentHash: string;
  declaredLanguage: string | null;
  prepared: PreparedResearchContent;
}): ResearchSourceContent {
  if (input.prepared.blocks.length === 0) {
    throw new StorageError("Research source has no parsed blocks", "INVALID_DATA", { sourceId: input.sourceId });
  }
  const sectionIds = input.prepared.sections.map((section) =>
    deterministicUuid(input.sourceId, "section", section.order));
  const sections = input.prepared.sections.map((section, index) => {
    if (section.order !== index) {
      throw new StorageError("Prepared Research sections are not contiguous", "INVALID_DATA", { sourceId: input.sourceId });
    }
    if (section.parentOrder !== null && (
      !Number.isInteger(section.parentOrder)
      || section.parentOrder < 0
      || section.parentOrder >= index
    )) {
      throw new StorageError("Prepared Research section parent is invalid", "INVALID_DATA", {
        sourceId: input.sourceId,
        sectionOrder: section.order,
        parentOrder: section.parentOrder,
      });
    }
    return {
      id: sectionIds[index]!,
      parentSectionId: section.parentOrder === null ? null : sectionIds[section.parentOrder]!,
      order: section.order,
      title: section.title,
      location: section.location,
    };
  });
  const blocks = input.prepared.blocks.map((block, index) => {
    if (block.order !== index) {
      throw new StorageError("Prepared Research blocks are not contiguous", "INVALID_DATA", { sourceId: input.sourceId });
    }
    if (block.sectionOrder !== null && (
      !Number.isInteger(block.sectionOrder)
      || block.sectionOrder < 0
      || block.sectionOrder >= sectionIds.length
    )) {
      throw new StorageError("Prepared Research block section is invalid", "INVALID_DATA", {
        sourceId: input.sourceId,
        blockOrder: block.order,
        sectionOrder: block.sectionOrder,
      });
    }
    const analyzed = analyzeLanguage(block.text, input.declaredLanguage);
    return {
      id: deterministicUuid(input.sourceId, "block", block.order),
      order: block.order,
      sectionId: block.sectionOrder === null ? null : sectionIds[block.sectionOrder]!,
      kind: block.kind,
      text: block.text,
      textHash: hashText(block.text),
      location: block.location,
      language: analyzed.language,
      languageSpans: analyzed.spans,
    };
  });
  const chunks = blocks.flatMap((block) => chunkText(block.text).map((text, order) => {
    const analyzed = analyzeLanguage(text, input.declaredLanguage);
    return {
      id: deterministicUuid(block.id, "chunk", order),
      blockId: block.id,
      order,
      text,
      textHash: hashText(text),
      location: block.location,
      language: analyzed.language,
      languageSpans: analyzed.spans,
    };
  }));
  return ResearchSourceContentSchema.parse({
    schemaVersion: 1,
    researchDatabaseId: input.researchDatabaseId,
    sourceId: input.sourceId,
    originalContentHash: input.originalContentHash,
    parserName: input.prepared.parserName,
    parserVersion: input.prepared.parserVersion,
    title: input.prepared.title,
    sections,
    blocks,
    chunks,
  });
}
