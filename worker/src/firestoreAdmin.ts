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
  sa: ServiceAccount,
  token: string,
  parent: string,
  structuredQuery: Record<string, unknown>,
) {
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runQuery`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parent, structuredQuery }),
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
  const rows = await runQuery(sa, token, parent, {
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
  const rows = await runQuery(sa, token, parent, {
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

export function firebaseProjectId(serviceAccountJson: string) {
  return parseServiceAccount(serviceAccountJson).project_id
}
