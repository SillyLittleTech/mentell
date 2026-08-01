import { z } from "zod";
import { notifyLocalDataChanged } from "../../shared/sync/localDataEvents";
import { scopedStorageKey } from "../../shared/storage/storageScope";

const PROFILE_KEY = scopedStorageKey("mentell.ai.profile");

export const AiAgeRangeSchema = z.enum([
  "",
  "under18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55+",
  "prefer-not",
]);

export type AiAgeRange = z.infer<typeof AiAgeRangeSchema>;

export type AiProfile = {
  displayName: string;
  ageRange: AiAgeRange;
  about: string;
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /ignore\s+instructions/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /you\s+are\s+now/i,
  /disregard\s+(the\s+)?(above|prior)\s+instructions/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
];

const DEFAULT_PROFILE: AiProfile = {
  displayName: "",
  ageRange: "prefer-not",
  about: "",
};

function stripControlChars(s: string) {
  return s // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, "");
}

function sanitizeDisplayName(raw: string) {
  const trimmed = stripControlChars(raw).trim().slice(0, 40);
  return trimmed.replace(/[^a-zA-Z\u00C0-\u024F\s'-]/g, "").trim();
}

function sanitizeAbout(raw: string) {
  let s = stripControlChars(raw).trim().slice(0, 500);
  s = s.replace(/[<>]/g, "");
  s = s.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n");
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, "");
  }
  return s.trim();
}

function sanitizeAgeRange(raw: unknown): AiAgeRange {
  const parsed = AiAgeRangeSchema.safeParse(raw);
  if (parsed.success && parsed.data) return parsed.data;
  return "prefer-not";
}

export function sanitizeAiProfile(input: Partial<AiProfile>): AiProfile {
  return {
    displayName: sanitizeDisplayName(input.displayName ?? ""),
    ageRange: sanitizeAgeRange(input.ageRange),
    about: sanitizeAbout(input.about ?? ""),
  };
}

export function loadAiProfile(): AiProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<AiProfile>;
    return sanitizeAiProfile(parsed);
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveAiProfile(input: Partial<AiProfile>): AiProfile {
  const profile = sanitizeAiProfile(input);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  notifyLocalDataChanged();
  return profile;
}

export function profileFingerprint(profile: AiProfile) {
  return JSON.stringify(profile);
}

export function ageRangeLabel(range: AiAgeRange) {
  if (range === "under18") return "Under 18";
  if (range === "18-24") return "18–24";
  if (range === "25-34") return "25–34";
  if (range === "35-44") return "35–44";
  if (range === "45-54") return "45–54";
  if (range === "55+") return "55+";
  if (range === "prefer-not") return "Prefer not to say";
  return "";
}
