'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';

/**
 * The actual target of Flyers Minds' "Click here for OpenAI" button, e.g.
 *   /classroom/launch?day=1&courseSlug=aiml
 *
 * This page never asks the visitor for anything — it calls OpenMAIC's own
 * /api/integrations/flyers-minds/launch route, which fetches the topic live from
 * Flyers Minds, reuses an already-generated classroom for that topic if the content
 * hasn't changed, or generates a fresh one and polls until it's ready — then redirects
 * here to the finished /classroom/{id}.
 */

type LaunchState =
  | { phase: 'starting' }
  | { phase: 'generating'; message: string; progress: number }
  | { phase: 'error'; message: string };

interface LaunchStartResponse {
  success: boolean;
  status?: 'ready' | 'generating';
  url?: string;
  pollUrl?: string;
  pollIntervalMs?: number;
  message?: string;
  error?: string;
}

interface JobPollResponse {
  success: boolean;
  done?: boolean;
  progress?: number;
  message?: string;
  pollIntervalMs?: number;
  result?: { url: string };
  error?: string;
}

function FlyersMindsLaunchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get('day');
  const courseSlug = searchParams.get('courseSlug') || undefined;
  const [state, setState] = useState<LaunchState>({ phase: 'starting' });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const day = Number(dayParam);
    if (!dayParam || !Number.isInteger(day) || day <= 0) {
      setState({ phase: 'error', message: 'This link is missing a valid "day" number.' });
      return;
    }

    let cancelled = false;

    const pollJob = async (pollUrl: string, pollIntervalMs: number) => {
      while (!cancelled) {
        const res = await fetch(pollUrl, { cache: 'no-store' });
        const data = (await res.json()) as JobPollResponse;

        if (!res.ok || data.success === false) {
          if (!cancelled) setState({ phase: 'error', message: data.error || 'Classroom generation failed.' });
          return;
        }
        if (data.done) {
          if (data.result?.url) {
            router.replace(data.result.url);
          } else if (!cancelled) {
            setState({ phase: 'error', message: data.error || 'Classroom generation failed.' });
          }
          return;
        }
        if (!cancelled) {
          setState({
            phase: 'generating',
            message: data.message || 'Generating your classroom…',
            progress: data.progress ?? 0,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs || 5000));
      }
    };

    const start = async () => {
      try {
        const res = await fetch('/api/integrations/flyers-minds/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day, courseSlug }),
        });
        const data = (await res.json()) as LaunchStartResponse;

        if (!res.ok || data.success === false) {
          if (!cancelled) {
            setState({ phase: 'error', message: data.error || 'Could not start the classroom.' });
          }
          return;
        }

        if (data.status === 'ready' && data.url) {
          router.replace(data.url);
          return;
        }

        if (!cancelled) {
          setState({
            phase: 'generating',
            message: data.message || 'Generating your classroom…',
            progress: 0,
          });
        }
        if (data.pollUrl) {
          await pollJob(data.pollUrl, data.pollIntervalMs || 5000);
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            phase: 'error',
            message: err instanceof Error ? err.message : 'Something went wrong.',
          });
        }
      }
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [dayParam, courseSlug, router]);

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#020617] px-4 text-white">
      <div className="w-full max-w-sm text-center">
        {state.phase === 'error' ? (
          <>
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="mt-5 text-lg font-semibold text-white">Couldn&apos;t open this lesson</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">{state.message}</p>
          </>
        ) : (
          <>
            <div className="relative mx-auto flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] text-white shadow-[0_0_30px_rgba(255,255,255,0.12)]">
              <Sparkles className="size-6" />
              <Loader2 className="absolute -right-1.5 -top-1.5 size-5 animate-spin text-cyan-300" />
            </div>
            <h1 className="mt-5 text-lg font-semibold text-white">Preparing your AI classroom</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {state.phase === 'generating' ? state.message : 'Connecting to Flyers Minds…'}
            </p>
            {state.phase === 'generating' && (
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-500"
                  style={{ width: `${Math.max(4, Math.min(100, state.progress))}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FlyersMindsLaunchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#020617]">
          <Loader2 className="size-6 animate-spin text-white/60" />
        </div>
      }
    >
      <FlyersMindsLaunchContent />
    </Suspense>
  );
}
