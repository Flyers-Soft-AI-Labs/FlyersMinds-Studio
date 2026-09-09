import { describe, expect, it } from 'vitest';
import {
  buildRaiseHandContext,
  buildRaiseHandSystemPrompt,
  buildRaiseHandUserPrompt,
  stripHtmlToText,
} from '@/lib/classroom/raise-hand-context';
import type { Scene, Stage } from '@/lib/types/stage';

const stage: Stage = {
  id: 'stage-1',
  name: 'Earth Science',
  description: 'A lesson about weather and climate.',
  createdAt: 1,
  updatedAt: 1,
};

const scenes: Scene[] = [
  {
    id: 'scene-1',
    stageId: 'stage-1',
    type: 'slide',
    title: 'Weather Basics',
    order: 1,
    content: {
      type: 'slide',
      canvas: {
        id: 'slide-1',
        viewportSize: 1000,
        viewportRatio: 0.5625,
        theme: {
          backgroundColor: '#fff',
          themeColors: [],
          fontColor: '#000',
          fontName: 'Inter',
        },
        elements: [
          {
            id: 'text-1',
            type: 'text',
            content: '<h1>Weather changes daily</h1><p>Climate is a long-term pattern.</p>',
            left: 0,
            top: 0,
            width: 400,
            height: 120,
            rotate: 0,
            defaultFontName: 'Inter',
            defaultColor: '#000',
          },
        ],
      },
    },
    actions: [{ id: 'speech-1', type: 'speech', text: 'Weather is what happens today.' }],
  },
  {
    id: 'scene-2',
    stageId: 'stage-1',
    type: 'slide',
    title: 'Climate Patterns',
    order: 2,
    content: {
      type: 'slide',
      canvas: {
        id: 'slide-2',
        viewportSize: 1000,
        viewportRatio: 0.5625,
        theme: {
          backgroundColor: '#fff',
          themeColors: [],
          fontColor: '#000',
          fontName: 'Inter',
        },
        elements: [
          {
            id: 'text-2',
            type: 'text',
            content: '<p>Climate is measured over many years.</p>',
            left: 0,
            top: 0,
            width: 400,
            height: 80,
            rotate: 0,
            defaultFontName: 'Inter',
            defaultColor: '#000',
          },
          {
            id: 'video-1',
            type: 'video',
            src: 'climate.mp4',
            ext: 'mp4',
            autoplay: false,
            left: 0,
            top: 90,
            width: 400,
            height: 220,
            rotate: 0,
          },
        ],
      },
    },
    actions: [
      { id: 'speech-2', type: 'speech', text: 'Climate uses averages over a long time.' },
      { id: 'speech-3', type: 'speech', text: 'A single rainy day does not define climate.' },
    ],
  },
];

describe('raise hand classroom context', () => {
  it('strips slide HTML into readable text', () => {
    expect(stripHtmlToText('<p>Heat&nbsp;&amp;&nbsp;light</p>')).toBe('Heat & light');
  });

  it('extracts current scene text, speech, video, and previous scene context', () => {
    const context = buildRaiseHandContext({
      stage,
      scenes,
      currentSceneId: 'scene-2',
      currentSpeechText: 'Climate uses averages over a long time.',
      activeVideoElementId: 'video-1',
    });

    expect(context.stageName).toBe('Earth Science');
    expect(context.currentScene?.title).toBe('Climate Patterns');
    expect(context.visibleSlideText).toContain('Climate is measured over many years.');
    expect(context.currentSpeechText).toBe('Climate uses averages over a long time.');
    expect(context.nearbySpeechText).toContain('A single rainy day does not define climate.');
    expect(context.currentVideo?.src).toBe('climate.mp4');
    expect(context.previousScene?.title).toBe('Weather Basics');
  });

  it('builds an age-aware prompt with compact classroom context', () => {
    const context = buildRaiseHandContext({
      stage,
      scenes,
      currentSceneId: 'scene-2',
      currentSpeechText: null,
    });

    expect(buildRaiseHandSystemPrompt('6-8')).toContain('simple words');
    expect(
      buildRaiseHandUserPrompt({
        question: 'What is the difference?',
        context,
      }),
    ).toContain('Student question');
  });
});
