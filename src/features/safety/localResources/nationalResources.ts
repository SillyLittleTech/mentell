import type { LocalResource } from './types'

const US: LocalResource[] = [
  {
    id: 'static-988',
    kind: 'static',
    name: '988 Suicide & Crisis Lifeline',
    description: 'Free, confidential support 24/7 in the US.',
    phone: '988',
    sms: '988',
    chatUrl: 'https://988lifeline.org/chat/',
    website: 'https://988lifeline.org/',
    hours: '24/7',
    sourceLabel: 'US 988 Lifeline',
  },
  {
    id: 'static-nami',
    kind: 'static',
    name: 'NAMI HelpLine',
    description: 'Information, resource referrals, and support for mental health.',
    phone: '1-800-950-6264',
    website: 'https://www.nami.org/help',
    hours: 'Mon–Fri, 10am–10pm ET',
    sourceLabel: 'NAMI',
  },
  {
    id: 'static-211',
    kind: 'static',
    name: '211 (local services)',
    description: 'Dial 211 for food, housing, utilities, and other community help in many US areas.',
    phone: '211',
    website: 'https://www.211.org/',
    sourceLabel: 'United Way 211',
  },
]

const BY_COUNTRY: Record<string, LocalResource[]> = {
  CA: [
    {
      id: 'static-ca-988',
      kind: 'static',
      name: '9-8-8: Suicide Crisis Helpline',
      description: 'Free, confidential support across Canada, 24/7.',
      phone: '988',
      sms: '988',
      website: 'https://988.ca/',
      hours: '24/7',
      sourceLabel: '988 Canada',
    },
    {
      id: 'static-ca-211',
      kind: 'static',
      name: '211 (community services)',
      description: 'Information and referrals for community and social services in many Canadian regions.',
      phone: '211',
      website: 'https://211.ca/',
      sourceLabel: '211 Canada',
    },
  ],
  GB: [
    {
      id: 'static-gb-samaritans',
      kind: 'static',
      name: 'Samaritans',
      description: 'Confidential emotional support, 24/7.',
      phone: '116 123',
      website: 'https://www.samaritans.org/',
      hours: '24/7',
      sourceLabel: 'Samaritans',
    },
  ],
  AU: [
    {
      id: 'static-au-lifeline',
      kind: 'static',
      name: 'Lifeline Australia',
      description: 'Crisis support and suicide prevention, 24/7.',
      phone: '13 11 14',
      website: 'https://www.lifeline.org.au/',
      hours: '24/7',
      sourceLabel: 'Lifeline Australia',
    },
  ],
}

export function staticNationalResources(countryCode: string | undefined): LocalResource[] {
  const code = (countryCode ?? 'US').trim().toUpperCase()
  if (code === 'US') return US
  return (
    BY_COUNTRY[code] ?? [
      {
        id: `static-${code.toLowerCase()}-fah`,
        kind: 'static',
        name: 'Find A Helpline',
        description: 'Look up verified crisis lines for your country and language.',
        website: 'https://findahelpline.com/',
        sourceLabel: 'Find A Helpline',
      },
    ]
  )
}

export function nationalResourcesHeading(countryCode: string | undefined) {
  const code = (countryCode ?? 'US').trim().toUpperCase()
  if (code === 'US') return 'National lines (United States)'
  if (code === 'CA') return 'National lines (Canada)'
  if (code === 'GB') return 'National lines (United Kingdom)'
  if (code === 'AU') return 'National lines (Australia)'
  return 'Crisis lines (your country)'
}

export function emergencyBannerCopy(countryCode: string | undefined) {
  const code = (countryCode ?? 'US').trim().toUpperCase()
  if (code === 'US') {
    return {
      lead: 'If you might be in immediate danger, call emergency services now. In the United States, call or text',
      hotline: '988',
      href: 'https://988lifeline.org/chat/',
      linkLabel: '988lifeline.org',
    }
  }
  if (code === 'CA') {
    return {
      lead: 'If you might be in immediate danger, call emergency services now. In Canada, call or text',
      hotline: '988',
      href: 'https://988.ca/',
      linkLabel: '988.ca',
    }
  }
  return {
    lead: 'If you might be in immediate danger, call your local emergency number now. You can also look up crisis lines at',
    hotline: null as string | null,
    href: 'https://findahelpline.com/',
    linkLabel: 'Find A Helpline',
  }
}
