package main

import (
	"log"

	"github.com/jmoiron/sqlx"
)

var schema = `
CREATE TABLE IF NOT EXISTS event (
	id VARCHAR(32) PRIMARY KEY,
	date TIMESTAMP,
	disorder_type TEXT,
	event_type TEXT,
	sub_event_type TEXT,
	actor VARCHAR(32)
	civilian_targeting BOOLEAN,
	notes TEXT,
	fatalities INTEGER,
	CONSTRAINT 
		fk_event_actor Foreign Key (meeting) REFERENCES "actor" (id)
)
`

func main() {
	db, err := sqlx.Connect("postgres", "user=foo dbname=bar sslmode=disable")
	if err != nil {
		log.Fatalln(err)
	}
}
