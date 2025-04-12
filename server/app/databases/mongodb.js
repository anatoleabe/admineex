const log = require('../utils/log');
const mongoose = require('mongoose');
const configuration = require('../controllers/configuration.js');

// Improved MongoDB connection options
const mongodbOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds for server selection
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
    retryWrites: true,
    retryReads: true
};

// Get MongoDB URL from configuration
const mongodbURL = configuration.getConf().mongo;

// Set mongoose to use native promises
mongoose.Promise = global.Promise;


// Handle process termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    log.info('MongoDB connection closed due to application termination');
    process.exit(0);
});

// Improved connection function with retry logic
const connectWithRetry = async () => {
    try {
        await mongoose.connect(mongodbURL, mongodbOptions);

        // Verify connection by getting server info
        const admin = new mongoose.mongo.Admin(mongoose.connection.db);
        const info = await admin.buildInfo();
        log.info(`MongoDB ${info.version} via Mongoose ${mongoose.version} is ready on ${mongodbURL}`);
    } catch (err) {
        log.error(`Failed to connect to MongoDB (${mongodbURL}):`, err);

        // Retry after 5 seconds
        setTimeout(connectWithRetry, 5000);
    }
};

// Start the connection
connectWithRetry().then();

module.exports = mongoose;