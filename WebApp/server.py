
# WebApp/server.py
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sqlite3
from contextlib import closing
import os
from pathlib import Path

DB_PATH = Path(os.getenv("DB_PATH")).resolve()

app = FastAPI()

WEB_DIR = Path(__file__).parent
STATIC_DIR = WEB_DIR / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class Run(BaseModel):
    run_id: int
    started_at: Optional[str] = None


class TrackIds(BaseModel):
    run_id: int
    track_ids: list[int]


class TrackPoint(BaseModel):
    frame_id: int
    xmin: float
    ymin: float
    xmax: float
    ymax: float


class Track(BaseModel):
    run_id: int
    track_id: int
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
            "SELECT run_id, started_at FROM runs ORDER BY run_id DESC"
        ).fetchall()
    return [Run(run_id=row["run_id"], started_at=row["started_at"]) for row in rows]


@app.get("/runs/{run_id}/tracks", response_model=TrackIds)
def list_tracks(run_id: int) -> TrackIds:
    with closing(get_connection()) as con:
        run_exists = con.execute(
            "SELECT 1 FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
        if not run_exists:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

        rows = con.execute(
            """
            SELECT DISTINCT track_id
            FROM detections
            WHERE run_id = ?
            ORDER BY track_id
            """,
            (run_id,),
        ).fetchall()

    return TrackIds(run_id=run_id, track_ids=[row["track_id"] for row in rows])


def fetch_track(
    run_id: int, track_id: int, start: Optional[int], end: Optional[int], sample: int
) -> Optional[Track]:
    query = """
        SELECT
            d.frame_id,
            d.xmin,
            d.ymin,
            d.xmax,
            d.ymax,
            f.width,
            f.height
        FROM detections AS d
        JOIN frames AS f
        ON f.run_id = d.run_id
        AND f.frame_id = d.frame_id
        WHERE d.run_id = ?
        AND d.track_id = ?
        AND (? IS NULL OR d.frame_id >= ?)
        AND (? IS NULL OR d.frame_id <= ?)
        ORDER BY d.frame_id
    """

    with closing(get_connection()) as con:
        rows = con.execute(
            query, (run_id, track_id, start, start, end, end)
        ).fetchall()

    if not rows:
        return None

    if sample and sample > 1:
        rows = rows[::sample]

    width = rows[0]["width"]
    height = rows[0]["height"]
    points = [
        TrackPoint(
            frame_id=row["frame_id"],
            xmin=row["xmin"],
            ymin=row["ymin"],
            xmax=row["xmax"],
            ymax=row["ymax"],
        )
        for row in rows
    ]

    return Track(
        run_id=run_id,
        track_id=track_id,
        image={"w": width, "h": height},
        points=points,
    )


@app.get(
    "/runs/{run_id}/tracks/{track_id}",
    response_model=Track,
)
def get_track(
    run_id: int,
    track_id: int,
    start: Optional[int] = Query(default=None, ge=0),
    end: Optional[int] = Query(default=None, ge=0),
    sample: int = Query(default=1, ge=1),
):
    track = fetch_track(run_id, track_id, start, end, sample)
    if not track:
        raise HTTPException(
            status_code=404,
            detail=f"Track {track_id} not found for run {run_id}",
        )
    return track

