export interface CourseProgress {
  stageId: string;
  completedLessons: number;
  currentLesson: number;
  quizScore?: number;
  lastOpenedAt: number;
}

const STORAGE_KEY = 'schoolCourseProgress';

export function readCourseProgress(): Record<string, CourseProgress> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, CourseProgress>;
  } catch {
    return {};
  }
}

export function upsertCourseProgress(stageId: string, update: Partial<CourseProgress>) {
  if (typeof window === 'undefined') return;
  const records = readCourseProgress();
  const current = records[stageId];
  records[stageId] = {
    ...(current || {}),
    stageId,
    completedLessons: current?.completedLessons ?? 0,
    currentLesson: current?.currentLesson ?? 1,
    lastOpenedAt: current?.lastOpenedAt ?? Date.now(),
    ...update,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
