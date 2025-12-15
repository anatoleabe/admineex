const { PersonnelSnapshot } = require('../../../app/models/bonus/personnelSnapshot');
const { createPersonnelSnapshot } = require('../../../app/services/snapshotService');
const { getSnapshotDate } = require('./utils');

async function createOrReuseSnapshot(personnelId, referencePeriod) {
    if (!personnelId) throw new Error('personnelId is required for snapshot');
    const ref = referencePeriod || null;
    const existing = await PersonnelSnapshot.findOne({ personnelId, referencePeriod: ref });
    if (existing) return existing;

    const snapshotDate = ref ? getSnapshotDate(ref) : new Date();
    try {
        return await createPersonnelSnapshot(personnelId, snapshotDate, ref);
    } catch (err) {
        if (err.code === 11000) {
            // Unique index hit; fetch the existing one
            const snapshot = await PersonnelSnapshot.findOne({ personnelId, referencePeriod: ref });
            if (snapshot) return snapshot;
        }
        throw err;
    }
}

module.exports = {
    createOrReuseSnapshot
};
