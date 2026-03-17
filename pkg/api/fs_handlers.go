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
