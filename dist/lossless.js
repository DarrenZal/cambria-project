"use strict";
/**
 * Lossless conversion functionality for Cambria
 *
 * This module provides functions for lossless round-trip conversion using JSON-LD @reverse links.
 * It allows tracking the source of transformed documents and fetching the original document when converting back.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocumentFetcher = exports.applyLosslessLensToDoc = exports.extractSourceUrl = exports.addReverseLinks = void 0;
const doc_1 = require("./doc");
/**
 * Add @reverse links to a document to track its source
 *
 * @param doc The document to add @reverse links to
 * @param options Options for adding @reverse links
 * @returns The document with @reverse links added
 */
function addReverseLinks(doc, options) {
    const result = Object.assign({}, doc);
    const predicate = options.predicate || 'schema:isBasedOn';
    // Add @id if provided
    if (options.targetId) {
        result['@id'] = options.targetId;
    }
    // Add @reverse link
    result['@reverse'] = {
        [predicate]: {
            '@id': options.sourceId,
        },
    };
    // Add profile_source for backward compatibility
    if (options.addProfileSource !== false) {
        result['profile_source'] = options.sourceId;
    }
    return result;
}
exports.addReverseLinks = addReverseLinks;
/**
 * Extract the source document URL from a document with @reverse links
 *
 * @param doc The document to extract the source URL from
 * @param predicate The relationship predicate to look for (default: 'schema:isBasedOn')
 * @returns The source URL or null if not found
 */
function extractSourceUrl(doc, predicate = 'schema:isBasedOn') {
    // First check for @reverse link (preferred method)
    if (doc['@reverse'] && doc['@reverse'][predicate] && doc['@reverse'][predicate]['@id']) {
        return doc['@reverse'][predicate]['@id'];
    }
    // Fall back to profile_source field (backward compatibility)
    if (doc.profile_source) {
        return doc.profile_source;
    }
    return null;
}
exports.extractSourceUrl = extractSourceUrl;
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
function applyLosslessLensToDoc(lensSource, inputDoc, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check if the input document has @reverse links
        const sourceUrl = extractSourceUrl(inputDoc, options.predicate);
        if (sourceUrl && options.fetchDocument) {
            try {
                // Attempt to fetch the original document
                const originalDoc = yield options.fetchDocument(sourceUrl);
                if (originalDoc) {
                    return originalDoc;
                }
            }
            catch (error) {
                console.warn(`Failed to fetch original document from ${sourceUrl}:`, error);
                console.warn('Falling back to lens transformation');
            }
        }
        // Apply the lens transformation
        console.log('applyLosslessLensToDoc - inputDoc:', JSON.stringify(inputDoc, null, 2));
        console.log('applyLosslessLensToDoc - options:', JSON.stringify(options, null, 2));
        // Extract inputSchema from options if provided
        const inputSchema = options.inputSchema;
        console.log('applyLosslessLensToDoc - inputSchema:', inputSchema ? 'provided' : 'not provided');
        // Debug lens source
        console.log('applyLosslessLensToDoc - lensSource:', JSON.stringify(lensSource, null, 2));
        try {
            console.log('Calling applyLensToDoc...');
            let result = doc_1.applyLensToDoc(lensSource, inputDoc, inputSchema);
            console.log('applyLensToDoc result:', JSON.stringify(result, null, 2));
            // Add @reverse links if requested
            if (options.addReverseLinks !== false && sourceUrl) {
                result = addReverseLinks(result, {
                    sourceId: sourceUrl,
                    predicate: options.predicate,
                    addProfileSource: options.addProfileSource,
                });
            }
            return result;
        }
        catch (error) {
            console.error('Error in applyLensToDoc:', error);
            throw error;
        }
    });
}
exports.applyLosslessLensToDoc = applyLosslessLensToDoc;
/**
 * Create a fetch function for use with applyLosslessLensToDoc
 *
 * @param fetchFn The fetch function to use (defaults to global fetch)
 * @returns A function that fetches a document by URL
 */
function createDocumentFetcher(fetchFn = fetch) {
    return (url) => __awaiter(this, void 0, void 0, function* () {
        const response = yield fetchFn(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
        }
        return yield response.json();
    });
}
exports.createDocumentFetcher = createDocumentFetcher;
//# sourceMappingURL=lossless.js.map