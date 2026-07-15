import type { ProjectorSearchResult } from '../compilation/projectorSearch'

export const PROJECTOR_DEBUG_EVENT = 'mentell:projector-debug'

export type ProjectorDebugDetail =
  | { action: 'open-search'; seed?: ProjectorSearchResult | null }
  | { action: 'close-search' }

export function emitProjectorDebug(detail: ProjectorDebugDetail) {
  window.dispatchEvent(new CustomEvent(PROJECTOR_DEBUG_EVENT, { detail }))
}

export function makeMockSearchEntries(): ProjectorSearchResult {
  const now = Date.now()
  return {
    type: 'entries',
    entryIds: ['debug-1', 'debug-2', 'debug-3'],
    entries: [
      {
        id: 'debug-1',
        createdAt: now,
        updatedAt: now,
        dateKey: '2026-05-18',
        sentiment: '+',
        emotion: 'happy',
        emotionNote: '',
        situation: 'Debug mock: good day',
        details: 'Synthetic entry for UI debugging of projector search cards.',
        behavioursNoted: 'Offered help without being asked',
        reoccurringTheme: 'Mutual support',
        flaggedTerms: [],
        warningLevel: 'none',
        riskScore: 0,
        interventionScore: 0,
        riskLevel: 'none',
        scoreDelta: 1,
        streakAtSubmit: 3,
      },
      {
        id: 'debug-2',
        createdAt: now - 1000,
        updatedAt: now - 1000,
        dateKey: '2026-05-17',
        sentiment: '=',
        emotion: 'calm',
        emotionNote: 'okay-ish',
        situation: 'Debug mock: mixed feelings',
        details:
          'Another synthetic slide for layout checks.\n'.repeat(40) +
          'Long trailing paragraph to exercise modal scroll and safe space.',
        behavioursNoted: '',
        reoccurringTheme: 'Ambivalence after group plans',
        flaggedTerms: [],
        warningLevel: 'none',
        riskScore: 0,
        interventionScore: 0,
        riskLevel: 'none',
        scoreDelta: 0,
        streakAtSubmit: 2,
      },
      {
        id: 'debug-3',
        createdAt: now - 2000,
        updatedAt: now - 2000,
        dateKey: '2026-05-16',
        sentiment: '-',
        emotion: 'anxious',
        emotionNote: '',
        situation: 'Debug mock: rough afternoon',
        details: 'Used to verify warning styling without a network call.',
        behavioursNoted: 'Interrupted twice, then went quiet',
        reoccurringTheme: '',
        flaggedTerms: ['debug'],
        warningLevel: 'warn',
        riskScore: 0.2,
        interventionScore: 0.1,
        riskLevel: 'low',
        scoreDelta: -1,
        streakAtSubmit: 1,
      },
    ],
    preamble: 'Debug mock entry cards (no network).',
  }
}

export function makeMockSearchAnswer(): ProjectorSearchResult {
  return {
    type: 'answer',
    text: 'Debug plain-text answer: you logged three mock entries this week with mixed sentiment. (No network.)',
  }
}
