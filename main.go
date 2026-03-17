package main

import (
	"log"
	"os"
	"github.com/gin-gonic/gin"
	"mergefoldersdocker/pkg/api"
	"mergefoldersdocker/pkg/ws"
	"github.com/gin-contrib/cors"
)

func main() {
	r := gin.Default()
	r.Use(cors.Default()) // Enable CORS for development
	
	chroot := "/app/data" // Will be configurable later
	cacheDir := "/app/cache"
	// Ensure cache dir exists
	os.MkdirAll(cacheDir, 0755)

	hub := ws.NewHub()
	go hub.Run()

	r.GET("/api/fs/list", api.ListHandler(chroot))
	r.GET("/api/fs/thumb", api.ThumbHandler(chroot, cacheDir))
	r.POST("/api/merge", api.MergeHandler(chroot, hub))
	r.GET("/ws", ws.ServeWs(hub))

	log.Println("Server starting on :8080")
	r.Run(":8080")
}
