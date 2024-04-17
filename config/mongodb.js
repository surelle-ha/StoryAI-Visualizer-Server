const mongoose = require('mongoose');
const logger = require('../helpers/logger');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        logger.info(`MongoDB connected`);
    } catch (err) {
        logger.error(`Connection error`, err);
    }
};

module.exports = connectDB;