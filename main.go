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
	subFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}
	
	r.StaticFS("/ui", http.FS(subFS))
	
	// Redirect root to /ui
	r.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/ui/")
	})

	// Handle React SPA routes
	r.NoRoute(func(c *gin.Context) {
		c.FileFromFS("/", http.FS(subFS))
	})

	log.Println("Server starting on :8080")
	r.Run(":8080")
}
