import dotenv from 'dotenv';
import path from 'path';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  findSupportedChatModel,
  type SupportedChatModel,
  type SupportedChatModelId,
  type SupportedProvider,
} from '@sora/shared';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import type { LanguageModel } from 'ai';

type AnthropicModelId = Extract<SupportedChatModel, { provider: 'anthropic' }>['id'];
type OpenAIModelId = Extract<SupportedChatModel, { provider: 'openai' }>['id'];
type GoogleModelId = Extract<SupportedChatModel, { provider: 'google' }>['id'];

const env =
  dotenv.config({ path: path.resolve(import.meta.dirname, '../../../../.env') }).parsed ?? {};
const getEnv = (key: string) => env[key] ?? process.env[key];

const anthropicBaseURL = getEnv('ANTHROPIC_BASE_URL');
const openaiBaseURL = getEnv('OPENAI_BASE_URL');
const googleBaseURL = getEnv('GOOGLE_BASE_URL');

const anthropic = createAnthropic({
  ...(anthropicBaseURL ? { baseURL: anthropicBaseURL } : {}),
});

const openai = createOpenAI({
  ...(openaiBaseURL ? { baseURL: openaiBaseURL, compatibility: 'compatible' } : {}),
});

const google = createGoogleGenerativeAI({
  ...(googleBaseURL ? { baseURL: googleBaseURL } : {}),
});

export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportedProvider;
  id: SupportedChatModelId;
  providerOptions?: ProviderOptions;
};

const ANTHROPIC_PROVIDER_OPTIONS: Partial<Record<AnthropicModelId, ProviderOptions>> = {
  'claude-opus-4-6': {
    anthropic: {
      thinking: {
        type: 'enabled',
        budgetTokens: 1000,
      },
    },
  },
  'claude-sonnet-4-6': {
    anthropic: {
      thinking: {
        type: 'enabled',
        budgetTokens: 1000,
      },
    },
  },
};

const OPENAI_PROVIDER_OPTIONS: Partial<Record<OpenAIModelId, ProviderOptions>> = {
  'gpt-5.5': {
    openai: {
      store: false,
      include: ['reasoning.encrypted_content'],
      reasoningSummary: 'detailed',
    },
  },
};

function assertUnsupportedModel(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
}

function resolveAnthropicModel(modelId: AnthropicModelId): ResolvedModel {
  return {
    model: anthropic(modelId),
    provider: 'anthropic',
    id: modelId,
    providerOptions: ANTHROPIC_PROVIDER_OPTIONS[modelId],
  };
}

function resolveOpenAIModel(modelId: OpenAIModelId): ResolvedModel {
  return {
    model: openai(modelId),
    provider: 'openai',
    id: modelId,
    providerOptions: OPENAI_PROVIDER_OPTIONS[modelId],
  };
}

function resolveGoogleModel(modelId: GoogleModelId): ResolvedModel {
  return {
    model: google(modelId),
    provider: 'google',
    id: modelId,
  };
}

function resolveSupportedModel(model: SupportedChatModel): ResolvedModel {
  const provider = model.provider;
  switch (provider) {
    case 'anthropic':
      return resolveAnthropicModel(model.id);
    case 'openai':
      return resolveOpenAIModel(model.id);
    case 'google':
      return resolveGoogleModel(model.id);
    default:
      return assertUnsupportedModel(provider);
  }
}

export function isSupportedChatModel(modelId: string): ResolvedModel {
  const model = findSupportedChatModel(modelId as SupportedChatModelId);
  if (!model) {
    throw new Error(`Unsupported chat model: ${modelId}`);
  }
  return resolveSupportedModel(model);
}

export function resolveChatModel(modelId: string): ResolvedModel {
  const model = findSupportedChatModel(modelId as SupportedChatModelId);
  if (!model) {
    throw new Error(`Unsupported chat model: ${modelId}`);
  }
  return resolveSupportedModel(model);
}
