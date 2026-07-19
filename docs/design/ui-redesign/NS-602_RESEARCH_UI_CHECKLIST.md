# NS-602 Research UI Checklist

Status: active
Updated: 2026-07-19
Task: `docs/tasks/NS-602.md`

## Design Source

This is the binding written checklist for the NS-602 Research page. The author
rejected the obsolete Figma path. The page is designed directly in React using
the installed `ui-design` Skill, existing Novel Studio tokens/components, and
real author workflows. The old disabled Research placeholder is navigation
evidence only, not page structure. Targeted third-party component inspiration is
not used.

## Direction

1. Product goal and audience: let a novelist build and inspect a private source
   shelf without leaving the active Series or learning database terminology.
2. Tone: editorial, quiet, precise; closer to a working archive desk than a
   dashboard or marketing page.
3. Layout: one continuous three-region workspace with a narrow source rail, a
   dominant readable original, and a bounded property inspector.
4. Typography: current application typography, with restrained document title,
   compact metadata, and long-form preview line length between 60 and 82
   characters where viewport width permits.
5. Color and surfaces: neutral paper/ink content, existing green for ready and
   amber/red only for actionable state; no gradient, purple cast, beige theme,
   decorative orb, or card wall.
6. Motion: only state communication, including upload progress, selected-source
   transition, save state, and drawer movement; respect reduced motion.
7. Signature differentiator: a source-spine line visually connects each source
   row's import state to the selected document header and preview without adding
   ornament or changing layout dimensions.

## Route And Entry

- Visible label: `Research`.
- Shell position: after `Review`; Settings remains at the right edge/bottom
  shell location already used by the application.
- Entry retains the current Series.
- Leaving and returning restores the last valid source for that Series.
- Refresh restores the last valid selection when possible; a missing/damaged
  selection returns to the list and shows one bounded error message.
- An open Series is required. No Series shows a direct Project Library action,
  not a fabricated empty source list.

## Component Map

| Region/control | Implementation owner | Real data/action |
| --- | --- | --- |
| Research workspace root | `src/features/research/ReferenceResearchWorkspace.tsx` | Active Series and source collection |
| Source rail | Research feature component | Source title, type, parse state, language, selection |
| Upload icon button and hidden file input | Research feature component plus `src/api/research.ts` | TXT/Markdown file read and import API |
| Original preview | Research feature component | Stored original text returned by source get API |
| Property inspector | Research feature component | Revision-safe update API |
| Status/empty/error surfaces | Shared tokens and feature CSS | Actual request/repository state |
| Shell navigation | `src/app/ReferenceReplica.tsx` and shell surface bridge | Enable/select Research and hide other workspaces |

## Required States

- Library loading.
- No Series open.
- Empty source shelf with one upload command.
- File chosen and being read locally.
- Uploading and parsing, with stable source-rail geometry.
- Selected parsed TXT source.
- Selected parsed Markdown source shown as unchanged text, not executable HTML.
- Upload rejected for type, size, encoding, empty content, or duplicate hash.
- Source list or source detail failed.
- Property save in progress, saved, failed, and stale-revision conflict.
- Restored selection missing or damaged.

## Interaction Rules

- Upload is an icon-plus-label command because it is the page's primary action;
  its file picker accepts only `.txt`, `.md`, `text/plain`, and `text/markdown`.
- Source rows are real selection controls with a fixed state icon column; hover,
  focus, selected, parsing, and failed states cannot shift row size.
- Display name, author, declared language, tags, AI context permission, and
  copyright/use notes are labeled controls. AI permission is a segmented or
  radio choice, not free text.
- File type, original filename, size, import time, hash, parser version, and
  parse error are read-only facts. Hash stays in source details and does not
  dominate the primary reading surface.
- Save is enabled only for a valid dirty form. A conflict reloads the latest
  source and keeps the author's draft visible for an explicit retry.
- Delete, Archive, Reparse, batch commands, search boxes, embeddings, result
  counts, Research Notes, and Canon conversion are absent in NS-602.

## Responsive Rules

- At wide desktop, source rail is 240-288 pixels, inspector is 288-336 pixels,
  and preview consumes the remaining width with a readable minimum.
- At compact desktop/tablet, inspector moves below preview; source rail remains
  visible until the preview would fall below 520 pixels.
- At narrow width, source rail becomes a labeled drawer and inspector follows
  preview in document order. Drawer close, source selection, upload, and save
  remain keyboard reachable.
- No text overlaps controls; long names wrap on two lines and then truncate with
  the full value available by title/accessible name.
- Stable grid tracks and minimum heights prevent uploading, errors, or long
  metadata from resizing the shell navigation or moving primary controls.

## Verification

- Component tests cover keyboard, labels, loading, empty, error, selected,
  upload, save, conflict, and absence of deferred controls.
- Real-browser diagnostics cover desktop and compact/narrow viewports with one
  TXT and one Markdown import, source switching, property save, leave/return,
  and refresh.
- Inspect screenshots for hierarchy, spacing, readable line length, clipping,
  and overlap. Screenshots do not constitute author acceptance.
