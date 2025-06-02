/**
 * Lossless conversion functionality for Cambria
 *
 * This module provides functions for lossless round-trip conversion using JSON-LD @reverse links.
 * It allows tracking the source of transformed documents and fetching the original document when converting back.
 */

import { LensSource } from './lens-ops'
import { applyLensToDoc } from './doc'

/**
 * Options for adding @reverse links to a document
 */
export interface ReverseLinksOptions {
  /** The ID to use for the transformed document */
  targetId?: string
  /** The ID of the source document */
  sourceId: string
  /** The relationship predicate to use (default: 'schema:isBasedOn') */
  predicate?: string
  /** Whether to add a profile_source field for backward compatibility (default: true) */
  addProfileSource?: boolean
}

/**
 * Options for lossless conversion
 */
export interface LosslessConversionOptions {
  /** Function to fetch a document by URL */
  fetchDocument?: (url: string) => Promise<any>
  /** Whether to add @reverse links when converting (default: true) */
  addReverseLinks?: boolean
  /** The relationship predicate to use (default: 'schema:isBasedOn') */
  predicate?: string
  /** Whether to add a profile_source field for backward compatibility (default: true) */
  addProfileSource?: boolean
}

/**
 * Add @reverse links to a document to track its source
 *
 * @param doc The document to add @reverse links to
 * @param options Options for adding @reverse links
 * @returns The document with @reverse links added
 */
export function addReverseLinks(doc: any, options: ReverseLinksOptions): any {
  const result = { ...doc }
  const predicate = options.predicate || 'schema:isBasedOn'

  // Add @id if provided
  if (options.targetId) {
    result['@id'] = options.targetId
  }

  // Add @reverse link
  result['@reverse'] = {
    [predicate]: {
      '@id': options.sourceId,
    },
  }

  // Add profile_source for backward compatibility
  if (options.addProfileSource !== false) {
    result['profile_source'] = options.sourceId
  }

  return result
}

/**
 * Extract the source document URL from a document with @reverse links
 *
 * @param doc The document to extract the source URL from
 * @param predicate The relationship predicate to look for (default: 'schema:isBasedOn')
 * @returns The source URL or null if not found
 */
export function extractSourceUrl(doc: any, predicate = 'schema:isBasedOn'): string | null {
  // First check for @reverse link (preferred method)
  if (doc['@reverse'] && doc['@reverse'][predicate] && doc['@reverse'][predicate]['@id']) {
    return doc['@reverse'][predicate]['@id']
  }

  // Fall back to profile_source field (backward compatibility)
  if (doc.profile_source) {
    return doc.profile_source
  }

  return null
}

/**
 * Apply a lens to a document with lossless conversion support
 *
 * This function extends applyLensToDoc with support for lossless conversion using @reverse links.
 * When converting from a document with @reverse links, it will attempt to fetch the original document.
 *
 * @param lensSource The lens to apply
 * @param inputDoc The input document
 * @param options Options for lossless conversion
 * @returns The transformed document
 */
export async function applyLosslessLensToDoc(
  lensSource: LensSource,
  inputDoc: any,
  options: LosslessConversionOptions = {}
): Promise<any> {
  // Check if the input document has @reverse links
  const sourceUrl = extractSourceUrl(inputDoc, options.predicate)

  if (sourceUrl && options.fetchDocument) {
    try {
      // Attempt to fetch the original document
      const originalDoc = await options.fetchDocument(sourceUrl)
      if (originalDoc) {
        return originalDoc
      }
    } catch (error) {
      console.warn(`Failed to fetch original document from ${sourceUrl}:`, error)
      console.warn('Falling back to lens transformation')
    }
  }

  // Apply the lens transformation
  const result = applyLensToDoc(lensSource, inputDoc)

  // Add @reverse links if requested
  if (options.addReverseLinks !== false && sourceUrl) {
    return addReverseLinks(result, {
      sourceId: sourceUrl,
      predicate: options.predicate,
      addProfileSource: options.addProfileSource,
    })
  }

  return result
}

/**
 * Create a fetch function for use with applyLosslessLensToDoc
 *
 * @param fetchFn The fetch function to use (defaults to global fetch)
 * @returns A function that fetches a document by URL
 */
export function createDocumentFetcher(fetchFn = fetch): (url: string) => Promise<any> {
  return async (url: string) => {
    const response = await fetchFn(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`)
    }
    return await response.json()
  }
}
