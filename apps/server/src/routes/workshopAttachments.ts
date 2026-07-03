import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { TextDecoder } from "node:util";
import {
  WORKSHOP_ATTACHMENT_MAX_BYTES,
  type UploadWorkshopAttachmentInput,
  type WorkshopMessageAttachment,
} from "@novel-studio/contracts";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

type WordExtractorDocument = {
  getAnnotations(options?: { filterUnicode?: boolean }): string;
  getBody(options?: { filterUnicode?: boolean }): string;
  getEndnotes(options?: { filterUnicode?: boolean }): string;
  getFootnotes(options?: { filterUnicode?: boolean }): string;
  getHeaders(options?: { filterUnicode?: boolean; includeFooters?: boolean }): string;
  getTextboxes(options?: { filterUnicode?: boolean }): string;
};

type WordExtractorInstance = {
  extract(source: Buffer | string): Promise<WordExtractorDocument>;
};

type WordExtractorConstructor = new () => WordExtractorInstance;

const require = createRequire(import.meta.url);
const WordExtractor = require("word-extractor") as WordExtractorConstructor;

type ParsedAttachmentFields = Pick<
  WorkshopMessageAttachment,
  "extractedText" | "parseError" | "parseStatus" | "parseWarnings" | "textHash"
>;

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function parsed(text: string, warnings: string[] = []): ParsedAttachmentFields {
  const normalized = text.replace(/\r\n?/gu, "\n").trim();
  if (!normalized) {
    return failed("The file has no extractable text.");
  }
  return {
    extractedText: normalized,
    parseError: null,
    parseStatus: "parsed",
    parseWarnings: warnings,
    textHash: hashText(normalized),
  };
}

function failed(message: string, warnings: string[] = []): ParsedAttachmentFields {
  return {
    extractedText: "",
    parseError: message,
    parseStatus: "failed",
    parseWarnings: warnings,
    textHash: null,
  };
}

function rejected(message: string): ParsedAttachmentFields {
  return {
    extractedText: "",
    parseError: message,
    parseStatus: "rejected",
    parseWarnings: [],
    textHash: null,
  };
}

function extensionFor(fileName: string): string {
  return path.extname(fileName).toLocaleLowerCase("und");
}

function hasBinaryControlText(text: string): boolean {
  if (text.includes("\u0000")) return true;
  const characters = Array.from(text);
  if (characters.length === 0) return false;
  const controlCount = characters.filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 && character !== "\n" && character !== "\r" && character !== "\t";
  }).length;
  return controlCount / characters.length > 0.02;
}

function stripLeadingBom(text: string): string {
  return text.replace(/^\uFEFF/u, "");
}

function decodeTextWithEncoding(
  buffer: Buffer,
  encoding: string,
  displayName: string,
): { displayName: string; text: string } | null {
  try {
    return {
      displayName,
      text: stripLeadingBom(new TextDecoder(encoding, { fatal: true }).decode(buffer)),
    };
  } catch {
    return null;
  }
}

function utf16Heuristic(buffer: Buffer): "utf-16le" | "utf-16be" | null {
  if (buffer.byteLength < 4) return null;
  let evenZeroes = 0;
  let oddZeroes = 0;
  let evenTotal = 0;
  let oddTotal = 0;
  for (let index = 0; index < buffer.byteLength; index += 1) {
    if (index % 2 === 0) {
      evenTotal += 1;
      if (buffer[index] === 0) evenZeroes += 1;
    } else {
      oddTotal += 1;
      if (buffer[index] === 0) oddZeroes += 1;
    }
  }
  const evenZeroRatio = evenZeroes / evenTotal;
  const oddZeroRatio = oddZeroes / oddTotal;
  if (oddZeroRatio > 0.3 && evenZeroRatio < 0.05) return "utf-16le";
  if (evenZeroRatio > 0.3 && oddZeroRatio < 0.05) return "utf-16be";
  return null;
}

function scoreDecodedText(text: string): number {
  const characters = Array.from(text);
  if (characters.length === 0 || hasBinaryControlText(text)) return Number.NEGATIVE_INFINITY;
  let score = 0;
  for (const character of characters) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0xfffd) {
      score -= 20;
    } else if (code >= 0x4e00 && code <= 0x9fff) {
      score += 4;
    } else if (code >= 0x3040 && code <= 0x30ff) {
      score += 3;
    } else if (code >= 0x20 && code <= 0x7e) {
      score += 2;
    } else if (character === "\n" || character === "\r" || character === "\t") {
      score += 1;
    } else if (code >= 0x2000 && code <= 0x206f) {
      score += 1;
    } else {
      score += 0.5;
    }
  }
  return score / characters.length;
}

