import { z } from 'zod'
import greetingsRaw from '../../../greetings.json?raw'
import type { GreetingTemplate } from './greetingAddress'

const GreetingSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening']).optional(),
})

const GreetingsFileSchema = z.object({
  greetings: z.array(GreetingSchema).min(1),
  nicknames: z.array(z.string().min(1)).min(1),
  anonNicknames: z.array(z.string().min(1)).min(1),
})

export type GreetingsCatalog = {
  greetings: GreetingTemplate[]
  nicknames: string[]
  anonNicknames: string[]
}

const FALLBACK_CATALOG: GreetingsCatalog = {
  greetings: [
    { id: 'hello', text: 'Hello {name}' },
    { id: 'greetings', text: 'Greetings {name}' },
  ],
  nicknames: ['cutie pie', 'cupcake'],
  anonNicknames: ['Stranger', 'Mystery'],
}

function parseCatalog(raw: string): GreetingsCatalog {
  try {
    const parsed = GreetingsFileSchema.parse(JSON.parse(raw))
    const greetings = parsed.greetings.filter((row) => row.text.includes('{name}'))
    if (greetings.length === 0) return FALLBACK_CATALOG
    return {
      greetings,
      nicknames: parsed.nicknames,
      anonNicknames: parsed.anonNicknames,
    }
  } catch {
    return FALLBACK_CATALOG
  }
}

export const greetingsCatalog: GreetingsCatalog = parseCatalog(greetingsRaw)
