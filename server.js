require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { existsSync, mkdirSync } = require("fs");
const PlayHTAPI = require("playht");
const googleTTS = require("google-tts-api");
const axios = require("axios");
const path = require("path");
const fileUpload = require("express-fileupload");
const OpenAI = require("openai");
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const { exec, execSync } = require("child_process");
const connectDB = require("./config/mongodb");
const router = require("./routes/routes");

connectDB();
const AccessModel = require("./models/Access");
const StoryModel = require("./models/Story");
const PromptModel = require("./models/Prompt");

// Helpers
const logger = require("./helpers/logger");
const getUID = require("./helpers/getUID");
const searchGoogleImages = require("./helpers/searchGoogleImages");
const Token = require("./helpers/Token");

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
const {
	ENV_NAME,
	ENV_BASE,
	ENV_PORT,
	ENV_VER,
	ENV_TYPE,
} = require("./config/environment");

// Server Config
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rootStorage = path.join(__dirname, "storage");

const imagesFilesDir = path.join(rootStorage, "user_images");
if (!existsSync(imagesFilesDir)) {
	mkdirSync(imagesFilesDir);
}
app.use("/user_images", express.static(imagesFilesDir));

const storyAssetDir = path.join(rootStorage, "story_archive");
if (!existsSync(storyAssetDir)) {
	mkdirSync(storyAssetDir);
}
app.use("/story_archive", express.static(storyAssetDir));

app.use(fileUpload());

app.use("/", router);

app.post("/api/story/select", async (req, res) => {
    const { access_id, story_id } = req.body;
    const startTime = new Date();
    const userAgent = req.headers["user-agent"];
    const requestHeaders = req.headers;
    logger.info(`Request from ${userAgent} for story ${story_id}`);

    if (!access_id || !story_id) {
        logger.error(`Missing access_id or story_id in the request`);
        return res.status(400).json({
            status: "error",
            message: "Missing access_id or story_id in the request",
        });
    }

    try {
        // Initialize directories for story archives if they do not exist
        const storyArchiveDir = path.join(rootStorage, "story_archive");
        if (!fs.existsSync(storyArchiveDir)) {
            fs.mkdirSync(storyArchiveDir);
            logger.info(`Directory 'story_archive' initialized.`);
        }

        const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
        if (!fs.existsSync(storyDir)) {
            fs.mkdirSync(storyDir);
            logger.info(`Directory 'Story_${story_id}' initialized.`);
        }

        // List all chapter directories that match the "Chapter_" prefix
        const chapters = fs
            .readdirSync(storyDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.startsWith("Chapter_"))
            .map(dirent => {
                const chapterDir = path.join(storyDir, dirent.name);
                // List all scene directories within each chapter
                const scenes = fs
                    .readdirSync(chapterDir, { withFileTypes: true })
                    .filter(sceneDirent => sceneDirent.isDirectory() && sceneDirent.name.startsWith("Scene_"))
                    .map(sceneDirent => sceneDirent.name);
                return { chapter: dirent.name, scenes: scenes };
            });

        const endTime = new Date();
        const duration = endTime - startTime;

        logger.info(`Chapters and scenes for story ${story_id} fetched successfully.`);
        return res.status(200).json({
            chapters: chapters
        });
    } catch (error) {
        const endTime = new Date();
        const duration = endTime - startTime;

        logger.error(
            `An error occurred while fetching chapters and scenes for story ${story_id}:`,
            error
        );
        return res.status(500).json({
            status: "error",
            message: "An error occurred while fetching chapters and scenes",
            error: error,
            requestTime: startTime.toISOString(),
            responseSpeed: `${duration} ms`,
            userAgent: userAgent,
            requestHeaders: requestHeaders,
        });
    }
});

