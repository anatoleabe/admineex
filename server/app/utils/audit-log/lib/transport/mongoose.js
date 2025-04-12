// Module dependencies
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const util = require('util');

/**
 * MongooseTransport
 * A MongoDB storage handler for Audit-Log for Node.js
 */
const MongooseTransport = function (options) {
    this.name = 'mongoose';

    this._options = {
        collectionName: 'auditLog',
        connectionString: '',
        debug: false
    };

    // Override default options with the provided values
    if (typeof options !== 'undefined') {
        for (const attr in options) {
            this._options[attr] = options[attr];
        }
    }

    // Debug message handler
    this.debugMessage = (msg) => {
        if (this._options.debug) {
            console.log('Audit-Log(mongoose): ' + msg);
        }
    };

    // Setup the DB connection
    this._connection = mongoose.createConnection(this._options.connectionString, (err) => {
        if (err) {
            this.debugMessage("Could not connect to DB: " + err);
        }
    });

    // Define the schema and model
    this.modelSchema = new Schema({
        actor: { type: String },
        date: { type: Date },
        origin: { type: String },
        action: { type: String },
        label: { type: String },
        object: { type: String },
        status: { type: String },
        description: { type: String }
    });

    this.model = this._connection.model(this._options.collectionName, this.modelSchema);

    // Emit method to log data
    this.emit = (dataObject) => {
        this.debugMessage('emit: ' + util.inspect(dataObject));

        if (dataObject.logType && dataObject.logType === 'Event') {
            const newEvent = new this.model(dataObject);
            newEvent.save((err) => {
                if (err) this.debugMessage('Error saving event to database: ' + err);
            });
        }
    };

    return this;
};

module.exports = MongooseTransport;
