import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueryResultDocumentInfo } from "@inferedge/moss";
import {
  searchImages,
  searchImagesViaPythonApi,
  checkPythonApiHealth,
  initializeSearchIndex,
  isSearchIndexLoaded,
  getSearchIndexLoadError,
  switchIndex,
  getCurrentTier,
  getCurrentTierInfo,
  TIERS,
} from "../utils/searchUtils";
import type { TierInfo } from "../utils/searchUtils";
import Lightbox from "../components/Lightbox";
import "../styles/ItemsPage.css";

interface GalleryItem {
  readonly id: string;
  readonly caption: string;
  readonly url: string;
  readonly imageId: string;
}

interface QueryMeta {
  readonly timeTakenInMs: number;
  readonly status: "fulfilled" | "rejected";
  readonly errorMessage?: string;
}

interface IndexState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

type SearchMode = "js" | "python";

const SAMPLE_QUERIES: readonly string[] = [
  "a dog catching a frisbee in mid-air",
  "cozy vibes",
  "surfers riding waves at the beach",
  "something dramatic",
  "a kitchen with stainless steel appliances",
];

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
    imageId: typeof metadata.image_id === "string" ? metadata.image_id : record.id,
  };
};

function getSpeedBadgeClass(ms: number): string {
  if (ms < 10) return "speed-badge--green";
  if (ms <= 50) return "speed-badge--yellow";
  return "speed-badge--red";
}

const ImageSearchPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<QueryResultDocumentInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryMetadata, setQueryMetadata] = useState<QueryMeta | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>(getCurrentTier());
  const [tierInfo, setTierInfo] = useState<TierInfo>(getCurrentTierInfo());
  const [activeSampleQuery, setActiveSampleQuery] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [indexState, setIndexState] = useState<IndexState>(() => {
    const loaded = isSearchIndexLoaded();
    const error = getSearchIndexLoadError();
    return {
      loaded,
      loading: !loaded && !error,
      error: error ? error.message : null,
    };
  });
  const [searchMode, setSearchMode] = useState<SearchMode>("python");
  const [topK, setTopK] = useState(5);
  const [topKInput, setTopKInput] = useState("5");
  const [showSamples, setShowSamples] = useState(true);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoQueried = useRef(false);
  const trimmedTerm = searchTerm.trim();
  const hasQuery = trimmedTerm.length > 0;

  useEffect(() => {
    if (indexState.loaded) return;

    let isCancelled = false;
    setIndexState((prev) => ({ ...prev, loading: true, error: null }));

    if (searchMode === "python") {
      checkPythonApiHealth().then((ok) => {
        if (!isCancelled) {
          if (ok) {
            setIndexState({ loaded: true, loading: false, error: null });
          } else {
            setIndexState({
              loaded: false,
              loading: false,
              error: `Python backend unreachable at ${import.meta.env.VITE_PYTHON_API_URL ?? "http://localhost:8000"}`,
            });
          }
        }
      });
    } else {
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
    }

    return () => {
      isCancelled = true;
    };
  }, [indexState.loaded, searchMode]);

  // Auto-run first sample query when index loads
  useEffect(() => {
    if (indexState.loaded && !hasAutoQueried.current) {
      hasAutoQueried.current = true;
      const firstQuery = SAMPLE_QUERIES[0];
      setSearchTerm(firstQuery);
      setActiveSampleQuery(firstQuery);
    }
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
        const { results, timeTakenInMs, status, errorMessage } =
          searchMode === "python"
            ? await searchImagesViaPythonApi(trimmedTerm, selectedTier, topK)
            : await searchImages(trimmedTerm, topK);
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
  }, [hasQuery, trimmedTerm, indexState.error, indexState.loaded, searchMode, selectedTier, topK]);

  const galleryItems = useMemo(() => {
    if (!hasQuery) return [];
    return searchResults
      .map(mapRecordToGalleryItem)
      .filter((item): item is GalleryItem => Boolean(item));
  }, [hasQuery, searchResults]);

  const queryMetrics =
    hasQuery && indexState.loaded && queryMetadata ? queryMetadata : null;

  const emptyState =
    indexState.loaded && hasQuery && !isSearching && galleryItems.length === 0;

  const searchDisabled = !indexState.loaded || Boolean(indexState.error);

  const handleSampleQueryClick = useCallback((query: string) => {
    setSearchTerm(query);
    setActiveSampleQuery(query);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setActiveSampleQuery(null);
  }, []);

  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    setIndexState({ loaded: false, loading: false, error: null });
    setSearchResults([]);
    setQueryMetadata(null);
    hasAutoQueried.current = false;
  }, []);

  const handleTierChange = useCallback(async (event: ChangeEvent<HTMLSelectElement>, currentMode: SearchMode) => {
    const newTier = event.target.value;
    setSelectedTier(newTier);
    setTierInfo(TIERS.find((t) => t.value === newTier) ?? TIERS[0]);
    setSearchResults([]);
    setQueryMetadata(null);

    if (currentMode === "python") {
      return;
    }

    setIndexState({ loaded: false, loading: true, error: null });
    try {
      await switchIndex(newTier);
      setIndexState({ loaded: true, loading: false, error: null });
    } catch (error) {
      setIndexState({
        loaded: false,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const handleRetryInitialization = useCallback(() => {
    if (indexState.loading) return;
    setIndexState({ loaded: false, loading: false, error: null });
  }, [indexState.loading]);

  const handleLightboxFindSimilar = useCallback((caption: string) => {
    setSearchTerm(caption);
    setActiveSampleQuery(null);
    setLightboxItem(null);
  }, []);

  return (
    <div className="items-page">
      {/* Dark gradient hero header */}
      <header className="hero-header">
        <div className="hero-header-inner">
          <img
            src="/images/InferEdgeLogo_Dark_Icon.png"
            alt="Moss"
            className="hero-logo"
          />
          <div className="hero-text">
            <h1>Moss Image Search</h1>
            <p className="hero-tagline">
              Sub-10ms semantic search across {tierInfo.docCount} images
            </p>
          </div>
        </div>
      </header>

      {/* Elevated search section overlapping header */}
      <div className="search-section">
        <div className="search-bar-wrapper">
          <div className="search-input-row">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder='Try "a dog catching a frisbee" or "sunset over the ocean"'
              value={searchTerm}
              onChange={handleInputChange}
              className="search-input"
              disabled={searchDisabled}
              ref={searchInputRef}
              data-testid="search-input"
            />
            <div className="powered-by">
              <span className="moss-dot" />
              <span>MOSS</span>
            </div>
          </div>

          {/* Controls: tier selector + sdk toggle */}
          <div className="controls-row">
            <div className="tier-selector">
              <label htmlFor="tier-select">Index size:</label>
              <select
                id="tier-select"
                className="tier-select"
                value={selectedTier}
                onChange={(e) => handleTierChange(e, searchMode)}
                disabled={indexState.loading}
                data-testid="tier-select"
              >
                {TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="topk-selector">
              <label htmlFor="topk-input">Results:</label>
              <input
                id="topk-input"
                type="number"
                className="topk-input"
                value={topKInput}
                onChange={(e) => setTopKInput(e.target.value)}
                onBlur={() => {
                  const v = Math.max(1, Math.min(50, Number(topKInput) || 1));
                  setTopK(v);
                  setTopKInput(String(v));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                min={1}
                max={50}
              />
            </div>

            <div className="sdk-toggle">
              <span className="sdk-toggle-label">SDK:</span>
              <button
                type="button"
                className={`sdk-toggle-btn sdk-toggle-btn--python${searchMode === "python" ? " sdk-toggle-btn--active" : ""}`}
                onClick={() => handleModeChange("python")}
              >
                Python
              </button>
              <button
                type="button"
                className={`sdk-toggle-btn sdk-toggle-btn--js${searchMode === "js" ? " sdk-toggle-btn--active" : ""}`}
                onClick={() => handleModeChange("js")}
              >
                JS
              </button>
            </div>
          </div>

          {/* Sample queries */}
          {SAMPLE_QUERIES.length > 0 && (
            <div className="sample-queries">
              <button
                type="button"
                className="sample-queries-toggle"
                onClick={() => setShowSamples(!showSamples)}
              >
                <span>Try a sample query</span>
                <svg
                  className={`chevron${showSamples ? ' chevron--open' : ''}`}
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2,4 6,8 10,4" />
                </svg>
              </button>
              {showSamples && (
                <div className="sample-queries-list">
                  {SAMPLE_QUERIES.map((query, index) => (
                    <button
                      key={query}
                      type="button"
                      className={`sample-query-button${activeSampleQuery === query ? " sample-query-button--active" : ""}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => handleSampleQueryClick(query)}
                      disabled={searchDisabled}
                      data-testid={`sample-query-${index}`}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Speed badge — prominent standalone */}
      {queryMetrics && queryMetrics.status === "fulfilled" ? (
        <div className={`speed-badge-hero ${getSpeedBadgeClass(queryMetrics.timeTakenInMs)}`}>
          <span className="speed-badge-dot" />
          <span className="speed-badge-value">{Math.round(queryMetrics.timeTakenInMs)}ms</span>
          <span className="speed-badge-label">query time</span>
        </div>
      ) : indexState.loaded && !queryMetrics ? (
        <div className="speed-badge-hero speed-badge--green">
          <span className="speed-badge-dot" />
          <span className="speed-badge-value">&lt; 10ms</span>
          <span className="speed-badge-label">typical query time</span>
        </div>
      ) : null}

      {/* Main content */}
      <div className="content-area">
        {/* Skeleton loading state */}
        {indexState.loading && !indexState.loaded && !indexState.error && (
          <>
            <p className="search-status">
            {searchMode === "python" ? "Connecting to Python backend..." : "Loading the on-device index..."}
          </p>
            <div className="skeleton-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton-card" />
              ))}
            </div>
          </>
        )}

        {/* Index error */}
        {indexState.error && (
          <div className="index-error">
            <p className="index-error-message">
              Something went wrong loading the search index.
            </p>
            <details className="error-details">
              <summary>Technical details</summary>
              <pre>{indexState.error}</pre>
            </details>
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
        {isSearching && <p className="search-status">Searching...</p>}
        {emptyState && <p className="search-status">No images match that description. Clear search or try a sample query above.</p>}

        {/* Welcome state */}
        {!hasQuery && !isSearching && indexState.loaded && !indexState.error && (
          <div className="welcome-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3>Search for anything</h3>
            <p>Describe what you're looking for in natural language</p>
          </div>
        )}

        {/* Query error */}
        {queryMetrics && queryMetrics.status === "rejected" && queryMetrics.errorMessage && (
          <div className="index-error">
            <p className="index-error-message">
              Something went wrong with the search query.
            </p>
            <details className="error-details">
              <summary>Technical details</summary>
              <pre>{queryMetrics.errorMessage}</pre>
            </details>
          </div>
        )}

        {/* Results */}
        {hasQuery && galleryItems.length > 0 && (
          <div className="results-header">
            <h2>Results</h2>
            <span className="results-count">{galleryItems.length} images</span>
          </div>
        )}

        <div className="masonry-grid">
          {galleryItems.map((item) => (
            <MasonryCard key={item.id} item={item} onSelect={setLightboxItem} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} <a href="https://usemoss.com" target="_blank" rel="noopener noreferrer">Moss</a>. All rights reserved.</p>
      </footer>

      {/* Lightbox */}
      {lightboxItem && (
        <Lightbox
          item={lightboxItem}
          onClose={() => setLightboxItem(null)}
          onFindSimilar={handleLightboxFindSimilar}
        />
      )}
    </div>
  );
};

export default ImageSearchPage;

const MasonryCard = ({ item, onSelect }: { readonly item: GalleryItem; readonly onSelect: (item: GalleryItem) => void }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const firstCaption = item.caption.split(" | ")[0] ?? item.caption;

  return (
    <div
      className="masonry-card"
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(item); }}
      data-testid="image-card"
    >
      <img
        src={item.url}
        alt={firstCaption}
        loading="lazy"
        onError={() => setIsVisible(false)}
      />
      <div className="card-overlay">
        <p className="card-overlay-text">{firstCaption}</p>
      </div>
    </div>
  );
};
