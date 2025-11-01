/**
 * @requires @inferedge/moss ^1.0.0-beta.1
 * @requires dotenv ^17.2.3
 * @requires node >=16.0.0
 */

import { MossClient, DocumentInfo } from "@inferedge/moss";
import imageDocuments from "../image-data-1k.json";
import { config } from 'dotenv';

// Load environment variables
config();

async function createIndexExample(): Promise<void> {
  // Initialize client with project credentials from environment
  const projectId = process.env.MOSS_PROJECT_ID;
  const projectKey = process.env.MOSS_PROJECT_KEY;
  const indexName = process.env.MOSS_INDEX_NAME;

  if (!projectId || !projectKey || !indexName) {
    console.error('Error: Missing environment variables!');
    console.error('Please set MOSS_PROJECT_ID, MOSS_PROJECT_KEY, and MOSS_INDEX_NAME in .env file');
    console.error('Copy .env.example to .env and fill in your credentials');
    return;
  }

  const client = new MossClient(projectId, projectKey);

  const docs = imageDocuments as DocumentInfo[];
  console.log(`Loaded ${docs.length} documents from dataset`);

  await client.createIndex(indexName, docs, "moss-minilm");
  console.log(`Index "${indexName}" created successfully with ${docs.length} documents.`);
}

// Run the example if this file is executed directly
if (require.main === module) {
  createIndexExample().catch(console.error);
}