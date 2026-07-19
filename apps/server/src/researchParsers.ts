import { createHash } from "node:crypto";
import path from "node:path";
import { TextDecoder } from "node:util";
import {
  MAX_RESEARCH_SOURCE_BYTES,
  type ResearchSourceKind,
  type ResearchSourceLocation,
  type ResearchSourceMediaType,
} from "@novel-studio/contracts";
import { StorageError } from "@novel-studio/storage";
import JSZip, { type JSZipObject } from "jszip";
import mammoth from "mammoth";
import * as parse5 from "parse5";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type ParsedResearchBlockKind = "heading" | "paragraph" | "list-item" | "quote" | "table-cell";

export interface ParsedResearchSection {
  order: number;
  parentOrder: number | null;
  title: string;
  location: ResearchSourceLocation;
}

export interface ParsedResearchBlock {
  order: number;
  sectionOrder: number | null;
  kind: ParsedResearchBlockKind;
  text: string;
  location: ResearchSourceLocation;
}

export interface ParsedResearchDocument {
  kind: ResearchSourceKind;
  mediaType: ResearchSourceMediaType;
  parserName: string;
  parserVersion: number;
  title: string;
  warnings: string[];
  sections: ParsedResearchSection[];
  blocks: ParsedResearchBlock[];
  sanitizedSnapshot?: Buffer;
}

interface HtmlNode {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
  parentNode?: HtmlNode;
}

interface ZipDataShape {
  compressedSize?: number;
  uncompressedSize?: number;
}

type InspectedZipObject = JSZipObject & {
  unsafeOriginalName?: string;
  _data?: ZipDataShape;
};

const MAX_ZIP_ENTRIES = 10_000;
const MAX_ZIP_EXPANDED_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_RATIO = 100;
const PARSE_TIMEOUT_MS = 20_000;
const HTML_BLOCK_TAGS = new Set(["p", "li", "blockquote", "td", "th"]);
const HTML_DROP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "canvas",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "video",
  "audio",
  "source",
  "picture",
  "template",
  "link",
]);

function fail(message: string, details?: Record<string, unknown>): never {
  throw new StorageError(message, "INVALID_DATA", details);
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/gu, "\n").replace(/[\t ]+/gu, " ").trim();
}

function decodeBase64(contentBase64: string, declaredSize: number): Buffer {
  if (declaredSize <= 0 || declaredSize > MAX_RESEARCH_SOURCE_BYTES) {
    fail(`Research source must be between 1 byte and ${MAX_RESEARCH_SOURCE_BYTES} bytes`);
  }
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.byteLength !== declaredSize || bytes.toString("base64") !== contentBase64) {
    fail("Research source base64 or declared byte count is invalid", {
      actualSize: bytes.byteLength,
      declaredSize,
    });
  }
  return bytes;
}

function hasBinaryControlText(text: string): boolean {
  if (text.includes("\u0000")) return true;
  const characters = Array.from(text);
  if (characters.length === 0) return false;
  const controls = characters.filter((character) => {
    const value = character.codePointAt(0) ?? 0;
    return value < 32 && character !== "\n" && character !== "\r" && character !== "\t";
  }).length;
  return controls / characters.length > 0.02;
}

function decodeCandidate(bytes: Buffer, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "");
  } catch {
    return null;
  }
}

function decodedTextScore(value: string): number {
  if (!value || hasBinaryControlText(value)) return Number.NEGATIVE_INFINITY;
  let score = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0xfffd) score -= 20;
    else if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3040 && code <= 0x30ff)) score += 4;
    else if (code >= 0x20 && code <= 0x7e) score += 2;
    else score += 0.5;
  }
  return score / Array.from(value).length;
}

