// Default scenario plugin bindings (plan §3.3 of plugin-driven-flow-plan).
//
// Both the web client (`EntryShell.handleCreate`) and the daemon
// (`/api/projects` + `/api/runs`) need to know which bundled scenario
// plugin to bind when the caller didn't pick one explicitly. Keeping
// the mapping in contracts lets both sides import the same table so the
// client and the server never disagree about what counts as the
// "default" plugin for a given project kind / task kind.
//
// Today every kind defaults to `od-new-generation`. The plan
// reserves slots for `od-media-generation` (Stage C) and the migration
// scenarios (`od-figma-migration`, `od-code-migration`) once the Home
// chip rail wires them in.

import type { ProjectKind } from '../api/projects.js';
import type { AppliedPluginSnapshot } from './apply.js';

export type TaskKind = AppliedPluginSnapshot['taskKind'];

// Plugin ids of the bundled `_official/scenarios/` rows. Kept as a
// string-literal union so a typo here surfaces as a type error in both
// the web shell and the daemon resolver.
export type DefaultScenarioPluginId =
  | 'od-default'
  | 'od-new-generation'
  | 'od-media-generation'
  | 'od-plugin-authoring'
  | 'od-figma-migration'
  | 'od-code-migration'
  | 'od-tune-collab';

export const DEFAULT_UNSELECTED_SCENARIO_PLUGIN_ID =
  'od-default' satisfies DefaultScenarioPluginId;

export const DEFAULT_SCENARIO_PLUGIN_BY_KIND: Record<ProjectKind, DefaultScenarioPluginId> = {
  prototype: 'od-new-generation',
  deck:      'od-new-generation',
  template:  'od-new-generation',
  image:     'od-media-generation',
  video:     'od-media-generation',
  audio:     'od-media-generation',
  other:     'od-new-generation',
};

export const DEFAULT_SCENARIO_PLUGIN_BY_TASK_KIND: Record<TaskKind, DefaultScenarioPluginId> = {
  'new-generation':  'od-new-generation',
  'figma-migration': 'od-figma-migration',
  'code-migration':  'od-code-migration',
  'tune-collab':     'od-tune-collab',
};

export function defaultScenarioPluginIdForKind(
  kind: ProjectKind | undefined,
): DefaultScenarioPluginId | null {
  if (!kind) return null;
  return DEFAULT_SCENARIO_PLUGIN_BY_KIND[kind] ?? null;
}

export function defaultScenarioPluginIdForTaskKind(
  taskKind: TaskKind | undefined,
): DefaultScenarioPluginId | null {
  if (!taskKind) return null;
  return DEFAULT_SCENARIO_PLUGIN_BY_TASK_KIND[taskKind] ?? null;
}
