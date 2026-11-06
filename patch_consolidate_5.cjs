const fs = require('fs')

const projectorSearchPath = 'src/features/compilation/projectorSearch.ts'

let projectorContent = fs.readFileSync(projectorSearchPath, 'utf8')

// The issue is: src/features/compilation/projectorSearch.ts(255,36): error TS7006: Parameter 'e' implicitly has an 'any' type.
// This is because we removed the `ProjectorSearchEntry` type parameter when mapping, or something else.
// Let's replace the delegation logic with typed ones.

projectorContent = projectorContent.replace(
  `function localMatchEntries(entries: ProjectorSearchEntry[], query: string) {
  return sharedMatch(entries as any, query) as any;
}`,
  `function localMatchEntries(entries: ProjectorSearchEntry[], query: string): ProjectorSearchEntry[] {
  return sharedMatch(entries as any, query) as any;
}`
)

// Wait, the error is at line 255 of projectorSearch.ts. Let's see what's at line 255.
