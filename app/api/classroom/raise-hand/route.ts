import { NextRequest, NextResponse } from 'next/server';
import { isProviderKeyRequired } from '@/lib/ai/providers';
import { callLLM } from '@/lib/ai/llm';
import { apiError } from '@/lib/server/api-response';
import { resolveModel } from '@/lib/server/resolve-model';
import {
  buildRaiseHandSystemPrompt,
  buildRaiseHandUserPrompt,
  type GradeBand,
  type RaiseHandContext,
} from '@/lib/classroom/raise-hand-context';
import { createLogger } from '@/lib/logger';

const log = createLogger('RaiseHand API');

export const maxDuration = 60;

interface RaiseHandRequest {
  stageId?: string;
  sceneId?: string;
  question?: string;
  context?: RaiseHandContext;
  gradeBand?: GradeBand;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  providerType?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RaiseHandRequest;
    const question = body.question?.trim();

    if (!question) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: question');
    }
    if (!body.context) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: context');
    }

    const {
      model: languageModel,
      apiKey: resolvedApiKey,
      providerId,
    } = await resolveModel({
      modelString: body.model,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      providerType: body.providerType,
    });

    if (isProviderKeyRequired(providerId) && !resolvedApiKey) {
      return apiError('MISSING_API_KEY', 401, 'API Key is required');
    }

    const result = await callLLM(
      {
        model: languageModel,
        system: buildRaiseHandSystemPrompt(body.gradeBand),
        prompt: buildRaiseHandUserPrompt({
          question,
          context: body.context,
        }),
        maxOutputTokens: 450,
      },
      'classroom-raise-hand',
      { retries: 1 },
      { enabled: false },
    );

    return NextResponse.json({
      answer: result.text.trim(),
      stageId: body.stageId,
      sceneId: body.sceneId,
    });
  } catch (error) {
    log.error('Raise hand request failed:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to answer raise hand question',
    );
  }
}