function decodeText(bytes: Buffer): { text: string; encoding: string } {
  const bomCandidates: Array<{ bom: Buffer; encoding: string; label: string }> = [
    { bom: Buffer.from([0xef, 0xbb, 0xbf]), encoding: "utf-8", label: "UTF-8" },
    { bom: Buffer.from([0xff, 0xfe]), encoding: "utf-16le", label: "UTF-16 LE" },
    { bom: Buffer.from([0xfe, 0xff]), encoding: "utf-16be", label: "UTF-16 BE" },
  ];
  for (const candidate of bomCandidates) {
    if (!bytes.subarray(0, candidate.bom.length).equals(candidate.bom)) continue;
    const text = decodeCandidate(bytes.subarray(candidate.bom.length), candidate.encoding);
    if (text !== null && !hasBinaryControlText(text)) return { text, encoding: candidate.label };
  }

  const utf8 = decodeCandidate(bytes, "utf-8");
  if (utf8 !== null && !hasBinaryControlText(utf8)) return { text: utf8, encoding: "UTF-8" };

  const candidates = [
    ["gb18030", "GB18030/GBK"],
    ["big5", "Big5"],
    ["shift_jis", "Shift_JIS"],
    ["windows-1252", "Windows-1252"],
  ] as const;
  const decodedCandidates: Array<{ text: string; encoding: string; score: number }> = [];
  for (const [encoding, label] of candidates) {
    const text = decodeCandidate(bytes, encoding);
    if (text === null) continue;
    const score = decodedTextScore(text);
    if (Number.isFinite(score)) decodedCandidates.push({ text, encoding: label, score });
  }
  const decoded = decodedCandidates.sort((left, right) => right.score - left.score)[0];
  if (!decoded) fail("Research source uses an unsupported or damaged text encoding");
  return { text: decoded.text, encoding: decoded.encoding };
}

function sourceExtension(fileName: string): string {
  return path.extname(fileName).toLocaleLowerCase("und");
}

export function classifyResearchSource(
  fileName: string,
  mediaType: ResearchSourceMediaType,
): ResearchSourceKind {
  const extension = sourceExtension(fileName);
  const expected: Partial<Record<string, { kind: ResearchSourceKind; mediaTypes: ResearchSourceMediaType[] }>> = {
    ".txt": { kind: "txt", mediaTypes: ["text/plain"] },
    ".md": { kind: "markdown", mediaTypes: ["text/markdown", "text/plain"] },
    ".markdown": { kind: "markdown", mediaTypes: ["text/markdown", "text/plain"] },
    ".docx": {
      kind: "docx",
      mediaTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    },
    ".pdf": { kind: "pdf", mediaTypes: ["application/pdf"] },
    ".epub": { kind: "epub", mediaTypes: ["application/epub+zip"] },
    ".html": { kind: "html", mediaTypes: ["text/html"] },
    ".htm": { kind: "html", mediaTypes: ["text/html"] },
    ".xhtml": { kind: "html", mediaTypes: ["application/xhtml+xml", "text/html"] },
  };
  const match = expected[extension];
  if (!match || !match.mediaTypes.includes(mediaType)) {
    fail("Research source extension and media type do not match a supported format", { extension, mediaType });
  }
  return match.kind;
}

function textLocation(text: string, startOffset: number, endOffset: number): ResearchSourceLocation {
  const startLine = text.slice(0, startOffset).split("\n").length;
  const endLine = text.slice(0, endOffset).split("\n").length;
  return { kind: "text", startLine, endLine, startOffset, endOffset };
}

