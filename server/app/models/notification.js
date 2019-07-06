var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

var NotificationSchema = new Schema({
    userID: { type: ObjectId, required: false },
    type : { type: String, required: true },
    author : { type: String, required: false },
    abstract : { type: String, required: true },
    content : { type: String, required: true },
    details : [{}],
    mailed : { type: Date },
    created: { type: Date, default: Date.now },
    read: { type: Date }
});

var Notification = mongoose.model('Notification', NotificationSchema);

exports.Notification = Notification;