package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveAddr(t *testing.T) {
	for _, tc := range [...]struct {
		name         string
		addr         string
		addrFromFlag bool
		port         int
		portFromFlag bool
		yarrAddr     string
		outpostPort  string
		expected     string
		expectedErr  bool
	}{
		{
			name:     "defaults to loopback",
			addr:     defaultAddr,
			expected: "127.0.0.1:7070",
		},
		{
			name:         "port flag binds loopback",
			addr:         defaultAddr,
			port:         8090,
			portFromFlag: true,
			expected:     "127.0.0.1:8090",
		},
		{
			name:        "outpost port binds loopback",
			addr:        defaultAddr,
			outpostPort: "8090",
			expected:    "127.0.0.1:8090",
		},
		{
			name:         "port flag beats outpost port",
			addr:         defaultAddr,
			port:         8091,
			portFromFlag: true,
			outpostPort:  "8090",
			expected:     "127.0.0.1:8091",
		},
		{
			name:         "addr flag beats outpost port",
			addr:         "0.0.0.0:80",
			addrFromFlag: true,
			outpostPort:  "8090",
			expected:     "0.0.0.0:80",
		},
		{
			name:        "outpost port beats yarr addr env",
			addr:        "0.0.0.0:80",
			yarrAddr:    "0.0.0.0:80",
			outpostPort: "8090",
			expected:    "127.0.0.1:8090",
		},
		{
			name:     "yarr addr env is used when no port is given",
			addr:     "0.0.0.0:80",
			yarrAddr: "0.0.0.0:80",
			expected: "0.0.0.0:80",
		},
		{
			name:         "agreeing flags are accepted",
			addr:         "0.0.0.0:8090",
			addrFromFlag: true,
			port:         8090,
			portFromFlag: true,
			expected:     "0.0.0.0:8090",
		},
		{
			name:         "disagreeing flags are rejected",
			addr:         "127.0.0.1:7070",
			addrFromFlag: true,
			port:         8090,
			portFromFlag: true,
			expectedErr:  true,
		},
		{
			name:         "dynamic port is rejected",
			addr:         defaultAddr,
			port:         0,
			portFromFlag: true,
			expectedErr:  true,
		},
		{
			name:        "unparseable outpost port is rejected",
			addr:        defaultAddr,
			outpostPort: "http",
			expectedErr: true,
		},
		{
			name:        "out of range outpost port is rejected",
			addr:        defaultAddr,
			outpostPort: "70000",
			expectedErr: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			log.SetOutput(io.Discard)
			defer log.SetOutput(os.Stderr)

			addr, err := resolveAddr(tc.addr, tc.addrFromFlag, tc.port, tc.portFromFlag, tc.yarrAddr, tc.outpostPort)
			if tc.expectedErr {
				if err == nil {
					t.Fatalf("expected error, got addr %q", addr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if addr != tc.expected {
				t.Errorf("expected addr %q, got %q", tc.expected, addr)
			}
		})
	}
}

func TestResolveDBPathUsesStorageDir(t *testing.T) {
	storageDir := filepath.Join(t.TempDir(), "yarr-storage")

	db, err := resolveDBPath("", false, storageDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if expected := filepath.Join(storageDir, "yarr.db"); db != expected {
		t.Errorf("expected db %q, got %q", expected, db)
	}

	// The supervisor creates the directory before starting us, but a restore
	// can replace it, so we must cope with it being absent too.
	info, err := os.Stat(storageDir)
	if err != nil {
		t.Fatalf("storage dir not created: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0700 {
		t.Errorf("expected storage dir mode 0700, got %o", perm)
	}
}

func TestResolveDBPathPrecedence(t *testing.T) {
	log.SetOutput(io.Discard)
	defer log.SetOutput(os.Stderr)

	storageDir := t.TempDir()

	// An explicit --db wins over the storage dir.
	db, err := resolveDBPath("/tmp/explicit.db", true, storageDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if db != "/tmp/explicit.db" {
		t.Errorf("expected explicit db path, got %q", db)
	}

	// $YARR_DB (already folded into the db argument by opt) loses to it.
	db, err = resolveDBPath("/tmp/from-env.db", false, storageDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if expected := filepath.Join(storageDir, "yarr.db"); db != expected {
		t.Errorf("expected %q, got %q", expected, db)
	}

	// With no storage dir, $YARR_DB is honoured.
	db, err = resolveDBPath("/tmp/from-env.db", false, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if db != "/tmp/from-env.db" {
		t.Errorf("expected /tmp/from-env.db, got %q", db)
	}
}

func TestUnderDir(t *testing.T) {
	for _, tc := range [...]struct {
		path     string
		dir      string
		expected bool
	}{
		{path: "/var/data/yarr.db", dir: "/var/data", expected: true},
		{path: "/var/data/db/yarr.db", dir: "/var/data", expected: true},
		{path: "/var/data/yarr.db?_journal=WAL", dir: "/var/data", expected: true},
		{path: "/var/other/yarr.db", dir: "/var/data", expected: false},
		{path: "/var/data/../other/yarr.db", dir: "/var/data", expected: false},
	} {
		t.Run(tc.path, func(t *testing.T) {
			if got := underDir(tc.path, tc.dir); got != tc.expected {
				t.Errorf("underDir(%q, %q) = %v, expected %v", tc.path, tc.dir, got, tc.expected)
			}
		})
	}
}

func TestIsLoopback(t *testing.T) {
	for _, tc := range [...]struct {
		addr     string
		expected bool
	}{
		{addr: "127.0.0.1:7070", expected: true},
		{addr: "localhost:7070", expected: true},
		{addr: "[::1]:7070", expected: true},
		{addr: "unix:/run/yarr.sock", expected: true},
		{addr: "0.0.0.0:80", expected: false},
		{addr: "192.168.1.10:7070", expected: false},
	} {
		t.Run(tc.addr, func(t *testing.T) {
			if got := isLoopback(tc.addr); got != tc.expected {
				t.Errorf("isLoopback(%q) = %v, expected %v", tc.addr, got, tc.expected)
			}
		})
	}
}

// A supervisor manifest is plaintext on disk and everything in it lands in the
// process environment, so a secret belongs in a file the manifest points at.
func TestReadSecretFile(t *testing.T) {
	dir := t.TempDir()

	write := func(name, content string) string {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		return path
	}

	t.Run("reads and trims", func(t *testing.T) {
		secret, err := readSecretFile(write("key", "  s3cret-key\n"))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if secret != "s3cret-key" {
			t.Errorf("got %q", secret)
		}
	})

	t.Run("keeps inner whitespace", func(t *testing.T) {
		secret, err := readSecretFile(write("spaces", "two words\n"))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if secret != "two words" {
			t.Errorf("got %q", secret)
		}
	})

	// An empty key would silently sign sessions with nothing.
	t.Run("empty file is an error", func(t *testing.T) {
		if _, err := readSecretFile(write("empty", "   \n\t\n")); err == nil {
			t.Error("expected an error for an empty secret file")
		}
	})

	t.Run("missing file is an error", func(t *testing.T) {
		if _, err := readSecretFile(filepath.Join(dir, "nope")); err == nil {
			t.Error("expected an error for a missing secret file")
		}
	})
}
