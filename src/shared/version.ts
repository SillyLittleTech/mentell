/** Injected at build time from root VERSION via vite.config.ts */
export const appVersion = import.meta.env.VITE_APP_VERSION ?? '0.0.0'

export const commitSha = import.meta.env.VITE_COMMIT_SHA ?? 'dev'
export const buildTime = import.meta.env.VITE_BUILD_TIME ?? new Date().toISOString()
export const refreshTime = new Date().toISOString()
