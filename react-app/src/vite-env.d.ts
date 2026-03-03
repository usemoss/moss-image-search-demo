/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MOSS_PYTHON_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.json" {
  const value: Array<{
    id: string;
    text: string;
    metadata?: Record<string, unknown>;
  }>;
  export default value;
}
