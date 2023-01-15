var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Document schema
var DocumentSchema = new Schema({
    identifier: {type: String, required: true},
    owner: { type: ObjectId, required: true },
    ownerType: { type: String, required: true },
    authorID: { type: ObjectId, required: true },
    fileName: { type: String, required: true },
    fullPath: { type: String, required: true },
    category: { type: String, required: true },
    reference: { type: String, required: false },
    comment: { type: String, required: false },
    size: { type: String, required: false },
    downloaded: { type: Number, required: false },
    viewed: { type: Number, required: false },
    contentType: { type: String, required: false },
    index: { type: String, required: false },//This represent a variable to use when sorting
    issueDate: { type: Date},
    keyWords: [{ type: String, required: false }],
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Document = mongoose.model('Document', DocumentSchema);

// Export Models
exports.Document = Document;
