// Pricing as of August 2025. Prices are per 1,000,000 tokens.
const MODEL_PRICING = {
  "gpt-4o": {
    input: 5.0, // $ per 1M input tokens
    output: 15.0, // $ per 1M output tokens
  },
  "gpt-4o-mini": {
    input: 0.15, // $ per 1M input tokens
    output: 0.6, // $ per 1M output tokens
  },
};

export type ModelName = keyof typeof MODEL_PRICING;

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

/**
 * Calculates the estimated cost for a given model and token usage.
 * @param model The name of the model used.
 * @param usage An object containing the number of prompt and completion tokens.
 * @returns The calculated cost in USD.
 */
export function calculateCost(model: ModelName, usage: TokenUsage): number {
  if (!MODEL_PRICING[model]) {
    console.warn(`⚠️ Unknown model for cost calculation: ${model}`);
    return 0;
  }

  const priceInfo = MODEL_PRICING[model];
  const inputCost = (usage.prompt_tokens / 1_000_000) * priceInfo.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * priceInfo.output;

  return inputCost + outputCost;
}

/**
 * Logs the cost of a specific analysis step to the console.
 * @param model The model used for the analysis step.
 * @param usage The token usage for the step.
 * @param analysisStep A descriptive name for the analysis step (e.g., "Missing Clauses").
 * @returns The calculated cost for the step.
 */
export function logCost(
  model: ModelName,
  usage: TokenUsage,
  analysisStep: string,
): number {
  const cost = calculateCost(model, usage);
  console.log(
    `💰 Costo [${analysisStep}]: $${cost.toFixed(6)} (Model: ${model}, Input: ${usage.prompt_tokens}, Output: ${usage.completion_tokens})`,
  );
  return cost;
}
