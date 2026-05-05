'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Bot, ChevronRight, LayoutDashboard, Settings, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { listStages } from '@/lib/utils/stage-storage';
import type { SettingsSection } from '@/lib/types/settings';

export function DashboardSidebar({
  mobileOpen,
  onClose,
  onSettingsOpen,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  onSettingsOpen: (section?: SettingsSection) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleClassroomNav = async () => {
    onClose();
    try {
      const classrooms = await listStages();
      if (classrooms.length > 0) {
        router.push(`/classroom/${classrooms[0].id}`);
      } else {
        router.push('/');
        toast.info('No classrooms yet — create one from the dashboard!');
      }
    } catch {
      router.push('/');
    }
  };

  const linkItems = [
    {
      label: 'Dashboard',
      sub: 'Home & overview',
      href: '/',
      icon: LayoutDashboard,
      match: (p: string) => p === '/',
    },
  ];

  const actionItems = [
    {
      label: 'Classrooms',
      sub: 'Open most recent',
      icon: BookOpen,
      active: pathname.startsWith('/classroom/'),
      onClick: handleClassroomNav,
    },
    {
      label: 'AI Tools',
      sub: 'Models & providers',
      icon: Bot,
      active: false,
      onClick: () => {
        onClose();
        onSettingsOpen('providers');
      },
    },
    {
      label: 'Settings',
      sub: 'App preferences',
      icon: Settings,
      active: false,
      onClick: () => {
        onClose();
        onSettingsOpen('general');
      },
    },
  ];

  const itemBase = (active: boolean) =>
    cn(
      'group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-300',
      active
        ? 'border-blue-400/30 bg-[linear-gradient(90deg,rgba(37,99,235,0.18),rgba(147,51,234,0.14))] text-white shadow-[0_0_28px_rgba(59,130,246,0.14)]'
        : 'border-transparent bg-white/[0.03] text-slate-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.06] hover:text-white',
    );

  const iconWrap = (active: boolean) =>
    cn(
      'flex size-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300',
      active
        ? 'border-blue-400/35 bg-blue-500/15 text-blue-300'
        : 'border-white/[0.08] bg-white/[0.04] text-slate-400 group-hover:border-blue-400/20 group-hover:bg-blue-500/10 group-hover:text-blue-300',
    );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.97),rgba(3,7,18,0.94))] px-5 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_24%)] lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="relative flex h-full flex-col">
          {/* ── Logo ── */}
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-3" onClick={onClose}>
              <div className="flex size-11 items-center justify-center rounded-2xl border border-blue-400/30 bg-[linear-gradient(180deg,rgba(59,130,246,0.22),rgba(59,130,246,0.08))] shadow-[0_0_32px_rgba(59,130,246,0.28)] transition-all duration-300 group-hover:shadow-[0_0_44px_rgba(59,130,246,0.38)]">
                <Sparkles className="size-5 text-blue-300" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-blue-200">OpenMAIC</p>
                <h2 className="mt-0.5 text-[15px] font-semibold text-white">AI Dashboard</h2>
              </div>
            </Link>

            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white lg:hidden"
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>

          {/* ── Nav label ── */}
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-400">
            Menu
          </p>

          {/* ── Link items ── */}
          <nav className="space-y-1.5">
            {linkItems.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  className={itemBase(active)}
                >
                  <span className={iconWrap(active)}>
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block leading-none">{item.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-none text-slate-400 transition-colors group-hover:text-slate-300">
                      {item.sub}
                    </span>
                  </div>
                  {active && <ChevronRight className="size-3.5 shrink-0 text-blue-400/50" />}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="!my-3 border-t border-white/[0.05]" />

            {/* ── Button items (Classrooms, AI Tools, Settings) ── */}
            {actionItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={itemBase(item.active)}
                >
                  <span className={iconWrap(item.active)}>
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block leading-none">{item.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-none text-slate-400 transition-colors group-hover:text-slate-300">
                      {item.sub}
                    </span>
                  </div>
                  {item.active ? (
                    <ChevronRight className="size-3.5 shrink-0 text-blue-400/50" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* ── Bottom workspace card ── */}
          <div className="mt-auto space-y-3">
            {/* Subtle version badge */}
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[10px] text-slate-400">
                <span className="size-1.5 rounded-full bg-emerald-500/70" />
                Workspace active
              </span>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">About</p>
              <p className="mt-2.5 text-[13px] font-medium leading-snug text-slate-300">
                Immersive AI classroom generation
              </p>
              <p className="mt-2 text-[12px] leading-5 text-slate-400">
                Build lessons, review scenes, and launch interactive teaching flows from one place.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
