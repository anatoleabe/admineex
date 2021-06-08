var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

// TaskCategory schema
var Schema = mongoose.Schema;
var TaskCategorySchema = new Schema({
    name: {type: String, required: true},
    color: {type: String, required: true},
    authorID: { type: ObjectId, required: false },
    lastModified: {type: Date, default: Date.now, required: true},
    created: {type: Date, default: Date.now, required: true}
});

// Define the model
var TaskCategory = mongoose.model('TaskCategory', TaskCategorySchema);

// Export the model
exports.TaskCategory = TaskCategory;
