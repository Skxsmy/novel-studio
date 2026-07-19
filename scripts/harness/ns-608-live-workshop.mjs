import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ModelProfileSchema } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { buildApp } from "../../apps/server/dist/app.js";

export const NS608_TARGET_MODEL = "deepseek-v4-pro";

export function harnessFailure(code, publicDetails = {}) {
  const error = new Error(code);
  Object.defineProperties(error, {
    ns608Code: { value: code, enumerable: false },
    ns608PublicDetails: { value: publicDetails, enumerable: false },
  });
  return error;
}

export function publicHarnessFailure(error) {
  const candidate = error && typeof error === "object" ? error : {};
  return {
    code: typeof candidate.ns608Code === "string" ? candidate.ns608Code : "unexpected-harness-failure",
    ...(candidate.ns608PublicDetails && typeof candidate.ns608PublicDetails === "object"
      ? candidate.ns608PublicDetails
      : {}),
    ...(candidate.ns608Safety && typeof candidate.ns608Safety === "object"
      ? { safety: candidate.ns608Safety }
      : {}),
  };
}

async function filesUnder(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error("NS-608 safety fingerprint refuses symbolic links");
    if (entry.isDirectory()) files.push(...await filesUnder(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export async function fingerprintDirectory(root) {
  const files = await filesUnder(root);
  const hash = createHash("sha256");
  let totalBytes = 0;
  for (const relative of files) {
    const bytes = await readFile(path.join(root, relative));
    const normalized = relative.split(path.sep).join("/");
    totalBytes += bytes.byteLength;
    hash.update(`${normalized}\0${bytes.byteLength}\0`, "utf8");
    hash.update(bytes);
    hash.update("\0", "utf8");
  }
  return { fileCount: files.length, totalBytes, digest: hash.digest("hex") };
}

export function selectSavedDeepseekProfile(profiles) {
  const eligible = profiles.filter((profile) =>
    profile.provider === "deepseek" &&
    profile.archivedAt === null &&
    typeof profile.credentialRef === "string" &&
    profile.credentialRef.length > 0);
  assert.equal(
    eligible.length,
    1,
    `NS-608 requires exactly one active credential-configured DeepSeek profile; found ${eligible.length}`,
  );
  return eligible[0];
}

export function projectDeepseekV4ProProfile(sourceProfile) {
  return ModelProfileSchema.parse({
    ...sourceProfile,
    model: NS608_TARGET_MODEL,
  });
}

export function assertPublicSummarySafe(summary, forbiddenValues = []) {
  const serialized = JSON.stringify(summary);
  const forbiddenPatterns = [
    /authorization/iu,
    /bearer\s+/iu,
    /credentialref/iu,
    /cookie/iu,
    /sk-[a-z0-9_-]{8,}/iu,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(serialized), false, `Public NS-608 summary contains forbidden material: ${pattern}`);
  }
  for (const value of forbiddenValues.filter((item) => typeof item === "string" && item.length > 0)) {
    assert.equal(serialized.includes(value), false, "Public NS-608 summary contains a private runtime value");
  }
  return summary;
}

async function credentialReferenceLocations(root, credentialRef) {
  const matches = [];
  for (const relative of await filesUnder(root)) {
    const bytes = await readFile(path.join(root, relative));
    if (bytes.includes(Buffer.from(credentialRef, "utf8"))) matches.push(relative.split(path.sep).join("/"));
  }
  return matches;
}

export async function requestJson(baseUrl, method, pathname, payload, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (response.status !== expectedStatus) {
    const code = body && typeof body === "object" && "code" in body ? body.code : "HTTP_FAILURE";
    throw harnessFailure("request-failed", {
      status: response.status,
      providerCode: String(code).replace(/[^A-Z0-9_-]/giu, "").slice(0, 80),
    });
  }
  return body;
}

export async function withTemporaryRealProviderEnvironment(options, run) {
  const sourceLibraryRoot = path.resolve(options.sourceLibraryRoot);
  const sourceBefore = await fingerprintDirectory(sourceLibraryRoot);
  const sourceRepository = new ProjectRepository(sourceLibraryRoot);
  const sourceProfile = selectSavedDeepseekProfile(await sourceRepository.listModelProfiles());
  const projectedProfile = projectDeepseekV4ProProfile(sourceProfile);
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-ns-608-"));
  let app = null;
  let result;
  let runError = null;
  let referenceConfined = false;
  try {
    const repository = new ProjectRepository(temporaryRoot);
    await repository.initialize();
    await repository.saveModelProfile(projectedProfile);
    const series = await repository.createSeries({ title: options.seriesTitle ?? "NS-608 saved-key trial" });
    app = await buildApp({
      libraryRoot: temporaryRoot,
      logger: false,
      version: "0.1.0-ns608-real",
      commit: "ns608-real-provider",
      workspaceRoot: process.cwd(),
    });
    const baseUrl = await app.listen({ host: "127.0.0.1", port: 0 });
    result = await run({ repository, series, profile: projectedProfile, baseUrl });
  } catch (error) {
    runError = error;
  } finally {
    try {
      const locations = await credentialReferenceLocations(temporaryRoot, sourceProfile.credentialRef);
      const expected = `.studio/model-profiles/${sourceProfile.id}.json`;
      referenceConfined = locations.length === 1 && locations[0] === expected;
      assert.equal(referenceConfined, true, "Credential reference escaped the temporary model profile");
    } catch (error) {
      runError ??= error;
    }
    if (app) await app.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
  const sourceAfter = await fingerprintDirectory(sourceLibraryRoot);
  assert.deepEqual(sourceAfter, sourceBefore, "NS-608 changed the real library while running a temporary trial");
  const safety = {
    systemSecretPointerConfined: referenceConfined,
    sourceLibraryUnchanged: true,
    sourceFileCount: sourceBefore.fileCount,
    sourceTotalBytes: sourceBefore.totalBytes,
  };
  if (runError) {
    Object.defineProperty(runError, "ns608Safety", { value: safety, enumerable: false });
    throw runError;
  }
  return {
    result,
    safety,
  };
}
