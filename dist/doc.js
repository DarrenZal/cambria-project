"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLensToDoc = exports.importDoc = void 0;
const fast_json_patch_1 = require("fast-json-patch");
const defaults_1 = require("./defaults");
const patch_1 = require("./patch");
const json_schema_1 = require("./json-schema");
/**
 * importDoc - convert any Plain Old Javascript Object into an implied JSON Schema and
 *             a JSON Patch that sets every value in that document.
 * @param inputDoc a document to convert into a big JSON patch describing its full contents
 */
function importDoc(inputDoc) {
    // Always use our robust fallback schema generation instead of to-json-schema
    // to avoid array handling issues
    // Create a robust schema using our custom logic
    const schema = {
        type: 'object',
        properties: {}
    };
    // Add basic property types based on the input document
    if (inputDoc && typeof inputDoc === 'object' && !Array.isArray(inputDoc)) {
        Object.keys(inputDoc).forEach(key => {
            const value = inputDoc[key];
            let type = 'string'; // default type
            if (typeof value === 'number') {
                type = 'number';
            }
            else if (typeof value === 'boolean') {
                type = 'boolean';
            }
            else if (Array.isArray(value)) {
                // Handle arrays with proper item type inference
                let itemType = 'string'; // default
                if (value.length > 0) {
                    const firstItem = value[0];
                    if (typeof firstItem === 'string') {
                        itemType = 'string';
                    }
                    else if (typeof firstItem === 'number') {
                        itemType = 'number';
                    }
                    else if (typeof firstItem === 'boolean') {
                        itemType = 'boolean';
                    }
                    else if (Array.isArray(firstItem)) {
                        itemType = 'array';
                    }
                    else if (firstItem && typeof firstItem === 'object') {
                        itemType = 'object';
                    }
                }
                schema.properties[key] = {
                    type: ['array', 'null'],
                    items: { type: [itemType, 'null'] }
                };
                return; // Skip the default assignment below
            }
            else if (value === null) {
                type = 'null';
            }
            else if (typeof value === 'object') {
                // For complex objects, use a more flexible schema
                type = 'object';
                schema.properties[key] = {
                    type: ['object', 'null'],
                    additionalProperties: true
                };
                return; // Skip the default assignment below
            }
            schema.properties[key] = { type: [type, 'null'] };
        });
    }
    const patch = fast_json_patch_1.compare({}, inputDoc);
    // Debug: log patches for relationship arrays
    console.log('🔧 importDoc called with inputDoc keys:', Object.keys(inputDoc || {}));
    if (inputDoc && inputDoc.relationships) {
        console.log('🔧 importDoc found relationships array with', inputDoc.relationships.length, 'items');
        console.log('🔧 All generated patches:', patch.length);
        const relationshipPatches = patch.filter(p => p.path.includes('/relationships'));
        console.log('🔧 Relationship patches:', relationshipPatches);
    }
    return [schema, patch];
}
exports.importDoc = importDoc;
/**
 * applyLensToDoc - converts a full document through a lens.
 * Under the hood, we convert your input doc into a big patch and the apply it to the targetDoc.
 * This allows merging data back and forth with other omitted values.
 * @property lensSource: the lens specification to apply to the document
 * @property inputDoc: the Plain Old Javascript Object to convert
 * @property inputSchema: (default: inferred from inputDoc) a JSON schema defining the input
 * @property targetDoc: (default: {}) a document to apply the contents of this document to as a patch
 */
function applyLensToDoc(lensSource, 
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
inputDoc, inputSchema, 
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
targetDoc) {
    const [impliedSchema, patchForOriginalDoc] = importDoc(inputDoc);
    if (inputSchema === undefined || inputSchema === null) {
        inputSchema = impliedSchema;
    }
    // construct the "base" upon which we will apply the patches from doc.
    // We start with the default object for the output schema,
    // then we add in any existing fields on the target doc.
    // TODO: I think we need to deep merge here, can't just shallow merge?
    const outputSchema = json_schema_1.updateSchema(inputSchema, lensSource);
    const base = Object.assign(defaults_1.defaultObjectForSchema(outputSchema), targetDoc || {});
    // return a doc based on the converted patch.
    // (start with either a specified baseDoc, or just empty doc)
    // convert the patch through the lens
    const outputPatch = patch_1.applyLensToPatch(lensSource, patchForOriginalDoc, inputSchema);
    const result = fast_json_patch_1.applyPatch(base, outputPatch).newDocument;
    return result;
}
exports.applyLensToDoc = applyLensToDoc;
//# sourceMappingURL=doc.js.map