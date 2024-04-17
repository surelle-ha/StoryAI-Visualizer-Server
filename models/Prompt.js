const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
    prompt_id: String,
    story_id: String,
    chapter_id: String,
    access_id: String,
    content: String,
    updated: Date,
    created: { type: Date, default: Date.now }
});
const PromptModel = mongoose.model('Prompt', promptSchema);

module.exports = PromptModel;
