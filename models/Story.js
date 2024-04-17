const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    story_id: Number,
    chapter_id: Number,
    access_id: String,
    isPublished: Boolean,
    updated: Date,
    created: { type: Date, default: Date.now }
});
const StoryModel = mongoose.model('Story', storySchema);

module.exports = StoryModel;
