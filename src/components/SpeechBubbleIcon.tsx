export function SpeechBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 5.75h12a3.25 3.25 0 0 1 3.25 3.25v5a3.25 3.25 0 0 1-3.25 3.25h-4.9l-4.1 3.25v-3.25H6A3.25 3.25 0 0 1 2.75 14v-5A3.25 3.25 0 0 1 6 5.75Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11.5" r="1.15" fill="currentColor" />
      <circle cx="12" cy="11.5" r="1.15" fill="currentColor" />
      <circle cx="15" cy="11.5" r="1.15" fill="currentColor" />
    </svg>
  )
}
