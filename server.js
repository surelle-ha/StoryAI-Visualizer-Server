const express = require('express');
const cors = require('cors');
const fsp = require('fs').promises;
const fs = require('fs');
const { createWriteStream, existsSync, mkdirSync } = require('fs');
const PlayHTAPI = require('playht');
const googleTTS = require('google-tts-api');
const axios = require('axios');
const path = require('path');
const OpenAI = require("openai");

require('dotenv').config();

// Composaables
const logger = require('./composables/logger');
const searchGoogleImages = require('./composables/searchGoogleImages');

// OpenAI API Key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// PlayHT API Environment
PlayHTAPI.init({
  apiKey: process.env.PLAYHT_API_KEY,
  userId: process.env.PLAYHT_USER_ID,
});

// Environment Variables
const app = express();
const name = process.env.SERVER_NAME;
const base = process.env.SERVER_BASE;
const port = process.env.SERVER_PORT;
const ver = process.env.SERVER_VERS;
const env = process.env.SERVER_ENVN;

// Server Config
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const audioFilesDir = path.join(__dirname, 'audio_files');
if (!existsSync(audioFilesDir)) { mkdirSync(audioFilesDir); }
app.use('/audio', express.static(audioFilesDir));

const storyAssetDir = path.join(__dirname, 'story_archive');
if (!existsSync(storyAssetDir)) { mkdirSync(storyAssetDir); }
app.use('/story_archive', express.static(storyAssetDir));

app.get('/', (req, res) => {
    logger.info(`API ACCESSED`);
    return res.status(200).json(
        {
            status: 'success', 
            app: name,
            message: 'Welcome to StoryAI Visualizer',
            base: base,
            port: port,
            version: ver,
            environment: env,
        }
    );
});

app.post('/api/story/initialize', async(req, res) => {
    const { story_id, chapter_id } = req.body; // Changed from req.query to req.body
    
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    logger.info(`Request from ${userAgent}`);

    if (!story_id || !chapter_id) {
        logger.error(`Missing story_id or chapter_id in the request`);
        return res.status(400).json({
            status: 'error',
            message: 'Missing Story ID or Chapter ID in the request'
        });
    }

    try {
        const storyArchiveDir = path.join(__dirname, 'story_archive');
        if (!fs.existsSync(storyArchiveDir)) {
            fs.mkdirSync(storyArchiveDir);
            logger.info(`Directory 'story_archive' Initialized.`);
        }

        const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
        if (!fs.existsSync(storyDir)) {
            fs.mkdirSync(storyDir);
            logger.info(`Directory 'Story_${story_id}' Initialized.`);
        }

        const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);
        if (!fs.existsSync(chapterDir)) {
            fs.mkdirSync(chapterDir);
            logger.info(`Directory 'Chapter_${chapter_id}' Initialized.`);
        }

        const endTime = new Date();
        const duration = endTime - startTime;

        logger.info(`Search completed`);
        return res.status(200).json({
            status: 'success',
            message: 'Initialization completed',
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent,
            requestHeaders: requestHeaders
        });

    } catch(error) {
        const endTime = new Date();
        const duration = endTime - startTime;

        logger.error(`An error occurred while building story board:`, error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while building story board',
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent,
            requestHeaders: requestHeaders
        });
    }
});

app.post('/api/scenario/initialize', async (req, res) => {
    const { story_id, chapter_id } = req.body;
    
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    logger.info(`Request from ${userAgent}`);

    if (!story_id || !chapter_id) {
        logger.error(`Missing story_id or chapter_id in the request`);
        return res.status(400).json({
            status: 'error',
            message: 'Missing Story ID or Chapter ID in the request'
        });
    }

    try {
        const storyArchiveDir = path.join(__dirname, 'story_archive');
        if (!fs.existsSync(storyArchiveDir)) {
            fs.mkdirSync(storyArchiveDir);
            logger.info(`Directory 'story_archive' Initialized.`);
        }

        const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
        if (!fs.existsSync(storyDir)) {
            fs.mkdirSync(storyDir);
            logger.info(`Directory 'Story_${story_id}' Initialized.`);
        }

        const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);
        if (!fs.existsSync(chapterDir)) {
            fs.mkdirSync(chapterDir);
            logger.info(`Directory 'Chapter_${chapter_id}' Initialized.`);
        }

        // Read existing scene directories and find the next available or new scene number
        const existingScenes = fs.readdirSync(chapterDir)
                             .filter(file => fs.statSync(path.join(chapterDir, file)).isDirectory() && file.startsWith('Scene_'))
                             .map(file => parseInt(file.split('_')[1]))
                             .sort((a, b) => a - b);

        let nextSceneNumber = 1;
        for (let i = 0; i < existingScenes.length; i++) {
            if (existingScenes[i] !== nextSceneNumber) break;
            nextSceneNumber++;
        }

        const nextSceneDir = path.join(chapterDir, `Scene_${nextSceneNumber}`);
        fs.mkdirSync(nextSceneDir);
        logger.info(`Directory '${nextSceneDir}' created for the next scene.`);

        const endTime = new Date();
        const duration = endTime - startTime;

        logger.info(`Scene initialization completed`);
        return res.status(200).json({
            status: 'success',
            sceneNumber: nextSceneNumber,
            message: 'Scene Initialization completed',
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent,
            requestHeaders: requestHeaders
        });

    } catch(error) {
        const endTime = new Date();
        const duration = endTime - startTime;

        logger.error(`An error occurred while building story board:`, error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while building story board',
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent,
            requestHeaders: requestHeaders
        });
    }
});

app.get('/api/scenario/getCount', async (req, res) => {
    const { story_id, chapter_id } = req.query;

    if (!story_id || !chapter_id) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing Story ID or Chapter ID in the request'
        });
    }

    try {
        const storyDir = path.join(__dirname, 'story_archive', `Story_${story_id}`);
        const chapterDir = path.join(storyDir, `Chapter_${chapter_id}`);

        if (fs.existsSync(chapterDir)) {
            const scenes = fs.readdirSync(chapterDir)
                             .filter(file => fs.statSync(path.join(chapterDir, file)).isDirectory() && file.startsWith('Scene_'))
                             .map(scene => ({
                                 id: scene, // Assumes 'Scene_X' is a unique identifier
                                 name: scene // Or any other relevant details
                             }));
            return res.status(200).json({
                status: 'success',
                scenes: scenes,
                message: 'Successfully retrieved scenes'
            });
        } else {
            return res.status(404).json({
                status: 'error',
                message: 'Chapter directory does not exist'
            });
        }
    } catch (error) {
        logger.error('Failed to retrieve scenes', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while retrieving the scenes',
            error: error
        });
    }
});

