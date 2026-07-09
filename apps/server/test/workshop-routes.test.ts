import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { applyWorkshopAgentPrompt } from "../src/workshop/workshopAgent.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function createSeriesWithMockProfile(model = "mock-continuity-v1") {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-api-"));
  roots.push(root);
  const app = await buildApp({ libraryRoot: root });
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/series",
    payload: { title: "WorkshopApi" },
  });
  const series = created.json();
  const profile = await app.inject({
    method: "POST",
    url: `/api/v1/ai/model-profiles`,
    payload: {
      title: "Workshop mock model",
      provider: "mock",
      model,
    },
  });
  expect(profile.statusCode).toBe(201);
  return { app, series, profile: profile.json() };
}

async function createPromptFixture(
  app: Awaited<ReturnType<typeof buildApp>>,
  seriesId: string,
): Promise<{ roleId: string; promptTemplateId: string; promptTemplateVersion: number }> {
  const role = await app.inject({
    method: "POST",
    url: `/api/v1/series/${seriesId}/ai/roles`,
    payload: {
      title: "Context checker",
      persona: "Check the selected story context.",
    },
  });
  expect(role.statusCode).toBe(201);
  const prompt = await app.inject({
    method: "POST",
    url: `/api/v1/series/${seriesId}/ai/prompts`,
    payload: {
      roleId: role.json().id,
      name: "Context check",
      status: "active",
      system: "You check story context.",
      instructions: "Use the provided context and do not apply writes.",
    },
  });
  expect(prompt.statusCode).toBe(201);
  return {
    roleId: role.json().id,
    promptTemplateId: prompt.json().id,
    promptTemplateVersion: prompt.json().version,
  };
}

async function createSeriesWithOpenAiCompatibleProfile(
  providerFetch: typeof fetch,
) {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-openai-api-"));
  roots.push(root);
  const app = await buildApp({ libraryRoot: root, providerFetch });
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/series",
    payload: { title: "WorkshopOpenAiApi" },
  });
  const series = created.json();
  const profile = await app.inject({
    method: "POST",
    url: `/api/v1/ai/model-profiles`,
    payload: {
      title: "Workshop OpenAI-compatible model",
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "provider-model-a",
      contextWindowTokens: 1_000_000,
    },
  });
  expect(profile.statusCode).toBe(201);
  return { app, series, profile: profile.json() };
}

function parseSseEvents(payload: string): Array<Record<string, unknown>> {
  return payload
    .trim()
    .split(/\r?\n\r?\n/u)
    .map((block) => block
      .split(/\r?\n/u)
      .find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(5).trimStart()) as Record<string, unknown>);
}

function base64(buffer: Buffer): string {
  return buffer.toString("base64");
}

function gbkBufferForChineseAttachmentEvidence(): Buffer {
  return Buffer.from([
    0xd6, 0xd0, 0xce, 0xc4,
    0xb8, 0xbd, 0xbc, 0xfe,
    0xd6, 0xa4, 0xbe, 0xdd,
  ]);
}

