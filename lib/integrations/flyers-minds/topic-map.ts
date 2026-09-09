import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';
import type { FlyersMindsDay } from './types';

// Flat-file storage, mirroring the existing data/classrooms + data/classroom-jobs
// convention in lib/server/classroom-storage.ts — one JSON file per (course, day),
// mapping a Flyers Minds day to the OpenMAIC classroom generated for it. A Day is
// the correct cache key granularity: verified against the real Flyers Minds schema
// (see types.ts), a day has exactly one topic — there is no finer-grained,
// independently-launchable curriculum entity below it to key on instead.
export const FLYERS_MINDS_MAP_DIR = path.join(process.cwd(), 'data', 'flyers-minds-map');

export interface FlyersMindsTopicMapping {
  courseSlug: string;
  day: number;
  topic: string;
  /** Hash of the Day content last used to generate a classroom — used to detect edits
   *  made in Flyers Minds so the cached classroom can be invalidated and regenerated. */
  contentHash: string;
  classroomId: string;
  classroomUrl: string;
  generatedAt: string;
}

function mappingKey(courseSlug: string, day: number): string {
  return `${courseSlug}__day-${day}`;
}

function mappingFilePath(courseSlug: string, day: number): string {
  return path.join(FLYERS_MINDS_MAP_DIR, `${mappingKey(courseSlug, day)}.json`);
}

/**
 * Deterministically stringifies a value for hashing: object keys are sorted
 * recursively at every depth so key ordering never affects the hash, while array
 * element order is preserved exactly as-is, since array order is semantically
 * meaningful curriculum ordering that MUST affect the hash (e.g. reordering
 * `content` sections, or `tasks`, must change the hash).
 *
 * Note: a plain `JSON.stringify(value, Object.keys(value).sort())` does NOT do
 * this correctly — passing an array as the replacer filters property names by
 * that allowlist at every nesting level, silently dropping any nested field whose
 * name isn't itself a top-level key (e.g. `content[].heading`, `tasks[].label`
 * would vanish entirely, since "heading" and "label" aren't top-level Day keys).
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Stable content hash — changes whenever anything about the day's content changes in
 *  Flyers Minds (including nested section/task/point content and ordering), regardless
 *  of top-level or nested key ordering. */
export function hashDayContent(day: FlyersMindsDay): string {
  return createHash('sha256').update(stableStringify(day)).digest('hex');
}

export async function readTopicMapping(
  courseSlug: string,
  day: number,
): Promise<FlyersMindsTopicMapping | null> {
  try {
    const content = await fs.readFile(mappingFilePath(courseSlug, day), 'utf-8');
    return JSON.parse(content) as FlyersMindsTopicMapping;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeTopicMapping(mapping: FlyersMindsTopicMapping): Promise<void> {
  await writeJsonFileAtomic(mappingFilePath(mapping.courseSlug, mapping.day), mapping);
}
