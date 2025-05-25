const { Personnel } = require('../models/personnel');
const { PersonnelSnapshot } = require('../models/bonus/PersonnelSnapshot');

async function createPersonnelSnapshot(personnelId, snapshotDate = new Date()) {
    const personnel = await Personnel.findById(personnelId).lean();

    if (!personnel) {
        throw new Error('Personnel record not found');
    }

    const snapshotData = {
        personnelId,
        snapshotDate,
        data: {
            grade: personnel.grade,
            category: personnel.category,
            rank: personnel.rank,
            index: personnel.index,
            status: personnel.status,
            salary: personnel.salary,
            position: personnel.position,
            sanctions: personnel.sanctions
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