/**
 * Lossless conversion functionality for Cambria
 *
 * This module provides functions for lossless round-trip conversion using JSON-LD @reverse links.
 * It allows tracking the source of transformed documents and fetching the original document when converting back.
 */
import { LensSource } from './lens-ops';
/**
 * Options for adding @reverse links to a document
 */
export interface ReverseLinksOptions {
    /** The ID to use for the transformed document */
    targetId?: string;
    /** The ID of the source document */
    sourceId: string;
    /** The relationship predicate to use (default: 'schema:isBasedOn') */
    predicate?: string;
    /** Whether to add a profile_source field for backward compatibility (default: true) */
    addProfileSource?: boolean;
}
/**
 * Options for lossless conversion
 */
export interface LosslessConversionOptions {
    /** Function to fetch a document by URL */
    fetchDocument?: (url: string) => Promise<any>;
    /** Whether to add @reverse links when converting (default: true) */
    addReverseLinks?: boolean;
    /** The relationship predicate to use (default: 'schema:isBasedOn') */
    predicate?: string;
    /** Whether to add a profile_source field for backward compatibility (default: true) */
    addProfileSource?: boolean;
    /** JSON schema for the input document */
    inputSchema?: any;
}
/**
 * Add @reverse links to a document to track its source
 *
 * @param doc The document to add @reverse links to
 * @param options Options for adding @reverse links
 * @returns The document with @reverse links added
 */
export declare function addReverseLinks(doc: any, options: ReverseLinksOptions): any;
/**
 * Extract the source document URL from a document with @reverse links
 *
 * @param doc The document to extract the source URL from
 * @param predicate The relationship predicate to look for (default: 'schema:isBasedOn')
 * @returns The source URL or null if not found
 */
export declare function extractSourceUrl(doc: any, predicate?: string): string | null;
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
export declare function applyLosslessLensToDoc(lensSource: LensSource, inputDoc: any, options?: LosslessConversionOptions): Promise<any>;
/**
 * Create a fetch function for use with applyLosslessLensToDoc
 *
 * @param fetchFn The fetch function to use (defaults to global fetch)
 * @returns A function that fetches a document by URL
 */
export declare function createDocumentFetcher(fetchFn?: typeof fetch): (url: string) => Promise<any>;
