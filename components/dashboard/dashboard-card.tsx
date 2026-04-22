'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function DashboardCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.96))] shadow-[0_30px_90px_rgba(2,6,23,0.58)] backdrop-blur-xl',
        'transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-blue-400/20 hover:shadow-[0_34px_110px_rgba(37,99,235,0.18)]',
        'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_30%)]',
        'after:pointer-events-none after:absolute after:inset-x-8 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent after:opacity-70',
        className,
      )}
      {...props}
    />
  );
}
