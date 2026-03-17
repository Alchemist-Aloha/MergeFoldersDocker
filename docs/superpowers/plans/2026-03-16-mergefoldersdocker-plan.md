# MergeFoldersDocker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the MergePicFolders application as a high-performance, containerized web application optimized for remote server execution.

**Architecture:** A single Go binary that acts as both the API server (using Gin) and serves embedded static React/Vite/Tailwind frontend assets.

**Tech Stack:** Go (Gin), React (TypeScript, Vite, Tailwind, Zustand), Docker.

---

## Chunk 1: Scaffolding and Core FileSystem (FS) API

### Task 1: Project Scaffolding

**Files:**
- Create: `go.mod`
- Create: `main.go`
- Create: `.gitignore`

- [ ] **Step 1: Initialize Go Module**

Run: `go mod init mergefoldersdocker`
Expected: `go.mod` file created.

- [ ] **Step 2: Add Gin and Imaging dependencies**

Run: `go get github.com/gin-gonic/gin github.com/gin-contrib/cors github.com/disintegration/imaging github.com/gorilla/websocket`
Expected: `go.mod` and `go.sum` updated with dependencies.

- [ ] **Step 3: Scaffold frontend with Vite**

Run: `npm create vite@latest frontend -- --template react-ts`
Expected: `frontend` directory created.

- [ ] **Step 4: Install frontend dependencies**

Run: `cd frontend && npm install && npm install tailwindcss @tailwindcss/vite zustand lucide-react`
Expected: `node_modules` created in `frontend`.

- [ ] **Step 5: Configure Tailwind**

Run: `cd frontend && npx tailwindcss init -p`
Edit `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```
Edit `frontend/src/index.css`:
```css
@import "tailwindcss";
```
Expected: Tailwind configured correctly.

- [ ] **Step 6: Setup basic main.go**

```go
package main

import (
	"log"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	r.GET("/api/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})
	log.Println("Server starting on :8080")
	r.Run(":8080")
}
```

- [ ] **Step 7: Run server to verify**

Run: `go run main.go` in background, then `curl http://localhost:8080/api/ping`
Expected: `{"message":"pong"}`

- [ ] **Step 8: Commit Scaffolding**

```bash
git add .
git commit -m "chore: initial project scaffolding"
```

### Task 2: Core FileSystem (FS) Security and List API

**Files:**
- Create: `pkg/fs/fs.go`
- Create: `pkg/fs/fs_test.go`

- [ ] **Step 1: Write tests for chroot validation**

Create `pkg/fs/fs_test.go`:
```go
package fs

import "testing"

func TestValidatePath(t *testing.T) {
	chroot := "/app/data"
	
	tests := []struct {
		input string
		valid bool
	}{
		{"/app/data/valid/path", true},
		{"/app/data/../secret", false},
		{"/etc/passwd", false},
		{"/app/data", true},
		{"/app/data_leak", false},
	}

	for _, tt := range tests {
		valid, _ := ValidatePath(tt.input, chroot)
		if valid != tt.valid {
			t.Errorf("ValidatePath(%s) expected %v, got %v", tt.input, tt.valid, valid)
		}
	}
}
```

- [ ] **Step 2: Run tests to fail**

Run: `go test ./pkg/fs`
Expected: FAIL (ValidatePath not defined)

- [ ] **Step 3: Implement ValidatePath**

Create `pkg/fs/fs.go`:
```go
package fs

import (
	"path/filepath"
	"strings"
)

func ValidatePath(requestedPath, chroot string) (bool, string) {
	cleanPath := filepath.Clean(requestedPath)
	cleanChroot := filepath.Clean(chroot)
	
	rel, err := filepath.Rel(cleanChroot, cleanPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return false, ""
	}
	return true, cleanPath
}
```

- [ ] **Step 4: Write test for ListDirectory**

