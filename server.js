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
const mongoose = require('mongoose');
const connectDB = require('./config/Database');

require('dotenv').config();

connectDB();
const AccessModel = require('./model/Access')
const StoryModel = require('./model/Story')

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

const imagesFilesDir = path.join(__dirname, 'public_images');
if (!existsSync(imagesFilesDir)) { mkdirSync(imagesFilesDir); }
app.use('/public_images', express.static(imagesFilesDir));

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

app.post('/api/story/initialize', async(req, res) => { /* CHECKED */
    const { access_id, story_id, chapter_id } = req.body; // Changed from req.query to req.body
    
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    logger.info(`Request from ${userAgent}`);

    if (!access_id || !story_id || !chapter_id) {
        logger.error(`Missing access_id, story_id or chapter_id in the request`);
        return res.status(400).json({
            status: 'error',
            message: 'Missing Story ID or Chapter ID in the request'
        });
    }

    try {
        let story = await StoryModel.findOne({ story_id: story_id });

        if (!story) {
            // Upsert access record
            const access = await AccessModel.findOneAndUpdate(
                { access_id: access_id },
                { 
                    $setOnInsert: { points: 100, created: new Date() },
                    $set: { updated: new Date() }
                },
                { new: true, upsert: true }
            );

            // Upsert story record
            story = await StoryModel.findOneAndUpdate(
                { story_id: story_id, chapter_id: chapter_id, access_id: access_id, isPublished: false },
                { 
                    $setOnInsert: { created: new Date() },
                    $set: { updated: new Date() }
                },
                { new: true, upsert: true }
            );
        }

        if (story.access_id !== access_id) {
            return res.json({
                status: 'failed',
                message: 'Authorization Failed'
            });
        }

        const accessing_user = await AccessModel.findOne(
            {
                access_id: access_id,
            }
        );
        
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
            access: accessing_user,
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

app.post('/api/scenario/initialize', async (req, res) => { /* CHECKED */
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

app.get('/api/scenario/getCount', async (req, res) => { /* CHECKED */
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

app.delete('/api/scenario/delete', async(req, res) => { /* CHECKED */
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

app.post('/api/scenario/content/save', async (req, res) => { /* CHECKED */
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

app.post('/api/scenario/content/fetch', async (req, res) => { /* CHECKED */
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

app.post('/api/scenario/prompt/save', async (req, res) => { /* CHECKED */
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

app.post('/api/scenario/prompt/fetch', async (req, res) => { /* CHECKED */
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

app.post('/api/scenario/narrate/free/create', async (req, res) => { /* CHECKED */
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

app.get('/api/scene/narrate/fetch', (req, res) => { /* CHECKED */
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

app.get('/api/scenario/narrate/premium/voices', async (req, res) => { /* CHECKED */
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

app.post('/api/scenario/narrate/premium/create', async (req, res) => {  /* CHECKED */
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

app.post('/api/scenario/narrate/delete', async (req, res) => {  /* CHECKED */
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

app.get('/api/scenario/image/get', (req, res) => { /* CHECKED */
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

app.post('/api/scenario/image/delete', async (req, res) => {  /* CHECKED */
    const { story_id, chapter_id, scene_id } = req.body;
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`, `Scene_${scene_id}`);
    const filePath = path.join(sceneDirPath, 'image.png');

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                logger.error('Failed to delete the image file', err);
                return res.status(500).send('Failed to delete the image file');
            }

            logger.info('Image file deleted successfully.');
            res.status(200).send('Image file deleted successfully');
        });
    } else {
        logger.warn('Image file not found');
        res.status(404).send('Image file not found');
    }
});

app.post('/api/scenario/image/free/create', async (req, res) => {   /* CHECKED */
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

app.post('/api/scenario/image/premium/create', async (req, res) => { /* CHECKED */
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
                writer.on('finish', async () => {
                    logger.info(`${fileName} is created.`);
                    
                    // Now copy the file to public_images directory
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const publicImagePath = path.join(__dirname, 'public_images', `image_${timestamp}.png`);
                    fs.copyFile(localImagePath, publicImagePath, (err) => {
                        if (err) {
                            logger.error('Error copying image to public directory:', err);
                            res.status(500).send('Error copying image to public directory');
                        } else {
                            logger.info(`Image copied to public directory.`);
                            res.status(200).send(`${fileName} is created and copied to public directory`);
                        }
                    });
                });
                writer.on('error', (err) => {
                    console.error('Error saving image:', err);
                    reject(err);
                });
            });
        } else {
            logger.error(`No image URL found for ${query}`);
            res.status(404).send('No image URL found.');
        }
    } catch (error) {
        logger.error('Failed to create image due to an error:', error);
        res.status(500).send('Failed to create image');
    }
});

app.get('/api/scenario/image/public/fetch', (req, res) => {
    fs.readdir(imagesFilesDir, (err, files) => {
        if (err) {
            console.error('Failed to read directory:', err);
            return res.status(500).send('Error reading image directory');
        }
        const imageUrls = files.filter(file => file.endsWith('.png'))
                               .map(file => `${base}/public_images/${file}`);
        res.json(imageUrls);
    });
});

app.post('/api/scenario/complete/fetch', async (req, res) => {
    const { story_id, chapter_id } = req.body;
    const sceneDirPath = path.join(__dirname, 'story_archive', `Story_${story_id}`, `Chapter_${chapter_id}`);
    
    try {
        const scenes = fs.readdirSync(sceneDirPath);
        const results = {};

        for (const scene of scenes) {
            const scenePath = path.join(sceneDirPath, scene);
            const files = fs.readdirSync(scenePath);
            console.log(files)

            if (files.includes('narration.mp3') && files.includes('image.png') && files.includes('content.txt')) {
                results[scene] = {
                    sound: `${base}/story_archive/${path.join('Story_' + story_id, 'Chapter_' + chapter_id, scene, 'narration.mp3')}`,
                    image: `${base}/story_archive/${path.join('Story_' + story_id, 'Chapter_' + chapter_id, scene, 'image.png')}`,
                    context: `${base}/story_archive/${path.join('Story_' + story_id, 'Chapter_' + chapter_id, scene, 'content.txt')}`
                };
            }
        }

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Failed to read scenes: " + err.message });
    }
});

app.listen(port, () => {
    //console.clear();
    console.log(`AI STORY PROCESSOR SERVER RUNNING @ [ ${base}:${port} ]`);
});
