package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestParseResult(t *testing.T) {
	success := `{"event":"result","result":{"status":"SUCCESS","response":"answer\n"}}`
	for _, tc := range []struct {
		name, output string
		ok           bool
	}{
		{"success", "{\"event\":\"init\"}\n" + success, true},
		{"malformed", "oops", false},
		{"missing", `{"event":"init"}`, false},
		{"failed", `{"event":"result","result":{"status":"ERROR","response":"partial"}}`, false},
		{"empty", `{"event":"result","result":{"status":"SUCCESS","response":""}}`, false},
		{"multiple", success + "\n" + success, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			text, err := parseResult([]byte(tc.output))
			if (err == nil) != tc.ok {
				t.Fatalf("unexpected error %v", err)
			}
			if tc.ok && text != "answer\n" {
				t.Fatalf("text %q", text)
			}
		})
	}
}

func TestCLIProcess(t *testing.T) {
	dir := t.TempDir()
	binary := filepath.Join(dir, "fake-agy")
	inputPath := filepath.Join(dir, "input")
	script := "#!/bin/sh\n[ \"$1 $2 $3 $4 $5 $6\" = '--input-format stream-json --output-format stream-json --model test-model' ] || exit 2\n[ -z \"$ANTIGRAVITY_GATEWAY_TOKEN\" ] || exit 3\ncat > '" + inputPath + "'\nprintf '%s\\n' '{\"event\":\"result\",\"result\":{\"status\":\"SUCCESS\",\"response\":\"answer\"}}'\n"
	if err := os.WriteFile(binary, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ANTIGRAVITY_GATEWAY_TOKEN", "should-not-reach-child")
	text, err := (cliRunner{binary: binary, model: "test-model"}).generate(context.Background(), "line\n$(touch no)\"quoted\"")
	if err != nil || text != "answer" {
		t.Fatalf("result %q: %v", text, err)
	}
	input, err := os.ReadFile(inputPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(input), `"event":"user"`) || !strings.Contains(string(input), `line\n$(touch no)\"quoted\"`) {
		t.Fatalf("unexpected input %q", input)
	}
}

func TestCLICancellation(t *testing.T) {
	binary := filepath.Join(t.TempDir(), "fake-agy")
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nexec sleep 10\n"), 0700); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, err := (cliRunner{binary: binary, model: "test"}).generate(ctx, "prompt")
	if err == nil || time.Since(start) > 2*time.Second {
		t.Fatalf("cancellation failed: %v", err)
	}
}

func TestOutputLimit(t *testing.T) {
	var output limitedBuffer
	if _, err := output.Write([]byte(strings.Repeat("x", maxOutputBytes))); err != nil {
		t.Fatal(err)
	}
	if _, err := output.Write([]byte("x")); err == nil {
		t.Fatal("expected output limit")
	}
	if len(output.Bytes()) != maxOutputBytes {
		t.Fatal("output exceeded limit")
	}
}