app.post("/api/story/initialize", async (req, res) => {
	/* CHECKED */
	const { access_id, story_id, chapter_id } = req.body; // Changed from req.query to req.body

	const startTime = new Date();
	const userAgent = req.headers["user-agent"];
	const requestHeaders = req.headers;
	logger.info(`Request from ${userAgent}`);

	if (!access_id || !story_id || !chapter_id) {
		logger.error(`Missing access_id, story_id or chapter_id in the request`);
		return res.status(400).json({
			status: "error",
			message: "Missing Story ID or Chapter ID in the request",
		});
	}

	try {
		let story = await StoryModel.findOne({ story_id: story_id });

		if (!story) {
			// Upsert access record
			const access = await AccessModel.findOneAndUpdate(
				{ access_id: access_id },
				{
					$setOnInsert: { points: 25, created: new Date() },
					$set: { updated: new Date() },
				},
				{ new: true, upsert: true }
			);

			// Upsert story record
			story = await StoryModel.findOneAndUpdate(
				{
					story_id: story_id,
					chapter_id: chapter_id,
					access_id: access_id,
					isPublished: false,
				},
				{
					$setOnInsert: { created: new Date() },
					$set: { updated: new Date() },
				},
				{ new: true, upsert: true }
			);
		}

		if (story.access_id !== access_id) {
			return res.json({
				status: "failed",
				message: "Authorization Failed",
			});
		}

		const accessing_user = await AccessModel.findOne({
			access_id: access_id,
		});

		const storyArchiveDir = path.join(rootStorage, "story_archive");
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
			status: "success",
			message: "Initialization completed",
			access: accessing_user,
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	} catch (error) {
		const endTime = new Date();
		const duration = endTime - startTime;

		logger.error(`An error occurred while building story board:`, error);
		res.status(500).json({
			status: "error",
			message: "An error occurred while building story board",
			error: error,
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	}
});

app.post("/api/scenario/initialize", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id } = req.body;

	const startTime = new Date();
	const userAgent = req.headers["user-agent"];
	const requestHeaders = req.headers;
	logger.info(`Request from ${userAgent}`);

	if (!story_id || !chapter_id) {
		logger.error(`Missing story_id or chapter_id in the request`);
		return res.status(400).json({
			status: "error",
			message: "Missing Story ID or Chapter ID in the request",
		});
	}

	try {
		const storyArchiveDir = path.join(rootStorage, "story_archive");
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
		const existingScenes = fs
			.readdirSync(chapterDir)
			.filter(
				(file) =>
					fs.statSync(path.join(chapterDir, file)).isDirectory() &&
					file.startsWith("Scene_")
			)
			.map((file) => parseInt(file.split("_")[1]))
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
			status: "success",
			sceneNumber: nextSceneNumber,
			message: "Scene Initialization completed",
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	} catch (error) {
		const endTime = new Date();
		const duration = endTime - startTime;

		logger.error(`An error occurred while building story board:`, error);
		res.status(500).json({
			status: "error",
			message: "An error occurred while building story board",
			error: error,
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	}
});

app.post("/api/scenario/adjust/position/right", async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;
    const chapterPath = path.join(rootStorage, "story_archive", `Story_${story_id}`, `Chapter_${chapter_id}`);
    
    const scenePath = path.join(chapterPath, `Scene_${scene_id}`);
    const targetScenePath = path.join(chapterPath, `Scene_${parseInt(scene_id) + 1}`);
    
    if (!fs.existsSync(scenePath) || !fs.existsSync(targetScenePath)) {
        return res.status(404).json({
            status: "error",
            message: "One or both scenes not found"
        });
    }
    
    // Temporary renaming to avoid collision
    const tempPath = path.join(chapterPath, `Temp_Scene_${new Date().getTime()}`);
    fs.renameSync(scenePath, tempPath);
    fs.renameSync(targetScenePath, scenePath);
    fs.renameSync(tempPath, targetScenePath);
    
    return res.status(200).json({
        status: "success",
        message: "Scene positions adjusted right successfully"
    });
});

app.post("/api/scenario/adjust/position/left", async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;
    const chapterPath = path.join(rootStorage, "story_archive", `Story_${story_id}`, `Chapter_${chapter_id}`);
    
    const scenePath = path.join(chapterPath, `Scene_${scene_id}`);
    const targetScenePath = path.join(chapterPath, `Scene_${parseInt(scene_id) - 1}`);
    
    if (!fs.existsSync(scenePath) || !fs.existsSync(targetScenePath)) {
        return res.status(404).json({
            status: "error",
            message: "One or both scenes not found"
        });
    }
    
    // Temporary renaming to avoid collision
    const tempPath = path.join(chapterPath, `Temp_Scene_${new Date().getTime()}`);
    fs.renameSync(scenePath, tempPath);
    fs.renameSync(targetScenePath, scenePath);
    fs.renameSync(tempPath, targetScenePath);
    
    return res.status(200).json({
        status: "success",
        message: "Scene positions adjusted left successfully"
    });
});

