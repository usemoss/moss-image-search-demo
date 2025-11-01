import { MossClient, SearchResult, QueryResultDocumentInfo } from "@inferedge/moss";

export type SearchImagesResponse = {
    results: QueryResultDocumentInfo[];
    timeTakenInMs: number;
    status: "fulfilled" | "rejected";
    errorMessage?: string;
};

// Shared Moss client configured with the image index credentials.
const mossClient = new MossClient(
    import.meta.env.VITE_MOSS_PROJECT_ID,
    import.meta.env.VITE_MOSS_PROJECT_KEY
);
const indexName = import.meta.env.VITE_MOSS_INDEX_NAME;

let isIndexLoaded = false;
let indexLoadPromise: Promise<void> | null = null;
let indexLoadError: Error | null = null;

/**
 * Loads the Moss index into the client. Should run once at app start.
 */
export const initializeSearchIndex = (): Promise<void> => {
    if (isIndexLoaded) {
        return Promise.resolve();
    }

    if (!indexLoadPromise) {
        indexLoadError = null;
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

export const isSearchIndexLoaded = (): boolean => isIndexLoaded;

export const getSearchIndexLoadError = (): Error | null => indexLoadError;

/**
 * Executes a semantic search against the image index and returns
 * the Moss documents decorated with image metadata.
 * Queries are executed sequentially, and timing comes from the first query's timeTakenInMs.
 */
export const searchImages = async (term: string): Promise<SearchImagesResponse> => {
    await initializeSearchIndex();

    const trimmedTerm = term.trim();
    if (!trimmedTerm) {
        return { results: [], timeTakenInMs: 0, status: "fulfilled" };
    }

    const queryTerm = trimmedTerm.toLowerCase();

    try {
        const result: SearchResult = await mossClient.query(indexName, queryTerm);
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
