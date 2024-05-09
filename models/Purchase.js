const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    property_of: String,
    purchase_by: String,
    story_id: String,
    chapter_id: String,
    updated: { type: Date, default: Date.now }  // Automatically handle update timestamps
}, { timestamps: true });  // Automatically adds createdAt and updatedAt fields

const PurchaseModel = mongoose.model('Purchase', purchaseSchema);
module.exports = PurchaseModel;
