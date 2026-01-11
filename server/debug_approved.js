const mongoose = require('mongoose');
const mongoUrl = 'mongodb://localhost:27017/persabe';

// Correct paths - relative to server/ directory
const { BonusInstance } = require('./app/models/bonus/instance');
const { BonusAllocation } = require('./app/models/bonus/allocation');

async function run() {
    try {
        await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to DB');

        console.log('--- Checking Approved Instances ---');
        const approvedInstances = await BonusInstance.find({ status: 'approved' }).limit(3);
        console.log(`Found ${approvedInstances.length} approved instances.`);
        if (approvedInstances.length > 0) {
            console.log('Sample Instance Fields:', JSON.stringify(approvedInstances[0].toObject(), null, 2));
        }

        console.log('--- Checking Approved Allocations ---');
        // Find allocations for these instances
        if (approvedInstances.length > 0) {
            const instanceIds = approvedInstances.map(i => i._id);
            const allocations = await BonusAllocation.find({ instanceId: { $in: instanceIds } }).limit(1);
            console.log(`Found allocations for these instances.`);
            if (allocations.length > 0) {
                console.log('Sample Allocation Fields:', JSON.stringify(allocations[0].toObject(), null, 2));
            } else {
                // Check if any allocations exist with status 'eligible' or 'approved' (allocations might be 'eligible' even if instance is 'approved')
                const anyAlloc = await BonusAllocation.findOne({ status: 'eligible' });
                console.log('Sample Eligible Allocation:', anyAlloc ? JSON.stringify(anyAlloc.toObject(), null, 2) : 'None');
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

run();
