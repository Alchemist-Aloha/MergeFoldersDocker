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
