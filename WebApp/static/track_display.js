export async function fetchTrack(runId, trackId, sample = 1) {
  const res = await fetch(`/runs/${runId}/tracks/${trackId}?sample=${sample}`);
  if (!res.ok) {
    throw new Error((await res.text()) || res.statusText);
  }
  return res.json();
}

export function resizeCanvas(canvas, ctx, frameShape=null) {
  const dpr = window.devicePixelRatio || 1;

  // set correct CSS aspect ratio
  if (frameShape) {
    canvas.style.height = `${canvas.clientWidth * (frameShape.h / frameShape.w)}px`;
    canvas.style.border = canvas.style.border || "4px solid #0d104bff";
  }

  // set correct pixel buffer shape
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function drawTrack(ctx, canvas, track, frameIndex, updateInfo) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!track || track.points.length === 0) {
    updateInfo?.("");
    return;
  }

  const { w: imgW, h: imgH } = track.image;
  if (!imgW || !imgH) {
    updateInfo?.("Track has no frame size");
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(
    canvas.width / dpr / imgW,
    canvas.height / dpr / imgH,
  );
  const offsetX = (canvas.width / dpr - imgW * scale) / 2;
  const offsetY = (canvas.height / dpr - imgH * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, imgW, imgH);

  ctx.beginPath();
  track.points.forEach((p, i) => {
    const cx = (p.xmin + p.xmax) / 2;
    const cy = (p.ymin + p.ymax) / 2;
    if (i === 0) {
      ctx.moveTo(cx, cy);
    } else {
      ctx.lineTo(cx, cy);
    }
  });
  ctx.strokeStyle = "#0a7";
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  const point = track.points[frameIndex];
  if (point) {
    const cx = (point.xmin + point.xmax) / 2;
    const cy = (point.ymin + point.ymax) / 2;

    ctx.fillStyle = "rgba(210, 40, 40, 0.15)";
    ctx.fillRect(
      point.xmin,
      point.ymin,
      point.xmax - point.xmin,
      point.ymax - point.ymin,
    );

    ctx.fillStyle = "#d22";
    ctx.beginPath();
    ctx.arc(cx, cy, 4 / scale, 0, Math.PI * 2);
    ctx.fill();

    updateInfo?.(
      `run ${track.run_ix} · track ${track.track_ix} · frame ${point.frame_ix} · center (${Math.round(cx)}, ${Math.round(cy)})`,
    );
  }

  ctx.restore();
}
