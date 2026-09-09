import { after, type NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { buildRequestOrigin, readClassroom } from '@/lib/server/classroom-storage';
import {
  createClassroomGenerationJob,
  readClassroomGenerationJob,
} from '@/lib/server/classroom-job-store';
import { runClassroomGenerationJob } from '@/lib/server/classroom-job-runner';
import type { GenerateClassroomInput } from '@/lib/server/classroom-generation';
import { getDay, resolveCourseTitle } from '@/lib/integrations/flyers-minds/client';
import { buildRequirementFromDay } from '@/lib/integrations/flyers-minds/requirement';
import {
  hashDayContent,
  readTopicMapping,
  writeTopicMapping,
} from '@/lib/integrations/flyers-minds/topic-map';
import { createLogger } from '@/lib/logger';

const log = createLogger('FlyersMindsLaunch API');

export const maxDuration = 30;

/**
 * Runs the classroom generation job to completion, then — only on success — records
 * the (course, day) -> classroom mapping so the next launch for the same topic is an
 * instant cache hit instead of a fresh generation.
 */
async function runAndRecordMapping(
  jobId: string,
  input: GenerateClassroomInput,
  baseUrl: string,
  courseSlug: string,
  day: number,
  topic: string,
  contentHash: string,
) {
  await runClassroomGenerationJob(jobId, input, baseUrl);
  const job = await readClassroomGenerationJob(jobId);
  if (job?.status === 'succeeded' && job.result) {
    await writeTopicMapping({
      courseSlug,
      day,
      topic,
      contentHash,
      classroomId: job.result.classroomId,
      classroomUrl: job.result.url,
      generatedAt: new Date().toISOString(),
    });
    log.info(`Recorded topic mapping: ${courseSlug} day ${day} -> ${job.result.classroomId}`);
  } else {
    log.warn(`Job ${jobId} for ${courseSlug} day ${day} did not succeed; mapping not recorded`);
  }
}

export async function POST(req: NextRequest) {
  let day: number | undefined;
  let courseSlug: string | undefined;
  try {
    const body = (await req.json()) as { day?: number; courseSlug?: string };
    day = body.day;
    courseSlug = body.courseSlug || process.env.FLYERSMINDS_DEFAULT_COURSE_SLUG || 'aiml';

    if (typeof day !== 'number' || !Number.isInteger(day) || day <= 0) {
      return apiError('INVALID_REQUEST', 400, 'Missing or invalid required field: day');
    }
    const dayNumber = day;

    // Always call Flyers Minds live — this is the "OpenMAIC calls Flyers Minds
    // whenever it needs course/module data" behavior: we never trust a cached copy
    // of the topic's *content* without re-checking it against the live source.
    const fmDay = await getDay(dayNumber, courseSlug);
    const contentHash = hashDayContent(fmDay);

    const existingMapping = await readTopicMapping(courseSlug, dayNumber);
    if (existingMapping && existingMapping.contentHash === contentHash) {
      // Content unchanged since we last generated — confirm the classroom itself
      // wasn't deleted out from under the mapping before trusting the cache.
      const classroom = await readClassroom(existingMapping.classroomId);
      if (classroom) {
        return apiSuccess({
          status: 'ready',
          url: existingMapping.classroomUrl,
          classroomId: existingMapping.classroomId,
        });
      }
      log.warn(
        `Mapping for ${courseSlug} day ${day} points at a missing classroom (${existingMapping.classroomId}); regenerating`,
      );
    } else if (existingMapping) {
      log.info(`Flyers Minds content changed for ${courseSlug} day ${day}; regenerating`);
    }

    const requirement = buildRequirementFromDay(fmDay, resolveCourseTitle(courseSlug));
    const input: GenerateClassroomInput = { requirement };

    const baseUrl = buildRequestOrigin(req);
    const jobId = nanoid(10);
    const job = await createClassroomGenerationJob(jobId, input);
    const pollUrl = `${baseUrl}/api/generate-classroom/${jobId}`;

    after(() =>
      runAndRecordMapping(jobId, input, baseUrl, courseSlug as string, dayNumber, fmDay.topic, contentHash),
    );

    return apiSuccess(
      {
        status: 'generating',
        jobId,
        jobStatus: job.status,
        message: job.message,
        pollUrl,
        pollIntervalMs: 5000,
      },
      202,
    );
  } catch (error) {
    log.error(`Launch failed [courseSlug=${courseSlug ?? 'unknown'}, day=${day ?? 'unknown'}]:`, error);
    return apiError(
      'UPSTREAM_ERROR',
      502,
      'Failed to reach Flyers Minds or start classroom generation',
      error instanceof Error ? error.message : String(error),
    );
  }
}
