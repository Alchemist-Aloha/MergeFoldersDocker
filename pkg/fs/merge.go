package fs

import (
	"fmt"
	"mergefoldersdocker/pkg/ws"
	"time"
)

func RunMerge(src, dst, policy string, dryRun bool, hub *ws.Hub) {
	hub.Broadcast <- ws.Message{
		Type: "log",
		Data: map[string]string{"message": fmt.Sprintf("Starting merge from %s to %s", src, dst)},
	}

	// Simulation for now
	time.Sleep(2 * time.Second)
	
	hub.Broadcast <- ws.Message{
		Type: "progress",
		Data: map[string]interface{}{"percent": 100, "message": "Done", "file": ""},
	}
}
