# MergeFoldersDocker

A high-performance, containerized web application optimized for remote server execution, designed to easily merge folders containing images. It provides a visual web UI to navigate the server's file system, generate thumbnails, and safely merge or move files with collision handling (e.g., safe renaming).

## Features

- **Embedded Monolith Architecture:** A single Go binary that acts as the API server and serves the embedded React frontend.
- **Fast File System Operations:** Written in Go for exceptional concurrent file I/O performance.
- **Web-based File Explorer:** A React + Tailwind CSS interface to visually navigate server directories.
- **On-the-fly Thumbnails:** Generates and caches image thumbnails for rapid subsequent browsing.
- **Merge Engine:** Configurable policies for resolving file conflicts (`Safe Rename`, `Overwrite`, `Skip`).
- **Real-time Progress:** WebSocket integration provides live progress bars and activity logs during the merge process.
- **Security:** Chroot-like restriction ensures the application cannot access files outside the designated `DATA_PATH`.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Setup and Installation

1. Clone this repository.
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Edit the `.env` file and set the absolute paths on your host machine:
   - `DATA_PATH`: The directory containing the folders you want to merge.
   - `CACHE_PATH`: A directory where the application can store generated image thumbnails for faster loading.

## Running the Application

Start the application using Docker Compose:

```bash
docker compose up -d
```

The application will be available at [http://localhost:8080](http://localhost:8080).

## Development

If you want to run the application locally without Docker:

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
go run main.go
```
