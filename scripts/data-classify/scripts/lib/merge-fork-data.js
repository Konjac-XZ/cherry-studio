const structuredCloneValue = (value) => JSON.parse(JSON.stringify(value))

function mergeItems(baseItems = [], forkItems = []) {
  const merged = structuredCloneValue(baseItems)

  for (const forkItem of forkItems) {
    const index = merged.findIndex((item) => item.originalKey === forkItem.originalKey)
    if (index === -1) {
      merged.push(structuredCloneValue(forkItem))
      continue
    }

    const baseItem = merged[index]
    merged[index] = {
      ...baseItem,
      ...structuredCloneValue(forkItem),
      ...(baseItem.children || forkItem.children
        ? { children: mergeItems(baseItem.children || [], forkItem.children || []) }
        : {})
    }
  }

  return merged
}

function mergeForkClassification(base, fork) {
  const merged = structuredCloneValue(base)

  for (const [source, categories] of Object.entries(fork.classifications || {})) {
    merged.classifications[source] ||= {}
    for (const [category, items] of Object.entries(categories)) {
      merged.classifications[source][category] = mergeItems(merged.classifications[source][category], items)
    }
  }

  return merged
}

function mergeForkDefinitions(base, fork) {
  return { ...base, definitions: [...(base.definitions || []), ...(fork.definitions || [])] }
}

module.exports = { mergeForkClassification, mergeForkDefinitions }
