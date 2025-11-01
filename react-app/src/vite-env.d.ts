/// <reference types="vite/client" />

declare module "*.json" {
  const value: Array<{
    id: string;
    text: string;
    metadata?: Record<string, unknown>;
  }>;
  export default value;
}
