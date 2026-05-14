export type HomePromptHandoff =
  | {
    id: number;
    prompt: string;
    focus: boolean;
    source: 'plugin-authoring';
  }
  | {
    id: number;
    pluginId: string;
    focus: boolean;
    source: 'plugin-use';
    inputs?: Record<string, unknown>;
  };

export const PLUGIN_AUTHORING_PROMPT = [
  'Create an Open Design plugin for: <describe the workflow you want to package>.',
  '',
  'Run the agent-assisted plugin authoring flow end to end. Follow docs/plugins-spec.md and produce a folder named generated-plugin with:',
  '- SKILL.md describing the agent behavior and workflow',
  '- open-design.json with valid metadata, vendor/plugin-name naming when publishing, plugin.repo, mode, task kind, inputs, and any pipeline/context references',
  '- optional examples/ and assets/ when useful',
  '',
  'Then run or prepare the CLI path: od plugin validate, od plugin pack, local install/run validation, od plugin whoami/login through gh, and od plugin publish when the user is ready to open a registry PR.',
  '',
  'When finished, summarize files created, validation status, local install/run status, pack output, and the exact publish command or PR next step.',
].join('\n');

export function buildPluginAuthoringPrompt(goal: string): string {
  return [
    `Create an Open Design plugin for: ${goal}`,
    '',
    'Run the agent-assisted plugin authoring flow end to end. Follow docs/plugins-spec.md and produce a folder named generated-plugin with:',
    '- SKILL.md describing the agent behavior and workflow',
    '- open-design.json with valid metadata, vendor/plugin-name naming when publishing, plugin.repo, mode, task kind, inputs, and any pipeline/context references',
    '- optional examples/ and assets/ when useful',
    '',
    'Then run or prepare the CLI path: od plugin validate, od plugin pack, local install/run validation, od plugin whoami/login through gh, and od plugin publish when the user is ready to open a registry PR.',
    '',
    'When finished, summarize files created, validation status, local install/run status, pack output, and the exact publish command or PR next step.',
  ].join('\n');
}

export function createPluginAuthoringHandoff(
  id: number,
  prompt = PLUGIN_AUTHORING_PROMPT,
): HomePromptHandoff {
  return {
    id,
    prompt,
    focus: true,
    source: 'plugin-authoring',
  };
}

export function createPluginUseHandoff(
  id: number,
  pluginId: string,
  inputs?: Record<string, unknown>,
): HomePromptHandoff {
  return {
    id,
    pluginId,
    ...(inputs ? { inputs } : {}),
    focus: true,
    source: 'plugin-use',
  };
}
