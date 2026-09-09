import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlyersMindsDay } from '@/lib/integrations/flyers-minds/types';

const afterCallbacks: Array<() => Promise<void> | void> = [];

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((cb: () => Promise<void> | void) => {
      afterCallbacks.push(cb);
    }),
  };
});

vi.mock('@/lib/integrations/flyers-minds/client', () => ({
  getDay: vi.fn(),
  resolveCourseTitle: vi.fn((slug: string) => slug.toUpperCase()),
}));

vi.mock('@/lib/integrations/flyers-minds/topic-map', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/integrations/flyers-minds/topic-map')>();
  return {
    ...actual, // keep the real hashDayContent — it's covered by its own unit tests
    readTopicMapping: vi.fn(),
    writeTopicMapping: vi.fn(),
  };
});

vi.mock('@/lib/server/classroom-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/classroom-storage')>();
  return {
    ...actual, // keep the real buildRequestOrigin — pure header logic
    readClassroom: vi.fn(),
  };
});

vi.mock('@/lib/server/classroom-job-store', () => ({
  createClassroomGenerationJob: vi.fn(async (jobId: string) => ({
    id: jobId,
    status: 'queued',
    message: 'Classroom generation job queued',
  })),
  readClassroomGenerationJob: vi.fn(),
}));

vi.mock('@/lib/server/classroom-job-runner', () => ({
  runClassroomGenerationJob: vi.fn(async () => {}),
}));

function makeDay(overrides: Partial<FlyersMindsDay> = {}): FlyersMindsDay {
  return {
    day: 7,
    month: 1,
    week: 2,
    monthTitle: 'Python',
    weekTitle: 'Data Structures',
    topic: 'Lists & Tuples',
    overview: null,
    content: [{ heading: 'Lists' }, { heading: 'Tuples' }],
    handsOn: [],
    example: null,
    codingTask: null,
    assignment: null,
    explanation: null,
    expectedInputs: null,
    expectedOutputs: null,
    evaluationChecklist: [],
    gitTask: null,
    resourceLinks: [],
    tasks: [],
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => null },
    nextUrl: { origin: 'http://localhost:3000' },
  } as unknown as import('next/server').NextRequest;
}

async function flushAfterCallbacks() {
  const pending = afterCallbacks.splice(0);
  await Promise.all(pending.map((cb) => cb()));
}

