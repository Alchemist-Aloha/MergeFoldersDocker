package api

import (
	"crypto/sha256"
	"fmt"
	"mergefoldersdocker/pkg/fs"
	"mergefoldersdocker/pkg/ws"
	"net/http"
	"os"
	"path/filepath"

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

type MergeRequest struct {
	Sources     []string `json:"sources" binding:"required"`
	Destination string   `json:"destination" binding:"required"`
	Policy      string   `json:"policy" binding:"required"`
	DryRun      bool     `json:"dryRun"`
}

func MergeHandler(chroot string, hub *ws.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req MergeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		validDst, cleanDst := fs.ValidatePath(req.Destination, chroot)
		if !validDst {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to destination"})
			return
		}

		var cleanSources []string
		for _, src := range req.Sources {
			validSrc, cleanSrc := fs.ValidatePath(src, chroot)
			if !validSrc {
				c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Access denied to source: %s", src)})
				return
			}
			cleanSources = append(cleanSources, cleanSrc)
		}

		// Start background batch merge process
		go fs.RunBatchMerge(cleanSources, cleanDst, req.Policy, req.DryRun, hub)

		c.JSON(http.StatusAccepted, gin.H{"status": "Merge started"})
	}
}

type RemoveRequest struct {
	Paths []string `json:"paths" binding:"required"`
}

func RemoveHandler(chroot string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RemoveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := fs.RemovePaths(req.Paths, chroot); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "Removed successfully"})
	}
}
