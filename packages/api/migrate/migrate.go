package main

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// Migration represents a single database migration
type Migration struct {
	Version     int
	Description string
	UpSQL       string
	DownSQL     string
}

// Migrator handles database migrations
type Migrator struct {
	db         *sql.DB
	migrations []*Migration
}

// NewMigrator creates a new migrator instance
func NewMigrator(db *sql.DB) *Migrator {
	return &Migrator{
		db:         db,
		migrations: make([]*Migration, 0),
	}
}

// LoadMigrations loads migrations from SQL files in a directory
// Files should follow the pattern: {version}_{description}_up.sql and {version}_{description}_down.sql
func (m *Migrator) LoadMigrations(dirPath string) error {
	upMigrations := make(map[int]string)
	downMigrations := make(map[int]string)
	descriptions := make(map[int]string)

	// Clear existing migrations
	m.migrations = make([]*Migration, 0)

	err := filepath.Walk(dirPath, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() && path != dirPath {
			return filepath.SkipDir // Skip subdirectories
		}
		if info.IsDir() || !strings.HasSuffix(path, ".sql") {
			return nil
		}

		fileName := filepath.Base(path)
		parts := strings.Split(fileName, "_")
		if len(parts) < 3 {
			return fmt.Errorf("invalid migration filename format: %s", fileName)
		}

		// Parse version number
		version, err := strconv.Atoi(parts[0])
		if err != nil {
			return fmt.Errorf("invalid version number in migration: %s", fileName)
		}
		if version < 1 {
			return fmt.Errorf("migration version must be greater than 0: %s", fileName)
		}

		// Parse migration type (up or down)
		lastPart := parts[len(parts)-1]
		isUp := strings.HasSuffix(lastPart, "up.sql")
		isDown := strings.HasSuffix(lastPart, "down.sql")
		if !isUp && !isDown {
			return fmt.Errorf("migration file must end with up.sql or down.sql: %s", fileName)
		}

		// Extract description (everything between version and up/down)
		description := strings.Join(parts[1:len(parts)-1], "_")

		// Read file content
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		if isUp {
			upMigrations[version] = string(content)
			descriptions[version] = description
		} else {
			downMigrations[version] = string(content)
		}

		return nil
	})

	if err != nil {
		return err
	}

	// Create migrations from the loaded files
	for version, upSQL := range upMigrations {
		// Ensure we have an up migration
		if upSQL == "" {
			return fmt.Errorf("missing up migration for version %d", version)
		}

		// Get corresponding down migration (can be empty)
		downSQL := downMigrations[version]
		description := descriptions[version]

		// Check for duplicate versions
		for _, migration := range m.migrations {
			if migration.Version == version {
				return fmt.Errorf("duplicate migration version %d", version)
			}
		}

		// Add migration
		m.migrations = append(m.migrations, &Migration{
			Version:     version,
			Description: description,
			UpSQL:       upSQL,
			DownSQL:     downSQL,
		})
	}

	// Sort migrations by version
	sort.Slice(m.migrations, func(i, j int) bool {
		return m.migrations[i].Version < m.migrations[j].Version
	})

	return nil
}

// Initialize creates the migrations table if it doesn't exist
func (m *Migrator) Initialize() error {
	query := `
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );`

	_, err := m.db.Exec(query)
	return err
}

// GetCurrentVersion returns the current database schema version
func (m *Migrator) GetCurrentVersion() (int, error) {
	var version int
	query := `
    SELECT COALESCE(MAX(version), 0) FROM schema_migrations;
    `
	err := m.db.QueryRow(query).Scan(&version)
	return version, err
}

// UpToVersion migrates the database up to a specific version
func (m *Migrator) UpToVersion(targetVersion int) error {
	if len(m.migrations) == 0 {
		return errors.New("no migrations loaded")
	}

	err := m.Initialize()
	if err != nil {
		return err
	}

	currentVersion, err := m.GetCurrentVersion()
	if err != nil {
		return err
	}

	if currentVersion >= targetVersion {
		return nil // Already at or beyond target version
	}

	// Start a transaction
	tx, err := m.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Apply migrations
	for _, migration := range m.migrations {
		if migration.Version <= currentVersion {
			continue // Skip already applied migrations
		}

		if migration.Version > targetVersion {
			break // Stop at target version
		}

		// Execute migration
		_, err = tx.Exec(migration.UpSQL)
		if err != nil {
			return fmt.Errorf("failed to apply migration %d (%s): %w",
				migration.Version, migration.Description, err)
		}

		// Record migration
		_, err = tx.Exec(`
            INSERT INTO schema_migrations (version, description, applied_at) 
            VALUES ($1, $2, $3)
        `, migration.Version, migration.Description, time.Now())
		if err != nil {
			return fmt.Errorf("failed to record migration %d: %w", migration.Version, err)
		}

		fmt.Printf("Applied migration %d: %s\n", migration.Version, migration.Description)
	}

	return tx.Commit()
}

