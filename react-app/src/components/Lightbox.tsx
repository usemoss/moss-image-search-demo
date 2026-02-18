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
          &#x2715;
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
