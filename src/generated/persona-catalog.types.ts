/* This file is generated. Do not edit. */

export interface ArbiterPersonaCatalog {
  schema_version: "1.0.0";
  /**
   * @minItems 1
   */
  personas: [
    {
      id: string;
      display_name: string;
      subtitle: string;
      category: "baseline" | "adversarial" | "analytical" | "divergent" | "decisive";
      when_to_use: string;
      expected_effect: string;
      risk_note: string;
      default: boolean;
      sort_order: number;
    },
    ...{
      id: string;
      display_name: string;
      subtitle: string;
      category: "baseline" | "adversarial" | "analytical" | "divergent" | "decisive";
      when_to_use: string;
      expected_effect: string;
      risk_note: string;
      default: boolean;
      sort_order: number;
    }[]
  ];
}
