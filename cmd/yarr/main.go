package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/nkanaev/yarr/src/platform"
	"github.com/nkanaev/yarr/src/server"
	"github.com/nkanaev/yarr/src/storage"
	"github.com/nkanaev/yarr/src/worker"
)

var Version string = "0.0"
var GitHash string = "unknown"

var OptList = make([]string, 0)

// Variables injected by the Outpost supervisor. See doc/outpost.md.
const (
	envOutpostPort    = "OUTPOST_PORT"
	envOutpostStorage = "OUTPOST_STORAGE_DIR"
)

// Loopback by default: a supervised service is reached through the supervisor
// (or its tailnet proxy), never directly from a public interface.
const defaultAddr = "127.0.0.1:7070"

func opt(envVar, defaultValue string) string {
	OptList = append(OptList, envVar)
	value := os.Getenv(envVar)
	if value != "" {
		return value
	}
	return defaultValue
}

func parseAuthfile(authfile io.Reader) (username, password string, err error) {
	scanner := bufio.NewScanner(authfile)
	if scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			return "", "", fmt.Errorf("wrong syntax (expected `username:password`)")
		}
		username = parts[0]
		password = parts[1]
	}
	return username, password, nil
}

// validatePort rejects anything a supervisor could not have predicted. Port 0
// is rejected too: it would let the kernel pick, and the port has to be known
// in advance so health checks can find us.
func validatePort(port int) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("port %d out of range (1-65535)", port)
	}
	return nil
}

func parsePort(value string) (int, error) {
	port, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0, fmt.Errorf("%q is not a number", value)
	}
	return port, validatePort(port)
}

func loopbackAddr(port int) string {
	return net.JoinHostPort("127.0.0.1", strconv.Itoa(port))
}

// addrPort returns the port an address listens on, or 0 if it has none
// (a unix socket, or an unparseable address).
func addrPort(addr string) int {
	if strings.HasPrefix(addr, "unix:") {
		return 0
	}
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return 0
	}
	value, err := strconv.Atoi(port)
	if err != nil {
		return 0
	}
	return value
}

