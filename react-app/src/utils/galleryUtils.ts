import { QueryResultDocumentInfo } from "@inferedge/moss";

export interface GalleryItem {
  readonly id: string;
  readonly caption: string;
  readonly url: string;
  readonly imageId: string;
}

const API_BASE = (import.meta.env.MOSS_PYTHON_API_URL as string | undefined) || "";

function proxyImageUrl(url: string): string {
  if (url.startsWith("http://")) {
    return `${API_BASE}/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export const mapRecordToGalleryItem = (record: QueryResultDocumentInfo): GalleryItem | null => {
  const metadata = (record.metadata || {}) as Record<string, string>;
  const url = typeof metadata.url === "string" ? metadata.url : undefined;

  if (!url) {
    return null;
  }

  return {
    id: record.id,
    caption: record.text,
    url: proxyImageUrl(url),
    imageId: typeof metadata.image_id === "string" ? metadata.image_id : record.id,
  };
};
