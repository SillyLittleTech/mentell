import { format } from 'date-fns'

export function dateKeyForLocalDay(d: Date) {
  return format(d, 'yyyy-MM-dd')
}


export function stripDateKey(dateKey: string) {
  return dateKey.startsWith('~') ? dateKey.slice(1) : dateKey
}
