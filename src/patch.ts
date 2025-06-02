import { Operation } from 'fast-json-patch'
import { JSONSchema7 } from 'json-schema'
import { LensSource, LensOp } from './lens-ops'
import { reverseLens } from './reverse'
import { addDefaultValues } from './defaults'
import { updateSchema } from './json-schema'

// todo: we're throwing away the type param right now so it doesn't actually do anything.
// can we actually find a way to keep it around and typecheck patches against a type?
export type PatchOp = Operation
type MaybePatchOp = PatchOp | null
export type Patch = Operation[]
export type CompiledLens = (patch: Patch, targetDoc: any) => Patch

function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}`)
}

function noNulls<T>(items: (T | null)[]) {
  return items.filter((x): x is T => x !== null)
}

// Provide curried functions that incorporate the lenses internally;
// this is useful for exposing a pre-baked converter function to developers
// without them needing to access the lens themselves
// TODO: the public interface could just be runLens and reverseLens
// ... maybe also composeLens?
export function compile(lensSource: LensSource): { right: CompiledLens; left: CompiledLens } {
  return {
    right: (patch: Patch, targetDoc: any) => applyLensToPatch(lensSource, patch, targetDoc),
    left: (patch: Patch, targetDoc: any) =>
      applyLensToPatch(reverseLens(lensSource), patch, targetDoc),
  }
}

// given a patch, returns a new patch that has had the lens applied to it.
export function applyLensToPatch(
  lensSource: LensSource,
  patch: Patch,
  patchSchema: JSONSchema7 // the json schema for the doc the patch was operating on
): Patch {
  // expand patches that set nested objects into scalar patches
  const expandedPatch: Patch = patch.map((op) => expandPatch(op)).flat()

  // send everything through the lens
  const lensedPatch = noNulls<PatchOp>(
    expandedPatch.map((patchOp) => applyLensToPatchOp(lensSource, patchOp))
  )

  // add in default values needed (based on the new schema after lensing)
  const readerSchema = updateSchema(patchSchema, lensSource)
  const lensedPatchWithDefaults = addDefaultValues(lensedPatch, readerSchema)

  return lensedPatchWithDefaults
}

// todo: remove destinationDoc entirely
export function applyLensToPatchOp(lensSource: LensSource, patchOp: MaybePatchOp): MaybePatchOp {
  return lensSource.reduce<MaybePatchOp>((prevPatch: MaybePatchOp, lensOp: LensOp) => {
    return runLensOp(lensOp, prevPatch)
  }, patchOp)
}

function runLensOp(lensOp: LensOp, patchOp: MaybePatchOp): MaybePatchOp {
  if (patchOp === null) {
    return null
  }

  switch (lensOp.op) {
    case 'rename':
      if (
        // TODO: what about other JSON patch op types?
        // (consider other parts of JSON patch: move / copy / test / remove ?)
        (patchOp.op === 'replace' || patchOp.op === 'add') &&
        patchOp.path.split('/')[1] === lensOp.source
      ) {
        const path = patchOp.path.replace(lensOp.source, lensOp.destination)
        return { ...patchOp, path }
      }

      break

    case 'hoist': {
      // leading slash needs trimming
      const pathElements = patchOp.path.substr(1).split('/')
      const [possibleSource, possibleDestination, ...rest] = pathElements
      if (possibleSource === lensOp.host && possibleDestination === lensOp.name) {
        const path = ['', lensOp.name, ...rest].join('/')
        return { ...patchOp, path }
      }
      break
    }

    case 'plunge': {
      const pathElements = patchOp.path.substr(1).split('/')
      const [head] = pathElements
      if (head === lensOp.name) {
        const path = ['', lensOp.host, pathElements].join('/')
        return { ...patchOp, path }
      }
      break
    }

    case 'wrap': {
      const pathComponent = new RegExp(`^/(${lensOp.name})(.*)`)
      const match = patchOp.path.match(pathComponent)
      if (match) {
        const path = `/${match[1]}/0${match[2]}`
        if (
          (patchOp.op === 'add' || patchOp.op === 'replace') &&
          patchOp.value === null &&
          match[2] === ''
        ) {
          return { op: 'remove', path }
        }
        return { ...patchOp, path }
      }
      break
    }

    case 'head': {
      // break early if we're not handling a write to the array handled by this lens
      const arrayMatch = patchOp.path.split('/')[1] === lensOp.name
      if (!arrayMatch) break

      // We only care about writes to the head element, nothing else matters
      const headMatch = patchOp.path.match(new RegExp(`^/${lensOp.name}/0(.*)`))
      if (!headMatch) return null

      if (patchOp.op === 'add' || patchOp.op === 'replace') {
        // If the write is to the first array element, write to the scalar
        return {
          op: patchOp.op,
          path: `/${lensOp.name}${headMatch[1] || ''}`,
          value: patchOp.value,
        }
      }

      if (patchOp.op === 'remove') {
        if (headMatch[1] === '') {
          return {
            op: 'replace' as const,
            path: `/${lensOp.name}${headMatch[1] || ''}`,
            value: null,
          }
        } else {
          return { ...patchOp, path: `/${lensOp.name}${headMatch[1] || ''}` }
        }
      }

      break
    }

    case 'add':
      // Add a new field with the specified default value
      // Generate an "add" patch operation for the new field
      console.log(`➕ add: generating new field "${lensOp.name}" with default value:`, lensOp.default)
      if (lensOp.default !== undefined) {
        const result = {
          op: 'add' as const,
          path: `/${lensOp.name}`,
          value: lensOp.default
        }
        console.log(`➕ add: returning patch:`, result)
        return result
      }
      console.log(`➕ add: no default value provided`)
      break

    case 'remove':
      if (patchOp.path.split('/')[1] === lensOp.name) return null
      break

    case 'setValue':
      // Set a field to a specific value
      // Handle both the main field and any nested array/object elements
      console.log(`🔍 setValue: patchOp.path="${patchOp.path}", lensOp.name="${lensOp.name}", expected="/${lensOp.name}"`)
      if (patchOp.path === `/${lensOp.name}`) {
        console.log(`✅ setValue match! Setting ${lensOp.name} to ${lensOp.value}`)
        return {
          op: 'replace' as const,
          path: patchOp.path,
          value: lensOp.value
        }
      }
      
      // setValue should ONLY match its exact field, not any nested paths
      if (patchOp.path.startsWith(`/${lensOp.name}/`)) {
        console.log(`❌ setValue: skipping nested path ${patchOp.path} for field ${lensOp.name}`)
        break
      }
      // Convert add operations for the field to replace
      if (patchOp.op === 'add' && patchOp.path === `/${lensOp.name}`) {
        return {
          op: 'replace' as const,
          path: patchOp.path,
          value: lensOp.value
        }
      }
      // Remove any nested operations for arrays/objects that would interfere
      if (patchOp.path.startsWith(`/${lensOp.name}/`)) {
        return null // Remove nested array/object element patches
      }
      break

    case 'in': {
      // Run the inner body in a context where the path has been narrowed down...
      console.log(`📥 in: processing patchOp.path="${patchOp.path}", lensOp.name="${lensOp.name}"`)
      const pathComponent = new RegExp(`^/${lensOp.name}`)
      if (patchOp.path.match(pathComponent)) {
        const childPath = patchOp.path.replace(pathComponent, '')
        console.log(`📥 in: matched! childPath="${childPath}"`)
        
        // Special handling for array transformations when setting the entire array
        console.log(`📥 in: checking array transformation conditions - childPath="${childPath}", op="${patchOp.op}", lensLength=${lensOp.lens.length}, firstOp=${lensOp.lens[0]?.op}`)
        if (patchOp.op === 'add' || patchOp.op === 'replace') {
          console.log(`📥 in: patchOp.value type=${typeof patchOp.value}, isArray=${Array.isArray(patchOp.value)}, value=`, patchOp.value)
        }
        if (childPath === '' && (patchOp.op === 'add' || patchOp.op === 'replace') && 
            Array.isArray(patchOp.value) && lensOp.lens.length === 1 && lensOp.lens[0].op === 'map') {
          console.log(`📥 in: handling array transformation for ${lensOp.name}`)
          const mapLens = lensOp.lens[0]
          
          // Transform each array element using the map lens
          const transformedArray = patchOp.value.map((item, index) => {
            console.log(`📥 in: transforming array element ${index}:`, item)
            let transformedItem = { ...item }
            
            // Apply each lens operation in the map to transform the item
            for (const innerLensOp of mapLens.lens) {
              if (innerLensOp.op === 'optionalRename' || innerLensOp.op === 'rename') {
                if (transformedItem.hasOwnProperty(innerLensOp.source)) {
                  console.log(`📥 in: renaming ${innerLensOp.source} to ${innerLensOp.destination}`)
                  transformedItem[innerLensOp.destination] = transformedItem[innerLensOp.source]
                  delete transformedItem[innerLensOp.source]
                }
              } else if (innerLensOp.op === 'remove' && innerLensOp.name) {
                console.log(`📥 in: removing field ${innerLensOp.name}`)
                delete transformedItem[innerLensOp.name]
              } else if (innerLensOp.op === 'add' && innerLensOp.name && innerLensOp.default !== undefined) {
                console.log(`📥 in: adding field ${innerLensOp.name} with default ${innerLensOp.default}`)
                transformedItem[innerLensOp.name] = innerLensOp.default
              }
            }
            
            console.log(`📥 in: transformed element ${index}:`, transformedItem)
            return transformedItem
          })
          
          console.log(`📥 in: transformed array:`, transformedArray)
          return { ...patchOp, value: transformedArray }
        }
        
        const childPatch = applyLensToPatchOp(lensOp.lens, {
          ...patchOp,
          path: childPath,
        })
        console.log(`📥 in: childPatch result:`, childPatch)

        if (childPatch) {
          const finalPath = `/${lensOp.name}${childPatch.path}`
          console.log(`📥 in: returning with finalPath="${finalPath}"`)
          return { ...childPatch, path: finalPath }
        } else {
          console.log(`📥 in: returning null`)
          return null
        }
      }
      console.log(`📥 in: no match for path ${patchOp.path}`)
      break
    }

    case 'map': {
      console.log(`🗺️ map: processing patchOp.path="${patchOp.path}"`)
      const arrayIndexMatch = patchOp.path.match(/\/([0-9]+)\//)
      if (!arrayIndexMatch) {
        console.log(`🗺️ map: no array index match for path ${patchOp.path}`)
        
        // Special handling for array addition patches that need field transformation
        // If this is an array element being added (like /relationships/0), and we have rename operations,
        // we need to transform the value being added
        const arrayElementMatch = patchOp.path.match(/^\/(\d+)$/)
        if (arrayElementMatch && (patchOp.op === 'add' || patchOp.op === 'replace') && 
            typeof patchOp.value === 'object' && patchOp.value !== null) {
          console.log(`🗺️ map: handling array element patch for array index ${arrayElementMatch[1]}`)
          
          // Apply transformations to the object being added/replaced
          let transformedValue = { ...patchOp.value }
          
          // Apply each lens operation to transform the object
          for (const innerLensOp of lensOp.lens) {
            if (innerLensOp.op === 'optionalRename' || innerLensOp.op === 'rename') {
              if (transformedValue.hasOwnProperty(innerLensOp.source)) {
                console.log(`🗺️ map: renaming ${innerLensOp.source} to ${innerLensOp.destination}`)
                transformedValue[innerLensOp.destination] = transformedValue[innerLensOp.source]
                delete transformedValue[innerLensOp.source]
              }
            } else if (innerLensOp.op === 'remove' && innerLensOp.name) {
              console.log(`🗺️ map: removing field ${innerLensOp.name}`)
              delete transformedValue[innerLensOp.name]
            } else if (innerLensOp.op === 'add' && innerLensOp.name && innerLensOp.default !== undefined) {
              console.log(`🗺️ map: adding field ${innerLensOp.name} with default ${innerLensOp.default}`)
              transformedValue[innerLensOp.name] = innerLensOp.default
            }
          }
          
          console.log(`🗺️ map: transformed array element:`, transformedValue)
          return { ...patchOp, value: transformedValue }
        }
        
        break
      }
      const arrayIndex = arrayIndexMatch[1]
      const modifiedPath = patchOp.path.replace(/\/[0-9]+\//, '/')
      console.log(`🗺️ map: arrayIndex=${arrayIndex}, modifiedPath="${modifiedPath}"`)
      
      const itemPatch = applyLensToPatchOp(
        lensOp.lens,
        { ...patchOp, path: modifiedPath }
        // Then add the parent path back to the beginning of the results
      )
      console.log(`🗺️ map: itemPatch result:`, itemPatch)

      if (itemPatch) {
        const finalPath = `/${arrayIndex}${itemPatch.path}`
        console.log(`🗺️ map: returning with finalPath="${finalPath}"`)
        return { ...itemPatch, path: finalPath }
      }
      console.log(`🗺️ map: returning null`)
      return null
    }

    case 'convert': {
      if (patchOp.op !== 'add' && patchOp.op !== 'replace') break
      if (`/${lensOp.name}` !== patchOp.path) break
      const stringifiedValue = String(patchOp.value)

      // todo: should we add in support for fallback/default conversions
      if (!Object.keys(lensOp.mapping[0]).includes(stringifiedValue)) {
        throw new Error(`No mapping for value: ${stringifiedValue}`)
      }

      return { ...patchOp, value: lensOp.mapping[0][stringifiedValue] }
    }

    case 'optionalRename': {
      // Handle the same way as regular rename, including nested paths
      console.log(`🔍 optionalRename: patchOp.path="${patchOp.path}", lensOp.source="${lensOp.source}", lensOp.destination="${lensOp.destination}"`)
      console.log(`🔍 optionalRename: path parts="${patchOp.path.split('/')}", first part="${patchOp.path.split('/')[1]}"`)
      if (
        (patchOp.op === 'replace' || patchOp.op === 'add') &&
        patchOp.path.split('/')[1] === lensOp.source
      ) {
        const path = patchOp.path.replace(lensOp.source, lensOp.destination)
        console.log(`✅ optionalRename match! Renaming ${lensOp.source} to ${lensOp.destination}, new path: ${path}`)
        return { ...patchOp, path }
      }
      
      break
    }

    default:
      assertNever(lensOp) // exhaustiveness check
  }

  return patchOp
}

export function expandPatch(patchOp: PatchOp): PatchOp[] {
  // this only applies for add and replace ops; no expansion to do otherwise
  // todo: check the whole list of json patch verbs
  if (patchOp.op !== 'add' && patchOp.op !== 'replace') return [patchOp]

  if (patchOp.value && typeof patchOp.value === 'object') {
    let result: any[] = [
      {
        op: patchOp.op,
        path: patchOp.path,
        value: Array.isArray(patchOp.value) ? [] : {},
      },
    ]

    result = result.concat(
      Object.entries(patchOp.value).map(([key, value]) => {
        return expandPatch({
          op: patchOp.op,
          path: `${patchOp.path}/${key}`,
          value,
        })
      })
    )

    return result.flat(Infinity)
  }
  return [patchOp]
}
