PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS runs (
  -- runs()
  run_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frames (
  -- frames(run_id, frame_id, width, height)
  run_id     INTEGER NOT NULL,
  frame_id  INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  PRIMARY KEY (run_id, frame_id)
);

CREATE TABLE IF NOT EXISTS detections (
  -- detections(run_id, track_id, frame_id, class_name, confidence, xmin, ymin, xmax, ymax)
  run_id      INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  frame_id     INTEGER NOT NULL,
  class_name   TEXT,
  confidence   REAL,
  xmin         REAL, ymin REAL, xmax REAL, ymax REAL,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id, track_id, frame_id),
  FOREIGN KEY (run_id, frame_id)  REFERENCES frames(run_id, frame_id) ON DELETE CASCADE

);

CREATE INDEX IF NOT EXISTS idx_frames_run_frame ON frames(run_id, frame_id);
CREATE INDEX IF NOT EXISTS idx_det_run_track_frame          ON detections(run_id, track_id, frame_id);