app.delete('/api/scenario/delete', async(req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;
    
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);

    try {
        if (fs.existsSync(sceneDirPath)) {
            fs.rmdirSync(sceneDirPath, { recursive: true });
            logger.info(`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' deleted.`);
            return res.status(200).json({
                status: 'success',
                message: `Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' deleted successfully`
            });
        } else {
            logger.warn(`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' does not exist.`);
            return res.status(404).json({
                status: 'error',
                message: `Scene directory does not exist`
            });
        }
    } catch (error) {
        logger.error(`Error deleting chapter directory:`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to delete chapter directory',
            error: error
        });
    }
});

app.post('/api/scenario/content/save', async (req, res) => {
    const { story_id, chapter_id, scene_id, scene_content } = req.body;

    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const contentFilePath = path.join(sceneDirPath, 'content.txt');

    try {
        // Ensure the directory exists, create if not
        if (!fs.existsSync(sceneDirPath)) {
            fs.mkdirSync(sceneDirPath, { recursive: true });
            logger.info(`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' created.`);
        }

        // Write the scene content to content.txt
        fs.writeFileSync(contentFilePath, scene_content);
        logger.info(`Content for Scene_${scene_id} saved successfully.`);

        return res.status(201).json({
            status: 'success',
            message: `Content for Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' saved successfully`
        });
    } catch (error) {
        logger.error(`Error saving content for Scene_${scene_id}:`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to save scene content',
            error: error
        });
    }
});

app.post('/api/scenario/content/fetch', async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;

    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const contentFilePath = path.join(sceneDirPath, 'content.txt');

    try {
        // Check if the content file exists
        if (fs.existsSync(contentFilePath)) {
            const scene_content = fs.readFileSync(contentFilePath, 'utf8');
            logger.info(`Content for Scene_${scene_id} fetched successfully.`);

            return res.status(200).json({
                status: 'success',
                message: `Content fetched successfully`,
                data: scene_content
            });
        } else {
            logger.warn(`Content file for Scene_${scene_id} does not exist.`);
            return res.status(404).json({
                status: 'error',
                message: `Content file does not exist`
            });
        }
    } catch (error) {
        logger.error(`Error fetching content for Scene_${scene_id}:`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch scene content',
            error: error
        });
    }
});

app.post('/api/scenario/prompt/save', async (req, res) => {
    const { story_id, chapter_id, scene_id, scene_prompt } = req.body;

    const promptDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const promptFilePath = path.join(promptDirPath, 'prompt.txt');

    try {
        // Ensure the directory exists, create if not
        if (!fs.existsSync(promptDirPath)) {
            fs.mkdirSync(promptDirPath, { recursive: true });
            logger.info(`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' created.`);
        }

        // Write the scene content to content.txt
        fs.writeFileSync(promptFilePath, scene_prompt);
        logger.info(`Content for Scene_${scene_id} saved successfully.`);

        return res.status(201).json({
            status: 'success',
            message: `Content for Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' saved successfully`
        });
    } catch (error) {
        logger.error(`Error saving content for Scene_${scene_id}:`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to save scene content',
            error: error
        });
    }
});

app.post('/api/scenario/prompt/fetch', async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;

    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const contentFilePath = path.join(sceneDirPath, 'prompt.txt');

    try {
        // Check if the content file exists
        if (fs.existsSync(contentFilePath)) {
            const scene_prompt = fs.readFileSync(contentFilePath, 'utf8');
            logger.info(`Prompt for Scene_${scene_id} fetched successfully.`);

            return res.status(200).json({
                status: 'success',
                message: `Prompt fetched successfully`,
                data: scene_prompt
            });
        } else {
            logger.warn(`Prompt file for Scene_${scene_id} does not exist.`);
            return res.status(404).json({
                status: 'error',
                message: `Prompt file does not exist`
            });
        }
    } catch (error) {
        logger.error(`Error fetching prompt for Scene_${scene_id}:`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch scene prompt',
            error: error
        });
    }
});

app.post('/api/scenario/narrate/free/create', async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;

    // Define the directory path for the scene
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);

    // Define the path for the content file and check if it exists
    const contentFilePath = path.join(sceneDirPath, 'prompt.txt');
    if (!fs.existsSync(contentFilePath)) {
        logger.error('Content file does not exist');
        return res.status(404).send('Content file not found');
    }

    // Read the content from the file
    const storyContent = fs.readFileSync(contentFilePath, 'utf8');

    // Settings for Google TTS
    const audio_file = 'narration.mp3';
    const narrate_lang = 'en-US'; // Assuming narration language is English
    const speed = 1; // Normal speed

    try {
        const audioUrls = googleTTS.getAllAudioUrls(storyContent, {
            lang: narrate_lang,
            slow: false,
            speed: speed,
            host: 'https://translate.google.com',
        });

        // Path to save the audio file
        const filePath = path.join(sceneDirPath, audio_file);
        const audioStream = fs.createWriteStream(filePath);

        // Process each audio URL
        for (const audioUrl of audioUrls) {
            const response = await axios.get(audioUrl.url, { responseType: 'stream' });
            await new Promise((resolve, reject) => {
                response.data.pipe(audioStream, { end: false });
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });
        }

        audioStream.end();
        await new Promise((resolve, reject) => {
            audioStream.on('finish', resolve);
            audioStream.on('error', reject);
        });

        logger.info(`Narration Generated for ${audio_file}.`);
        res.status(200).send(`Narration generated successfully: ${filePath}`);
    } catch (error) {
        logger.error(`Error generating audio for ${storyContent}:`, error);
        res.status(500).send('Failed to generate narration');
    }
});

