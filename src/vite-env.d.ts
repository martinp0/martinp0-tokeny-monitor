/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "true" for a native-app web build. Hides Buy Me a Coffee links (guideline 3.1.1). */
  readonly VITE_NATIVE_APP?: string;
}
