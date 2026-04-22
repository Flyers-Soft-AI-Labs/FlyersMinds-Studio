'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/header';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { SettingsDialog } from '@/components/settings';
import { cn } from '@/lib/utils';
import type { SettingsSection } from '@/lib/types/settings';

const fullscreenRoutes = ['/generation-preview'];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>(undefined);

  const isFullscreenRoute = useMemo(
    () => fullscreenRoutes.some((route) => pathname.startsWith(route)),
    [pathname],
  );

  if (isFullscreenRoute) {
    return <>{children}</>;
  }

  const openSettings = (section?: SettingsSection) => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-8%] h-[420px] w-[420px] rounded-full bg-blue-500/14 blur-[120px]" />
        <div className="absolute bottom-[-12%] right-[-6%] h-[460px] w-[460px] rounded-full bg-purple-500/14 blur-[140px]" />
        <div className="absolute left-[24%] top-[8%] h-[320px] w-[320px] rounded-full bg-cyan-400/8 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:52px_52px] opacity-30" />
      </div>

      <DashboardSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onSettingsOpen={openSettings}
      />

      <div className="relative lg:pl-72">
        <DashboardHeader onMenuClick={() => setMobileOpen(true)} />
        <main className={cn('px-4 pb-10 pt-7 sm:px-6 lg:px-8')}>{children}</main>
      </div>

      {/* Shell-level settings dialog — used by sidebar nav items */}
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
