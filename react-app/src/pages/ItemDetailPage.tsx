import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { QueryResultDocumentInfo } from "@inferedge/moss";
import "../styles/ItemDetailPage.css";

type GalleryItem = {
  id: string;
  caption: string;
  url: string;
  photographer?: string;
};

const mapRecordToGalleryItem = (record: QueryResultDocumentInfo): GalleryItem | null => {
  const metadata = record.metadata ?? ({} as Record<string, string>);
  const url = typeof metadata.url === "string" ? metadata.url : undefined;

  if (!url) {
    return null;
  }

  return {
    id: record.id,
    caption: record.text,
    url,
    photographer:
      typeof metadata.photographer === "string" ? metadata.photographer : undefined,
  };
};

const ImageDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = location.state as { item?: QueryResultDocumentInfo | GalleryItem } | undefined;
  const initialItem = useMemo(() => {
    const candidate = locationState?.item;
    if (!candidate) {
      return null;
    }

    if ("text" in candidate && "metadata" in candidate) {
      const mapped = mapRecordToGalleryItem(candidate as QueryResultDocumentInfo);
      return mapped;
    }

    return candidate as GalleryItem;
  }, [locationState]);

  const [isImageAvailable, setIsImageAvailable] = useState(true);
  const galleryItem = initialItem;
  const error = galleryItem ? null : id ? "Open this image from the search results to view details." : null;

  useEffect(() => {
    setIsImageAvailable(true);
  }, [galleryItem?.url]);

  return (
    <div className="item-detail-page image-detail-page">
      <Link to="/" className="back-link">Back to gallery</Link>

      <div className="image-detail">
        {error && <p className="image-status">{error}</p>}
        {!error && !galleryItem && (
          <p className="image-status">Select an image from the gallery to view details.</p>
        )}
        {!error && galleryItem && (
          <>
            {isImageAvailable ? (
              <img
                src={galleryItem.url}
                alt={galleryItem.caption}
                className="image-detail-asset"
                onError={() => setIsImageAvailable(false)}
              />
            ) : (
              <p className="image-status">We couldn&apos;t load this image right now.</p>
            )}
            {galleryItem.photographer && (
              <div className="image-detail-meta">
                <p className="image-photographer">Photo by {galleryItem.photographer}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImageDetailPage;