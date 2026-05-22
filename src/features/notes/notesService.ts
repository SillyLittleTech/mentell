import { db, type NoteRow, type NoteTag } from '../../db/schema'
import { makeId } from '../../shared/id'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

export async function listNotes() {
  return await db.notes.orderBy('createdAt').reverse().toArray()
}

export async function addNote(input: { title: string; body: string; tag: NoteTag }) {
  const now = Date.now()
  const row: NoteRow = {
    id: makeId('note'),
    createdAt: now,
    updatedAt: now,
    title: input.title,
    body: input.body,
    tag: input.tag,
  }
  await db.notes.put(row)
  notifyLocalDataChanged()
  return row
}

export async function deleteNote(id: string) {
  await db.notes.delete(id)
  notifyLocalDataChanged()
}

