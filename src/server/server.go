package server

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/nkanaev/yarr/src/storage"
	"github.com/nkanaev/yarr/src/worker"
)

type Server struct {
	Addr        string
	db          *storage.Storage
	worker      *worker.Worker
	cache       map[string]interface{}
	cache_mutex *sync.Mutex

	BasePath string

	// build
	Version string

	// StopCtx, when set, is the stop signal Start watches instead of trapping
	// signals itself, so a caller can hold one registration for the whole
	// process. StopHandoff, if set, is called once Start is watching it and
	// whatever handled signals until then can retire.
	StopCtx     context.Context
	StopHandoff func()

	// auth
	Username string
	Password string
	// https
	CertFile string
	KeyFile  string

	// once
	SecretKeyBase string
	SecureCookie  bool

	// ready gates the healthcheck: false while starting up or shutting down.
	ready atomic.Bool
	// stopping and startupDone keep startup and shutdown from overlapping.
	stopping    atomic.Bool
	startupDone chan struct{}

	// the openapi document, version-stamped once on first request.
	openapiOnce sync.Once
	openapiDoc  []byte
}

func NewServer(db *storage.Storage, addr string) *Server {
	s := &Server{
		db:          db,
		Addr:        addr,
		worker:      worker.NewWorker(db),
		cache:       make(map[string]interface{}),
		cache_mutex: &sync.Mutex{},
	}
	// A handler used directly (tests, embedding) can serve straight away.
	// Start() flips this off for the duration of its own startup work.
	s.ready.Store(true)
	return s
}

func (h *Server) GetAddr() string {
	proto := "http"
	if h.CertFile != "" && h.KeyFile != "" {
		proto = "https"
	}
	return proto + "://" + h.Addr + h.BasePath
}

// listen binds the configured address. A stale unix socket left behind by an
// unclean exit is removed first, so restarts never need manual repair.
func (s *Server) listen() (net.Listener, error) {
	if path, isUnix := strings.CutPrefix(s.Addr, "unix:"); isUnix {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			log.Print(err)
		}
		return net.Listen("unix", path)
	}
	return net.Listen("tcp", s.Addr)
}

// startup does the work that has to happen before yarr can serve real traffic.
// It runs after the listener is bound so the healthcheck can answer "not ready"
// rather than refuse the connection.
func (s *Server) startup() {
	defer close(s.startupDone)

	// A stop can arrive before we get here. Beginning a feed refresh on the
	// way out only races the database close in shutdown.
	if s.stopping.Load() {
		return
	}

	refreshRate := s.db.GetSettingsValueInt64("refresh_rate")
	s.worker.FindFavicons()
	s.worker.StartFeedCleaner()
	s.worker.SetRefreshRate(refreshRate)
	if refreshRate > 0 {
		s.worker.RefreshFeeds()
	}
	s.ready.Store(true)
	log.Printf("ready at %s", s.GetAddr())
}

// shutdown stops taking new work and flushes what has to reach disk. A
// supervisor sends SIGKILL 10 seconds after SIGTERM, so this leaves headroom.
func (s *Server) shutdown(httpserver *http.Server) {
	log.Print("shutting down server...")
	s.ready.Store(false)
	s.stopping.Store(true)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if err := httpserver.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}

	// Let startup finish or bail before the database goes away, so the two
	// cannot overlap. It only ever kicks work off, so this is brief.
	select {
	case <-s.startupDone:
	case <-time.After(time.Second):
	}

	// Stop the auto-refresh ticker before closing the database, so no fetch
	// starts against a connection that is about to go away.
	s.worker.SetRefreshRate(0)
	if err := s.db.Close(); err != nil {
		log.Printf("failed to close database: %v", err)
	}
	log.Print("stopped")
}

func (s *Server) Start() {
	s.ready.Store(false)
	s.startupDone = make(chan struct{})

	// SIGTERM is a stop request, never a reload. It is watched before the
	// listener binds so that a stop arriving during startup still drains
	// cleanly instead of killing the process with a signal status.
	ctx := s.StopCtx
	if ctx == nil {
		var stop context.CancelFunc
		ctx, stop = signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
		defer stop()
	}

	httpserver := &http.Server{Handler: s.handler()}

	done := make(chan struct{})
	go func() {
		defer close(done)
		<-ctx.Done()
		s.shutdown(httpserver)
	}()

	// Signals are ours now; whatever was covering the gap before can stop.
	if s.StopHandoff != nil {
		s.StopHandoff()
	}

	ln, err := s.listen()
	if err != nil {
		// Non-zero exit: an address we cannot bind is not recoverable here.
		log.Fatal(err)
	}

	go s.startup()

	if s.CertFile != "" && s.KeyFile != "" {
		err = httpserver.ServeTLS(ln, s.CertFile, s.KeyFile)
	} else {
		err = httpserver.Serve(ln)
	}

	if err != http.ErrServerClosed {
		log.Fatal(err)
	}

	// Serve returns as soon as Shutdown is called; wait for the flush.
	<-done
}