Add to `pkg/fs/fs_test.go`:
```go
import "os"
// ...
func TestListDirectory(t *testing.T) {
	// Setup temp dir
	tmpDir := t.TempDir()
	os.Mkdir(filepath.Join(tmpDir, "sub"), 0755)
	os.WriteFile(filepath.Join(tmpDir, "file.txt"), []byte("test"), 0644)

	entries, err := ListDirectory(tmpDir, tmpDir)
	if err != nil {
		t.Fatalf("ListDirectory failed: %v", err)
	}
	if len(entries) != 2 {
		t.Errorf("Expected 2 entries, got %d", len(entries))
	}
}
```

- [ ] **Step 5: Run tests to fail**

Run: `go test ./pkg/fs`
Expected: FAIL (ListDirectory not defined)

- [ ] **Step 6: Implement ListDirectory**

Add to `pkg/fs/fs.go`:
```go
import "os"
import "fmt"

type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

func ListDirectory(dirPath, chroot string) ([]FileEntry, error) {
	valid, cleanPath := ValidatePath(dirPath, chroot)
	if !valid {
		return nil, fmt.Errorf("access denied")
	}

	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return nil, err
	}

	var result []FileEntry
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue // Skip files we can't read info for
		}
		result = append(result, FileEntry{
			Name:  e.Name(),
			Path:  filepath.Join(cleanPath, e.Name()),
			IsDir: e.IsDir(),
			Size:  info.Size(),
		})
	}
	return result, nil
}
```

- [ ] **Step 7: Run tests to pass**

Run: `go test ./pkg/fs`
Expected: PASS

- [ ] **Step 8: Commit FileSystem API**

```bash
git add pkg/fs
git commit -m "feat: implement secure filesystem listing"
```

## Chunk 2: API Endpoints and Thumbnails

### Task 3: File System Endpoints

**Files:**
- Create: `pkg/api/fs_handlers.go`
- Modify: `main.go`

- [ ] **Step 1: Write tests for FS Handlers**

Create `pkg/api/fs_handlers_test.go`:
```go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"github.com/gin-gonic/gin"
	"mergefoldersdocker/pkg/fs"
)

func TestListHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	r.GET("/api/fs/list", ListHandler("/tmp")) // Assuming /tmp exists for basic test

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/fs/list?path=/tmp", nil)
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("Expected 200, got %d", w.Code)
	}

	var response []fs.FileEntry
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}
}
```

- [ ] **Step 2: Implement ListHandler**

Create `pkg/api/fs_handlers.go`:
```go
package api

import (
	"net/http"
	"mergefoldersdocker/pkg/fs"
	"github.com/gin-gonic/gin"
)

func ListHandler(chroot string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Query("path")
		if path == "" {
			path = chroot
		}

		entries, err := fs.ListDirectory(path, chroot)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied or invalid path"})
			return
		}
		c.JSON(http.StatusOK, entries)
	}
}
```

- [ ] **Step 3: Register route in main.go**

Modify `main.go`:
```go
package main

import (
	"log"
	"github.com/gin-gonic/gin"
	"mergefoldersdocker/pkg/api"
	"github.com/gin-contrib/cors"
)

func main() {
	r := gin.Default()
	r.Use(cors.Default()) // Enable CORS for development
	
	chroot := "/app/data" // Will be configurable later

	r.GET("/api/fs/list", api.ListHandler(chroot))

	log.Println("Server starting on :8080")
	r.Run(":8080")
}
```

- [ ] **Step 4: Commit Endpoints**

```bash
git add pkg/api main.go
git commit -m "feat: add filesystem list api endpoint"
```

### Task 4: Thumbnail Generation

**Files:**
- Create: `pkg/fs/thumbnail.go`
- Modify: `pkg/api/fs_handlers.go`
- Modify: `main.go`

- [ ] **Step 1: Write test for Thumbnail Generation**

