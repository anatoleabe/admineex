var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// positionOccuped schema
var positionOccupedSchema = new Schema({
    positionId: { type: String, required: true },
    personnelId: { type: String, required: false },
    lastModified: { type: Date, default: Date.now, required: true },
});

//Define Models
var positionOccuped = mongoose.model('positionOccuped', positionOccupedSchema);

// Export Models
exports.positionOccuped = positionOccuped;
