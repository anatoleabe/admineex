var mongoose        = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

// Task schema (Dossier)
var TaskSchema = new Schema({
    authorID: { type: ObjectId, required: true },
    identifier: { type: String, required: true },
    usersID: [{ type: ObjectId, required: false }],
    title: { type: String, required: true },
    description: String,
    parent_task: ObjectId,
    state: String,//todo, inprogress, done
    started: { type: Date, default: Date.now, required: true },
    closed: { type: Date, default: Date.now, required: true },
    dueDate: Date,//Delais
    priority: String,//Delais
    deadline: String,//Delais
    progression: String, //Niveau de progression
    categoryID: String,
    status: String,
    ended: Boolean,
    checklist:[{}],
    attachedFiles:[{}],
    context:{},
    comments: [{}],
    history: [{}],
    lastModified: { type: Date, default: Date.now, required: true },
    created: { type: Date, default: Date.now, required: true }
});

//Define Models
var Task = mongoose.model('Task', TaskSchema);

// Export Models
exports.Task = Task;
