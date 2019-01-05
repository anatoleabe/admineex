var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

// Organization schema
var Schema = mongoose.Schema;
var OrganizationSchema = new Schema({
    authorID: { type: ObjectId, required: true },
    name: {type: String, required: true},
    type: { type: String, required: true },
    lastModified: {type: Date, default: Date.now, required: true},
    created: {type: Date, default: Date.now, required: true}
});

// Define the model
var Organization = mongoose.model('Organization', OrganizationSchema);

// Export the model
exports.Organization = Organization;
