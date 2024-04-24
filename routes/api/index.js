var express = require('express');
var router = express.Router();
const story_controller = require('../../controllers/storyController')
const token_controller = require('../../controllers/tokenController')

router.get('/', story_controller.landing_api);

router.get('/statistics/access/count', story_controller.get_user_count)
router.get('/statistics/story/count', story_controller.get_story_count)
router.get('/statistics/prompt/count', story_controller.get_prompt_count)
router.post('/token/fund', token_controller.fund)

module.exports = router;