const Token = require('../helpers/Token');

module.exports = {

    fund: async (req, res) => {
        const { access_id, amount } = req.body;

        const tokenResult = await Token.fund(access_id, amount)
        
        if(!tokenResult.success){
            res.status(401).json({message: tokenResult.message});
        }else{
            res.status(200).json(tokenResult);
        }
    },

    deduct: async (req, res) => {
        const { access_id, amount } = req.body;

        const tokenResult = await Token.deduct(access_id, amount)

        if(!tokenResult.success) {
            res.status(401).json({message: tokenResult.message});
        }else{
            res.status(200).json(tokenResult)
        }
    },

}