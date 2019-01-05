var mongoose = require('mongoose');

// RevokedToken schema
var Schema = mongoose.Schema;
var RevokedTokenSchema = new Schema({
    token: {type: String, required: true},
    ttl: { type: Date, required: false }
});

// Define the model
var RevokedToken = mongoose.model('RevokedToken', RevokedTokenSchema);

// Export the model
exports.RevokedToken = RevokedToken;