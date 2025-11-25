package io.github.jameson789.app;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.Java2DFrameConverter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Usage:
 *   java ImageSummaryApp <input_video> <hex_target_color> <threshold> <task_id> [--areas-file <path>]
 *
 * Behavior:
 * - Without --areas-file: CSV rows are "second,x,y".
 * - With --areas-file:    CSV rows are "second,x,y,region" (region may be empty if no match).
 * - When regions are enabled and results exist: writes a summary text file named like the results CSV
 *   but with "_summary.txt" appended (e.g., "<basename>_<taskId>_summary.txt") containing:
 *     1) "=== TOTALS PER REGION ===" lines: "centroid in region <NAME> for <SECONDS> seconds"
 *     2) "=== MOVEMENT TIMELINE ===" (contiguous runs) in chronological order:
 *        - "centroid in region <NAME> for <SECONDS> seconds", or
 *        - "centroid not in any region for <SECONDS> seconds" (when detected but outside regions)
 *
 * Notes:
 * - RESULT_PATH env var can override output directory; otherwise "../results" is used.
 * - Regions JSON must be an object of { "name": { "x": int, "y": int, "width": int, "height": int }, ... }.
 */
public class ImageSummaryApp {

    // Container for a contiguous run (inside a region or outside all regions)
    private static final class Run {
        final String region; // null means "not in any region"
        final int seconds;
        Run(String region, int seconds) {
            this.region = region;
            this.seconds = seconds;
        }
    }

