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
    { value: "123k", label: "123K images", docCount: "123,000" },
];

const TOP_K = 5;

const mossClient = new MossClient(
    import.meta.env.VITE_MOSS_PROJECT_ID,
    import.meta.env.VITE_MOSS_PROJECT_KEY
);
const baseIndexName: string = import.meta.env.VITE_MOSS_INDEX_NAME;

let currentTier = "1k";
let isIndexLoaded = false;
let indexLoadPromise: Promise<void> | null = null;
let indexLoadError: Error | null = null;

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
        indexLoadPromise = mossClient
            .loadIndex(indexName)
            .then(() => {
                isIndexLoaded = true;
                indexLoadError = null;
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
export const searchImages = async (term: string): Promise<SearchImagesResponse> => {
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
            TOP_K
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