app.get('/api/scene/narrate/fetch', (req, res) => {
    const { story_id, chapter_id, scene_id } = req.query;
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const audioFilePath = path.join(sceneDirPath, 'narration.mp3');

    if (fs.existsSync(audioFilePath)) {
        res.sendFile(audioFilePath);
    } else {
        logger.error('Narration file does not exist');
        res.status(404).send('Narration file not found');
    }
});

app.get('/api/scenario/narrate/premium/voices', async (req, res) => {
    const url = 'https://api.play.ht/api/v2/voices';
    const options = {
        headers: {
            accept: 'application/json',
            Authorization: process.env.PLAYHT_API_KEY, 
            'X-USER-ID': process.env.PLAYHT_USER_ID
        }
    };
    try {
        const response = await axios.get(url, options);
        console.log(response.data); 
        res.json(response.data); 
    } catch (error) {
        console.error('error:', error);
        res.status(500).send('An error occurred while fetching the voices');
    }
});

app.post('/api/scenario/narrate/premium/create', async (req, res) => {
    const { story_id, chapter_id, scene_id, voiceId } = req.body;
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const contentFilePath = path.join(sceneDirPath, 'prompt.txt');

    if (!fs.existsSync(contentFilePath)) {
        console.error('Content file does not exist');
        return res.status(404).send('Content file not found');
    }

    const storyContent = fs.readFileSync(contentFilePath, 'utf8');
    const audio_file = 'narration.mp3';
    const filePath = path.join(sceneDirPath, audio_file);
    const grpcFileStream = fs.createWriteStream(filePath);

    try {
        const grpcStream = await PlayHTAPI.stream(storyContent, {
            voiceId: voiceId, // This ID should come from the frontend selection
            outputFormat: 'mp3', 
            quality: 'draft',
            speed: 1,
            textGuidance: 2.0,
            voiceEngine: 'PlayHT2.0'
        });

        grpcStream.on('data', (chunk) => {
            grpcFileStream.write(chunk);
        });

        await new Promise((resolve, reject) => {
            grpcStream.on('end', resolve);
            grpcStream.on('error', reject);
        });
    } catch (error) {
        console.error(`Error generating audio for ${storyContent}:`, error);
        res.status(500).send('Failed to generate narration');
        return;
    }

    grpcFileStream.end();
    await new Promise((resolve, reject) => {
        grpcFileStream.on('finish', resolve);
        grpcFileStream.on('error', reject);
    });

    console.log(`Narration Generated for ${audio_file}.`);
    res.status(200).send(`Narration generated successfully: ${filePath}`);
});

app.post('/api/scenario/narrate/delete', async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const filePath = path.join(sceneDirPath, 'narration.mp3');

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                logger.error('Failed to delete the audio file', err);
                return res.status(500).send('Failed to delete the audio file');
            }

            logger.info('Audio file deleted successfully.');
            res.status(200).send('Audio file deleted successfully');
        });
    } else {
        logger.warn('Audio file not found');
        res.status(404).send('Audio file not found');
    }
});

app.get('/api/scenario/image/get', (req, res) => {
    const { story_id, chapter_id, scene_id } = req.query;

    if (!story_id || !chapter_id || !scene_id) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required parameters: story_id, chapter_id, scene_id'
        });
    }

    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const imagePath = path.join(sceneDirPath, 'image.png');

    if (fs.existsSync(imagePath)) {
        // Send the path as a URL or a relative path depending on your server setup
        const imageUrl = `/story_archive/Story_${story_id}/Chapter_${chapter_id}/Scene_${scene_id}/image.png`;
        console.log(imageUrl)
        res.json({ imageUrl: imageUrl });
    } else {
        res.status(404).json({
            status: 'error',
            message: 'Image not found.'
        });
    }
});

app.post('/api/scenario/image/free/create', async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const contentFilePath = path.join(sceneDirPath, 'prompt.txt');
    if (!fs.existsSync(contentFilePath)) {
        logger.error('Content file does not exist');
        return res.status(404).send('Content file not found');
    }
    const query = fs.readFileSync(contentFilePath, 'utf8');
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.CSE_ID;
    const imageUrls = await searchGoogleImages(apiKey, cseId, query);

    console.log(imageUrls);

    if (imageUrls.length > 0) {
        const imageUrl = imageUrls[0];
        const imageResponse = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream'
        });
        const fileName = `image.png`;
        const localImagePath = path.join(sceneDirPath, fileName);
        const writer = fs.createWriteStream(localImagePath);
        imageResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', (err) => {
                console.error('Error saving image:', err);
                reject(err);
            });
        });

        logger.info('image.png is created.');
        res.status(200).send('image.png is created');
    } else {
        logger.warn(`Google unable to find image in reference to prompt.`);
        res.status(404).send('Google unable to find image in reference to prompt. Please use AI or local image instead.');
    }
});

app.post('/api/scenario/image/premium/create', async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;

    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const contentFilePath = path.join(sceneDirPath, 'prompt.txt');

    if (!fs.existsSync(contentFilePath)) {
        logger.error('Content file does not exist');
        return res.status(404).send('Content file not found');
    }

    const query = fs.readFileSync(contentFilePath, 'utf8');
    const scene_model = "dall-e-3"; // Replace with the appropriate model name
    const scene_size = "1024x1024"; // Adjust the size according to your needs

    try {
        const imageResponse = await openai.images.generate({
            model: scene_model,
            prompt: "Imagine this is a kid story from a book. Create an Image Story Scene for this Scenario: " + query,
            n: 1,
            size: scene_size,
        });

        console.log('API Response:', imageResponse);

        const imageUrl = imageResponse.data[0].url;

        if (imageUrl) {
            const image = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'stream'
            });

            const fileName = `image.png`;
            if (!fs.existsSync(sceneDirPath)) {
                fs.mkdirSync(sceneDirPath, { recursive: true });
                logger.info(`Directory '${sceneDirPath}' created.`);
            }
            const localImagePath = path.join(sceneDirPath, fileName);
            const writer = fs.createWriteStream(localImagePath);
            image.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', (err) => {
                    console.error('Error saving image:', err);
                    reject(err);
                });
            });

            logger.info(`${fileName} is created.`);
            res.status(200).send(`${fileName} is created`);
        } else {
            logger.error(`No image URL found for ${query}`);
            res.status(404).send('No image URL found.');
        }
    } catch (error) {
        logger.error('Failed to create image due to an error:', error);
        res.status(500).send('Failed to create image');
    }
});






































