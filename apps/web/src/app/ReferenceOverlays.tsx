import { ReferenceSurface } from "../ui/ReferenceSurface";

export function ReferenceInFrameOverlays() {
  return (
    <>
      <ReferenceSurface selector="#wr5-review-backdrop" />
      <ReferenceSurface selector="#wr5-toast" />
    </>
  );
}

export function ReferenceGlobalOverlays({ includeWriteStructure = true }: { includeWriteStructure?: boolean } = {}) {
  return (
    <>
      <ReferenceSurface selector="#schema-backdrop" />
      <ReferenceSurface selector="#create-backdrop" />
      <ReferenceSurface selector="#category-backdrop" />
      {includeWriteStructure ? <ReferenceSurface selector="#wr6-structure-backdrop" /> : null}
    </>
  );
}