app.post("/api/chapter/initialize", async (req, res) => {
	/* CHECKED */
	const { story_id } = req.body;

	const startTime = new Date();
	const userAgent = req.headers["user-agent"];
	const requestHeaders = req.headers;
	logger.info(`Request from ${userAgent}`);

	if (!story_id) {
		logger.error(`Missing story_id in the request`);
		return res.status(400).json({
			status: "error",
			message: "Missing Story ID or Chapter ID in the request",
		});
	}

	try {
		const storyArchiveDir = path.join(rootStorage, "story_archive");
		if (!fs.existsSync(storyArchiveDir)) {
			fs.mkdirSync(storyArchiveDir);
			logger.info(`Directory 'story_archive' Initialized.`);
		}

		const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
		if (!fs.existsSync(storyDir)) {
			fs.mkdirSync(storyDir);
			logger.info(`Directory 'Story_${story_id}' Initialized.`);
		}

		// Read existing scene directories and find the next available or new scene number
		const existingChapters = fs
			.readdirSync(storyDir)
			.filter(
				(file) =>
					fs.statSync(path.join(storyDir, file)).isDirectory() &&
					file.startsWith("Chapter_")
			)
			.map((file) => parseInt(file.split("_")[1]))
			.sort((a, b) => a - b);

		let nextChapterNumber = 1;
		for (let i = 0; i < existingChapters.length; i++) {
			if (existingChapters[i] !== nextChapterNumber) break;
			nextChapterNumber++;
		}

		const nextChapterDir = path.join(storyDir, `Chapter_${nextChapterNumber}`);
		fs.mkdirSync(nextChapterDir);
		logger.info(`Directory '${nextChapterDir}' created for the next scene.`);

		const endTime = new Date();
		const duration = endTime - startTime;

		logger.info(`Chapter initialization completed`);
		return res.status(200).json({
			status: "success",
			sceneNumber: nextChapterNumber,
			message: "Chapter Initialization completed",
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	} catch (error) {
		const endTime = new Date();
		const duration = endTime - startTime;

		logger.error(`An error occurred while building story board:`, error);
		res.status(500).json({
			status: "error",
			message: "An error occurred while building story board",
			error: error,
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	}
});

app.post("/api/chapter/delete", async (req, res) => {
	const { story_id, chapter_id } = req.body;
	const startTime = new Date();
	const userAgent = req.headers["user-agent"];
	const requestHeaders = req.headers;
	logger.info(
		`Delete request from ${userAgent} for Story ${story_id}, Chapter ${chapter_id}`
	);

	if (!story_id || !chapter_id) {
		logger.error(`Missing story_id or chapter_id in the request`);
		return res.status(400).json({
			status: "error",
			message: "Missing Story ID or Chapter ID in the request",
		});
	}

	try {
		const storyArchiveDir = path.join(rootStorage, "story_archive");
		const storyDir = path.join(storyArchiveDir, "Story_" + story_id);
		const chapterDir = path.join(storyDir, "Chapter_" + chapter_id);

		if (!fs.existsSync(chapterDir)) {
			logger.error(`Chapter directory does not exist`);
			return res.status(404).json({
				status: "error",
				message: "Chapter directory does not exist",
			});
		}

		fs.rmdirSync(chapterDir, { recursive: true });
		logger.info(`Directory '${chapterDir}' deleted successfully.`);

		const endTime = new Date();
		const duration = endTime - startTime;

		return res.status(200).json({
			status: "success",
			message: "Chapter directory deleted successfully",
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	} catch (error) {
		const endTime = new Date();
		const duration = endTime - startTime;

		logger.error(`An error occurred while deleting the chapter:`, error);
		res.status(500).json({
			status: "error",
			message: "An error occurred while deleting the chapter",
			error: error,
			requestTime: startTime.toISOString(),
			responseSpeed: `${duration} ms`,
			userAgent: userAgent,
			requestHeaders: requestHeaders,
		});
	}
});

app.get("/api/scenario/getCount", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id } = req.query;

	if (!story_id || !chapter_id) {
		return res.status(400).json({
			status: "error",
			message: "Missing Story ID or Chapter ID in the request",
		});
	}

	try {
		const storyDir = path.join(
			rootStorage,
			"story_archive",
			`Story_${story_id}`
		);
		const chapterDir = path.join(storyDir, `Chapter_${chapter_id}`);

		if (fs.existsSync(chapterDir)) {
			const scenes = fs
				.readdirSync(chapterDir)
				.filter(
					(file) =>
						fs.statSync(path.join(chapterDir, file)).isDirectory() &&
						file.startsWith("Scene_")
				)
				.map((scene) => ({
					id: scene, // Assumes 'Scene_X' is a unique identifier
					name: scene, // Or any other relevant details
				}));
			return res.status(200).json({
				status: "success",
				scenes: scenes,
				message: "Successfully retrieved scenes",
			});
		} else {
			return res.status(404).json({
				status: "error",
				message: "Chapter directory does not exist",
			});
		}
	} catch (error) {
		logger.error("Failed to retrieve scenes", error);
		res.status(500).json({
			status: "error",
			message: "An error occurred while retrieving the scenes",
			error: error,
		});
	}
});

app.delete("/api/scenario/delete", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);

	try {
		if (fs.existsSync(sceneDirPath)) {
			fs.rmdirSync(sceneDirPath, { recursive: true });
			logger.info(
				`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' deleted.`
			);
			return res.status(200).json({
				status: "success",
				message: `Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' deleted successfully`,
			});
		} else {
			logger.warn(
				`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' does not exist.`
			);
			return res.status(404).json({
				status: "error",
				message: `Scene directory does not exist`,
			});
		}
	} catch (error) {
		logger.error(`Error deleting chapter directory:`, error);
		return res.status(500).json({
			status: "error",
			message: "Failed to delete chapter directory",
			error: error,
		});
	}
});

app.post("/api/scenario/sfx/save", async (req, res) => {
    const { story_id, chapter_id, scene_id, sfx_ids } = req.body;

    const sceneDirPath = path.join(
        rootStorage,
        "story_archive",
        `Story_${story_id}`,
        `Chapter_${chapter_id}`,
        `Scene_${scene_id}`
    );

    const sfxFilePath = path.join(sceneDirPath, "sfx.json");

    try {
        if (!fs.existsSync(sceneDirPath)) {
            fs.mkdirSync(sceneDirPath, { recursive: true });
        }

        fs.writeFileSync(sfxFilePath, JSON.stringify({ sfx: sfx_ids }, null, 2));
        return res.status(201).json({
            status: "success",
            message: "SFX saved successfully."
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Failed to save scene SFX",
            error: error.message
        });
    }
});

app.post("/api/scenario/sfx/get", async (req, res) => {
    const { story_id, chapter_id, scene_id } = req.body;

    const sceneDirPath = path.join(
        rootStorage,
        "story_archive",
        `Story_${story_id}`,
        `Chapter_${chapter_id}`,
        `Scene_${scene_id}`
    );

    const sfxFilePath = path.join(sceneDirPath, "sfx.json");

    try {
        if (fs.existsSync(sfxFilePath)) {
            const sfxData = fs.readFileSync(sfxFilePath, 'utf8');
            return res.status(200).json({
                status: "success",
                message: "SFX data retrieved successfully.",
                data: JSON.parse(sfxData)
            });
        } else {
            return res.status(404).json({
                status: "error",
                message: "SFX data not found"
            });
        }
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Failed to retrieve scene SFX",
            error: error.message
        });
    }
});

app.post("/api/scenario/content/save", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id, scene_content } = req.body;

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	console.log(sceneDirPath);
	const contentFilePath = path.join(sceneDirPath, "content.txt");

	try {
		// Ensure the directory exists, create if not
		if (!fs.existsSync(sceneDirPath)) {
			fs.mkdirSync(sceneDirPath, { recursive: true });
			logger.info(
				`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' created.`
			);
		}

		// Write the scene content to content.txt
		fs.writeFileSync(contentFilePath, scene_content);
		logger.info(`Content for Scene_${scene_id} saved successfully.`);

		return res.status(201).json({
			status: "success",
			message: `Content for Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' saved successfully`,
		});
	} catch (error) {
		logger.error(`Error saving content for Scene_${scene_id}:`, error);
		return res.status(500).json({
			status: "error",
			message: "Failed to save scene content",
			error: error,
		});
	}
});

app.post("/api/scenario/content/fetch", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const contentFilePath = path.join(sceneDirPath, "content.txt");

	try {
		// Check if the content file exists
		if (fs.existsSync(contentFilePath)) {
			const scene_content = fs.readFileSync(contentFilePath, "utf8");
			logger.info(`Content for Scene_${scene_id} fetched successfully.`);

			return res.status(200).json({
				status: "success",
				message: `Content fetched successfully`,
				data: scene_content,
			});
		} else {
			logger.warn(`Content file for Scene_${scene_id} does not exist.`);
			return res.status(404).json({
				status: "error",
				message: `Content file does not exist`,
			});
		}
	} catch (error) {
		logger.error(`Error fetching content for Scene_${scene_id}:`, error);
		return res.status(500).json({
			status: "error",
			message: "Failed to fetch scene content",
			error: error,
		});
	}
});