app.get('/api/story/validate', async(req, res) => {
    const story_id = req.query.story_id;
    const chapter_id = req.query.chapter_id;
    
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    console.log('') || logger.info(`Request from ${userAgent}`);

    if (!story_id || !chapter_id) {
        logger.error(`Missing story_id or chapter_id in the request`);
        return res.status(400).json({
            status: 'error',
            message: 'Missing story_id or chapter_id in the request'
        });
    }

    const storyArchiveDir = path.join(__dirname, 'story_archive');
    const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
    const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);

    try {

        logger.info(`Searching Story_${story_id}`);
        const storyExists = fs.existsSync(storyDir);
        logger.info(`Search for Story_${story_id} completed. Res: ${storyExists}`);
        
        logger.info(`Searching Chapter_${chapter_id}`);
        const chapterExists = fs.existsSync(chapterDir);
        logger.info(`Search for Story_${story_id} completed. Res: ${chapterExists}`);

        const endTime = new Date();
        const duration = endTime - startTime; 

        logger.info(`Search completed`);
        return res.status(200).json({
            status: 'success',
            chapterExist: storyExists && chapterExists,
            message: 'Search completed',
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });

    } catch(error) {

        const endTime = new Date();
        const duration = endTime - startTime; 

        logger.error(`An error occurred while building story board:`, error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while building story board',
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });

    }
});

app.get('/api/story/delete', async (req, res) => {
    const story_id = req.query.story_id;
    const chapter_id = req.query.chapter_id;

    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    console.log('') || logger.info(`Delete request from ${userAgent}`);

    if (!story_id || !chapter_id) {
        logger.error(`Missing story_id or chapter_id in the request`);
        return res.status(400).json({
            status: 'error',
            message: 'Missing story_id or chapter_id in the request'
        });
    }

    const storyArchiveDir = path.join(__dirname, 'story_archive');
    const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
    const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);

    try {
        if (fs.existsSync(chapterDir)) {
            fs.rmSync(chapterDir, { recursive: true }); 
            logger.info(`Chapter_${chapter_id} of Story_${story_id} deleted successfully`);
        } else {
            logger.error(`Chapter_${chapter_id} of Story_${story_id} not found`);
            return res.status(404).json({
                status: 'error',
                message: 'Chapter not found'
            });
        }

        const endTime = new Date();
        const duration = endTime - startTime;

        logger.info(`Chapter deletion completed`);
        return res.status(200).json({
            status: 'success',
            message: 'Chapter deleted successfully',
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });

    } catch (error) {
        const endTime = new Date();
        const duration = endTime - startTime;

        logger.error(`An error occurred while deleting the chapter:`, error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while deleting the chapter',
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });
    }
});

app.post('/api/story/chapter/scenario/get', async (req, res) => {
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    console.log('') || logger.info(`Request from ${userAgent}`);
    try {
        const { story_id, chapter_id, scenario_id } = req.body;
        const isNullOrUndefined = (value) => value === null || value === undefined;
        // Validate Post Body Request
        if (isNullOrUndefined(story_id) || isNullOrUndefined(chapter_id) || isNullOrUndefined(scenario_id)) {
            logger.error('Missing required fields in the request body.');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields in the request body.'
            });
        }
        const storyArchiveDir = path.join(__dirname, 'story_archive');
        const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
        const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);
        const sceneDir = path.join(chapterDir, "Scene_" + scenario_id);

        logger.info(`Searching Story_${story_id}`);
        const storyExists = fs.existsSync(storyDir);
        logger.info(`Search for Story_${story_id} completed. Res: ${storyExists}`);
        
        logger.info(`Searching Chapter_${chapter_id}`);
        const chapterExists = fs.existsSync(chapterDir);
        logger.info(`Search for Story_${story_id} completed. Res: ${chapterExists}`);

        logger.info(`Searching Scene_${scenario_id}`);
        const sceneExists = fs.existsSync(sceneDir);
        logger.info(`Search for Scene_${scenario_id} completed. Res: ${sceneExists}`);

        const filesByExtension = {};
        if(storyExists && chapterExists && sceneExists){
            try {
                const files = fs.readdirSync(sceneDir);
                files.forEach((file) => {
                    const ext = path.extname(file);
        
                    if (!filesByExtension[ext]) {
                        filesByExtension[ext] = [];
                    }
        
                    filesByExtension[ext].push(`${base}:${port}/story_archive/Story_${story_id}/Chapter_${chapter_id}/Scene_${scenario_id}/${file}`);
                });
            } catch (error) {
                logger.error(`Error reading files in ${sceneDir}`);
                throw err;
            }
        }
        
        const endTime = new Date();
        const duration = endTime - startTime;
        
        logger.info(`Asset fetched.`);
        return res.status(200).json({
            status: 'success',
            storyExist: storyExists,
            chapterExist: chapterExists,
            sceneExist: sceneExists,
            fileGenerated: filesByExtension,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });

    } catch(error) {
        const endTime = new Date();
        const duration = endTime - startTime;

        logger.error(`An error occurred while fetching chapter assets:`, error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while fetching chapter assets.',
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });
    }
});

