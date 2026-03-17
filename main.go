package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

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

	chroot := os.Getenv("DATA_PATH")
	if chroot == "" {
		chroot = "/app/data"
	}
	cacheDir := os.Getenv("CACHE_PATH")
	if cacheDir == "" {
		cacheDir = "/app/cache"
	}
	os.MkdirAll(cacheDir, 0755)

	hub := ws.NewHub()
	go hub.Run()

	r.GET("/api/fs/list", api.ListHandler(chroot))
	r.GET("/api/fs/thumb", api.ThumbHandler(chroot, cacheDir))
	r.POST("/api/merge", api.MergeHandler(chroot, hub))
	r.DELETE("/api/fs/remove", api.RemoveHandler(chroot))
	r.GET("/ws", ws.ServeWs(hub))

	// Serve embedded frontend
	subFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	// SPA Middleware / Static serving
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		
		// If it's an API or WS request that reached here, it's a 404
		if strings.HasPrefix(path, "/api") || path == "/ws" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not Found"})
			return
		}

		// Try to serve static file from embedded FS
		// Open the file to see if it exists (strip leading /)
		f, err := subFS.Open(strings.TrimPrefix(path, "/"))
		if err == nil {
			f.Close()
			c.FileFromFS(path, http.FS(subFS))
			return
		}

		// Fallback to index.html for React SPA
		c.FileFromFS("/", http.FS(subFS))
	})

	log.Println("Server starting on :8080")
	r.Run(":8080")
}
