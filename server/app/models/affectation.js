var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Affectation schema
var AffectationSchema = new Schema({
    positionId: { type: ObjectId, required: false },
    positionCode: { type: String, required: false },
    personnelId: { type: ObjectId, required: false },//Personnel id
    date: Date,
    lastModified: { type: Date, default: Date.now, required: true },
});

//Define Models
var Affectation = mongoose.model('Affectation', AffectationSchema);

// Export Models
exports.Affectation = Affectation;
