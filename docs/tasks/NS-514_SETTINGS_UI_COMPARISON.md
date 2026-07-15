# NS-514 Settings UI Function Comparison

Status: P5 detailed comparison; author decisions pending
Surface: Settings
Binding node: `#settings-workspace`
New component: `apps/web/src/features/settings/ReferenceSettingsWorkspace.tsx`
Old component: `apps/web/src/features/settings/SettingsWorkspace.tsx`

## Scope And Interpretation

This document compares the binding-reference Settings UI against the real
pre-NS-514 Settings UI. A control being present in the new UI does not prove
that it has a production callback or persisted data path.

Comparison values:

- `both`: the new UI has a structurally corresponding control and the old UI
  has a real callback/API.
- `new-only`: the reference exposes a function that the old UI did not provide.
- `old-only`: a real old function has no corresponding new control.
- `partial`: the surfaces overlap but the new UI lacks part of the old workflow.
- `placeholder`: the reference behavior is fixture/local-only and must not be
  treated as production success.

## Binding And Entry Checklist

| Property | New Settings | Old Settings |
| --- | --- | --- |
| Entry | Appbar Settings control `RC-010` | Sidebar Settings button |
| Return path | Any appbar workspace control | Any sidebar workspace control |
| Layout | Settings section navigation plus section-specific content | Model-profile list plus one editor form |
| Primary data | Reference fixture profiles, roles, prompts, backup and privacy values | Real model profiles and credential status |
| Production API owner | None in the replica | `api.ai.*` |
| Default page state | Surface hidden until Settings is selected; Model connections is the first section | Settings loads model profiles immediately |
| Deferred boundary | Embeddings, roles, prompts, backup, privacy and library location | Not present in the old UI |

The primary Settings surface contains 70 controls: 8 proposed in-place
connections, 22 local-only controls, and 40 disabled/deferred controls.

## Complete Function Matrix

| ID | Atomic function | New UI | Old UI | Existing callback/API | Comparison | Required P6 disposition |
| --- | --- | --- | --- | --- | --- | --- |
| ST-01 | Open Settings | Appbar Settings button | Sidebar Settings button | `App.showWorkspace("settings")` | both | Keep the reference entry and connect workspace state |
| ST-02 | Switch Settings section | Seven section buttons | No section navigation | Local reference state | new-only | Keep local-only |
| ST-03 | Load model connections | Fixture connection list | Loads real profiles | `api.ai.listModelProfiles` | both | Replace fixtures with real profiles |
| ST-04 | Select an existing connection | Fixture connection selection | Real profile selection | `SettingsWorkspace.selectProfile` | both | Connect selection in place |
| ST-05 | Start a new connection | `New connection` | `New Connection` and `Add` | `SettingsWorkspace.startNewModel` | both | Connect local form state |
| ST-06 | Edit connection name | `#st7-connection-name` | Title field | model-profile form state | both | Bind to real form state |
| ST-07 | Select Provider | `#st7-provider` | Provider select | `SettingsWorkspace.changeProvider` | both | Bind to real form state |
| ST-08 | Enter/select model | Model input plus model browser | Model input plus fetched model list | `api.ai.listProviderModels` | both | Use real Provider result/error |
| ST-09 | Edit Base URL | `#st7-base-url` | Base URL field | model-profile form state | both | Bind in place |
| ST-10 | Edit context window | `#st7-context-window` | Context-window field | model-profile form state | both | Bind in place |
| ST-11 | Enter a replacement key | Password input | Secret input | credential draft state | both | Never prefill or echo the saved secret |
| ST-12 | Read credential status | No distinct visible status control | Shows real credential status | `api.ai.getModelCredentialStatus` | partial | Add status only inside an existing reference status region; no new layout without approval |
| ST-13 | Save/replace credential | Folded into `Save changes` candidate | Dedicated `Save / Replace Key` | `api.ai.saveModelCredential` | partial | Author must decide whether one reference action may perform both profile and credential saves |
| ST-14 | Delete credential | No control | Dedicated `Delete Key` | `api.ai.deleteModelCredential` / `OC-003` | old-only | Requires a binding revision or explicit temporary omission |
| ST-15 | Test connection | `Test connection` | `Test Connection` | `api.ai.testModelProfile` | both | Connect to real success/error result |
| ST-16 | Fetch Provider models | `Browse models` | `Fetch Models` | `api.ai.listProviderModels` | both | Connect; do not claim results before response |
| ST-17 | Choose a fetched model | Fixture model rows | Real Provider model rows | `SettingsWorkspace.selectProviderModel` | both | Render real models in the same list structure |
| ST-18 | Create model profile | `Save changes` after New connection | `Save Setting` | `api.ai.createModelProfile` | both | Connect in place |
| ST-19 | Update model profile | `Save changes` | `Save Setting` | `api.ai.updateModelProfile` | both | Preserve validation and actual error feedback |
| ST-20 | Archive model profile | Archive plus confirmation | Archive Setting plus confirmation | `api.ai.archiveModelProfile` | both | Preserve explicit confirmation |
| ST-21 | Create embedding profile | Full Embeddings form | No UI | No old callback | new-only | `RC-049`–`RC-057` remain disabled/deferred |
| ST-22 | Test/save embedding profile | Test/Save profile buttons | No UI | No old callback | new-only | Disabled until a scoped production workflow exists |
| ST-23 | Bind embeddings to Codex/Research | Two checkboxes | No UI | No old callback | new-only | Disabled; do not persist fixture choices |
| ST-24 | Create/select Editorial Role | Role list and New role | No Role editor | No old callback | new-only | `RC-058`–`RC-070` remain disabled/deferred |
| ST-25 | Configure role purpose/model/tools | Name, purpose, connection, model and policy checkboxes | No UI | No old callback | new-only | Disabled; must not imply NS-511 completion |
| ST-26 | Save Editorial Role | `Save role` | No UI | No old callback | new-only | Disabled |
| ST-27 | Create/select Prompt | New prompt plus Version 1/2/3 | No versioned Prompt UI | No old callback | new-only | `RC-071`–`RC-076` remain disabled/deferred |
| ST-28 | Edit and save Prompt version | Prompt textarea plus Save new version | No UI | No old callback | new-only | Disabled; versioned Prompt authority remains unfinished |
| ST-29 | Change library location | Change location plus folder dialog | No Settings workflow | No old callback | new-only | `RC-077`, `RC-093`–`RC-095` remain disabled |
| ST-30 | Configure backup schedule/retention | Schedule and retention controls | No UI | No old callback | new-only | `RC-078`, `RC-079` remain disabled |
| ST-31 | Create backup | `Create backup` | No UI | No old callback | new-only | `RC-080` remains disabled |
| ST-32 | Export settings | `Export settings` | No UI | No old callback | new-only | `RC-081` remains disabled |
| ST-33 | Configure history/sensitive defaults/usage warning | Privacy and usage form | No UI | No old callback | new-only | `RC-082`–`RC-085` remain disabled |
| ST-34 | Select System/Light appearance | Appearance controls | No Settings control | Local reference state | new-only | May remain local-only after author approval |
| ST-35 | Select Comfortable/Compact density | Appearance controls | No Settings control | Local reference state | new-only | May remain local-only |
| ST-36 | Set editor font size | Range input | No Settings control | Local reference state | new-only | May remain local-only; must not falsely claim persistence |
| ST-37 | Reduce motion | Checkbox | No Settings control | Local reference state | new-only | May remain local-only and should respect reduced-motion semantics |
| ST-38 | Loading feedback | Reference fixture messages only | Explicit loading states | Existing Settings state flags | partial | Retain real loading indicators within reference regions |
| ST-39 | Error recovery | Reference local success/failure simulation | Real errors and result messages | old `errorMessage` / `resultMessage` | partial | Show nearby, accessible errors from actual API responses |

