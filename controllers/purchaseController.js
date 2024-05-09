const Purchase = require('../helpers/Purchase');

module.exports = {

    validate: async (req, res) => {
        const { property_of, purchase_by, story_id, chapter_id } = req.body;

        const purchaseResult = await Purchase.validate(property_of, purchase_by, story_id, chapter_id)
        
        if(!purchaseResult.success){
            res.status(401).json({message: purchaseResult.message});
        }else{
            res.status(200).json(purchaseResult);
        }
    },

    purchase: async (req, res) => {
        const { property_of, purchase_by, story_id, chapter_id } = req.body;

        const purchaseResult = await Purchase.purchase(property_of, purchase_by, story_id, chapter_id)
        
        if(!purchaseResult.success){
            res.status(401).json({message: purchaseResult.message});
        }else{
            res.status(200).json(purchaseResult);
        }
    },

    refund: async (req, res) => {
        const { property_of, purchase_by, story_id, chapter_id } = req.body;

        const purchaseResult = await Purchase.refund(property_of, purchase_by, story_id, chapter_id)
        
        if(!purchaseResult.success){
            res.status(401).json({message: purchaseResult.message});
        }else{
            res.status(200).json(purchaseResult);
        }
    },

}