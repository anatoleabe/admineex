var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

// Personnel schema
var Schema = mongoose.Schema;
var PersonnelSchema = new Schema({
    mysqlId: {type: String, required: true}, //autoincrementId TO BE REMOVED
    identifier: {type: String, required: true, index: true}, //Matricule
    name: {
        use: {type: String, index: true},
        text: String,
        family: [String],
        middle: [String],
        maiden: [String],
        given: [{type: String, index: true}, ],
        prefix: [String],
        suffix: [String]
    },
    status: {type: String, required: true},
    corps: {type: String, required: false},
    grade: {type: String, required: false},
    rank: {type: String, required: false}, //Default Agent Rank. From json resources json rank. This is the default rank of the personnel. It can be changed by the affectation.
    category: {type: String, required: false},
    index: {type: String, required: false},//Indice ou echelon selon le status
    gender: {type: String, required: true},
    birthDate: Date,
    retirementDate: Date,
    birthPlace: {type: String, required: false},
    children: {type: String, required: false},
    maritalStatus: {type: String, required: false},
    father: {type: String, required: false},
    mother: {type: String, required: false},
    partner: {type: String, required: false},
    telecom: [{}],
    address: [
        {
            country: String, //From json
            region: String, //From json
            department: String, //From json
            arrondissement: String //From json
        }
    ],
    cni: {
        identifier: String,
        date: Date,
        city: String,
        by: String
    },
    history: {
        recruitmentActNumber: String,
        nature: String,
        originalAdministration: String,
        signatureDate: String,
        signatory: String,
        startDate: Date,
        minfiEntryDate: Date,
        minfiEntryRefAct: String,
        positions: [
            {
                numAct: String,
                positionId: {type: ObjectId, ref: 'Position', required: false},
                isCurrent: Boolean,
                signatureDate: Date,
                startDate: Date,
                endDate: Date,
                mouvement: String, //Id from json resources json mouvement
                nature: String, //Id from json resources json act nature
                lastModified: {type: Date, default: Date.now, required: true}
            }
        ]
    },
    qualifications: {
        highestLevelEducation: String, //From json
        schools: [
            {
//                diploma: String,
//                date: Date,
//                authority: String,
//                option: String,
//                domain: String,
//                type: String, //recrutement or higher
            }
        ],
        stages: [{}]
    },
    more: {},
    sanctions: [
        {
            numAct: {type: String, required: true}, //Numero de l'acte administratif
            nature: {type: String, required: true}, //id fron resource json nature > acte
            sanction: {type: String, required: true}, //id fron resource json sanctions
            date: {type: Date},
            comment: {type: String},
            lastModified: {type: Date, default: Date.now, required: true},
        }
    ],
    situations: [
        {
            numAct: {type: String, required: true}, //Numero de l'acte administratif
            nature: {type: String, required: true}, //id fron resource json nature > acte
            situation: {type: String, required: true}, //id fron resource json situations
            date: {type: Date},
            comment: {type: String},
            lastModified: {type: Date, default: Date.now, required: true}
        }
    ],
    trainnings: [{}],
    notations: [
        {
            accomplished: {type: String},
            appreciation: {type: String},
            structure: {type: ObjectId}, //Mongo id
            position: {type: ObjectId},//mongo id
            quarter: {type: String},//Id of quarter
            year: {type: String},//Id of quarter
            lastModified: {type: Date, default: Date.now, required: true},
        }
    ],
    profiles: [], //Codes of existing profil, list of string
    skills: [], //Code of existing profiles taken from a global lists
    trainingNeeds: [{}],
    preferences: {
        notification: {
            email: {type: Boolean, required: false, default: true},
            sms: {type: Boolean, required: false, default: false}
        }
    },
    retirement: {
        retirement: {type: Boolean, default: false},
        retirementDate: {type: Date},
        notified: {type: Date},
        extended: {type: Boolean, default: false}
    },
    lastModified: {type: Date, default: Date.now, required: true},
    created: {type: Date, default: Date.now, required: true}
});

// Define the model
var Personnel = mongoose.model('Personnel', PersonnelSchema);
PersonnelSchema.index({'$**': 'text'});

// Export the model
exports.Personnel = Personnel;

Personnel.ensureIndexes(function (err) {
    if (err)
        console.log(err);
});