function parsePlainText(text: string, kind: "txt" | "markdown"): Omit<ParsedResearchDocument, "mediaType"> {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const sections: ParsedResearchSection[] = [];
  const blocks: ParsedResearchBlock[] = [];
  const headingStack: Array<{ level: number; sectionOrder: number }> = [];
  const paragraphPattern = /[^\n](?:.*?)(?=\n{2,}|$)/gsu;
  for (const match of normalized.matchAll(paragraphPattern)) {
    const raw = match[0];
    const value = normalizeText(raw);
    if (!value) continue;
    const rawStart = match.index ?? 0;
    const rawEnd = rawStart + raw.length;
    const heading = kind === "markdown" ? /^(#{1,6})\s+(.+)$/u.exec(value) : null;
    let blockKind: ParsedResearchBlockKind = "paragraph";
    let blockText = value;
    let sectionOrder = headingStack.at(-1)?.sectionOrder ?? null;
    if (heading) {
      const level = heading[1]!.length;
      blockText = heading[2]!.trim();
      blockKind = "heading";
      while ((headingStack.at(-1)?.level ?? 0) >= level) headingStack.pop();
      const parentOrder = headingStack.at(-1)?.sectionOrder ?? null;
      sectionOrder = sections.length;
      sections.push({
        order: sectionOrder,
        parentOrder,
        title: blockText,
        location: textLocation(normalized, rawStart, rawEnd),
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
      location: textLocation(normalized, rawStart, rawEnd),
    });
  }
  if (blocks.length === 0) fail("Research source has no extractable text");
  return {
    kind,
    parserName: kind === "markdown" ? "novel-studio-markdown" : "novel-studio-text",
    parserVersion: 1,
    title: sections[0]?.title ?? "",
    warnings: [],
    sections,
    blocks,
  };
}

function childNodes(node: HtmlNode): HtmlNode[] {
  return node.childNodes ?? [];
}

function elementAttribute(node: HtmlNode, name: string): string | null {
  return node.attrs?.find((attribute) => attribute.name.toLocaleLowerCase("und") === name)?.value ?? null;
}

function collectText(node: HtmlNode): string {
  if (node.nodeName === "#text") return node.value ?? "";
  return childNodes(node).map(collectText).join("");
}

function walk(node: HtmlNode, visitor: (node: HtmlNode) => void): void {
  visitor(node);
  for (const child of childNodes(node)) walk(child, visitor);
}

function sanitizeHtmlTree(root: HtmlNode): void {
  const sanitizeChildren = (node: HtmlNode): void => {
    const kept: HtmlNode[] = [];
    for (const child of childNodes(node)) {
      const tag = child.tagName?.toLocaleLowerCase("und");
      if (child.nodeName === "#comment" || (tag && HTML_DROP_TAGS.has(tag))) continue;
      if (child.attrs) {
        child.attrs = child.attrs.filter((attribute) => {
          const name = attribute.name.toLocaleLowerCase("und");
          if (name.startsWith("on") || name === "style" || name === "src" || name === "srcset") return false;
          if (name === "href") {
            const value = attribute.value.trim();
            return /^(?:https?:|mailto:|#)/iu.test(value);
          }
          return name === "href" || name === "title" || name === "lang" || name === "dir";
        });
      }
      sanitizeChildren(child);
      kept.push(child);
    }
    node.childNodes = kept;
  };
  sanitizeChildren(root);
}

function htmlDomPath(node: HtmlNode): string {
  const parts: string[] = [];
  let current: HtmlNode | undefined = node;
  while (current?.parentNode) {
    if (current.tagName) {
      const siblings = childNodes(current.parentNode).filter((sibling) => sibling.tagName === current!.tagName);
      parts.unshift(`${current.tagName}:nth-of-type(${siblings.indexOf(current) + 1})`);
    }
    current = current.parentNode;
  }
  return parts.length > 0 ? parts.join(" > ") : "body";
}

function extractHtmlDocument(
  html: string,
  locationFactory: (node: HtmlNode, paragraph: number, sectionPath: string[]) => ResearchSourceLocation,
): { title: string; sections: ParsedResearchSection[]; blocks: ParsedResearchBlock[]; sanitizedHtml: string } {
  const document = parse5.parse(html) as unknown as HtmlNode;
  sanitizeHtmlTree(document);
  const sections: ParsedResearchSection[] = [];
  const blocks: ParsedResearchBlock[] = [];
  const headingStack: Array<{ level: number; sectionOrder: number; title: string }> = [];
  let documentTitle = "";
  walk(document, (node) => {
    const tag = node.tagName?.toLocaleLowerCase("und");
    if (tag === "title" && !documentTitle) documentTitle = normalizeText(collectText(node));
    const headingMatch = tag ? /^h([1-6])$/u.exec(tag) : null;
    if (headingMatch) {
      const value = normalizeText(collectText(node));
      if (!value) return;
      const level = Number.parseInt(headingMatch[1]!, 10);
      while ((headingStack.at(-1)?.level ?? 0) >= level) headingStack.pop();
      const sectionPath = [...headingStack.map((item) => item.title), value];
      const sectionOrder = sections.length;
      const location = locationFactory(node, blocks.length + 1, sectionPath);
      sections.push({
        order: sectionOrder,
        parentOrder: headingStack.at(-1)?.sectionOrder ?? null,
        title: value,
        location,
      });
      headingStack.push({ level, sectionOrder, title: value });
      blocks.push({
        order: blocks.length,
        sectionOrder,
        kind: "heading",
        text: value,
        location,
      });
      if (!documentTitle) documentTitle = value;
      return;
    }
    if (!tag || !HTML_BLOCK_TAGS.has(tag)) return;
    const value = normalizeText(collectText(node));
    if (!value) return;
    const kind: ParsedResearchBlockKind = tag === "li"
      ? "list-item"
      : tag === "blockquote"
        ? "quote"
        : tag === "td" || tag === "th"
          ? "table-cell"
          : "paragraph";
    const sectionPath = headingStack.map((item) => item.title);
    blocks.push({
      order: blocks.length,
      sectionOrder: headingStack.at(-1)?.sectionOrder ?? null,
      kind,
      text: value,
      location: locationFactory(node, blocks.length + 1, sectionPath),
    });
  });
  if (blocks.length === 0) fail("HTML source has no extractable text");
  return {
    title: documentTitle,
    sections,
    blocks,
    sanitizedHtml: parse5.serialize(document as never),
  };
}

function zipEntryName(entry: InspectedZipObject): string {
  return entry.unsafeOriginalName ?? entry.name;
}

function validateArchivePath(name: string): void {
  const normalized = name.replace(/\\/gu, "/");
  if (
    normalized.startsWith("/")
    || /^[A-Za-z]:\//u.test(normalized)
    || normalized.split("/").includes("..")
    || path.posix.normalize(normalized).startsWith("../")
  ) {
    fail("Archive contains an unsafe path", { entry: name });
  }
}

async function inspectZip(bytes: Buffer, expectedKind: "DOCX" | "EPUB"): Promise<JSZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  } catch (error) {
    fail(`${expectedKind} archive is damaged`, { cause: error instanceof Error ? error.message : String(error) });
  }
  const entries = Object.values(zip.files) as InspectedZipObject[];
  if (entries.length === 0 || entries.length > MAX_ZIP_ENTRIES) {
    fail(`${expectedKind} archive contains an unsafe number of entries`, { entryCount: entries.length });
  }
  let totalExpanded = 0;
  for (const entry of entries) {
    validateArchivePath(zipEntryName(entry));
    const permissions = typeof entry.unixPermissions === "string"
      ? Number.parseInt(entry.unixPermissions, 8)
      : entry.unixPermissions ?? 0;
    if ((permissions & 0o170000) === 0o120000) {
      fail(`${expectedKind} archive contains a symbolic link`, { entry: zipEntryName(entry) });
    }
    if (entry.dir) continue;
    const compressed = entry._data?.compressedSize;
    const expanded = entry._data?.uncompressedSize;
    if (!Number.isSafeInteger(compressed) || !Number.isSafeInteger(expanded) || expanded! < 0 || compressed! < 0) {
      fail(`${expectedKind} archive has invalid size metadata`, { entry: zipEntryName(entry) });
    }
    totalExpanded += expanded!;
    if (totalExpanded > MAX_ZIP_EXPANDED_BYTES || expanded! / Math.max(1, compressed!) > MAX_ZIP_RATIO) {
      fail(`${expectedKind} archive exceeds safe expansion limits`, { entry: zipEntryName(entry) });
    }
  }
  return zip;
}

function parsedXmlElements(xml: string, tagName: string): HtmlNode[] {
  const root = parse5.parseFragment(xml) as unknown as HtmlNode;
  const matches: HtmlNode[] = [];
  walk(root, (node) => {
    if (node.tagName?.toLocaleLowerCase("und").split(":").at(-1) === tagName) matches.push(node);
  });
  return matches;
}

async function parseDocx(bytes: Buffer): Promise<ParsedResearchDocument> {
  const zip = await inspectZip(bytes, "DOCX");
  for (const relationships of zip.file(/\.rels$/iu)) {
    const xml = await relationships.async("string");
    const external = parsedXmlElements(xml, "relationship")
      .find((node) => {
        const isExternal = elementAttribute(node, "targetmode")?.toLocaleLowerCase("und") === "external";
        const relationshipType = elementAttribute(node, "type")?.toLocaleLowerCase("und") ?? "";
        return isExternal && !relationshipType.endsWith("/hyperlink");
      });
    if (external) fail("DOCX contains an external file relationship and was not imported");
  }
  try {
    const converted = await mammoth.convertToHtml({ buffer: bytes }, {
      includeDefaultStyleMap: true,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    });
    const extracted = extractHtmlDocument(converted.value, (_node, paragraph, sectionPath) => ({
      kind: "docx",
      paragraph,
      sectionPath,
    }));
    return {
      kind: "docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      parserName: "mammoth-docx",
      parserVersion: 1,
      title: extracted.title,
      warnings: converted.messages.map((message) => message.message).filter(Boolean),
      sections: extracted.sections,
      blocks: extracted.blocks,
    };
  } catch (error) {
    if (error instanceof StorageError) throw error;
    fail("DOCX parsing failed", { cause: error instanceof Error ? error.message : String(error) });
  }
}

async function parsePdf(bytes: Buffer): Promise<ParsedResearchDocument> {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  try {
    const document = await loadingTask.promise;
    const blocks: ParsedResearchBlock[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const paragraphs: string[] = [];
      let current = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        current += `${current ? " " : ""}${item.str}`;
        if (item.hasEOL) {
          const value = normalizeText(current);
          if (value) paragraphs.push(value);
          current = "";
        }
      }
      const trailing = normalizeText(current);
      if (trailing) paragraphs.push(trailing);
      for (const [paragraphIndex, text] of paragraphs.entries()) {
        blocks.push({
          order: blocks.length,
          sectionOrder: null,
          kind: "paragraph",
          text,
          location: { kind: "pdf", page: pageNumber, paragraph: paragraphIndex + 1 },
        });
      }
      page.cleanup();
    }
    if (blocks.length === 0) fail("PDF has no extractable text; OCR is required");
    return {
      kind: "pdf",
      mediaType: "application/pdf",
      parserName: "pdfjs-text",
      parserVersion: 1,
      title: "",
      warnings: [],
      sections: [],
      blocks,
    };
  } catch (error) {
    if (error instanceof StorageError) throw error;
    fail("PDF parsing failed", { cause: error instanceof Error ? error.message : String(error) });
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

function resolveArchiveHref(basePath: string, href: string): string {
  const decoded = decodeURIComponent(href.split("#", 1)[0] ?? "").replace(/\\/gu, "/");
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(decoded) || decoded.startsWith("/")) {
    fail("EPUB spine contains an external or absolute resource", { href });
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(basePath), decoded));
  validateArchivePath(resolved);
  return resolved;
}