    public static void main(String[] args) {
        if (args.length < 4) {
            throw new IllegalArgumentException(
                "Usage: java ImageSummaryApp <input_video> <hex_target_color> <threshold> <task_id> [--areas-file <path>]"
            );
        }

        // Positional args
        final String videoPath = args[0];
        final String hexTargetColor = args[1];
        final String taskId = args[3];

        final int targetColor;
        final int threshold;
        try {
            targetColor = Integer.parseInt(hexTargetColor, 16);
            threshold   = Integer.parseInt(args[2]);
        } catch (Exception e) {
            System.err.println("Error parsing color or threshold.");
            return;
        }

        // Optional flags
        String areasFilePath = null;
        for (int i = 4; i < args.length; i++) {
            String a = args[i];
            if ("--areas-file".equals(a) && i + 1 < args.length) {
                areasFilePath = args[++i];
            } else {
                System.err.println("Unknown or incomplete option: " + a);
            }
        }

        // Load regions if provided
        Map<String, Region> regions = null;
        if (areasFilePath != null && !areasFilePath.isBlank()) {
            try {
                regions = loadRegionsFromJson(areasFilePath);
                System.out.println("Loaded regions from " + areasFilePath + " count=" + (regions != null ? regions.size() : 0));
            } catch (IOException ex) {
                System.err.println("Failed to load regions JSON: " + ex.getMessage());
                // Continue without regions for robustness
            }
        }
        final boolean writeRegion = (regions != null && !regions.isEmpty());

        // Output dir setup (assumes directory already exists in your environment)
        String resultDir = System.getenv("RESULT_PATH");
        if (resultDir == null || resultDir.isBlank()) {
            resultDir = "../results"; // fallback for local dev
        }

        // Base names
        String baseName = new File(videoPath).getName();
        int dotIndex = baseName.lastIndexOf('.');
        if (dotIndex > 0) baseName = baseName.substring(0, dotIndex);

        String outputFileName = baseName + "_" + taskId + ".csv";
        File outputFile = new File(resultDir, outputFileName);

        // Per-region seconds accumulator (only used when regions enabled)
        final Map<String, Integer> regionSeconds = new LinkedHashMap<>();

        // Movement timeline: contiguous runs (in region or "not in any region")
        final List<Run> runs = new ArrayList<>();
        String currentRegion = null;    // region currently occupied; null => detected but outside all regions
        int currentRunSeconds = 0;      // length of current contiguous run (only while centroid is detected)

        try (FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoPath);
             PrintWriter writer = new PrintWriter(outputFile)) {

            grabber.start();
            Java2DFrameConverter converter = new Java2DFrameConverter();
            ImageProcessor processor = new ImageProcessor(targetColor, threshold);

            double fps = grabber.getFrameRate();
            double durationInSeconds = grabber.getLengthInTime() / 1_000_000.0;
            System.out.printf("Video duration: %.2f seconds%n", durationInSeconds);

            if (writeRegion) writer.println("second,x,y,region"); else writer.println("second,x,y");

            // Process one frame per second
            for (int second = 0; second < (int) durationInSeconds; second++) {
                int frameNumber = (int) (second * fps);
                grabber.setFrameNumber(frameNumber);

                var frame = grabber.grabImage();
                if (frame != null) {
                    BufferedImage image = converter.getBufferedImage(frame);
                    CentroidResult result = processor.processImage(image);

                    if (result != null) {
                        if (writeRegion) {
                            String regionName = findRegionName(regions, result.x(), result.y());
                            writer.printf("%d,%d,%d,%s%n",
                                second, result.x(), result.y(), regionName != null ? regionName : "");

                            // Totals per region (only when inside a named region)
                            if (regionName != null && !regionName.isBlank()) {
                                regionSeconds.merge(regionName, 1, Integer::sum);
                            }

                            // Movement timeline (track contiguous runs, including "not in any region")
                            if (!Objects.equals(regionName, currentRegion)) {
                                // Close previous run if it existed
                                if (currentRunSeconds > 0) {
                                    runs.add(new Run(currentRegion, currentRunSeconds));
                                }
                                // Start new run (even if regionName == null)
                                currentRegion = regionName; 
                                currentRunSeconds = 1;
                            } else {
                                // Continue current run
                                currentRunSeconds++;
                            }
                        } else {
                            writer.printf("%d,%d,%d%n", second, result.x(), result.y());
                        }
                    } else {
                        // No centroid detected this second: close any ongoing run and reset
                        if (writeRegion) {
                            if (currentRunSeconds > 0) {
                                runs.add(new Run(currentRegion, currentRunSeconds));
                            }
                            currentRegion = null;
                            currentRunSeconds = 0;
                        }
                    }
                } else {
                    // No frame returned: close any ongoing run and reset
                    if (writeRegion) {
                        if (currentRunSeconds > 0) {
                            runs.add(new Run(currentRegion, currentRunSeconds));
                        }
                        currentRegion = null;
                        currentRunSeconds = 0;
                    }
                }
            }

            // Close any open run after the loop
            if (writeRegion && currentRunSeconds > 0) {
                runs.add(new Run(currentRegion, currentRunSeconds));
            }

            grabber.stop();
            System.out.println("Processing complete. Output: " + outputFileName);

            // Write the summary text file only when regions were enabled AND we have something to report
            if (writeRegion && (!regionSeconds.isEmpty() || !runs.isEmpty())) {
                String summaryFileName = outputFileName.replace(".csv", "_summary.txt");
                File summaryFile = new File(resultDir, summaryFileName);
                try (PrintWriter summaryWriter = new PrintWriter(summaryFile)) {
                    // --- Section 1: Totals
                    summaryWriter.println("=== TOTALS PER REGION ===");
                    if (!regionSeconds.isEmpty()) {
                        for (Map.Entry<String, Integer> e : regionSeconds.entrySet()) {
                            summaryWriter.printf("centroid in region %s for %d seconds%n", e.getKey(), e.getValue());
                        }
                    } else {
                        summaryWriter.println("no region totals (centroid never entered any region)");
                    }

                    summaryWriter.println(); // blank line separator

                    // --- Section 2: Movement timeline (contiguous runs while centroid detected)
                    summaryWriter.println("=== MOVEMENT TIMELINE (contiguous runs while centroid detected) ===");
                    if (!runs.isEmpty()) {
                        for (Run r : runs) {
                            if (r.region == null || r.region.isBlank()) {
                                summaryWriter.printf("centroid not in any region for %d seconds%n", r.seconds);
                            } else {
                                summaryWriter.printf("centroid in region %s for %d seconds%n", r.region, r.seconds);
                            }
                        }
                    } else {
                        summaryWriter.println("no movement timeline (no contiguous stays with centroid detected)");
                    }
                }
                System.out.println("Summary written: " + summaryFileName);
            }

        } catch (Exception e) {
            System.err.println("Error processing video.");
            e.printStackTrace();
            System.exit(1);
        }
    }

    // -------- helpers --------

    private static Map<String, Region> loadRegionsFromJson(String path) throws IOException {
        byte[] bytes = Files.readAllBytes(Path.of(path));
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(bytes);

        Map<String, Region> out = new LinkedHashMap<>();
        if (root != null && root.isObject()) {
            root.fields().forEachRemaining(entry -> {
                String name = entry.getKey();
                JsonNode n = entry.getValue();
                if (n != null && n.isObject()) {
                    int x = getInt(n, "x");
                    int y = getInt(n, "y");
                    int w = getInt(n, "width");
                    int h = getInt(n, "height");
                    out.put(name, new Region(name, x, y, w, h));
                }
            });
        }
        return out;
    }

    private static int getInt(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || !v.isNumber()) {
            throw new IllegalArgumentException("Missing or non-numeric field: " + field);
        }
        return v.asInt();
    }

    private static String findRegionName(Map<String, Region> regions, int x, int y) {
        for (Region r : regions.values()) {
            if (r.contains(x, y)) {
                return r.getName();
            }
        }
        return null; // no match => "not in any region"
    }
}
