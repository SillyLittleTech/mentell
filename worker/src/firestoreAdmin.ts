import { SignJWT, importPKCS8 } from 'jose'

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

let cachedToken: { token: string; exp: number } | null = null

async function getAccessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token

  const key = await importPKCS8(sa.private_key.replace(/\\n/g, '\n'), 'RS256')
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) throw new Error('Failed to obtain Firestore access token')
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new Error('Missing access_token')
  cachedToken = {
    token: json.access_token,
    exp: now + (json.expires_in ?? 3600),
  }
  return cachedToken.token
}

function parseServiceAccount(raw: string): ServiceAccount {
  const sa = JSON.parse(raw) as ServiceAccount
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON')
  }
  return sa
}

async function runQuery(
  token: string,
  parent: string,
  structuredQuery: Record<string, unknown>,
) {
  const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Firestore query failed: ${res.status} ${text}`)
  }
  return (await res.json()) as Array<{ document?: unknown }>
}

function fieldString(path: string, value: string) {
  return {
    fieldFilter: {
      field: { fieldPath: path },
      op: 'EQUAL',
      value: { stringValue: value },
    },
  }
}

export async function firestoreHasWeeklyPackage(
  serviceAccountJson: string,
  uid: string,
  periodKey: string,
): Promise<boolean> {
  const sa = parseServiceAccount(serviceAccountJson)
  const token = await getAccessToken(sa)
  const parent = `projects/${sa.project_id}/databases/(default)/documents/users/${uid}`
  const rows = await runQuery(token, parent, {
    from: [{ collectionId: 'packages' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          fieldString('kind', 'weekly'),
          fieldString('periodKey', periodKey),
        ],
      },
    },
    limit: 1,
  })
  return rows.some((r) => r.document)
}

export async function firestoreHasEntriesInRange(
  serviceAccountJson: string,
  uid: string,
  startKey: string,
  endKey: string,
): Promise<boolean> {
  const sa = parseServiceAccount(serviceAccountJson)
  const token = await getAccessToken(sa)
  const parent = `projects/${sa.project_id}/databases/(default)/documents/users/${uid}`
  const rows = await runQuery(token, parent, {
    from: [{ collectionId: 'entries' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'dateKey' },
              op: 'GREATER_THAN_OR_EQUAL',
              value: { stringValue: startKey },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'dateKey' },
              op: 'LESS_THAN_OR_EQUAL',
              value: { stringValue: endKey },
            },
          },
        ],
      },
    },
    limit: 1,
  })
  return rows.some((r) => r.document)
}

function readFirestoreValue(value: Record<string, unknown> | undefined): unknown {
  if (!value) return undefined
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('booleanValue' in value) return Boolean(value.booleanValue)
  if ('arrayValue' in value) {
    const values = (value.arrayValue as { values?: Array<Record<string, unknown>> })?.values ?? []
    return values.map((v) => readFirestoreValue(v))
  }
  if ('mapValue' in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields ?? {}
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(fields)) out[k] = readFirestoreValue(v)
    return out
  }
  if ('nullValue' in value) return null
  return undefined
}

function documentToEntry(doc: {
  name?: string
  fields?: Record<string, Record<string, unknown>>
}): {
  id: string
  createdAt?: number
  updatedAt?: number
  dateKey: string
  sentiment: string
  emotion?: string
  emotionNote?: string
  situation: string
  details: string
  behavioursNoted?: string
  reoccurringTheme?: string
  flaggedTerms?: string[]
  warningLevel?: string
  riskScore?: number
  interventionScore?: number
  riskLevel?: string
  scoreDelta?: number
  streakAtSubmit?: number
} | null {
  const fields = doc.fields ?? {}
  const get = (key: string) => readFirestoreValue(fields[key])
  const id = (typeof get('id') === 'string' ? (get('id') as string) : '') ||
    (doc.name ? doc.name.split('/').pop() ?? '' : '')
  const dateKey = typeof get('dateKey') === 'string' ? (get('dateKey') as string) : ''
  if (!id || !dateKey) return null
  return {
    id,
    createdAt: typeof get('createdAt') === 'number' ? (get('createdAt') as number) : undefined,
    updatedAt: typeof get('updatedAt') === 'number' ? (get('updatedAt') as number) : undefined,
    dateKey,
    sentiment: typeof get('sentiment') === 'string' ? (get('sentiment') as string) : '=',
    emotion: typeof get('emotion') === 'string' ? (get('emotion') as string) : undefined,
    emotionNote: typeof get('emotionNote') === 'string' ? (get('emotionNote') as string) : undefined,
    situation: typeof get('situation') === 'string' ? (get('situation') as string) : '',
    details: typeof get('details') === 'string' ? (get('details') as string) : '',
    behavioursNoted:
      typeof get('behavioursNoted') === 'string' ? (get('behavioursNoted') as string) : undefined,
    reoccurringTheme:
      typeof get('reoccurringTheme') === 'string' ? (get('reoccurringTheme') as string) : undefined,
    flaggedTerms: Array.isArray(get('flaggedTerms'))
      ? (get('flaggedTerms') as unknown[]).filter((t): t is string => typeof t === 'string')
      : undefined,
    warningLevel: typeof get('warningLevel') === 'string' ? (get('warningLevel') as string) : undefined,
    riskScore: typeof get('riskScore') === 'number' ? (get('riskScore') as number) : undefined,
    interventionScore:
      typeof get('interventionScore') === 'number' ? (get('interventionScore') as number) : undefined,
    riskLevel: typeof get('riskLevel') === 'string' ? (get('riskLevel') as string) : undefined,
    scoreDelta: typeof get('scoreDelta') === 'number' ? (get('scoreDelta') as number) : undefined,
    streakAtSubmit:
      typeof get('streakAtSubmit') === 'number' ? (get('streakAtSubmit') as number) : undefined,
  }
}

/** Fetch journal entries by id from users/{uid}/entries (batched IN queries). */
export async function firestoreFetchEntriesByIds(
  serviceAccountJson: string,
  uid: string,
  entryIds: string[],
) {
  if (entryIds.length === 0) return []
  const sa = parseServiceAccount(serviceAccountJson)
  const token = await getAccessToken(sa)
  const parent = `projects/${sa.project_id}/databases/(default)/documents/users/${uid}`
  const unique = [...new Set(entryIds)].slice(0, 30)
  const out: NonNullable<ReturnType<typeof documentToEntry>>[] = []

  // Firestore IN supports up to 30 values; batch if needed.
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30)
    const rows = await runQuery(token, parent, {
      from: [{ collectionId: 'entries' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'id' },
          op: 'IN',
          value: {
            arrayValue: {
              values: batch.map((id) => ({ stringValue: id })),
            },
          },
        },
      },
      limit: batch.length,
    })
    for (const row of rows) {
      const doc = row.document as
        | { name?: string; fields?: Record<string, Record<string, unknown>> }
        | undefined
      if (!doc) continue
      const entry = documentToEntry(doc)
      if (entry) out.push(entry)
    }
  }
  return out
}

export function firebaseProjectId(serviceAccountJson: string) {
  return parseServiceAccount(serviceAccountJson).project_id
}