app.post("/api/scenario/prompt/save", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id, scene_prompt } = req.body;

	const promptDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const promptFilePath = path.join(promptDirPath, "prompt.txt");

	try {
		// Ensure the directory exists, create if not
		if (!fs.existsSync(promptDirPath)) {
			fs.mkdirSync(promptDirPath, { recursive: true });
			logger.info(
				`Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' created.`
			);
		}

		// Write the scene content to content.txt
		fs.writeFileSync(promptFilePath, scene_prompt);
		logger.info(`Content for Scene_${scene_id} saved successfully.`);

		return res.status(201).json({
			status: "success",
			message: `Content for Scene directory 'Scene_${scene_id}' for chapter '${chapter_id}' saved successfully`,
		});
	} catch (error) {
		logger.error(`Error saving content for Scene_${scene_id}:`, error);
		return res.status(500).json({
			status: "error",
			message: "Failed to save scene content",
			error: error,
		});
	}
});

app.post("/api/scenario/prompt/fetch", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const contentFilePath = path.join(sceneDirPath, "prompt.txt");

	try {
		// Check if the content file exists
		if (fs.existsSync(contentFilePath)) {
			const scene_prompt = fs.readFileSync(contentFilePath, "utf8");
			logger.info(`Prompt for Scene_${scene_id} fetched successfully.`);

			return res.status(200).json({
				status: "success",
				message: `Prompt fetched successfully`,
				data: scene_prompt,
			});
		} else {
			logger.warn(`Prompt file for Scene_${scene_id} does not exist.`);
			return res.status(404).json({
				status: "error",
				message: `Prompt file does not exist`,
			});
		}
	} catch (error) {
		logger.error(`Error fetching prompt for Scene_${scene_id}:`, error);
		return res.status(500).json({
			status: "error",
			message: "Failed to fetch scene prompt",
			error: error,
		});
	}
});

app.post("/api/scenario/narrate/free/create", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;

	// Define the directory path for the scene
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);

	// Define the path for the content file and check if it exists
	const contentFilePath = path.join(sceneDirPath, "prompt.txt");
	if (!fs.existsSync(contentFilePath)) {
		logger.error("Content file does not exist");
		return res.status(404).send("Content file not found");
	}

	// Read the content from the file
	const storyContent = fs.readFileSync(contentFilePath, "utf8");

	// Settings for Google TTS
	const audio_file = "narration.mp3";
	const narrate_lang = "en-US"; // Assuming narration language is English
	const speed = 1; // Normal speed

	try {
		const audioUrls = googleTTS.getAllAudioUrls(storyContent, {
			lang: narrate_lang,
			slow: false,
			speed: speed,
			host: "https://translate.google.com",
		});

		// Path to save the audio file
		const filePath = path.join(sceneDirPath, audio_file);
		const audioStream = fs.createWriteStream(filePath);

		// Process each audio URL
		for (const audioUrl of audioUrls) {
			const response = await axios.get(audioUrl.url, {
				responseType: "stream",
			});
			await new Promise((resolve, reject) => {
				response.data.pipe(audioStream, { end: false });
				response.data.on("end", resolve);
				response.data.on("error", reject);
			});
		}

		audioStream.end();
		await new Promise((resolve, reject) => {
			audioStream.on("finish", resolve);
			audioStream.on("error", reject);
		});

		logger.info(`Narration Generated for ${audio_file}.`);
		res.status(200).send(`Narration generated successfully: ${filePath}`);
	} catch (error) {
		logger.error(`Error generating audio for ${storyContent}:`, error);
		res.status(500).send("Failed to generate narration");
	}
});

app.get("/api/scene/bgm/fetch", (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.query;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const audioFilePath = path.join(sceneDirPath, "bg.mp3");

	if (fs.existsSync(audioFilePath)) {
		res.sendFile(audioFilePath);
	} else {
		logger.error("BGM file does not exist");
		res.status(404).send("BGM file not found");
	}
});

app.get("/api/scene/narrate/fetch", (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.query;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const audioFilePath = path.join(sceneDirPath, "narration.mp3");

	if (fs.existsSync(audioFilePath)) {
		res.sendFile(audioFilePath);
	} else {
		logger.error("Narration file does not exist");
		res.status(404).send("Narration file not found");
	}
});

app.get("/api/scenario/narrate/premium/voices", async (req, res) => {
	/* CHECKED */
	const url = "https://api.play.ht/api/v2/voices";
	const options = {
		headers: {
			accept: "application/json",
			Authorization: process.env.PLAYHT_API_KEY,
			"X-USER-ID": process.env.PLAYHT_USER_ID,
		},
	};
	try {
		const response = await axios.get(url, options);
		console.log(response.data);
		res.json(response.data);
	} catch (error) {
		console.error("error:", error);
		res.status(500).send("An error occurred while fetching the voices");
	}
});

