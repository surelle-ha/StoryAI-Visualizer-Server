# StoryAI-Visualizer
Artificial intelligent image/scenery and narration generation based on the story content. Render using VueJS.

## Features

- Turn your text-based novel to beautiful visual.
- Generate image scenery using the story as a prompt.
- Easy to host.

## Requirements

- NodeJS
- OpenAI API Key
- Google Custom Search Engine API Key
- PlayHT API Key
- gTTS

## Deployment

### Tunnel Local via Ngrok (Optional)

Ngrok is a cross-platform tool that creates secure tunnels between your local development server and the internet, allowing you to expose locally hosted services to the web. It’s often used for testing and development purposes.

##### 1. Download Ngrok

[![Ngrok](https://img.shields.io/badge/Ngrok-purple?style=for-the-badge&logo=ngrok)](https://ngrok.com/download)

##### 2. Register and get your Auth token

##### 3. Run this script on your Ngrok directory.

    ngrok config add-authtoken <token>

##### 4. Start a tunnel

    ngrok http <port>

### Or Deploy via Render (Optional)

Create an account on Render and setup environment variable before you click the button below.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/surelle-ha/StoryAI-Visualizer-Server.git)

## Local Installation

First, ensure you have NodeJS installed. Then, clone the repository from Github.

```git
git clone https://github.com/surelle-ha/StoryAI-Visualizer-Server.git
```

Next, install the required packages using npm:

```bash
npm install
```

## Usage

To start the web server, run the script:

```bash
npm run serve
```

Once the server is running, you can access the API endpoint POST /api/story/chapter/create to create story assets.

### Example Request:

```bash
POST /api/story/chapter/create
```

### Request Payload Structure

```json
{
    "user_authority": 9012,
    "story_id":1,
    "chapter_id":1,
    "chapter_title":"The Three Little Pigs",
    "chapter_content": ["Once upon a time there was an old mother pig who had three little pigs and not enough food to feed them. So when they were old enough, she sent them out into the world to seek their fortunes.", "The first little pig was very lazy. He didn't want to work at all and he built his house out of straw. The second little pig worked a little bit harder but he was somewhat lazy too and he built his house out of sticks. Then, they sang and danced and played together the rest of the day.", "The third little pig worked hard all day and built his house with bricks. It was a sturdy house complete with a fine fireplace and chimney. It looked like it could withstand the strongest winds."], 
    "narrate_mode":"premium",
    "narrate_lang":"en",
    "scene_mode":"premium",
    "scene_model":"dall-e-3",
    "scene_size":"1024x1024",
    "overwrite":false
}
```

### Response Structure:

```json
{
    "status": "success",
    "fileGenerated": {
        ".mp3": [
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_0.mp3",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_1.mp3",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_2.mp3"
        ],
        ".png": [
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_0.png",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_1.png",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_2.png"
        ],
        ".srt": [
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_0.srt",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_1.srt",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_2.srt"
        ],
        ".sub": [
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_0.sub",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_1.sub",
            "http://localhost:9111/story_archive/Story_1/Chapter_1/1_2.sub"
        ]
    },
    "content": [
        "Once upon a time there was an old mother pig who had three little pigs and not enough food to feed them. So when they were old enough, she sent them out into the world to seek their fortunes.",
        "The first little pig was very lazy. He didn't want to work at all and he built his house out of straw. The second little pig worked a little bit harder but he was somewhat lazy too and he built his house out of sticks. Then, they sang and danced and played together the rest of the day.",
        "The third little pig worked hard all day and built his house with bricks. It was a sturdy house complete with a fine fireplace and chimney. It looked like it could withstand the strongest winds."
    ],
    "requestTime": "2024-04-11T15:13:02.481Z",
    "responseSpeed": "16646 ms",
    "userAgent": "PostmanRuntime/7.37.3",
    "requestHeaders": {
        "content-type": "application/json",
        "user-agent": "PostmanRuntime/7.37.3",
        "accept": "*/*",
        "cache-control": "no-cache",
        "postman-token": "6ea8a4e7-f801-4f35-90e8-9c7205962600",
        "host": "localhost:9111",
        "accept-encoding": "gzip, deflate, br",
        "connection": "keep-alive",
        "content-length": "993"
    }
}
```

## Configuration

- This server is part of another project/repository called StoryAI-Visualizer-Client build using VueJS Framework.
