import Dexie, { type Table } from "dexie";
import { dexieDatabaseName } from "../shared/storage/storageScope";

/** IndexedDB / validation export `EntrySentiment`. */
export type EntrySentiment = "+" | "-" | "=";
/** IndexedDB / validation export `WarningLevel`. */
export type WarningLevel = "none" | "warn";
/** IndexedDB / validation export `RiskLevel`. */
export type RiskLevel = "none" | "low" | "elevated" | "crisis";
/** IndexedDB / validation export `EntryEmotion`. */
export type EntryEmotion =
  "happy" | "calm" | "anxious" | "sad" | "angry" | "other";

/** Full journal flow (AI-searchable). */
export type EntryKindJournal = "entry";
/** Sentiment-only quick log (excluded from projector AI search index). */
export type EntryKindQuickLog = "quick_log";

/** IndexedDB / validation export `EntryRow`. */
export type EntryRow = {
  id: string;
  createdAt: number;
  updatedAt: number;
  dateKey: string; // YYYY-MM-DD in local time
  /** Discriminator: full entry vs quick_log (defaults to entry for legacy rows). */
  entryType?: EntryKindJournal | EntryKindQuickLog;
  sentiment: EntrySentiment;
  emotion: EntryEmotion;
  emotionNote: string;
  situation: string;
  details: string;
  /** Free-text notes on behaviours observed in the interaction. */
  behavioursNoted: string;
  /** Free-text label for a reoccurring interaction theme/type. */
  reoccurringTheme: string;
  /** Optional short note for quick_log only. */
  quickLogNote?: string;
  flaggedTerms: string[];
  warningLevel: WarningLevel;
  riskScore: number;
  interventionScore: number;
  riskLevel: RiskLevel;
  scoreDelta: number;
  /** @deprecated 1.x streak; retained for migration / export. */
  streakAtSubmit: number;
  /** HBCM display value (0–5) at submit time. */
  hbcmAtSubmit?: number;
};

/** IndexedDB / validation export `NoteTag`. */
export type NoteTag = "self" | "therapist" | "other";
/** IndexedDB / validation export `NoteRow`. */
export type NoteRow = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  body: string;
  tag: NoteTag;
};

/** IndexedDB / validation export `StickyCoordSpace`. */
export type StickyCoordSpace = "viewport" | "board";

/** IndexedDB / validation export `StickyRow`. */
export type StickyRow = {
  id: string;
  createdAt: number;
  updatedAt: number;
  text: string;
  x: number;
  y: number;
  color: string;
  zIndex: number;
  coordSpace?: StickyCoordSpace;
};

/** IndexedDB / validation export `PackageKind`. */
export type PackageKind = "weekly" | "monthly" | "yearly";
/** IndexedDB / validation export `PackageRow`. */
export type PackageRow = {
  id: string;
  kind: PackageKind;
  periodKey: string; // e.g. 2026-W21, 2026-05, 2026
  createdAt: number;
  updatedAt: number;
  openedAt?: number;
  openedScoreDelta?: number;
};

/** Singleton row (`id` is always `default`) for desk character customization. */
export type CharacterAppearanceRow = {
  id: "default";
  updatedAt: number;
  fills: Record<string, string>;
  toggles: Record<string, string>;
};

/** IndexedDB / validation export `MentellDB`. */
export class MentellDB extends Dexie {
  entries!: Table<EntryRow, string>;
  notes!: Table<NoteRow, string>;
  stickies!: Table<StickyRow, string>;
  packages!: Table<PackageRow, string>;
  characterAppearance!: Table<CharacterAppearanceRow, string>;

