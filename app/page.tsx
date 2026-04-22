'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUp,
  BookOpen,
  Bot,
  Copy,
  FileText,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { useI18n } from '@/lib/hooks/use-i18n';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { AgentBar } from '@/components/agent/agent-bar';
import { SpeechButton } from '@/components/audio/speech-button';
import { UserProfileCard } from '@/components/user-profile';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { storePdfBlob } from '@/lib/utils/image-storage';
import type { UserRequirements } from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore } from '@/lib/store/user-profile';
import {
  type StageListItem,
  deleteStageData,
  getFirstSlideByStages,
  listStages,
  renameStage,
} from '@/lib/utils/stage-storage';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { useImportClassroom } from '@/lib/import/use-import-classroom';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';

interface FormState {
  pdfFiles: File[];
  requirement: string;
  webSearch: boolean;
}

const initialFormState: FormState = {
  pdfFiles: [],
  requirement: '',
  webSearch: false,
};

function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    import('@/lib/types/settings').SettingsSection | undefined
  >(undefined);
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });
  const currentModelId = useSettingsStore((s) => s.modelId);
  const nickname = useUserProfileStore((s) => s.nickname);

  /* eslint-disable react-hooks/set-state-in-effect -- Hydration from local storage must happen after mount */
  useEffect(() => {
    try {
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      if (savedWebSearch === 'true') {
        setForm((prev) => ({ ...prev, webSearch: true }));
      }
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [prevCachedRequirement, setPrevCachedRequirement] = useState(cachedRequirement);
  if (cachedRequirement !== prevCachedRequirement) {
    setPrevCachedRequirement(cachedRequirement);
    if (cachedRequirement) {
      setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
    }
  }

  const loadClassrooms = async () => {
    try {
      const list = await listStages();
      setClassrooms(list);
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((classroom) => classroom.id));
        setThumbnails(slides);
      } else {
        setThumbnails({});
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  const { importing, fileInputRef, triggerFileSelect, handleFileChange } = useImportClassroom(
    () => {
      loadClassrooms();
    },
  );

  useEffect(() => {
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial client hydration loads persisted classrooms
    loadClassrooms();
  }, []);

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'webSearch') localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(value));
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch {
      /* ignore */
    }
  };

  const showSetupToast = (icon: React.ReactNode, title: string, desc: string) => {
    toast.custom(
      (id) => (
        <div
          className="flex w-[356px] cursor-pointer items-start gap-3 rounded-2xl border border-amber-400/20 bg-[#120d05]/95 p-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          onClick={() => {
            toast.dismiss(id);
            setSettingsOpen(true);
          }}
        >
          <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-100">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/70">{desc}</p>
          </div>
        </div>
      ),
      { duration: 4000 },
    );
  };

  const handleGenerate = async () => {
    if (!currentModelId) {
      showSetupToast(
        <Bot className="size-4.5 text-amber-300" />,
        t('settings.modelNotConfigured'),
        t('settings.setupNeeded'),
      );
      setSettingsOpen(true);
      return;
    }

    if (!form.requirement.trim()) {
      setError(t('upload.requirementRequired'));
      textareaRef.current?.focus();
      return;
    }

    setError(null);

    try {
      const userProfile = useUserProfileStore.getState();
      const requirements: UserRequirements = {
        requirement: form.requirement,
        userNickname: userProfile.nickname || undefined,
        userBio: userProfile.bio || undefined,
        webSearch: form.webSearch || undefined,
      };

      // Store each PDF as a blob in IndexedDB and build pdfEntries
      const pdfEntries: Array<{
        storageKey: string;
        fileName: string;
        providerId?: string;
        providerConfig?: { apiKey?: string; baseUrl?: string };
      }> = [];

      if (form.pdfFiles.length > 0) {
        const settings = useSettingsStore.getState();
        const providerCfg = settings.pdfProvidersConfig?.[settings.pdfProviderId];
        const providerConfig = providerCfg
          ? { apiKey: providerCfg.apiKey, baseUrl: providerCfg.baseUrl }
          : undefined;

        for (const file of form.pdfFiles) {
          const storageKey = await storePdfBlob(file);
          pdfEntries.push({
            storageKey,
            fileName: file.name,
            providerId: settings.pdfProviderId,
            providerConfig,
          });
        }
      }

      const sessionState = {
        sessionId: nanoid(),
        requirements,
        pdfText: '',
        pdfImages: [],
        imageStorageIds: [],
        pdfEntries: pdfEntries.length > 0 ? pdfEntries : undefined,
        sceneOutlines: null,
        currentStep: 'generating' as const,
      };

      sessionStorage.setItem('generationSession', JSON.stringify(sessionState));
      router.push('/generation-preview');
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null);
    try {
      await deleteStageData(id);
      await loadClassrooms();
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      await renameStage(id, newName);
      setClassrooms((prev) =>
        prev.map((classroom) =>
          classroom.id === id ? { ...classroom, name: newName } : classroom,
        ),
      );
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error(t('classroom.renameFailed'));
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('classroom.today');
    if (diffDays === 1) return t('classroom.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('classroom.daysAgo')}`;
    return date.toLocaleDateString();
  };

  const canGenerate = !!form.requirement.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) handleGenerate();
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-600">Workspace</p>
            {/* AI model status indicator */}
            {currentModelId ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] text-emerald-400/80">
                <span className="size-1.5 rounded-full bg-emerald-400/70" />
                AI ready
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSettingsSection(undefined);
                  setSettingsOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] text-amber-400/80 transition-all hover:border-amber-400/40 hover:bg-amber-500/[0.13]"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-amber-400/70" />
                Setup AI model
              </button>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {nickname ? `${nickname}'s classrooms` : 'Your classrooms'}
          </h1>
          {classrooms.length > 0 && (
            <p className="mt-1 text-sm text-slate-600">
              {classrooms.length} {classrooms.length === 1 ? 'classroom' : 'classrooms'} ·
              AI-powered interactive lessons
            </p>
          )}
        </div>

        {/* Header actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <AgentBar />
          </div>
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-400 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-400/25 hover:bg-purple-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="size-4" />
            {importing ? 'Importing…' : t('import.classroom')}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex size-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/25 hover:bg-blue-500/10 hover:text-white"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Bento grid ── */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* ── New classroom card (primary action) ── */}
        <DashboardCard className="relative overflow-hidden p-5 before:!bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.30),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(147,51,234,0.22),transparent_50%)]">
          {/* Decorative top accent line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.6),rgba(147,51,234,0.5),transparent)]" />

          <div className="relative z-10 flex h-full flex-col gap-4">
            {/* Card header row */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
                <Plus className="size-3" />
                New classroom
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-700">
                {nickname || t('profile.defaultNickname')}
              </span>
            </div>

            {/* Prompt textarea */}
            <textarea
              ref={textareaRef}
              value={form.requirement}
              onChange={(e) => updateForm('requirement', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('upload.requirementPlaceholder')}
              className="min-h-[140px] w-full flex-1 resize-none bg-transparent text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-700"
            />

            {/* Controls */}
            <div className="space-y-3 border-t border-white/[0.06] pt-4">
              <GenerationToolbar
                webSearch={form.webSearch}
                onWebSearchChange={(value) => updateForm('webSearch', value)}
                onSettingsOpen={(section) => {
                  setSettingsSection(section);
                  setSettingsOpen(true);
                }}
                pdfFiles={form.pdfFiles}
                onPdfFilesChange={(files) => updateForm('pdfFiles', files)}
                onPdfError={setError}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Status pills */}
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-slate-700">
                    <FileText className="size-2.5 text-blue-400/50" />
                    {form.pdfFiles.length === 0
                      ? 'No PDF'
                      : form.pdfFiles.length === 1
                        ? form.pdfFiles[0].name
                        : `${form.pdfFiles.length} PDFs`}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-slate-700">
                    <Search className="size-2.5 text-purple-400/50" />
                    {form.webSearch ? 'Web on' : 'Web off'}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <SpeechButton
                    size="md"
                    onTranscription={(text) => {
                      setForm((prev) => {
                        const next = prev.requirement + (prev.requirement ? ' ' : '') + text;
                        updateRequirementCache(next);
                        return { ...prev, requirement: next };
                      });
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={cn(
                      'h-9 rounded-xl border px-4 text-sm font-semibold transition-all duration-300',
                      canGenerate
                        ? 'border-blue-400/40 bg-[linear-gradient(135deg,#2563eb,#7c3aed)] text-white shadow-[0_6px_20px_rgba(59,130,246,0.30)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(59,130,246,0.42)]'
                        : 'border-white/[0.06] bg-white/[0.03] text-slate-700',
                    )}
                  >
                    Generate
                    <ArrowUp className="size-3.5" />
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-red-400/80"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DashboardCard>

        {/* ── Existing classroom cards ── */}
        {classrooms.map((classroom, index) => (
          <motion.div
            key={classroom.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <ClassroomCard
              classroom={classroom}
              slide={thumbnails[classroom.id]}
              formatDate={formatDate}
              confirmingDelete={pendingDeleteId === classroom.id}
              onDelete={handleDelete}
              onRename={handleRename}
              onConfirmDelete={() => confirmDelete(classroom.id)}
              onCancelDelete={() => setPendingDeleteId(null)}
              onClick={() => router.push(`/classroom/${classroom.id}`)}
            />
          </motion.div>
        ))}

        {/* ── Ghost placeholders (no classrooms yet) ── */}
        {classrooms.length === 0 &&
          [0, 1].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-4 rounded-[30px] border border-dashed border-white/[0.07] bg-white/[0.01]"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02] text-slate-800">
                <BookOpen className="size-5" />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-medium text-slate-700">
                  Classroom {i + 2}
                </p>
                <p className="mt-1 text-[11px] text-slate-800">
                  Generate a lesson above to fill
                </p>
              </div>
            </motion.div>
          ))}
      </div>

      {/* ── Profile + status strip ── */}
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <UserProfileCard />

        {/* Quick-start panel */}
        <DashboardCard className="overflow-hidden p-0">
          <div className="flex h-full flex-col">
            {/* Top gradient band */}
            <div className="h-1 bg-[linear-gradient(90deg,#2563eb,#7c3aed,#0891b2)]" />

            <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.16),rgba(59,130,246,0.06))] text-blue-300 shadow-[0_0_24px_rgba(59,130,246,0.12)]">
                <Zap className="size-5" />
              </div>
              <div className="max-w-xs">
                <p className="text-sm font-semibold text-white">Ready to build a lesson?</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">
                  Describe any topic in the card above and press{' '}
                  <kbd className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                    ⌘ Enter
                  </kbd>{' '}
                  — AI agents build your interactive lesson in seconds.
                </p>
              </div>

              {!currentModelId && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-2 text-sm text-amber-300 transition-all hover:-translate-y-0.5 hover:border-amber-400/40 hover:bg-amber-500/[0.14]"
                >
                  <Settings className="size-3.5" />
                  Configure AI model to get started
                </button>
              )}
            </div>
          </div>
        </DashboardCard>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />
    </div>
  );
}