function utf16LeBuffer(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 * (crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const date = 33;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const contentBuffer = Buffer.from(content, "utf8");
    const crc = crc32(contentBuffer);
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    nameBuffer.copy(localHeader, 30);
    localParts.push(localHeader, contentBuffer);

    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuffer.copy(centralHeader, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + contentBuffer.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

function docxBuffer(text: string): Buffer {
  return zipStore({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`,
  });
}

function oleDirectoryEntry(input: {
  name: string;
  type: number;
  left?: number;
  right?: number;
  child?: number;
  secId?: number;
  size?: number;
}): Buffer {
  const entry = Buffer.alloc(128, 0);
  const nameBuffer = Buffer.from(`${input.name}\u0000`, "utf16le");
  nameBuffer.copy(entry, 0);
  entry.writeUInt16LE(nameBuffer.length, 64);
  entry.writeUInt8(input.type, 66);
  entry.writeUInt8(1, 67);
  entry.writeInt32LE(input.left ?? -1, 68);
  entry.writeInt32LE(input.right ?? -1, 72);
  entry.writeInt32LE(input.child ?? -1, 76);
  entry.writeInt32LE(input.secId ?? -2, 116);
  entry.writeUInt32LE(input.size ?? 0, 120);
  return entry;
}

function wordDocBuffer(text: string): Buffer {
  const encodedText = Buffer.from(text, "utf16le");
  const wordDocumentSize = 512 + encodedText.length;
  const wordDocument = Buffer.alloc(Math.ceil(wordDocumentSize / 512) * 512, 0);
  wordDocument.writeUInt16LE(0xa5ec, 0);
  wordDocument.writeUInt32LE(512, 0x0018);
  wordDocument.writeUInt32LE(text.length, 0x004c);
  wordDocument.writeUInt32LE(0, 0x01a2);
  encodedText.copy(wordDocument, 512);

  const table = Buffer.alloc(512, 0);
  table.writeUInt8(2, 0);
  table.writeUInt32LE(16, 1);
  table.writeUInt32LE(0, 5);
  table.writeUInt32LE(text.length, 9);
  table.writeUInt16LE(0, 13);
  table.writeUInt32LE(512, 15);

  const directory = Buffer.concat([
    oleDirectoryEntry({ name: "Root Entry", type: 5, child: 1 }),
    oleDirectoryEntry({ name: "WordDocument", type: 2, right: 2, secId: 1, size: wordDocumentSize }),
    oleDirectoryEntry({ name: "0Table", type: 2, secId: 3, size: 21 }),
    oleDirectoryEntry({ name: "", type: 0 }),
  ]);

  const fat = Buffer.alloc(512, 0xff);
  fat.writeInt32LE(-2, 0);
  fat.writeInt32LE(2, 4);
  fat.writeInt32LE(-2, 8);
  fat.writeInt32LE(-2, 12);
  fat.writeInt32LE(-3, 16);

  const header = Buffer.alloc(512, 0xff);
  Buffer.from("D0CF11E0A1B11AE1", "hex").copy(header, 0);
  header.fill(0, 8, 76);
  header.writeUInt16LE(0x003e, 24);
  header.writeUInt16LE(0x0003, 26);
  header.writeUInt16LE(0xfffe, 28);
  header.writeUInt16LE(9, 30);
  header.writeUInt16LE(6, 32);
  header.writeInt32LE(1, 44);
  header.writeInt32LE(0, 48);
  header.writeUInt32LE(0, 56);
  header.writeInt32LE(-2, 60);
  header.writeInt32LE(0, 64);
  header.writeInt32LE(-2, 68);
  header.writeInt32LE(0, 72);
  header.fill(0xff, 76);
  header.writeInt32LE(4, 76);

  return Buffer.concat([
    header,
    directory,
    wordDocument.subarray(0, 512),
    wordDocument.subarray(512, 1024),
    table,
    fat,
  ]);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\(/gu, "\\(").replace(/\)/gu, "\\)");
}

function pdfBuffer(text: string | null): Buffer {
  const stream = text
    ? `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`
    : "q Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(content, "ascii"));
    content += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(content, "ascii");
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    content += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(content, "ascii");
}

async function uploadAttachment(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  seriesId: string;
  sessionId: string;
  draftToken: string;
  fileName: string;
  mediaType: string;
  buffer: Buffer;
}) {
  return input.app.inject({
    method: "POST",
    url: `/api/v1/series/${input.seriesId}/workshop/sessions/${input.sessionId}/attachments`,
    payload: {
      draftToken: input.draftToken,
      fileName: input.fileName,
      mediaType: input.mediaType,
      sizeBytes: input.buffer.byteLength,
      base64Content: base64(input.buffer),
    },
  });
}

function openAiStreamFetch(responseText: string | (() => string)): typeof fetch {
  return async (input) => {
    if (String(input) === "https://example.test/v1/chat/completions") {
      const text = typeof responseText === "function" ? responseText() : responseText;
      return new Response([
        `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
        "",
        "data: [DONE]",
        "",
        "",
      ].join("\n"), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    return new Response(JSON.stringify({ error: { message: "not found" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
}

function agentToolStep(input: {
  tool: "codex.create_entry" | "codex.update_entry";
  draft: Record<string, unknown>;
  message?: string;
}): string {
  return JSON.stringify({
    schemaVersion: 1,
    type: "request_tool",
    tool: input.tool,
    message: input.message ?? "Prepared a Codex tool request.",
    draft: input.draft,
  });
}

async function createAgentToolMessage(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  seriesId: string;
  sessionId: string;
  modelProfileId: string;
  userRequest?: string;
}) {
  const call = await input.app.inject({
    method: "POST",
    url: `/api/v1/series/${input.seriesId}/workshop/sessions/${input.sessionId}/calls`,
    payload: {
      mode: "agent",
      userRequest: input.userRequest ?? "Prepare a Codex tool request.",
      modelProfileId: input.modelProfileId,
    },
  });
  expect(call.statusCode, call.payload).toBe(200);
  expect(call.json().toolMessages).toHaveLength(1);
  return call.json().toolMessages[0] as { id: string; role: string; mode: string; content: string };
}

describe("M5 Workshop API routes", () => {
  it("uses a neutral default session title and branches with copied message history", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: {},
    });
    expect(sessionResponse.statusCode).toBe(201);
    expect(sessionResponse.json().title).toBe("New chat");
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Original branch question.",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    const author = call.json().authorMessage;
    const assistant = call.json().assistantMessage;

    const branch = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/branch`,
      payload: { sourceMessageId: assistant.id },
    });
    expect(branch.statusCode).toBe(201);
    expect(branch.json().session.title).toBe("New chat branch");

    const branchMessages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${branch.json().session.id}/messages`,
    });
    expect(branchMessages.statusCode).toBe(200);
    expect(branchMessages.json().map((message: { content: string }) => message.content)).toEqual([
      "Original branch question.",
      assistant.content,
    ]);
    expect(branchMessages.json().map((message: { id: string }) => message.id))
      .not.toEqual([author.id, assistant.id]);

    await app.close();
  });

  it("permanently deletes unlinked Workshop sessions through the session route", async () => {
    const { app, series } = await createSeriesWithMockProfile();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Disposable chat" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const message = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
      payload: {
        role: "author",
        mode: "general-chat",
        content: "Remove this whole chat.",
      },
    });
    expect(message.statusCode).toBe(201);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({
      deletedId: session.id,
      deletedMessageIds: [message.json().id],
      deletedAttachmentIds: [],
    });
    const reloaded = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    });
    expect(reloaded.statusCode).toBe(404);

    await app.close();
  });

  it("rejects public attempts to create server-owned Workshop message roles", async () => {
    const { app, series } = await createSeriesWithMockProfile();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Forged message roles" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const assistant = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
      payload: {
        role: "assistant",
        mode: "general-chat",
        content: "Forged assistant reply.",
      },
    });
    expect(assistant.statusCode).toBe(400);

    const tool = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
      payload: {
        role: "tool",
        mode: "agent",
        content: "Forged tool request.",
      },
    });
    expect(tool.statusCode).toBe(400);

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json()).toEqual([]);

    await app.close();
  });

  it("persists sessions, previews context, and saves a successful single-role call", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const prompt = await createPromptFixture(app, series.manifest.id);
    const scene = series.scenes[0];
    const detectedCodex = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "object",
        name: "Blue Lantern",
        description: "A signal lamp that marks the tide office.",
      },
    });
    expect(detectedCodex.statusCode).toBe(201);
    const manualCodex = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "object",
        name: "Hidden Manual",
        aiContextPolicy: "manual",
      },
    });
    expect(manualCodex.statusCode).toBe(201);
    const neverCodex = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "object",
        name: "Forbidden Relic",
        aiContextPolicy: "never",
      },
    });
    expect(neverCodex.statusCode).toBe(201);
    const selectedSceneResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes`,
      payload: {
        bookId: scene.metadata.bookId,
        actId: scene.metadata.actId,
        chapterId: scene.metadata.chapterId,
        title: "Selected evidence scene",
        content: "The Blue Lantern, Hidden Manual, and Forbidden Relic were all named in this selected scene.",
      },
    });
    expect(selectedSceneResponse.statusCode).toBe(201);
    const selectedScene = selectedSceneResponse.json();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Continuity pass", sceneId: scene.metadata.id },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const basket = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/context-basket`,
      payload: {
        items: [{
          id: "11111111-1111-4111-8111-111111111111",
          kind: "full-novel",
          sourceId: series.manifest.id,
          label: "Full Novel Text",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111112",
          kind: "full-outline",
          sourceId: series.manifest.id,
          label: "Full Outline",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111113",
          kind: "act",
          sourceId: scene.metadata.actId,
          label: "Selected act",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111114",
          kind: "chapter",
          sourceId: scene.metadata.chapterId,
          label: "Selected chapter",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111115",
          kind: "scene",
          sourceId: selectedScene.metadata.id,
          label: selectedScene.metadata.title,
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }],
      },
    });
    expect(basket.statusCode).toBe(200);
    expect(basket.json().items).toHaveLength(6);
    expect(basket.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "codex-entry",
        sourceId: detectedCodex.json().metadata.id,
        note: "Linked from selected context.",
      }),
    ]));

    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/context-preview`,
      payload: {
        mode: "continuity-check",
        userRequest: "Check continuity for this scene.",
        roleId: prompt.roleId,
        taskKind: "continuity-check",
        promptTemplateId: prompt.promptTemplateId,
        promptTemplateVersion: prompt.promptTemplateVersion,
        modelProfileId: profile.id,
      },
    });
    expect(preview.statusCode).toBe(200);
    const previewItems = preview.json().items as Array<{ kind: string; source: { id: string | null }; title: string }>;
    expect(previewItems.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "full-novel",
      "full-outline",
      "act",
      "chapter",
      "scene",
      "codex-entry",
    ]));
    expect(previewItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "scene", source: expect.objectContaining({ id: selectedScene.metadata.id }) }),
      expect.objectContaining({ kind: "codex-entry", source: expect.objectContaining({ id: detectedCodex.json().metadata.id }) }),
    ]));
    expect(previewItems.some((item) => item.source.id === manualCodex.json().metadata.id)).toBe(false);
    expect(previewItems.some((item) => item.source.id === neverCodex.json().metadata.id)).toBe(false);

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "continuity-check",
        userRequest: "Check continuity for this scene.",
        roleId: prompt.roleId,
        taskKind: "continuity-check",
        promptTemplateId: prompt.promptTemplateId,
        promptTemplateVersion: prompt.promptTemplateVersion,
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode, call.payload).toBe(200);
    expect(call.json()).toMatchObject({ status: "succeeded" });
    expect(call.json().responseText).toContain("MockProvider");

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json().map((message: { role: string }) => message.role)).toEqual(["author", "assistant"]);

    const modelLog = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/calls/${call.json().modelCallId}`,
    });
    expect(modelLog.statusCode).toBe(200);
    expect(modelLog.json()).toMatchObject({
      id: call.json().modelCallId,
      contextBundleId: call.json().contextBundleId,
      status: "succeeded",
    });

    const proposals = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
    });
    expect(proposals.statusCode).toBe(200);
    expect(proposals.json().items).toEqual([]);

    const assistantMessage = messages.json().find((message: { role: string }) => message.role === "assistant");
    const target = {
      kind: "scene-content",
      targetId: scene.metadata.id,
      label: scene.metadata.title,
      baseRevision: scene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };
    const createdProposal = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${assistantMessage.id}/proposals`,
      payload: {
        type: "text-insertion",
        title: "Insert Workshop response",
        summary: "Workshop candidate",
        target,
        riskLevel: "medium",
        confidence: null,
        reason: "Review before applying.",
        patches: [{
          id: "11111111-1111-4111-8111-111111111111",
          target,
          action: "insert-text",
          before: null,
          after: assistantMessage.content,
          unifiedDiff: `+${assistantMessage.content}`,
        }],
        evidence: [{
          sourceType: "workshop-message",
          sourceId: assistantMessage.id,
          revision: null,
          quote: "",
          note: "Workshop source message.",
        }],
      },
    });
    expect(createdProposal.statusCode).toBe(201);
    expect(createdProposal.json().proposal.proposal.source).toMatchObject({
      kind: "workshop-message",
      sourceId: assistantMessage.id,
      label: "Continuity pass",
    });
    expect(createdProposal.json().message.proposalIds).toEqual([createdProposal.json().proposal.proposal.id]);

    const sourceMessage = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/messages/${assistantMessage.id}/source`,
    });
    expect(sourceMessage.statusCode).toBe(200);
    expect(sourceMessage.json().session.id).toBe(session.id);
    expect(sourceMessage.json().message.id).toBe(assistantMessage.id);

    const linkedMessages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(linkedMessages.json().find((message: { id: string }) => message.id === assistantMessage.id).proposalIds)
      .toEqual([createdProposal.json().proposal.proposal.id]);

    await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/archive`,
    });
    const archivedSourceProposal = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/review/proposals/${createdProposal.json().proposal.proposal.id}`,
    });
    expect(archivedSourceProposal.statusCode).toBe(200);
    expect(archivedSourceProposal.json().sourceAvailability).toMatchObject({
      available: false,
      reason: "Source Workshop session is archived",
    });

    await app.close();
  });

  it("uploads parsed Workshop attachments and includes them in the call ContextBundle", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Attachment context" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const uploads = await Promise.all([
      uploadAttachment({
        app,
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "draft-attachments",
        fileName: "notes.txt",
        mediaType: "text/plain",
        buffer: Buffer.from("TXT attachment evidence.", "utf8"),
      }),
      uploadAttachment({
        app,
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "draft-attachments",
        fileName: "outline.md",
        mediaType: "text/markdown",
        buffer: Buffer.from("# Markdown attachment evidence", "utf8"),
      }),
      uploadAttachment({
        app,
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "draft-attachments",
        fileName: "gbk-notes.txt",
        mediaType: "text/plain",
        buffer: gbkBufferForChineseAttachmentEvidence(),
      }),
      uploadAttachment({
        app,
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "draft-attachments",
        fileName: "utf16-notes.txt",
        mediaType: "text/plain",
        buffer: utf16LeBuffer("UTF-16 attachment evidence."),
      }),
      uploadAttachment({
        app,
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "draft-attachments",
        fileName: "legacy.doc",
        mediaType: "application/msword",
        buffer: wordDocBuffer("DOC attachment evidence."),
      }),
      uploadAttachment({
        app,
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "draft-attachments",
        fileName: "brief.docx",
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: docxBuffer("DOCX attachment evidence."),
      }),
      uploadAttachment({
        app,
        seriesId: series.manifest.id,
        sessionId: session.id,
        draftToken: "draft-attachments",
        fileName: "source.pdf",
        mediaType: "application/pdf",
        buffer: pdfBuffer("PDF attachment evidence."),
      }),
    ]);
    for (const upload of uploads) {
      expect(upload.statusCode).toBe(201);
      expect(upload.json()).toMatchObject({ parseStatus: "parsed", messageId: null });
    }
    expect(uploads[0]!.json().extractedText).toContain("TXT attachment evidence");
    expect(uploads[2]!.json().extractedText).toContain("\u4e2d\u6587\u9644\u4ef6\u8bc1\u636e");
    expect(uploads[3]!.json().extractedText).toContain("UTF-16 attachment evidence");
    expect(uploads[4]!.json().extractedText).toContain("DOC attachment evidence");
    expect(uploads[5]!.json().extractedText).toContain("DOCX attachment evidence");
    expect(uploads[6]!.json().extractedText).toContain("PDF attachment evidence");

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/attachments?draftToken=draft-attachments`,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(7);

    const attachmentIds = uploads.map((upload) => upload.json().id);
    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Answer using the attachments.",
        systemPrompt: "Use the supplied context.",
        modelProfileId: profile.id,
        draftToken: "draft-attachments",
        attachmentIds,
      },
    });
    expect(call.statusCode, call.payload).toBe(200);
    expect(call.json().authorMessage.attachmentIds).toEqual(attachmentIds);
    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${call.json().contextBundleId}`,
    });
    expect(context.statusCode).toBe(200);
    const attachmentItems = context.json().items.filter((item: { kind: string }) =>
      item.kind === "message-attachment",
    );
    expect(attachmentItems).toHaveLength(7);
    expect(attachmentItems.map((item: { source: { type: string } }) => item.source.type))
      .toEqual(Array(7).fill("workshop-message-attachment"));
    expect(attachmentItems.map((item: { content: string }) => item.content).join("\n"))
      .toContain("DOCX attachment evidence");

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().attachments.filter((attachment: { messageId: string | null }) => attachment.messageId))
      .toHaveLength(7);

    await app.close();
  });

  it("sends attachments and previous Workshop chat history to OpenAI-compatible providers", async () => {
    const chatBodies: Array<Record<string, unknown>> = [];
    const providerFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url === "https://example.test/v1/chat/completions") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        chatBodies.push(body);
        const responseText = chatBodies.length === 1 ? "First answer from provider." : "Second answer from provider.";
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { content: responseText } }] })}`,
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(providerFetch);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Provider request context" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const upload = await uploadAttachment({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "provider-draft",
      fileName: "evidence.txt",
      mediaType: "text/plain",
      buffer: Buffer.from("Provider attachment evidence.", "utf8"),
    });
    expect(upload.statusCode).toBe(201);

    const firstCall = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "First question about file.",
        systemPrompt: "Use the supplied context.",
        modelProfileId: profile.id,
        draftToken: "provider-draft",
        attachmentIds: [upload.json().id],
      },
    });
    expect(firstCall.statusCode).toBe(200);
    expect(firstCall.json().responseText).toBe("First answer from provider.");

    const secondCall = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Follow-up question.",
        systemPrompt: "Use the supplied context.",
        modelProfileId: profile.id,
      },
    });
    expect(secondCall.statusCode).toBe(200);
    expect(secondCall.json().responseText).toBe("Second answer from provider.");

    expect(chatBodies).toHaveLength(2);
    const firstUserContent = JSON.stringify(chatBodies[0]);
    expect(firstUserContent).toContain("Attachment: evidence.txt");
    expect(firstUserContent).toContain("Provider attachment evidence.");
    const secondUserContent = JSON.stringify(chatBodies[1]);
    expect(secondUserContent).toContain("Workshop chat history");
    expect(secondUserContent).toContain("First question about file.");
    expect(secondUserContent).toContain("First answer from provider.");
    expect(secondUserContent).toContain("Provider attachment evidence.");
    expect(secondUserContent).toContain("Follow-up question.");

    const secondContext = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${secondCall.json().contextBundleId}`,
    });
    expect(secondContext.statusCode).toBe(200);
    const historyItems = secondContext.json().items.filter((item: { kind: string }) =>
      item.kind === "workshop-chat-history",
    );
    expect(historyItems).toHaveLength(1);
    expect(historyItems[0].content).toContain("First question about file.");
    expect(historyItems[0].content).toContain("Provider attachment evidence.");
    expect(historyItems[0].content).not.toContain("Follow-up question.");

    await app.close();
  });

  it("streams OpenAI-compatible reasoning fields as Workshop reasoning deltas", async () => {
    const providerFetch: typeof fetch = async (input) => {
      if (String(input) === "https://example.test/v1/chat/completions") {
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "DeepSeek trace." } }] })}`,
          "",
          `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "OpenRouter trace." } }] })}`,
          "",
          `data: ${JSON.stringify({ choices: [{ delta: { reasoning_details: [{ type: "reasoning.text", text: "Details trace." }] } }] })}`,
          "",
          `data: ${JSON.stringify({ choices: [{ delta: { thinking: "Ollama trace." } }] })}`,
          "",
          `data: ${JSON.stringify({ choices: [{ delta: { content: "Final answer." } }] })}`,
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(providerFetch);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Provider reasoning" },
    });
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls/stream`,
      payload: {
        mode: "general-chat",
        userRequest: "Show reasoning.",
        systemPrompt: "Use the supplied context.",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    const events = parseSseEvents(call.body);
    const reasoningEvents = events.filter((event) => event.type === "reasoning-delta");
    expect(reasoningEvents.map((event) => event.text)).toEqual([
      "DeepSeek trace.",
      "OpenRouter trace.",
      "Details trace.",
      "Ollama trace.",
    ]);
    const assistant = events.find((event) => event.type === "assistant-message") as {
      message: { content: string; reasoningContent: string };
    };
    expect(assistant.message.content).toBe("Final answer.");
    expect(assistant.message.reasoningContent).toContain("DeepSeek trace.");
    expect(assistant.message.reasoningContent).toContain("OpenRouter trace.");
    expect(assistant.message.reasoningContent).toContain("Details trace.");
    expect(assistant.message.reasoningContent).toContain("Ollama trace.");

    await app.close();
  });

  it("rejects unsupported attachments and invalid attachment references", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Attachment rejects" },
    });
    const session = sessionResponse.json();
    const otherSessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Other attachments" },
    });
    const otherSession = otherSessionResponse.json();

    const damagedDoc = await uploadAttachment({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "rejects",
      fileName: "damaged.doc",
      mediaType: "application/msword",
      buffer: Buffer.from("not actually a Word binary file", "utf8"),
    });
    expect(damagedDoc.statusCode).toBe(201);
    expect(damagedDoc.json()).toMatchObject({ parseStatus: "failed" });
    const empty = await uploadAttachment({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "rejects",
      fileName: "empty.txt",
      mediaType: "text/plain",
      buffer: Buffer.alloc(0),
    });
    expect(empty.json()).toMatchObject({ parseStatus: "rejected" });
    const binaryText = await uploadAttachment({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "rejects",
      fileName: "binary.txt",
      mediaType: "text/plain",
      buffer: Buffer.from([0, 1, 2, 3, 4, 5]),
    });
    expect(binaryText.json()).toMatchObject({ parseStatus: "rejected" });
    const scannedPdf = await uploadAttachment({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "rejects",
      fileName: "scan.pdf",
      mediaType: "application/pdf",
      buffer: pdfBuffer(null),
    });
    expect(scannedPdf.json()).toMatchObject({ parseStatus: "failed" });
    expect(scannedPdf.json().parseError).toContain("OCR");

    const parsed = await uploadAttachment({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "valid-draft",
      fileName: "valid.txt",
      mediaType: "text/plain",
      buffer: Buffer.from("Valid parsed text.", "utf8"),
    });
    const otherParsed = await uploadAttachment({
      app,
      seriesId: series.manifest.id,
      sessionId: otherSession.id,
      draftToken: "valid-draft",
      fileName: "other.txt",
      mediaType: "text/plain",
      buffer: Buffer.from("Other session text.", "utf8"),
    });
    const basePayload = {
      mode: "general-chat",
      userRequest: "Use attachment.",
      systemPrompt: "Use the supplied context.",
      modelProfileId: profile.id,
    };
    const wrongDraft = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        ...basePayload,
        draftToken: "wrong-draft",
        attachmentIds: [parsed.json().id],
      },
    });
    expect(wrongDraft.statusCode).not.toBe(200);
    const failedReference = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        ...basePayload,
        draftToken: "rejects",
        attachmentIds: [scannedPdf.json().id],
      },
    });
    expect(failedReference.statusCode).not.toBe(200);
    const crossSession = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        ...basePayload,
        draftToken: "valid-draft",
        attachmentIds: [otherParsed.json().id],
      },
    });
    expect(crossSession.statusCode).not.toBe(200);

    const bound = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        ...basePayload,
        draftToken: "valid-draft",
        attachmentIds: [parsed.json().id],
      },
    });
    expect(bound.statusCode).toBe(200);
    const alreadyBound = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        ...basePayload,
        draftToken: "valid-draft",
        attachmentIds: [parsed.json().id],
      },
    });
    expect(alreadyBound.statusCode).not.toBe(200);

    await app.close();
  });

  it("preserves input and context on model failure without creating an empty Proposal", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile("mock-provider-error");
    const prompt = await createPromptFixture(app, series.manifest.id);
    const scene = series.scenes[0];
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Failing call", sceneId: scene.metadata.id },
    });
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "continuity-check",
        userRequest: "This request should be preserved.",
        roleId: prompt.roleId,
        taskKind: "continuity-check",
        promptTemplateId: prompt.promptTemplateId,
        promptTemplateVersion: prompt.promptTemplateVersion,
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    expect(call.json()).toMatchObject({ status: "failed" });

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.json()[0]).toMatchObject({
      role: "author",
      content: "This request should be preserved.",
    });
    expect(messages.json()[1]).toMatchObject({
      role: "assistant",
      status: "failed",
      contextBundleId: call.json().contextBundleId,
      modelCallId: call.json().modelCallId,
    });

    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${call.json().contextBundleId}`,
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().userRequest).toBe("This request should be preserved.");

    const proposals = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
    });
    expect(proposals.json().items).toEqual([]);

    await app.close();
  });

  it("uses custom General Chat system prompts and blocks Proposal creation from those replies", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const scene = series.scenes[0];
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "General chat" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const otherSessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Other export chat" },
    });
    expect(otherSessionResponse.statusCode).toBe(201);
    const otherSession = otherSessionResponse.json();
    const otherCall = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${otherSession.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Other session private export text.",
        systemPrompt: "This prompt belongs to the other session.",
        modelProfileId: profile.id,
      },
    });
    expect(otherCall.statusCode).toBe(200);

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Talk through options without creating a write candidate.",
        systemPrompt: "Answer as a private context-aware story consultant.",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    expect(call.json()).toMatchObject({ status: "succeeded" });
    expect(call.json().authorMessage).toMatchObject({ mode: "general-chat" });
    expect(call.json().assistantMessage).toMatchObject({ mode: "general-chat" });

    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${call.json().contextBundleId}`,
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().sceneId).toBeNull();
    expect(context.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "role-instruction",
        source: expect.objectContaining({ type: "user-input" }),
        title: "Runtime prompt override",
        content: "Answer as a private context-aware story consultant.",
      }),
    ]));
    expect(context.json().items.some((item: { kind: string }) => item.kind === "prompt-template")).toBe(false);

    const emptyPromptPreview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/context-preview`,
      payload: {
        mode: "general-chat",
        userRequest: "Use no system prompt.",
        systemPrompt: "",
        modelProfileId: profile.id,
      },
    });
    expect(emptyPromptPreview.statusCode).toBe(200);
    expect(emptyPromptPreview.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "role-instruction",
        source: expect.objectContaining({ type: "user-input" }),
        title: "Runtime prompt override",
        content: "",
      }),
    ]));
    expect(emptyPromptPreview.json().items.some((item: { kind: string }) => item.kind === "prompt-template")).toBe(false);

    const assistantMessage = call.json().assistantMessage;
    const target = {
      kind: "scene-content",
      targetId: scene.metadata.id,
      label: scene.metadata.title,
      baseRevision: scene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };
    const blockedProposal = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${assistantMessage.id}/proposals`,
      payload: {
        type: "text-insertion",
        title: "Blocked general chat proposal",
        summary: "Should not enter Review",
        target,
        riskLevel: "medium",
        confidence: null,
        reason: "General chat is not a proposal source.",
        patches: [{
          id: "11111111-1111-4111-8111-111111111111",
          target,
          action: "insert-text",
          before: null,
          after: assistantMessage.content,
          unifiedDiff: `+${assistantMessage.content}`,
        }],
        evidence: [{
          sourceType: "workshop-message",
          sourceId: assistantMessage.id,
          revision: null,
          quote: "",
          note: "General chat source message.",
        }],
      },
    });
    expect(blockedProposal.statusCode).not.toBe(201);
    expect(blockedProposal.json().message).toContain("General Chat messages cannot create Proposals");

    await app.close();
  });

  it("resends General Chat author messages by overwriting later history only in chat sessions", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Resend chat" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const firstCall = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Original request.",
        modelProfileId: profile.id,
      },
    });
    expect(firstCall.statusCode).toBe(200);
    const first = firstCall.json().authorMessage;
    const firstAnswer = firstCall.json().assistantMessage;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const laterCall = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Later request.",
        modelProfileId: profile.id,
      },
    });
    expect(laterCall.statusCode).toBe(200);
    const later = laterCall.json().authorMessage;
    const laterAnswer = laterCall.json().assistantMessage;

    const resend = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${first.id}/resend`,
      payload: {
        content: "Updated request.",
        systemPrompt: "Answer as a private context-aware story consultant.",
        modelProfileId: profile.id,
      },
    });
    expect(resend.statusCode).toBe(200);
    expect(resend.json().authorMessage).toMatchObject({
      id: first.id,
      mode: "general-chat",
      role: "author",
      content: "Updated request.",
    });
    expect(resend.json().assistantMessage).toMatchObject({
      mode: "general-chat",
      role: "assistant",
      status: "succeeded",
    });
    expect(resend.json().toolMessages).toEqual([]);
    expect(resend.json().deletedMessageIds).toEqual([
      firstAnswer.id,
      later.id,
      laterAnswer.id,
    ]);

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json().map((message: { id: string }) => message.id)).toEqual([
      first.id,
      resend.json().assistantMessage.id,
    ]);
    expect(messages.json().map((message: { content: string }) => message.content)).not.toContain("Later request.");

    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${resend.json().contextBundleId}`,
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().userRequest).toBe("Updated request.");

    const agentSessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent no resend" },
    });
    expect(agentSessionResponse.statusCode).toBe(201);
    const agentSession = agentSessionResponse.json();
    const agentAuthor = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${agentSession.id}/messages`,
      payload: {
        role: "author",
        mode: "agent",
        content: "Draft a Codex entry.",
      },
    });
    expect(agentAuthor.statusCode).toBe(201);
    const rejected = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${agentSession.id}/messages/${agentAuthor.json().id}/resend`,
      payload: {
        content: "Updated Agent request.",
        modelProfileId: profile.id,
      },
    });
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json().message).toContain("Only General Chat sessions can resend messages");

    await app.close();
  });

  it("runs Agent sessions with a structured step protocol and blocks generic scene Proposals", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const scene = series.scenes[0]!;
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    expect(session.kind).toBe("agent");

    const agentPrompt = applyWorkshopAgentPrompt({
      system: "Base",
      instructions: "Base instructions",
      user: "User",
    });
    expect(agentPrompt.system).toBe("Base");
    expect(agentPrompt.instructions).toContain("Conversation comes first");
    expect(agentPrompt.instructions).toContain("Writing method");
    expect(agentPrompt.instructions).toContain('"type":"request_tool"');
    expect(agentPrompt.instructions).toContain('"tool":"codex.create_entry"');
    expect(agentPrompt.instructions).toContain('"tool":"codex.update_entry"');
    expect(agentPrompt.instructions).toContain("patch.progressions");
    expect(agentPrompt.instructions).toContain("Base instructions");
    expect(agentPrompt.instructions).not.toContain("Do not write Tool Call text");
    expect(agentPrompt.instructions).not.toContain("Workshop surface: Dialogue Agent");

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "agent",
        userRequest: "Draft a Codex entry for the blue-salt key.",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    expect(call.json()).toMatchObject({ status: "succeeded" });
    expect(call.json().authorMessage).toMatchObject({ mode: "agent" });
    expect(call.json().assistantMessage).toMatchObject({ mode: "agent" });

    const target = {
      kind: "scene-content",
      targetId: scene.metadata.id,
      label: scene.metadata.title,
      baseRevision: scene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };
    const blockedProposal = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${call.json().assistantMessage.id}/proposals`,
      payload: {
        type: "text-insertion",
        title: "Blocked Agent proposal",
        summary: "Should not enter scene Review",
        target,
        riskLevel: "medium",
        confidence: null,
        reason: "Agent is not a manuscript Proposal source.",
        patches: [{
          id: "11111111-1111-4111-8111-111111111111",
          target,
          action: "insert-text",
          before: null,
          after: call.json().assistantMessage.content,
          unifiedDiff: `+${call.json().assistantMessage.content}`,
        }],
        evidence: [{
          sourceType: "workshop-message",
          sourceId: call.json().assistantMessage.id,
          revision: null,
          quote: "",
          note: "Agent source message.",
        }],
      },
    });
    expect(blockedProposal.statusCode).not.toBe(201);
    expect(blockedProposal.json().message).toContain(
      "Agent messages require an approved tool adapter or dedicated Proposal path",
    );

    const legacyMode = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "codex-creation",
        userRequest: "Draft a Codex entry for the blue-salt key.",
        modelProfileId: profile.id,
      },
    });
    expect(legacyMode.statusCode).toBe(400);
    expect(legacyMode.json().message).toContain("Codex Creation is no longer a Workshop mode");

    await app.close();
  });

  it("sends Agent provider requests without prompt-audit context duplication", async () => {
    const chatBodies: Array<Record<string, unknown>> = [];
    const providerFetch: typeof fetch = async (input, init) => {
      if (String(input) === "https://example.test/v1/chat/completions") {
        chatBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { content: "可以，先讨论这个设定。" } }] })}`,
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(providerFetch);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent prompt filter" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "agent",
        userRequest: "先和我讨论星坠晶，不要创建 Codex。",
        roleId: "lead-writing-partner",
        taskKind: "custom",
        promptTemplateId: "00000000-0000-4000-8000-000000000406",
        promptTemplateVersion: 1,
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);

    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${call.json().contextBundleId}`,
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().roleId).toBe("workshop-agent");
    expect(context.json().taskKind).toBe("custom");
    expect(context.json().promptTemplateId).toBe("00000000-0000-4000-8000-000000000422");
    expect(context.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "role-instruction" }),
      expect.objectContaining({ kind: "user-request" }),
    ]));
    expect(context.json().items.some((item: { kind: string }) => item.kind === "prompt-template")).toBe(false);
    expect(JSON.stringify(context.json().items)).not.toContain("lead-writing-partner");
    expect(JSON.stringify(context.json().items)).not.toContain("主笔伙伴");
    expect(JSON.stringify(context.json().items)).not.toContain("Context checker");
    expect(JSON.stringify(context.json().items)).not.toContain("Use the provided context");

    expect(chatBodies).toHaveLength(1);
    const messages = chatBodies[0]!.messages as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toContain("Conversation comes first");
    expect(messages[0]!.content).toContain("Workshop Agent");
    expect(messages[1]!.content).toBe("先和我讨论星坠晶，不要创建 Codex。");
    expect(messages[1]!.content).not.toContain("Context checker");
    expect(messages[1]!.content).not.toContain("You check story context.");
    expect(messages[1]!.content).not.toContain("Use the provided context");
    expect(JSON.stringify(messages)).not.toContain("lead-writing-partner");
    expect(JSON.stringify(messages)).not.toContain("主笔伙伴");

    await app.close();
  });

  it("sends pending Agent Codex drafts back to the provider for follow-up draft revisions", async () => {
    const chatBodies: Array<Record<string, unknown>> = [];
    const providerFetch: typeof fetch = async (input, init) => {
      if (String(input) === "https://example.test/v1/chat/completions") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { messages: Array<{ content: string }> };
        chatBodies.push(body as unknown as Record<string, unknown>);
        const userContent = body.messages[1]?.content ?? "";
        const responseText = userContent.includes("Pending Codex draft")
          ? agentToolStep({
            tool: "codex.create_entry",
            message: "Updated Weeping Star Shard draft.",
            draft: {
              aliases: ["Weeping Star Shards"],
              categoryId: "object",
              description:
                "A sorrowful crystal mistaken for a component of the blue-salt key. It only forms near clocktower gears.",
              details: [
                { label: "False lead", value: "It misdirects seekers away from the real blue-salt key." },
                { label: "Formation", value: "It only forms near clocktower gears." },
              ],
              name: "Weeping Star Shard",
              research: "Source: current Workshop Agent conversation.",
            },
          })
          : agentToolStep({
            tool: "codex.create_entry",
            message: "Prepared Weeping Star Shard draft.",
            draft: {
              aliases: ["Weeping Star Shards"],
              categoryId: "object",
              description: "A sorrowful crystal mistaken for a component of the blue-salt key.",
              details: [
                { label: "False lead", value: "It misdirects seekers away from the real blue-salt key." },
              ],
              name: "Weeping Star Shard",
              research: "Source: current Workshop Agent conversation.",
            },
          });
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { content: responseText } }] })}`,
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(providerFetch);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent pending draft revision" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const first = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "agent",
        userRequest: "I like Weeping Star Shard. It is a false lead for the blue-salt key. Put that into a Codex draft.",
        modelProfileId: profile.id,
      },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().toolMessages).toHaveLength(1);

    const second = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "agent",
        userRequest: "Add one more bit: it only forms near clocktower gears.",
        modelProfileId: profile.id,
      },
    });
    expect(second.statusCode, second.payload).toBe(200);
    expect(second.json().toolMessages).toHaveLength(1);
    expect(chatBodies).toHaveLength(2);
    const secondProviderUser = (chatBodies[1]!.messages as Array<{ content: string }>)[1]!.content;
    expect(secondProviderUser).toContain("Pending Codex draft");
    expect(secondProviderUser).toContain("Weeping Star Shard");
    expect(secondProviderUser).toContain("codex.create_entry");

    const revisedTool = JSON.parse(second.json().toolMessages[0].content);
    expect(revisedTool.draft.details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Formation",
        value: "It only forms near clocktower gears.",
      }),
    ]));

    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${second.json().contextBundleId}`,
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "pending-codex-draft" }),
    ]));

    await app.close();
  });

  it("saves direct structured Agent Codex tool JSON as a tool message", async () => {
    const directToolJson = JSON.stringify({
      schemaVersion: 1,
      tool: "codex.create_entry",
      draft: {
        aliases: ["WSS"],
        categoryId: "object",
        description: "A false lead for the blue-salt key.",
        details: [{ label: "Formation", value: "It only forms near clocktower gears." }],
        name: "Weeping Star Shard",
        research: "Source: current Workshop Agent conversation.",
      },
    });
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(openAiStreamFetch(directToolJson));
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent direct tool json" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "agent",
        userRequest: "Refresh the Codex draft request.",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode, call.payload).toBe(200);
    expect(call.json().assistantMessage.content).toBe("Prepared a Codex entry draft.");
    expect(call.json().toolMessages).toHaveLength(1);
    expect(JSON.parse(call.json().toolMessages[0].content).draft.aliases).toEqual(["WSS"]);

    await app.close();
  });

  it("saves ordinary Agent prose as a normal assistant reply without a tool message", async () => {
    let requestCount = 0;
    const providerFetch: typeof fetch = async (input) => {
      if (String(input) === "https://example.test/v1/chat/completions") {
        requestCount += 1;
        const responseText = "可以。这个设定更适合先写成可选 Codex 草稿，再由你决定是否入库。";
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { content: responseText } }] })}`,
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ object: "list", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(providerFetch);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent ordinary reply" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "agent",
        userRequest: "先和我讨论一下星坠晶这个设定。",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    expect(requestCount).toBe(1);
    expect(call.json().assistantMessage.content).toContain("可选 Codex 草稿");
    expect(call.json().assistantMessage.content).not.toContain("structured response");
    expect(call.json().toolMessages).toHaveLength(0);

    await app.close();
  });

  it("does not stream or execute simulated Agent tool-call text", async () => {
    const providerFetch: typeof fetch = async (input) => {
      if (String(input) === "https://example.test/v1/chat/completions") {
        const responseText = [
          "好的，我现在直接创建。",
          "",
          "Tool Call: codex-create",
          "```json",
          JSON.stringify({
            entry: {
              name: "星辉晶",
              aliases: ["夜空泪"],
              category: "矿物/魔法材料",
              description: "星辉晶是一种半透明的蓝紫色矿石，只在千年一次的星落之夜自然析出。",
              details: {
                硬度: "摩氏6.5",
                产出地: "仅出现于陨石坑的熔壳层",
              },
              confidence: "speculative—无任何来源",
              evidence: "无外部资料、无故事内部参考，纯推测。",
            },
          }),
          "```",
        ].join("\n");
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { content: responseText } }] })}`,
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(providerFetch);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent run" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls/stream`,
      payload: {
        mode: "agent",
        userRequest: "创建一个 Codex 条目：星辉晶。",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    const events = parseSseEvents(call.body);
    expect(events.filter((event) => event.type === "delta")).toHaveLength(0);
    expect(JSON.stringify(events)).not.toContain("codex-create");
    const done = events.find((event) => event.type === "done") as {
      result: {
        assistantMessage: { content: string };
        toolMessages: Array<{ role: string; mode: string; content: string }>;
      };
    };
    expect(done.result.assistantMessage.content).toContain("好的，我现在直接创建");
    expect(done.result.assistantMessage.content).not.toContain("structured response");
    expect(done.result.assistantMessage.content).not.toContain("Tool Call");
    expect(done.result.toolMessages).toHaveLength(0);

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json().map((message: { role: string }) => message.role)).toEqual([
      "author",
      "assistant",
    ]);

    await app.close();
  });

  it("creates a server-owned Codex tool message from a structured Agent step", async () => {
    const providerFetch: typeof fetch = async (input) => {
      if (String(input) === "https://example.test/v1/chat/completions") {
        const responseText = JSON.stringify({
          schemaVersion: 1,
          type: "request_tool",
          tool: "codex.create_entry",
          message: "已整理为待确认的 Codex 草稿。",
          draft: {
            categoryId: "object",
            name: "星辉晶",
            aliases: ["夜空泪"],
            description: "星辉晶是一种半透明的蓝紫色矿石，只在千年一次的星落之夜自然析出。",
            details: [
              { label: "硬度", value: "摩氏6.5" },
              { label: "产出地", value: "仅出现于陨石坑的熔壳层" },
            ],
            research: "Author decision recorded in this Agent session.",
          },
        });
        return new Response([
          `data: ${JSON.stringify({ choices: [{ delta: { content: responseText } }] })}`,
          "",
          "data: [DONE]",
          "",
          "",
        ].join("\n"), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(providerFetch);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent run" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls/stream`,
      payload: {
        mode: "agent",
        userRequest: "创建一个 Codex 条目：星辉晶。",
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    const events = parseSseEvents(call.body);
    expect(events.filter((event) => event.type === "delta")).toHaveLength(0);
    const done = events.find((event) => event.type === "done") as {
      result: {
        assistantMessage: { content: string };
        toolMessages: Array<{ role: string; mode: string; content: string }>;
      };
    };
    expect(done.result.assistantMessage.content).toContain("已整理为待确认的 Codex 草稿");
    expect(done.result.toolMessages).toHaveLength(1);
    expect(done.result.toolMessages[0]).toMatchObject({ role: "tool", mode: "agent" });
    expect(JSON.parse(done.result.toolMessages[0]!.content)).toMatchObject({
      schemaVersion: 1,
      tool: "codex.create_entry",
      draft: {
        categoryId: "object",
        name: "星辉晶",
      },
    });

    await app.close();
  });

  it("executes an author-approved Agent codex.create_entry tool call as a new Codex entry", async () => {
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(openAiStreamFetch(agentToolStep({
      tool: "codex.create_entry",
      message: "已整理为待确认的 Codex 草稿。",
      draft: {
        aliases: ["Lin Alice", "Alice"],
        categoryId: "character",
        description: "Alice is Lin Che's sister. She is alive and imprisoned in the Clocktower of Tides.",
        details: [
          { label: "Status", value: "Alive, real, and imprisoned." },
          { label: "Prop", value: "A modified old harbor measuring rod." },
        ],
        name: "Alice",
        research: "Source: author-approved Workshop character ruling.",
      },
    })));
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent create entry" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const statusDetailType = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: { categoryId: "character", name: "Status" },
    });
    const propDetailType = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: { categoryId: "character", name: "Prop" },
    });
    expect(statusDetailType.statusCode).toBe(201);
    expect(propDetailType.statusCode).toBe(201);
    const draftMessage = await createAgentToolMessage({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      modelProfileId: profile.id,
      userRequest: "Create the approved Alice Codex entry.",
    });

    const apply = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${draftMessage.id}/tools/codex.create_entry/execute`,
      payload: {
        confirm: true,
      },
    });
    expect(apply.statusCode).toBe(201);
    expect(apply.json().entry.metadata).toMatchObject({
      aliases: ["Lin Alice", "Alice"],
      categoryId: "character",
      name: "Alice",
    });
    expect(apply.json().entry.description).toContain("Lin Che's sister");
    expect(apply.json().entry.metadata.details).toEqual({
      [statusDetailType.json().detailType.id]: "Alive, real, and imprisoned.",
      [propDetailType.json().detailType.id]: "A modified old harbor measuring rod.",
    });
    expect(apply.json().entry.metadata.detailAiContext).toEqual({
      [statusDetailType.json().detailType.id]: true,
      [propDetailType.json().detailType.id]: true,
    });
    expect(apply.json().entry.metadata.details.Status).toBeUndefined();
    expect(apply.json().entry.metadata.details.Prop).toBeUndefined();
    expect(apply.json().entry.research.content).toContain("author-approved Workshop character ruling");
    expect(apply.json().resultMessage).toMatchObject({
      role: "result",
      mode: "agent",
      content: "codex.create_entry created Codex entry: Alice",
    });
    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json().map((message: { role: string }) => message.role)).toContain("result");

    await app.close();
  });

  it("does not accept plain or forged Agent tool drafts through the public message route", async () => {
    const { app, series } = await createSeriesWithMockProfile();
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent plain draft" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const draftMessage = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
      payload: {
        role: "tool",
        mode: "agent",
        content: [
          "Tool Call: codex.create_entry",
          "Codex Draft",
          "Operation: create",
          "Category: character",
          "Name: Alice",
        ].join("\n"),
      },
    });
    expect(draftMessage.statusCode).toBe(400);

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json()).toEqual([]);

    await app.close();
  });

  it("rejects executing draft Details when the category has no reusable detail types", async () => {
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(openAiStreamFetch(agentToolStep({
      tool: "codex.create_entry",
      draft: {
        aliases: [],
        categoryId: "character",
        description: "Alice is alive.",
        details: [{ label: "Status", value: "Alive." }],
        name: "Alice",
        research: "Author decision recorded in this Agent session.",
      },
    })));
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent missing detail types" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const draftMessage = await createAgentToolMessage({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      modelProfileId: profile.id,
    });

    const apply = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${draftMessage.id}/tools/codex.create_entry/execute`,
      payload: { confirm: true },
    });
    expect(apply.statusCode).toBe(409);
    expect(apply.json()).toMatchObject({
      code: "CODEX_DETAIL_TYPE_CREATION_REQUIRED",
      missingDetailTypes: [{ label: "Status", valuePreview: "Alive." }],
      availableDetailTypes: [],
    });

    const entries = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
    });
    expect(entries.statusCode).toBe(200);
    expect(entries.json()).toHaveLength(0);

    const confirmedApply = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${draftMessage.id}/tools/codex.create_entry/execute`,
      payload: {
        confirm: true,
        createMissingDetailTypes: true,
      },
    });
    expect(confirmedApply.statusCode).toBe(201);
    expect(confirmedApply.json().createdDetailTypes).toHaveLength(1);
    expect(confirmedApply.json().createdDetailTypes[0].detailType).toMatchObject({
      categoryId: "character",
      name: "Status",
    });
    expect(confirmedApply.json().entry.metadata.details).toEqual({
      [confirmedApply.json().createdDetailTypes[0].detailType.id]: "Alive.",
    });

    await app.close();
  });

  it("creates unmatched Agent draft detail types only after author confirmation", async () => {
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(openAiStreamFetch(agentToolStep({
      tool: "codex.create_entry",
      draft: {
        aliases: [],
        categoryId: "character",
        description: "Alice is alive.",
        details: [{ label: "Looks", value: "Blonde hair." }],
        name: "Alice",
        research: "Author decision recorded in this Agent session.",
      },
    })));
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent similar detail labels" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const appearanceDetailType = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: { categoryId: "character", name: "Appearance" },
    });
    expect(appearanceDetailType.statusCode).toBe(201);
    const draftMessage = await createAgentToolMessage({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      modelProfileId: profile.id,
    });

    const apply = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${draftMessage.id}/tools/codex.create_entry/execute`,
      payload: { confirm: true },
    });
    expect(apply.statusCode).toBe(409);
    expect(apply.json()).toMatchObject({
      code: "CODEX_DETAIL_TYPE_CREATION_REQUIRED",
      missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde hair." }],
    });
    expect(apply.json().availableDetailTypes.map((item: { detailType: { name: string } }) =>
      item.detailType.name,
    )).toEqual(["Appearance"]);

    const entries = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
    });
    expect(entries.statusCode).toBe(200);
    expect(entries.json()).toHaveLength(0);

    const confirmedApply = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${draftMessage.id}/tools/codex.create_entry/execute`,
      payload: {
        confirm: true,
        createMissingDetailTypes: true,
      },
    });
    expect(confirmedApply.statusCode).toBe(201);
    expect(confirmedApply.json().createdDetailTypes).toHaveLength(1);
    expect(confirmedApply.json().createdDetailTypes[0].detailType).toMatchObject({
      categoryId: "character",
      name: "Looks",
    });
    expect(confirmedApply.json().entry.metadata.details).toEqual({
      [confirmedApply.json().createdDetailTypes[0].detailType.id]: "Blonde hair.",
    });
    expect(confirmedApply.json().entry.metadata.details.Looks).toBeUndefined();
    expect(confirmedApply.json().entry.metadata.details.Appearance).toBeUndefined();

    await app.close();
  });

  it("executes Agent codex.update_entry progression create update and delete operations", async () => {
    let agentResponseText = "";
    const { app, series, profile } = await createSeriesWithOpenAiCompatibleProfile(openAiStreamFetch(() => agentResponseText));
    const scene = series.scenes[0]!;
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { kind: "agent", title: "Agent update progressions" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();
    const entryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "character",
        name: "Alice",
        description: "Alice baseline.",
      },
    });
    expect(entryResponse.statusCode).toBe(201);
    const entry = entryResponse.json();
    const progressionBase = {
      kind: "field",
      entryId: entry.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "replace",
      effectiveFromSceneId: scene.metadata.id,
      effectiveToSceneId: null,
      source: { kind: "codex-page", sceneId: null, blockId: null, sourceId: null },
      evidence: [],
    };
    const progressionToUpdate = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        ...progressionBase,
        body: "Old progression body.",
        summary: "Old summary.",
      },
    });
    const progressionToDelete = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        ...progressionBase,
        body: "Delete this progression.",
        summary: "Delete summary.",
      },
    });
    expect(progressionToUpdate.statusCode).toBe(201);
    expect(progressionToDelete.statusCode).toBe(201);

    agentResponseText = agentToolStep({
      tool: "codex.update_entry",
      draft: {
        target: { entryId: entry.metadata.id },
        patch: {
          progressions: [
            {
              action: "create",
              input: {
                kind: "field",
                field: { kind: "description", detailTypeId: null },
                operation: "replace",
                body: "Alice is alive in the Clocktower.",
                summary: "Alice living Clocktower state.",
                effectiveFromSceneId: scene.metadata.id,
              },
            },
            {
              action: "update",
              progressionId: progressionToUpdate.json().progression.id,
              input: {
                baseRevision: progressionToUpdate.json().revision,
                body: "Updated progression body.",
                summary: "Updated summary.",
              },
            },
            {
              action: "delete",
              progressionId: progressionToDelete.json().progression.id,
              input: {
                baseRevision: progressionToDelete.json().revision,
              },
            },
          ],
        },
      },
    });
    const draftMessage = await createAgentToolMessage({
      app,
      seriesId: series.manifest.id,
      sessionId: session.id,
      modelProfileId: profile.id,
    });

    const apply = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${draftMessage.id}/tools/codex.update_entry/execute`,
      payload: { confirm: true },
    });
    expect(apply.statusCode).toBe(201);
    expect(apply.json().entry.metadata.id).toBe(entry.metadata.id);
    expect(apply.json().createdProgressions).toHaveLength(1);
    expect(apply.json().createdProgressions[0].progression).toMatchObject({
      entryId: entry.metadata.id,
      body: "Alice is alive in the Clocktower.",
      source: { kind: "codex-page" },
    });
    expect(apply.json().updatedProgressions).toHaveLength(1);
    expect(apply.json().updatedProgressions[0].progression).toMatchObject({
      id: progressionToUpdate.json().progression.id,
      body: "Updated progression body.",
      summary: "Updated summary.",
    });
    expect(apply.json().deletedProgressions).toEqual([
      { deletedId: progressionToDelete.json().progression.id, blockers: [] },
    ]);
    expect(apply.json().resultMessage.content).toContain("1 progression(s) created");
    expect(apply.json().resultMessage.content).toContain("1 progression(s) updated");
    expect(apply.json().resultMessage.content).toContain("1 progression(s) deleted");

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions?kind=field&entryId=${entry.metadata.id}`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().map((document: { progression: { id: string } }) => document.progression.id))
      .not.toContain(progressionToDelete.json().progression.id);

    await app.close();
  });

  it("exports Workshop session history with optional reasoning and reconstructed provider prompts", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile("mock-reasoning-v1");
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Export chat" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const otherSessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Other export chat" },
    });
    expect(otherSessionResponse.statusCode).toBe(201);
    const otherSession = otherSessionResponse.json();
    const otherCall = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${otherSession.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Other session private export text.",
        systemPrompt: "This prompt belongs to the other session.",
        modelProfileId: profile.id,
      },
    });
    expect(otherCall.statusCode).toBe(200);

    const attachmentBody = Buffer.from("Attachment export body must not appear.", "utf8");
    const upload = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/attachments`,
      payload: {
        draftToken: "export-draft",
        fileName: "export-secret.txt",
        mediaType: "text/plain",
        sizeBytes: attachmentBody.length,
        base64Content: base64(attachmentBody),
      },
    });
    expect(upload.statusCode).toBe(201);

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Talk through the scene without writing.",
        systemPrompt: "Answer as a private context-aware story consultant.",
        modelProfileId: profile.id,
        attachmentIds: [upload.json().id],
        draftToken: "export-draft",
      },
    });
    expect(call.statusCode, call.payload).toBe(200);
    const result = call.json() as {
      assistantMessage: { reasoningContent: string };
    };
    expect(result.assistantMessage.reasoningContent.trim()).not.toBe("");

    const withoutReasoning = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/export`,
    });
      expect(withoutReasoning.statusCode, withoutReasoning.payload).toBe(200);
      expect(withoutReasoning.headers["content-type"]).toContain("text/markdown");
      expect(withoutReasoning.headers["content-disposition"]).toContain(`workshop-${session.id}.md`);
      expect(withoutReasoning.payload.charCodeAt(0)).toBe(0xfeff);
      expect(withoutReasoning.payload).toContain("# Workshop Export: Export chat");
      expect(withoutReasoning.payload).toContain("- Include prompt audit: no");
      expect(withoutReasoning.payload).toContain("Talk through the scene without writing.");
      expect(withoutReasoning.payload).toContain(`export-secret.txt (parsed, text/plain, ${attachmentBody.length} bytes)`);
      expect(withoutReasoning.payload).not.toContain("Provider Prompt:");
      expect(withoutReasoning.payload).not.toContain("Context Items Sent To Provider:");
      expect(withoutReasoning.payload).not.toContain("Answer as a private context-aware story consultant.");
      expect(withoutReasoning.payload).not.toContain("[attachment content omitted from export; see attachment records]");
      expect(withoutReasoning.payload).not.toContain("Attachment export body must not appear.");
      expect(withoutReasoning.payload).not.toContain("Other session private export text.");
      expect(withoutReasoning.payload).not.toContain("This prompt belongs to the other session.");
      expect(withoutReasoning.payload).not.toContain(result.assistantMessage.reasoningContent);

    const withReasoning = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/export?includeReasoning=true`,
    });
    expect(withReasoning.statusCode).toBe(200);
    expect(withReasoning.payload.charCodeAt(0)).toBe(0xfeff);
    expect(withReasoning.payload).toContain("Reasoning:");
    expect(withReasoning.payload).toContain(result.assistantMessage.reasoningContent);
    expect(withReasoning.payload).toContain(`export-secret.txt (parsed, text/plain, ${attachmentBody.length} bytes)`);
    expect(withReasoning.payload).not.toContain("Provider Prompt:");
    expect(withReasoning.payload).not.toContain("Attachment export body must not appear.");
    expect(withReasoning.payload).not.toContain("Other session private export text.");
    expect(withReasoning.payload).not.toContain("This prompt belongs to the other session.");

    const withPromptAudit = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/export?includePromptAudit=true`,
    });
    expect(withPromptAudit.statusCode).toBe(200);
    expect(withPromptAudit.payload.charCodeAt(0)).toBe(0xfeff);
    expect(withPromptAudit.payload).toContain("- Include prompt audit: yes");
    expect(withPromptAudit.payload).toContain("Provider Prompt:");
    expect(withPromptAudit.payload).toContain("Context Items Sent To Provider:");
    expect(withPromptAudit.payload).toContain("Answer as a private context-aware story consultant.");
    expect(withPromptAudit.payload).toContain("[attachment content omitted from export; see attachment records]");
    expect(withPromptAudit.payload).not.toContain("Attachment export body must not appear.");
    expect(withPromptAudit.payload).not.toContain("Other session private export text.");
    expect(withPromptAudit.payload).not.toContain("This prompt belongs to the other session.");

    await app.close();
  });

  it("streams General Chat replies with separated reasoning and supports deleting unlinked records", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile("mock-reasoning-v1");
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Streaming chat" },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const stream = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls/stream`,
      payload: {
        mode: "general-chat",
        userRequest: "Talk through the scene without writing.",
        systemPrompt: "Answer as a private context-aware story consultant.",
        modelProfileId: profile.id,
      },
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    const events = parseSseEvents(stream.payload);
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "author-message",
      "metadata",
      "reasoning-delta",
      "delta",
      "assistant-message",
      "done",
    ]));
    const done = events.find((event) => event.type === "done") as {
      result: { assistantMessage: { id: string; content: string; reasoningContent: string } };
    };
    expect(done.result.assistantMessage.content).toContain("公开回复");
    expect(done.result.assistantMessage.content).not.toContain("<think>");
    expect(done.result.assistantMessage.reasoningContent).toContain("先检查用户请求");

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${done.result.assistantMessage.id}`,
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().deletedId).toBe(done.result.assistantMessage.id);
    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.json().map((message: { id: string }) => message.id)).not.toContain(done.result.assistantMessage.id);

    await app.close();
  });
});
