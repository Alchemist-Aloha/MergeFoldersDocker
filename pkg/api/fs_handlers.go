package api

import (
	"crypto/sha256"
	"fmt"
	"mergefoldersdocker/pkg/fs"
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
