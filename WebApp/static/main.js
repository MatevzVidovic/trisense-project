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

function setStatus(message = "") { status.textContent = message; }
function setInfo(message = "") { info.textContent = message; }

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
    runs.forEach(({ run_id, started_at }) => {
      const option = document.createElement("option");
      option.value = run_id;
      option.textContent = started_at ? `${run_id} (${started_at})` : run_id;
      runSelect.appendChild(option);
    });
    runSelect.disabled = false;
    await loadTracks();
    setStatus("");
  } catch (err) {
    runSelect.innerHTML = "";
    trackSelect.innerHTML = "";
    setStatus(err.message || "Failed to load runs");
    throw err;
  }
}

async function loadTracks() {
  const runId = runSelect.value;
  trackSelect.innerHTML = "";
  trackSelect.disabled = true;
  setStatus("Loading tracks…");
  try {
    const data = await fetchJSON(`/runs/${runId}/tracks`);
    if (data.track_ids.length === 0) {
      setStatus("No tracks in run");
      return;
    }
    data.track_ids.forEach((trackId) => {
      const option = document.createElement("option");
      option.value = trackId;
      option.textContent = trackId;
      trackSelect.appendChild(option);
    });
    trackSelect.disabled = false;
    setStatus("");
  } catch (err) {
    setStatus(err.message || "Failed to load tracks");
    throw err;
  }
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw(idx = Number(scrub.value)) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!currentTrack || currentTrack.points.length === 0) {
    setInfo("");
    return;
  }

  const { w: imgW, h: imgH } = currentTrack.image;
  if (!imgW || !imgH) {
    setInfo("Track has no frame size");
    return;
  }

  const scale = Math.min(canvas.width / window.devicePixelRatio / imgW,
    canvas.height / window.devicePixelRatio / imgH);
  const offsetX = (canvas.width / window.devicePixelRatio - imgW * scale) / 2;
  const offsetY = (canvas.height / window.devicePixelRatio - imgH * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, imgW, imgH);

  ctx.beginPath();
  currentTrack.points.forEach((p, i) => {
    const cx = (p.xmin + p.xmax) / 2;
    const cy = (p.ymin + p.ymax) / 2;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.strokeStyle = "#0a7";
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  const point = currentTrack.points[idx];
  if (point) {
    const cx = (point.xmin + point.xmax) / 2;
    const cy = (point.ymin + point.ymax) / 2;

    ctx.fillStyle = "rgba(210, 40, 40, 0.15)";
    ctx.fillRect(point.xmin, point.ymin,
      point.xmax - point.xmin,
      point.ymax - point.ymin);

    ctx.fillStyle = "#d22";
    ctx.beginPath();
    ctx.arc(cx, cy, 4 / scale, 0, Math.PI * 2);
    ctx.fill();

    setInfo(`run ${currentTrack.run_id} · track ${currentTrack.track_id} · frame ${point.frame_id} · center
(${Math.round(cx)}, ${Math.round(cy)})`);
  }

  ctx.restore();
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
    currentTrack = await fetchJSON(`/runs/${runId}/tracks/${trackId}?sample=${sample}`);
    if (!currentTrack.points.length) {
      setStatus("Track has no points");
    } else {
      setStatus(`Loaded ${currentTrack.points.length} points`);
    }
    scrub.max = Math.max(0, currentTrack.points.length - 1);
    scrub.value = 0;
    draw(0);
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
scrub.addEventListener("input", (event) => draw(Number(event.target.value)));
runSelect.addEventListener("change", async () => {
  await loadTracks();
  currentTrack = null;
  scrub.max = 0;
  scrub.value = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setInfo("");
});

window.addEventListener("resize", resizeCanvas);

(async function init() {
  await loadRuns().catch(() => {});
  resizeCanvas();
})();