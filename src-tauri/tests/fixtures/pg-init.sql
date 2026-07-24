-- Seed schema for Basalt DB Studio integration tests (Postgres).
-- Loaded by docker-compose.test.yml into /docker-entrypoint-initdb.d/.
-- Exercises the edge types the design spec calls out: arrays, jsonb, enums,
-- decimals, dates, timestamptz, bytea, plus NULLs.

CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');

CREATE TABLE edge_types (
    id         integer PRIMARY KEY,
    big        bigint,
    amount     numeric(20, 4),
    note       text,
    flag       boolean,
    created_at timestamptz,
    the_day    date,
    payload    jsonb,
    tags       integer[],
    feeling    mood,
    blob_data  bytea
);

INSERT INTO edge_types
    (id, big, amount, note, flag, created_at, the_day, payload, tags, feeling, blob_data)
VALUES
    (1, 9223372036854775807, 12345.6789, 'first row', true,
     '2026-07-24 12:34:56.789+00', '2026-07-24',
     '{"k": "v", "n": 42}', '{1,2,3}', 'happy', '\xDEADBEEF'),
    (2, -9223372036854775808, -0.0001, 'unicode ☃ and ''quotes''', false,
     '1999-12-31 23:59:59+00', '1999-12-31',
     '[1, 2, {"nested": true}]', '{}', 'sad', '\x00'),
    (3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

CREATE TABLE users (
    id    integer PRIMARY KEY,
    name  text NOT NULL,
    email text NOT NULL
);

INSERT INTO users (id, name, email) VALUES
    (1, 'Ada Lovelace', 'ada@example.com'),
    (2, 'Alan Turing', 'alan@example.com');