app.post("/api/scenario/narrate/premium/create", async (req, res) => {
	/* CHECKED */
	const { access_id, story_id, chapter_id, scene_id, voiceId, rate } = req.body;
	const toBeDeduct = rate;
	const tokenResult = await Token.deduct(access_id, toBeDeduct);
	if (!tokenResult.success) {
		return res.status(401).json({ message: tokenResult.message });
	}

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const contentFilePath = path.join(sceneDirPath, "prompt.txt");

	if (!fs.existsSync(contentFilePath)) {
		console.error("Content file does not exist");
		return res.status(404).send("Content file not found");
	}

	const storyContent = fs.readFileSync(contentFilePath, "utf8");
	const audio_file = "narration.mp3";
	const filePath = path.join(sceneDirPath, audio_file);
	const grpcFileStream = fs.createWriteStream(filePath);

	try {
		const grpcStream = await PlayHTAPI.stream(storyContent, {
			voiceId: voiceId, // This ID should come from the frontend selection
			outputFormat: "mp3",
			quality: "draft",
			speed: 1,
			textGuidance: 2.0,
			voiceEngine: "PlayHT2.0",
		});

		grpcStream.on("data", (chunk) => {
			grpcFileStream.write(chunk);
		});

		await new Promise((resolve, reject) => {
			grpcStream.on("end", resolve);
			grpcStream.on("error", reject);
		});
	} catch (error) {
		console.error(`Error generating audio for ${storyContent}:`, error);
		res.status(500).send("Failed to generate narration");
		return;
	}

	grpcFileStream.end();
	await new Promise((resolve, reject) => {
		grpcFileStream.on("finish", resolve);
		grpcFileStream.on("error", reject);
	});

	console.log(`Narration Generated for ${audio_file}.`);
	res.status(200).json(tokenResult);
});

app.post("/api/scenario/bgm/delete", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const filePath = path.join(sceneDirPath, "bg.mp3");

	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				logger.error("Failed to delete the BGM file", err);
				return res.status(500).send("Failed to delete the BGM file");
			}

			logger.info("BGM file deleted successfully.");
			res.status(200).send("BGM file deleted successfully");
		});
	} else {
		logger.warn("BGM file not found");
		res.status(404).send("BGM file not found");
	}
});

app.post("/api/scenario/narrate/delete", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const filePath = path.join(sceneDirPath, "narration.mp3");

	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				logger.error("Failed to delete the audio file", err);
				return res.status(500).send("Failed to delete the audio file");
			}

			logger.info("Audio file deleted successfully.");
			res.status(200).send("Audio file deleted successfully");
		});
	} else {
		logger.warn("Audio file not found");
		res.status(404).send("Audio file not found");
	}
});

app.get("/api/scenario/image/get", (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.query;

	if (!story_id || !chapter_id || !scene_id) {
		return res.status(400).json({
			status: "error",
			message: "Missing required parameters: story_id, chapter_id, scene_id",
		});
	}

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const imagePath = path.join(sceneDirPath, "image.gif");

	if (fs.existsSync(imagePath)) {
		// Send the path as a URL or a relative path depending on your server setup
		const imageUrl = `/story_archive/Story_${story_id}/Chapter_${chapter_id}/Scene_${scene_id}/image.gif`;
		console.log(imageUrl);
		res.json({ imageUrl: imageUrl });
	} else {
		res.status(404).json({
			status: "error",
			message: "Image not found.",
		});
	}
});

app.post("/api/scenario/image/delete", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const filePath = path.join(sceneDirPath, "image.gif");

	if (fs.existsSync(filePath)) {
		fs.unlink(filePath, (err) => {
			if (err) {
				logger.error("Failed to delete the image file", err);
				return res.status(500).send("Failed to delete the image file");
			}

			logger.info("Image file deleted successfully.");
			res.status(200).send("Image file deleted successfully");
		});
	} else {
		logger.warn("Image file not found");
		res.status(404).send("Image file not found");
	}
});

app.post("/api/scenario/image/select/create", async (req, res) => {
	const { story_id, chapter_id, scene_id, image_source } = req.body;

	if (!image_source) {
		return res.status(400).send("No image source provided.");
	}

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);

	// Ensure directory exists
	if (!fs.existsSync(sceneDirPath)) {
		fs.mkdirSync(sceneDirPath, { recursive: true });
	}

	const imagePath = path.join(sceneDirPath, "image.gif");

	// Download the image from the URL
	try {
		const response = await axios({
			method: "get",
			url: image_source,
			responseType: "stream",
		});

		const writer = fs.createWriteStream(imagePath);

		response.data.pipe(writer);

		return new Promise((resolve, reject) => {
			writer.on("finish", () => {
				res.send("File downloaded and saved!");
				resolve();
			});

			writer.on("error", (err) => {
				res.status(500).send(err);
				reject(err);
			});
		});
	} catch (error) {
		return res
			.status(500)
			.send("Failed to download the image: " + error.message);
	}
});

app.post("/api/scenario/bgm/local/create", (req, res) => {
	if (!req.files || Object.keys(req.files).length === 0) {
		return res.status(400).send("No files were uploaded.");
	}

	// Access the uploaded file via req.files.<inputName>, here inputName is 'image'
	let imageFile = req.files.image;

	const { story_id, chapter_id, scene_id } = req.body;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);

	// Ensure directory exists
	if (!fs.existsSync(sceneDirPath)) {
		fs.mkdirSync(sceneDirPath, { recursive: true });
	}

	const imagePath = path.join(sceneDirPath, "bg.mp3");

	// Use the mv() method to place the file somewhere on your server
	imageFile.mv(imagePath, function (err) {
		if (err) {
			return res.status(500).send(err);
		}
		res.send("File uploaded!");
	});
});

app.post("/api/scenario/image/local/create", (req, res) => {
	if (!req.files || Object.keys(req.files).length === 0) {
		return res.status(400).send("No files were uploaded.");
	}

	// Access the uploaded file via req.files.<inputName>, here inputName is 'image'
	let imageFile = req.files.image;

	const { story_id, chapter_id, scene_id } = req.body;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);

	// Ensure directory exists
	if (!fs.existsSync(sceneDirPath)) {
		fs.mkdirSync(sceneDirPath, { recursive: true });
	}

	const imagePath = path.join(sceneDirPath, "image.gif");

	// Use the mv() method to place the file somewhere on your server
	imageFile.mv(imagePath, function (err) {
		if (err) {
			return res.status(500).send(err);
		}
		res.send("File uploaded!");
	});
});

