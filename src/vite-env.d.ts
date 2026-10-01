/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GoatCounter site code (the "xyz" in xyz.goatcounter.com); analytics stay off without it. */
  readonly VITE_GOATCOUNTER_CODE?: string;
  /** Public address of the site, for share-preview tags. */
  readonly VITE_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
