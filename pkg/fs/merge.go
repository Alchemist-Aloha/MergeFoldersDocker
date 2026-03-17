package fs

import (
	"fmt"
	"io"
	"mergefoldersdocker/pkg/ws"
	"os"
	"path/filepath"
	"strings"
)

func RunBatchMerge(sources []string, dst, policy string, dryRun bool, hub *ws.Hub) {
	hub.Broadcast <- ws.Message{
		Type: "log",
		Data: map[string]string{"message": "Initiating batch merge operation..."},
	}

	if !dryRun {
		if err := os.MkdirAll(dst, 0755); err != nil {
			hub.Broadcast <- ws.Message{
				Type: "error",
				Data: map[string]string{"message": fmt.Sprintf("Failed to create destination directory %s: %v", dst, err)},
			}
			return
		}
	}

	type fileToProcess struct {
		srcPath  string
		filename string
	}

	var allFiles []fileToProcess

	// Scan all sources
	for _, src := range sources {
		files, err := os.ReadDir(src)
		if err != nil {
			hub.Broadcast <- ws.Message{
				Type: "error",
				Data: map[string]string{"message": fmt.Sprintf("Failed to read source directory %s: %v", src, err)},
			}
			continue
		}

		for _, f := range files {
			if !f.IsDir() {
				allFiles = append(allFiles, fileToProcess{
					srcPath:  src,
					filename: f.Name(),
				})
			}
		}
	}

	total := len(allFiles)
	if total == 0 {
		hub.Broadcast <- ws.Message{
			Type: "log",
			Data: map[string]string{"message": "No files found in selected folders to merge."},
		}
		hub.Broadcast <- ws.Message{Type: "progress", Data: map[string]interface{}{"percent": 100}}
		return
	}

	hub.Broadcast <- ws.Message{
		Type: "log",
		Data: map[string]string{"message": fmt.Sprintf("Found %d total files across %d folders", total, len(sources))},
	}

	for i, f := range allFiles {
		srcFilePath := filepath.Join(f.srcPath, f.filename)
		destPath := filepath.Join(dst, f.filename)

		// Collision handling
		if _, err := os.Stat(destPath); err == nil {
			switch policy {
			case "skip":
				hub.Broadcast <- ws.Message{
					Type: "log",
					Data: map[string]string{"message": fmt.Sprintf("Skipping existing file: %s", f.filename)},
				}
				updateProgress(hub, i+1, total)
				continue
			case "rename":
				destPath = getSafeName(dst, f.filename)
				hub.Broadcast <- ws.Message{
					Type: "log",
					Data: map[string]string{"message": fmt.Sprintf("Renaming %s to %s", f.filename, filepath.Base(destPath))},
				}
			case "overwrite":
				hub.Broadcast <- ws.Message{
					Type: "log",
					Data: map[string]string{"message": fmt.Sprintf("Overwriting: %s", f.filename)},
				}
			}
		}

		if dryRun {
			hub.Broadcast <- ws.Message{
				Type: "log",
				Data: map[string]string{"message": fmt.Sprintf("[Dry Run] Would move %s to %s", srcFilePath, destPath)},
			}
		} else {
			if err := moveFile(srcFilePath, destPath); err != nil {
				hub.Broadcast <- ws.Message{
					Type: "error",
					Data: map[string]string{"message": fmt.Sprintf("Error moving %s: %v", f.filename, err)},
				}
			}
		}

		updateProgress(hub, i+1, total)
	}

	hub.Broadcast <- ws.Message{
		Type: "log",
		Data: map[string]string{"message": "Batch merge operation completed successfully"},
	}
}

func updateProgress(hub *ws.Hub, current, total int) {
	percent := int(float64(current) / float64(total) * 100)
	hub.Broadcast <- ws.Message{
		Type: "progress",
		Data: map[string]interface{}{"percent": percent},
	}
}

func getSafeName(dst, filename string) string {
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	counter := 1
	for {
		newName := fmt.Sprintf("%s_%d%s", base, counter, ext)
		newPath := filepath.Join(dst, newName)
		if _, err := os.Stat(newPath); os.IsNotExist(err) {
			return newPath
		}
		counter++
	}
}

func moveFile(src, dst string) error {
	// Try renaming first (fast)
	err := os.Rename(src, dst)
	if err == nil {
		return nil
	}

	// If rename fails (e.g., across devices), copy and delete
	input, err := os.Open(src)
	if err != nil {
		return err
	}
	defer input.Close()

	output, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = io.Copy(output, input)
	if err != nil {
		return err
	}

	// Close files before deleting src
	input.Close()
	output.Close()

	return os.Remove(src)
}
