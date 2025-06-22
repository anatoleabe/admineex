const { Personnel } = require('../models/personnel');
const { PersonnelSnapshot } = require('../models/bonus/PersonnelSnapshot');
const { Affectation } = require('../models/affectation');
const { Position } = require('../models/position');
const { Structure } = require('../models/structure');
const { Sanction } = require('../models/sanction');

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
    if (latestAffectation) {
        const position = await Position.findById(latestAffectation.positionId).lean();

        if (position) {
            positionData.id = position._id;
            positionData.code = position.code;
            positionData.name = position.fr || position.en; // Use French if available, otherwise English

            // Get the structure information
            if (position.structureId) {
                const structure = await Structure.findById(position.structureId).lean();

                if (structure) {
                    positionData.structure.id = structure._id;
                    positionData.structure.name = structure.fr || structure.en;
                    positionData.structure.code = structure.code;
                }
            }
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
            position: positionData,
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