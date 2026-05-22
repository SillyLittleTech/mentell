export function formatAuthError(e: unknown): string {
  const code =
    typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : ''
  const message = e instanceof Error ? e.message : String(e)

  switch (code) {
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in.'
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 6 characters).'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This sign-in link is invalid or expired. Request a new one.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    case 'auth/requires-recent-login':
      return 'Sign out, sign in again, then retry this action.'
    default:
      if (message.includes('redirect_uri_mismatch') || message.includes('redirect_uri')) {
        return message
      }
      return message || 'Sign-in failed. Try again.'
  }
}