app.post('/api/story/chapter/scenario/create', async (req, res) => {
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    console.log('') || logger.info(`Request from ${userAgent}`);
    try {
        const { user_authority, story_id, chapter_id, chapter_title, chapter_content, scenario_id, narrate_mode, narrate_lang, scene_mode, scene_model, scene_size, overwrite } = req.body;
        const isNullOrUndefined = (value) => value === null || value === undefined;
        // Validate Post Body Request
        if (isNullOrUndefined(story_id) || 
        isNullOrUndefined(chapter_id) || 
        isNullOrUndefined(chapter_title) || 
        isNullOrUndefined(chapter_content) || 
        isNullOrUndefined(scenario_id) || 
        isNullOrUndefined(narrate_mode) || 
        isNullOrUndefined(narrate_lang) || 
        isNullOrUndefined(scene_mode) || 
        isNullOrUndefined(scene_model) || 
        isNullOrUndefined(scene_size) || 
        isNullOrUndefined(user_authority) || 
        isNullOrUndefined(overwrite)) {
            logger.error('Missing required fields in the request body.');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields in the request body.'
            });
        }

        // Overwrite Function
        if(!overwrite){
            logger.warn(`Overwrite option is disabled.`);
            const storyArchiveDirCheck = path.join(__dirname, 'story_archive');
            const storyDirCheck = path.join(storyArchiveDirCheck, "Story_" + story_id);
            const chapterDirCheck = path.join(storyDirCheck, "Chapter_" + chapter_id);
            const sceneDirCheck = path.join(chapterDirCheck, "Scene_" + scenario_id);

            logger.info(`Check overwrite. Searching Chapter_${chapter_id} and Scene_${scenario_id}`);
            const sceneExists = fs.existsSync(sceneDirCheck);
            
            if(sceneExists){
                logger.warn(`Unable to overwrite. Found existing scene.`);
                const endTime = new Date();
                const duration = endTime - startTime; 
                return res.status(200).json({
                    status: 'success',
                    sceneExists: sceneExists,
                    message: 'Unable to overwrite. Found existing scene.',
                    requestTime: startTime.toISOString(),
                    responseSpeed: `${duration} ms`,
                    userAgent: userAgent, 
                    requestHeaders: requestHeaders 
                });
            }
        }else{
            logger.warn(`Overwrite option is enabled.`);
        }
        
        // Create if not exist 'story_archive' directory
        const storyArchiveDir = path.join(__dirname, 'story_archive');
        if (!fs.existsSync(storyArchiveDir)) {
            fs.mkdirSync(storyArchiveDir);
            logger.info(`Directory 'story_archive' created.`);
        }

        // Create if not exist story_id directory
        const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
        if (!fs.existsSync(storyDir)) {
            fs.mkdirSync(storyDir);
            logger.info(`Directory 'Story_${story_id}' created.`);
        }

        // Create if not exist chapter_id directory
        const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);
        if (!fs.existsSync(chapterDir)) {
            fs.mkdirSync(chapterDir);
            logger.info(`Directory 'Chapter_${chapter_id}' created.`);
        }

        // Create if not exist chapter_id directory
        const sceneDir = path.join(chapterDir, "Scene_" + scenario_id);
        if (!fs.existsSync(sceneDir)) {
            fs.mkdirSync(sceneDir);
            logger.info(`Directory 'Scene_${scenario_id}' created.`);
        }

        const contentSrt = '1\n00:00:01,000 --> 10:00:00,000\n' + chapter_content;
        const filePathsrt = path.join(sceneDir, `${chapter_id}_${scenario_id}.srt`);
        fs.writeFileSync(filePathsrt, contentSrt);
        logger.info(`${chapter_id}_${scenario_id}.srt file created.`);

        const filePathsub = path.join(sceneDir, `${chapter_id}_${scenario_id}.sub`);
        fs.writeFileSync(filePathsub, chapter_content);
        logger.info(`${chapter_id}_${scenario_id}.sub file created.`);

        // Generate Story Scene
        // Null
        if(scene_mode === "null") {
            logger.warn(`Null Function is accessed.`);
        // Free Scene Image
        } else if(scene_mode === "free"){
            logger.info(`Free Scene Mode is selected.`);
            const apiKey = process.env.GOOGLE_API_KEY; 
            const cseId = process.env.CSE_ID; 
            const imageUrls = await searchGoogleImages(apiKey, cseId, chapter_content);
            if (imageUrls.length > 0) {
                const imageUrl = imageUrls[0];
                const imageResponse = await axios({
                    method: 'GET',
                    url: imageUrl,
                    responseType: 'stream'
                });
                const fileName = `${chapter_id}_${scenario_id}.png`;
                const localImagePath = path.join(sceneDir, fileName);
                const writer = fs.createWriteStream(localImagePath);
                imageResponse.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', (err) => {
                        console.error('Error saving image:', err);
                        reject(err);
                    });
                });
                logger.info(`${chapter_id}_${scenario_id}.png is created.`);
            } else {
                logger.error(`No images found for ${chapter_content[scenario_id]}`);
            }
            
        // Premium Scene Image
        } else if(scene_mode === "premium") {
            logger.info(`Premium Scene Mode is selected.`);
            try {
                const query = chapter_content;
                if (!query) {
                    console.error('Content for image generation is empty');
                }
    
                const imageResponse = await openai.images.generate({
                    model: scene_model,
                    prompt: "Imagine this is a kid story from a book. Create an Image Story Scene for this Scenario: " + query,
                    n: 1,
                    size: scene_size,
                });
    
                console.log('API Response:', imageResponse);
    
                // Correctly accessing the URL from the API response
                const imageUrl = imageResponse.data[0].url;
    
                if(imageUrl) {
                    const image = await axios({
                        method: 'GET',
                        url: imageUrl,
                        responseType: 'stream'
                    });
    
                    const fileName = `${chapter_id}_${scenario_id}.png`;
                    const localImagePath = path.join(sceneDir, fileName);
                    const writer = fs.createWriteStream(localImagePath);
                    image.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', (err) => {
                            console.error('Error saving image:', err);
                            reject(err);
                        });
                    });
                    logger.info(`${chapter_id}_${scenario_id}.png is created.`);
                } else {
                    logger.error(`No image URL found for ${query}`);
                }
            } catch (error) {
                logger.error(`Error generating image for content:`, chapter_content, 'Error:', error);
            }
        } else {
            logger.error(`Something went wrong!`);
            throw 500;
        }


        // Generate Story Narration
        // Null
        if(narrate_mode === "null") {
            logger.warn(`Null Function is accessed.`);
        // gTTS
        } else if(narrate_mode === "free"){
            logger.info(`Free Narration Mode is selected.`);
            const speed = 1;
            try {
                const audio_file = `${chapter_id}_${scenario_id}.mp3`;
                const audioUrls = googleTTS.getAllAudioUrls(chapter_content, {
                    lang: narrate_lang,
                    slow: false,
                    speed: speed,
                    host: 'https://translate.google.com',
                });
                const filePath = path.join(sceneDir, audio_file);
                const audioStream = fs.createWriteStream(filePath);

                // Processing each audio URL
                for (const audioUrl of audioUrls) {
                    const response = await axios.get(audioUrl.url, { responseType: 'stream' });
                    await new Promise((resolve, reject) => {
                        response.data.pipe(audioStream, { end: false });
                        response.data.on('end', resolve);
                        response.data.on('error', reject);
                    });
                }

                audioStream.end();
                await new Promise((resolve, reject) => {
                    audioStream.on('finish', resolve);
                    audioStream.on('error', reject);
                });

                logger.info(`Narration Generated for ${audio_file}.`);
            } catch (error) {
                logger.error(`Error generating audio for ${story_content}:`, error);
            }

        // PlayHT
        } else if(narrate_mode === "premium"){
            logger.info(`Premium Narration Mode is selected.`);
            try {
                const audio_file = `${chapter_id}_${scenario_id}.mp3`;
                const filePath = path.join(sceneDir, audio_file);
                const grpcFileStream = fs.createWriteStream(filePath, { flags: 'w' });
                const grpcStream = await PlayHTAPI.stream(chapter_content, {
                    voiceId: "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json",
                    outputFormat: 'mp3', 
                    quality: 'draft',
                    speed: 1,
                    textGuidance: 2.0,
                    voiceEngine: 'PlayHT2.0'
                });
                grpcStream.on('data', (chunk) => {
                    grpcFileStream.write(chunk);
                });
                await new Promise((resolve, reject) => {
                    grpcStream.on('end', resolve);
                    grpcStream.on('error', reject);
                });
                grpcFileStream.end();
                logger.error(`Premium narration generated for ${audio_file}`);
            } catch (error) {
                logger.error(`Error generating audio for ${chapter_content}:`, error);
            }
        } else {
            logger.error(`Something went wrong!`);
            throw 500;
        }

        const filesByExtension = {};
        try {
            const files = fs.readdirSync(sceneDir);

            files.forEach((file) => {
                const ext = path.extname(file);

                if (!filesByExtension[ext]) {
                    filesByExtension[ext] = [];
                }

                filesByExtension[ext].push(`${base}/story_archive/Story_${story_id}/Chapter_${chapter_id}/Scene_${scenario_id}/${file}`);
            });

        } catch (err) {
            logger.error(`Error reading files in ${chapterDir}`);
            throw err;
        }

        // Calculate duration
        const endTime = new Date();
        const duration = endTime - startTime; 

        // Return Result
        logger.info(`Story asset completed.`);
        return res.status(200).json({
            status: 'success',
            fileGenerated: filesByExtension,
            content: chapter_content,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });

    } catch(error) {
        const endTime = new Date();
        const duration = endTime - startTime; 

        logger.error(`An error occurred while building story board:`, error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while building story board',
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });
    }
});

