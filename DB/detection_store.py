import sqlite3, threading, queue, time
import os

class DetectionStore:
    def __init__(self, db_path="DB/db.sqlite3"):

        first_time = not os.path.exists(db_path)

        # One connection used only by the writer thread
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self.conn.execute("PRAGMA synchronous=NORMAL;")
        self.conn.execute("PRAGMA foreign_keys=ON;")

        if first_time:
            with self.conn as c:
                print("[DB] Creating schema…")
                with open(os.path.join(os.path.dirname(__file__), "schema.sql")) as f:
                    c.executescript(f.read())
        
        with self.conn as c:
            cur = c.cursor()
            cur.execute("INSERT INTO runs DEFAULT VALUES;")
            self.run_ix = cur.lastrowid
                
        self.q = queue.Queue()
        self._stop = object()
        self.t = threading.Thread(target=self._writer, daemon=True)
        self.t.start()
    
    def log_frame_dims(self, frame_height, frame_width):
        with self.conn as c:
            cur = c.cursor()
            cur.execute("""UPDATE runs
                        SET frame_height = ?,
                            frame_width = ?
                        WHERE run_ix = ?;
                        """,
                        (frame_height, frame_width, self.run_ix))

    def log_detection(self, track_ix, frame_ix, class_name, conf, xmin, ymin, xmax, ymax):
        # Insertion is delayed by being put into a queue.
        sql = ("""INSERT INTO detections(run_ix, track_ix, frame_ix, class_name, 
                                        confidence, xmin, ymin, xmax, ymax)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""")
        params = (self.run_ix, track_ix, frame_ix, class_name, conf, xmin, ymin, xmax, ymax)
        self.q.put((sql, params))

    def close(self):
        self.q.put(self._stop)
        self.t.join()

    # --- writer thread ---
    def _writer(self):
        batch, last_flush = [], time.time()
        BATCH_SIZE, FLUSH_SECS = 200, 0.25
        while True:
            try:
                item = self.q.get(timeout=FLUSH_SECS)
            except queue.Empty:
                item = None
            if item is self._stop:
                self._flush(batch)
                break
            if item is not None:
                batch.append(item)
                self.q.task_done()
            if len(batch) >= BATCH_SIZE or (batch and time.time() - last_flush >= FLUSH_SECS):
                self._flush(batch)
                last_flush = time.time()

    def _flush(self, batch):
        if not batch: return
        try:
            with self.conn as c:
                cur = c.cursor()
                for sql, params in batch:
                    cur.execute(sql, params)
        finally:
            batch.clear()
