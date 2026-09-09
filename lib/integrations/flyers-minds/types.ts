// Types mirror the REAL Flyers Minds curriculum structure — verified against its
// source, not guessed:
//   - backend/migrations/001_curriculum.sql   (Postgres schema for `curriculum_days`)
//   - backend/curriculum_postgres.py          (`_row_to_day()` serializer, ordering)
//   - frontend/src/pages/DayDetailPage.js     (how `content`/`tasks` are actually
//     rendered to real users — the ground truth for each array item's real shape)
//   - frontend/src/data/month1.js             (actually-authored curriculum content,
//     20 real days, used as the Postgres fallback — confirms the shapes above)
//
// The verified real hierarchy is:
//   Course (courses table)
//     -> Day (curriculum_days table, ordered by the explicit `day_number` column)
//          .month / .week / .monthTitle / .weekTitle   (denormalized grouping labels
//            on every day row, used for the sidebar's Month -> Week -> Day navigation
//            grouping — NOT independent ordering keys; day_number alone fully orders
//            the course)
//          .topic (a single string — sometimes a compound phrase, e.g. "Lists &
//            Tuples" or "Data Types & Operators". Confirmed from real authored data:
//            there is no separate per-topic entity below Day.)
//          .content[]  -- ORDERED teaching sections that elaborate the day's one
//            topic (heading + optional intro + ordered bullet points), not
//            independent sibling topics
//          .tasks[]    -- ORDERED checklist items
//          .handsOn[] / .evaluationChecklist[] -- ORDERED plain-string lists
//          .resourceLinks[] -- ORDERED {title, url} list
//
// Ordering: there is no explicit order/position/sequence/index field on any array
// item, at any level, anywhere in the schema (confirmed: `curriculum_days` has no
// such column beyond `day_number` itself; the JSONB array fields carry no per-item
// order field). The array position IS the order — this is also how Flyers Minds'
// own frontend renders everything (DayDetailPage.js maps every one of these arrays
// with `.map((item, i) => ...)`, no `.sort()` call anywhere). Days themselves ARE
// explicitly ordered via `day_number` (`ORDER BY day_number` in the real SQL query
// backing GET /pg-curriculum/published). So the canonical order is: days ascending
// by `day_number`; within a day, every array in its original, server-provided
// sequence. Never re-sort array contents client-side.

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

/** One bullet point within a content section. Verified shape (frontend/src/data/month1.js). */
export interface FlyersMindsContentPoint {
  bold: string;
  text: string;
}

/**
 * One ordered teaching section within a day's `content` array. Rendered in
 * DayDetailPage.js as: heading, optional intro paragraph, then an ordered list of
 * bullet points. Multiple sections together break the day's single `topic` down
 * pedagogically — they are not independent curriculum items of their own.
 */
export interface FlyersMindsContentSection {
  heading: string;
  intro?: string;
  points?: FlyersMindsContentPoint[];
}

/** One checklist item in a day's `tasks` array. Verified shape (month1.js: `{id, label}`). */
export interface FlyersMindsTask {
  id: string;
  label: string;
}

/** One entry in a day's `resourceLinks` array. Verified shape (month1.js: `{title, url}`). */
export interface FlyersMindsResourceLink {
  title: string;
  url: string;
}

/**
 * One `curriculum_days` row, camelCase — as returned by `_row_to_day()` in
 * curriculum_postgres.py, and confirmed field-for-field against real authored
 * content in frontend/src/data/month1.js. Flyers Minds has ONE topic per day —
 * there is no separate "module" or "sub-topic" entity; `content` holds ordered
 * teaching sections *about* that one topic, not sibling topics.
 */
export interface FlyersMindsDay {
  day: number;
  month: number | null;
  week: number | null;
  monthTitle: string | null;
  weekTitle: string | null;
  topic: string;
  overview: string | null;
  content: FlyersMindsContentSection[];
  handsOn: string[];
  example: string | null;
  codingTask: string | null;
  assignment: string | null;
  explanation: string | null;
  expectedInputs: string | null;
  expectedOutputs: string | null;
  evaluationChecklist: string[];
  gitTask: string | null;
  resourceLinks: FlyersMindsResourceLink[];
  tasks: FlyersMindsTask[];
}

/**
 * `GET /api/pg-curriculum/published` response body. `days` is guaranteed ordered
 * ascending by `day.day` — the real query is `ORDER BY day_number`. Never re-sort
 * or reorder this array; pass it through as received.
 */
export interface FlyersMindsPublishedCurriculum {
  course: FlyersMindsCourse;
  version: FlyersMindsCurriculumVersion | null;
  days: FlyersMindsDay[];
}
