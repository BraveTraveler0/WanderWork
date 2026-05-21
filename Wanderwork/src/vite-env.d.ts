/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LATE_NIGHT_VIDEO_URL: string
  readonly VITE_DASHBOARD_LOGIN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
