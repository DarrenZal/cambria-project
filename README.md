# Cambria

Cambria is a Javascript/Typescript library for converting JSON data between related schemas.

You specify (in YAML or JSON) a _lens_, which specifies a data transformation. Cambria lets you use this lens to convert:

- a whole document, in JSON
- an edit to a document, in [JSON Patch](http://jsonpatch.com/)
- a schema description, in [JSON Schema](https://json-schema.org/)

Lenses are bidirectional. Once you've converted a document from schema A to schema B, you can edit the document in schema B and propagate those edits _backwards through the same lens_ to schema A.

**For more background on why Cambria exists and what it can do, see the [research essay](https://www.inkandswitch.com/cambria.html).**

⚠ Cambria is still immature software, and isn't yet ready for production use

## Use cases

- Manage backwards compatibility in a JSON API
- Manage database migrations for JSON data
- Transform a JSON document into a different shape on the command line
- Combine with [cambria-automerge](https://github.com/inkandswitch/cambria-automerge) to collaborate on documents across multiple versions of [local-first software](https://www.inkandswitch.com/local-first.html)
- Perform lossless round-trip conversion between different schema formats using JSON-LD @reverse links

## CLI Usage

Cambria includes a simple CLI tool for converting JSON from the command line.

(You'll want to run `yarn build` to compile the latest code.)

Covert the github issue into a an arthropod-style issue:

`cat ./demo/github-issue.json | node ./dist/cli.js -l ./demo/github-arthropod.lens.yml`

To get a live updating pipeline using `entr`:

`echo ./demo/github-arthropod.lens.yml | entr bash -c "cat ./demo/github-issue.json | node ./dist/cli.js -l ./demo/github-arthropod.lens.yml > ./demo/simple-issue.json"`

Compile back from an updated "simple issue" to a new github issue file:

`cat ./demo/simple-issue.json | node ./dist/cli.js -l ./demo/github-arthropod.lens.yml -r -b ./demo/github-issue.json`

Live updating pipeline backwards:

`echo ./demo/simple-issue.json | entr bash -c "cat ./demo/simple-issue.json | node ./dist/cli.js -l ./demo/github-arthropod.lens.yml -r -b ./demo/github-issue.json > ./demo/new-github-issue.json"`

## API Usage

Cambria is mostly intended to be used as a Typescript / Javascript library. Here's a simple example of converting an entire document.

```js
// read doc from stdin if no input specified
const input = readFileSync(program.input || 0, 'utf-8')
const doc = JSON.parse(input)

// we can (optionally) apply the contents of the changed document to a target document
const targetDoc = program.base ? JSON.parse(readFileSync(program.base, 'utf-8')) : {}

// now load a (yaml) lens definition
const lensData = readFileSync(program.lens, 'utf-8')
let lens = loadYamlLens(lensData)

// should we reverse this lens?
if (program.reverse) {
  lens = reverseLens(lens)
}

// finally, apply the lens to the document, with the schema, onto the target document!
const newDoc = applyLensToDoc(lens, doc, program.schema, targetDoc)
console.log(JSON.stringify(newDoc, null, 4))
```

## Enhanced Transformation Features

Cambria now includes enhanced transformation capabilities with robust error handling, source tracking, and advanced array transformation support:

- **optionalRename operation**: Safely rename fields without failing when source doesn't exist
- **Source tracking**: Maintain `source_url` fields for transformation traceability  
- **Pure declarative lenses**: All transformations use Cambria operations without custom JavaScript
- **Advanced array transformations**: Enhanced `in` and `map` operations for complex array element transformations
- **Lossless schema conversion**: Complete bidirectional transformation support without external post-processing

### Basic Field Transformations

```js
import { loadYamlLens, applyLensToDoc } from 'cambria'

// Load lens with enhanced operations
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

// Transform document with enhanced error handling
const transformedDoc = applyLensToDoc(lens, sourceDoc)

// Result includes source_url for traceability
console.log(transformedDoc.source_url) // Original document URL
```

### Advanced Array Transformations

```js
// Complex array element transformations with field renaming and addition
const arrayTransformLens = `
schemaName: PersonWithRelationships
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
`

// Transform arrays of objects with field mapping, addition, and removal
const result = applyLensToDoc(loadYamlLens(arrayTransformLens), sourceDoc)

// Each relationship object is transformed:
// { target_url: "...", type: "...", description: "..." }
// becomes:
// { object_url: "...", predicate_url: "https://schema.org/knows" }
```

For more details, see the [lossless conversion documentation](docs/lossless-conversion.md).

## Install

If you're using npm, run `npm install cambria`. If you're using yarn, run `yarn add cambria`. Then you can import it with `require('cambria')` as in the examples (or `import * as Cambria from 'cambria'` if using ES2015 or TypeScript).

## Tests

`npm run test`
