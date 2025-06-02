/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { JSONSchema7 } from 'json-schema'
import { compare, applyPatch } from 'fast-json-patch'
import toJSONSchema from 'to-json-schema'

import { defaultObjectForSchema } from './defaults'
import { Patch, applyLensToPatch } from './patch'
import { LensSource } from './lens-ops'
import { updateSchema } from './json-schema'

/**
 * importDoc - convert any Plain Old Javascript Object into an implied JSON Schema and
 *             a JSON Patch that sets every value in that document.
 * @param inputDoc a document to convert into a big JSON patch describing its full contents
 */
export function importDoc(inputDoc: any): [JSONSchema7, Patch] {
  // Always use our robust fallback schema generation instead of to-json-schema
  // to avoid array handling issues
  
  // Create a robust schema using our custom logic
  const schema: JSONSchema7 = {
    type: 'object',
    properties: {}
  }
  
  // Add basic property types based on the input document
  if (inputDoc && typeof inputDoc === 'object' && !Array.isArray(inputDoc)) {
    Object.keys(inputDoc).forEach(key => {
      const value = inputDoc[key]
      let type: any = 'string' // default type
      
      if (typeof value === 'number') {
        type = 'number'
      } else if (typeof value === 'boolean') {
        type = 'boolean'
      } else if (Array.isArray(value)) {
        // Handle arrays with proper item type inference
        let itemType = 'string' // default
        if (value.length > 0) {
          const firstItem = value[0]
          if (typeof firstItem === 'string') {
            itemType = 'string'
          } else if (typeof firstItem === 'number') {
            itemType = 'number'
          } else if (typeof firstItem === 'boolean') {
            itemType = 'boolean'
          } else if (Array.isArray(firstItem)) {
            itemType = 'array'
          } else if (firstItem && typeof firstItem === 'object') {
            itemType = 'object'
          }
        }
        
        schema.properties![key] = { 
          type: ['array', 'null'],
          items: { type: [itemType as any, 'null'] }
        }
        return // Skip the default assignment below
      } else if (value === null) {
        type = 'null'
      } else if (typeof value === 'object') {
        type = 'object'
      }
      
      schema.properties![key] = { type: [type, 'null'] }
    })
  }
  
  const patch = compare({}, inputDoc)
  
  return [schema, patch]
}

/**
 * applyLensToDoc - converts a full document through a lens.
 * Under the hood, we convert your input doc into a big patch and the apply it to the targetDoc.
 * This allows merging data back and forth with other omitted values.
 * @property lensSource: the lens specification to apply to the document
 * @property inputDoc: the Plain Old Javascript Object to convert
 * @property inputSchema: (default: inferred from inputDoc) a JSON schema defining the input
 * @property targetDoc: (default: {}) a document to apply the contents of this document to as a patch
 */
export function applyLensToDoc(
  lensSource: LensSource,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  inputDoc: any,
  inputSchema?: JSONSchema7,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  targetDoc?: any
): any {
  const [impliedSchema, patchForOriginalDoc] = importDoc(inputDoc)

  if (inputSchema === undefined || inputSchema === null) {
    inputSchema = impliedSchema
  }

  // construct the "base" upon which we will apply the patches from doc.
  // We start with the default object for the output schema,
  // then we add in any existing fields on the target doc.
  // TODO: I think we need to deep merge here, can't just shallow merge?
  const outputSchema = updateSchema(inputSchema, lensSource)
  const base = Object.assign(defaultObjectForSchema(outputSchema), targetDoc || {})

  // return a doc based on the converted patch.
  // (start with either a specified baseDoc, or just empty doc)
  // convert the patch through the lens
  const outputPatch = applyLensToPatch(lensSource, patchForOriginalDoc, inputSchema)
  const result = applyPatch(base, outputPatch).newDocument
  
  return result
}

