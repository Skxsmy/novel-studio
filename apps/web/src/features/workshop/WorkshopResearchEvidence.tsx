import { BookOpenText, ExternalLink } from "lucide-react";
import type {
  ResearchSourceLocation,
  ResearchToolAuditCitation,
  WorkshopResearchEvidence,
} from "@novel-studio/contracts";
import { uiText } from "../../app/uiText";

export interface WorkshopResearchEvidenceProps {
  availableDatabaseIds: string[];
  evidence: WorkshopResearchEvidence;
  onOpenCitation?: (citation: ResearchToolAuditCitation) => void;
}

const text = uiText.workshop.research;

function formatLocation(location: ResearchSourceLocation): string {
  if (location.kind === "text") {
    return location.startLine === location.endLine
      ? text.line(location.startLine)
      : text.lines(location.startLine, location.endLine);
  }
  if (location.kind === "pdf") return text.pdfLocation(location.page, location.paragraph);
  if (location.kind === "docx") return text.documentLocation(location.sectionPath, location.paragraph);
  if (location.kind === "epub") {
    return text.epubLocation(location.sectionPath, location.spineIndex, location.paragraph);
  }
  return text.webLocation(location.sectionPath, location.paragraph);
}

export function WorkshopResearchEvidence({
  availableDatabaseIds,
  evidence,
  onOpenCitation,
}: WorkshopResearchEvidenceProps) {
  const availableIds = new Set(availableDatabaseIds);
  const targetCitations = evidence.citations.filter((citation) => citation.relationship === "target");
  const citations = (targetCitations.length ? targetCitations : evidence.citations).slice(0, 4);
  if (!citations.length) return null;

  return (
    <aside aria-label={text.evidenceLabel} className="wr7-evidence">
      <header><BookOpenText aria-hidden="true" size={15} /><strong>{text.evidenceTitle}</strong><span>{text.evidenceCount(evidence.citations.length)}</span></header>
      <div className="wr7-evidence-links">
        {citations.map((citation) => {
          const available = availableIds.has(citation.researchDatabaseId);
          return (
            <button
              className="wr7-evidence-link"
              disabled={!available || !onOpenCitation}
              key={`${citation.researchDatabaseId}:${citation.sourceId}:${citation.chunkId}:${citation.relationship}`}
              onClick={() => onOpenCitation?.(citation)}
              title={available ? text.openEvidence : text.evidenceUnavailable}
              type="button"
            >
              <span><strong>{citation.sourceDisplayName}</strong><small>{citation.researchDatabaseName} · {formatLocation(citation.location)} · {citation.languageTag} · {citation.matchChannels.map(text.matchChannel).join(" + ")}</small></span>
              {available ? <ExternalLink aria-hidden="true" size={14} /> : <em>{text.stale}</em>}
            </button>
          );
        })}
      </div>
      {evidence.citations.length > citations.length ? <footer>{text.moreEvidence(evidence.citations.length - citations.length)}</footer> : null}
    </aside>
  );
}
