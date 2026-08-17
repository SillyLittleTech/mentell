import { useEffect, useMemo, useState } from "react";
import type { NoteTag, NoteRow } from "../../db/schema";
import { addNote, deleteNote, listNotes } from "./notesService";
import { HomeGreeting } from "../home/HomeGreeting";

export function Notepad() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<NoteTag>("self");

  useEffect(() => {
    listNotes().then(setNotes);
  }, []);

  const canSave = useMemo(() => title.trim() || body.trim(), [body, title]);

  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-2xl">
        <span className="hidden md:inline">Notepad</span>
        <span className="md:hidden">
          <HomeGreeting variant="mobile" fallback="Notepad" context="notes" />
        </span>
      </div>
      <div className="ink-muted mt-1 text-sm">
        Notes to self, a therapist, or anyone — stored locally.
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-2 md:grid-cols-[1fr_180px]">
          <input
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <select
            className="focus-ring w-full rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
            value={tag}
            onChange={(e) => setTag(e.target.value as NoteTag)}
          >
            <option value="self">To self</option>
            <option value="therapist">To therapist</option>
            <option value="other">To someone else</option>
          </select>
        </div>
        <textarea
          className="focus-ring min-h-[140px] w-full resize-y rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 font-paper text-lg leading-relaxed"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write freely…"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-3 text-sm font-medium"
            onClick={async () => {
              if (!canSave) return;
              const row = await addNote({
                title: title.trim() || "Untitled",
                body: body.trim(),
                tag,
              });
              setNotes((n) => [row, ...n]);
              setTitle("");
              setBody("");
              setTag("self");
            }}
          >
            Save note
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-3">
        {notes.length === 0 ? (
          <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-4">
            No notes yet.
          </div>
        ) : (
          notes.map((n) => (
            <article
              key={n.id}
              className="rounded-3xl border border-[var(--paper-border)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-paper text-xl">{n.title}</div>
                  <div className="ink-muted mt-1 text-sm">{n.tag}</div>
                </div>
                <button
                  type="button"
                  className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                  onClick={async () => {
                    await deleteNote(n.id);
                    setNotes((all) => all.filter((x) => x.id !== n.id));
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="mt-4 whitespace-pre-wrap font-paper text-lg leading-relaxed">
                {n.body || "—"}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
