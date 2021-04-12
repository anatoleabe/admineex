var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Assigned schema (Dossier)
var AssignedSchema = new Schema({
    message: String,
    taskID: { type: ObjectId, required: true },
    fromUserID: { type: ObjectId, required: true },
    assignedToUserID: { type: ObjectId, required: true },
    assignedDate: { type: Date, default: Date.now, required: true }
});

//Define Models
var Assigned = mongoose.model('Assigned', AssignedSchema);

// Export Models
exports.Assigned = Assigned;
