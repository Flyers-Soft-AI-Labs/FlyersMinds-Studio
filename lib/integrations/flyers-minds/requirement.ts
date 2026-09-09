import type { FlyersMindsDay } from './types';

/**
 * OpenMAIC's generation pipeline only reads a single free-text `requirement` string
 * (see lib/types/generation.ts — UserRequirements) — there is no structured
 * subject/chapter/topic field it actually consumes. So topic scoping is entirely a
 * function of how this string is worded.
 *
 * This renders a Flyers Minds `Day` faithfully and in order: the day's single topic,
 * then every teaching section from `content[]` in its original sequence (heading,
 * intro, bullet points), then hands-on items, example/coding task/assignment,
 * evaluation checklist, and tasks — all preserving the exact order Flyers Minds
 * itself serves them in. Nothing is flattened into an unstructured blob and nothing
 * is reordered.
 */
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
    `Teach ONLY this specific day's topic: "${day.topic}". Do not introduce or fully cover ` +
      `topics from other days in this course — those are separate lessons the learner has ` +
      `not necessarily reached yet. Stay tightly scoped to what is described below, and cover ` +
      `it in the exact order given, since that is the pedagogical sequence Flyers Minds itself uses.`,
  );
  lines.push('');

  if (day.overview) {
    lines.push(`Overview: ${day.overview}`);
    lines.push('');
  }

  if (day.content.length > 0) {
    lines.push('Cover the following sections, in this exact order:');
    day.content.forEach((section, index) => {
      lines.push('');
      lines.push(`${index + 1}. ${section.heading}`);
      if (section.intro) {
        lines.push(`   ${section.intro}`);
      }
      for (const point of section.points ?? []) {
        lines.push(`   - ${point.bold} ${point.text}`);
      }
    });
    lines.push('');
  }

  if (day.handsOn.length > 0) {
    lines.push('Hands-on practice to include, in this order:');
    day.handsOn.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    lines.push('');
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
  if (day.explanation) {
    lines.push(`Why this matters: ${day.explanation}`);
  }
  if (day.expectedInputs || day.expectedOutputs) {
    lines.push(
      `Expected inputs/outputs: ${[day.expectedInputs, day.expectedOutputs]
        .filter(Boolean)
        .join(' -> ')}`,
    );
  }

  if (day.evaluationChecklist.length > 0) {
    lines.push('');
    lines.push('By the end, the learner should be able to (in this order):');
    day.evaluationChecklist.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  }

  if (day.tasks.length > 0) {
    lines.push('');
    lines.push("This day's task checklist, in order:");
    day.tasks.forEach((task, index) => lines.push(`${index + 1}. ${task.label}`));
  }

  lines.push('');
  lines.push(
    'Audience: learners in a structured AI/ML engineering internship program. ' +
      'Keep the lesson focused, hands-on, and scoped strictly to the topic and sections above.',
  );

  return lines.join('\n');
}
