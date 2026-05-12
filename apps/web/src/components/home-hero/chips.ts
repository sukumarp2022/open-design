// Stage B of plugin-driven-flow-plan — Home intent rail.
//
// The Home input card sits naked above an unstructured prompt. New
// users frequently type a request without knowing which scenario
// plugin to apply, which lands them in the generic agent path and
// stretches the convergence loop. This chip rail mirrors the
// NewProjectModal taxonomy plus a small set of migration shortcuts
// (Figma / folder / template), so the same Enter keystroke can hit a
// scenario-bound run.
//
// The catalog stays a pure data table:
//   - `id` — stable React key + test selector.
//   - `label` — English copy. Localisation can layer on later by
//     swapping this for a Dict lookup; keeping it inline lets the
//     rail ship without burning through 17 locale files for two
//     new strings (see plan §B / open questions).
//   - `icon` — name from the shared Icon registry.
//   - `action` — discriminated union the HomeView dispatcher matches
//     on. The rail component itself stays presentational.

import type { ProjectKind } from '@open-design/contracts';
import type { DefaultScenarioPluginId } from '@open-design/contracts';
import type { IconName } from '../Icon';

export type ChipAction =
  | { kind: 'apply-scenario'; pluginId: DefaultScenarioPluginId; projectKind: ProjectKind }
  | { kind: 'apply-figma-migration'; pluginId: 'od-figma-migration'; projectKind: ProjectKind }
  | { kind: 'import-folder' }
  | { kind: 'open-template-picker' };

// Two intent groups: "create" = produce something new from scratch,
// "migrate" = start from an existing source. The grouping is structural
// only — HomeHero renders the two groups in separate flex containers so
// they wrap onto separate rows on narrow viewports without horizontal
// scrolling.
export type ChipGroup = 'create' | 'migrate';

export interface HomeHeroChip {
  id: string;
  label: string;
  icon: IconName;
  group: ChipGroup;
  hint?: string;
  action: ChipAction;
}

export const HOME_HERO_CHIPS: ReadonlyArray<HomeHeroChip> = [
  {
    id: 'prototype',
    label: 'Prototype',
    icon: 'palette',
    group: 'create',
    action: { kind: 'apply-scenario', pluginId: 'od-new-generation', projectKind: 'prototype' },
  },
  {
    id: 'deck',
    label: 'Slide deck',
    icon: 'present',
    group: 'create',
    action: { kind: 'apply-scenario', pluginId: 'od-new-generation', projectKind: 'deck' },
  },
  {
    id: 'image',
    label: 'Image',
    icon: 'image',
    group: 'create',
    action: { kind: 'apply-scenario', pluginId: 'od-media-generation', projectKind: 'image' },
  },
  {
    id: 'video',
    label: 'Video',
    icon: 'play',
    group: 'create',
    action: { kind: 'apply-scenario', pluginId: 'od-media-generation', projectKind: 'video' },
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: 'mic',
    group: 'create',
    action: { kind: 'apply-scenario', pluginId: 'od-media-generation', projectKind: 'audio' },
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'sparkles',
    group: 'create',
    action: { kind: 'apply-scenario', pluginId: 'od-new-generation', projectKind: 'other' },
  },
  {
    id: 'figma',
    label: 'From Figma',
    icon: 'import',
    group: 'migrate',
    hint: 'Migrate a Figma frame into the active design system.',
    action: { kind: 'apply-figma-migration', pluginId: 'od-figma-migration', projectKind: 'prototype' },
  },
  {
    id: 'folder',
    label: 'From folder',
    icon: 'folder',
    group: 'migrate',
    hint: 'Import an existing local folder and continue editing.',
    action: { kind: 'import-folder' },
  },
  {
    id: 'template',
    label: 'From template',
    icon: 'file-code',
    group: 'migrate',
    hint: 'Start from a bundled template.',
    action: { kind: 'open-template-picker' },
  },
];

export function chipsForGroup(group: ChipGroup): HomeHeroChip[] {
  return HOME_HERO_CHIPS.filter((c) => c.group === group);
}

// Helper used by tests + the rail component to pull the chip metadata
// off a click target without round-tripping through React state.
export function findChip(id: string): HomeHeroChip | undefined {
  return HOME_HERO_CHIPS.find((c) => c.id === id);
}
