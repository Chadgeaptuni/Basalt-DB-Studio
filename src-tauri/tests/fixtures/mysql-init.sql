-- Seed schema for Basalt DB Studio integration tests (MySQL).
-- Loaded by docker-compose.test.yml into /docker-entrypoint-initdb.d/.
-- Exercises the edge types the design spec calls out: json, enums, decimals,
-- dates, datetimes, blobs, tinyint(1) booleans, plus NULLs.

CREATE DATABASE IF NOT EXISTS basalt_test;
USE basalt_test;

CREATE TABLE edge_types (
    id         INT PRIMARY KEY,
    big        BIGINT,
    amount     DECIMAL(20, 4),
    label      VARCHAR(64),
    note       TEXT,
    flag       TINYINT(1),
    created_at DATETIME,
    the_day    DATE,
    payload    JSON,
    blob_data  BLOB,
    feeling    ENUM('sad', 'ok', 'happy')
);

INSERT INTO edge_types
    (id, big, amount, label, note, flag, created_at, the_day, payload, blob_data, feeling)
VALUES
    (1, 9223372036854775807, 12345.6789, 'first', 'first row', 1,
     '2026-07-24 12:34:56', '2026-07-24',
     '{"k": "v", "n": 42}', 0xDEADBEEF, 'happy'),
    (2, -9223372036854775808, -0.0001, 'second', 'unicode ☃ and ''quotes''', 0,
     '1999-12-31 23:59:59', '1999-12-31',
     '[1, 2, {"nested": true}]', 0x00, 'sad'),
    (3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

CREATE TABLE users (
    id    INT PRIMARY KEY,
    name  VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL
);

INSERT INTO users (id, name, email) VALUES
    (1, 'Ada Lovelace', 'ada@example.com'),
    (2, 'Alan Turing', 'alan@example.com');
