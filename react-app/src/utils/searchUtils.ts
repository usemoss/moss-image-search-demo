import { MossClient, SearchResult, QueryResultDocumentInfo } from "@inferedge/moss";

export interface SearchImagesResponse {
    readonly results: QueryResultDocumentInfo[];
    readonly timeTakenInMs: number;
    readonly status: "fulfilled" | "rejected";
    readonly errorMessage?: string;
}

export interface TierInfo {
    readonly value: string;
    readonly label: string;
    readonly docCount: string;
}

export const TIERS: readonly TierInfo[] = [
    { value: "1k", label: "1K images", docCount: "1,000" },
    { value: "10k", label: "10K images", docCount: "10,000" },
    { value: "50k", label: "50K images", docCount: "50,000" },
    { value: "100k", label: "100K images", docCount: "100,000" },
];

const TOP_K = 5;

const mossClient = new MossClient(
    import.meta.env.MOSS_PROJECT_ID,
    import.meta.env.MOSS_PROJECT_KEY
);
const baseIndexName: string = import.meta.env.MOSS_INDEX_NAME;

let currentTier = "1k";
let isIndexLoaded = false;
let indexLoadPromise: Promise<void> | null = null;
let indexLoadError: Error | null = null;
const clientLoadedIndexes = new Set<string>();

function getIndexName(tier: string): string {
    return `${baseIndexName}-${tier}`;
}

export const getCurrentTier = (): string => currentTier;

export const getCurrentTierInfo = (): TierInfo =>
    TIERS.find((t) => t.value === currentTier) ?? TIERS[0];

/**
 * Loads the Moss index for the current tier. Should run once at app start.
 */
export const initializeSearchIndex = (): Promise<void> => {
    if (isIndexLoaded) {
        return Promise.resolve();
    }

    if (!indexLoadPromise) {
        indexLoadError = null;
        const indexName = getIndexName(currentTier);

        if (clientLoadedIndexes.has(indexName)) {
            isIndexLoaded = true;
            return Promise.resolve();
        }

        indexLoadPromise = mossClient
            .loadIndex(indexName)
            .then(() => {
                isIndexLoaded = true;
                indexLoadError = null;
                clientLoadedIndexes.add(indexName);
            })
            .catch((error) => {
                isIndexLoaded = false;
                indexLoadError = error instanceof Error ? error : new Error(String(error));
                throw indexLoadError;
            })
            .finally(() => {
                indexLoadPromise = null;
            });
    }

    return indexLoadPromise;
};

/**
 * Switches to a different tier index. Resets load state and loads the new index.
 */
export const switchIndex = async (tier: string): Promise<void> => {
    if (tier === currentTier && isIndexLoaded) {
        return;
    }

    currentTier = tier;
    isIndexLoaded = false;
    indexLoadPromise = null;
    indexLoadError = null;

    await initializeSearchIndex();
};

export const isSearchIndexLoaded = (): boolean => isIndexLoaded;

export const getSearchIndexLoadError = (): Error | null => indexLoadError;

/**
 * Executes a hybrid search against the current tier's image index.
 */
const PYTHON_API_BASE = (import.meta.env.MOSS_PYTHON_API_URL as string | undefined) || "http://localhost:8000";
const JS_API_BASE = (import.meta.env.MOSS_JS_API_URL as string | undefined) || "http://localhost:8001";

export const searchImagesViaPythonApi = async (
    term: string,
    tier: string,
    topK = 5
): Promise<SearchImagesResponse> => {
    const trimmedTerm = term.trim();
    if (!trimmedTerm) {
        return { results: [], timeTakenInMs: 0, status: "fulfilled" };
    }

    try {
        const url = `${PYTHON_API_BASE}/search?query=${encodeURIComponent(trimmedTerm)}&tier=${encodeURIComponent(tier)}&top_k=${topK}`;
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        const data = (await response.json()) as { docs: QueryResultDocumentInfo[]; timeTakenInMs: number };
        const docs: QueryResultDocumentInfo[] = (data.docs ?? []).map((doc) => ({
            ...doc,
            metadata: doc.metadata ?? ({} as Record<string, string>),
        }));
        return { results: docs, timeTakenInMs: data.timeTakenInMs ?? 0, status: "fulfilled" };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Python API search failed:", errorMessage);
        return { results: [], timeTakenInMs: 0, status: "rejected", errorMessage };
    }
};

export const checkPythonApiHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${PYTHON_API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
};

export const searchImagesViaJsApi = async (
    term: string,
    tier: string,
    topK = 5
): Promise<SearchImagesResponse> => {
    const trimmedTerm = term.trim();
    if (!trimmedTerm) {
        return { results: [], timeTakenInMs: 0, status: "fulfilled" };
    }

    try {
        const url = `${JS_API_BASE}/search?query=${encodeURIComponent(trimmedTerm)}&tier=${encodeURIComponent(tier)}&top_k=${topK}`;
        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        const data = (await response.json()) as { docs: QueryResultDocumentInfo[]; timeTakenInMs: number };
        const docs: QueryResultDocumentInfo[] = (data.docs ?? []).map((doc) => ({
            ...doc,
            metadata: doc.metadata ?? ({} as Record<string, string>),
        }));
        return { results: docs, timeTakenInMs: data.timeTakenInMs ?? 0, status: "fulfilled" };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("JS API search failed:", errorMessage);
        return { results: [], timeTakenInMs: 0, status: "rejected", errorMessage };
    }
};

export const checkJsApiHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${JS_API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
};

export const searchImages = async (term: string, topK = TOP_K): Promise<SearchImagesResponse> => {
    await initializeSearchIndex();

    const trimmedTerm = term.trim();
    if (!trimmedTerm) {
        return { results: [], timeTakenInMs: 0, status: "fulfilled" };
    }

    const queryTerm = trimmedTerm.toLowerCase();
    const indexName = getIndexName(currentTier);

    try {
        const result: SearchResult = await mossClient.query(
            indexName,
            queryTerm,
            { topK }
        );
        const docs: QueryResultDocumentInfo[] = (result.docs ?? []).map((doc) => ({
            ...doc,
            metadata: doc.metadata ?? ({} as Record<string, string>),
        }));
        const durationMs = result.timeTakenInMs ?? 0;

        return {
            results: docs,
            timeTakenInMs: durationMs,
            status: "fulfilled",
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Image search failed:", errorMessage);

        return {
            results: [],
            timeTakenInMs: 0,
            status: "rejected",
            errorMessage,
        };
    }
};
