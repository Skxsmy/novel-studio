import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EmbeddingRouter,
  type EmbeddingAdapter,
} from "@novel-studio/ai";
import {
  EmbeddingModelProfileSchema,
  EmbeddingUseCaseBindingDocumentSchema,
  type EmbeddingModelProfile,
  type ResearchDatabaseDocument,
} from "@novel-studio/contracts";
import {
  ProjectRepository,
  researchDatabaseRoot,
  researchVectorIndexDatabasePath,
} from "@novel-studio/storage";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const roots: string[] = [];

function upload(fileName: string, text: string, aiPermission: "never" | "allowed" = "allowed") {
  const bytes = Buffer.from(text, "utf8");
  return {
    fileName,
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
    contentBase64: bytes.toString("base64"),
    aiPermission,
  };
}

function multilingualAdapter(profile: EmbeddingModelProfile, fail = false): EmbeddingAdapter {
  return {
    profile,
    async embedBatch(request) {
      if (fail) throw new Error("SECRET_PROVIDER_RESPONSE_BODY");
      return {
        vectors: request.inputs.map((item) => {
          const negative = /恒星光谱|複式簿記|compiler|astronomy|accounting/iu.test(item.text);
          return negative ? [0, 1, 0] : [1, 0, 0];
        }),
      };
    },
  };
}

async function fixture(options: { failingProvider?: boolean } = {}) {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-retrieval-api-"));
  roots.push(libraryRoot);
  const repository = new ProjectRepository(libraryRoot);
  await repository.initialize();
  const now = "2026-07-19T00:00:00.000Z";
  const profile = EmbeddingModelProfileSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    title: "Multilingual fixture",
    provider: "mock",
    baseUrl: null,
    endpointPath: "/embed",
    model: "fixture-multilingual",
    credentialRef: null,
    dimensions: 3,
    maxInputTokens: 512,
    maxBatchSize: 32,
    maxConcurrentBatches: 2,
    normalize: true,
    supportsCustomDimensions: false,
    license: "test",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
  await repository.saveEmbeddingModelProfile(profile);
  await repository.saveEmbeddingUseCaseBinding(EmbeddingUseCaseBindingDocumentSchema.parse({
    schemaVersion: 1,
    useCase: "research.multilingual",
    profileId: profile.id,
    updatedAt: now,
  }));
  const embeddingRouter = new EmbeddingRouter();
  embeddingRouter.registerProfile(profile, multilingualAdapter(profile, options.failingProvider));
  const app = await buildApp({ libraryRoot, embeddingRouter });
  return { app, libraryRoot, profile };
}