/*
app.post('/api/story/chapter/create', async (req, res) => {
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    console.log('') || logger.info(`Request from ${userAgent}`);
    try {
        const { user_authority, story_id, chapter_id, chapter_title, chapter_content, narrate_mode, narrate_lang, scene_mode, scene_model, scene_size, overwrite } = req.body;
        const isNullOrUndefined = (value) => value === null || value === undefined;
        // Validate Post Body Request
        if (isNullOrUndefined(story_id) || 
        isNullOrUndefined(chapter_id) || 
        isNullOrUndefined(chapter_title) || 
        isNullOrUndefined(chapter_content) || 
        isNullOrUndefined(narrate_mode) || 
        isNullOrUndefined(narrate_lang) || 
        isNullOrUndefined(scene_mode) || 
        isNullOrUndefined(scene_model) || 
        isNullOrUndefined(scene_size) || 
        isNullOrUndefined(user_authority) || 
        isNullOrUndefined(overwrite)) {
            logger.error('Missing required fields in the request body.');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields in the request body.'
            });
        }

        // Overwrite Function
        if(!overwrite){
            logger.warn(`Overwrite option is disabled.`);
            const storyArchiveDirCheck = path.join(__dirname, 'story_archive');
            const storyDirCheck = path.join(storyArchiveDirCheck, "Story_" + story_id);
            const chapterDirCheck = path.join(storyDirCheck, "Chapter_" + chapter_id);

            logger.info(`Check overwrite. Searching Chapter_${chapter_id}`);
            const chapterExists = fs.existsSync(chapterDirCheck);
            
            if(chapterExists){
                logger.warn(`Unable to overwrite. Found existing chapter.`);
                const endTime = new Date();
                const duration = endTime - startTime; 
                return res.status(200).json({
                    status: 'success',
                    chapterExist: chapterExists,
                    message: 'Unable to overwrite. Found existing chapter.',
                    requestTime: startTime.toISOString(),
                    responseSpeed: `${duration} ms`,
                    userAgent: userAgent, 
                    requestHeaders: requestHeaders 
                });
            }
        }else{
            logger.warn(`Overwrite option is enabled.`);
        }
        
        // Create if not exist 'story_archive' directory
        const storyArchiveDir = path.join(__dirname, 'story_archive');
        if (!fs.existsSync(storyArchiveDir)) {
            fs.mkdirSync(storyArchiveDir);
            logger.info(`Directory 'story_archive' created.`);
        }

        // Create if not exist story_id directory
        const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
        if (!fs.existsSync(storyDir)) {
            fs.mkdirSync(storyDir);
            logger.info(`Directory 'Story_${story_id}' created.`);
        }

        // Create if not exist chapter_id directory
        const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);
        if (!fs.existsSync(chapterDir)) {
            fs.mkdirSync(chapterDir);
            logger.info(`Directory 'Chapter_${chapter_id}' created.`);
        }

        // Loop through chapter_content and save each part in a file
        chapter_content.forEach((content, index) => {
            contentSrt = '1\n00:00:01,000 --> 10:00:00,000\n' + content;
            const filePathsrt = path.join(chapterDir, `${chapter_id}_${index}.srt`);
            fs.writeFileSync(filePathsrt, contentSrt);
            logger.info(`${chapter_id}_${index}.srt file created.`);

            const filePathsub = path.join(chapterDir, `${chapter_id}_${index}.sub`);
            fs.writeFileSync(filePathsub, content);
            logger.info(`${chapter_id}_${index}.sub file created.`);
        });

        // Generate Story Scene
        // Null
        if(scene_mode === "null") {
            logger.warn(`Null Function is accessed.`);
        // Free Scene Image
        } else if(scene_mode === "free"){
            logger.info(`Free Scene Mode is selected.`);
            const apiKey = process.env.GOOGLE_API_KEY; 
            const cseId = process.env.CSE_ID; 
            for (let i = 0; i < chapter_content.length; i++) {
                const imageUrls = await searchGoogleImages(apiKey, cseId, chapter_content[i]);
                if (imageUrls.length > 0) {
                    const imageUrl = imageUrls[0];
                    const imageResponse = await axios({
                        method: 'GET',
                        url: imageUrl,
                        responseType: 'stream'
                    });
                    const fileName = `${chapter_id}_${i}.png`;
                    const sceneDir = path.join(chapterDir, "Scene_" + i);
                    if (!fs.existsSync(sceneDir)) {
                        fs.mkdirSync(sceneDir);
                        logger.info(`Directory 'Scene_${chapter_id}' created.`);
                    }
                    const localImagePath = path.join(sceneDir, fileName);
                    const writer = fs.createWriteStream(localImagePath);
                    imageResponse.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', (err) => {
                            console.error('Error saving image:', err);
                            reject(err);
                        });
                    });
                    logger.info(`${chapter_id}_${i}.png is created.`);
                } else {
                    logger.error(`No images found for ${chapter_content[i]}`);
                }
            }
            
        // Premium Scene Image
        } else if(scene_mode === "premium") {
            logger.info(`Premium Scene Mode is selected.`);
            for (let i = 0; i < chapter_content.length; i++) {
                try {
                    const query = chapter_content[i];
                    if (!query) {
                        console.error('Content for image generation is empty');
                        continue;
                    }
        
                    const imageResponse = await openai.images.generate({
                        model: scene_model,
                        prompt: "Imagine this is a kid story from a book. Create an Image Story Scene for this Scenario: " + query,
                        n: 1,
                        size: scene_size,
                    });
        
                    console.log('API Response:', imageResponse);
        
                    // Correctly accessing the URL from the API response
                    const imageUrl = imageResponse.data[0].url;
        
                    if(imageUrl) {
                        const image = await axios({
                            method: 'GET',
                            url: imageUrl,
                            responseType: 'stream'
                        });
        
                        const fileName = `${chapter_id}_${i}.png`;
                        const sceneDir = path.join(chapterDir, "Scene_" + i);
                        if (!fs.existsSync(sceneDir)) {
                            fs.mkdirSync(sceneDir);
                            logger.info(`Directory 'Scene_${chapter_id}' created.`);
                        }
                        const localImagePath = path.join(sceneDir, fileName);
                        const writer = fs.createWriteStream(localImagePath);
                        image.data.pipe(writer);
                        await new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', (err) => {
                                console.error('Error saving image:', err);
                                reject(err);
                            });
                        });
                        logger.info(`${chapter_id}_${i}.png is created.`);
                    } else {
                        logger.error(`No image URL found for ${query}`);
                    }
                } catch (error) {
                    logger.error(`Error generating image for content:`, chapter_content[i], 'Error:', error);
                }
            }
        } else {
            logger.error(`Something went wrong!`);
            throw 500;
        }


        // Generate Story Narration
        // Null
        if(narrate_mode === "null") {
            logger.warn(`Null Function is accessed.`);
        // gTTS
        } else if(narrate_mode === "free"){
            logger.info(`Free Narration Mode is selected.`);
            const speed = 1;
            for (let i = 0; i < chapter_content.length; i++) {
                try {
                    const audio_file = `${chapter_id}_${i}.mp3`;
                    const audioUrls = googleTTS.getAllAudioUrls(chapter_content[i], {
                        lang: narrate_lang,
                        slow: false,
                        speed: speed,
                        host: 'https://translate.google.com',
                    });
                    const filePath = path.join(chapterDir, audio_file);
                    const audioStream = fs.createWriteStream(filePath);

                    // Processing each audio URL
                    for (const audioUrl of audioUrls) {
                        const response = await axios.get(audioUrl.url, { responseType: 'stream' });
                        await new Promise((resolve, reject) => {
                            response.data.pipe(audioStream, { end: false });
                            response.data.on('end', resolve);
                            response.data.on('error', reject);
                        });
                    }

                    audioStream.end();
                    await new Promise((resolve, reject) => {
                        audioStream.on('finish', resolve);
                        audioStream.on('error', reject);
                    });

                    logger.info(`Narration Generated for ${audio_file}.`);
                } catch (error) {
                    logger.error(`Error generating audio for ${story_content[i]}:`, error);
                }
            }

        // PlayHT
        } else if(narrate_mode === "premium"){
            logger.info(`Premium Narration Mode is selected.`);
            for (let i = 0; i < chapter_content.length; i++) {
                try {
                    const audio_file = `${chapter_id}_${i}.mp3`;
                    const filePath = path.join(chapterDir, audio_file);
                    const grpcFileStream = fs.createWriteStream(filePath, { flags: 'w' });
                    const grpcStream = await PlayHTAPI.stream(chapter_content[i], {
                        voiceId: "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json",
                        outputFormat: 'mp3', 
                        quality: 'draft',
                        speed: 1,
                        textGuidance: 2.0,
                        voiceEngine: 'PlayHT2.0'
                    });
                    grpcStream.on('data', (chunk) => {
                        grpcFileStream.write(chunk);
                    });
                    await new Promise((resolve, reject) => {
                        grpcStream.on('end', resolve);
                        grpcStream.on('error', reject);
                    });
                    grpcFileStream.end();
                    logger.error(`Premium narration generated for ${audio_file}`);
                } catch (error) {
                    logger.error(`Error generating audio for ${chapter_content[i]}:`, error);
                }
            }
        } else {
            logger.error(`Something went wrong!`);
            throw 500;
        }

        const filesByExtension = {};
        try {
            const files = fs.readdirSync(chapterDir);

            files.forEach((file) => {
                const ext = path.extname(file);

                if (!filesByExtension[ext]) {
                    filesByExtension[ext] = [];
                }

                filesByExtension[ext].push(`${base}/story_archive/Story_${story_id}/Chapter_${chapter_id}/${file}`);
            });

        } catch (err) {
            logger.error(`Error reading files in ${chapterDir}`);
            throw err;
        }

        // Calculate duration
        const endTime = new Date();
        const duration = endTime - startTime; 

        // Return Result
        logger.info(`Story asset completed.`);
        return res.status(200).json({
            status: 'success',
            fileGenerated: filesByExtension,
            content: chapter_content,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });

    } catch(error) {
        const endTime = new Date();
        const duration = endTime - startTime; 

        logger.error(`An error occurred while building story board:`, error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while building story board',
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent, 
            requestHeaders: requestHeaders 
        });
    }
});

*/

