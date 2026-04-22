'use client';

import {
  Archive,
  ArrowLeft,
  Download,
  FileDown,
  Loader2,
  MoonStar,
  Package,
  Settings,
  Sun,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useTheme } from '@/lib/hooks/use-theme';
import { LanguageSwitcher } from './language-switcher';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsDialog } from './settings';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store/stage';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { useExportClassroom } from '@/lib/export/use-export-classroom';

interface HeaderProps {
  readonly currentSceneTitle: string;
}

export function Header({ currentSceneTitle }: HeaderProps) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const { exporting: isExporting, exportPPTX, exportResourcePack } = useExportPPTX();
  const { exporting: isExportingZip, exportClassroomZip } = useExportClassroom();
  const exportRef = useRef<HTMLDivElement>(null);
  const scenes = useStageStore((s) => s.scenes);
  const generatingOutlines = useStageStore((s) => s.generatingOutlines);
  const failedOutlines = useStageStore((s) => s.failedOutlines);
  const mediaTasks = useMediaGenerationStore((s) => s.tasks);

  const canExport =
    scenes.length > 0 &&
    generatingOutlines.length === 0 &&
    failedOutlines.length === 0 &&
    Object.values(mediaTasks).every((task) => task.status === 'done' || task.status === 'failed');

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (exportMenuOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    },
    [exportMenuOpen],
  );

  useEffect(() => {
    if (!exportMenuOpen) return;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen, handleClickOutside]);

  return (
    <>
      <header className="px-5 pb-4 pt-5 sm:px-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.78))] px-4 py-4 shadow-[0_16px_60px_rgba(2,6,23,0.5)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <button
              onClick={() => router.push('/')}
              className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white"
              title={t('generation.backToHome')}
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-[0.28em] font-semibold text-slate-500">
                {t('stage.currentScene')}
              </span>
              <h1
                className="mt-2 truncate text-2xl font-semibold tracking-tight text-white"
                suppressHydrationWarning
              >
                {currentSceneTitle || t('common.loading')}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex size-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300 transition hover:bg-blue-500/10 hover:text-white"
              >
                {theme === 'dark' ? (
                  <Sun className="size-4.5" />
                ) : (
                  <MoonStar className="size-4.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex size-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300 transition hover:bg-blue-500/10 hover:text-white"
              >
                <Settings className="size-4.5" />
              </button>
            </div>

            <div className="relative" ref={exportRef}>
              <button
                onClick={() => {
                  if (canExport && !isExporting && !isExportingZip)
                    setExportMenuOpen(!exportMenuOpen);
                }}
                disabled={!canExport || isExporting || isExportingZip}
                title={
                  canExport
                    ? isExporting || isExportingZip
                      ? t('export.exporting')
                      : t('export.pptx')
                    : t('share.notReady')
                }
                className={cn(
                  'flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm transition-all',
                  canExport && !isExporting && !isExportingZip
                    ? 'border-white/10 bg-white/[0.04] text-slate-200 hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white'
                    : 'border-white/5 bg-white/[0.03] text-slate-500 opacity-60',
                )}
              >
                {isExporting || isExportingZip ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Export
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 min-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/95 p-1.5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      exportPPTX();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
                  >
                    <FileDown className="size-4 text-blue-300" />
                    <span>{t('export.pptx')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      exportResourcePack();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
                  >
                    <Package className="size-4 text-purple-300" />
                    <div>
                      <div>{t('export.resourcePack')}</div>
                      <div className="text-[11px] text-slate-500">
                        {t('export.resourcePackDesc')}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      exportClassroomZip();
                    }}
                    disabled={isExportingZip}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
                  >
                    <Archive className="size-4 text-cyan-300" />
                    <div>
                      <div>{t('export.classroomZip')}</div>
                      <div className="text-[11px] text-slate-500">
                        {t('export.classroomZipDesc')}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
