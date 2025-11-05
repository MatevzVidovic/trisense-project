
# WebApp/server.py
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
from pathlib import Path
import sqlite3
from contextlib import closing

DB_PATH = Path(os.getenv("DB_PATH", "DB/db.sqlite3")).resolve()

app = FastAPI()

WEB_DIR = Path(__file__).parent
STATIC_DIR = WEB_DIR / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class Run(BaseModel):
    run_ix: int
    frame_height: int
    frame_width: int
    started_at: Optional[str] = None


class TrackIds(BaseModel):
    run_ix: int
    track_ixs: list[int]


class TrackPoint(BaseModel):
    frame_ix: int
    xmin: float
    ymin: float
    xmax: float
    ymax: float


class Track(BaseModel):
    run_ix: int
    track_ix: int
    image: dict
    points: list[TrackPoint]


def get_connection() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


@app.get("/", response_class=FileResponse)
def serve_index():
    return WEB_DIR / "index.html"


@app.get("/runs", response_model=list[Run])
def list_runs() -> list[Run]:
    with closing(get_connection()) as con:
        rows = con.execute(
            "SELECT run_ix, frame_height, frame_width, started_at FROM runs ORDER BY run_ix DESC"
        ).fetchall()
    return [Run(run_ix=row["run_ix"], frame_height=row["frame_height"], frame_width=row["frame_width"], started_at=row["started_at"]) for row in rows]


@app.get("/runs/{run_ix}/tracks", response_model=TrackIds)
def list_tracks(run_ix: int) -> TrackIds:
    with closing(get_connection()) as con:
        run_exists = con.execute(
            "SELECT 1 FROM runs WHERE run_ix = ?", (run_ix,)
        ).fetchone()
        if not run_exists:
            raise HTTPException(status_code=404, detail=f"Run {run_ix} not found")

        rows = con.execute(
            """
            SELECT DISTINCT track_ix
            FROM detections
            WHERE run_ix = ?
            ORDER BY track_ix
            """,
            (run_ix,),
        ).fetchall()

    return TrackIds(run_ix=run_ix, track_ixs=[row["track_ix"] for row in rows])


def fetch_track(
    run_ix: int, track_ix: int, start: Optional[int], end: Optional[int], sample: int
) -> Optional[Track]:
        
    query = """
        SELECT
            r.frame_width,
            r.frame_height
        FROM runs AS r
        WHERE r.run_ix = ?
    """

    with closing(get_connection()) as con:
        rows = con.execute(
            query, (run_ix,)
        ).fetchall()
        width = rows[0]["frame_width"]
        height = rows[0]["frame_height"]
    

    query = """
        SELECT
            d.frame_ix,
            d.xmin,
            d.ymin,
            d.xmax,
            d.ymax
        FROM detections AS d
        WHERE d.run_ix = ?
        AND d.track_ix = ?
        ORDER BY d.frame_ix
    """

    with closing(get_connection()) as con:
        rows = con.execute(
            query, (run_ix, track_ix)
        ).fetchall()

        
    if not rows:
        return None

    if sample and sample > 1:
        rows = rows[::sample]

    points = [
        TrackPoint(
            frame_ix=row["frame_ix"],
            xmin=row["xmin"],
            ymin=row["ymin"],
            xmax=row["xmax"],
            ymax=row["ymax"],
        )
        for row in rows
    ]

    return Track(
        run_ix=run_ix,
        track_ix=track_ix,
        image={"w": width, "h": height},
        points=points,
    )


@app.get(
    "/runs/{run_ix}/tracks/{track_ix}",
    response_model=Track,
)
def get_track(
    run_ix: int,
    track_ix: int,
    start: Optional[int] = Query(default=None, ge=0),
    end: Optional[int] = Query(default=None, ge=0),
    sample: int = Query(default=1, ge=1),
):
    track = fetch_track(run_ix, track_ix, start, end, sample)
    if not track:
        raise HTTPException(
            status_code=404,
            detail=f"Track {track_ix} not found for run {run_ix}",
        )
    return track
