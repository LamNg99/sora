import {
  SUPPORTED_CHAT_MODELS,
  findSupportedChatModel,
  type ModelPricing,
  type SupportedChatModelId,
} from '@sora/shared';
import type { LanguageModelUsage } from 'ai';

type CalculateCreditsForUsageParams = {
  provider: string;
  model: SupportedChatModelId;
  usage: LanguageModelUsage;
};

type BillableUsage = {
  credits: number;
};

type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
};

const TOKEN_PER_MILLION = 1_000_000;
// Sora charges in internal credit instead od exposing provider's pricing directly.
// We currently peg 1 credit to $0.01 USD, so credits stay easy to reason about
// like cents, while still being granular enough to handle small AI usage amounts.
// Change this constant if product want a finer unit like 0.001 USD or coaser one.
const USD_PER_CREDIT = 0.01;

function getTokenCounts(usage: LanguageModelUsage): TokenCounts {
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;

  if (inputTokens == null || outputTokens == null) {
    throw new Error('Credit conversation requires both input and output token counts');
  }
  return { inputTokens, outputTokens };
}

function getModelPricing(provider: string, model: SupportedChatModelId): ModelPricing {
  const supportedModel = findSupportedChatModel(model);

  if (!supportedModel || supportedModel.provider !== provider) {
    if (!SUPPORTED_CHAT_MODELS.some((m) => m.provider === provider)) {
      throw new Error(`Unsupported billing provider: ${provider}`);
    }
    throw new Error(`Unsupported billing model: ${model}`);
  }

  return supportedModel.pricing;
}

function estimateCostUsd({ inputTokens, outputTokens }: TokenCounts, pricing: ModelPricing) {
  return (
    (inputTokens * pricing.inputUsdPerMillionTokens +
      outputTokens * pricing.outputUsdPerMillionTokens) /
    TOKEN_PER_MILLION
  );
}

function convertUsdToCredits(estimatedCostUsd: number) {
  if (estimatedCostUsd <= 0) {
    return 0;
  }

  // If a request costs any nonamount, charge at leasts 1 credit,
  // then round up so partial credits always become  whole credits.
  return Math.max(1, Math.ceil(estimatedCostUsd / USD_PER_CREDIT));
}

export function calculateCreditsForUsage({
  provider,
  model,
  usage,
}: CalculateCreditsForUsageParams): BillableUsage {
  const tokenCounts = getTokenCounts(usage);
  const modelPricing = getModelPricing(provider, model);
  const estimatedCostUsd = estimateCostUsd(tokenCounts, modelPricing);
  const credits = convertUsdToCredits(estimatedCostUsd);

  return { credits };
}
