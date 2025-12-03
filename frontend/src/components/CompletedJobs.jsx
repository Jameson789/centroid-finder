"use client";
import { Box, Typography, List, ListItem, Button, Link } from "@mui/material";

export default function CompletedJobs({ jobs, onDelete, onClearAll }) {
  if (!jobs.length) return null;
  const HOST = process.env.NEXT_PUBLIC_HOST || "localhost";

  return (
    <Box sx={{ marginTop: 6 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">Completed Jobs</Typography>
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={onClearAll}
        >
          Clear All
        </Button>
      </Box>

      <List>
        {jobs.map(({ jobId, filename }) => (
          <ListItem
            key={jobId}
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography>
              {"Video: " + filename + "  -  Job ID: " + jobId}
            </Typography>

            <Box sx={{ display: "flex", gap: 1 }}>
              <Link
                href={`http://${HOST}:3000/process/${filename.replace(/\.[^/.]+$/, "")}_${jobId}.csv`}
                download={`${filename.replace(/\.[^/.]+$/, "")}.csv`}
                sx={{ textDecoration: "none" }}
              >
                <Button variant="outlined" size="small">Download</Button>
              </Link>

              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => onDelete(jobId)}
              >
                Delete
              </Button>
            </Box>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