## New UI Functions Missing From The Old UI

| Function family | Reference controls | Current truth |
| --- | --- | --- |
| Embedding profiles | `RC-049`–`RC-057` | UI-only; no old production callback |
| Editorial Roles | `RC-058`–`RC-070` | UI-only; must not imply completed role authority |
| Versioned Prompts | `RC-071`–`RC-076` | UI-only; NS-511 remains unfinished |
| Library location and backup | `RC-077`–`RC-081`, `RC-093`–`RC-095` | UI-only |
| Privacy and usage | `RC-082`–`RC-085` | UI-only |
| Appearance preferences | `RC-086`–`RC-092` | Local-only unless a persistence decision is added |

## Old UI Functions Missing From The New UI

| Old function | Evidence | Impact |
| --- | --- | --- |
| Delete saved model credential | `OC-003`; `api.ai.deleteModelCredential` | A stored key cannot be removed from the new Settings UI |
| Distinct credential-status presentation | `api.ai.getModelCredentialStatus` | Key presence/verification may be unclear if folded into generic connection state |
| Separate profile-save and key-save actions | Old `Save Setting` and `Save / Replace Key` | Combining them could accidentally broaden a profile update into a secret write |

## Fixture, Disabled, And Accessibility Audit

- Provider names, model names, key state, connection results and profile values
  in the reference are fixtures.
- `RC-049`–`RC-085` and `RC-093`–`RC-095` must remain honestly disabled until
  their production workflows exist.
- Every text/password/url/number control requires a stable visible label or
  accessible name; placeholder text alone is not sufficient.
- Provider and credential failures require nearby error feedback and an
  accessible announcement; a color-only failure state is insufficient.
- Credential material must never be logged, returned, prefilled, or stored in
  project authority JSON.

## Author Decision Queue

1. Approve or reject in-place connection of ST-03 through ST-20.
2. Decide whether profile saving and credential saving remain separate actions.
3. Decide whether `Delete Key` requires a future binding revision.
4. Keep ST-21 through ST-33 disabled, or authorize a separately scoped product
   and authority design.
5. Decide whether ST-34 through ST-37 remain session-local or need persisted
   application preferences.
