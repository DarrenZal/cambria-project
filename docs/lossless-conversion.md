# Lossless Conversion with Cambria

Cambria now supports lossless round-trip conversion using JSON-LD `@reverse` links. This feature allows you to track the source of transformed documents and fetch the original document when converting back, ensuring no data is lost in the transformation process.

## Overview

When converting between different schema formats, some information may be lost due to differences in the schemas. For example, when converting from a rich schema to a simpler one, fields that don't exist in the target schema are typically dropped.

The lossless conversion approach solves this problem by:

1. Adding JSON-LD `@reverse` links to the transformed document to track its source
2. When converting back, fetching the original document using the `@reverse` link
3. Providing a fallback mechanism when the original document can't be fetched

## Key Features

- **JSON-LD Compatible**: Uses standard JSON-LD `@reverse` links to track the source of transformed documents
- **Backward Compatible**: Maintains a `profile_source` field for backward compatibility with existing systems
- **Robust Fallback**: Falls back to lens transformation when the original document can't be fetched
- **Flexible Configuration**: Configurable options for adding `@reverse` links and fetching documents

## API Reference

### `addReverseLinks(doc, options)`

Adds `@reverse` links to a document to track its source.

```typescript
import { addReverseLinks } from 'cambria'

const docWithReverseLinks = addReverseLinks(convertedDoc, {
  targetId: 'https://example.com/profiles/john',
  sourceId: 'https://example.com/source/john.json',
})
```

#### Options

- `targetId` (optional): The ID to use for the transformed document
- `sourceId` (required): The ID of the source document
- `predicate` (optional): The relationship predicate to use (default: 'schema:isBasedOn')
- `addProfileSource` (optional): Whether to add a profile_source field for backward compatibility (default: true)

### `extractSourceUrl(doc, predicate)`

Extracts the source document URL from a document with `@reverse` links.

```typescript
import { extractSourceUrl } from 'cambria'

const sourceUrl = extractSourceUrl(docWithReverseLinks)
```

#### Parameters

- `doc` (required): The document to extract the source URL from
- `predicate` (optional): The relationship predicate to look for (default: 'schema:isBasedOn')

### `applyLosslessLensToDoc(lensSource, inputDoc, options)`

Applies a lens to a document with lossless conversion support.

```typescript
import { applyLosslessLensToDoc, createDocumentFetcher } from 'cambria'

// Create a document fetcher
const fetchDocument = createDocumentFetcher()

// Apply the lens with lossless conversion
const result = await applyLosslessLensToDoc(lens, inputDoc, {
  fetchDocument,
})
```

#### Options

- `fetchDocument` (optional): Function to fetch a document by URL
- `addReverseLinks` (optional): Whether to add `@reverse` links when converting (default: true)
- `predicate` (optional): The relationship predicate to use (default: 'schema:isBasedOn')
- `addProfileSource` (optional): Whether to add a profile_source field for backward compatibility (default: true)

### `createDocumentFetcher(fetchFn)`

Creates a fetch function for use with `applyLosslessLensToDoc`.

```typescript
import { createDocumentFetcher } from 'cambria'

// Create a document fetcher using the global fetch function
const fetchDocument = createDocumentFetcher()

// Create a document fetcher using a custom fetch function
const fetchDocument = createDocumentFetcher(customFetch)
```

#### Parameters

- `fetchFn` (optional): The fetch function to use (defaults to global fetch)

## Example Usage

### Basic Example

```typescript
import {
  loadYamlLens,
  applyLosslessLensToDoc,
  addReverseLinks,
  createDocumentFetcher,
} from 'cambria'

// Load the lens
const lens = loadYamlLens(lensYaml)

// Create a document fetcher
const fetchDocument = createDocumentFetcher()

// Convert source document to target format with @reverse links
const convertedDoc = await applyLosslessLensToDoc(lens, sourceDoc)

// Add @reverse links to track the source
const docWithReverseLinks = addReverseLinks(convertedDoc, {
  targetId: 'https://example.com/profiles/john',
  sourceId: 'https://example.com/source/john.json',
})

// Convert back to the original format using the @reverse link
const reverseLens = lens.slice().reverse()
const roundTripDoc = await applyLosslessLensToDoc(reverseLens, docWithReverseLinks, {
  fetchDocument,
})
```

### Complete Example

See the [lossless-conversion.ts](../examples/lossless-conversion.ts) example for a complete demonstration of lossless conversion.

## JSON-LD Structure

The `@reverse` link is added to the transformed document using the following structure:

```json
{
  "schema:name": "John Doe",
  "schema:email": "john@example.com",
  "@id": "https://example.com/profiles/john",
  "@reverse": {
    "schema:isBasedOn": {
      "@id": "https://example.com/source/john.json"
    }
  },
  "profile_source": "https://example.com/source/john.json"
}
```

This structure follows JSON-LD conventions for expressing reverse relationships between resources.

## Benefits

- **Truly Lossless**: No data is lost in the round-trip conversion
- **Standards-Based**: Uses JSON-LD and semantic web best practices
- **Backward Compatible**: Maintains compatibility with existing systems
- **Robust**: Falls back to lens transformation when needed
- **Flexible**: Configurable options for different use cases
