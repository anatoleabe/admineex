const httpStatus = require('http-status');
const mongoose = require('mongoose');
const PersonnelSnapshot = require('../../models/bonus/personnelSnapshot').PersonnelSnapshot;
const { badRequest, notFound } = require('../../utils/ApiError');

// API
exports.api = {};

/**
 * Create a personnel snapshot
 */
exports.api.create = async (req, res, next) => {
    try {
        const { personnelId, data } = req.body;
        const snapshotDate = new Date(req.body.snapshotDate || Date.now());

        // Verify personnel exists
        const personnelExists = await mongoose.model('Personnel').exists({ _id: personnelId });
        if (!personnelExists) {
            throw new badRequest('Personnel not found');
        }

        const snapshot = await PersonnelSnapshot.create({
            personnelId,
            snapshotDate,
            data,
            createdBy: req.user.id
        });

        res.status(httpStatus.CREATED).json(snapshot);
    } catch (error) {
        next(error);
    }
};

/**
 * Get personnel snapshot by ID
 */
exports.api.getById = async (req, res, next) => {
    try {
        console.log('PersonnelSnapshot ID -----:', req.params.id);
        const snapshot = await PersonnelSnapshot.findById(req.params.id)
            .populate('personnelId', 'identifier name')
            .populate('data.position.id', 'code en');

        if (!snapshot) {
            throw notFound('Personnel snapshot not found');
        }

        res.json(snapshot);
    } catch (error) {
        next(error);
    }
};

/**
 * Get all snapshots for a personnel
 */
exports.api.getAll = async (req, res, next) => {
    try {
        const { personnelId } = req.params;
        const { fromDate, toDate, limit = 100, sortBy = 'snapshotDate:desc' } = req.query;

        const filter = { personnelId };

        if (fromDate || toDate) {
            filter.snapshotDate = {};
            if (fromDate) filter.snapshotDate.$gte = new Date(fromDate);
            if (toDate) filter.snapshotDate.$lte = new Date(toDate);
        }

        const [sortField, sortOrder] = sortBy.split(':');
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

        const snapshots = await PersonnelSnapshot.find(filter)
            .sort(sort)
            .limit(Number(limit))
            .populate('personnelId', 'identifier name');

        res.json(snapshots);
    } catch (error) {
        next(error);
    }
};

/**
 * Get snapshot at specific date for a personnel
 */
exports.api.getAtDate = async (req, res, next) => {
    try {
        const { personnelId, date } = req.params;
        const snapshotDate = new Date(date);

        const snapshot = await PersonnelSnapshot.findOne({
            personnelId,
            snapshotDate: { $lte: snapshotDate }
        })
            .sort({ snapshotDate: -1 })
            .populate('personnelId', 'identifier name')
            .populate('data.position.id', 'code en');

        if (!snapshot) {
            throw notFound('No snapshot found for this date');
        }

        res.json(snapshot);
    } catch (error) {
        next(error);
    }
};

/**
 * Compare two snapshots for a personnel
 */
exports.api.compare = async (req, res, next) => {
    try {
        const { personnelId } = req.params;
        const { snapshotId1, snapshotId2 } = req.query;

        const [snapshot1, snapshot2] = await Promise.all([
            PersonnelSnapshot.findById(snapshotId1),
            PersonnelSnapshot.findById(snapshotId2)
        ]);

        if (!snapshot1 || !snapshot2) {
            throw new badRequest('One or both snapshots not found');
        }

        if (snapshot1.personnelId.toString() !== personnelId || snapshot2.personnelId.toString() !== personnelId) {
            throw new badRequest('Snapshots do not belong to this personnel');
        }

        res.json({
            snapshot1,
            snapshot2,
            differences: findDifferences(snapshot1.data, snapshot2.data)
        });
    } catch (error) {
        next(error);
    }
};

// Helper function to find differences between two snapshots
function findDifferences(data1, data2) {
    const differences = {};

    // Compare simple fields
    const fieldsToCompare = ['grade', 'category', 'rank', 'index', 'status', 'salary'];
    fieldsToCompare.forEach(field => {
        if (data1[field] !== data2[field]) {
            differences[field] = {
                from: data1[field],
                to: data2[field]
            };
        }
    });

    // Compare position
    if (data1.position.id.toString() !== data2.position.id.toString() ||
        data1.position.rank !== data2.position.rank) {
        differences.position = {
            from: data1.position,
            to: data2.position
        };
    }

    // Compare sanctions
    if (JSON.stringify(data1.sanctions) !== JSON.stringify(data2.sanctions)) {
        differences.sanctions = {
            from: data1.sanctions,
            to: data2.sanctions
        };
    }

    return differences;
}