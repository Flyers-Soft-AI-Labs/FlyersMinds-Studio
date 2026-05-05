'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Mic, MicOff, Play, Send, X } from 'lucide-react';
import { AvatarDisplay } from '@/components/ui/avatar-display';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { useSettingsStore } from '@/lib/store/settings';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RaiseHandPanelProps {
  readonly open: boolean;
  readonly question: string;
  readonly answer: string | null;
  readonly loading: boolean;
  readonly error?: string | null;
  readonly onQuestionChange: (question: string) => void;
  readonly onSubmit: () => void;
  readonly onResume: () => void;
  readonly onClose?: () => void;
}

export function RaiseHandPanel({
  open,
  question,
  answer,
  loading,
  error,
  onQuestionChange,
  onSubmit,
  onResume,
  onClose,
}: RaiseHandPanelProps) {
  const asrEnabled = useSettingsStore((state) => state.asrEnabled);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const { isRecording, isProcessing, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder({
      onTranscription: (text) => {
        const trimmed = text.trim();
        if (!trimmed) {
          toast.info('No speech detected');
          setVoiceOpen(false);
          return;
        }
        onQuestionChange(trimmed);
        setVoiceOpen(false);
      },
      onError: (message) => {
        toast.error(message);
        setVoiceOpen(false);
      },
    });

  const toggleVoice = () => {
    if (!asrEnabled || loading) return;
    if (voiceOpen) {
      if (isRecording) stopRecording();
      else cancelRecording();
      setVoiceOpen(false);
      return;
    }
    setVoiceOpen(true);
    startRecording();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[130] pointer-events-none"
        >
          <div className="absolute inset-0 bg-black/10 dark:bg-black/20" />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.21, 1, 0.36, 1] }}
            className="absolute right-5 bottom-5 w-[min(460px,calc(100%-2.5rem))] pointer-events-auto"
          >
            <div className="rounded-2xl border border-blue-200/80 dark:border-blue-800/70 bg-white/88 dark:bg-gray-950/88 backdrop-blur-xl shadow-[0_22px_70px_-24px_rgba(15,23,42,0.6)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-4">
                <div className="size-11 rounded-full overflow-hidden border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950">
                  <AvatarDisplay src="/avatars/assistant.svg" alt="Assistant" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500 dark:text-blue-300">
                    Classroom assistant
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    What is your concern?
                  </div>
                </div>
                {onClose && !loading && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="size-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    aria-label="Close raise hand panel"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="px-4 py-4 space-y-3">
                <div className="flex items-end gap-2 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white/75 dark:bg-gray-900/75 px-3 py-2">
                  <textarea
                    value={question}
                    onChange={(event) => onQuestionChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        onSubmit();
                      }
                    }}
                    disabled={loading}
                    rows={2}
                    placeholder="Ask your question..."
                    className="min-h-12 max-h-28 flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={!asrEnabled || loading}
                    className={cn(
                      'size-9 rounded-full flex items-center justify-center transition active:scale-95',
                      !asrEnabled || loading
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : voiceOpen
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60',
                    )}
                    aria-label="Voice question"
                  >
                    {asrEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={loading || !question.trim()}
                    className="size-9 rounded-full bg-blue-600 text-white flex items-center justify-center transition hover:bg-blue-700 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed"
                    aria-label="Send question"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </div>

                {voiceOpen && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-300">
                    <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                    {isProcessing ? 'Processing voice...' : 'Listening...'}
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-red-200/80 dark:border-red-800/70 bg-red-50/80 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-200">
                    {error}
                  </div>
                )}

                {answer && (
                  <div className="rounded-xl border border-blue-100 dark:border-blue-900/70 bg-blue-50/70 dark:bg-blue-950/30 px-3 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-100">
                      {answer}
                    </p>
                    <button
                      type="button"
                      onClick={onResume}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-900 dark:bg-white px-3.5 py-2 text-xs font-semibold text-white dark:text-gray-950 hover:opacity-90 active:scale-95 transition"
                    >
                      <Play className="size-3.5" />
                      Resume Class
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
