const express = require('express');
const router = express.Router();
const instanceController = require('../controllers/bonus/instance');
const instanceValidation = require('../validations/bonus/instance');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');

// Apply auth middleware to all routes
router.use(auth);

// Instance routes
router.get('/instances',
    validate(instanceValidation.getAll),
    instanceController.api.getAll
);

router.post('/instances',
    validate(instanceValidation.create),
    instanceController.api.create
);

router.get('/instances/:id',
    validate(instanceValidation.getById),
    instanceController.api.getById
);

router.put('/instances/:id',
    validate(instanceValidation.update),
    instanceController.api.update
);

router.post('/instances/:id/approve',
    validate(instanceValidation.approve),
    instanceController.api.approve
);

router.post('/instances/:id/reject',
    validate(instanceValidation.reject),
    instanceController.api.reject
);

router.post('/instances/:id/cancel',
    validate(instanceValidation.cancel),
    instanceController.api.cancel
);

router.post('/instances/:id/generate-payments',
    validate(instanceValidation.generatePayments),
    instanceController.api.generatePayments
);

router.get('/instances/:id/export',
    validate(instanceValidation.export),
    instanceController.api.export
);

router.post('/instances/:id/notify',
    validate(instanceValidation.notify),
    instanceController.api.notify
);

module.exports = router;