async function parseEpub(bytes: Buffer): Promise<ParsedResearchDocument> {
  const zip = await inspectZip(bytes, "EPUB");
  const mimetype = zip.file("mimetype");
  if (!mimetype || (await mimetype.async("string")).trim() !== "application/epub+zip") {
    fail("EPUB mimetype entry is missing or invalid");
  }
  const container = zip.file("META-INF/container.xml");
  if (!container) fail("EPUB container.xml is missing");
  const rootfile = parsedXmlElements(await container.async("string"), "rootfile")[0];
  const packagePath = rootfile ? elementAttribute(rootfile, "full-path") : null;
  if (!packagePath) fail("EPUB package path is missing");
  validateArchivePath(packagePath);
  const packageEntry = zip.file(packagePath);
  if (!packageEntry) fail("EPUB package document is missing", { packagePath });
  const packageXml = await packageEntry.async("string");
  const manifest = new Map(parsedXmlElements(packageXml, "item").flatMap((node) => {
    const id = elementAttribute(node, "id");
    const href = elementAttribute(node, "href");
    const mediaType = elementAttribute(node, "media-type");
    return id && href && (mediaType === "application/xhtml+xml" || mediaType === "text/html")
      ? [[id, href] as const]
      : [];
  }));
  const spine = parsedXmlElements(packageXml, "itemref")
    .map((node) => elementAttribute(node, "idref"))
    .filter((value): value is string => Boolean(value));
  if (spine.length === 0) fail("EPUB spine is empty");

  const sections: ParsedResearchSection[] = [];
  const blocks: ParsedResearchBlock[] = [];
  let title = "";
  for (const [spineIndex, idref] of spine.entries()) {
    const href = manifest.get(idref);
    if (!href) fail("EPUB spine references a missing HTML manifest item", { idref });
    const entryPath = resolveArchiveHref(packagePath, href);
    const entry = zip.file(entryPath);
    if (!entry) fail("EPUB spine file is missing", { entryPath });
    const extracted = extractHtmlDocument(await entry.async("string"), (_node, paragraph, sectionPath) => ({
      kind: "epub",
      spineIndex,
      href: entryPath,
      paragraph,
      sectionPath,
    }));
    const sectionOffset = sections.length;
    for (const section of extracted.sections) {
      sections.push({
        ...section,
        order: section.order + sectionOffset,
        parentOrder: section.parentOrder === null ? null : section.parentOrder + sectionOffset,
      });
    }
    for (const block of extracted.blocks) {
      blocks.push({
        ...block,
        order: blocks.length,
        sectionOrder: block.sectionOrder === null ? null : block.sectionOrder + sectionOffset,
      });
    }
    if (!title) title = extracted.title;
  }
  return {
    kind: "epub",
    mediaType: "application/epub+zip",
    parserName: "novel-studio-epub",
    parserVersion: 1,
    title,
    warnings: [],
    sections,
    blocks,
  };
}