Create `pkg/fs/thumbnail_test.go`:
```go
package fs

import (
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateThumbnail(t *testing.T) {
	tmpDir := t.TempDir()
	
	// Create a dummy image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for x := 0; x < 100; x++ {
		for y := 0; y < 100; y++ {
			img.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}
	srcPath := filepath.Join(tmpDir, "test.jpg")
	f, _ := os.Create(srcPath)
	jpeg.Encode(f, img, nil)
	f.Close()

	thumbPath := filepath.Join(tmpDir, "thumb.jpg")
	
	err := GenerateThumbnail(srcPath, thumbPath, 50)
	if err != nil {
		t.Fatalf("GenerateThumbnail failed: %v", err)
	}

	if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
		t.Errorf("Thumbnail was not created")
	}
}
```

- [ ] **Step 2: Run tests to fail**

Run: `go test ./pkg/fs`
Expected: FAIL (GenerateThumbnail not defined)

- [ ] **Step 3: Implement GenerateThumbnail**

Create `pkg/fs/thumbnail.go`:
```go
package fs

import (
	"github.com/disintegration/imaging"
)

func GenerateThumbnail(srcPath, destPath string, size int) error {
	img, err := imaging.Open(srcPath, imaging.AutoOrientation(true))
	if err != nil {
		return err
	}
	
	thumb := imaging.Thumbnail(img, size, size, imaging.Lanczos)
	return imaging.Save(thumb, destPath)
}
```

- [ ] **Step 4: Run tests to pass**

Run: `go test ./pkg/fs`
Expected: PASS

- [ ] **Step 5: Implement ThumbHandler**

Modify `pkg/api/fs_handlers.go`:
```go
import (
	"path/filepath"
	"os"
	"fmt"
	"crypto/sha256"
)

// ... existing code ...

func ThumbHandler(chroot, cacheDir string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Query("path")
		valid, cleanPath := fs.ValidatePath(path, chroot)
		if !valid {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		hash := fmt.Sprintf("%x.jpg", sha256.Sum256([]byte(cleanPath)))
		thumbPath := filepath.Join(cacheDir, hash)

		if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
			if err := fs.GenerateThumbnail(cleanPath, thumbPath, 150); err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
		}

		c.File(thumbPath)
	}
}
```

- [ ] **Step 6: Register ThumbHandler**

Modify `main.go`:
```go
func main() {
    // ...
	chroot := "/app/data"
	cacheDir := "/app/cache"
	// Ensure cache dir exists
	os.MkdirAll(cacheDir, 0755)

	r.GET("/api/fs/list", api.ListHandler(chroot))
	r.GET("/api/fs/thumb", api.ThumbHandler(chroot, cacheDir))
    // ...
}
```

- [ ] **Step 7: Commit Thumbnail API**

```bash
git add pkg/fs pkg/api main.go
git commit -m "feat: add thumbnail generation and caching api"
```

## Chunk 3: Merge Engine & WebSockets

### Task 5: WebSocket Hub

**Files:**
- Create: `pkg/ws/hub.go`
- Modify: `main.go`

- [ ] **Step 1: Write WebSocket Hub logic**

Create `pkg/ws/hub.go`:
```go
package ws

import (
	"log"
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for now
	},
}

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Hub struct {
	Clients    map[*websocket.Conn]bool
	Broadcast  chan Message
	Register   chan *websocket.Conn
	Unregister chan *websocket.Conn
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[*websocket.Conn]bool),
		Broadcast:  make(chan Message),
		Register:   make(chan *websocket.Conn),
		Unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Clients[client] = true
		case client := <-h.Unregister:
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				client.Close()
			}
		case message := <-h.Broadcast:
			for client := range h.Clients {
				err := client.WriteJSON(message)
				if err != nil {
					log.Printf("error: %v", err)
					client.Close()
					delete(h.Clients, client)
				}
			}
		}
	}
}

func ServeWs(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Println(err)
			return
		}
		hub.Register <- conn
	}
}
```

- [ ] **Step 2: Register WebSocket in main.go**

