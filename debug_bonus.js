const mongoose = require('mongoose');
// Defaulting to "persabe" database as per project name and folder structure guess
const mongoUrl = 'mongodb://localhost:27017/persabe';

// Correct paths based on analysis
const { BonusInstance } = require('./server/app/models/bonus/instance');
const { BonusAllocation } = require('./server/app/models/bonus/allocation');
const audit = require('./server/app/models/auditLog').AuditLog; // Confirmed path

async function run() {
    try {
        await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to DB: ' + mongoUrl);

        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        // 1. Stats
        const totalPaid = await BonusAllocation.aggregate([
            { $match: { status: 'paid', paymentDate: { $gte: startOfYear } } }, // Ensure paymentDate exists in your DB logic!
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);
        console.log('Total Paid YTD:', lengthVal(totalPaid));

        const activeCycles = await BonusInstance.countDocuments({ status: { $in: ['draft', 'under_review', 'approved'] } });
        console.log('Active Cycles:', activeCycles);

        const beneficiaries = await BonusAllocation.distinct('personnelId', {
            status: 'paid',
            createdAt: { $gte: twelveMonthsAgo }
        });
        console.log('Beneficiaries Count:', beneficiaries.length);

        // 2. Trends
        const trends = await BonusInstance.find({
            status: 'paid',
            paymentDate: { $gte: twelveMonthsAgo }
        }).select('paymentDate status');
        console.log('Paid Instances (Last 12M):', trends.length);

        // 3. Activity
        // Note: Using a loose regex for category to find anything bonus related
        const logs = await audit.find({ category: { $regex: 'bonus', $options: 'i' } }).limit(5);
        console.log('Bonus Audit Logs:', logs.length);

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

function lengthVal(arr) {
    return arr.length && arr[0].total ? arr[0].total : 0;
}

run();