/** SCENERY ENDPOINT **/
app.get('/api/story/scenery/google/create', async(req, res) => {
    const query = req.query.content;
    if (!query) {
        return res.status(400).json(
            {
                status: 'error', 
                message: 'Query parameter `content` is required'
            }
        );
    }
    const apiKey = process.env.GOOGLE_API_KEY; 
    const cseId = process.env.CSE_ID; 
    const imageUrls = await searchGoogleImages(apiKey, cseId, query);

    if (imageUrls.length > 0) {
        res.send({ imageUrl: imageUrls[0] });
    } else {
        return res.status(404).json(
            {
                status: 'error', 
                message: 'No images found.'
            }
        );
    }
});

app.get('/api/story/scenery/ai/create', async (req, res) => {
    try {
        const query = req.query.content;
        if (!query) {
            return res.status(400).json({
                status: 'error',
                message: 'Query parameter `content` is required'
            });
        }

        const image = await openai.images.generate({
            model: "dall-e-3",
            prompt: "Imagine this is a kid story from a book. Create an Image Story Scene for this Scenario: " + query,
            n: 1,
            size: "1024x1024",
        });

        // Log the full API response for debugging
        console.log('API Response:', image);

        if(image){
            res.status(200).json({
                status: 'success',
                message: 'Image Generation Completed',
                url: image,
            });
        }else{
            throw 500;
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while generating the image',
            error: error
        });
    }
});

