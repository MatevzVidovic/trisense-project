import { fetchTrack, resizeCanvas, drawTrack } from "./track_display.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const runSelect = document.getElementById("run");
const trackSelect = document.getElementById("track");
const sampleInput = document.getElementById("sample");
const loadBtn = document.getElementById("load");
const scrub = document.getElementById("scrub");
const info = document.getElementById("info");
const status = document.getElementById("status");

let currentTrack = null;

function setStatus(message = "") {
  status.textContent = message;
}

function setInfo(message = "") {
  info.textContent = message;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function loadRuns() {
  setStatus("Loading runs…");
  try {
    const runs = await fetchJSON("/runs");
    runSelect.innerHTML = "";
    if (runs.length === 0) {
      runSelect.disabled = true;
      trackSelect.disabled = true;
      setStatus("No runs found");
      return;
    }
    runs.forEach(({ run_ix, started_at }) => {
      const option = document.createElement("option");
      option.value = run_ix;
      option.textContent = started_at ? `${run_ix} (${started_at})` : run_ix;
      runSelect.appendChild(option);
    });
    runSelect.disabled = false;
    await loadTracks();
    setStatus("");
  } catch (err) {
    runSelect.innerHTML = "";
    trackSelect.innerHTML = "";
    setStatus(err.message || "Failed to load runs");
  }
}

async function loadTracks() {
  const runId = runSelect.value;
  trackSelect.innerHTML = "";
  trackSelect.disabled = true;
  setStatus("Loading tracks…");
  try {
    const data = await fetchJSON(`/runs/${runId}/tracks`);
    if (data.track_ixs.length === 0) {
      setStatus("No tracks in run");
      return;
    }
    data.track_ixs.forEach((trackId) => {
      const option = document.createElement("option");
      option.value = trackId;
      option.textContent = trackId;
      trackSelect.appendChild(option);
    });
    trackSelect.disabled = false;
    setStatus("");
  } catch (err) {
    setStatus(err.message || "Failed to load tracks");
  }
}

async function loadTrackData() {
  const runId = runSelect.value;
  const trackId = trackSelect.value;
  const sample = Math.max(1, Number(sampleInput.value) || 1);

  if (!runId) {
    setStatus("Pick a run");
    return;
  }
  if (!trackId) {
    setStatus("Pick a track");
    return;
  }

  setStatus("Loading track…");
  try {
    currentTrack = await fetchTrack(runId, trackId, sample);
    resizeCanvas(canvas, ctx, currentTrack.image);
    setStatus(
      currentTrack.points.length
        ? `Loaded ${currentTrack.points.length} points`
        : "Track has no points",
    );
    scrub.max = Math.max(0, currentTrack.points.length - 1);
    scrub.value = 0;
    drawTrack(ctx, canvas, currentTrack, 0, setInfo);
  } catch (err) {
    currentTrack = null;
    scrub.max = 0;
    scrub.value = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setInfo("");
    setStatus(err.message || "Failed to load track");
  }
}

loadBtn.addEventListener("click", loadTrackData);

scrub.addEventListener("input", (event) => {
  drawTrack(ctx, canvas, currentTrack, Number(event.target.value), setInfo);
});

runSelect.addEventListener("change", async () => {
  await loadTracks();
  currentTrack = null;
  scrub.max = 0;
  scrub.value = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setInfo("");
});

window.addEventListener("resize", () => {
  resizeCanvas(canvas, ctx);
  drawTrack(ctx, canvas, currentTrack, Number(scrub.value), setInfo);
});

(async function init() {
  await loadRuns().catch(() => {});
  resizeCanvas(canvas, ctx);
})();
