import { describe, expect, it } from 'vitest';
import { buildRequirementFromDay } from '@/lib/integrations/flyers-minds/requirement';
import type { FlyersMindsDay } from '@/lib/integrations/flyers-minds/types';

function makeDay(overrides: Partial<FlyersMindsDay> = {}): FlyersMindsDay {
  return {
    day: 7,
    month: 1,
    week: 2,
    monthTitle: 'Python',
    weekTitle: 'Data Structures',
    topic: 'Lists & Tuples',
    overview: 'Learn ordered collections.',
    content: [],
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

describe('buildRequirementFromDay', () => {
  it('preserves the exact order of content sections and their bullet points', () => {
    const day = makeDay({
      content: [
        {
          heading: 'A. Lists',
          points: [{ bold: 'Mutable:', text: 'Lists can be changed after creation.' }],
        },
        {
          heading: 'B. Tuples',
          points: [{ bold: 'Immutable:', text: 'Tuples cannot be changed after creation.' }],
        },
        { heading: 'C. Choosing between them', intro: 'Use lists when data changes.' },
      ],
    });

    const requirement = buildRequirementFromDay(day, 'AI/ML Engineering');

    const indexA = requirement.indexOf('A. Lists');
    const indexB = requirement.indexOf('B. Tuples');
    const indexC = requirement.indexOf('C. Choosing between them');
    expect(indexA).toBeGreaterThan(-1);
    expect(indexB).toBeGreaterThan(indexA);
    expect(indexC).toBeGreaterThan(indexB);
  });

  it('does not silently drop any content section, task, or hands-on item', () => {
    const day = makeDay({
      content: [
        { heading: 'Section One' },
        { heading: 'Section Two' },
        { heading: 'Section Three' },
      ],
      tasks: [
        { id: 't1', label: 'Task one' },
        { id: 't2', label: 'Task two' },
      ],
      handsOn: ['Install the library', 'Run the sample script'],
      evaluationChecklist: ['Can explain lists', 'Can explain tuples'],
    });

    const requirement = buildRequirementFromDay(day, 'AI/ML Engineering');

    for (const section of day.content) {
      expect(requirement).toContain(section.heading);
    }
    for (const task of day.tasks) {
      expect(requirement).toContain(task.label);
    }
    for (const item of day.handsOn) {
      expect(requirement).toContain(item);
    }
    for (const item of day.evaluationChecklist) {
      expect(requirement).toContain(item);
    }
  });

  it('reflects a reordering of content sections in the output order', () => {
    const forward = makeDay({
      content: [{ heading: 'First' }, { heading: 'Second' }],
    });
    const reversed = makeDay({
      content: [{ heading: 'Second' }, { heading: 'First' }],
    });

    const forwardReq = buildRequirementFromDay(forward, 'Course');
    const reversedReq = buildRequirementFromDay(reversed, 'Course');

    expect(forwardReq.indexOf('First')).toBeLessThan(forwardReq.indexOf('Second'));
    expect(reversedReq.indexOf('Second')).toBeLessThan(reversedReq.indexOf('First'));
  });

  it('states the day topic and instructs the generator to stay scoped to it', () => {
    const day = makeDay({ topic: 'Lists & Tuples' });
    const requirement = buildRequirementFromDay(day, 'AI/ML Engineering');

    expect(requirement).toContain('Lists & Tuples');
    expect(requirement.toLowerCase()).toContain('teach only');
  });
});
