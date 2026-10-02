DROP TABLE IF EXISTS playlist_items;
DROP TABLE IF EXISTS listening_history;
DROP TABLE IF EXISTS playlists;


CREATE TABLE playlists (
    id BIGSERIAL PRIMARY KEY,
    client_id VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_playlists_client
ON playlists(client_id);


CREATE TABLE playlist_items (
    id BIGSERIAL PRIMARY KEY,

    playlist_id BIGINT NOT NULL
        REFERENCES playlists(id)
        ON DELETE CASCADE,

    source VARCHAR(20) NOT NULL
        CHECK (source IN ('youtube', 'audius')),

    source_id VARCHAR(100) NOT NULL,

    title TEXT NOT NULL,

    artist TEXT,

    thumbnail_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        playlist_id,
        source,
        source_id
    )
);

CREATE INDEX idx_playlist_items_playlist
ON playlist_items(playlist_id);


CREATE TABLE listening_history (
    id BIGSERIAL PRIMARY KEY,

    client_id VARCHAR(100) NOT NULL,

    source VARCHAR(20) NOT NULL
        CHECK (source IN ('youtube', 'audius')),

    source_id VARCHAR(100) NOT NULL,

    title TEXT NOT NULL,

    artist TEXT,

    thumbnail_url TEXT,

    watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_client
ON listening_history(
    client_id,
    watched_at DESC
);