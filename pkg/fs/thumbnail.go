package fs

import (
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	_ "golang.org/x/image/webp"

	"github.com/disintegration/imaging"
)

func GenerateThumbnail(srcPath, destPath string, size int) error {
	img, err := imaging.Open(srcPath, imaging.AutoOrientation(true))
	if err != nil {
		return err
	}
	
	thumb := imaging.Thumbnail(img, size, size, imaging.Lanczos)
	return imaging.Save(thumb, destPath)
}