app.post("/api/scenario/image/free/create", async (req, res) => {
	/* CHECKED */
	const { story_id, chapter_id, scene_id } = req.body;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const contentFilePath = path.join(sceneDirPath, "prompt.txt");
	if (!fs.existsSync(contentFilePath)) {
		logger.error("Content file does not exist");
		return res.status(404).send("Content file not found");
	}
	const query = fs.readFileSync(contentFilePath, "utf8");
	const apiKey = process.env.GOOGLE_API_KEY;
	const cseId = process.env.CSE_ID;
	const imageUrls = await searchGoogleImages(apiKey, cseId, query);

	console.log(imageUrls);

	if (imageUrls.length > 0) {
		const imageUrl = imageUrls[0];
		const imageResponse = await axios({
			method: "GET",
			url: imageUrl,
			responseType: "stream",
		});
		const fileName = `image.gif`;
		const localImagePath = path.join(sceneDirPath, fileName);
		const writer = fs.createWriteStream(localImagePath);
		imageResponse.data.pipe(writer);
		await new Promise((resolve, reject) => {
			writer.on("finish", resolve);
			writer.on("error", (err) => {
				console.error("Error saving image:", err);
				reject(err);
			});
		});

		logger.info("image.gif is created.");
		res.status(200).send("image.gif is created");
	} else {
		logger.warn(`Google unable to find image in reference to prompt.`);
		res
			.status(404)
			.send(
				"Google unable to find image in reference to prompt. Please use AI or local image instead."
			);
	}
});

app.post("/api/scenario/image/premium/create", async (req, res) => {
	/* CHECKED */
	const {
		access_id,
		story_id,
		chapter_id,
		scene_id,
		custom_prompt,
		engine,
		size,
		rate,
	} = req.body;

	const toBeDeduct = rate;
	const tokenResult = await Token.deduct(access_id, toBeDeduct);
	if (!tokenResult.success) {
		return res.status(401).json({ message: tokenResult.message });
	}

	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`,
		`Scene_${scene_id}`
	);
	const contentFilePath = path.join(sceneDirPath, "prompt.txt");

	if (!fs.existsSync(contentFilePath)) {
		logger.error("Content file does not exist");
		return res.status(404).send("Content file not found");
	}

	const query = fs.readFileSync(contentFilePath, "utf8");
	const scene_model = engine;
	const scene_size = size;

	const prompt_id = getUID();
	// Using create method for simplicity and proper promise handling
	try {
		const newPrompt = await PromptModel.create({
			prompt_id,
			story_id,
			chapter_id,
			access_id,
			content: custom_prompt,
			updated: new Date(),
		});
		console.log("Document inserted successfully", newPrompt);
	} catch (err) {
		console.error("Error inserting document", err);
		return res.status(500).send("Error inserting document");
	}

	try {
		const imageResponse = await openai.images.generate({
			model: scene_model,
			prompt: `${custom_prompt}`,
			n: 1,
			size: scene_size,
		});

		console.log("API Response:", imageResponse);

		const imageUrl = imageResponse.data[0].url;

		if (imageUrl) {
			const image = await axios({
				method: "GET",
				url: imageUrl,
				responseType: "stream",
			});

			const fileName = `image.gif`;
			if (!fs.existsSync(sceneDirPath)) {
				fs.mkdirSync(sceneDirPath, { recursive: true });
				logger.info(`Directory '${sceneDirPath}' created.`);
			}
			const localImagePath = path.join(sceneDirPath, fileName);
			const writer = fs.createWriteStream(localImagePath);
			image.data.pipe(writer);

			await new Promise((resolve, reject) => {
				writer.on("finish", async () => {
					logger.info(`${fileName} is created.`);

					// Now copy the file to user_images directory
					const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

					const publicImagePathRaw = path.join(
						rootStorage,
						"user_images",
						access_id
					);
					if (!existsSync(publicImagePathRaw)) {
						mkdirSync(publicImagePathRaw);
					}
					const publicImagePath = path.join(
						publicImagePathRaw,
						`image_${timestamp}.png`
					);
					fs.copyFile(localImagePath, publicImagePath, (err) => {
						if (err) {
							logger.error("Error copying image to public directory:", err);
							res.status(500).send("Error copying image to public directory");
						} else {
							logger.info(`Image copied to public directory.`);
							res.status(200).json(tokenResult);
						}
					});
				});
				writer.on("error", (err) => {
					console.error("Error saving image:", err);
					reject(err);
				});
			});
		} else {
			logger.error(`No image URL found for ${query}`);
			res.status(404).send("No image URL found.");
		}
	} catch (error) {
		logger.error("Failed to create image due to an error:", error);
		res.status(500).send(error.message);
	}
});

app.get("/api/scenario/image/:id/fetch", (req, res) => {
	const access_id = req.params.id;
	fs.readdir(path.join(imagesFilesDir, access_id), (err, files) => {
		if (err) {
			console.error("Failed to read directory:", err);
			return res.status(500).send("Error reading image directory");
		}
		const imageUrls = files
			.filter((file) => file.endsWith(".png"))
			.map((file) => `${ENV_BASE}/user_images/${access_id}/${file}`);
		res.json(imageUrls);
	});
});

app.post("/api/scenario/complete/v1/create-pdf", async (req, res) => {
    const { story_id, column_number } = req.body;
    const storyDirPath = path.join(
        rootStorage,
        "story_archive",
        `Story_${story_id}`
    );

    try {
        const chapters = fs.readdirSync(storyDirPath);
        const doc = new PDFDocument({ autoFirstPage: false });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=story_${story_id}.pdf`);
        doc.pipe(res);

        let itemCount = 0;
        for (const chapter of chapters) {
            const chapterPath = path.join(storyDirPath, chapter);
            if (fs.statSync(chapterPath).isDirectory()) {
                const scenes = fs.readdirSync(chapterPath);

                for (const scene of scenes) {
                    const scenePath = path.join(chapterPath, scene);
                    if (fs.statSync(scenePath).isDirectory()) {
                        const files = fs.readdirSync(scenePath);

                        if (files.includes("narration.mp3") && files.includes("image.gif") && files.includes("content.txt")) {
                            if (itemCount % column_number === 0) { // Start a new page every 4 scenes
                                doc.addPage({ size: 'A4', layout: 'landscape' });
                                itemCount = 0; // Reset counter for new page
                            }
                            
                            const imagePath = path.join(scenePath, "image.gif");
                            const textPath = path.join(scenePath, "content.txt");
                            
                            // Convert image to ensure compatibility
                            const imageBuffer = await sharp(imagePath)
                                .toFormat('png')
                                .toBuffer()
                                .catch(err => {
                                    console.error('Error processing image:', err);
                                    throw new Error('Image processing failed');
                                });

                            // Calculate x position based on item count
                            const xPosition = (doc.page.width / 4) * (itemCount % 4);
                            const yPosition = 50; // Start a bit down from the top of the page

                            doc.image(imageBuffer, xPosition + 10, yPosition, {
                                fit: [150, 100],
                                align: 'center',
                                valign: 'top'
                            });

                            const contentText = fs.readFileSync(textPath, 'utf8');
                            doc.text(contentText, xPosition + 10, yPosition + 110, {
                                width: 150,
                                align: 'center'
                            });

                            // Draw border around the card
                            doc.rect(xPosition + 5, yPosition - 5, 170, 220).stroke();

                            itemCount++;
                        }
                    }
                }
            }
        }

        doc.end();
    } catch (err) {
        console.error('Failed to generate PDF:', err);
        res.status(500).send("Failed to generate PDF: " + err.message);
    }
});

