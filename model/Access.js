const mongoose = require('mongoose');

const accessSchema = new mongoose.Schema({
    access_id: String,
    points: Number,
    updated: Date,
    created: { type: Date, default: Date.now }
});
const AccessModel = mongoose.model('Access', accessSchema);

module.exports = AccessModel;