async function createDatabase(app: Awaited<ReturnType<typeof buildApp>>, name: string): Promise<ResearchDatabaseDocument> {
  const response = await app.inject({ method: "POST", url: "/api/v1/research/databases", payload: { name } });
  expect(response.statusCode).toBe(201);
  return response.json<ResearchDatabaseDocument>();
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("NS-605 multi-database Research retrieval routes", () => {
  it("isolates explicit database scope and applies revision-safe aliases in Exact mode", async () => {
    const { app } = await fixture();
    const history = await createDatabase(app, "History");
    const glossary = await createDatabase(app, "Glossary");
    const inactive = await createDatabase(app, "Inactive");
    await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${history.database.id}/sources`,
      payload: upload("history.txt", "The Moon Keeper guarded the old gate."),
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${glossary.database.id}/sources`,
      payload: upload("glossary.txt", "月守は古い門を守った。"),
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${inactive.database.id}/sources`,
      payload: upload("inactive.txt", "月守 inactive leak"),
    });

    const aliasesUrl = `/api/v1/research/databases/${history.database.id}/query-expansions`;
    const empty = await app.inject({ method: "GET", url: aliasesUrl });
    const updated = await app.inject({
      method: "PUT",
      url: aliasesUrl,
      payload: {
        baseRevision: empty.json().revision,
        entries: [{
          id: randomUUID(),
          queryTerm: "月守",
          expansionTerm: "Moon Keeper",
          channel: "alias",
          queryLanguageTag: "ja",
          expansionLanguageTag: "en",
          note: "Character title",
        }],
      },
    });
    expect(updated.statusCode).toBe(200);
    const stale = await app.inject({
      method: "PUT",
      url: aliasesUrl,
      payload: { baseRevision: empty.json().revision, entries: [] },
    });
    expect(stale.statusCode).toBe(409);

    const searched = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: {
        databaseIds: [history.database.id, glossary.database.id],
        query: "月守",
        mode: "exact",
        limit: 20,
      },
    });
    expect(searched.statusCode).toBe(200);
    expect(searched.json().effectiveMode).toBe("exact");
    expect(new Set(searched.json().results.map((result: { researchDatabaseName: string }) => result.researchDatabaseName)))
      .toEqual(new Set(["History", "Glossary"]));
    expect(searched.json().results.some((result: { researchDatabaseId: string }) =>
      result.researchDatabaseId === inactive.database.id)).toBe(false);
    expect(searched.json().results.find((result: { researchDatabaseName: string }) =>
      result.researchDatabaseName === "History").matchChannels).toContain("alias");
    const japaneseOnly = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: {
        databaseIds: [history.database.id, glossary.database.id],
        query: "月守",
        mode: "exact",
        languageTags: ["ja"],
      },
    });
    expect(japaneseOnly.json().results.map((result: { researchDatabaseName: string }) => result.researchDatabaseName))
      .toEqual(["Glossary"]);
    const pdfOnly = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: {
        databaseIds: [history.database.id, glossary.database.id],
        query: "月守",
        mode: "exact",
        sourceKinds: ["pdf"],
      },
    });
    expect(pdfOnly.json().results).toEqual([]);

    const firstPage = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: { databaseIds: [history.database.id, glossary.database.id], query: "月守", mode: "exact", limit: 1 },
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().nextCursor).toEqual(expect.any(String));
    const changedAliases = await app.inject({
      method: "PUT",
      url: aliasesUrl,
      payload: {
        baseRevision: updated.json().revision,
        entries: updated.json().expansions.entries.map((entry: Record<string, unknown>) => ({
          ...entry,
          note: "Updated after the first result page",
        })),
      },
    });
    expect(changedAliases.statusCode).toBe(200);
    const staleCursor = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: {
        databaseIds: [history.database.id, glossary.database.id],
        query: "月守",
        mode: "exact",
        limit: 1,
        cursor: firstPage.json().nextCursor,
      },
    });
    expect(staleCursor.statusCode).toBe(409);
    expect(staleCursor.json().message).toMatch(/no longer matches/u);
    await app.close();
  });

  it("validates capability, builds isolated vectors, retrieves cross-language evidence, and survives a damaged sibling", async () => {
    const { app, libraryRoot } = await fixture();
    const japanese = await createDatabase(app, "Japanese sources");
    const english = await createDatabase(app, "English sources");
    const japaneseSource = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${japanese.database.id}/sources`,
      payload: upload("edo.txt", "江戸時代の宿場町では旅籠が旅人を迎えた。"),
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${english.database.id}/sources`,
      payload: upload("inn.txt", "An Edo-period inn offered lodging to travelers."),
    });
    const privateSource = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${japanese.database.id}/sources`,
      payload: upload("private.txt", "江戸時代の秘密の旅籠。", "never"),
    });

    const before = await app.inject({ method: "GET", url: "/api/v1/research/embedding-capability" });
    expect(before.json()).toMatchObject({ bindingStatus: "bound", usable: false });
    const validated = await app.inject({
      method: "POST",
      url: "/api/v1/research/embedding-capability/validate",
      payload: {
        supportedLanguageTags: ["zh-CN", "ja", "en"],
        sharedSpaceDeclared: true,
        documentPrefix: "passage: ",
        queryPrefix: "query: ",
      },
    });
    expect(validated.statusCode).toBe(200);
    expect(validated.json().capability.validationStatus).toBe("passed");

    for (const databaseId of [japanese.database.id, english.database.id]) {
      const rebuilt = await app.inject({
        method: "POST",
        url: `/api/v1/research/databases/${databaseId}/vector-index/rebuild`,
      });
      expect(rebuilt.statusCode).toBe(200);
      expect(rebuilt.json().status).toBe("ready");
    }
    const japaneseVectorState = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${japanese.database.id}/vector-index`,
    });
    expect(japaneseVectorState.json()).toMatchObject({ status: "ready", indexedChunkCount: 1 });

    const hybridPayload = {
      databaseIds: [japanese.database.id, english.database.id],
      query: "江户时代供旅人住宿的旅馆",
      mode: "hybrid",
      limit: 10,
    };
    const hybrid = await app.inject({ method: "POST", url: "/api/v1/research/search", payload: hybridPayload });
    expect(hybrid.statusCode).toBe(200);
    expect(hybrid.json().effectiveMode).toBe("hybrid");
    expect(new Set(hybrid.json().results.map((result: { researchDatabaseName: string }) => result.researchDatabaseName)))
      .toEqual(new Set(["Japanese sources", "English sources"]));
    expect(hybrid.json().results.every((result: { matchChannels: string[] }) =>
      result.matchChannels.includes("semantic"))).toBe(true);
    expect(hybrid.body).toContain(japaneseSource.json().source.displayName);
    expect(hybrid.body).not.toContain("秘密の旅籠");

    const localPrivate = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: { databaseIds: [japanese.database.id], query: "秘密の旅籠", mode: "exact", purpose: "local" },
    });
    expect(localPrivate.json().results.some((result: { sourceId: string }) =>
      result.sourceId === privateSource.json().source.id)).toBe(true);
    const modelPrivate = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: { databaseIds: [japanese.database.id], query: "秘密の旅籠", mode: "exact", purpose: "model-context" },
    });
    expect(modelPrivate.json().results.some((result: { sourceId: string }) =>
      result.sourceId === privateSource.json().source.id)).toBe(false);

    const firstHybridPage = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: { ...hybridPayload, limit: 1 },
    });
    expect(firstHybridPage.json().nextCursor).toEqual(expect.any(String));

    const englishVectorPath = researchVectorIndexDatabasePath(
      researchDatabaseRoot(libraryRoot, english.database.id),
    );
    await writeFile(englishVectorPath, "damaged sidecar", "utf8");
    const partial = await app.inject({ method: "POST", url: "/api/v1/research/search", payload: hybridPayload });
    expect(partial.statusCode).toBe(200);
    expect(partial.json().results.some((result: { researchDatabaseId: string }) =>
      result.researchDatabaseId === japanese.database.id)).toBe(true);
    expect(partial.json().issues.some((issue: { researchDatabaseId: string }) =>
      issue.researchDatabaseId === english.database.id)).toBe(true);

    const revalidated = await app.inject({
      method: "POST",
      url: "/api/v1/research/embedding-capability/validate",
      payload: {
        supportedLanguageTags: ["zh-CN", "ja", "en"],
        sharedSpaceDeclared: true,
        documentPrefix: "passage: ",
        queryPrefix: "query: ",
      },
    });
    expect(revalidated.statusCode).toBe(200);
    const staleHybridCursor = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: { ...hybridPayload, limit: 1, cursor: firstHybridPage.json().nextCursor },
    });
    expect(staleHybridCursor.statusCode).toBe(409);
    await app.close();
  });

  it("redacts Provider failures and degrades Hybrid search instead of falling back", async () => {
    const { app } = await fixture({ failingProvider: true });
    const database = await createDatabase(app, "Failure handling");
    await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/sources`,
      payload: upload("exact.txt", "江户旅馆 exact evidence"),
    });
    const validation = await app.inject({
      method: "POST",
      url: "/api/v1/research/embedding-capability/validate",
      payload: {
        supportedLanguageTags: ["zh-CN", "ja", "en"],
        sharedSpaceDeclared: true,
        documentPrefix: "",
        queryPrefix: "",
      },
    });
    expect(validation.statusCode).toBe(200);
    expect(validation.body).not.toContain("SECRET_PROVIDER_RESPONSE_BODY");
    expect(validation.json().capability.validationStatus).toBe("failed");

    const search = await app.inject({
      method: "POST",
      url: "/api/v1/research/search",
      payload: { databaseIds: [database.database.id], query: "江户旅馆", mode: "hybrid" },
    });
    expect(search.statusCode).toBe(200);
    expect(search.json()).toMatchObject({ effectiveMode: "degraded-exact" });
    expect(search.json().results).not.toHaveLength(0);
    expect(search.body).not.toContain("SECRET_PROVIDER_RESPONSE_BODY");
    await app.close();
  });
});
