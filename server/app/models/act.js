var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Act schema
var ActSchema = new Schema({
    ref: { type: String, required: true },
    nature: { type: String, required: true },
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Act = mongoose.model('Act', ActSchema);

// Export Models
exports.Act = Act;
