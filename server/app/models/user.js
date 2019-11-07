var mongoose        = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var bcrypt          = require('bcryptjs');

var SALT_WORK_FACTOR = 10;
var Schema = mongoose.Schema;

// User schema
var UserSchema = new Schema({
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    activationToken: { type: String, required: true },
    resetPasswordToken: { type: String, required: false },
    resetPasswordExpires: { type: Date, required: false },
    structures: { type: [String], required: false },
    role: { type: String, required: true },
    language: { type: String, required: true },
    phone: { type: String, required: false },
    preferences: {
        cards: [{
            name: { type: String, required: false },
            enabled: { type: Boolean, required: false }
        }],
        app: { type: [String], required: false},
        avatar: { type: String, required: false },
        notification: {
            email: { type: Boolean, required: false , default: true }
        }
    },
    created: { type: Date, default: Date.now }
});

// Apply the uniqueValidator plugin to schema
UserSchema.plugin(uniqueValidator);

// Bcrypt middleware on UserSchema
UserSchema.pre('save', function(next) {
    var user = this;
    if (!user.isModified('password')) return next();
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            user.password = hash;
            next();
        });
    });
});

//Password verification
UserSchema.methods.comparePassword = function(password, cb) {
    bcrypt.compare(password, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(isMatch);
    });
};


//Define Models
var User = mongoose.model('User', UserSchema);


// Export Models
exports.User = User;
