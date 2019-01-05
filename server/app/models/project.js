var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Project schema
var ProjectSchema = new Schema({
    authorID: { type: ObjectId, required: true },
    name: { type: String, required: true },
    enablersID: [{ type: ObjectId, required: true }],
    value: { type: String, required: true },
    paymentDate: { type: Date, required: true },
    successProbability: { type: String, required: true },
    status: { type: String, required: true },
    finance:{
        fundersID: [{ type: ObjectId, required: false }],
        providersID: [{ type: ObjectId, required: false }],
        revenueType: { type: String, required: true }
    },
    context:{
        countries: [{ type: String, required: false }],
        sicknesses: [{ type: String, required: false }],
        product: { type: String, required: false }
    },
    history: [{}],
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Project = mongoose.model('Project', ProjectSchema);

// Export Models
exports.Project = Project;