Modify `main.go`:
```go
import "mergefoldersdocker/pkg/ws"

func main() {
    // ...
    hub := ws.NewHub()
	go hub.Run()

	r.GET("/ws", ws.ServeWs(hub))
    // ...
}
```

- [ ] **Step 3: Commit WebSocket Hub**

```bash
git add pkg/ws main.go
git commit -m "feat: implement websocket hub for real-time progress"
```

### Task 6: Merge Engine API

**Files:**
- Create: `pkg/fs/merge.go`
- Modify: `pkg/api/fs_handlers.go`
- Modify: `main.go`

- [ ] **Step 1: Write Merge API endpoint structure**

Modify `pkg/api/fs_handlers.go`:
```go
import "mergefoldersdocker/pkg/ws"

type MergeRequest struct {
	Source      string `json:"source" binding:"required"`
	Destination string `json:"destination" binding:"required"`
	Policy      string `json:"policy" binding:"required"`
	DryRun      bool   `json:"dryRun"`
}

func MergeHandler(chroot string, hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req MergeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		validSrc, cleanSrc := fs.ValidatePath(req.Source, chroot)
		validDst, cleanDst := fs.ValidatePath(req.Destination, chroot)

		if !validSrc || !validDst {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		// Start background merge process
		go fs.RunMerge(cleanSrc, cleanDst, req.Policy, req.DryRun, hub)

		c.JSON(http.StatusAccepted, gin.H{"status": "Merge started"})
	}
}
```

- [ ] **Step 2: Implement minimal RunMerge logic**

Create `pkg/fs/merge.go`:
```go
package fs

import (
	"fmt"
	"mergefoldersdocker/pkg/ws"
	"time"
)

func RunMerge(src, dst, policy string, dryRun bool, hub *ws.Hub) {
	hub.Broadcast <- ws.Message{
		Type: "log",
		Data: map[string]string{"message": fmt.Sprintf("Starting merge from %s to %s", src, dst)},
	}

	// Simulation for now
	time.Sleep(2 * time.Second)
	
	hub.Broadcast <- ws.Message{
		Type: "progress",
		Data: map[string]interface{}{"percent": 100, "message": "Done", "file": ""},
	}
}
```

- [ ] **Step 3: Register route**

Modify `main.go`:
```go
	r.POST("/api/merge", api.MergeHandler(chroot, hub))
```

- [ ] **Step 4: Commit Merge Engine Simulation**

```bash
git add pkg/fs pkg/api main.go
git commit -m "feat: add merge api endpoint and background engine structure"
```

## Chunk 4: Frontend UI and Dockerization

### Task 7: Frontend Explorer and State

**Files:**
- Create: `frontend/src/store.ts`
- Create: `frontend/src/components/FileExplorer.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Setup Zustand Store**

Create `frontend/src/store.ts`:
```typescript
import { create } from 'zustand'

interface AppState {
  currentPath: string;
  sourcePath: string | null;
  destPath: string | null;
  setCurrentPath: (p: string) => void;
  setSourcePath: (p: string) => void;
  setDestPath: (p: string) => void;
}

