// Types mirror the real Flyers Minds backend response shapes, confirmed against
// its source (backend/server.py, backend/curriculum_postgres.py, migrations/001_curriculum.sql).

/** Raw DB row shape for `courses` — snake_case, as asyncpg returns it. */
export interface FlyersMindsCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Raw DB row shape for `curriculum_versions` — snake_case, as asyncpg returns it. */
export interface FlyersMindsCurriculumVersion {
  id: string;
  course_id: string;
  version_number: number;
  status: 'draft' | 'published' | 'archived';
  source_proposal_id: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * One `curriculum_days` row, camelCase — as returned by `_row_to_day()` in
 * curriculum_postgres.py. Flyers Minds has ONE topic per day; there is no
 * separate "module" entity. `content`/`resourceLinks`/`tasks` are free-form
 * JSONB arrays with no server-enforced inner schema.
 */
export interface FlyersMindsDay {
  day: number;
  month: number | null;
  week: number | null;
  monthTitle: string | null;
  weekTitle: string | null;
  topic: string;
  overview: string | null;
  content: Array<Record<string, unknown>>;
  handsOn: Array<Record<string, unknown>> | string[];
  example: string | null;
  codingTask: string | null;
  assignment: string | null;
  explanation: string | null;
  expectedInputs: string | null;
  expectedOutputs: string | null;
  evaluationChecklist: Array<Record<string, unknown>> | string[];
  gitTask: string | null;
  resourceLinks: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
}

/** `GET /api/pg-curriculum/published` response body. */
export interface FlyersMindsPublishedCurriculum {
  course: FlyersMindsCourse;
  version: FlyersMindsCurriculumVersion | null;
  days: FlyersMindsDay[];
}
