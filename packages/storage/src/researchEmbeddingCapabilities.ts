import path from "node:path";
import {
  ResearchEmbeddingCapabilityDocumentSchema,
  ResearchEmbeddingCapabilitySchema,
  type EmbeddingModelProfile,
  type ResearchEmbeddingCapability,
  type ResearchEmbeddingCapabilityDocument,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { runSeriesFileTransaction } from "./fileTransactions.js";
import { assertInside } from "./fileSystem.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  readJsonAuthorityFile,
  serializeJsonAuthority,
} from "./jsonAuthority.js";

const CAPABILITIES_DIRECTORY = "research-embedding-capabilities";

function capabilityRoot(libraryRoot: string): string {
  return assertInside(libraryRoot, path.join(libraryRoot, ".studio", CAPABILITIES_DIRECTORY));
}

export function researchEmbeddingCapabilityPath(libraryRoot: string, profileId: string): string {
  const root = capabilityRoot(libraryRoot);
  return assertInside(root, path.join(root, `${profileId}.json`));
}

export function embeddingModelProfileRevision(profile: EmbeddingModelProfile): string {
  return jsonAuthorityRevision(serializeJsonAuthority(profile));
}

export async function readResearchEmbeddingCapabilityFile(
  libraryRoot: string,
  profileId: string,
): Promise<ResearchEmbeddingCapabilityDocument> {
  let document;
  try {
    document = await readJsonAuthorityFile(
      capabilityRoot(libraryRoot),
      researchEmbeddingCapabilityPath(libraryRoot, profileId),
      (value) => ResearchEmbeddingCapabilitySchema.parse(value),
      "Research embedding capability authority",
    );
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Research embedding capability has not been validated", "NOT_FOUND", { profileId });
    }
    throw error;
  }
  if (document.data.profileId !== profileId) {
    throw new StorageError("Research embedding capability belongs to another profile", "INVALID_DATA", {
      actualProfileId: document.data.profileId,
      profileId,
    });
  }
  return ResearchEmbeddingCapabilityDocumentSchema.parse({
    capability: document.data,
    revision: document.revision,
  });
}

export async function saveResearchEmbeddingCapabilityFile(
  libraryRoot: string,
  rawCapability: ResearchEmbeddingCapability,
  expectedRevision: string | null,
): Promise<ResearchEmbeddingCapabilityDocument> {
  const capability = ResearchEmbeddingCapabilitySchema.parse(rawCapability);
  const root = capabilityRoot(libraryRoot);
  return runSeriesFileTransaction(root, async (commit) => {
    let currentRevision: string | null = null;
    try {
      currentRevision = (await readResearchEmbeddingCapabilityFile(libraryRoot, capability.profileId)).revision;
    } catch (error) {
      if (!(error instanceof StorageError) || error.code !== "NOT_FOUND") throw error;
    }
    if (currentRevision !== expectedRevision) {
      throw new StorageError("Research embedding capability changed during validation", "CONFLICT", {
        actualRevision: currentRevision,
        expectedRevision,
        profileId: capability.profileId,
      });
    }
    const raw = serializeJsonAuthority(capability);
    await commit([{
      targetPath: researchEmbeddingCapabilityPath(libraryRoot, capability.profileId),
      content: raw,
    }]);
    return ResearchEmbeddingCapabilityDocumentSchema.parse({
      capability: parseJsonAuthorityText(
        raw,
        (value) => ResearchEmbeddingCapabilitySchema.parse(value),
        "Research embedding capability authority",
      ),
      revision: jsonAuthorityRevision(raw),
    });
  });
}
