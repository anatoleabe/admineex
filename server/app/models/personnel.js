var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

// Personnel schema
var Schema = mongoose.Schema;
var PersonnelSchema = new Schema({
    identifier: {type: String, required: true}, //Matricule
    name: {
        use: String,
        text: String,
        family: [String],
        middle: [String],
        given: [String],
        prefix: [String],
        suffix: [String]
    },
    status: {type: String, required: true},
    grade: {type: String, required: false},
    category: {type: String, required: false},
    gender: {type: String, required: true},
    birthDate: Date,
    birthPlace: {type: String, required: false},
    children: {type: String, required: false},
    maritalStatus: {type: String, required: false},
    telecom: [{}],
    address: [{}],
    cni: {
        identifier: String,
        date: Date,
        city: String,
        by: String
    },
    positionsHistory: [
        {
            refAct: {type: ObjectId, required: true},
            positionId: {type: ObjectId, required: true},
            lastPositionId: {type: ObjectId, required: false},
            startDate: Date,
            endDateDate: Date,
            mouvement: String,//Id from json resources json mouvement
            lastModified: {type: Date, default: Date.now, required: true}
        }
    ],
    schools: [
        {
            diploma: String,
            year: Date,
            organization: String,
            lastModified: {type: Date, default: Date.now, required: true}
        }
    ],
    sanctions: [
        {
            refAct: {type: String, required: true}, //Numero de l'acte administratif
            nature: {type: String, required: true}, //id fron resource json nature > acte
            sanction: {type: String, required: true}, //id fron resource json sanctions
            date: {type: Date},
            lastModified: {type: Date, default: Date.now, required: true},
        }
    ],
    situations: [
        {
            refAct: {type: String, required: true}, //Numero de l'acte administratif
            nature: {type: String, required: true}, //id fron resource json nature > acte
            situation: {type: String, required: true}, //id fron resource json situations
            date: {type: Date},
            lastModified: {type: Date, default: Date.now, required: true},
        }
    ],
    trainnings: [{}],
    notations: [{}],
    profiles: [{}], //Codes of existing profil, list of string
    skills: [{}], //Code of existing profiles taken from a global lists
    trainingNeeds: [{}],
    preferences: {
        notification: {
            email: {type: Boolean, required: false, default: true},
            sms: {type: Boolean, required: false, default: false}
        }
    },
    retirement: {
        retirement: {type: Boolean, default: false},
        notified: {type: Boolean, default: false},
        prolonger: {type: Boolean, default: false}
    },
    lastModified: {type: Date, default: Date.now, required: true},
    created: {type: Date, default: Date.now, required: true}
});

// Define the model
var Personnel = mongoose.model('Personnel', PersonnelSchema);

// Export the model
exports.Personnel = Personnel;
