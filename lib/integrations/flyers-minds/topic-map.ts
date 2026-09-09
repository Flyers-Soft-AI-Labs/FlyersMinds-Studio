import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';
import type { FlyersMindsDay } from './types';

// Flat-file storage, mirroring the existing data/classrooms + data/classroom-jobs
// convention in lib/server/classroom-storage.ts — one JSON file per (course, day),
// mapping a Flyers Minds topic to the OpenMAIC classroom generated for it.
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

/** Stable content hash — changes whenever anything about the day's content changes in
 *  Flyers Minds, regardless of field ordering. */
export function hashDayContent(day: FlyersMindsDay): string {
  const stable = JSON.stringify(day, Object.keys(day).sort());
  return createHash('sha256').update(stable).digest('hex');
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
