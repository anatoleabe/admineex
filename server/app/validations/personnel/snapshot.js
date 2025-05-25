const Joi = require('joi');

const createPersonnelSnapshot = {
    body: Joi.object().keys({
        personnelId: Joi.string().required(),
        snapshotDate: Joi.date().default(Date.now),
        data: Joi.object().keys({
            grade: Joi.string(),
            category: Joi.string(),
            rank: Joi.string(),
            index: Joi.string(),
            status: Joi.string(),
            salary: Joi.number(),
            position: Joi.object().keys({
                id: Joi.string(),
                code: Joi.string(),
                rank: Joi.string()
            }),
            sanctions: Joi.array().items(
                Joi.object().keys({
                    type: Joi.string(),
                    startDate: Joi.date(),
                    endDate: Joi.date()
                })
            )
        }).required()
    })
};

const getPersonnelSnapshots = {
    params: Joi.object().keys({
        personnelId: Joi.string().required()
    }),
    query: Joi.object().keys({
        fromDate: Joi.date(),
        toDate: Joi.date(),
        limit: Joi.number().integer().default(100),
        sortBy: Joi.string().default('snapshotDate:desc')
    })
};

const getSnapshotAtDate = {
    params: Joi.object().keys({
        personnelId: Joi.string().required(),
        date: Joi.date().required()
    })
};

const compareSnapshots = {
    params: Joi.object().keys({
        personnelId: Joi.string().required()
    }),
    query: Joi.object().keys({
        snapshotId1: Joi.string().required(),
        snapshotId2: Joi.string().required()
    })
};

const getSnapshotById = {
    params: Joi.object().keys({
        id: Joi.string().required()
    })
};

module.exports = {
    createPersonnelSnapshot,
    getPersonnelSnapshots,
    getSnapshotAtDate,
    compareSnapshots,
    getSnapshotById
};