/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LATE_NIGHT_VIDEO_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
