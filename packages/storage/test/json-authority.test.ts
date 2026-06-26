import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SceneBlockDocumentSchema } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  jsonAuthorityRevision,
  readJsonAuthorityFile,
  serializeJsonAuthority,
  StorageError,
  writeJsonAuthorityFile,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-json-"));
  temporaryDirectories.push(root);
  return root;
}

function parseSceneBlockDocument(input: unknown) {
  return SceneBlockDocumentSchema.parse(input);
}

function paragraphBlock(text: string, id = randomUUID()) {
  return {
    id,
    kind: "paragraph" as const,
    text,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("JSON authority files", () => {
  it("serializes deterministically and returns matching revisions on reload", async () => {
    const root = await temporaryRoot();
    const filePath = path.join(root, "scene.json");
    const blockId = randomUUID();
    const first = {
      schemaVersion: 1 as const,
      blocks: [paragraphBlock("第一段。", blockId)],
    };
    const sameDataDifferentKeyOrder = {
      blocks: [paragraphBlock("第一段。", blockId)],
      schemaVersion: 1 as const,
    };

    const written = await writeJsonAuthorityFile(root, filePath, first, parseSceneBlockDocument);
    const serializedAgain = serializeJsonAuthority(sameDataDifferentKeyOrder);
    expect(serializedAgain).toBe(written.raw);
    expect(jsonAuthorityRevision(serializedAgain)).toBe(written.revision);

    const reloaded = await readJsonAuthorityFile(root, filePath, parseSceneBlockDocument);
    expect(reloaded.data).toEqual(written.data);
    expect(reloaded.revision).toBe(written.revision);
    expect(await readFile(filePath, "utf8")).toBe(written.raw);
  });

  it("reports malformed JSON and schema-version mismatches as invalid data", async () => {
    const root = await temporaryRoot();
    const malformed = path.join(root, "malformed.json");
    const wrongVersion = path.join(root, "wrong-version.json");
    await writeFile(malformed, "{ not json", "utf8");
    await writeFile(wrongVersion, JSON.stringify({ schemaVersion: 2, blocks: [] }), "utf8");

    await expect(readJsonAuthorityFile(root, malformed, parseSceneBlockDocument))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(readJsonAuthorityFile(root, wrongVersion, parseSceneBlockDocument))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("rejects duplicate scene block IDs through the contract schema", async () => {
    const root = await temporaryRoot();
    const filePath = path.join(root, "duplicate-blocks.json");
    const blockId = randomUUID();
    await writeFile(
      filePath,
      serializeJsonAuthority({
        schemaVersion: 1,
        blocks: [
          paragraphBlock("第一段。", blockId),
          paragraphBlock("第二段。", blockId),
        ],
      }),
      "utf8",
    );

    await expect(readJsonAuthorityFile(root, filePath, parseSceneBlockDocument))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("rejects path escapes before reading or writing", async () => {
    const root = await temporaryRoot();
    const outside = path.join(root, "..", `${randomUUID()}.json`);
    const document = { schemaVersion: 1 as const, blocks: [] };

    await expect(writeJsonAuthorityFile(root, outside, document, parseSceneBlockDocument))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "PATH_ESCAPE" });
    await expect(readJsonAuthorityFile(root, outside, parseSceneBlockDocument))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "PATH_ESCAPE" });
  });

  it("cleans temporary files when atomic replacement fails", async () => {
    const root = await temporaryRoot();
    const targetDirectory = path.join(root, "target.json");
    await mkdir(targetDirectory);

    await expect(writeJsonAuthorityFile(
      root,
      targetDirectory,
      { schemaVersion: 1 as const, blocks: [] },
      parseSceneBlockDocument,
    )).rejects.toBeTruthy();

    const leftovers = (await readdir(root)).filter((entry) =>
      entry.startsWith("target.json.") && entry.endsWith(".tmp"),
    );
    expect(leftovers).toEqual([]);
  });
});
