function normalizeToken(value) {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    return str.length ? str : null;
}

function pushToken(set, value) {
    const token = normalizeToken(value);
    if (token) set.add(token);
}

function getActorStructureTokens(actor) {
    const tokens = new Set();
    const structures = actor && Array.isArray(actor.structures) ? actor.structures : [];
    structures.forEach(structure => pushToken(tokens, structure));
    return tokens;
}

function getSnapshotStructureTokens(snapshot) {
    const tokens = new Set();
    const data = snapshot && snapshot.data ? snapshot.data : null;
    if (!data) return tokens;

    const structure = data.structure || {};
    const subStructure = data.subStructure || {};
    const positionStructure = (data.position && data.position.structure) ? data.position.structure : {};

    // Main structure (direct + from position structure)
    pushToken(tokens, structure.id);
    pushToken(tokens, structure.identifier);
    pushToken(tokens, structure.code);

    pushToken(tokens, positionStructure.id);
    pushToken(tokens, positionStructure.code);
    pushToken(tokens, positionStructure.identifier);

    // Parent structure inferred from sub-structure
    pushToken(tokens, subStructure.parentId);
    pushToken(tokens, subStructure.parentIdentifier);
    pushToken(tokens, subStructure.parentCode);

    // Sub-structure itself (sometimes managers are assigned to a sub-structure id/code)
    pushToken(tokens, subStructure.id);
    pushToken(tokens, subStructure.identifier);
    pushToken(tokens, subStructure.code);

    return tokens;
}

function isSnapshotInStructures(snapshot, allowedStructureTokens) {
    if (!allowedStructureTokens || allowedStructureTokens.size === 0) return false;
    const snapshotTokens = getSnapshotStructureTokens(snapshot);
    for (const token of snapshotTokens) {
        if (allowedStructureTokens.has(token)) return true;
    }
    return false;
}

module.exports = {
    getActorStructureTokens,
    getSnapshotStructureTokens,
    isSnapshotInStructures
};