// isLoopback reports whether an address binds the loopback interface only.
func isLoopback(addr string) bool {
	if strings.HasPrefix(addr, "unix:") {
		return true
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// resolveAddr decides where to listen, highest precedence first:
//
//  1. --addr
//  2. --port                   -> 127.0.0.1:<port>
//  3. $OUTPOST_PORT            -> 127.0.0.1:<port>
//  4. $YARR_ADDR
//  5. 127.0.0.1:7070
//
// addr carries the value of --addr, already defaulted from $YARR_ADDR by opt().
// Two explicit flags that disagree are an error rather than a silent choice:
// listening on a port the supervisor is not probing gets the process restarted
// forever.
func resolveAddr(addr string, addrFromFlag bool, port int, portFromFlag bool, yarrAddr, outpostPort string) (string, error) {
	if portFromFlag {
		if err := validatePort(port); err != nil {
			return "", fmt.Errorf("--port: %w", err)
		}
	}
	if addrFromFlag && portFromFlag {
		if addrPort(addr) != port {
			return "", fmt.Errorf("--addr %s and --port %d disagree; pass only one", addr, port)
		}
	}
	if addrFromFlag {
		return addr, nil
	}
	if portFromFlag {
		return loopbackAddr(port), nil
	}
	if outpostPort != "" {
		port, err := parsePort(outpostPort)
		if err != nil {
			return "", fmt.Errorf("$%s: %w", envOutpostPort, err)
		}
		if yarrAddr != "" && addrPort(yarrAddr) != port {
			log.Printf("warning: $YARR_ADDR (%s) disagrees with $%s (%d), using $%s",
				yarrAddr, envOutpostPort, port, envOutpostPort)
		}
		return loopbackAddr(port), nil
	}
	return addr, nil
}

// underDir reports whether path lives inside dir.
func underDir(path, dir string) bool {
	if pos := strings.IndexRune(path, '?'); pos != -1 {
		path = path[:pos]
	}
	abspath, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	absdir, err := filepath.Abs(dir)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(absdir, abspath)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// resolveDBPath decides where the database lives, highest precedence first:
//
//  1. --db
//  2. $OUTPOST_STORAGE_DIR/yarr.db
//  3. $YARR_DB
//  4. <user config dir>/yarr/storage.db
//
// $OUTPOST_STORAGE_DIR outranks $YARR_DB because it is the directory the
// supervisor backs up and restores; anything written elsewhere is lost.
func resolveDBPath(db string, dbFromFlag bool, storageDir string) (string, error) {
	if dbFromFlag {
		if storageDir != "" && !underDir(db, storageDir) {
			log.Printf("warning: --db %s is outside $%s (%s); that data will not survive a restore",
				db, envOutpostStorage, storageDir)
		}
		return db, nil
	}
	if storageDir != "" {
		// The supervisor creates this 0700 before starting us, but a restore
		// replaces it wholesale, so treat its contents as unknown and never
		// cache anything about it across runs.
		if err := os.MkdirAll(storageDir, 0700); err != nil {
			return "", fmt.Errorf("failed to create storage dir %s: %w", storageDir, err)
		}
		return filepath.Join(storageDir, "yarr.db"), nil
	}
	if db != "" {
		return db, nil
	}
	configPath, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get config dir: %w", err)
	}
	storagePath := filepath.Join(configPath, "yarr")
	if err := os.MkdirAll(storagePath, 0755); err != nil {
		return "", fmt.Errorf("failed to create app config dir: %w", err)
	}
	return filepath.Join(storagePath, "storage.db"), nil
}

// warnSupervisedConflicts points out settings that make sense on their own but break
// supervision: the supervisor probes plain HTTP on loopback and captures the
// process's own stdout/stderr.
func warnSupervisedConflicts(addr, certfile, keyfile, logfile string) {
	if os.Getenv(envOutpostPort) == "" && os.Getenv(envOutpostStorage) == "" {
		return
	}
	if !isLoopback(addr) {
		log.Printf("warning: listening on %s exposes yarr beyond loopback; bind 127.0.0.1 when supervised", addr)
	}
	if certfile != "" && keyfile != "" {
		log.Print("warning: serving https; the supervisor health-checks plain http and will consider yarr down")
	}
	if logfile != "" {
		log.Printf("warning: logging to %s; the supervisor captures stdout/stderr and will not see these logs", logfile)
	}
}

func main() {
	_ = platform.FixConsoleIfNeeded()

	var addr, db, authfile, auth, certfile, keyfile, basepath, logfile string
	var port int
	var ver, open bool

	flag.CommandLine.SetOutput(os.Stdout)

	flag.Usage = func() {
		out := flag.CommandLine.Output()
		fmt.Fprintf(out, "Usage of %s:\n", os.Args[0])
		flag.PrintDefaults()
		fmt.Fprintln(out, "\nThe environmental variables, if present, will be used to provide\nthe default values for the params above:")
		fmt.Fprintln(out, " ", strings.Join(OptList, ", "))
		fmt.Fprintf(out, "\nWhen run under a supervisor, %s and %s are honoured as well.\n", envOutpostPort, envOutpostStorage)
	}

	flag.StringVar(&addr, "addr", opt("YARR_ADDR", defaultAddr), "address to run server on")
	flag.IntVar(&port, "port", 0, "tcp `port` to listen on 127.0.0.1, defaults to $"+envOutpostPort+" (alternative to --addr)")
	flag.StringVar(&basepath, "base", opt("YARR_BASE", ""), "base path of the service url")
	flag.StringVar(&authfile, "auth-file", opt("YARR_AUTHFILE", ""), "`path` to a file containing username:password. Takes precedence over --auth (or YARR_AUTH)")
	flag.StringVar(&auth, "auth", opt("YARR_AUTH", ""), "string with username and password in the format `username:password`")
	flag.StringVar(&certfile, "cert-file", opt("YARR_CERTFILE", ""), "`path` to cert file for https")
	flag.StringVar(&keyfile, "key-file", opt("YARR_KEYFILE", ""), "`path` to key file for https")
	flag.StringVar(&db, "db", opt("YARR_DB", ""), "storage file `path`")
	flag.StringVar(&logfile, "log-file", opt("YARR_LOGFILE", ""), "`path` to log file to use instead of stdout")
	flag.BoolVar(&ver, "version", false, "print application version")
	flag.BoolVar(&open, "open", false, "open the server in browser")
	flag.Parse()

	fromFlag := make(map[string]bool)
	flag.Visit(func(f *flag.Flag) { fromFlag[f.Name] = true })

	if ver {
		fmt.Printf("v%s (%s)\n", Version, GitHash)
		return
	}

	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	if logfile != "" {
		file, err := os.OpenFile(logfile, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0644)
		if err != nil {
			log.Fatal("Failed to setup log file: ", err)
		}
		defer file.Close()
		log.SetOutput(file)
	} else {
		log.SetOutput(os.Stdout)
	}

	addr, err := resolveAddr(addr, fromFlag["addr"], port, fromFlag["port"], os.Getenv("YARR_ADDR"), os.Getenv(envOutpostPort))
	if err != nil {
		log.Fatal("Failed to resolve listen address: ", err)
	}

	warnSupervisedConflicts(addr, certfile, keyfile, logfile)

	if open && strings.HasPrefix(addr, "unix:") {
		log.Fatal("Cannot open ", addr, " in browser")
	}

	db, err = resolveDBPath(db, fromFlag["db"], os.Getenv(envOutpostStorage))
	if err != nil {
		log.Fatal("Failed to resolve db path: ", err)
	}

	log.Printf("using db file %s", db)

	var username, password string
	if authfile != "" {
		f, err := os.Open(authfile)
		if err != nil {
			log.Fatal("Failed to open auth file: ", err)
		}
		defer f.Close()
		username, password, err = parseAuthfile(f)
		if err != nil {
			log.Fatal("Failed to parse auth file: ", err)
		}
	} else if auth != "" {
		username, password, err = parseAuthfile(strings.NewReader(auth))
		if err != nil {
			log.Fatal("Failed to parse auth literal: ", err)
		}
	}

	if (certfile != "" || keyfile != "") && (certfile == "" || keyfile == "") {
		log.Fatalf("Both cert & key files are required")
	}

	secretKeyBase := os.Getenv("SECRET_KEY_BASE")
	secureCookie := true
	if disableSSL := os.Getenv("DISABLE_SSL"); disableSSL != "" {
		if parsed, err := strconv.ParseBool(disableSSL); err != nil {
			log.Printf("invalid DISABLE_SSL value %q, defaulting to false", disableSSL)
		} else if parsed {
			secureCookie = false
		}
	}

	store, err := storage.New(db)
	if err != nil {
		log.Fatal("Failed to initialise database: ", err)
	}

	worker.SetVersion(Version)
	srv := server.NewServer(store, addr)

	if basepath != "" {
		srv.BasePath = "/" + strings.Trim(basepath, "/")
	}

	if certfile != "" && keyfile != "" {
		srv.CertFile = certfile
		srv.KeyFile = keyfile
	}

	if username != "" && password != "" {
		srv.Username = username
		srv.Password = password
	}

	srv.SecretKeyBase = secretKeyBase
	srv.SecureCookie = secureCookie

	log.Printf("starting server at %s", srv.GetAddr())
	if open {
		if err := platform.Open(srv.GetAddr()); err != nil {
			log.Printf("failed to open browser: %v", err)
		}
	}
	platform.Start(srv)
}
