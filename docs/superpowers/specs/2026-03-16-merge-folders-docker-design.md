# MergeFoldersDocker Design Specification

**Date:** 2026-03-16
**Goal:** Rebuild the MergePicFolders application as a high-performance, containerized web application optimized for remote server execution.

## Architecture & Tech Stack

- **Backend:** Go (Golang) using the Fiber or Gin framework. Chosen for exceptional concurrent file I/O performance and minimal resource footprint.
- **Frontend:** React with TypeScript and Tailwind CSS. Chosen for building a highly responsive, modern, "app-like" Single Page Application (SPA).
- **Deployment:** Docker. The React frontend will be compiled into static assets and served directly by the Go backend from a single Docker container, ensuring trivial deployment.

## Core Components & Data Flow

### 1. The Web File Explorer
- **API:** The Go backend will expose REST endpoints (e.g., `/api/fs/list`) to list directories and files.
- **UI:** The React frontend will render a visual folder browser (similar to Windows Explorer), allowing the user to navigate the remote server's file system directly within their web browser.

### 2. Thumbnail Generation
- When a user navigates to a folder containing images, the React frontend will request thumbnails.
- The Go backend will generate optimized thumbnails on-the-fly and stream them back to the browser.
- Thumbnails will be cached locally on the server (within the container or a mapped cache volume) to ensure subsequent loads of the same directory are instantaneous.

### 3. The Merge Engine
- **Trigger:** The user selects a source folder and a destination folder via the Web File Explorer and clicks "Merge".
- **Processing:** The Go backend handles the operation using highly concurrent "goroutines" to safely move or copy files, taking advantage of the server's local disk speeds rather than transferring files over the network.
- **Collision Handling:** The engine will implement duplicate checking and safe renaming (e.g., appending `_1` to filenames) just like the original Python application.

### 4. Real-time Progress & Logging
- **Communication:** A WebSocket connection will be established between the React frontend and the Go backend.
- **Feedback:** As the Merge Engine processes files, it will push real-time progress updates, file counts, and activity logs through the WebSocket, updating the UI's progress bars immediately.

## Security and Constraints

- **Volume Mounting:** To protect the host server, the Docker container will require a specific host directory to be mounted (e.g., `-v /mnt/storage/images:/app/data`).
- **Chroot Lock:** The Go backend's file system operations will be strictly jailed to the `/app/data` directory. It will reject any API requests attempting to read or write outside of this root path, preventing accidental or malicious access to the server's broader operating system files.
