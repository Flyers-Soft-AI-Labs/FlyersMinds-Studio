'use client';

import { useMemo, useState } from 'react';
import { Menu, MoonStar, Settings, Sparkles, Sun, UserCircle2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SettingsDialog } from '@/components/settings';
import { useTheme } from '@/lib/hooks/use-theme';
import { useUserProfileStore } from '@/lib/store/user-profile';

function getHeaderCopy(pathname: string) {
  if (pathname.startsWith('/classroom/')) {
    return {
      title: 'Classroom',
      description: 'Monitor scenes, agents, and live lesson flow in one focused workspace.',
    };
  }

  return {
    title: 'Dashboard',
    description:
      'Create, organize, and launch immersive AI classrooms with a darker, faster workspace.',
  };
}

export function DashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const { title, description } = useMemo(() => getHeaderCopy(pathname), [pathname]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);

  return (
    <>
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(2,6,23,0.8))] px-4 py-4 shadow-[0_18px_70px_rgba(2,6,23,0.52)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_left_top,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_right_top,rgba(168,85,247,0.14),transparent_28%)] sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={onMenuClick}
                className="mt-0.5 flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white lg:hidden"
              >
                <Menu className="size-5" />
              </button>
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(147,51,234,0.16))] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-blue-100 shadow-[0_0_30px_rgba(59,130,246,0.12)]">
                  <Sparkles className="size-3.5" />
                  Command Center
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">{description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:flex">
                <LanguageSwitcher />
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex size-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-500/10 hover:text-white"
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
                  className="flex size-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-500/10 hover:text-white"
                >
                  <Settings className="size-4.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="hidden text-right sm:block">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Active User</p>
                  <p className="mt-1 text-sm font-medium text-white">{nickname || 'Learner'}</p>
                </div>
                <div className="flex size-11 items-center justify-center overflow-hidden rounded-2xl border border-blue-400/25 bg-[linear-gradient(180deg,rgba(59,130,246,0.18),rgba(59,130,246,0.08))] shadow-[0_0_30px_rgba(59,130,246,0.12)]">
                  {avatar ? (
                    <img src={avatar} alt="" className="size-full object-cover" />
                  ) : (
                    <UserCircle2 className="size-6 text-blue-200" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 sm:hidden">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <LanguageSwitcher />
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white"
            >
              {theme === 'dark' ? <Sun className="size-4.5" /> : <MoonStar className="size-4.5" />}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white"
            >
              <Settings className="size-4.5" />
            </button>
          </div>
        </div>
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
