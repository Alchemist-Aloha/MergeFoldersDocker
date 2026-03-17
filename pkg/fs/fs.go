package fs

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

func ValidatePath(requestedPath, chroot string) (bool, string) {
	cleanPath := filepath.Clean(requestedPath)
	cleanChroot := filepath.Clean(chroot)
	
	rel, err := filepath.Rel(cleanChroot, cleanPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return false, ""
	}
	return true, cleanPath
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

func RemovePaths(paths []string, chroot string) error {
	for _, p := range paths {
		valid, cleanPath := ValidatePath(p, chroot)
		if !valid {
			return fmt.Errorf("access denied: %s", p)
		}
		if err := os.RemoveAll(cleanPath); err != nil {
			return err
		}
	}
	return nil
}
