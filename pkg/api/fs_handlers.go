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
