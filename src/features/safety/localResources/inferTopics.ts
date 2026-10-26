import type { ResourceTopic } from './types'

export const ALL_RESOURCE_TOPICS: ResourceTopic[] = [
  'suicide',
  'mental_health',
  'food',
  'shelter',
]

const FOOD_PATTERN =
  /\b(food|hungry|hunger|pantry|groceries|starving|can't afford food|cannot afford food|food bank|snap|ebt)\b/i
const SHELTER_PATTERN =
  /\b(shelter|homeless|housing|evict|eviction|nowhere to stay|sleep outside|couch surf|couch-surf)\b/i
const CRISIS_PATTERN =
  /\b(suicide|self[- ]?harm|kill myself|hurt myself|988|overdose|end my life|want to die)\b/i

export function inferResourceTopics(input: {
  reasons?: string[]
  flaggedTerms?: string[]
  responseKind?: 'none' | 'positive' | 'support' | 'crisis'
  freeText?: string
}): ResourceTopic[] {
  const blob = [
    ...(input.reasons ?? []),
    ...(input.flaggedTerms ?? []),
    input.freeText ?? '',
  ]
    .join(' ')
    .toLowerCase()

  const topics = new Set<ResourceTopic>()

  if (input.responseKind === 'crisis' || CRISIS_PATTERN.test(blob)) {
    topics.add('suicide')
  }
  if (FOOD_PATTERN.test(blob)) {
    topics.add('food')
  }
  if (SHELTER_PATTERN.test(blob)) {
    topics.add('shelter')
  }

  if (topics.size === 0) {
    topics.add(input.responseKind === 'crisis' ? 'suicide' : 'mental_health')
  } else if (!topics.has('suicide') && !topics.has('mental_health')) {
    topics.add('mental_health')
  }

  return [...topics]
}

export function topicLabel(topic: ResourceTopic) {
  switch (topic) {
    case 'suicide':
      return 'Crisis & suicide prevention'
    case 'mental_health':
      return 'Mental health support'
    case 'food':
      return 'Food assistance'
    case 'shelter':
      return 'Housing & shelter help'
    default:
      return topic
  }
}
