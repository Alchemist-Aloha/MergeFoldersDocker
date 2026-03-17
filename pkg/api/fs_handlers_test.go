package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"github.com/gin-gonic/gin"
	"mergefoldersdocker/pkg/fs"
)

func TestListHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	
	tmpDir := t.TempDir()
	r.GET("/api/fs/list", ListHandler(tmpDir))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/fs/list?path="+tmpDir, nil)
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("Expected 200, got %d", w.Code)
	}

	var response []fs.FileEntry
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}
}