function parseHtml(bytes: Buffer, sourceUrl?: string): ParsedResearchDocument {
  const decoded = decodeText(bytes);
  const extracted = extractHtmlDocument(decoded.text, (node, paragraph, sectionPath) => ({
    kind: "html",
    domPath: htmlDomPath(node),
    paragraph,
    sectionPath,
    ...(sourceUrl ? { sourceUrl } : {}),
  }));
  return {
    kind: sourceUrl ? "web-snapshot" : "html",
    mediaType: "text/html",
    parserName: "parse5-html",
    parserVersion: 1,
    title: extracted.title,
    warnings: decoded.encoding === "UTF-8" ? [] : [`HTML decoded as ${decoded.encoding}.`],
    sections: extracted.sections,
    blocks: extracted.blocks,
    sanitizedSnapshot: Buffer.from(extracted.sanitizedHtml, "utf8"),
  };
}

async function withParseTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new StorageError("Research source parsing timed out", "INVALID_DATA")), PARSE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function parseResearchFile(input: {
  contentBase64: string;
  fileName: string;
  mediaType: ResearchSourceMediaType;
  sizeBytes: number;
}): Promise<{ bytes: Buffer; contentHash: string; parsed: ParsedResearchDocument }> {
  const bytes = decodeBase64(input.contentBase64, input.sizeBytes);
  const kind = classifyResearchSource(input.fileName, input.mediaType);
  const parsed = await withParseTimeout((async () => {
    if (kind === "txt" || kind === "markdown") {
      const decoded = decodeText(bytes);
      const result = parsePlainText(decoded.text, kind);
      return {
        ...result,
        mediaType: input.mediaType,
        warnings: decoded.encoding === "UTF-8" ? result.warnings : [`Text decoded as ${decoded.encoding}.`],
      };
    }
    if (kind === "docx") return parseDocx(bytes);
    if (kind === "pdf") return parsePdf(bytes);
    if (kind === "epub") return parseEpub(bytes);
    return parseHtml(bytes);
  })());
  return {
    bytes,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    parsed,
  };
}

export function parseResearchWebSnapshot(bytes: Buffer, finalUrl: string): ParsedResearchDocument {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESEARCH_SOURCE_BYTES) {
    fail("Web snapshot size is outside the supported range");
  }
  return parseHtml(bytes, finalUrl);
}
