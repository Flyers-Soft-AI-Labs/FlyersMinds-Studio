import type { FlyersMindsDay } from './types';

/**
 * OpenMAIC's generation pipeline only reads a single free-text `requirement` string
 * (see lib/types/generation.ts — UserRequirements) — there is no structured
 * subject/chapter/topic field it actually consumes. So topic scoping is entirely a
 * function of how this string is worded. This composes a Flyers Minds `Day` (Flyers
 * Minds has one topic per day — there is no separate sub-module entity) into a
 * requirement that states the course/week/day context and explicitly asks the model
 * to stay within that single topic.
 */

/** Renders a free-form content/task array (no enforced inner schema on the Flyers
 *  Minds side) into short bullet lines, using whatever text-like fields it finds. */
function summarizeItems(items: Array<Record<string, unknown>> | string[] | undefined): string[] {
  if (!items || items.length === 0) return [];
  return items.map((item) => {
    if (typeof item === 'string') return item;
    const candidateKeys = ['title', 'name', 'label', 'text', 'description', 'summary'];
    for (const key of candidateKeys) {
      const value = item[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    // Fall back to a compact JSON snippet rather than dropping the item silently.
    return JSON.stringify(item);
  });
}

export function buildRequirementFromDay(day: FlyersMindsDay, courseTitle: string): string {
  const lines: string[] = [];

  lines.push(`Course: ${courseTitle}`);
  if (day.month != null || day.monthTitle) {
    lines.push(`Month ${day.month ?? '?'}${day.monthTitle ? `: ${day.monthTitle}` : ''}`);
  }
  if (day.week != null || day.weekTitle) {
    lines.push(`Week ${day.week ?? '?'}${day.weekTitle ? `: ${day.weekTitle}` : ''}`);
  }
  lines.push(`Day ${day.day} — Topic: ${day.topic}`);
  lines.push('');
  lines.push(
    `Teach ONLY this specific topic: "${day.topic}". Do not introduce or fully cover ` +
      `unrelated topics from other days in this course — those are separate lessons the ` +
      `learner has not necessarily reached yet. Stay tightly scoped to what is described below.`,
  );
  lines.push('');

  if (day.overview) {
    lines.push(`Overview: ${day.overview}`);
  }
  if (day.explanation) {
    lines.push(`Explanation / learning objective: ${day.explanation}`);
  }

  const contentPoints = summarizeItems(day.content);
  if (contentPoints.length > 0) {
    lines.push('Key points to cover:');
    for (const point of contentPoints) lines.push(`- ${point}`);
  }

  const handsOnPoints = summarizeItems(day.handsOn);
  if (handsOnPoints.length > 0) {
    lines.push('Hands-on practice to include:');
    for (const point of handsOnPoints) lines.push(`- ${point}`);
  }

  if (day.example) {
    lines.push(`Example to use: ${day.example}`);
  }
  if (day.codingTask) {
    lines.push(`Coding task for the learner to practice: ${day.codingTask}`);
  }
  if (day.assignment) {
    lines.push(`Assignment context: ${day.assignment}`);
  }
  if (day.expectedInputs || day.expectedOutputs) {
    lines.push(
      `Expected inputs/outputs: ${[day.expectedInputs, day.expectedOutputs]
        .filter(Boolean)
        .join(' -> ')}`,
    );
  }

  const evaluationPoints = summarizeItems(day.evaluationChecklist);
  if (evaluationPoints.length > 0) {
    lines.push('The lesson should let the learner check they can:');
    for (const point of evaluationPoints) lines.push(`- ${point}`);
  }

  lines.push('');
  lines.push(
    'Audience: learners in a structured AI/ML engineering internship program. ' +
      'Keep the lesson focused, hands-on, and scoped strictly to the topic above.',
  );

  return lines.join('\n');
}
