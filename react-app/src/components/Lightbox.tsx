import { useCallback, useEffect } from "react";
import "../styles/Lightbox.css";

interface LightboxItem {
  readonly id: string;
  readonly caption: string;
  readonly url: string;
  readonly imageId: string;
}

interface LightboxProps {
  readonly item: LightboxItem;
  readonly onClose: () => void;
  readonly onFindSimilar: (caption: string) => void;
}

const Lightbox = ({ item, onClose, onFindSimilar }: LightboxProps) => {
  const captions = item.caption.split(" | ");
  const firstCaption = captions[0] ?? item.caption;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleFindSimilar = () => {
    onFindSimilar(firstCaption);
  };

  return (
    <div className="lightbox-backdrop" onClick={handleBackdropClick}>
      <div className="lightbox-content">
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <img src={item.url} alt={firstCaption} className="lightbox-image" />
        <div className="lightbox-info">
          <div className="lightbox-captions">
            {captions.map((cap) => (
              <p key={cap} className="lightbox-caption">{cap.trim()}</p>
            ))}
          </div>
          <p className="lightbox-id">ID: {item.imageId}</p>
          <button type="button" className="lightbox-find-similar" onClick={handleFindSimilar}>
            Find similar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;
