const PurchaseModel = require('../models/Purchase');

module.exports = {

    async getAllTransactions() {
        try {
            const transactions = await PurchaseModel.find({});
            return {
                success: true,
                message: "Transactions retrieved successfully.",
                data: transactions
            };
        } catch (error) {
            console.log(error);
            return {
                success: false,
                message: 'Failed to retrieve transactions.'
            };
        }
    },
    
    async validate(property_of, purchase_by, story_id, chapter_id) {
        try {
            const existingPurchase = await PurchaseModel.findOne({
                property_of: property_of,
                purchase_by: purchase_by,
                story_id: story_id,
                chapter_id: chapter_id
            });

            if (existingPurchase) {
                return {
                    success: true,
                    message: "Purchase record exists.",
                };
            }else{
                return {
                    success: false,
                    message: "Purchase record does not exists.",
                };
            }
        } catch (error) {
            console.log(error);
            return { 
                success: false,
                message: 'Database operation failed',
            };
        }
    },

    async purchase(property_of, purchase_by, story_id, chapter_id) {
        try {
            // First check if a similar record already exists
            const existingPurchase = await PurchaseModel.findOne({
                property_of: property_of,
                purchase_by: purchase_by,
                story_id: story_id,
                chapter_id: chapter_id
            });

            if (existingPurchase) {
                return {
                    success: false,
                    message: "Purchase record already exists.",
                };
            }

            // If no existing record, create a new purchase
            const newPurchase = {
                property_of: property_of,
                purchase_by: purchase_by,
                story_id: story_id,
                chapter_id: chapter_id,
                updated: new Date()  // Explicitly set if needed, otherwise schema handles it
            };

            const response = await PurchaseModel.create(newPurchase);

            if (response) {
                return {
                    success: true,
                    message: "Successfully purchased asset.",
                };
            } else {
                return { 
                    success: false,
                    message: 'Error purchasing asset.'
                };
            }
        } catch (error) {
            console.log(error);
            return { 
                success: false,
                message: 'Database operation failed',
            };
        }
    },

    async refund(property_of, purchase_by, story_id, chapter_id) {
        try {
            // First check if a similar record already exists
            const existingPurchase = await PurchaseModel.findOne({
                property_of: property_of,
                purchase_by: purchase_by,
                story_id: story_id,
                chapter_id: chapter_id
            });

            if (!existingPurchase) {
                return {
                    success: false,
                    message: "Purchase record does not exists.",
                };
            }

            const response = await PurchaseModel.findOneAndDelete({
                property_of: property_of,
                purchase_by: purchase_by,
                story_id: story_id,
                chapter_id: chapter_id
            });

            if (response) {
                return {
                    success: true,
                    message: "Successfully refunded and deleted purchase record.",
                    refundedDocument: response  // Provides details of the deleted document
                };
            } else {
                return { 
                    success: false,
                    message: 'No matching purchase record found to delete.'
                };
            }
        } catch (error) {
            console.log(error);
            return { 
                success: false,
                message: 'Database operation failed during refund.'
            };
        }
    }
};