app.post("/api/scenario/complete/v2/fetch", async (req, res) => {
	const { story_id } = req.body;
	const storyDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`
	);

	try {
		const chapters = fs.readdirSync(storyDirPath);
		const results = {};

		for (const chapter of chapters) {
			const chapterPath = path.join(storyDirPath, chapter);
			if (fs.statSync(chapterPath).isDirectory()) {
				// Ensure it is a directory
				const scenes = fs.readdirSync(chapterPath);

				for (const scene of scenes) {
					const scenePath = path.join(chapterPath, scene);
					if (fs.statSync(scenePath).isDirectory()) {
						// Ensure it is a directory
						const files = fs.readdirSync(scenePath);
						console.log(files);

						if (
							files.includes("narration.mp3") &&
							files.includes("image.gif") &&
							files.includes("content.txt")
						) {
							if (files.includes("bg.mp3")) {
								results[`${chapter}/${scene}`] = {
									story_id: story_id,
									chapter_id: chapter.replace("Chapter_", ""),
									scene_id: scene.replace("Scene_", ""),
									sound: `${ENV_BASE}/story_archive/${path.join(
										"Story_" + story_id,
										chapter,
										scene,
										"narration.mp3"
									)}`,
									bgm: `${ENV_BASE}/story_archive/${path.join(
										"Story_" + story_id,
										chapter,
										scene,
										"bg.mp3"
									)}`,
									image: `${ENV_BASE}/story_archive/${path.join(
										"Story_" + story_id,
										chapter,
										scene,
										"image.gif"
									)}`,
									context: `${ENV_BASE}/story_archive/${path.join(
										"Story_" + story_id,
										chapter,
										scene,
										"content.txt"
									)}`,
								};
							} else {
								results[`${chapter}/${scene}`] = {
									story_id: story_id,
									chapter_id: chapter.replace("Chapter_", ""),
									scene_id: scene.replace("Scene_", ""),
									sound: `${ENV_BASE}/story_archive/${path.join(
										"Story_" + story_id,
										chapter,
										scene,
										"narration.mp3"
									)}`,
									image: `${ENV_BASE}/story_archive/${path.join(
										"Story_" + story_id,
										chapter,
										scene,
										"image.gif"
									)}`,
									context: `${ENV_BASE}/story_archive/${path.join(
										"Story_" + story_id,
										chapter,
										scene,
										"content.txt"
									)}`,
								};
							}
						}
					}
				}
			}
		}

		res.json(results);
	} catch (err) {
		res.status(500).json({ error: "Failed to read scenes: " + err.message });
	}
});

app.post("/api/scenario/complete/v1/fetch", async (req, res) => {
	const { story_id, chapter_id } = req.body;
	const sceneDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`
	);

	try {
		const scenes = fs.readdirSync(sceneDirPath);
		const results = {};

		for (const scene of scenes) {
			const scenePath = path.join(sceneDirPath, scene);
			const files = fs.readdirSync(scenePath);
			console.log(files);

			if (
				files.includes("narration.mp3") &&
				files.includes("image.gif") &&
				files.includes("content.txt")
			) {
				results[scene] = {
					sound: `${ENV_BASE}/story_archive/${path.join(
						"Story_" + story_id,
						"Chapter_" + chapter_id,
						scene,
						"narration.mp3"
					)}`,
					image: `${ENV_BASE}/story_archive/${path.join(
						"Story_" + story_id,
						"Chapter_" + chapter_id,
						scene,
						"image.gif"
					)}`,
					context: `${ENV_BASE}/story_archive/${path.join(
						"Story_" + story_id,
						"Chapter_" + chapter_id,
						scene,
						"content.txt"
					)}`,
				};
			}
		}

		res.json(results);
	} catch (err) {
		res.status(500).json({ error: "Failed to read scenes: " + err.message });
	}
});

