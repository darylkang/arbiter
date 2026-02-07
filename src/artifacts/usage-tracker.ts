import type { TrialCompletedPayload } from "../events/types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";

type UsageTotals = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
};

export class UsageTracker {
  private readonly usageTotals: UsageTotals = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  };

  private readonly usageByModel = new Map<string, UsageTotals>();

  ingestTrial(trialRecord: TrialCompletedPayload["trial_record"]): void {
    const useUsage = (usage: UsageTotals, modelKey: string): void => {
      this.addUsage(this.usageTotals, usage);
      const existing = this.usageByModel.get(modelKey) ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
      this.addUsage(existing, usage);
      this.usageByModel.set(modelKey, existing);
    };

    if (trialRecord.usage) {
      const normalized = this.normalizeUsage(trialRecord.usage);
      if (normalized) {
        const modelKey = trialRecord.actual_model ?? trialRecord.requested_model_slug;
        useUsage(normalized, modelKey);
      }
    }

    if (trialRecord.calls) {
      for (const call of trialRecord.calls) {
        if (!call.usage) {
          continue;
        }
        const normalized = this.normalizeUsage(call.usage);
        if (!normalized) {
          continue;
        }
        const modelKey = call.model_actual ?? call.model_requested;
        useUsage(normalized, modelKey);
      }
    }
  }

  buildSummary(): ArbiterRunManifest["usage"] | undefined {
    if (
      this.usageTotals.prompt_tokens === 0 &&
      this.usageTotals.completion_tokens === 0 &&
      this.usageTotals.total_tokens === 0 &&
      this.usageTotals.cost === undefined
    ) {
      return undefined;
    }

    const byModel: Record<string, UsageTotals> = {};
    for (const [model, usage] of this.usageByModel.entries()) {
      byModel[model] = usage;
    }

    return {
      totals: this.usageTotals,
      ...(Object.keys(byModel).length > 0 ? { by_model: byModel } : {})
    };
  }

  private normalizeUsage(input: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  }): UsageTotals | null {
    const prompt = Number.isFinite(input.prompt_tokens) ? (input.prompt_tokens as number) : 0;
    const completion = Number.isFinite(input.completion_tokens) ? (input.completion_tokens as number) : 0;
    const total =
      Number.isFinite(input.total_tokens) ? (input.total_tokens as number) : prompt + completion;
    if (prompt === 0 && completion === 0 && total === 0 && !Number.isFinite(input.cost)) {
      return null;
    }
    const usage: UsageTotals = {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total
    };
    if (Number.isFinite(input.cost)) {
      usage.cost = input.cost as number;
    }
    return usage;
  }

  private addUsage(target: UsageTotals, addition: UsageTotals): void {
    target.prompt_tokens += addition.prompt_tokens;
    target.completion_tokens += addition.completion_tokens;
    target.total_tokens += addition.total_tokens;
    if (addition.cost !== undefined) {
      target.cost = (target.cost ?? 0) + addition.cost;
    }
  }
}
