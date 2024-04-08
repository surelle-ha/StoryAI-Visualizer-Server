const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const { createWriteStream, existsSync, mkdirSync } = require('fs');
const PlayHTAPI = require('playht');
const googleTTS = require('google-tts-api');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Composaables
const searchGoogleImages = require('./composables/searchGoogleImages');

// PlayHT API Environment
PlayHTAPI.init({
  apiKey: process.env.PLAYHT_API_KEY,
  userId: process.env.PLAYHT_USER_ID,
});

// Server Config
const app = express();
const base = process.env.SERVER_BASE;
const port = process.env.SERVER_PORT;
const env = process.env.SERVER_ENVN;
const audioFilesDir = path.join(__dirname, 'audio_files');
if (!existsSync(audioFilesDir)) { mkdirSync(audioFilesDir); }
app.use(cors())
app.use('/audio', express.static(audioFilesDir));

/* 
 * User-Access Server Endpoints
 *
 * GET /api/story/narrate/audios/list
 * GET /api/story/narrate/audios/clear
 * 
 * GET /api/story/narrate/free/en/create?content=<STORY_CONTENT>
 * GET /api/story/narrate/premium/en/create?content=<STORY_CONTENT>
 * 
 * GET /api/story/scenery/google/create?content=<STORY_CONTENT>
 * GET /api/story/scenery/ai/create?content=<STORY_CONTENT>
 * 
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
    const query = req.query.content;
    if (!query) {
        return res.status(400).json(
            {
                status: 'error', 
                message: 'Query parameter `content` is required'
            }
        );
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
        res.status(500).send('An error occurred while generating the narration');
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
    res.status(500).send('An error occurred while generating the narration');
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
      res.status(500).send('An error occurred while retrieving the files');
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
      res.status(500).send('An error occurred while deleting the files');
    }
});

app.listen(port, () => {
    console.clear();
    console.log(`AI STORY PROCESSOR SERVER RUNNING @ [ ${base}:${port} ]`);
});
