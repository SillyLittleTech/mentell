const fs = require('fs')

const localMatchWorkerPath = 'worker/src/localMatch.ts'
const projectorSearchPath = 'src/features/compilation/projectorSearch.ts'

const stopWordsSrc = `export const STOP_WORDS = new Set([
  'the', 'and', 'are', 'there', 'any', 'entries', 'about', 'is', 'in', 'at', 'on', 'to', 'for', 'a', 'an', 'of', 'with', 'from', 'by', 'that', 'this', 'it', 'as', 'be', 'was', 'or', 'you', 'i', 'my', 'me', 'we', 'us', 'our', 'they', 'them', 'their', 'what', 'when', 'where', 'how', 'why', 'who', 'which', 'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'would', 'should', 'will', 'some', 'all', 'many', 'much'
]);
`

fs.writeFileSync('src/lib/stopWords.ts', stopWordsSrc)

let workerContent = fs.readFileSync(localMatchWorkerPath, 'utf8')
workerContent = workerContent.replace(
  /const STOP_WORDS = new Set\(\[[\s\S]+?\]\);/,
  "import { STOP_WORDS } from '../../src/lib/stopWords';"
)
fs.writeFileSync(localMatchWorkerPath, workerContent)

let projectorContent = fs.readFileSync(projectorSearchPath, 'utf8')
projectorContent = projectorContent.replace(
  /const STOP_WORDS = new Set\(\[[\s\S]+?\]\);?/,
  "import { STOP_WORDS } from '../../lib/stopWords';"
)
fs.writeFileSync(projectorSearchPath, projectorContent)
