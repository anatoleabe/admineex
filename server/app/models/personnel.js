var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

// Personnel schema
var Schema = mongoose.Schema;
var PersonnelSchema = new Schema({
    mysqlId: {type: String, required: true}, //autoincrementId TO BE REMOVED
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
    father: {type: String, required: false},
    mother: {type: String, required: false},
    telecom: [{}],
    address: [
        {
            country: String, //From json
            region: String, //From json
            department: String, //From json
            arrondissement: String//From json
        }
    ],
    cni: {
        identifier: String,
        date: Date,
        city: String,
        by: String
    },
    positionsHistory: [
        {
            numAct: {type: ObjectId, required: false},
            positionId: {type: ObjectId, required: false},
            lastPositionId: {type: ObjectId, required: false},
            current: Boolean,
            signatureDate: Date,
            startDate: Date,
            endDate: Date,
            mouvement: String, //Id from json resources json mouvement
            nature: String, //Id from json resources json act nature
            lastModified: {type: Date, default: Date.now, required: true}
        }
    ],
    qualifications: {
        highestLevelEducation: String, //From json
        schools: [
            {
                diploma: String,
                date: Date,
                autority: String,
                option: String,
                domaine: String,
                lastModified: {type: Date, default: Date.now, required: true}
            }
        ]
    },
    more: {},
    sanctions: [
        {
            numAct: {type: String, required: true}, //Numero de l'acte administratif
            nature: {type: String, required: true}, //id fron resource json nature > acte
            sanction: {type: String, required: true}, //id fron resource json sanctions
            date: {type: Date},
            lastModified: {type: Date, default: Date.now, required: true},
        }
    ],
    situations: [
        {
            numAct: {type: String, required: true}, //Numero de l'acte administratif
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