  constructor(name: string) {
    super(name);

    // v1: initial local-first tables
    this.version(1).stores({
      entries: "&id, dateKey, createdAt, sentiment, warningLevel",
      notes: "&id, createdAt, tag",
      stickies: "&id, createdAt, zIndex",
      packages: "&id, kind, periodKey, createdAt, openedAt",
    });

    // v2: add emotion fields on entries
    this.version(2)
      .stores({
        entries: "&id, dateKey, createdAt, sentiment, warningLevel",
        notes: "&id, createdAt, tag",
        stickies: "&id, createdAt, zIndex",
        packages: "&id, kind, periodKey, createdAt, openedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("entries")
          .toCollection()
          .modify((row: Partial<EntryRow>) => {
            if (!row.emotion) row.emotion = "other";
            if (typeof row.emotionNote !== "string") row.emotionNote = "";
          });
      });

    this.version(3)
      .stores({
        entries: "&id, dateKey, createdAt, updatedAt, sentiment, warningLevel",
        notes: "&id, createdAt, updatedAt, tag",
        stickies: "&id, createdAt, updatedAt, zIndex",
        packages: "&id, kind, periodKey, createdAt, updatedAt, openedAt",
      })
      .upgrade(async (tx) => {
        const backfill = <T extends { createdAt: number; updatedAt?: number }>(
          table: string,
        ) =>
          tx
            .table(table)
            .toCollection()
            .modify((row: T) => {
              if (typeof row.updatedAt !== "number")
                row.updatedAt = row.createdAt;
            });
        await backfill<EntryRow>("entries");
        await backfill<NoteRow>("notes");
        await backfill<StickyRow>("stickies");
        await backfill<PackageRow>("packages");
      });

    this.version(4)
      .stores({
        entries: "&id, dateKey, createdAt, updatedAt, sentiment, warningLevel",
        notes: "&id, createdAt, updatedAt, tag",
        stickies: "&id, createdAt, updatedAt, zIndex",
        packages: "&id, kind, periodKey, createdAt, updatedAt, openedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("stickies")
          .toCollection()
          .modify((row: Partial<StickyRow>) => {
            if (!row.coordSpace) row.coordSpace = "board";
          });
      });

    this.version(5).stores({
      entries: "&id, dateKey, createdAt, updatedAt, sentiment, warningLevel",
      notes: "&id, createdAt, updatedAt, tag",
      stickies: "&id, createdAt, updatedAt, zIndex",
      packages: "&id, kind, periodKey, createdAt, updatedAt, openedAt",
      characterAppearance: "&id, updatedAt",
    });

    this.version(6)
      .stores({
        entries:
          "&id, dateKey, createdAt, updatedAt, sentiment, warningLevel, riskLevel",
        notes: "&id, createdAt, updatedAt, tag",
        stickies: "&id, createdAt, updatedAt, zIndex",
        packages: "&id, kind, periodKey, createdAt, updatedAt, openedAt",
        characterAppearance: "&id, updatedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("entries")
          .toCollection()
          .modify((row: Partial<EntryRow>) => {
            if (typeof row.riskScore !== "number")
              row.riskScore = row.warningLevel === "warn" ? 0.5 : 0;
            if (!row.riskLevel)
              row.riskLevel = row.warningLevel === "warn" ? "elevated" : "none";
          });
      });

    this.version(7)
      .stores({
        entries:
          "&id, dateKey, createdAt, updatedAt, sentiment, warningLevel, riskLevel",
        notes: "&id, createdAt, updatedAt, tag",
        stickies: "&id, createdAt, updatedAt, zIndex",
        packages: "&id, kind, periodKey, createdAt, updatedAt, openedAt",
        characterAppearance: "&id, updatedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("entries")
          .toCollection()
          .modify((row: Partial<EntryRow>) => {
            if (typeof row.interventionScore !== "number")
              row.interventionScore = 0;
          });
      });

    this.version(8)
      .stores({
        entries:
          "&id, dateKey, createdAt, updatedAt, sentiment, warningLevel, riskLevel",
        notes: "&id, createdAt, updatedAt, tag",
        stickies: "&id, createdAt, updatedAt, zIndex",
        packages: "&id, kind, periodKey, createdAt, updatedAt, openedAt",
        characterAppearance: "&id, updatedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("entries")
          .toCollection()
          .modify((row: Partial<EntryRow>) => {
            if (typeof row.behavioursNoted !== "string")
              row.behavioursNoted = "";
            if (typeof row.reoccurringTheme !== "string")
              row.reoccurringTheme = "";
          });
      });

    // v9: 2.x entry kinds (quick_log) + HBCM at submit
    this.version(9)
      .stores({
        entries:
          "&id, dateKey, createdAt, updatedAt, sentiment, warningLevel, riskLevel, entryType",
        notes: "&id, createdAt, updatedAt, tag",
        stickies: "&id, createdAt, updatedAt, zIndex",
        packages: "&id, kind, periodKey, createdAt, updatedAt, openedAt",
        characterAppearance: "&id, updatedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("entries")
          .toCollection()
          .modify((row: Partial<EntryRow>) => {
            if (!row.entryType) row.entryType = "entry";
            if (typeof row.quickLogNote !== "string") row.quickLogNote = "";
            if (typeof row.hbcmAtSubmit !== "number") {
              const legacyStreak =
                typeof row.streakAtSubmit === "number" ? row.streakAtSubmit : 0;
              row.hbcmAtSubmit = Math.min(
                5,
                Math.max(0, Math.ceil(legacyStreak * 0.85)),
              );
            }
          });
      });
  }
}

let dbInstance: MentellDB | null = null;
let dbInstanceName: string | null = null;

/** IndexedDB / validation export `getDb`. */
export function getDb() {
  const name = dexieDatabaseName();
  if (!dbInstance || dbInstanceName !== name) {
    dbInstance = new MentellDB(name);
    dbInstanceName = name;
  }
  return dbInstance;
}
