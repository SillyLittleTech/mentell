import { format } from 'date-fns'

export function dateKeyForLocalDay(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

