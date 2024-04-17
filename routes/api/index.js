var express = require('express');
var router = express.Router();
const controller = require('../../controllers/storyController')

router.get('/', controller.landing_api);

router.get('/statistics/access/count', controller.get_user_count)
router.get('/statistics/story/count', controller.get_story_count)
router.get('/statistics/prompt/count', controller.get_prompt_count)

module.exports = router;