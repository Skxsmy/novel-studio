import { ReferenceSurface } from "../ui/ReferenceSurface";

export function ReferenceInFrameOverlays() {
  return (
    <>
      <ReferenceSurface selector="#wr5-review-backdrop" />
      <ReferenceSurface selector="#wr5-toast" />
    </>
  );
}

export function ReferenceGlobalOverlays({
  includeCodex = true,
  includeWriteStructure = true,
}: {
  includeCodex?: boolean;
  includeWriteStructure?: boolean;
} = {}) {
  return (
    <>
      {includeCodex ? <ReferenceSurface selector="#schema-backdrop" /> : null}
      {includeCodex ? <ReferenceSurface selector="#create-backdrop" /> : null}
      {includeCodex ? <ReferenceSurface selector="#category-backdrop" /> : null}
      {includeWriteStructure ? <ReferenceSurface selector="#wr6-structure-backdrop" /> : null}
    </>
  );
}
