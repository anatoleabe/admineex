const { Personnel } = require('../models/personnel');
const { PersonnelSnapshot } = require('../models/bonus/PersonnelSnapshot');
const { Affectation } = require('../models/affectation');
const { Position } = require('../models/position');
const { Structure } = require('../models/structure');
const { Sanction } = require('../models/sanction');

function shapeStructure(structure) {
    if (!structure) return null;
    const identifier = (structure._id || structure.id || '').toString();
    const code = structure.code || identifier;
    return {
        id: structure._id || structure.id || null,
        identifier: structure.identifier || identifier,
        code: code,
        name: structure.fr || structure.en || code,
        rank: structure.rank ? String(structure.rank) : undefined
    };
}

async function createPersonnelSnapshot(personnelId, snapshotDate = new Date()) {
    const personnel = await Personnel.findById(personnelId).lean();

    if (!personnel) {
        throw new Error('Personnel record not found');
    }

    // Find the latest affectation for this personnel
    const latestAffectation = await Affectation.findOne({
        personnelId: personnelId
    }).sort({ lastModified: -1 }).lean();

    // Initialize position object
    let positionData = {
        id: null,
        code: null,
        name: null,
        structure: {
            id: null,
            name: null,
            code: null
        }
    };

    // If there's an affectation, get the position and structure details
    let structureInfo = null;
    let subStructureInfo = null;

    if (latestAffectation) {
        const position = await Position.findById(latestAffectation.positionId).lean();

        if (position) {
            positionData.id = position._id;
            positionData.code = position.code;
            positionData.name = position.fr || position.en; // Use French if available, otherwise English

            // Get the structure information
            if (position.structureId) {
                const subStructure = await Structure.findById(position.structureId).lean();

                if (subStructure) {
                    positionData.structure.id = subStructure._id;
                    positionData.structure.name = subStructure.fr || subStructure.en;
                    positionData.structure.code = subStructure.code;

                    subStructureInfo = shapeStructure(subStructure);
                    if (subStructureInfo) {
                        subStructureInfo.parentId = subStructure.fatherId || null;
                        subStructureInfo.parentIdentifier = subStructure.fatherIdentifier || null;
                        // Attempt to resolve parent structure document for richer metadata
                        let parentStructure = null;
                        if (subStructure.fatherId) {
                            parentStructure = await Structure.findById(subStructure.fatherId).lean();
                        } else if (subStructure.fatherIdentifier) {
                            parentStructure = await Structure.findOne({ identifier: subStructure.fatherIdentifier }).lean();
                        }
                        const parentInfo = shapeStructure(parentStructure);
                        if (parentInfo) {
                            subStructureInfo.parentId = parentInfo.id || subStructureInfo.parentId;
                            subStructureInfo.parentIdentifier = parentInfo.identifier || subStructureInfo.parentIdentifier;
                            subStructureInfo.parentCode = parentInfo.code || subStructureInfo.parentCode;
                        } else if (!subStructureInfo.parentCode && subStructureInfo.code && subStructureInfo.code.includes('-')) {
                            subStructureInfo.parentCode = subStructureInfo.code.substring(0, subStructureInfo.code.lastIndexOf('-'));
                        }
                        structureInfo = parentInfo || shapeStructure(subStructure);
                    }
                }
            }
        }
    }

    if (!structureInfo && subStructureInfo && (subStructureInfo.parentId || subStructureInfo.parentIdentifier || subStructureInfo.parentCode)) {
        structureInfo = {
            id: subStructureInfo.parentId || null,
            identifier: subStructureInfo.parentIdentifier || subStructureInfo.parentCode || null,
            code: subStructureInfo.parentCode || subStructureInfo.code,
            name: subStructureInfo.parentCode || subStructureInfo.code
        };
    }

    if (!structureInfo && positionData.structure && positionData.structure.id) {
        const fallbackStructure = await Structure.findById(positionData.structure.id).lean();
        if (fallbackStructure) {
            structureInfo = shapeStructure(fallbackStructure);
        }
    }

    // Find valid sanctions for this personnel at the snapshot date
    const validSanctions = await Sanction.find({
        personnelId: personnelId,
        $and: [
            // Sanction has started
            { startDate: { $lte: snapshotDate } },
            // Either the sanction has no end date or the end date is after snapshot date
            { $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: snapshotDate } }
            ]}
        ]
    }).lean();

    // Extract only the necessary fields for each sanction
    const sanctionsData = validSanctions.map(sanction => ({
        id: sanction._id,
        type: sanction.type,
        sanction: sanction.sanction,
        startDate: sanction.startDate,
        endDate: sanction.endDate
    }));

    // Get the latest situation for this personnel
    let latestSituation = null;
    if (personnel.situations && personnel.situations.length > 0) {
        // Sort situations by lastModified in descending order and take the first one
        latestSituation = [...personnel.situations]
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))[0];
    }

    const snapshotData = {
        personnelId,
        snapshotDate,
        data: {
            grade: personnel.grade,
            category: personnel.category,
            rank: latestAffectation?.rank || personnel.rank,
            index: personnel.index,
            status: personnel.status,
            salary: personnel.salary,
            situation: latestSituation ? {
                situation: latestSituation.situation,
                date: latestSituation.date,
            } : null,
            position: positionData,
            structure: structureInfo || null,
            subStructure: subStructureInfo || null,
            sanctions: sanctionsData
        }
    };

    return PersonnelSnapshot.create(snapshotData);
}

async function bulkCreateSnapshots(snapshotDate = new Date()) {
    const allPersonnel = await Personnel.find({}).select('_id').lean();

    return Promise.all(
        allPersonnel.map(person =>
            createPersonnelSnapshot(person._id, snapshotDate)
        )
    );
}

module.exports = {
    createPersonnelSnapshot,
    bulkCreateSnapshots
};
