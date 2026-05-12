// Composed Home view — the top-down layout the entry view renders
// when the left nav rail's "Home" tab is active.
//
// Owns the prompt state + active plugin lifecycle and stitches
// together the smaller pieces (HomeHero, RecentProjectsStrip,
// PluginsHomeSection). Replaces the older left-side `PluginLoopHome`
// surface by lifting its plugin orchestration up here so the prompt
// textarea can live centered in the hero.

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApplyResult,
  InstalledPluginRecord,
  ProjectKind,
} from '@open-design/contracts';
import {
  applyPlugin,
  listPlugins,
  renderPluginBriefTemplate,
  resolvePluginQueryFallback,
} from '../state/projects';
import { useI18n } from '../i18n';
import type { Project } from '../types';
import { HomeHero } from './HomeHero';
import type { HomeHeroChip } from './home-hero/chips';
import { PluginDetailsModal } from './PluginDetailsModal';
import { PluginsHomeSection } from './PluginsHomeSection';
import type { PluginLoopSubmit } from './PluginLoopHome';
import { RecentProjectsStrip } from './RecentProjectsStrip';

interface ActivePlugin {
  record: InstalledPluginRecord;
  result: ApplyResult;
  inputs: Record<string, unknown>;
  // Stage B of plugin-driven-flow-plan: when the user applied this
  // plugin through the Home chip rail, the chip carries the project
  // kind we should stamp on the resulting create payload. `null` =
  // applied through the search picker / PluginsHomeSection, where the
  // kind defaults to the historical 'prototype' value.
  projectKind: ProjectKind | null;
  chipId: string | null;
}

interface Props {
  projects: Project[];
  projectsLoading?: boolean;
  onSubmit: (payload: PluginLoopSubmit) => void;
  onOpenProject: (id: string) => void;
  onViewAllProjects: () => void;
  // Stage B: optional callbacks the rail's migration chips need.
  // HomeView itself never imports them; EntryShell threads them
  // through so the dispatcher can stay declarative.
  onImportFolder?: () => Promise<void> | void;
  onOpenNewProject?: (tab: 'template') => void;
}

export function HomeView({
  projects,
  projectsLoading,
  onSubmit,
  onOpenProject,
  onViewAllProjects,
  onImportFolder,
  onOpenNewProject,
}: Props) {
  const { locale } = useI18n();
  const [plugins, setPlugins] = useState<InstalledPluginRecord[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(true);
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);
  const [pendingChipId, setPendingChipId] = useState<string | null>(null);
  const [active, setActive] = useState<ActivePlugin | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detailsRecord, setDetailsRecord] = useState<InstalledPluginRecord | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPlugins().then((rows) => {
      if (cancelled) return;
      setPlugins(rows);
      setPluginsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const contextItemCount = useMemo(
    () => active?.result.contextItems?.length ?? 0,
    [active],
  );

  async function usePlugin(
    record: InstalledPluginRecord,
    nextPrompt?: string | null,
    options?: { projectKind?: ProjectKind; chipId?: string },
  ) {
    setPendingApplyId(record.id);
    if (options?.chipId) setPendingChipId(options.chipId);
    setError(null);
    const result = await applyPlugin(record.id, { locale });
    setPendingApplyId(null);
    setPendingChipId(null);
    if (!result) {
      setError(`Failed to apply ${record.title}. Make sure the daemon is reachable.`);
      return;
    }
    const inputs: Record<string, unknown> = {};
    for (const field of result.inputs ?? []) {
      if (field.default !== undefined) inputs[field.name] = field.default;
    }
    setActive({
      record,
      result,
      inputs,
      projectKind: options?.projectKind ?? null,
      chipId: options?.chipId ?? null,
    });
    const query = result.query || resolvePluginQueryFallback(record.manifest?.od?.useCase?.query, locale);
    if (nextPrompt !== undefined && nextPrompt !== null) {
      setPrompt(nextPrompt);
    } else if (query) {
      setPrompt(renderPluginBriefTemplate(query, inputs));
    }
    setDetailsRecord(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function clearActive() {
    setActive(null);
    setPrompt('');
  }

  // Stage B of plugin-driven-flow-plan: the chip rail dispatcher.
  // Pure UI-state mapping — the heavy lifting (apply / import) is
  // delegated back to existing handlers. Migration chips that don't
  // have a bound plugin (`import-folder`, `open-template-picker`)
  // forward to callbacks threaded in from EntryShell.
  function pickChip(chip: HomeHeroChip) {
    setError(null);
    switch (chip.action.kind) {
      case 'apply-scenario':
      case 'apply-figma-migration': {
        const targetId = chip.action.pluginId;
        const record = plugins.find((p) => p.id === targetId);
        if (!record) {
          setError(
            `Bundled scenario "${targetId}" is not installed. Reinstall the daemon to restore the default plugin set.`,
          );
          return;
        }
        void usePlugin(record, undefined, {
          projectKind: chip.action.projectKind,
          chipId: chip.id,
        });
        return;
      }
      case 'import-folder': {
        if (!onImportFolder) {
          setError('Folder import is not available in this shell.');
          return;
        }
        void onImportFolder();
        return;
      }
      case 'open-template-picker': {
        if (!onOpenNewProject) {
          setError('Template picker is not available in this shell.');
          return;
        }
        onOpenNewProject('template');
        return;
      }
    }
  }

  function submit() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSubmit({
      prompt: trimmed,
      pluginId: active?.record.id ?? null,
      appliedPluginSnapshotId: active?.result.appliedPlugin?.snapshotId ?? null,
      pluginTitle: active?.record.title ?? null,
      taskKind: active?.result.appliedPlugin?.taskKind ?? null,
      projectKind: active?.projectKind ?? null,
    });
  }

  return (
    <div className="home-view" data-testid="home-view">
      <HomeHero
        ref={inputRef}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={submit}
        activePluginTitle={active?.record.title ?? null}
        activeChipId={active?.chipId ?? null}
        onClearActivePlugin={clearActive}
        pluginOptions={plugins}
        pluginsLoading={pluginsLoading}
        pendingPluginId={pendingApplyId}
        pendingChipId={pendingChipId}
        onPickPlugin={(record, nextPrompt) => void usePlugin(record, nextPrompt)}
        onPickChip={pickChip}
        contextItemCount={contextItemCount}
        error={error}
      />

      <RecentProjectsStrip
        projects={projects}
        {...(projectsLoading !== undefined ? { loading: projectsLoading } : {})}
        onOpen={onOpenProject}
        onViewAll={onViewAllProjects}
      />

      <PluginsHomeSection
        plugins={plugins}
        loading={pluginsLoading}
        activePluginId={active?.record.id ?? null}
        pendingApplyId={pendingApplyId}
        onUse={(record) => void usePlugin(record)}
        onOpenDetails={setDetailsRecord}
      />

      {detailsRecord ? (
        <PluginDetailsModal
          record={detailsRecord}
          onClose={() => setDetailsRecord(null)}
          onUse={(record) => void usePlugin(record)}
          isApplying={pendingApplyId === detailsRecord.id}
        />
      ) : null}
    </div>
  );
}
