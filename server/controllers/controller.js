import fs from "fs/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import multer from "multer";
import { get } from "https";

// In-memory job tracking
const jobStatus = {}; 

// return list of all videos within video directory
const getVideos = async (req, res) => {
  try {
    const videoDir = process.env.VIDEO_PATH;
    const files = await fs.readdir(videoDir);
    const videoURLs = files.map((file) => `${file}`);
    res.json(videoURLs);
  } catch (err) {
    console.error("Error reading video directory:", err);
    res.status(500).json({ error: "Failed to read video directory" });
  }
};

// return thumbnail of first frame at first second
const getThumbnail = async (req, res) => {
  try {
    const videoDir = process.env.VIDEO_PATH;
    const thumbnailId = req.params.filename;
    const videoPath = path.join(videoDir, thumbnailId);

    try {
      await fs.access(videoPath);
    } catch {
      return res.status(404).json({ error: "Video not found." });
    }

    res.setHeader("Content-Type", "image/jpeg");

    ffmpeg(videoPath)
      .inputOptions(["-ss 0"])
      .outputOptions(["-frames:v 1"])
      .format("mjpeg")
      .on("error", (err) => {
        console.error("FFmpeg error:", err.message);
      })
      .pipe(res, { end: true });
  } catch (err) {
    console.error("Error generating thumbnail:", err);
    res.status(500).json({ error: "Error generating thumbnail" });
  }
};

// Start video processing using child_process
const startVideoProcess = async (req, res) => {
  const { filename } = req.params;
  const { targetColor, threshold } = req.query;
  const areas = req.body || null;

  // Debug: see what came in
  console.log("Incoming areas payload:", JSON.stringify(areas, null, 2));

  // Check if params are missing
  if (!targetColor || !threshold) {
    return res
      .status(400)
      .json({ error: "Missing targetColor or threshold query parameter." });
  }

  // Validate hex color
  const hexColorRegex = /^[0-9A-Fa-f]{6}$/;
  if (!hexColorRegex.test(targetColor)) {
    return res
      .status(400)
      .json({ error: "targetColor must be a valid 6-digit hex code (e.g., FF0000)" });
  }

  // Validate threshold number
  const thresholdNum = Number(threshold);
  if (Number.isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 255) {
    return res.status(400).json({ error: "Threshold must be a number between 0 and 255." });
  }

  try {
    const videoDir = process.env.VIDEO_PATH;
    const files = await fs.readdir(videoDir);

    if (!files.includes(filename)) {
      return res.status(404).json({ error: "Video file not found on the server." });
    }

    const jobId = randomUUID();
    jobStatus[jobId] = { status: "processing" };

    // --- create areas file if provided, then log existence/size/preview ---
    const tmpDir = process.env.AREAS_TMP_DIR || "/tmp";
    let areasFilePath = null;

    if (areas) {
      areasFilePath = path.join(tmpDir, `areas-${jobId}.json`);
      await fs.writeFile(areasFilePath, JSON.stringify(areas), "utf8");

      // Validate it's there and readable
      const stat = await fs.stat(areasFilePath);
      const preview = (await fs.readFile(areasFilePath, "utf8")).slice(0, 200);
      console.log(
        `[AREAS FILE ${jobId}] path=${areasFilePath} size=${stat.size}B preview=${preview}...`
      );
    }

    const args = [
      "-Xss16m",
      "-jar",
      "/app/Processor/target/centroidFinderVideo-jar-with-dependencies.jar",
      path.join("/videos", filename),
      targetColor,
      thresholdNum.toString(),
      jobId,
    ];

    if (areasFilePath) {
      args.push("--areas-file", areasFilePath);
    }

    // Log exact java command/args for verification
    console.log(`[SPAWN ${jobId}] java ${args.map(a => JSON.stringify(a)).join(" ")}`);

    const child = spawn(
      "java",
      args,
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let output = "";

    child.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      console.log(`[JAR OUTPUT ${jobId}]: ${text.trim()}`);
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      console.error(`[JAR ERROR ${jobId}]: ${text.trim()}`);
    });

    child.on("exit", async (code) => {
      jobStatus[jobId] = { status: code === 0 ? "done" : "error" };
      // Clean up the temp file
      if (areasFilePath) {
        try {
          await fs.unlink(areasFilePath);
        } catch (e) {
          console.warn(`Could not delete temp areas file for ${jobId}:`, e.message);
        }
      }
    });

    child.on("error", (err) => {
      jobStatus[jobId] = {
        status: "error",
        error: `Error processing video: ${err.message}`,
      };
    });

    res.status(202).json({ jobId });
  } catch (err) {
    console.error("Error starting job:", err);
    res.status(500).json({ error: "Error starting job" });
  }
};

