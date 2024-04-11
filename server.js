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
var ffmpeg = require('fluent-ffmpeg');

require('dotenv').config();

let compileVisual = ffmpeg();

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

const audioFilesDir = path.join(__dirname, 'audio_files');
if (!existsSync(audioFilesDir)) { mkdirSync(audioFilesDir); }
app.use('/audio', express.static(audioFilesDir));

const storyAssetDir = path.join(__dirname, 'story_archive');
if (!existsSync(storyAssetDir)) { mkdirSync(storyAssetDir); }
app.use('/story_archive', express.static(storyAssetDir));

app.get('/', (req, res) => {
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

app.post('/api/story/chapter/get', async (req, res) => {
    const startTime = new Date();
    const userAgent = req.headers['user-agent']; 
    const requestHeaders = req.headers;
    console.log('') || logger.info(`Request from ${userAgent}`);
    try {
        const { story_id, chapter_id } = req.body;
        const isNullOrUndefined = (value) => value === null || value === undefined;
        // Validate Post Body Request
        if (isNullOrUndefined(story_id) || isNullOrUndefined(chapter_id)) {
            logger.error('Missing required fields in the request body.');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields in the request body.'
            });
        }
        const storyArchiveDir = path.join(__dirname, 'story_archive');
        const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
        const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);

        logger.info(`Searching Story_${story_id}`);
        const storyExists = fs.existsSync(storyDir);
        logger.info(`Search for Story_${story_id} completed. Res: ${storyExists}`);
        
        logger.info(`Searching Chapter_${chapter_id}`);
        const chapterExists = fs.existsSync(chapterDir);
        logger.info(`Search for Story_${story_id} completed. Res: ${chapterExists}`);

        const filesByExtension = {};
        if(storyExists && chapterExists){
            try {
                const files = fs.readdirSync(chapterDir);
                files.forEach((file) => {
                    const ext = path.extname(file);
        
                    if (!filesByExtension[ext]) {
                        filesByExtension[ext] = [];
                    }
        
                    filesByExtension[ext].push(`${base}:${port}/story_archive/Story_${story_id}/Chapter_${chapter_id}/${file}`);
                });
            } catch (error) {
                logger.error(`Error reading files in ${chapterDir}`);
                throw err;
            }
        }
        
        const endTime = new Date();
        const duration = endTime - startTime;
        
        logger.info(`Asset fetched.`);
        return res.status(200).json({
            status: 'success',
            chapterExist: storyExists && chapterExists,
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
                    const localImagePath = path.join(chapterDir, fileName);
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
                        const localImagePath = path.join(chapterDir, fileName);
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
