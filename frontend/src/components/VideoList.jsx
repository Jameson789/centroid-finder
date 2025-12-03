"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Typography,
  Alert,
  Container,
  Paper,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const HOST = process.env.NEXT_PUBLIC_HOST || "localhost";
const API_HOST = `http://${HOST}:3000`; // Express server

const TARGET_W = 240;
const TARGET_H = 135;

function isVideoFile(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ["mp4", "mov", "m4v", "avi", "mkv", "webm"].includes(ext);
}

// Draw "cover" into a canvas (like CSS object-fit: cover)
async function makeUniformThumb(srcUrl, w = TARGET_W, h = TARGET_H) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous"; // server already has CORS enabled
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = srcUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // compute scale to cover
  const scale = Math.max(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (w - drawW) / 2;
  const dy = (h - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, drawW, drawH);

  // JPEG is smaller; quality 0.86 is a good balance
  return canvas.toDataURL("image/jpeg", 0.86);
}

const VideoList = () => {
  const [videos, setVideos] = useState([]);
  const [thumbMap, setThumbMap] = useState({}); // { filename: dataURL }
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  // 1) Load filenames
  const fetchVideos = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_HOST}/api/videos`);
      if (!res.ok) throw new Error("Failed to load videos");
      const data = await res.json();
      // Hide non-video files like .DS_Store
      const onlyVideos = data.filter(isVideoFile);
      setVideos(onlyVideos);
      // kick off thumbnail normalization
      generateThumbs(onlyVideos);
    } catch (err) {
      setError(err.message || "Failed to load videos");
    }
  };

  // 2) Generate uniform thumbnails on the client
  const generateThumbs = async (files) => {
    try {
      const entries = await Promise.all(
        files.map(async (filename) => {
          const rawUrl = `${API_HOST}/thumbnail/${encodeURIComponent(
            filename
          )}?t=${Date.now()}`;
          try {
            const dataUrl = await makeUniformThumb(rawUrl, TARGET_W, TARGET_H);
            return [filename, dataUrl];
          } catch {
            // Fallback placeholder data URL if a thumb fails
            const placeholder =
              "data:image/svg+xml;charset=UTF-8," +
              encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='${TARGET_W}' height='${TARGET_H}'><rect width='100%' height='100%' fill='#eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='16' fill='#999'>No Thumbnail</text></svg>`
              );
            return [filename, placeholder];
          }
        })
      );
      setThumbMap(Object.fromEntries(entries));
    } catch (e) {
      // Don’t block UI if any single image fails
      console.error("Thumbnail generation error:", e);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("video/")) {
      setError("Please select a video file");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append("video", file);

      const res = await fetch(`${API_HOST}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload video");
      await fetchVideos();
    } catch (err) {
      setError(err.message || "Failed to upload video");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <Container maxWidth="md" sx={{ paddingTop: 4, paddingBottom: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Upload */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <input
            type="file"
            accept="video/*"
            onChange={handleUpload}
            style={{ display: "none" }}
            id="video-upload"
          />
          <label htmlFor="video-upload">
            <Button
              variant="contained"
              component="span"
              startIcon={<UploadFileIcon />}
              disabled={uploading}
              sx={{ mb: 2 }}
            >
              {uploading ? "Uploading..." : "Upload Video"}
            </Button>
          </label>
        </Box>

        {/* Errors */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Empty state */}
        {videos.length === 0 && (
          <Typography align="center" color="text.secondary">
            No videos available
          </Typography>
        )}

        {/* Uniform grid */}
        <Grid container spacing={2}>
          {videos.map((video) => (
            <Grid item key={video} xs={12} sm={6} md={4}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderColor: "#eee",
                }}
              >
                <Link
                  href={`/preview/${encodeURIComponent(video)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <CardActionArea>
                    {/* Fixed-size image area using the canvas output */}
                    <Box
                      sx={{
                        width: "100%",
                        // keep the layout tight and predictable
                        aspectRatio: "16 / 9",
                        bgcolor: "#000",
                      }}
                    >
                      <CardMedia
                        component="img"
                        alt={`${video} thumbnail`}
                        // Use processed data URL if ready; fallback to raw server image
                        src={
                          thumbMap[video] ??
                          `${API_HOST}/thumbnail/${encodeURIComponent(
                            video
                          )}?t=${Date.now()}`
                        }
                        loading="lazy"
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </Box>

                    <CardContent sx={{ py: 1.5, px: 1.5 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          fontWeight: 500,
                        }}
                        title={video}
                      >
                        {video}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Link>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Container>
  );
};

export default VideoList;