describe('POST /api/integrations/flyers-minds/launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
  });

  it('reuses the cached classroom when Flyers Minds content is unchanged (no new job)', async () => {
    const { getDay } = await import('@/lib/integrations/flyers-minds/client');
    const { readTopicMapping } = await import('@/lib/integrations/flyers-minds/topic-map');
    const { hashDayContent } = await import('@/lib/integrations/flyers-minds/topic-map');
    const { readClassroom } = await import('@/lib/server/classroom-storage');
    const { createClassroomGenerationJob } = await import('@/lib/server/classroom-job-store');

    const day = makeDay();
    vi.mocked(getDay).mockResolvedValue(day);
    vi.mocked(readTopicMapping).mockResolvedValue({
      courseSlug: 'aiml',
      day: 7,
      topic: day.topic,
      contentHash: hashDayContent(day),
      classroomId: 'classroom-abc',
      classroomUrl: 'http://localhost:3000/classroom/classroom-abc',
      generatedAt: new Date().toISOString(),
    });
    vi.mocked(readClassroom).mockResolvedValue({
      id: 'classroom-abc',
      stage: {} as never,
      scenes: [],
      createdAt: new Date().toISOString(),
    });

    const { POST } = await import('@/app/api/integrations/flyers-minds/launch/route');
    const res = await POST(makeRequest({ day: 7, courseSlug: 'aiml' }));
    const json = (await res.json()) as { status: string; url: string };

    expect(json.status).toBe('ready');
    expect(json.url).toBe('http://localhost:3000/classroom/classroom-abc');
    expect(createClassroomGenerationJob).not.toHaveBeenCalled();
  });

  it('starts exactly one generation job when there is no cached mapping yet', async () => {
    const { getDay } = await import('@/lib/integrations/flyers-minds/client');
    const { readTopicMapping } = await import('@/lib/integrations/flyers-minds/topic-map');
    const { createClassroomGenerationJob } = await import('@/lib/server/classroom-job-store');

    vi.mocked(getDay).mockResolvedValue(makeDay());
    vi.mocked(readTopicMapping).mockResolvedValue(null);

    const { POST } = await import('@/app/api/integrations/flyers-minds/launch/route');
    const res = await POST(makeRequest({ day: 7, courseSlug: 'aiml' }));
    const json = (await res.json()) as { status: string; jobId: string };

    expect(res.status).toBe(202);
    expect(json.status).toBe('generating');
    expect(createClassroomGenerationJob).toHaveBeenCalledTimes(1);
  });

  it('starts a new generation job when the cached content hash no longer matches (content changed)', async () => {
    const { getDay } = await import('@/lib/integrations/flyers-minds/client');
    const { readTopicMapping } = await import('@/lib/integrations/flyers-minds/topic-map');
    const { readClassroom } = await import('@/lib/server/classroom-storage');
    const { createClassroomGenerationJob } = await import('@/lib/server/classroom-job-store');

    vi.mocked(getDay).mockResolvedValue(makeDay());
    vi.mocked(readTopicMapping).mockResolvedValue({
      courseSlug: 'aiml',
      day: 7,
      topic: 'Lists & Tuples',
      contentHash: 'a-stale-hash-that-will-not-match',
      classroomId: 'classroom-old',
      classroomUrl: 'http://localhost:3000/classroom/classroom-old',
      generatedAt: new Date().toISOString(),
    });

    const { POST } = await import('@/app/api/integrations/flyers-minds/launch/route');
    const res = await POST(makeRequest({ day: 7, courseSlug: 'aiml' }));
    const json = (await res.json()) as { status: string };

    expect(json.status).toBe('generating');
    expect(createClassroomGenerationJob).toHaveBeenCalledTimes(1);
    // A stale hash means the cached classroom must not be trusted without re-checking —
    // readClassroom should never even be consulted once the hash mismatch is known.
    expect(readClassroom).not.toHaveBeenCalled();
  });

  it('regenerates when the mapped classroom itself is missing, even if the hash still matches', async () => {
    const { getDay } = await import('@/lib/integrations/flyers-minds/client');
    const { readTopicMapping, hashDayContent } =
      await import('@/lib/integrations/flyers-minds/topic-map');
    const { readClassroom } = await import('@/lib/server/classroom-storage');
    const { createClassroomGenerationJob } = await import('@/lib/server/classroom-job-store');

    const day = makeDay();
    vi.mocked(getDay).mockResolvedValue(day);
    vi.mocked(readTopicMapping).mockResolvedValue({
      courseSlug: 'aiml',
      day: 7,
      topic: day.topic,
      contentHash: hashDayContent(day),
      classroomId: 'classroom-deleted',
      classroomUrl: 'http://localhost:3000/classroom/classroom-deleted',
      generatedAt: new Date().toISOString(),
    });
    vi.mocked(readClassroom).mockResolvedValue(null); // classroom file no longer exists

    const { POST } = await import('@/app/api/integrations/flyers-minds/launch/route');
    const res = await POST(makeRequest({ day: 7, courseSlug: 'aiml' }));
    const json = (await res.json()) as { status: string };

    expect(json.status).toBe('generating');
    expect(createClassroomGenerationJob).toHaveBeenCalledTimes(1);
  });

  it('saves the classroom mapping keyed to the requested day once generation succeeds', async () => {
    const { getDay } = await import('@/lib/integrations/flyers-minds/client');
    const { readTopicMapping, writeTopicMapping } =
      await import('@/lib/integrations/flyers-minds/topic-map');
    const { readClassroomGenerationJob } = await import('@/lib/server/classroom-job-store');

    vi.mocked(getDay).mockResolvedValue(makeDay({ day: 9, topic: 'Sets & Dictionaries' }));
    vi.mocked(readTopicMapping).mockResolvedValue(null);
    vi.mocked(readClassroomGenerationJob).mockResolvedValue({
      id: 'job-1',
      status: 'succeeded',
      result: {
        classroomId: 'classroom-new',
        url: 'http://localhost:3000/classroom/classroom-new',
      },
    } as never);

    const { POST } = await import('@/app/api/integrations/flyers-minds/launch/route');
    await POST(makeRequest({ day: 9, courseSlug: 'aiml' }));
    await flushAfterCallbacks();

    expect(writeTopicMapping).toHaveBeenCalledTimes(1);
    const savedMapping = vi.mocked(writeTopicMapping).mock.calls[0][0];
    expect(savedMapping.day).toBe(9);
    expect(savedMapping.courseSlug).toBe('aiml');
    expect(savedMapping.classroomId).toBe('classroom-new');
  });

  it('looks up different days under distinct mapping keys, so they cannot collide', async () => {
    const { getDay } = await import('@/lib/integrations/flyers-minds/client');
    const { readTopicMapping } = await import('@/lib/integrations/flyers-minds/topic-map');

    vi.mocked(getDay).mockImplementation(async (dayNumber: number) =>
      makeDay({ day: dayNumber, topic: `Topic for day ${dayNumber}` }),
    );
    vi.mocked(readTopicMapping).mockResolvedValue(null);

    const { POST } = await import('@/app/api/integrations/flyers-minds/launch/route');
    await POST(makeRequest({ day: 7, courseSlug: 'aiml' }));
    await POST(makeRequest({ day: 8, courseSlug: 'aiml' }));

    const calledKeys = vi
      .mocked(readTopicMapping)
      .mock.calls.map(([slug, day]) => `${slug}:${day}`);
    expect(new Set(calledKeys).size).toBe(calledKeys.length);
    expect(calledKeys).toContain('aiml:7');
    expect(calledKeys).toContain('aiml:8');
  });

  it('rejects a missing or invalid day without calling Flyers Minds at all', async () => {
    const { getDay } = await import('@/lib/integrations/flyers-minds/client');

    const { POST } = await import('@/app/api/integrations/flyers-minds/launch/route');
    const res = await POST(makeRequest({ courseSlug: 'aiml' }));

    expect(res.status).toBe(400);
    expect(getDay).not.toHaveBeenCalled();
  });
});