app.post("/api/video/v2/generate", async (req, res) => {
	const { story_id, chapter_id } = req.body;
	const chapterDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`
	);

	if (!fs.existsSync(chapterDirPath)) {
		return res
			.status(404)
			.json({ error: "Chapter directory not found: " + chapterDirPath });
	}

	const directories = fs.readdirSync(chapterDirPath);
	const scenes = directories.filter((dir) => dir.startsWith("Scene_"));
	let ffmpegInputs = "";
	let filterComplexScale = "";
	let filterComplexConcat = "";
	let totalStreams = 0;

	for (const scene of scenes) {
		const sceneDirPath = path.join(chapterDirPath, scene);
		const imagePath = path.join(sceneDirPath, "image.gif");
		const audioPath = path.join(sceneDirPath, "narration.mp3");

		if (!fs.existsSync(imagePath) || !fs.existsSync(audioPath)) {
			console.error(`Missing files for scene: ${scene}`);
			return res
				.status(400)
				.json({ error: `Missing files for scene: ${scene}` });
		}

		const duration = execSync(
			`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
		)
			.toString()
			.trim();
		ffmpegInputs += `-t ${duration} -i "${imagePath}" -i "${audioPath}" `;
		filterComplexScale += `[${totalStreams}:v]scale=1024:1024[v${totalStreams}];`;
		filterComplexConcat += `[v${totalStreams}][${totalStreams + 1}:a]`;
		totalStreams += 2; // Increment for each video and audio stream
	}

	filterComplexConcat += `concat=n=${scenes.length}:v=1:a=1[v][a]`;

	if (totalStreams === 0) {
		return res
			.status(500)
			.json({ error: "No valid scenes were found to generate the video." });
	}

	const outputPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}.mp4`
	);
	const ffmpegCommand =
		`ffmpeg ${ffmpegInputs} -filter_complex ` +
		`"${scenes
			.map(
				(_, i) =>
					`[${2 * i}:v]scale=1024:1024,setsar=1[v${i}];[${
						2 * i + 1
					}:a]aformat=sample_fmts=fltp:sample_rates=22050:channel_layouts=mono[a${i}]`
			)
			.join(";")}` +
		`;${scenes.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${
			scenes.length
		}:v=1:a=1[v][a]" ` +
		`-map "[v]" -map "[a]" -c:v libx264 -c:a aac -b:a 192k -shortest -y "${outputPath}"`;

	console.log(`Executing command: ${ffmpegCommand}`);

	exec(ffmpegCommand, (error, stdout, stderr) => {
		if (error) {
			console.error(`Error generating video: ${error.message}`);
			return res
				.status(500)
				.json({ error: "Video generation failed: " + error.message });
		}
		console.log("Video generated successfully");

		// Send the URL of the generated video
		const videoUrl = `${process.env.SERVER_BASE}/story_archive/Story_${story_id}/Chapter_${chapter_id}.mp4`;
		res.json({ message: "Video generated successfully", url: videoUrl });
	});
});

app.post("/api/video/v1/generate", async (req, res) => {
	const { story_id, chapter_id } = req.body;
	const chapterDirPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}`
	);

	if (!fs.existsSync(chapterDirPath)) {
		return res
			.status(404)
			.json({ error: "Chapter directory not found: " + chapterDirPath });
	}

	const directories = fs.readdirSync(chapterDirPath);
	const scenes = directories.filter((dir) => dir.startsWith("Scene_"));
	let ffmpegInputs = "";
	let filterComplexScale = "";
	let filterComplexConcat = "";
	let totalStreams = 0;

	for (const scene of scenes) {
		const sceneDirPath = path.join(chapterDirPath, scene);
		const imagePath = path.join(sceneDirPath, "image.gif");
		const audioPath = path.join(sceneDirPath, "narration.mp3");

		if (!fs.existsSync(imagePath) || !fs.existsSync(audioPath)) {
			console.error(`Missing files for scene: ${scene}`);
			return res
				.status(400)
				.json({ error: `Missing files for scene: ${scene}` });
		}

		const duration = execSync(
			`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
		)
			.toString()
			.trim();
		ffmpegInputs += `-t ${duration} -i "${imagePath}" -i "${audioPath}" `;
		filterComplexScale += `[${totalStreams}:v]scale=1024:1024[v${totalStreams}];`;
		filterComplexConcat += `[v${totalStreams}][${totalStreams + 1}:a]`;
		totalStreams += 2; // Increment for each video and audio stream
	}

	filterComplexConcat += `concat=n=${scenes.length}:v=1:a=1[v][a]`;

	if (totalStreams === 0) {
		return res
			.status(500)
			.json({ error: "No valid scenes were found to generate the video." });
	}

	const outputPath = path.join(
		rootStorage,
		"story_archive",
		`Story_${story_id}`,
		`Chapter_${chapter_id}.mp4`
	);
	const ffmpegCommand =
		`ffmpeg ${ffmpegInputs} -filter_complex ` +
		`"${scenes
			.map(
				(_, i) =>
					`[${2 * i}:v]scale=1024:1024,setsar=1[v${i}];[${
						2 * i + 1
					}:a]aformat=sample_fmts=fltp:sample_rates=22050:channel_layouts=mono[a${i}]`
			)
			.join(";")}` +
		`;${scenes.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${
			scenes.length
		}:v=1:a=1[v][a]" ` +
		`-map "[v]" -map "[a]" -c:v libx264 -c:a aac -b:a 192k -shortest -y "${outputPath}"`;

	console.log(`Executing command: ${ffmpegCommand}`);

	exec(ffmpegCommand, (error, stdout, stderr) => {
		if (error) {
			console.error(`Error generating video: ${error.message}`);
			return res
				.status(500)
				.json({ error: "Video generation failed: " + error.message });
		}
		console.log("Video generated successfully");

		// Send the URL of the generated video
		const videoUrl = `${process.env.SERVER_BASE}/story_archive/Story_${story_id}/Chapter_${chapter_id}.mp4`;
		res.json({ message: "Video generated successfully", url: videoUrl });
	});
});

app.listen(ENV_PORT, () => {
	//console.clear();
	console.log(
		`AI STORY PROCESSOR SERVER RUNNING @ [ ${ENV_BASE}:${ENV_PORT} ]`
	);
});
