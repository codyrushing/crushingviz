package handlers

import (
	"encoding/json"
	"log"
	"net/http"
)

// apiError is the JSON body returned for non-2xx responses.
type apiError struct {
	Error string `json:"error"`
}

// writeJSON writes body as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		// The status line is already written, so this can only be logged.
		log.Printf("write json response: %v", err)
	}
}

// writeError writes a JSON error body. Internal error details are logged by the
// caller and never included here.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, apiError{Error: message})
}
