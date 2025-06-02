/**
 * Example of using lossless conversion with Cambria
 *
 * This example demonstrates how to use the lossless conversion functionality
 * to preserve the source of transformed documents using JSON-LD @reverse links.
 */

import {
  loadYamlLens,
  applyLosslessLensToDoc,
  addReverseLinks,
  extractSourceUrl,
  createDocumentFetcher,
} from '../src'

// Example lens for converting between formats
const exampleLens = `
schemaName: Person
lens:
  - rename:
      source: name
      destination: "schema:name"
  - rename:
      source: email
      destination: "schema:email"
  - rename:
      source: url
      destination: "schema:url"
`

// Example document in source format
const sourceDoc = {
  name: 'John Doe',
  email: 'john@example.com',
  url: 'https://example.com/john',
  bio: 'Software developer',
}

// Example document in target format with @reverse links
const targetDocWithReverseLinks = {
  'schema:name': 'John Doe',
  'schema:email': 'john@example.com',
  'schema:url': 'https://example.com/john',
  '@id': 'https://example.com/profiles/john',
  '@reverse': {
    'schema:isBasedOn': {
      '@id': 'https://example.com/source/john.json',
    },
  },
  profile_source: 'https://example.com/source/john.json',
}

async function runExample() {
  console.log('Lossless Conversion Example')
  console.log('==========================')

  // Load the lens
  const lens = loadYamlLens(exampleLens)
  console.log('\nLoaded lens:')
  console.log(lens)

  // Example 1: Convert source document to target format with @reverse links
  console.log('\nExample 1: Convert source document to target format with @reverse links')
  const convertedDoc = await applyLosslessLensToDoc(lens, sourceDoc)

  // Add @reverse links to track the source
  const docWithReverseLinks = addReverseLinks(convertedDoc, {
    targetId: 'https://example.com/profiles/john',
    sourceId: 'https://example.com/source/john.json',
  })

  console.log('\nSource document:')
  console.log(sourceDoc)

  console.log('\nConverted document with @reverse links:')
  console.log(docWithReverseLinks)

  // Example 2: Extract source URL from document with @reverse links
  console.log('\nExample 2: Extract source URL from document with @reverse links')
  const sourceUrl = extractSourceUrl(targetDocWithReverseLinks)
  console.log(`\nExtracted source URL: ${sourceUrl}`)

  // Example 3: Lossless round-trip conversion
  console.log('\nExample 3: Lossless round-trip conversion')

  // Mock fetch function that returns the original document
  const mockFetch = async (url: string) => {
    console.log(`Fetching document from: ${url}`)
    // In a real application, this would fetch the document from the URL
    // For this example, we'll just return the source document
    return sourceDoc
  }

  // Create a document fetcher using the mock fetch function
  const fetchDocument = createDocumentFetcher(mockFetch as any)

  // Convert back to the original format using the @reverse link
  const reverseLens = lens.slice().reverse()
  const roundTripDoc = await applyLosslessLensToDoc(reverseLens, targetDocWithReverseLinks, {
    fetchDocument,
  })

  console.log('\nTarget document with @reverse links:')
  console.log(targetDocWithReverseLinks)

  console.log('\nRound-trip converted document:')
  console.log(roundTripDoc)

  console.log('\nOriginal source document:')
  console.log(sourceDoc)

  console.log(
    '\nRound-trip successful:',
    JSON.stringify(roundTripDoc) === JSON.stringify(sourceDoc)
  )
}

// Run the example
runExample().catch(console.error)
