/**
 * Simple Moss SDK Load Index and Query Sample
 * 
 * This sample shows how to load an existing FAQ index and perform search queries.
 * Includes sample returns-related questions for demonstration.
 * 
 * Required Environment Variables:
 * - MOSS_PROJECT_ID: Your Moss project ID  
 * - MOSS_PROJECT_KEY: Your Moss project key
 * - MOSS_INDEX_NAME: Name of existing FAQ index to query
 */

import { MossClient } from "@inferedge/moss";
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Simple sample showing how to load an existing index and perform queries.
 */
async function loadAndQuerySample(): Promise<void> {
  console.log('Moss SDK - Load Index & Query Sample');

  // Load configuration from environment variables
  const projectId = process.env.MOSS_PROJECT_ID;
  const projectKey = process.env.MOSS_PROJECT_KEY;
  const indexName = process.env.MOSS_INDEX_NAME;

  // Validate required environment variables
  if (!projectId || !projectKey || !indexName) {
    console.error('Error: Missing required environment variables!');
    console.error('Please set MOSS_PROJECT_ID, MOSS_PROJECT_KEY, and MOSS_INDEX_NAME in .env file');
    return;
  }

  console.log(`Using index: ${indexName}`);

  // Initialize Moss client
  const client = new MossClient(projectId, projectKey);

  try {
    // Load the index for querying
    console.log(`\nLoading index...`);
    await client.loadIndex(indexName);
    console.log(`Index loaded successfully`);

  // Perform sample search
  console.log(`\nPerforming sample search...`);

  /**
   * Sample queries:
   * - crowd dancing at a wedding reception
   * - close-up of a woman in a leather jacket holding a stuffed animal
   * - nighttime Chinatown street glowing with lanterns
   * - moss-covered boulders along a forest river
   * - vintage green steam locomotive in motion
   * - small white dog wearing a ushanka hat indoors
   * - cozy wood-paneled bedroom with fireplace and quilt
   * - bar cart stocked with vodka, whiskey, and tonic bottles
   * - cartoon witch in blue standing against a full moon
   * - dressage rider on a grey horse during competition
   * - coastal harbor town with boats and palm trees
   * - watercolor coronavirus illustration with teal spikes
   */
  const query = "coastal harbor town with boats and palm trees";
    const searchResults = await client.query(indexName, query, 10);
    
    console.log(`Search results for query: "${query}"`);
    console.log(`Time taken: ${searchResults.timeTakenInMs} ms`);
    console.log(searchResults.docs);

    console.log(`\nSample completed successfully!`);
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  loadAndQuerySample().catch(console.error);
}