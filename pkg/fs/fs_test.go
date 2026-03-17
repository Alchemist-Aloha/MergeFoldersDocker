package fs

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidatePath(t *testing.T) {
	chroot := "/app/data"
	
	tests := []struct {
		input string
		valid bool
	}{
		{"/app/data/valid/path", true},
		{"/app/data/../secret", false},
		{"/etc/passwd", false},
		{"/app/data", true},
		{"/app/data_leak", false},
	}

	for _, tt := range tests {
		valid, _ := ValidatePath(tt.input, chroot)
		if valid != tt.valid {
			t.Errorf("ValidatePath(%s) expected %v, got %v", tt.input, tt.valid, valid)
		}
	}
}

func TestListDirectory(t *testing.T) {
	// Setup temp dir
	tmpDir := t.TempDir()
	os.Mkdir(filepath.Join(tmpDir, "sub"), 0755)
	os.WriteFile(filepath.Join(tmpDir, "file.txt"), []byte("test"), 0644)

	entries, err := ListDirectory(tmpDir, tmpDir)
	if err != nil {
		t.Fatalf("ListDirectory failed: %v", err)
	}
	if len(entries) != 2 {
		t.Errorf("Expected 2 entries, got %d", len(entries))
	}
}
