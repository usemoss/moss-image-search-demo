import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QueryResultDocumentInfo } from "@inferedge/moss";
import {
  searchImages,
  initializeSearchIndex,
  isSearchIndexLoaded,
  getSearchIndexLoadError,
} from "../utils/searchUtils";
import "../styles/ItemsPage.css";

const LIBRARY_NAME = "MOSS";

type GalleryItem = {
  id: string;
  caption: string;
  url: string;
  photographer?: string;
};

type QueryMeta = {
  timeTakenInMs: number;
  status: "fulfilled" | "rejected";
  errorMessage?: string;
};

type IndexState = {
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

const mapRecordToGalleryItem = (record: QueryResultDocumentInfo): GalleryItem | null => {
  const metadata = (record.metadata || {}) as Record<string, string>;
  const url = typeof metadata.url === "string" ? metadata.url : undefined;

  if (!url) {
    return null;
  }

  return {
    id: record.id,
    caption: record.text,
    url,
    photographer: typeof metadata.photographer === "string" ? metadata.photographer : undefined,
  };
};

const ImageSearchPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<QueryResultDocumentInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryMetadata, setQueryMetadata] = useState<QueryMeta | null>(null);
  const [indexState, setIndexState] = useState<IndexState>(() => {
    const loaded = isSearchIndexLoaded();
    const error = getSearchIndexLoadError();
    return {
      loaded,
      loading: !loaded && !error,
      error: error ? error.message : null,
    };
  });
  const trimmedTerm = searchTerm.trim();
  const hasQuery = trimmedTerm.length > 0;

  useEffect(() => {
    if (indexState.loaded) {
      return;
    }

    let isCancelled = false;
    setIndexState((previous) => ({ ...previous, loading: true, error: null }));

    initializeSearchIndex()
      .then(() => {
        if (!isCancelled) {
          setIndexState({ loaded: true, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setIndexState({
            loaded: false,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [indexState.loaded]);

  useEffect(() => {
    let isCancelled = false;

    const performSearch = async () => {
      if (!hasQuery) {
        setSearchResults([]);
        setQueryMetadata(null);
        setIsSearching(false);
        return;
      }

      if (!indexState.loaded || indexState.error) {
        setSearchResults([]);
        setQueryMetadata(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const { results, timeTakenInMs, status, errorMessage } = await searchImages(trimmedTerm);
        if (!isCancelled) {
          setSearchResults(results);
          setQueryMetadata({ timeTakenInMs, status, errorMessage });
        }
      } catch (error) {
        console.error("Image search error:", error);
        if (!isCancelled) {
          setSearchResults([]);
          setQueryMetadata({
            timeTakenInMs: 0,
            status: "rejected",
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };

    performSearch();

    return () => {
      isCancelled = true;
    };
  }, [hasQuery, trimmedTerm, indexState.error, indexState.loaded]);

  const galleryItems = useMemo(() => {
    if (!hasQuery) {
      return [];
    }

    return searchResults
      .map(mapRecordToGalleryItem)
      .filter((item): item is GalleryItem => Boolean(item));
  }, [hasQuery, searchResults]);

  const queryMetrics =
    !isSearching && hasQuery && indexState.loaded ? queryMetadata : null;

  const emptyState =
    indexState.loaded && hasQuery && !isSearching && galleryItems.length === 0;

  const searchDisabled = !indexState.loaded || Boolean(indexState.error);

  const handleRetryInitialization = async () => {
    if (indexState.loading) {
      return;
    }

    setIndexState({ loaded: false, loading: true, error: null });

    try {
      await initializeSearchIndex();
      setIndexState({ loaded: true, loading: false, error: null });
    } catch (error) {
      setIndexState({
        loaded: false,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="items-page">
      <header className="branding-header">
        <h1>In-app Real-time Image Search</h1>
      </header>

      <div className="search-container">
        <h2>Search the gallery</h2>
        <div className="search-input-container">
          <input
            type="text"
            placeholder={'Try "curious kittens" or "polar bears"'}
            value={searchTerm}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
            className="search-input"
            disabled={searchDisabled}
          />
          <div className="powered-by">
            <span>Powered by</span>
            <img
              src="/images/InferEdgeLogo_Dark_Mono_Icon.png"
              alt="InferEdge Logo"
              className="inferedge-logo"
            />
            <span>MOSS</span>
          </div>
        </div>
        {indexState.loading && !indexState.loaded && !indexState.error && (
          <p className="search-status">Loading the on-device index…</p>
        )}
        {indexState.error && (
          <div className="query-metrics">
            <p className="query-metrics-error">
              Failed to load the search index: {indexState.error}
            </p>
            <button
              type="button"
              className="retry-button"
              onClick={handleRetryInitialization}
              disabled={indexState.loading}
            >
              Retry
            </button>
          </div>
        )}
        {isSearching && <p className="search-status">Searching…</p>}
        {emptyState && <p className="search-status">No images match that description yet.</p>}
        {!hasQuery && !isSearching && indexState.loaded && !indexState.error && (
          <p className="search-status">Enter a description above to explore the gallery.</p>
        )}
        {queryMetrics && (
          <div className="query-metrics">
            <div className="query-metrics-header">
              <span className="query-metrics-title">Time taken</span>
              <span className="query-metrics-total">
                {Math.round(queryMetrics.timeTakenInMs)} ms
              </span>
            </div>
            {queryMetrics.status === "rejected" && queryMetrics.errorMessage && (
              <p className="query-metrics-error">Query failed: {queryMetrics.errorMessage}</p>
            )}
          </div>
        )}
      </div>

      <div className="items-list">
        <h2>Search results</h2>
        <div className="image-grid">
          {galleryItems.map((item) => (
            <ImageCard key={item.id} item={item} />
          ))}
        </div>
        {!hasQuery && galleryItems.length === 0 && (
          <p className="search-status subtle">Results will appear here.</p>
        )}
      </div>

      <footer className="branding-footer">
        <p>
          Powered by {LIBRARY_NAME} — Bringing fast, on-device semantic search
          to your apps.
        </p>
      </footer>
    </div>
  );
};

export default ImageSearchPage;

const ImageCard = ({ item }: { item: GalleryItem }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <Link
      to={`/image/${item.id}`}
      className="image-card"
      state={{ item }}
    >
      <img
        src={item.url}
        alt={item.caption}
        className="image-thumb"
        loading="lazy"
        onError={() => setIsVisible(false)}
      />
      {item.photographer && (
        <div className="image-meta">
          <p className="image-photographer">Photo by {item.photographer}</p>
        </div>
      )}
    </Link>
  );
};
