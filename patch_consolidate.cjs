const fs = require('fs')

const sharedMatchPath = 'src/lib/localMatch.ts'
const workerMatchPath = 'worker/src/localMatch.ts'
const projectorSearchPath = 'src/features/compilation/projectorSearch.ts'

const sharedContent = fs.readFileSync(workerMatchPath, 'utf8')

// Replace relative import of entryMerge with the type definition
const fixedSharedContent = sharedContent
  .replace(
    /import type \{ EntrySnapshot \} from "\.\/entryMerge";/,
    `export type EntrySnapshot = {
  id: string
  createdAt?: number
  updatedAt?: number
  dateKey: string
  sentiment: string
  emotion?: string | null
  emotionNote?: string | null
  situation?: string | null
  details?: string | null
  behavioursNoted?: string | null
  reoccurringTheme?: string | null
}`
  )
  .replace(
    /import \{ STOP_WORDS \} from '\.\.\/\.\.\/src\/lib\/stopWords';/,
    "import { STOP_WORDS } from './stopWords';"
  )

fs.writeFileSync(sharedMatchPath, fixedSharedContent)

let workerContent = fs.readFileSync(workerMatchPath, 'utf8')
workerContent = `import type { EntrySnapshot } from './entryMerge';
import { localMatchEntries as sharedMatch, mergeEntrySnapshots as sharedMerge } from '../../src/lib/localMatch';

export function localMatchEntries(entries: EntrySnapshot[], query: string): EntrySnapshot[] {
  return sharedMatch(entries as any, query) as any;
}

export function mergeEntrySnapshots(primary: EntrySnapshot[], secondary: EntrySnapshot[], limit = 20): EntrySnapshot[] {
  return sharedMerge(primary as any, secondary as any, limit) as any;
}
`
fs.writeFileSync(workerMatchPath, workerContent)

const projectorContent = fs.readFileSync(projectorSearchPath, 'utf8')

// Use a more robust replace for projectorSearch.ts
const startIdx = projectorContent.indexOf('function localMatchEntries(')
const endIdx = projectorContent.indexOf(
  'export function getProjectorSearchEndpoint()'
)

if (startIdx !== -1 && endIdx !== -1) {
  const head = projectorContent.substring(0, startIdx)
  const tail = projectorContent.substring(endIdx)

  const replacement = `import { localMatchEntries as sharedMatch } from '../../lib/localMatch';

function localMatchEntries(entries: ProjectorSearchEntry[], query: string) {
  return sharedMatch(entries as any, query) as any;
}

`

  let newProjectorContent = head + replacement + tail
  newProjectorContent = newProjectorContent.replace(
    /import \{ STOP_WORDS \} from '\.\.\/\.\.\/lib\/stopWords';\n/g,
    ''
  )
  fs.writeFileSync(projectorSearchPath, newProjectorContent)
}
