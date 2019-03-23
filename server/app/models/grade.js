var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Position schema
var PositionSchema = new Schema({
    identifier: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    status: { type: String, required: true },//Official (Fonctionnaire) or not
    corps: { type: String, required: true },
    category: { type: String, required: false },
    priority: { type: String, required: false },
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Position = mongoose.model('Position', PositionSchema);

// Export Models
exports.Position = Position;
