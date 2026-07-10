import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyFileTransaction } from "../src/fileTransactions.js";

const temporaryDirectories: string[] = [];

async function seriesRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-file-transaction-"));
  temporaryDirectories.push(root);
  await mkdir(root, { recursive: true });
  return root;
}

async function transactionArtifacts(root: string): Promise<string[]> {
  const directory = path.join(root, ".studio", "transactions");
  try {
    return await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
});

describe("series file transaction coordination", () => {
  it("serializes concurrent transactions per series", async () => {
    const root = await seriesRoot();
    const sharedPath = path.join(root, "shared.json");
    await writeFile(sharedPath, "initial", "utf8");

    await Promise.all(Array.from({ length: 12 }, (_, index) =>
      applyFileTransaction(root, [
        { targetPath: sharedPath, content: `shared-${index}` },
        { targetPath: path.join(root, `item-${index}.json`), content: `item-${index}` },
      ])
    ));

    expect(await readFile(sharedPath, "utf8")).toBe("shared-11");
    await Promise.all(Array.from({ length: 12 }, async (_, index) => {
      expect(await readFile(path.join(root, `item-${index}.json`), "utf8"))
        .toBe(`item-${index}`);
    }));
    expect(await transactionArtifacts(root)).toEqual([]);
  });

  it("rolls back every target after an injected mid-commit failure", async () => {
    const root = await seriesRoot();
    const firstPath = path.join(root, "first.json");
    const secondPath = path.join(root, "second.json");
    await writeFile(firstPath, "first-before", "utf8");
    await writeFile(secondPath, "second-before", "utf8");

    await expect(applyFileTransaction(
      root,
      [
        { targetPath: firstPath, content: "first-after" },
        { targetPath: secondPath, content: "second-after" },
      ],
      {
        afterMutationApplied: ({ index }) => {
          if (index === 0) throw new Error("injected mid-commit failure");
        },
      },
    )).rejects.toThrow("injected mid-commit failure");

    expect(await readFile(firstPath, "utf8")).toBe("first-before");
    expect(await readFile(secondPath, "utf8")).toBe("second-before");
    expect(await transactionArtifacts(root)).toEqual([]);
    expect((await readdir(root)).some((name) => /\.(?:tmp|bak)$/u.test(name))).toBe(false);
  });
});
