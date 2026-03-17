# MergeFoldersDocker Design Document

**Date:** 2026-03-16
**Goal:** Rebuild the MergePicFolders application as a high-performance, containerized web application optimized for remote server execution.

## 1. Architecture: Embedded Monolith

To achieve trivial deployment and a minimal resource footprint, the application will be built as a single Go binary that embeds its own frontend assets.

- **Backend:** Go (Golang) using the **Gin** framework.
- **Frontend:** React (TypeScript) + Vite + Tailwind CSS.
- **State Management:** `zustand`.
- **Communication:** REST (file browsing) + WebSockets (real-time progress).
- **Packaging:** Go `embed` package to include the React `dist/` folder in the binary.
- **Deployment:** Single Docker container with one host volume mount.

## 2. Core Components

### 2.1 Backend (Gin API)
- **`main.go`**: Entry point. Sets up Gin router, middleware, and serves embedded static files for the UI.
- **`pkg/api`**: REST handlers for:
  - `GET /api/fs/list?path=...`: Returns directory contents.
  - `GET /api/fs/thumb?path=...`: Streams generated thumbnails.
  - `POST /api/merge`: Initiates the merge operation.
    - **Request Payload**: `{ "source": "string", "destination": "string", "policy": "rename|overwrite|skip", "dryRun": boolean }`
- **`pkg/fs`**: Core logic for:
  - **Chroot Jail**: All file operations are strictly restricted to the mounted `/app/data` directory.
  - **Thumbnail Generation**: Uses `disintegration/imaging` to create and cache thumbnails in `/app/cache`.
- **`pkg/ws`**: WebSocket hub for broadcasting progress updates from the Merge Engine.
  - **Message Format**: `{ "type": "progress|log|error|complete", "data": { "percent": number, "message": "string", "file": "string" } }`

### 2.2 Frontend (React UI)
- **File Explorer**: A visual browser for navigating the `/app/data` volume.
- **Merge Dashboard**:
  - Source/Destination folder selection.
  - Duplicate policy selection (Safe Rename, Overwrite, Skip).
- **Progress View**: Real-time progress bar and activity logs driven by the WebSocket connection.

## 3. Data Flow & Processing

### 3.1 File Merging Engine
1. User selects source (`S`) and destination (`D`) folders.
2. User clicks "Merge".
3. Backend starts a background goroutine for the operation.
4. Engine scans `S` and calculates total file count.
5. Engine processes each file:
   - Checks if file exists in `D`.
   - If collision exists, applies the selected policy (e.g., `image.jpg` -> `image_1.jpg`).
   - If `dryRun` is false, performs a local `os.Rename` (fast move) or `io.Copy` (if across filesystems) inside the container.
   - Broadcasts progress updates via WebSocket.

### 3.2 Thumbnail Pipeline
1. Frontend requests a thumbnail for `/app/data/images/photo.jpg`.
2. Backend checks the internal cache (`/app/cache`).
3. If missing, backend generates a 150px thumbnail, saves it to cache, and streams it back.
4. **Cache Persistence**: The `/app/cache` directory is ephemeral by default but can be mapped to a host volume for persistence.

## 4. Security and Constraints

- **Single Mount Volume**: The container expects exactly one volume mounted at `/app/data` (e.g., `-v /mnt/storage:/app/data`).
- **Path Validation**: All API paths are cleaned and validated to ensure they start with `/app/data`. Any path containing `..` or leading outside the root is rejected with a 403 Forbidden.
- **Authentication**: This application is intended to run in a trusted local environment or behind a reverse proxy (e.g., Nginx, Authelia) providing authentication. Direct exposure to the public internet is not recommended.
- **Dry Run Safety**: A "Dry Run" mode is a mandatory feature for the Merge Engine to allow users to verify the outcome without actual file movement.

## 5. Implementation Phases

1. **Scaffolding**: Initialize Go module and React (Vite) project.
2. **FileSystem API**: Implement `list` and `chroot` logic in Go.
3. **Frontend Explorer**: Build the React file browser and navigation.
4. **Merge Engine**: Implement the core move/copy logic with goroutines.
5. **Real-time Progress**: Integrate WebSockets for live feedback.
6. **Dockerization**: Create the multi-stage Dockerfile for the embedded monolith.