/** NARRATION ENDPOINT **/
app.get('/api/story/narrate/free/:lang/create', async (req, res) => {
    try {
        const query = req.query.content;
        if (!query) {
            return res.status(400).json(
                {
                    status: 'error', 
                    message: 'Query parameter `content` is required'
                }
            );
        }
        const sentences = query;
        const audio_file = (new Date()).valueOf().toString() + '.mp3';
        const lang = req.params.lang;
        const speed = 1; 

        const audioUrls = googleTTS.getAllAudioUrls(sentences, {
            lang: lang,
            slow: false,
            speed: speed,
            host: 'https://translate.google.com',
        });

        const filePath = path.join(audioFilesDir, audio_file);
        const audioStream = createWriteStream(filePath);

        for (const audioUrl of audioUrls) {
            const response = await axios.get(audioUrl.url, { responseType: 'stream' });
            response.data.pipe(audioStream, { end: false });
            await new Promise((resolve, reject) => {
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });
        }

        audioStream.end();

        audioStream.on('finish', function () {
            res.json(
                {
                    status: 'success',
                    message: 'Free narration generated.',
                    file: audio_file,
                    language: lang,
                    text: sentences,
                    url: `${base}:${port}/audio/${audio_file}`,
                    library: 'google-tts-api',
                }
            );
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json(
            {
                status: 'error',
                message: 'An error occurred while generating the narration',
                error: error
            }
        );
    }
});

app.get('/api/story/narrate/premium/en/create', async (req, res) => {
  try {
    const query = req.query.content;
    if (!query) {
        return res.status(400).json(
            {
                status: 'error', 
                message: 'Query parameter `content` is required'
            }
        );
    }
    const sentences = [query];
    const audio_file = (new Date()).valueOf().toString() + '.mp3';
    const filePath = path.join(audioFilesDir, audio_file);
    const grpcFileStream = createWriteStream(filePath, { flags: 'w' });

    for (let sentence of sentences) {
      const grpcStream = await PlayHTAPI.stream(sentence, {
        voiceId: "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json",
        outputFormat: 'mp3', 
        quality: 'draft',
        speed: 1,
        textGuidance: 2.0,
        voiceEngine: 'PlayHT2.0'
      });

      grpcStream.on('data', (chunk) => {
        grpcFileStream.write(chunk);
      });

      await new Promise((resolve, reject) => {
        grpcStream.on('end', resolve);
        grpcStream.on('error', reject);
      });
    }

    grpcFileStream.end();

    res.json(
        { 
            status: 'success', 
            message: 'Premium narration generated.',
            file: audio_file,
            language: 'en',
            text: sentences,
            url: `${base}:${port}/audio/${audio_file}`,
            library: 'PlayHT',
        }
    );
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json(
        {
            status: 'error',
            message: 'An error occurred while generating the narration',
            error: error
        }
    );
  }
});

app.get('/api/story/narrate/audios/list', async (req, res) => {
    try {
      const files = await fs.readdir(audioFilesDir);
      const mp3Files = files.filter(file => file.endsWith('.mp3'));
      res.json({ 
        status: 'success', 
        mp3Files: mp3Files 
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json(
            {
                status: 'error',
                message: 'An error occurred while retrieving the files',
                error: error
            }
        );
    }
});

app.get('/api/story/narrate/audios/clear', async (req, res) => {
    try {
      const files = await fs.readdir(audioFilesDir);
      for (const file of files) {
        await fs.unlink(path.join(audioFilesDir, file));
      }
      res.json(
        { 
            status: 'success', 
            message: 'All audio files have been deleted successfully.' 
        }
    );
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json(
            {
                status: 'error',
                message: 'An error occurred while deleting the files',
                error: error
            }
        );
    }
});

app.listen(port, () => {
    console.clear();
    console.log(`AI STORY PROCESSOR SERVER RUNNING @ [ ${base}:${port} ]`);
});
