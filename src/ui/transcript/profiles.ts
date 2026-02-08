export const PROFILES = [
  {
    id: "quickstart",
    template: "quickstart_independent",
    label: "quickstart",
    description: "single-model baseline with advisor stopping"
  },
  {
    id: "heterogeneity",
    template: "heterogeneity_mix",
    label: "heterogeneity",
    description: "multi-model and multi-persona profile"
  },
  {
    id: "debate",
    template: "debate_v1",
    label: "debate",
    description: "proposer-critic-revision protocol"
  },
  {
    id: "free",
    template: "free_quickstart",
    label: "free",
    description: "free-tier onboarding profile",
    warning:
      "free-tier models are useful for prototyping; use pinned paid models for research-grade studies"
  }
 ] as const;

export type ProfileId = (typeof PROFILES)[number]["id"];
export type ProfileDefinition = {
  id: ProfileId;
  template: string;
  label: string;
  description: string;
  warning?: string;
};

export type ProfileOverlayItem = {
  id: string;
  label: string;
  description?: string;
};

export const listProfiles = (): ProfileDefinition[] =>
  PROFILES.map((profile) => ({ ...profile }));

export const findProfileById = (profileId: ProfileId): ProfileDefinition | undefined =>
  PROFILES.find((entry) => entry.id === profileId);

export const isProfileId = (value: string): value is ProfileId =>
  PROFILES.some((entry) => entry.id === value);

export const createProfileItems = (): ProfileOverlayItem[] =>
  PROFILES.map((profile) => ({
    id: profile.id,
    label: profile.label,
    description: profile.description
  }));
