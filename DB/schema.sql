PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS runs (
  -- runs()
  run_ix     INTEGER PRIMARY KEY AUTOINCREMENT,
  frame_height INTEGER DEFAULT -1,
  frame_width INTEGER DEFAULT -1,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detections (
  -- detections(run_ix, track_ix, frame_ix, class_name, confidence, xmin, ymin, xmax, ymax)
  run_ix      INTEGER NOT NULL,
  track_ix INTEGER NOT NULL,
  frame_ix     INTEGER NOT NULL,
  class_name   TEXT,
  confidence   REAL,
  xmin         REAL, ymin REAL, xmax REAL, ymax REAL,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_ix, track_ix, frame_ix)
);

CREATE INDEX IF NOT EXISTS idx_det_run_track_frame          ON detections(run_ix, track_ix, frame_ix);
