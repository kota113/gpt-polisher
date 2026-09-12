package main

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

const maxRequestBytes = 1 << 20

type generator func(context.Context, string) (string, error)

func newHandler(token string, timeout time.Duration, generate generator) http.Handler {
	mux := http.NewServeMux()
	// Serialize CLI sessions for a single VPS account; reject excess work instead of queuing indefinitely.
	slots := make(chan struct{}, 1)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.HandleFunc("POST /rewrite", func(w http.ResponseWriter, r *http.Request) {
		expected := sha256.Sum256([]byte("Bearer " + token))
		actual := sha256.Sum256([]byte(r.Header.Get("Authorization")))
		if token == "" || subtle.ConstantTimeCompare(expected[:], actual[:]) != 1 {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
		var input struct {
			Prompt string `json:"prompt"`
		}
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		err := decoder.Decode(&input)
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			http.Error(w, "Request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if err != nil || strings.TrimSpace(input.Prompt) == "" {
			http.Error(w, "Invalid prompt", http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			if errors.As(err, &tooLarge) {
				http.Error(w, "Request too large", http.StatusRequestEntityTooLarge)
			} else {
				http.Error(w, "Expected one JSON object", http.StatusBadRequest)
			}
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			http.Error(w, "Busy", http.StatusServiceUnavailable)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		text, err := generate(ctx, input.Prompt)
		if err != nil || strings.TrimSpace(text) == "" {
			status := http.StatusBadGateway
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				status = http.StatusGatewayTimeout
			}
			// Never log submitted prompts, generated content, credentials, or raw CLI output.
			slog.Warn("antigravity_generation_failed", "status", status)
			http.Error(w, "Antigravity generation failed", status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(struct {
			Text string `json:"text"`
		}{text})
	})
	return mux
}

func main() {
	token := os.Getenv("ANTIGRAVITY_GATEWAY_TOKEN")
	if token == "" {
		slog.Error("ANTIGRAVITY_GATEWAY_TOKEN is required")
		os.Exit(1)
	}
	if err := checkPermissions(); err != nil {
		slog.Error("CLI permissions must deny editing tools; see AGENT.md", "error", err)
		os.Exit(1)
	}
	binary := os.Getenv("ANTIGRAVITY_BIN")
	if binary == "" {
		binary = "agy"
	}
	model := os.Getenv("ANTIGRAVITY_MODEL")
	if model == "" {
		model = "gemini-3.8-flash-medium"
	}
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	runner := cliRunner{binary: binary, model: model}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	server := &http.Server{
		Addr: addr, Handler: newHandler(token, 120*time.Second, runner.generate),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second,
		WriteTimeout: 130 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10,
		BaseContext: nil,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			_ = server.Close()
		}
	}()
	slog.Info("antigravity_gateway_listening", "address", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("HTTP server failed", "error", err)
		os.Exit(1)
	}
}
