const express = require("express");
const cors = require("cors");
const { exec, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= FILE SETUP ================= */

const clipsDir = path.join(__dirname, "clips");
if (!fs.existsSync(clipsDir)) {
  fs.mkdirSync(clipsDir);
}

app.use("/clips", express.static(clipsDir));

/* ================= HELPERS ================= */

function safeFilename(name) {
  return name
    .replace(/[^a-z0-9_\- ]/gi, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function getUniqueFilename(baseName) {
  let filename = `${baseName}.mp4`;
  let counter = 1;

  while (fs.existsSync(path.join(clipsDir, filename))) {
    filename = `${baseName}_${counter}.mp4`;
    counter++;
  }

  return filename;
}

function getDuration(filePath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    ).toString();
    return Math.round(parseFloat(output));
  } catch {
    return null;
  }
}

/* ================= API ROUTES ================= */

// List clips with pagination + search
app.get("/api/clips", (req, res) => {
  const page = parseInt(req.query.page || "1");
  const limit = parseInt(req.query.limit || "10");
  const search = (req.query.search || "").toLowerCase();

  const allClips = fs
    .readdirSync(clipsDir)
    .filter(f => f.endsWith(".mp4"))
    .map(name => {
      const fullPath = path.join(clipsDir, name);
      const stats = fs.statSync(fullPath);

      return {
        name,
        duration: getDuration(fullPath),
        createdAt: stats.birthtimeMs || stats.mtimeMs
      };
    })
    .filter(clip => clip.name.toLowerCase().includes(search))
    .sort((a, b) => b.createdAt - a.createdAt);

  const total = allClips.length;
  const start = (page - 1) * limit;
  const paged = allClips.slice(start, start + limit);

  res.json({
    clips: paged,
    page,
    totalPages: Math.ceil(total / limit)
  });
});

// Delete clip
app.delete("/api/clips/:name", (req, res) => {
  const filePath = path.join(clipsDir, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Clip not found");
  }

  fs.unlinkSync(filePath);
  res.sendStatus(200);
});

// Create clip
app.post("/clip", (req, res) => {
  const { url, start, end, clipName } = req.body;

  if (!url || start === undefined || end === undefined || !clipName) {
    return res.status(400).send("Missing parameters");
  }

  const cleanName = safeFilename(clipName);
  const finalName = getUniqueFilename(cleanName);

  const tempFile = path.join(__dirname, "temp.mp4");
  const outputFile = path.join(clipsDir, finalName);

  const command =
    `cmd /c yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" ` +
    `--merge-output-format mp4 -o "${tempFile}" "${url}" ` +
    `&& ffmpeg -y -ss ${start} -to ${end} -i "${tempFile}" -c copy "${outputFile}"`;

  exec(command, error => {
    if (error || !fs.existsSync(outputFile)) {
      return res.status(500).send("Video processing failed");
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${finalName}"`
    );

    const stream = fs.createReadStream(outputFile);
    stream.pipe(res);

    stream.on("close", () => {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    });
  });
});

/* ================= START SERVER ================= */

app.listen(3000, () => {
  console.log("Backend running at http://localhost:3000");
});
