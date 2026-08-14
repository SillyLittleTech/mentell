# Application Error Codes

To simplify troubleshooting and ensure a consistent user experience, this application uses a prefix-based error code system for its user-facing messages.

## Error Code Categories

| Prefix | Description | Example Scenarios |
| :--- | :--- | :--- |
| **EC** | **Configuration / Build Issues** | Missing environment variables, disabled feature flags in the current build. |
| **ES** | **Server / Infrastructure Issues** | Cloud sync failures, Firebase connection errors, worker downtime. |
| **EX** | **Rejections / External Limitations** | Rate limits exceeded, API quota issues, third-party service rejections. |
| **EM** | **Miscellaneous / Unexpected** | Undocumented edge cases or unique instances assigned a code on the fly for debugging. |
| **EU** | **User Validation / Input Errors** | Invalid email format, journal entry exceeds max length. |
| **EPX1** | **Fallback Error Code** | Used when no specific code applies. |

## Specific Error Codes

| Code | Message / Meaning | Location / Trigger |
| :--- | :--- | :--- |
| **EC101** | Cloud synchronization is currently unavailable | `VITE_ENABLE_FIREBASE_SYNC` flag is disabled. |
| **EC102** | Feedback submission is currently unavailable | `VITE_FEEDBACK_FORM_ENDPOINT` environment variable is not configured. |
| **EC103** | Security verification is currently unavailable | Cloudflare Turnstile site key is missing or not configured. |
| **EC104** | Share links are currently unavailable | `VITE_ENABLE_SHARE_LINKS` flag is disabled. |
