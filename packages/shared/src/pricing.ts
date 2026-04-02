export interface ModelPricing {
  /** Cost in USD per 1 million input tokens */
  inputPerMillion: number;
  /** Cost in USD per 1 million output tokens */
  outputPerMillion: number;
  /** Cost in USD per 1 million cache-read tokens */
  cacheReadPerMillion: number;
  /** Cost in USD per 1 million cache-creation tokens */
  cacheCreationPerMillion: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
  "claude-opus-4-6": {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheCreationPerMillion: 18.75,
  },
  "claude-sonnet-4-6": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheCreationPerMillion: 1,
  },
  "claude-sonnet-4-20250514": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-3-5-haiku-20241022": {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheCreationPerMillion: 1,
  },
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheReadPerMillion: 0.3,
  cacheCreationPerMillion: 3.75,
};

/**
 * Returns per-million-token costs for a known model.
 * Falls back to Sonnet pricing for unknown models.
 */
export function getModelPricing(model: string): ModelPricing {
  return PRICING_TABLE[model] ?? DEFAULT_PRICING;
}

/**
 * Computes total USD cost for a model invocation given token counts.
 */
export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number,
): number {
  const pricing = getModelPricing(model);
  return (
    (inputTokens * pricing.inputPerMillion +
      outputTokens * pricing.outputPerMillion +
      cacheReadTokens * pricing.cacheReadPerMillion +
      cacheCreationTokens * pricing.cacheCreationPerMillion) /
    1_000_000
  );
}