// UpAll migrates the database to the latest version
func (m *Migrator) UpAll() error {
	if len(m.migrations) == 0 {
		return errors.New("no migrations loaded")
	}

	// Find highest version
	highestVersion := m.migrations[len(m.migrations)-1].Version
	return m.UpToVersion(highestVersion)
}

// DownToVersion migrates the database down to a specific version
func (m *Migrator) DownToVersion(targetVersion int) error {
	if len(m.migrations) == 0 {
		return errors.New("no migrations loaded")
	}

	err := m.Initialize()
	if err != nil {
		return err
	}

	currentVersion, err := m.GetCurrentVersion()
	if err != nil {
		return err
	}

	if currentVersion <= targetVersion {
		return nil // Already at or below target version
	}

	// Get applied migrations
	rows, err := m.db.Query(`
        SELECT version, description 
        FROM schema_migrations 
        WHERE version > $1 
        ORDER BY version DESC
    `, targetVersion)
	if err != nil {
		return err
	}
	defer rows.Close()

	type appliedMigration struct {
		Version     int
		Description string
	}

	appliedMigrations := make([]appliedMigration, 0)
	for rows.Next() {
		var am appliedMigration
		if err := rows.Scan(&am.Version, &am.Description); err != nil {
			return err
		}
		appliedMigrations = append(appliedMigrations, am)
	}

	if err = rows.Err(); err != nil {
		return err
	}

	// Create a map of migrations for easy lookup
	migrationsMap := make(map[int]*Migration)
	for _, migration := range m.migrations {
		migrationsMap[migration.Version] = migration
	}

	// Start a transaction
	tx, err := m.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Apply down migrations
	for _, am := range appliedMigrations {
		migration, exists := migrationsMap[am.Version]
		if !exists {
			return fmt.Errorf("cannot find down migration for version %d", am.Version)
		}

		if migration.DownSQL == "" {
			return fmt.Errorf("down migration SQL is empty for version %d", am.Version)
		}

		// Execute down migration
		_, err = tx.Exec(migration.DownSQL)
		if err != nil {
			return fmt.Errorf("failed to apply down migration %d (%s): %w",
				migration.Version, migration.Description, err)
		}

		// Remove migration record
		_, err = tx.Exec(`
            DELETE FROM schema_migrations 
            WHERE version = $1
        `, migration.Version)
		if err != nil {
			return fmt.Errorf("failed to remove migration record %d: %w", migration.Version, err)
		}

		fmt.Printf("Reverted migration %d: %s\n", migration.Version, migration.Description)
	}

	return tx.Commit()
}

// Down reverts the most recent migration
func (m *Migrator) Down() error {
	currentVersion, err := m.GetCurrentVersion()
	if err != nil {
		return err
	}

	if currentVersion == 0 {
		return nil // No migrations to revert
	}

	return m.DownToVersion(currentVersion - 1)
}

func main() {
	// Connect to the database
	connStr := os.Getenv("POSTGRES_CONNECTION_STRING")
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Create a migrator
	migrator := NewMigrator(db)

	// Load migrations from the directory
	migrationsDir := "./migrations"
	if len(os.Args) >= 3 && os.Args[1] == "dir" {
		migrationsDir = os.Args[2]
		os.Args = append(os.Args[:1], os.Args[3:]...)
	}

	err = migrator.LoadMigrations(migrationsDir)
	if err != nil {
		log.Fatalf("Failed to load migrations: %v", err)
	}

	// Print usage if no arguments provided
	if len(os.Args) < 2 {
		fmt.Println("Usage: migrate [dir MIGRATIONS_DIR] [up|down|up-to VERSION|down-to VERSION|status]")
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "up":
		err = migrator.UpAll()
	case "down":
		err = migrator.Down()
	case "up-to":
		if len(os.Args) < 3 {
			fmt.Println("Missing version number")
			os.Exit(1)
		}
		version, err := strconv.Atoi(os.Args[2])
		if err != nil {
			fmt.Printf("Invalid version number: %s\n", os.Args[2])
			os.Exit(1)
		}
		err = migrator.UpToVersion(version)
	case "down-to":
		if len(os.Args) < 3 {
			fmt.Println("Missing version number")
			os.Exit(1)
		}
		version, err := strconv.Atoi(os.Args[2])
		if err != nil {
			fmt.Printf("Invalid version number: %s\n", os.Args[2])
			os.Exit(1)
		}
		err = migrator.DownToVersion(version)
	case "status":
		currentVersion, err := migrator.GetCurrentVersion()
		if err != nil {
			log.Fatalf("Failed to get current version: %v", err)
		}
		fmt.Printf("Current database version: %d\n", currentVersion)
	default:
		fmt.Println("Unknown command")
		os.Exit(1)
	}

	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	fmt.Println("Migration completed successfully")
}