export const useStore = create<AppState>((set) => ({
  currentPath: '/app/data',
  sourcePath: null,
  destPath: null,
  setCurrentPath: (p) => set({ currentPath: p }),
  setSourcePath: (p) => set({ sourcePath: p }),
  setDestPath: (p) => set({ destPath: p }),
}))
```

- [ ] **Step 2: Build FileExplorer Component**

Create `frontend/src/components/FileExplorer.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Folder, Image as ImageIcon } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export default function FileExplorer() {
  const { currentPath, setCurrentPath, setSourcePath, setDestPath } = useStore();
  const [files, setFiles] = useState<FileEntry[]>([]);

  useEffect(() => {
    fetch(`http://localhost:8080/api/fs/list?path=${encodeURIComponent(currentPath)}`)
      .then(res => res.json())
      .then(data => setFiles(data || []))
      .catch(err => console.error(err));
  }, [currentPath]);

  return (
    <div className="p-4 border rounded shadow">
      <h2 className="text-lg font-bold mb-2">Explorer: {currentPath}</h2>
      <div className="flex gap-2 mb-4">
        <button className="bg-blue-500 text-white px-2 py-1 rounded" onClick={() => setSourcePath(currentPath)}>Set as Source</button>
        <button className="bg-green-500 text-white px-2 py-1 rounded" onClick={() => setDestPath(currentPath)}>Set as Dest</button>
      </div>
      <ul>
        {currentPath !== '/app/data' && (
          <li className="cursor-pointer text-blue-600 hover:underline" onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}>.. (Up)</li>
        )}
        {files.map(f => (
          <li key={f.path} className="flex items-center gap-2 p-1 hover:bg-gray-100">
            {f.isDir ? <Folder className="text-yellow-500" /> : <ImageIcon className="text-gray-500" />}
            <span className={f.isDir ? 'cursor-pointer text-blue-600' : ''} onClick={() => f.isDir && setCurrentPath(f.path)}>
              {f.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx**

Modify `frontend/src/App.tsx`:
```tsx
import FileExplorer from './components/FileExplorer';
import { useStore } from './store';

function App() {
  const { sourcePath, destPath } = useStore();

  const handleMerge = () => {
    fetch('http://localhost:8080/api/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourcePath, destination: destPath, policy: 'rename', dryRun: true })
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">MergeFoldersDocker</h1>
      <div className="grid grid-cols-2 gap-4">
        <FileExplorer />
        <div className="p-4 border rounded shadow">
          <h2 className="text-lg font-bold mb-2">Merge Dashboard</h2>
          <p>Source: {sourcePath || 'Not selected'}</p>
          <p>Dest: {destPath || 'Not selected'}</p>
          <button 
            className="mt-4 bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!sourcePath || !destPath}
            onClick={handleMerge}
          >
            Start Merge
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Commit UI components**

```bash
git add frontend/src
git commit -m "feat: build file explorer and dashboard UI"
```

### Task 8: Embedded Monolith & Dockerization

**Files:**
- Modify: `main.go`
- Create: `Dockerfile`

- [ ] **Step 1: Embed frontend in main.go**

Modify `main.go`:
```go
package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"mergefoldersdocker/pkg/api"
	"mergefoldersdocker/pkg/ws"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

//go:embed frontend/dist/*
var frontendFS embed.FS

func main() {
	r := gin.Default()
	r.Use(cors.Default())

	chroot := "/app/data"
	cacheDir := "/app/cache"
	os.MkdirAll(cacheDir, 0755)

	hub := ws.NewHub()
	go hub.Run()

	r.GET("/api/fs/list", api.ListHandler(chroot))
	r.GET("/api/fs/thumb", api.ThumbHandler(chroot, cacheDir))
	r.POST("/api/merge", api.MergeHandler(chroot, hub))
	r.GET("/ws", ws.ServeWs(hub))

	// Serve embedded frontend
	subFS, _ := fs.Sub(frontendFS, "frontend/dist")
	r.StaticFS("/ui", http.FS(subFS))
	r.NoRoute(func(c *gin.Context) {
		c.FileFromFS("/", http.FS(subFS))
	})

	log.Println("Server starting on :8080")
	r.Run(":8080")
}
```

- [ ] **Step 2: Create Dockerfile**

Create `Dockerfile`:
```dockerfile
# Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build Backend
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy compiled frontend to expected embed location
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -o mergefolders .

# Final Stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=backend-builder /app/mergefolders .
ENV GIN_MODE=release
EXPOSE 8080
CMD ["./mergefolders"]
```

- [ ] **Step 3: Commit Dockerfile and embedding**

```bash
git add main.go Dockerfile
git commit -m "feat: embed frontend and add Dockerfile"
```
