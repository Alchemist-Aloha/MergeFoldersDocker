package fs

import (
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateThumbnail(t *testing.T) {
	tmpDir := t.TempDir()
	
	// Create a dummy image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for x := 0; x < 100; x++ {
		for y := 0; y < 100; y++ {
			img.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}
	srcPath := filepath.Join(tmpDir, "test.jpg")
	f, _ := os.Create(srcPath)
	jpeg.Encode(f, img, nil)
	f.Close()

	thumbPath := filepath.Join(tmpDir, "thumb.jpg")
	
	err := GenerateThumbnail(srcPath, thumbPath, 50)
	if err != nil {
		t.Fatalf("GenerateThumbnail failed: %v", err)
	}

	if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
		t.Errorf("Thumbnail was not created")
	}
}
