package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"api.crushingviz.info/db"
	"api.crushingviz.info/handlers"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newRouter(queries *db.Queries) http.Handler {
	mux := http.NewServeMux()

	// both a health check and way to wake from cold start
	mux.HandleFunc("GET /ping", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
	})

	acled := handlers.ACLED{Queries: queries}
	mux.HandleFunc("GET /acled/weekly-agg", acled.ListWeeklyAgg)

	return mux
}

func newServer(addr string, mux http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

// openPool creates the Postgres connection pool and verifies it can reach the
// database, so a bad DSN or a down database fails at startup instead of on the
// first request.
func openPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return pool, nil
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	port := os.Getenv("API_PORT")

	if _, err := strconv.Atoi(port); err != nil {
		log.Fatalf("API_PORT must be a valid port number. Received %s", port)
	}

	dsn := os.Getenv("POSTGRES_CONNECTION_STRING")
	if dsn == "" {
		log.Fatal("POSTGRES_CONNECTION_STRING environment variable is required (is direnv loaded? try `direnv allow`)")
	}
	if strings.Contains(dsn, "${") {
		log.Fatal("POSTGRES_CONNECTION_STRING contains unexpanded ${...} references; load .env via direnv or export the full connection string")
	}

	pool, err := openPool(ctx, dsn)
	if err != nil {
		log.Fatalf("Failed to connect to postgres: %v", err)
	}
	// Runs after the server has drained, so in-flight requests keep their conns.
	defer pool.Close()

	server := newServer(fmt.Sprintf(":%s", port), newRouter(db.New(pool)))

	go func() {
		log.Printf("Listening on %s\n", server.Addr)
		err := server.ListenAndServe()
		// ignore ErrServerClosed signal, which happens during normal shutdown
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Error starting server: %v", err)
		}
	}()

	// block here until context is cancelled (SIGTERM/SIGINT)
	<-ctx.Done()
	log.Println("Shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
		server.Close()
	}
	log.Println("Server stopped")

}
