# Lossless Conversion with Cambria

Cambria supports lossless round-trip conversion using `source_url` fields. This feature allows you to track the source of transformed documents and enables bidirectional transformation chains, ensuring no data is lost in the transformation process.

## Overview

When converting between different schema formats, some information may be lost due to differences in the schemas. For example, when converting from a rich schema to a simpler one, fields that don't exist in the target schema are typically dropped.

The lossless conversion approach solves this problem by:

1. Adding `source_url` fields to the transformed document to track its source
2. Using pure Cambria lens operations for all transformations 
3. Enabling schema transformation chains with bidirectional conversion

## Key Features

- **Pure Cambria Operations**: Uses declarative lens operations for all transformations without custom JavaScript
- **Source Tracking**: Maintains `source_url` fields to track transformation origins
- **Bidirectional**: Supports forward and reverse transformation chains
- **Enhanced Operations**: Includes new `optionalRename` operation for robust field transformations
- **Advanced Array Transformations**: Enhanced `in` and `map` operations for complex array element transformations
- **Comprehensive Field Operations**: Support for field renaming, addition, and removal within array elements

## API Reference

### `applyLensToDoc(lensSource, inputDoc, inputSchema, targetDoc)`

Applies a lens to a document using pure Cambria operations.

```typescript
import { loadYamlLens, applyLensToDoc } from 'cambria'

// Load the lens from YAML
const lens = loadYamlLens(lensYaml)

// Apply the lens to transform the document
const result = applyLensToDoc(lens, inputDoc, inputSchema, targetDoc)
```

#### Parameters

- `lensSource` (required): The lens specification to apply
- `inputDoc` (required): The document to transform
- `inputSchema` (optional): JSON schema for the input document (inferred if not provided)
- `targetDoc` (optional): Target document to merge results into (defaults to empty object)

### `optionalRename` Operation

New lens operation that safely renames fields without failing when the source doesn't exist.

```yaml
# In your lens.yml file
lens:
  - optionalRename:
      source: "@id"
      destination: "source_url"
  - optionalRename:
      source: "currentTitle"
      destination: "current_title"
```

#### Properties

- `source` (required): The field name to rename from
- `destination` (required): The field name to rename to

## Example Usage

### Basic Transformation

```typescript
import { loadYamlLens, applyLensToDoc } from 'cambria'

// Load the lens from YAML
const lensYaml = `
schemaName: Person
lens:
  - optionalRename:
      source: "@id"
      destination: "source_url"
  - optionalRename:
      source: "currentTitle"
      destination: "current_title"
  - remove:
      property: "@type"
`

const lens = loadYamlLens(lensYaml)

// Transform the document
const unifiedProfile = {
  "@id": "https://example.com/profiles/john.jsonld",
  "@type": "Person",
  "name": "John Doe",
  "currentTitle": "Software Engineer"
}

const murmurationsProfile = applyLensToDoc(lens, unifiedProfile)
```

### Complete Conversion Chain

```javascript
const { loadYamlLens, applyLensToDoc } = require('cambria')
const fs = require('fs')

// Load transformation lens
const lensContent = fs.readFileSync('unified-to-murmurations-person.lens.yml', 'utf8')
const lens = loadYamlLens(lensContent)

// Convert unified profile to Murmurations format
const unifiedProfile = JSON.parse(fs.readFileSync('unified-profile.jsonld', 'utf8'))
const murmurationsProfile = applyLensToDoc(lens, unifiedProfile)

// The result includes source_url for traceability
console.log(murmurationsProfile.source_url) // Original unified profile URL
```

## Transformation Structure

The transformed document maintains a `source_url` field to track its origin:

```json
{
  "name": "John Doe",
  "current_title": "Software Engineer",
  "source_url": "https://example.com/profiles/john.jsonld",
  "@context": {
    "@version": 1.1,
    "@vocab": "https://schema.org/",
    "schema": "https://schema.org/",
    "murm": "https://murmurations.network/schemas/",
    "regen": "https://darrenzal.github.io/RegenMapping/ontology/"
  }
}
```

### Advanced Array Transformations

The enhanced Cambria engine now supports complex array transformations with field-level operations:

```yaml
# Transform array elements with field renaming, addition, and removal
lens:
  - in:
      name: "relationships"
      lens:
        - map:
            lens:
              - rename:
                  source: "target_url"
                  destination: "object_url"
              - add:
                  name: "predicate_url"
                  type: "string"
                  default: "https://schema.org/knows"
              - remove:
                  name: "type"
              - remove:
                  name: "description"
```

This transforms each object in the `relationships` array:

```javascript
// Input
{
  "relationships": [
    {
      "target_url": "https://example.com",
      "type": "collaboration",
      "description": "Working together"
    }
  ]
}

// Output after transformation
{
  "relationships": [
    {
      "object_url": "https://example.com",
      "predicate_url": "https://schema.org/knows"
    }
  ]
}
```

## Benefits

- **Pure Declarative**: All transformations use Cambria lens operations without custom JavaScript
- **Robust Error Handling**: `optionalRename` operations don't fail when source fields are missing
- **Source Traceability**: `source_url` field enables bidirectional transformation chains
- **Schema Agnostic**: Works with any JSON schema format
- **Maintainable**: Clear YAML lens definitions that are easy to read and modify
- **Array Support**: Complete transformation of array elements with field-level operations
- **Lossless Conversion**: No external post-processing required for complex schema transformations
