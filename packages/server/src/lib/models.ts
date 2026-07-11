import 'dotenv/config';
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

const anthropic = createAnthropic({
  ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
});

const openai = createOpenAI({
  ...(process.env.OPENAI_BASE_URL
    ? { baseURL: process.env.OPENAI_BASE_URL, compatibility: 'compatible' }
    : {}),
});

const google = createGoogleGenerativeAI({
  ...(process.env.GOOGLE_BASE_URL ? { baseURL: process.env.GOOGLE_BASE_URL } : {}),
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
  'claude-sonet-4-6': {
    anthropic: {
      thinking: {
        type: 'enabled',
        budgetTokens: 1000,
      },
    },
  },
};

const OPENAI_PROVIDER_OPTIONS: Partial<Record<OpenAIModelId, ProviderOptions>> = {};

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
