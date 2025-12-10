# 📸 Centroid Finder — End-to-End Salamander Tracking System

Centroid Finder is a full-stack application built to process video and image files by detecting color-based centroids — ideal for lab experiments like salamander pheromone preference tracking. It combines a powerful Java backend for image/video analysis, a Next.js frontend for interaction and control, and an Express API to manage processing jobs.

---

- [Setting up Docker](#installing-and-running-docker)
- [Running Application on Docker](#running-the-project)
- [Troubleshooting](#troubleshooting)
- [CI/CD pipeline](#cicd-pipeline)

---

## 🧩 Project Structure

| Layer        | Description |
|--------------|-------------|
| **Frontend** | React + Next.js interface for selecting videos, adjusting color threshold, previewing results, and downloading CSVs |
| **Backend**  | Express.js API that manages processing jobs and interacts with the Java engine |
| **Processor**| Java-based binary image processor that detects pixel clusters and outputs centroid data |
| **Docker**   | Containerizes the system for reproducible deployments |
| **Testing**  | End-to-end testing powered by Cypress and JUnit |

---

## 🖼️ Key Features

### ✅ Interactive Frontend
- Video chooser and thumbnail preview
- Live binarization with threshold & color picker
- Process button triggers full backend job
- Displays job status and provides downloadable results
- Built with Material UI and tested via Cypress

### 🧠 Java Backend Processor
- Converts image or video frame to binary based on target color
- Identifies and groups white pixel regions using DFS
- Outputs `binarized.png` and `groups.csv` with centroid data
- JavaCV used for video frame extraction

### 🔁 Node.js Express Server
- REST API for job submission and tracking
- Passes job details to Java JAR processor
- Serves result files and job status via endpoints

### 📦 Docker Deployment
- Runs Java + Node in a unified container
- Volumes handle input/output for media and result files
- ENV variables used for path config

---

## Installing and Running Docker

### Step 1: Install Docker

Docker is a platform that allows you to run applications in containers. Think of it like a virtual box that contains everything needed to run this project.

#### For Windows:
1. Go to [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Download and run the installer
3. Follow the installation wizard
4. Restart your computer when prompted
5. Open Docker Desktop and wait for it to start (you'll see a whale icon in your system tray)

#### For Mac:
1. Go to [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. Download the appropriate version for your Mac (Intel or Apple Silicon)
3. Drag Docker to your Applications folder
4. Launch Docker Desktop and follow any setup prompts
5. Wait for Docker to start (you'll see a whale icon in your menu bar)

#### For Linux:
1. Follow the instructions for your specific distribution at [Docker Engine Install](https://docs.docker.com/engine/install/)
2. After installation, you may need to add your user to the docker group:
   ```bash
   sudo usermod -aG docker $USER
   ```
3. Log out and back in for changes to take effect

### Step 2: Verify Docker Installation

Open your terminal/command prompt and run:
```bash
docker --version
```

You should see something like "Docker version 24.x.x". If you get an error, Docker isn't installed correctly.

## Running the Project

### Step 1: Create Folders for Your Data

Before running the project, you need to create folders on your computer where the application will store videos and results.

1. **Create a folder for videos**: This is where you'll put video files that the application will process
2. **Create a folder for results**: This is where the application will save its output

For example:
- **Windows**: Create `C:\salamander-videos` and `C:\salamander-results`
- **Mac/Linux**: Create `~/salamander-videos` and `~/salamander-results`

### Step 2: Download and Run the Application

Open your terminal/command prompt and run these commands:
Replace the folder paths below with the actual paths to the folders you created in Step 3, and make sure to not have any spaces in the file path.

**For Windows (using PowerShell or Command Prompt):**
Run the following commands seperately: 
```bash
docker run -p 3000:3000 -d -v C:\salamander-videos:/videos -v C:\salamander-results:/results ghcr.io/jameson789/centroid-finder-backend:latest
```

```bash
docker run -p 3001:3001 -d ghcr.io/jameson789/centroid-finder-frontend:latest
```

**For Mac/Linux:**
```bash
docker run -p 3000:3000 -d -v ~/salamander-videos:/videos -v ~/salamander-results:/results ghcr.io/jameson789/centroid-finder-backend:latest
```
```bash
docker run -p 3001:3001 -d ghcr.io/jameson789/centroid-finder-frontend:latest
```
If it's the first time running the application, or if the application has been updated, it may take a minute to download before running. 

#### Understanding the Command

Let's break down what that long `docker run` command does:

- `docker run` - Tells Docker to start a new container
- `-p 3000:3000` - Maps port 3000 on your computer to port 3000 in the container (for the web interface)
- `-p 3001:3001` - Maps port 3001 on your computer to port 3001 in the container (for additional services)
- `-v localVideoPath:/videos` - Connects your local videos folder to the container's `/videos` folder
- `-v localResultsPath:/results` - Connects your local results folder to the container's `/results` folder
- `ghcr.io/jameson789/centroid-finder-backend:latest` - The name and version of the application to run


### Step 3: Access the Application

Once the application is running (you'll see log messages in your terminal), open your web browser and go to:
- `http://localhost:3001` - Web App(where the application actually runs)
- `http://localhost:3000` - Backend API(runs behind the scenes)

### Customizing Ports (Optional)

If ports 3000 and 3001 are already being used by other applications on your computer, you can change them. For example:

```bash
docker run -p 3030:3000 -d -v ~/salamander-videos:/videos -v ~/salamander-results:/results 
ghcr.io/jameson789/centroid-finder-backend:latest
```
```bash
docker run -p 3031:3001 -d ghcr.io/jameson789/centroid-finder-frontend:latest
```

Then access the application at `http://localhost:3031` instead.

**Important**: Always keep the numbers after the `:` as `3000` and `3001` - only change the numbers before the `:`.

The best way to check what application are running on what ports is by viewing the docker desktop application. If the ports are in use, it's possible you have another version of the salamander app running already.

### Stopping the Application

To stop the application:
1. Go back to your terminal where it's running
2. Press `Ctrl+C` (Windows/Linux) or `Cmd+C` (Mac) 

Or: Stop the process using the red square icon in the docker application itself, or terminate the process using the red Trash can button. 

## Troubleshooting

### "Docker command not found"
- Docker isn't installed or isn't in your system PATH
- Try restarting your terminal/computer after installation

### "Port already in use"
- Another application is using ports 3000 or 3001
- Stop other application or use different ports (see "Customizing Ports" section above)

### "Cannot connect the Docker daemon"
- Docker Desktop isn't running
- Start Docker Desktop and wait for it to fully load

### "No such file or directory" (folder path errors)
- Check that the folders you specified actually exist
- Make sure you're using the correct path format for your operating system
- On Windows, use forward slashes `/` or escape backslashes `\\`

### "Output files not downloading properly"
- Make sure there are no spaces in the video file names