function decodeTextAttachment(buffer: Buffer): { displayName: string; text: string } | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    return decodeTextWithEncoding(buffer.subarray(3), "utf-8", "UTF-8");
  }
  if (buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) {
    return decodeTextWithEncoding(buffer.subarray(2), "utf-16le", "UTF-16 LE");
  }
  if (buffer.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) {
    return decodeTextWithEncoding(buffer.subarray(2), "utf-16be", "UTF-16 BE");
  }

  const utf16Guess = utf16Heuristic(buffer);
  if (utf16Guess) {
    const displayName = utf16Guess === "utf-16le" ? "UTF-16 LE" : "UTF-16 BE";
    return decodeTextWithEncoding(buffer, utf16Guess, displayName);
  }

  const candidates = [
    ["utf-8", "UTF-8"],
    ["gb18030", "GB18030/GBK"],
    ["big5", "Big5"],
    ["shift_jis", "Shift_JIS"],
    ["windows-1252", "Windows-1252"],
  ] as const;
  let best: { displayName: string; text: string; score: number } | null = null;
  for (const [encoding, displayName] of candidates) {
    const decoded = decodeTextWithEncoding(buffer, encoding, displayName);
    if (!decoded) continue;
    const score = scoreDecodedText(decoded.text);
    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score) {
      best = { ...decoded, score };
    }
  }
  return best ? { displayName: best.displayName, text: best.text } : null;
}

function decodeBase64(input: UploadWorkshopAttachmentInput): Buffer | ParsedAttachmentFields {
  if (input.sizeBytes === 0) return rejected("Empty files cannot be attached.");
  if (input.sizeBytes > WORKSHOP_ATTACHMENT_MAX_BYTES) {
    return rejected("Attachment is larger than the supported 5 MB limit.");
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.base64Content, "base64");
  } catch {
    return rejected("Attachment content is not valid base64.");
  }
  if (buffer.byteLength !== input.sizeBytes) {
    return rejected("Attachment content length does not match the declared file size.");
  }
  return buffer;
}

function parseText(buffer: Buffer): ParsedAttachmentFields {
  const decoded = decodeTextAttachment(buffer);
  if (!decoded) {
    return rejected("The text file uses an unsupported or damaged text encoding.");
  }
  if (hasBinaryControlText(decoded.text)) {
    return rejected("The text file appears to contain binary data.");
  }
  const warnings = decoded.displayName === "UTF-8" ? [] : [`Text decoded as ${decoded.displayName}.`];
  return parsed(decoded.text, warnings);
}

async function parseDocx(buffer: Buffer): Promise<ParsedAttachmentFields> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const warnings = result.messages.map((message) => message.message).filter(Boolean);
    return parsed(result.value, warnings);
  } catch (error) {
    return failed(error instanceof Error ? error.message : "DOCX parsing failed.");
  }
}

async function parseDoc(buffer: Buffer): Promise<ParsedAttachmentFields> {
  try {
    const document = await new WordExtractor().extract(buffer);
    const text = [
      document.getBody({ filterUnicode: false }),
      document.getFootnotes({ filterUnicode: false }),
      document.getEndnotes({ filterUnicode: false }),
      document.getHeaders({ filterUnicode: false }),
      document.getAnnotations({ filterUnicode: false }),
      document.getTextboxes({ filterUnicode: false }),
    ].filter((segment) => segment.trim().length > 0).join("\n\n");
    return parsed(text);
  } catch (error) {
    return failed(error instanceof Error ? error.message : "DOC parsing failed.");
  }
}

async function parsePdf(buffer: Buffer): Promise<ParsedAttachmentFields> {
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const document = await loadingTask.promise;
    try {
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter((value) => value.trim().length > 0)
          .join(" ");
        if (pageText.trim()) pages.push(pageText);
        page.cleanup();
      }
      if (pages.length === 0) {
        return failed("PDF has no extractable text; OCR is required.");
      }
      return parsed(pages.join("\n\n"));
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    return failed(error instanceof Error ? error.message : "PDF parsing failed.");
  }
}

export async function parseWorkshopAttachmentUpload(
  input: UploadWorkshopAttachmentInput,
): Promise<ParsedAttachmentFields> {
  const decoded = decodeBase64(input);
  if (!Buffer.isBuffer(decoded)) return decoded;
  const extension = extensionFor(input.fileName);
  if (extension === ".doc") {
    return parseDoc(decoded);
  }
  if (extension === ".txt" || extension === ".md" || extension === ".markdown") {
    return parseText(decoded);
  }
  if (extension === ".docx") {
    return parseDocx(decoded);
  }
  if (extension === ".pdf") {
    return parsePdf(decoded);
  }
  return rejected("Supported attachment formats are .txt, .md, .doc, .docx, and text PDFs.");
}
