const mongoose = require('mongoose');
const logger = require('../composables/logger');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL+'1');
        logger.info(`MongoDB connected`);
    } catch (err) {
        logger.error(`Connection error`, err);
        process.exit(1);
    }
};

module.exports = connectDB;