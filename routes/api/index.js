var express = require('express');
var router = express.Router();
const story_controller = require('../../controllers/storyController')
const token_controller = require('../../controllers/tokenController')
const purchase_controller = require('../../controllers/purchaseController')

router.get('/', story_controller.landing_api);

router.get('/statistics/access/count', story_controller.get_user_count)
router.get('/statistics/story/count', story_controller.get_story_count)
router.get('/statistics/prompt/count', story_controller.get_prompt_count)
router.post('/token/fund', token_controller.fund)
router.post('/token/deduct', token_controller.deduct)
router.post('/asset/validate', purchase_controller.validate)
router.post('/asset/purchase', purchase_controller.purchase)
router.post('/asset/refund', purchase_controller.refund)

module.exports = router;