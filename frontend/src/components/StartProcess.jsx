"use client";
import { useState, useEffect } from "react";
import { Box, Button, Typography, LinearProgress } from "@mui/material";
import CompletedJobs from "./CompletedJobs";
import withVideoProcessing from "./withVideoProcessing";

const StartProcess = ({
  filename,
  color,
  threshold,
  areaValues,
  areaNames,
  status,
  jobId,
  start,
  reset,
  done,
  checkErrors
}) => {
  const [completedJobs, setCompletedJobs] = useState([]);
  const [jobError, setJobError] = useState("");

  // if areas are selected, create map of names and values, else set to null
  const areas = areaValues.length == 0 ? null : new Map(areaNames.map((key, index) => [key, areaValues[index]]));

  // Fetch completed jobs on load
  useEffect(() => {
    const fetchCompleted = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/completed");
        if (!res.ok) throw new Error("Failed to fetch completed jobs");
        const data = await res.json();
        setCompletedJobs(data);
      } catch (err) {
        console.error("Error loading completed jobs:", err);
      }
    };

    fetchCompleted();
  }, []);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3000/process/${jobId}/status`);
        const data = await res.json();

        if (data.status === "done") {
          const newJob = { jobId, filename };
          setCompletedJobs((prev) => {
            if (prev.some((job) => job.jobId === jobId)) return prev;
            return [...prev, newJob];
          });
          done();
          clearInterval(interval);
        } else if (data.status === "error") {
          setJobError(data.error || "An unknown error occurred.");
          reset();
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to check job status:", err);
        setJobError("Network error while checking job status.");
        reset();
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, filename, reset, done]);

  // Handle download
  const handleDownload = async (jobId, filename) => {
  try {
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const downloadPath = `http://localhost:3000/process/${baseName}_${jobId}.csv`;

    const res = await fetch(downloadPath);
    if (!res.ok) throw new Error("File not found");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed:", err);
  }
};


  const handleDeleteJob = async (jobIdToDelete) => {
    try {
      const res = await fetch(`http://localhost:3000/api/completed/${jobIdToDelete}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete job");
      setCompletedJobs((prev) => prev.filter((job) => job.jobId !== jobIdToDelete));
    } catch (err) {
      console.error("Error deleting job:", err);
    }
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete all completed jobs? This will permanently remove all CSV files."
    );
    if (!confirmed) return;

    try {
      const res = await fetch("http://localhost:3000/api/completed", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear jobs");
      setCompletedJobs([]);
    } catch (err) {
      console.error("Error clearing jobs:", err);
    }
  };

  return (
    <Box sx={{ marginTop: 6, textAlign: "center" }}>
      {/* Start Button */}
      <Button
        variant="contained"
        onClick={() => {
          setJobError("");
          const hasError = checkErrors();
          if (!hasError){
            start(filename, color, threshold, areas);
          }
          
        }}
        disabled={status === "processing"}
        sx={{ backgroundColor: "lightblue", color: "black" }}
      >
        {status === "processing" ? "Processing..." : "Start Process"}
      </Button>

      {/* Loading Bar */}
      {status === "processing" && !jobError && (
        <Box sx={{ width: "100%", mt: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Errors */}
      
      {jobError && (
        <Typography sx={{ mt: 2, color: "red" }}>
          ⚠️ Job Failed: {jobError}
        </Typography>
      )}

      {/* Success & Download */}
      {status === "done" && jobId && (
        <Box sx={{ mt: 2 }}>
          <Typography>✅ Process complete!</Typography>
          <Button
            variant="outlined"
            sx={{ mt: 1 }}
            onClick={() => handleDownload(jobId, filename)}
          >
            Download CSV
          </Button>
        </Box>
      )}

      {/* Completed Jobs */}
      <CompletedJobs
        jobs={completedJobs}
        onDelete={handleDeleteJob}
        onClearAll={handleClearAll}
      />
    </Box>
  );
};

export default withVideoProcessing(StartProcess);