function ClassroomCard({
  classroom,
  slide,
  formatDate,
  onDelete,
  onRename,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  formatDate: (ts: number) => string;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newName: string) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setThumbWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(classroom.name);
    setEditing(true);
  };

  const commitRename = () => {
    if (!editing) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== classroom.name) {
      onRename(classroom.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <DashboardCard
      className="group cursor-pointer p-4"
      onClick={confirmingDelete ? undefined : onClick}
    >
      <div className="relative z-10 space-y-3">
        {/* Thumbnail */}
        <div
          ref={thumbRef}
          className="relative aspect-[4/3] overflow-hidden rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(2,6,23,0.86),rgba(15,23,42,0.86))]"
        >
          {slide && thumbWidth > 0 ? (
            <ThumbnailSlide
              slide={slide}
              size={thumbWidth}
              viewportSize={slide.viewportSize ?? 1000}
              viewportRatio={slide.viewportRatio ?? 0.5625}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-[20px] border border-purple-400/20 bg-purple-500/10 text-purple-300">
                <FileText className="size-6" />
              </div>
            </div>
          )}

          {/* Hover action buttons */}
          {!confirmingDelete && (
            <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-all duration-300 group-hover:opacity-100">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-xl border border-white/10 bg-black/40 text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-black/65"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(classroom.id, e);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-xl border border-white/10 bg-black/40 text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-black/65"
                onClick={startRename}
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          )}

          {/* Open indicator on hover */}
          {!confirmingDelete && (
            <div className="absolute bottom-3 left-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white/70 backdrop-blur-sm">
                Open classroom →
              </span>
            </div>
          )}

          {/* Delete confirmation overlay */}
          <AnimatePresence>
            {confirmingDelete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/78 px-6 text-center backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-medium text-white">
                  {t('classroom.deleteConfirmTitle')}?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/15"
                    onClick={onCancelDelete}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-red-400/25 bg-red-500/20 px-3 py-2 text-xs text-red-100 transition hover:bg-red-500/30"
                    onClick={onConfirmDelete}
                  >
                    {t('classroom.delete')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Metadata */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-blue-300/80">
                {classroom.sceneCount} {t('classroom.slides')}
              </span>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {formatDate(classroom.updatedAt)}
              </span>
            </div>

            {editing ? (
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  onBlur={commitRename}
                  maxLength={100}
                  placeholder={t('classroom.renamePlaceholder')}
                  className="w-full border-b border-blue-400/40 bg-transparent pb-1 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                />
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="truncate text-sm font-semibold text-white">{classroom.name}</p>
                </TooltipTrigger>
                <TooltipContent>{classroom.name}</TooltipContent>
              </Tooltip>
            )}
          </div>

          {!editing && (
            <button
              type="button"
              className="shrink-0 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1.5 text-slate-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/20 hover:bg-blue-500/10 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(classroom.name);
                toast.success(t('classroom.nameCopied'));
              }}
            >
              <Copy className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}

export default function Page() {
  return <HomePage />;
}
