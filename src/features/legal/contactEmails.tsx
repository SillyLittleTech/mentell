const MENTELL_CONTACT_EMAILS = [
  {
    purpose: "Policy questions",
    address: "privacy@slt.ong",
  },
  {
    purpose: "Technical support",
    address: "technical@slt.ong",
  },
  {
    purpose: "Account security",
    address: "security@slt.ong",
    note: "Sign-in problems, suspected unauthorized access, or reporting a security concern",
  },
] as const;

const contactLinkClass =
  "text-[#4a6fa5] underline-offset-2 hover:text-[#3d5f8f] hover:underline dark:text-[#8eb4e8] dark:hover:text-[#a8c8f0]";

export function ContactForQuestions() {
  return (
    <ul className="ink-muted mt-3 grid gap-3 text-sm leading-relaxed">
      {MENTELL_CONTACT_EMAILS.map((row) => (
        <li key={row.address}>
          <span className="font-medium text-[var(--paper-ink)]">
            {row.purpose}:
          </span>{" "}
          <a href={`mailto:${row.address}`} className={contactLinkClass}>
            {row.address}
          </a>
          {"note" in row && row.note ? (
            <span className="mt-0.5 block text-xs opacity-90">{row.note}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
