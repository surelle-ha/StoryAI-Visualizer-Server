const AccessModel = require('../models/Access')
const StoryModel = require('../models/Story')
const PromptModel = require('../models/Prompt')

const logger = require('../helpers/logger');
const { ENV_NAME, ENV_BASE, ENV_PORT, ENV_VER, ENV_TYPE } = require('../config/environment');

module.exports = {

    landing_api: (req, res) => {
        logger.info(`API ACCESSED`);
        return res.status(200).json(
            {
                status: 'success', 
                app: ENV_NAME,
                message: 'Welcome to StoryAI Visualizer',
                base: ENV_BASE,
                port: ENV_PORT,
                version: ENV_VER,
                environment: ENV_TYPE,
            }
        );
    },

    get_user_count: async (req, res) => {
        try {
            const result = await AccessModel.aggregate([
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        earliestDate: { $min: '$created' },
                        latestDate: { $max: '$created' }
                    }
                },
                {
                    $project: {
                        count: 1,
                        earliestDate: { $dateToString: { format: "%Y %B %d", date: "$earliestDate" } },
                        latestDate: { $dateToString: { format: "%Y %B %d", date: "$latestDate" } }
                    }
                }
            ]);
    
            return res.status(200).json({
                status: 'success',
                count: result[0].count,
                earliestDate: result[0].earliestDate,
                latestDate: result[0].latestDate
            });
        } catch (error) {
            logger.error(`Error fetching user count: ${error}`);
            return res.status(500).json({
                status: 'failed',
                error: error
            });
        }
    },
    
    get_story_count: async (req, res) => {
        try {
            const result = await StoryModel.aggregate([
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        earliestDate: { $min: '$created' },
                        latestDate: { $max: '$created' }
                    }
                },
                {
                    $project: {
                        count: 1,
                        earliestDate: { $dateToString: { format: "%Y %B %d", date: "$earliestDate" } },
                        latestDate: { $dateToString: { format: "%Y %B %d", date: "$latestDate" } }
                    }
                }
            ]);
    
            return res.status(200).json({
                status: 'success',
                count: result[0].count,
                earliestDate: result[0].earliestDate,
                latestDate: result[0].latestDate
            });
        } catch (error) {
            logger.error(`Error fetching story count: ${error}`);
            return res.status(500).json({
                status: 'failed',
                error: error
            });
        }
    },
    
    get_prompt_count: async (req, res) => {
        try {
            const result = await PromptModel.aggregate([
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        earliestDate: { $min: '$created' },
                        latestDate: { $max: '$created' }
                    }
                },
                {
                    $project: {
                        count: 1,
                        earliestDate: { $dateToString: { format: "%Y %B %d", date: "$earliestDate" } },
                        latestDate: { $dateToString: { format: "%Y %B %d", date: "$latestDate" } }
                    }
                }
            ]);
    
            return res.status(200).json({
                status: 'success',
                count: result[0].count,
                earliestDate: result[0].earliestDate,
                latestDate: result[0].latestDate
            });
        } catch (error) {
            logger.error(`Error fetching prompt count: ${error}`);
            return res.status(500).json({
                status: 'failed',
                error: error
            });
        }
    },

    get_prompt_all: async (req, res) => {
        try {
            // Fetching all prompts and sorting them by 'created' field in descending order
            const prompts = await PromptModel.find({}).sort({ created: -1 });  
            return res.status(200).json({
                status: 'success',
                data: prompts
            });
        } catch (error) {
            logger.error(`Error fetching all prompts: ${error}`);
            return res.status(500).json({
                status: 'failed',
                error: error
            });
        }
    }    
    

}