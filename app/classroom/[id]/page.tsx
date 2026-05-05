'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookOpen, Layers3, Loader2, Sparkles } from 'lucide-react';
import { Stage } from '@/components/stage';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { useStageStore } from '@/lib/store';
import { loadImageMapping } from '@/lib/utils/image-storage';
import { useSceneGenerator } from '@/lib/hooks/use-scene-generator';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useWhiteboardHistoryStore } from '@/lib/store/whiteboard-history';
import { createLogger } from '@/lib/logger';
import { MediaStageProvider } from '@/lib/contexts/media-stage-context';
import { generateMediaForOutlines } from '@/lib/media/media-orchestrator';

const log = createLogger('Classroom');

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params?.id as string;

  const { loadFromStorage } = useStageStore();
  const stage = useStageStore((s) => s.stage);
  const scenes = useStageStore((s) => s.scenes);
  const outlines = useStageStore((s) => s.outlines);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generationStartedRef = useRef(false);

  const { generateRemaining, retrySingleOutline, stop } = useSceneGenerator({
    onComplete: () => {
      log.info('[Classroom] All scenes generated');
    },
  });

  const loadClassroom = useCallback(async () => {
    try {
      await loadFromStorage(classroomId);

      if (!useStageStore.getState().stage) {
        log.info('No IndexedDB data, trying server-side storage for:', classroomId);
        try {
          const res = await fetch(`/api/classroom?id=${encodeURIComponent(classroomId)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.classroom) {
              const { stage, scenes } = json.classroom;
              useStageStore.getState().setStage(stage);
              useStageStore.setState({
                scenes,
                currentSceneId: scenes[0]?.id ?? null,
              });
              log.info('Loaded from server-side storage:', classroomId);

              if (stage.generatedAgentConfigs?.length) {
                const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
                await saveGeneratedAgents(stage.id, stage.generatedAgentConfigs);
                log.info('Hydrated server-generated agents for stage:', stage.id);
              }
            }
          }
        } catch (fetchErr) {
          log.warn('Server-side storage fetch failed:', fetchErr);
        }
      }

      await useMediaGenerationStore.getState().restoreFromDB(classroomId);
      const { loadGeneratedAgentsForStage, useAgentRegistry } =
        await import('@/lib/orchestration/registry/store');
      const generatedAgentIds = await loadGeneratedAgentsForStage(classroomId);
      const { useSettingsStore } = await import('@/lib/store/settings');
      if (generatedAgentIds.length > 0) {
        useSettingsStore.getState().setAgentMode('auto');
        useSettingsStore.getState().setSelectedAgentIds(generatedAgentIds);
      } else {
        const stage = useStageStore.getState().stage;
        const stageAgentIds = stage?.agentIds;
        const registry = useAgentRegistry.getState();
        const cleanIds = stageAgentIds?.filter((id) => {
          const a = registry.getAgent(id);
          return a && !a.isGenerated;
        });
        useSettingsStore.getState().setAgentMode('preset');
        useSettingsStore
          .getState()
          .setSelectedAgentIds(
            cleanIds && cleanIds.length > 0 ? cleanIds : ['default-1', 'default-2', 'default-3'],
          );
      }
    } catch (error) {
      log.error('Failed to load classroom:', error);
      setError(error instanceof Error ? error.message : 'Failed to load classroom');
    } finally {
      setLoading(false);
    }
  }, [classroomId, loadFromStorage]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    generationStartedRef.current = false;

    const mediaStore = useMediaGenerationStore.getState();
    mediaStore.revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    useWhiteboardHistoryStore.getState().clearHistory();

    loadClassroom();

    return () => {
      stop();
    };
  }, [classroomId, loadClassroom, stop]);

  useEffect(() => {
    if (loading || error || generationStartedRef.current) return;

    const state = useStageStore.getState();
    const { outlines, scenes, stage } = state;
    const completedOrders = new Set(scenes.map((s) => s.order));
    const hasPending = outlines.some((o) => !completedOrders.has(o.order));

    if (hasPending && stage) {
      generationStartedRef.current = true;
      const genParamsStr = sessionStorage.getItem('generationParams');
      const params = genParamsStr ? JSON.parse(genParamsStr) : {};
      const storageIds = (params.pdfImages || [])
        .map((img: { storageId?: string }) => img.storageId)
        .filter(Boolean);

      loadImageMapping(storageIds).then((imageMapping) => {
        generateRemaining({
          pdfImages: params.pdfImages,
          imageMapping,
          stageInfo: {
            name: stage.name || '',
            description: stage.description,
            style: stage.style,
          },
          agents: params.agents,
          userProfile: params.userProfile,
          languageDirective: params.languageDirective || stage.languageDirective,
        });
      });
    } else if (outlines.length > 0 && stage) {
      generationStartedRef.current = true;
      generateMediaForOutlines(outlines, stage.id).catch((err) => {
        log.warn('[Classroom] Media generation resume error:', err);
      });
    }
  }, [loading, error, generateRemaining]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Scenes',
        value: loading ? '--' : String(scenes.length).padStart(2, '0'),
        icon: Layers3,
      },
      {
        label: 'Outlines',
        value: loading ? '--' : String(outlines.length).padStart(2, '0'),
        icon: BookOpen,
      },
      {
        label: 'Status',
        value: loading ? 'SYNC' : error ? 'ALERT' : 'LIVE',
        icon: Sparkles,
      },
    ],
    [error, loading, outlines.length, scenes.length],
  );

  return (
    <MediaStageProvider value={classroomId}>
      <div className="space-y-7">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <DashboardCard className="p-6 sm:p-7">
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Classroom Workspace
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                {stage?.name || 'Interactive classroom'}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Review scenes, manage live playback, and keep the classroom pipeline flowing without
                leaving the dashboard.
              </p>
            </div>
          </DashboardCard>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <DashboardCard key={card.label} className="p-5">
                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        {card.label}
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                    </div>
                    <div className="flex size-11 items-center justify-center rounded-2xl border border-blue-400/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.18),rgba(59,130,246,0.08))] text-blue-300 shadow-[0_0_24px_rgba(59,130,246,0.12)]">
                      <Icon className="size-5" />
                    </div>
                  </div>
                </DashboardCard>
              );
            })}
          </div>
        </section>

        <DashboardCard className="overflow-hidden p-0">
          <div className="flex flex-col h-[calc(100vh-18rem)] min-h-[720px]">
            {loading ? (
              <div className="flex h-full items-center justify-center bg-transparent">
                <div className="text-center text-slate-300">
                  <Loader2 className="mx-auto size-8 animate-spin text-blue-300" />
                  <p className="mt-4 text-sm">Loading classroom...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center bg-transparent px-6">
                <div className="max-w-md rounded-[28px] border border-red-500/20 bg-red-500/10 p-8 text-center">
                  <p className="text-base font-medium text-red-100">Error: {error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      loadClassroom();
                    }}
                    className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/20 px-4 py-2 text-sm text-white transition hover:bg-red-500/30"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <Stage onRetryOutline={retrySingleOutline} />
            )}
          </div>
        </DashboardCard>
      </div>
    </MediaStageProvider>
  );
}
