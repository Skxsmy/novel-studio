import type { CodexEntryDocument, CodexMention } from "@novel-studio/contracts";

export type InlineCodexMention = Omit<CodexMention, "sceneId">;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiWordChar(value: string) {
  return /^[A-Za-z0-9_]$/.test(value);
}

function hasWordBoundary(content: string, start: number, end: number, term: string) {
  const startsWithAsciiWord = isAsciiWordChar(term[0] ?? "");
  const endsWithAsciiWord = isAsciiWordChar(term.at(-1) ?? "");
  const before = start > 0 ? content[start - 1] : "";
  const after = end < content.length ? content[end] : "";
  if (startsWithAsciiWord && before && isAsciiWordChar(before)) return false;
  if (endsWithAsciiWord && after && isAsciiWordChar(after)) return false;
  return true;
}

function overlapsRange(ranges: Array<{ start: number; end: number }>, start: number, end: number) {
  return ranges.some((range) => start < range.end && end > range.start);
}

export function findInlineCodexMentions(content: string, entries: CodexEntryDocument[]): InlineCodexMention[] {
  if (!content.trim() || !entries.length) return [];

  const candidates = entries
    .filter((entry) => !entry.metadata.archivedAt)
    .flatMap((entry) => {
      const excludedTerms = new Set(entry.metadata.mention.excludedTerms.map((term) => (
        entry.metadata.mention.caseSensitive ? term.trim() : term.trim().toLocaleLowerCase()
      )));
      const nameTerm = entry.metadata.name.trim();
      const aliasTerms = entry.metadata.mention.matchAliases ? entry.metadata.aliases.map((alias) => alias.trim()) : [];
      return [nameTerm, ...aliasTerms]
        .filter((term) => term.length > 0)
        .filter((term) => {
          const normalized = entry.metadata.mention.caseSensitive ? term : term.toLocaleLowerCase();
          return !excludedTerms.has(normalized);
        })
        .map((term) => ({
          caseSensitive: entry.metadata.mention.caseSensitive,
          entryId: entry.metadata.id,
          isAlias: term !== nameTerm,
          term,
        }));
    })
    .sort((left, right) => right.term.length - left.term.length || left.term.localeCompare(right.term));

  const mentions: InlineCodexMention[] = [];
  const occupiedRanges: Array<{ start: number; end: number }> = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const flags = candidate.caseSensitive ? "g" : "gi";
    const matcher = new RegExp(escapeRegExp(candidate.term), flags);
    for (const match of content.matchAll(matcher)) {
      const start = match.index;
      if (start === undefined) continue;
      const end = start + match[0].length;
      const key = `${candidate.entryId}:${start}:${end}`;
      if (seen.has(key)) continue;
      if (!hasWordBoundary(content, start, end, candidate.term)) continue;
      if (overlapsRange(occupiedRanges, start, end)) continue;
      seen.add(key);
      occupiedRanges.push({ start, end });
      mentions.push({
        end,
        entryId: candidate.entryId,
        isAlias: candidate.isAlias,
        matchedText: content.slice(start, end),
        start,
        term: candidate.term,
      });
    }
  }

  return mentions.sort((left, right) => left.start - right.start || right.end - left.end);
}
