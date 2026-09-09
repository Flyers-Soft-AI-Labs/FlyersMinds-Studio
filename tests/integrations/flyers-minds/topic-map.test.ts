import { describe, expect, it } from 'vitest';
import { hashDayContent } from '@/lib/integrations/flyers-minds/topic-map';
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
    content: [
      {
        heading: 'Lists',
        points: [{ bold: 'Mutable:', text: 'Lists can be changed after creation.' }],
      },
      {
        heading: 'Tuples',
        points: [{ bold: 'Immutable:', text: 'Tuples cannot be changed after creation.' }],
      },
    ],
    handsOn: ['Write a list comprehension', 'Convert a list to a tuple'],
    example: 'Shopping cart list',
    codingTask: 'Build a tuple-based coordinate class',
    assignment: null,
    explanation: null,
    expectedInputs: null,
    expectedOutputs: null,
    evaluationChecklist: ['Can index a list', 'Can explain tuple immutability'],
    gitTask: null,
    resourceLinks: [{ title: 'Lists docs', url: 'https://example.com/lists' }],
    tasks: [
      { id: 't1', label: 'Complete list exercises' },
      { id: 't2', label: 'Complete tuple exercises' },
    ],
    ...overrides,
  };
}

describe('hashDayContent', () => {
  it('produces the same hash for the same content regardless of top-level key order', () => {
    const day = makeDay();
    const reordered = Object.fromEntries(
      Object.entries(day).reverse(),
    ) as unknown as FlyersMindsDay;

    expect(hashDayContent(day)).toBe(hashDayContent(reordered));
  });

  it('changes when the order of content sections changes', () => {
    const original = makeDay();
    const reordered = makeDay({ content: [...original.content].reverse() });

    expect(hashDayContent(original)).not.toBe(hashDayContent(reordered));
  });

  it('changes when the order of tasks changes', () => {
    const original = makeDay();
    const reordered = makeDay({ tasks: [...original.tasks].reverse() });

    expect(hashDayContent(original)).not.toBe(hashDayContent(reordered));
  });

  it('changes when nested content (a bullet point deep inside a section) changes', () => {
    const original = makeDay();
    const edited = makeDay({
      content: [
        {
          heading: 'Lists',
          points: [{ bold: 'Mutable:', text: 'This wording has changed.' }],
        },
        original.content[1],
      ],
    });

    expect(hashDayContent(original)).not.toBe(hashDayContent(edited));
  });

  it('changes when a hands-on item, a task label, or the topic itself changes', () => {
    const original = makeDay();

    expect(hashDayContent(original)).not.toBe(
      hashDayContent(makeDay({ handsOn: ['A different hands-on item'] })),
    );
    expect(hashDayContent(original)).not.toBe(
      hashDayContent(makeDay({ tasks: [{ id: 't1', label: 'A different task label' }] })),
    );
    expect(hashDayContent(original)).not.toBe(
      hashDayContent(makeDay({ topic: 'Different topic' })),
    );
  });

  it('is stable (same input -> same hash, deterministic)', () => {
    const day = makeDay();
    expect(hashDayContent(day)).toBe(hashDayContent(makeDay()));
  });

  it('differs between two different days, even with otherwise-similar content', () => {
    const day7 = makeDay({ day: 7 });
    const day8 = makeDay({ day: 8 });
    expect(hashDayContent(day7)).not.toBe(hashDayContent(day8));
  });
});
