package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestGateway(t *testing.T) {
	calls := 0
	handler := newHandler("secret", time.Second, func(ctx context.Context, prompt string) (string, error) {
		calls++
		if prompt != "original prompt" {
			t.Fatalf("prompt changed: %q", prompt)
		}
		return "rewritten\n", nil
	})
	for _, tc := range []struct {
		name, body, auth string
		status           int
	}{
		{"success", `{"prompt":"original prompt"}`, "Bearer secret", 200},
		{"no auth", `{"prompt":"original prompt"}`, "", 401},
		{"bad auth", `{"prompt":"original prompt"}`, "Bearer wrong", 401},
		{"empty", `{"prompt":""}`, "Bearer secret", 400},
		{"bad json", `{`, "Bearer secret", 400},
		{"extra fields", `{"prompt":"x","command":"touch /tmp/x"}`, "Bearer secret", 400},
		{"extra object", `{"prompt":"x"}{}`, "Bearer secret", 400},
		{"oversize", `{"prompt":"` + strings.Repeat("a", maxRequestBytes) + `"}`, "Bearer secret", 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/rewrite", strings.NewReader(tc.body))
			req.Header.Set("Authorization", tc.auth)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tc.status {
				t.Fatalf("status %d, want %d", rec.Code, tc.status)
			}
			if rec.Code == 200 {
				var body struct {
					Text string `json:"text"`
				}
				_ = json.Unmarshal(rec.Body.Bytes(), &body)
				if body.Text != "rewritten\n" {
					t.Fatalf("unexpected body: %s", rec.Body.String())
				}
			}
		})
	}
	if calls != 1 {
		t.Fatalf("unexpected generation calls: %d", calls)
	}
}

func TestGatewayFailure(t *testing.T) {
	for _, tc := range []struct {
		name     string
		generate generator
		status   int
	}{
		{"CLI failure", func(context.Context, string) (string, error) { return "", errors.New("private diagnostic") }, 502},
		{"empty output", func(context.Context, string) (string, error) { return "", nil }, 502},
		{"timeout", func(ctx context.Context, _ string) (string, error) { <-ctx.Done(); return "", ctx.Err() }, 504},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler := newHandler("secret", time.Millisecond, tc.generate)
			req := httptest.NewRequest("POST", "/rewrite", strings.NewReader(`{"prompt":"hi"}`))
			req.Header.Set("Authorization", "Bearer secret")
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tc.status || strings.Contains(rec.Body.String(), "private diagnostic") {
				t.Fatalf("unexpected response: %d %s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestGatewayBusy(t *testing.T) {
	started, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	handler := newHandler("secret", time.Second, func(context.Context, string) (string, error) { close(started); <-release; return "ok", nil })
	request := func() *http.Request {
		r := httptest.NewRequest("POST", "/rewrite", strings.NewReader(`{"prompt":"hi"}`))
		r.Header.Set("Authorization", "Bearer secret")
		return r
	}
	go func() { defer close(done); handler.ServeHTTP(httptest.NewRecorder(), request()) }()
	<-started
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, request())
	close(release)
	<-done
	if rec.Code != 503 {
		t.Fatalf("status %d", rec.Code)
	}
}
