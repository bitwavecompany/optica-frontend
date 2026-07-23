import type { GlassesTransform, HeadPose } from "@/types";
import type { LightingEstimate } from "@/lib/lightingEstimator";
import type { GlassesAlphaData } from "@/lib/glassesAlphaAnalyzer";
import { getAbsoluteLensZone } from "@/lib/glassesAlphaAnalyzer";

interface LensZone {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
}

interface GlareConfig {
  hotspotX: number;
  hotspotY: number;
  hotspotSize: number;
  streakAngle: number;
  streakLength: number;
  primaryOpacity: number;
  secondaryOpacity: number;
  tintR: number;
  tintG: number;
  tintB: number;
}

function getLensZones(
  transform: GlassesTransform,
  alphaData: GlassesAlphaData
): { left: LensZone; right: LensZone } {
  const left  = getAbsoluteLensZone(alphaData.leftLens,  transform);
  const right = getAbsoluteLensZone(alphaData.rightLens, transform);
  return { left, right };
}

function computeGlareConfig(
  zone: LensZone,
  lighting: LightingEstimate,
  headPose: HeadPose
): GlareConfig {
  let offsetXRatio = 0;
  let offsetYRatio = -0.25;

  switch (lighting.direction) {
    case "left":
      offsetXRatio = -0.3;
      offsetYRatio = -0.2;
      break;
    case "right":
      offsetXRatio =  0.3;
      offsetYRatio = -0.2;
      break;
    case "top":
      offsetXRatio =  0;
      offsetYRatio = -0.4;
      break;
    case "frontal":
      offsetXRatio =  0;
      offsetYRatio = -0.25;
      break;
  }

  const yawShift   = (headPose.yaw   / 90) * 0.15;
  const pitchShift = (headPose.pitch / 60) * 0.1;

  offsetXRatio += yawShift;
  offsetYRatio += pitchShift;

  const hotspotX = zone.centerX + offsetXRatio * zone.radiusX * 2;
  const hotspotY = zone.centerY + offsetYRatio * zone.radiusY * 2;

  const hotspotSize = zone.radiusX * (0.5 + lighting.contrast * 0.4);

  let streakAngle = -35;
  if (lighting.direction === "left")  streakAngle = -55;
  if (lighting.direction === "right") streakAngle = -15;
  if (lighting.direction === "top")   streakAngle = -90;

  streakAngle += headPose.roll * 0.5;

  const streakLength = zone.radiusX * (0.6 + lighting.contrast * 0.5);

  const brightnessBoost  = Math.min(1, lighting.brightness * 1.3);
  const primaryOpacity   = 0.12 + brightnessBoost * 0.18;
  const secondaryOpacity = primaryOpacity * 0.45;

  let tintR = 255, tintG = 255, tintB = 255;
  if (lighting.warmth > 1.2) {
    tintR = 255;
    tintG = 240;
    tintB = 200;
  } else if (lighting.warmth < 0.85) {
    tintR = 200;
    tintG = 220;
    tintB = 255;
  }

  return {
    hotspotX,
    hotspotY,
    hotspotSize,
    streakAngle,
    streakLength,
    primaryOpacity,
    secondaryOpacity,
    tintR,
    tintG,
    tintB,
  };
}

function drawLensGlare(
  ctx: CanvasRenderingContext2D,
  zone: LensZone,
  glare: GlareConfig,
  transform: GlassesTransform,
  headPose: HeadPose
): void {
  ctx.save();

  const centerX = transform.x + transform.width  / 2;
  const centerY = transform.y + transform.height / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate((headPose.roll * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(zone.centerX, zone.centerY, zone.radiusX, zone.radiusY, 0, 0, Math.PI * 2);
  ctx.clip();

  const { tintR, tintG, tintB } = glare;

  const hotspot = ctx.createRadialGradient(
    glare.hotspotX, glare.hotspotY, 0,
    glare.hotspotX, glare.hotspotY, glare.hotspotSize
  );
  hotspot.addColorStop(0,   `rgba(${tintR},${tintG},${tintB},${glare.primaryOpacity})`);
  hotspot.addColorStop(0.4, `rgba(${tintR},${tintG},${tintB},${glare.primaryOpacity * 0.5})`);
  hotspot.addColorStop(1,   `rgba(${tintR},${tintG},${tintB},0)`);

  ctx.fillStyle = hotspot;
  ctx.fillRect(
    zone.centerX - zone.radiusX,
    zone.centerY - zone.radiusY,
    zone.radiusX * 2,
    zone.radiusY * 2
  );

  const angleRad    = (glare.streakAngle * Math.PI) / 180;
  const streakEndX  = glare.hotspotX + Math.cos(angleRad) * glare.streakLength;
  const streakEndY  = glare.hotspotY + Math.sin(angleRad) * glare.streakLength;
  const streakWidth = zone.radiusX * 0.18;

  const streak = ctx.createLinearGradient(
    glare.hotspotX, glare.hotspotY,
    streakEndX, streakEndY
  );
  streak.addColorStop(0,   `rgba(${tintR},${tintG},${tintB},${glare.secondaryOpacity})`);
  streak.addColorStop(0.6, `rgba(${tintR},${tintG},${tintB},${glare.secondaryOpacity * 0.3})`);
  streak.addColorStop(1,   `rgba(${tintR},${tintG},${tintB},0)`);

  ctx.save();
  ctx.translate(glare.hotspotX, glare.hotspotY);
  ctx.rotate(angleRad);
  ctx.translate(-glare.hotspotX, -glare.hotspotY);

  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.ellipse(
    (glare.hotspotX + streakEndX) / 2,
    (glare.hotspotY + streakEndY) / 2,
    glare.streakLength / 2,
    streakWidth / 2,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  const edgeSheen = ctx.createRadialGradient(
    zone.centerX, zone.centerY - zone.radiusY * 0.6, zone.radiusX * 0.1,
    zone.centerX, zone.centerY, Math.max(zone.radiusX, zone.radiusY)
  );
  edgeSheen.addColorStop(0,    `rgba(${tintR},${tintG},${tintB},0)`);
  edgeSheen.addColorStop(0.75, `rgba(${tintR},${tintG},${tintB},0)`);
  edgeSheen.addColorStop(0.88, `rgba(${tintR},${tintG},${tintB},${glare.secondaryOpacity * 0.6})`);
  edgeSheen.addColorStop(1,    `rgba(${tintR},${tintG},${tintB},0)`);

  ctx.fillStyle = edgeSheen;
  ctx.fillRect(
    zone.centerX - zone.radiusX,
    zone.centerY - zone.radiusY,
    zone.radiusX * 2,
    zone.radiusY * 2
  );

  ctx.restore();
  ctx.restore();
}

export function drawGlare(
  ctx: CanvasRenderingContext2D,
  transform: GlassesTransform,
  headPose: HeadPose,
  lighting: LightingEstimate,
  alphaData: GlassesAlphaData
): void {
  if (lighting.brightness < 0.15) return;

  const zones = getLensZones(transform, alphaData);

  const leftGlare  = computeGlareConfig(zones.left,  lighting, headPose);
  const rightGlare = computeGlareConfig(zones.right, lighting, headPose);

  try {
    ctx.globalCompositeOperation = "screen";
    drawLensGlare(ctx, zones.left,  leftGlare,  transform, headPose);
    drawLensGlare(ctx, zones.right, rightGlare, transform, headPose);
  } finally {
    ctx.globalCompositeOperation = "source-over";
  }
}