import type { SpeechAction } from '@/lib/types/action';
import type { Scene, Stage } from '@/lib/types/stage';
import type {
  PPTElement,
  PPTTableElement,
  PPTTextElement,
  PPTVideoElement,
} from '@/lib/types/slides';

export type GradeBand = '6-8' | '9-10' | '11-12';

export interface RaiseHandContext {
  stageName?: string;
  stageDescription?: string;
  currentScene?: {
    id: string;
    title: string;
    order: number;
    type: Scene['type'];
  };
  visibleSlideText: string[];
  currentSpeechText?: string;
  nearbySpeechText: string[];
  currentVideo?: {
    elementId: string;
    src?: string;
    poster?: string;
    ext?: string;
    name?: string;
  };
  previousScene?: {
    title: string;
    summary?: string;
  };
}

export interface BuildRaiseHandContextInput {
  stage: Stage | null;
  scenes: Scene[];
  currentSceneId: string | null;
  currentSpeechText?: string | null;
  activeVideoElementId?: string | null;
}

const MAX_TEXT_ITEMS = 10;
const MAX_ITEM_LENGTH = 280;
const MAX_NEARBY_SPEECH = 3;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function stripHtmlToText(html: string): string {
  return normalizeText(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|td|th)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function limitText(text: string, maxLength = MAX_ITEM_LENGTH): string {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function elementText(element: PPTElement): string | null {
  if (element.type === 'text') {
    return stripHtmlToText((element as PPTTextElement).content);
  }

  if (element.type === 'shape' && element.text?.content) {
    return stripHtmlToText(element.text.content);
  }

  if (element.type === 'table') {
    const table = element as PPTTableElement;
    return table.data
      .flat()
      .map((cell) => cell.text)
      .filter(Boolean)
      .join(' | ');
  }

  if (element.type === 'chart') {
    return [element.chartType, ...element.data.labels, ...element.data.legends]
      .filter(Boolean)
      .join(' ');
  }

  if (element.type === 'latex') {
    return element.latex;
  }

  return null;
}

function extractSlideText(scene: Scene | undefined): string[] {
  if (!scene || scene.type !== 'slide' || scene.content.type !== 'slide') return [];

  return scene.content.canvas.elements
    .map(elementText)
    .filter((text): text is string => !!text && normalizeText(text).length > 0)
    .map((text) => limitText(text))
    .slice(0, MAX_TEXT_ITEMS);
}

function findVideo(scene: Scene | undefined, activeVideoElementId?: string | null) {
  if (!scene || scene.type !== 'slide' || scene.content.type !== 'slide') return undefined;
  const videos = scene.content.canvas.elements.filter(
    (element): element is PPTVideoElement => element.type === 'video',
  );
  const video = activeVideoElementId
    ? videos.find((element) => element.id === activeVideoElementId)
    : videos[0];
  if (!video) return undefined;
  return {
    elementId: video.id,
    src: video.src,
    poster: video.poster,
    ext: video.ext,
    name: video.name,
  };
}

function speechActions(scene: Scene | undefined): SpeechAction[] {
  return (scene?.actions || []).filter(
    (action): action is SpeechAction => action.type === 'speech',
  );
}

export function buildRaiseHandContext(input: BuildRaiseHandContextInput): RaiseHandContext {
  const currentScene = input.scenes.find((scene) => scene.id === input.currentSceneId);
  const currentSceneIndex = currentScene
    ? input.scenes.findIndex((scene) => scene.id === currentScene.id)
    : -1;
  const previousScene = currentSceneIndex > 0 ? input.scenes[currentSceneIndex - 1] : undefined;
  const currentSpeechText = input.currentSpeechText
    ? limitText(input.currentSpeechText, 700)
    : undefined;

  const nearbySpeechText = speechActions(currentScene)
    .map((action) => action.text)
    .filter((text) => text !== input.currentSpeechText)
    .map((text) => limitText(text, 260))
    .slice(0, MAX_NEARBY_SPEECH);

  return {
    stageName: input.stage?.name,
    stageDescription: input.stage?.description
      ? limitText(input.stage.description, 320)
      : undefined,
    currentScene: currentScene
      ? {
          id: currentScene.id,
          title: currentScene.title,
          order: currentScene.order,
          type: currentScene.type,
        }
      : undefined,
    visibleSlideText: extractSlideText(currentScene),
    currentSpeechText,
    nearbySpeechText,
    currentVideo: findVideo(currentScene, input.activeVideoElementId),
    previousScene: previousScene
      ? {
          title: previousScene.title,
          summary:
            extractSlideText(previousScene).slice(0, 3).join(' | ') ||
            speechActions(previousScene)
              .slice(0, 1)
              .map((action) => limitText(action.text, 220))
              .join(''),
        }
      : undefined,
  };
}

export function formatRaiseHandContext(context: RaiseHandContext): string {
  const lines: string[] = [];
  if (context.stageName) lines.push(`Course: ${context.stageName}`);
  if (context.stageDescription) lines.push(`Course description: ${context.stageDescription}`);
  if (context.currentScene) {
    lines.push(
      `Current scene: ${context.currentScene.order}. ${context.currentScene.title} (${context.currentScene.type})`,
    );
  }
  if (context.visibleSlideText.length) {
    lines.push(`Visible slide text:\n- ${context.visibleSlideText.join('\n- ')}`);
  }
  if (context.currentSpeechText) {
    lines.push(`Current narration: ${context.currentSpeechText}`);
  }
  if (context.nearbySpeechText.length) {
    lines.push(`Nearby narration:\n- ${context.nearbySpeechText.join('\n- ')}`);
  }
  if (context.currentVideo) {
    lines.push(
      `Visible/active video: ${[
        context.currentVideo.name,
        context.currentVideo.elementId,
        context.currentVideo.ext,
        context.currentVideo.src,
      ]
        .filter(Boolean)
        .join(' | ')}`,
    );
  }
  if (context.previousScene) {
    lines.push(
      `Previous scene: ${context.previousScene.title}${
        context.previousScene.summary ? ` - ${context.previousScene.summary}` : ''
      }`,
    );
  }
  return lines.join('\n\n');
}

export function buildRaiseHandSystemPrompt(gradeBand: GradeBand = '9-10'): string {
  const gradeGuidance: Record<GradeBand, string> = {
    '6-8': 'Use simple words, short sentences, and concrete examples.',
    '9-10': 'Use clear school-level terms and explain them briefly.',
    '11-12': 'Give a deeper explanation while still staying clear and concise.',
  };

  return [
    'You are an AI classroom assistant helping a student during a live lesson.',
    'The class is paused because the student raised their hand.',
    'Use the current slide, narration, video, and lesson context to answer.',
    'Answer only using the given classroom context when possible.',
    'If the question asks beyond the slide, answer carefully and connect back to the current lesson.',
    'Do not hallucinate details that are not in the context.',
    'If the question is unclear, ask one clarifying question.',
    'Keep the answer short first, then offer an example if useful.',
    gradeGuidance[gradeBand],
  ].join(' ');
}

export function buildRaiseHandUserPrompt(params: {
  question: string;
  context: RaiseHandContext;
}): string {
  return `Classroom context:\n${formatRaiseHandContext(params.context) || 'No classroom context provided.'}\n\nStudent question:\n${params.question}`;
}
