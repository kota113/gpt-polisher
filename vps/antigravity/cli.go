package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"syscall"
	"time"
)

const maxOutputBytes = 4 << 20

var deniedActions = []string{"read_file(*)", "write_file(*)", "read_url(*)", "execute_url(*)", "command(*)", "unsandboxed(*)", "mcp(*)"}

func checkPermissions() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	data, err := os.ReadFile(filepath.Join(home, ".gemini", "antigravity-cli", "settings.json"))
	if err != nil {
		return err
	}
	var settings struct {
		Permissions struct {
			Deny []string `json:"deny"`
		} `json:"permissions"`
	}
	if err := json.Unmarshal(data, &settings); err != nil {
		return err
	}
	for _, action := range deniedActions {
		if !slices.Contains(settings.Permissions.Deny, action) {
			return fmt.Errorf("missing deny rule %s", action)
		}
	}
	return nil
}

type limitedBuffer struct{ buffer bytes.Buffer }

func (b *limitedBuffer) Bytes() []byte { return b.buffer.Bytes() }

func (b *limitedBuffer) Write(p []byte) (int, error) {
	if b.buffer.Len()+len(p) > maxOutputBytes {
		return 0, errors.New("CLI output exceeds limit")
	}
	return b.buffer.Write(p)
}

type cliRunner struct{ binary, model string }

func (runner cliRunner) generate(ctx context.Context, prompt string) (string, error) {
	// A fresh directory and process prevent previous answers or repository rules entering the prompt.
	dir, err := os.MkdirTemp("", "polisher-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(dir)
	input, err := json.Marshal(map[string]any{"event": "user", "message": map[string]string{"content": prompt}})
	if err != nil {
		return "", err
	}
	args := []string{"--input-format", "stream-json", "--output-format", "stream-json", "--model", runner.model}
	cmd := exec.CommandContext(ctx, runner.binary, args...)
	cmd.Dir = dir
	// Keep credentials in the CLI's own user profile; do not pass the gateway secret to the child.
	for _, key := range []string{"HOME", "PATH", "LANG", "LC_ALL", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "TMPDIR"} {
		if value, ok := os.LookupEnv(key); ok {
			cmd.Env = append(cmd.Env, key+"="+value)
		}
	}
	cmd.Stdin = bytes.NewReader(append(input, '\n')) // EOF closes the one-turn session.
	var output limitedBuffer
	cmd.Stdout = &output
	cmd.Stderr = io.Discard
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		if errors.Is(err, syscall.ESRCH) {
			return os.ErrProcessDone
		}
		return err
	}
	cmd.WaitDelay = time.Second
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("CLI execution failed: %w", err)
	}
	return parseResult(output.Bytes())
}

func parseResult(output []byte) (string, error) {
	scanner := bufio.NewScanner(bytes.NewReader(output))
	scanner.Buffer(make([]byte, 4096), maxOutputBytes)
	var result string
	found := false
	for scanner.Scan() {
		var event struct {
			Event  string `json:"event"`
			Result struct {
				Status   string `json:"status"`
				Response string `json:"response"`
			} `json:"result"`
		}
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			return "", errors.New("invalid CLI event")
		}
		if event.Event != "result" {
			continue
		}
		if found || event.Result.Status != "SUCCESS" || event.Result.Response == "" {
			return "", errors.New("unsuccessful or ambiguous CLI result")
		}
		result, found = event.Result.Response, true
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	if !found {
		return "", errors.New("CLI returned no result")
	}
	return result, nil
}
