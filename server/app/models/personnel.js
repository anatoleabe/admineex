var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

// Personnel schema
var Schema = mongoose.Schema;
var PersonnelSchema = new Schema({
    identifier: { type: String, required: true },//Matricule
    name: {
        use: String,
        text: String,
        family: [String],
        middle:[String],
        given: [String],
        prefix: [String],
        suffix: [String]
    },
    status: { type: String, required: true },
    gradeID: { type: ObjectId, required: true },
    category: { type: String, required: false },
    telecom: [{}],
    gender: { type: String, required: true },
    birthDate: Date,
    birthPlace: { type: String, required: false },
    children: { type: String, required: false },
    maritalStatus: { type: String, required: false },
    address: [{}],
    cni: {
        identifier: String,
        date: Date,
        city: String,
        by:String
    },
    preferences: {
        notification: {
            email: {type: Boolean, required: false, default: true},
            sms: {type: Boolean, required: false, default: false}
        }
    },
    positionsHistory: [
        {
            actID: { type: ObjectId, required: true },
            positionID: { type: ObjectId, required: true },
            lastPositionID: { type: ObjectId, required: false },
            startDate: Date,
            endDateDate: Date,
            mouvements: String,
            lastModified: { type: Date, default: Date.now, required: true }
        }
    ],
    schools: [
        {
            diploma: String,
            year: Date,
            organization: String,
            lastModified: { type: Date, default: Date.now, required: true }
        }
    ],
    trainnings: [{}],
    notations:[{}],
    retirement: {type: Boolean, required: false, default: false},
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

// Define the model
var Personnel = mongoose.model('Personnel', PersonnelSchema);

// Export the model
exports.Personnel = Personnel;
