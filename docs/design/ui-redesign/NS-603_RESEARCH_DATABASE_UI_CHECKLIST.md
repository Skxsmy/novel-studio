# NS-603 Research Database UI Checklist

Status: active
Updated: 2026-07-19
Task: `docs/tasks/NS-603.md`

## Design Source

The author accepted the overall NS-602 Research layout and rejected the old
Figma path. NS-603 extends the connected React workspace using the installed
`ui-design` Skill, existing tokens/components, ADR-0019, and this checklist.
No old Figma frame or disabled reference placeholder is binding.

## Direction

- Preserve the continuous source rail, original reader, and property inspector.
- Add one compact database switcher before the source shelf. It identifies the
  current isolated database without resembling a global dashboard.
- Switching database replaces the whole source shelf and current reader state.
- Database creation and properties use a focused dialog or inspector mode, not
  nested cards or an inline form squeezed into a source row.
- Current Series linking is a database-level action. It does not appear when no
  Series is open and never implies that the Series owns the database.
- Empty library, empty database, damaged database, loading, saving, conflict,
  legacy migration, and no-Series states use real data and concise copy.
- Unsupported formats and search remain absent. The page may state the current
  TXT/Markdown limit but cannot present Word, PDF, URL, archive, delete, merge,
  or search as working controls.

## Interaction Checklist

- Create a database with a required name and optional description.
- Switch databases only after resolving or explicitly discarding dirty edits.
- Rename/update database properties with revision protection.
- Link or unlink the current Series without changing Sources.
- Keep one database selectable and usable when another is damaged.
- Restore the last selected database globally and the last selected Source per
  database; missing selections fall back visibly.
- Source upload, preview, property edit, conflict handling, and immutable facts
  retain NS-602 behavior inside the selected database.
- Keyboard focus returns to the invoking control after a dialog closes.
- Compact layout keeps the database identity, Add Source command, source drawer,
  reader, and property form usable without horizontal overflow.

## Acceptance Boundary

Automated interaction, accessibility, geometry, and diagnostic inspection can
find defects. Only the author can pass NS-603-A12.