// Logic for getting job status
const getJobStatus = (req, res) => {
  const { jobId } = req.params;
  const job = jobStatus[jobId];

  if (!job) {
    return res.status(404).json({ error: "Job ID not found" });
  }

  if (job.status === "processing") {
    return res.status(200).json({ status: "processing" });
  } else if (job.status === "done") {
    return res.status(200).json({ status: "done", result: job.result });
  } else if (job.status === "error") {
    return res.status(200).json({ status: "error", error: job.error });
  }

  return res.status(500).json({ error: "Error fetching job status" });
};

// Store multer upload in Video Path
const storage = multer.diskStorage({
  destination: path.resolve(process.env.VIDEO_PATH),
  filename: (req, file, cb) => {
    cb(null, file.originalname); 
  }
});

const upload = multer({ storage });

const UploadVideo = (req, res) => {
  res.send(`Uploaded to /videos/${req.file.filename}`);
};

// List all completed CSV jobs in the results directory
const getCompletedJobs = async (req, res) => {
  try {
    const resultsDir = process.env.RESULTS_PATH || "/results";
    const files = await fs.readdir(resultsDir);

    const csvJobs = files
      .filter(file => file.endsWith(".csv"))
      .map(file => {
        const [name, jobId] = file.replace(".csv", "").split("_");
        return {
          filename: name + ".mp4",  // Adjust if you allow other formats
          jobId
        };
      });

    res.status(200).json(csvJobs);
  } catch (err) {
    console.error("Failed to read results directory:", err);
    res.status(500).json({ error: "Could not fetch completed jobs" });
  }
};

const deleteCompletedJob = async (req, res) => {
  const { jobId } = req.params;

  try {
    const resultsDir = process.env.RESULTS_PATH || "/results";
    const files = await fs.readdir(resultsDir);

    const matchingFile = files.find(file => file.endsWith(`${jobId}.csv`));

    if (!matchingFile) {
      return res.status(404).json({ error: "CSV file not found" });
    }

    await fs.unlink(path.join(resultsDir, matchingFile));
    res.status(200).json({ message: "File deleted successfully" });
  } catch (err) {
    console.error("Error deleting file:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
};

const clearAllCompletedJobs = async (req, res) => {
  try {
    const resultsDir = process.env.RESULTS_PATH || "/results";
    const files = await fs.readdir(resultsDir);

    const csvFiles = files.filter((file) => file.endsWith(".csv"));
    const deletePromises = csvFiles.map((file) =>
      fs.unlink(path.join(resultsDir, file))
    );

    await Promise.all(deletePromises);

    res.status(200).json({ message: "All completed jobs deleted successfully" });
  } catch (err) {
    console.error("Error clearing completed jobs:", err);
    res.status(500).json({ error: "Failed to clear completed jobs" });
  }
};

export default {
  getVideos,
  getThumbnail,
  startVideoProcess,
  getJobStatus,
  UploadVideo,
  getCompletedJobs,
  deleteCompletedJob,
  clearAllCompletedJobs,
  upload
};
