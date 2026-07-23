import type { GlassesTransform, HeadPose } from "@/types";

interface WebGLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  texture: WebGLTexture | null;
  currentSrc: string;
  locations: {
    position: number;
    uv: number;
    homography: WebGLUniformLocation;
    sampler: WebGLUniformLocation;
    opacity: WebGLUniformLocation;
    tint: WebGLUniformLocation;
    tintStrength: WebGLUniformLocation;
  };
}

let state: WebGLState | null = null;
let offscreen: HTMLCanvasElement | null = null;

const VERT = `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_uv;
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_sampler;
  uniform mat3 u_homography;
  uniform float u_opacity;
  uniform vec3 u_tint;
  uniform float u_tintStrength;

  void main() {
    vec3 uvh = u_homography * vec3(v_uv.x, v_uv.y, 1.0);
    vec2 uv = uvh.xy / uvh.z;

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      discard;
    }

    vec4 color = texture2D(u_sampler, vec2(uv.x, 1.0 - uv.y));
    color.rgb = mix(color.rgb, u_tint * color.rgb, u_tintStrength);
    color.a *= u_opacity;
    gl_FragColor = color;
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile error");
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link error");
  }
  return program;
}

function getOrCreateState(w: number, h: number): { state: WebGLState; canvas: HTMLCanvasElement } | null {
  if (!offscreen) {
    offscreen = document.createElement("canvas");
  }
  offscreen.width = w;
  offscreen.height = h;

  if (state) {
    state.gl.viewport(0, 0, w, h);
    return { state, canvas: offscreen };
  }

  const gl = offscreen.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const program = createProgram(gl);
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.DYNAMIC_DRAW
  );

  const uvBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
    gl.STATIC_DRAW
  );

  const locations = {
    position:    gl.getAttribLocation(program, "a_position"),
    uv:          gl.getAttribLocation(program, "a_uv"),
    homography:  gl.getUniformLocation(program, "u_homography")!,
    sampler:     gl.getUniformLocation(program, "u_sampler")!,
    opacity:     gl.getUniformLocation(program, "u_opacity")!,
    tint:        gl.getUniformLocation(program, "u_tint")!,
    tintStrength: gl.getUniformLocation(program, "u_tintStrength")!,
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, w, h);

  state = { gl, program, positionBuffer, uvBuffer, texture: null, currentSrc: "", locations };
  return { state, canvas: offscreen };
}

// Nueva función para forzar resoluciones POT (Power of Two)
function makePowerOfTwo(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  
  const isPowerOfTwo = (x: number) => (x & (x - 1)) === 0;
  
  if (isPowerOfTwo(w) && isPowerOfTwo(h)) {
    return img;
  }
  
  const canvas = document.createElement("canvas");
  canvas.width = Math.pow(2, Math.ceil(Math.log2(w)));
  canvas.height = Math.pow(2, Math.ceil(Math.log2(h)));
  
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  
  return img;
}

function loadTexture(gl: WebGLRenderingContext, img: HTMLImageElement, src: string): WebGLTexture {
  if (state && state.currentSrc === src && state.texture) {
    return state.texture;
  }

  if (state?.texture) {
    gl.deleteTexture(state.texture);
  }

  // Convertimos dinámicamente la imagen para que WebGL soporte Mipmaps
  const safeSource = makePowerOfTwo(img);

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  
  // Cargamos el origen optimizado (POT)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, safeSource);
  
  // Reactivamos Mipmaps y antialiasing de alta calidad
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  if (state) {
    state.texture = tex;
    state.currentSrc = src;
  }

  return tex;
}

function buildHomography(
  transform: GlassesTransform,
  headPose: HeadPose,
  displayW: number,
  displayH: number
): Float32Array {
  const { x, y, width, height, rotation, depthScale } = transform;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const rollRad  = (rotation * Math.PI) / 180;
  const yawRad   = (headPose.yaw * Math.PI) / 180;
  const pitchRad = (headPose.pitch * Math.PI) / 180;

  const scaleX = Math.cos(yawRad) * depthScale;
  const scaleY = Math.cos(pitchRad * 0.5) * depthScale;
  const cosR   = Math.cos(rollRad);
  const sinR   = Math.sin(rollRad);

  const shiftX = Math.sin(yawRad)       * width  * 0.18;
  const shiftY = Math.sin(pitchRad * 0.5) * height * 0.12;

  const toU = (px: number) => (px / displayW);
  const toV = (py: number) => (py / displayH);

  const hw = (width  / 2) * scaleX;
  const hh = (height / 2) * scaleY;

  const corners = [
    [cx + (-hw * cosR + hh * sinR) + shiftX, cy + (-hw * sinR - hh * cosR) + shiftY],
    [cx + ( hw * cosR + hh * sinR) + shiftX, cy + ( hw * sinR - hh * cosR) + shiftY],
    [cx + (-hw * cosR - hh * sinR) + shiftX, cy + (-hw * sinR + hh * cosR) + shiftY],
    [cx + ( hw * cosR - hh * sinR) + shiftX, cy + ( hw * sinR + hh * cosR) + shiftY],
  ];

  const src = [[0,0],[1,0],[0,1],[1,1]];
  const dst = corners.map(([px, py]) => [toU(px), toV(py)]);

const h = solveLinear8x8(
    src.flatMap(([sx, sy], i) => {
      const [dx, dy] = dst[i];
      return [
        [sx, sy, 1, 0, 0, 0, -dx*sx, -dx*sy],
        [0, 0, 0, sx, sy, 1, -dy*sx, -dy*sy],
      ];
    }),
    src.flatMap((_, i) => [dst[i][0], dst[i][1]])
  );

  const H = new Float32Array([
    h[0], h[3], h[6],
    h[1], h[4], h[7],
    h[2], h[5], 1.0,
  ]);

  return invertMat3(H);
}

function solveLinear8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }

  return x;
}

function invertMat3(m: Float32Array): Float32Array {
  const [a, b, c, d, e, f, g, h, k] = Array.from(m);

  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return m;

  const inv = 1 / det;
  return new Float32Array([
    (e * k - f * h) * inv, (c * h - b * k) * inv, (b * f - c * e) * inv,
    (f * g - d * k) * inv, (a * k - c * g) * inv, (c * d - a * f) * inv,
    (d * h - e * g) * inv, (b * g - a * h) * inv, (a * e - b * d) * inv,
  ]);
}

function computeTint(
  headPose: HeadPose,
  warmth: number,
  brightness: number
): { tint: [number, number, number]; strength: number } {
  let r = 1.0, g = 1.0, b = 1.0;

  if (warmth > 1.2) {
    r = 1.0;
    g = 0.95 + (warmth - 1.2) * 0.05;
    b = 0.85 - (warmth - 1.2) * 0.1;
  } else if (warmth < 0.85) {
    r = 0.88 + warmth * 0.1;
    g = 0.93;
    b = 1.0;
  }

  const yawAbs = Math.abs(headPose.yaw) / 90;
  const darkening = 1.0 - yawAbs * 0.15;
  r *= darkening;
  g *= darkening;
  b *= darkening;

  const strength = Math.min(0.35, (Math.abs(1 - warmth) * 0.4) + (brightness * 0.05));

  return { tint: [r, g, b], strength };
}

export interface HomographyRenderConfig {
  ctx: CanvasRenderingContext2D;
  glassesImg: HTMLImageElement;
  imageSrc: string;
  transform: GlassesTransform;
  headPose: HeadPose;
  displayW: number;
  displayH: number;
  warmth?: number;
  brightness?: number;
  opacity?: number;
}

export function drawGlassesHomography(config: HomographyRenderConfig): void {
  const {
    ctx,
    glassesImg,
    imageSrc,
    transform,
    headPose,
    displayW,
    displayH,
    warmth = 1.0,
    brightness = 0.6,
    opacity = 1.0,
  } = config;

  const result = getOrCreateState(displayW, displayH);
  if (!result) return;

  const { state: s, canvas: cvs } = result;
  const { gl, locations } = s;

  const tex = loadTexture(gl, glassesImg, imageSrc);

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(s.program);

  gl.bindBuffer(gl.ARRAY_BUFFER, s.positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1.0, -1.0, 
       1.0, -1.0, 
      -1.0,  1.0, 
       1.0,  1.0
    ]),
    gl.DYNAMIC_DRAW
  );
  
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, s.uvBuffer);
  gl.enableVertexAttribArray(locations.uv);
  gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(locations.sampler, 0);

  const H = buildHomography(transform, headPose, displayW, displayH);
  gl.uniformMatrix3fv(locations.homography, false, H);

  gl.uniform1f(locations.opacity, opacity);

  const { tint, strength } = computeTint(headPose, warmth, brightness);
  gl.uniform3fv(locations.tint, tint);
  gl.uniform1f(locations.tintStrength, strength);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  ctx.drawImage(cvs, 0, 0);
}

export function disposeHomographyRenderer(): void {
  if (!state) return;

  const { gl } = state;
  if (state.texture) gl.deleteTexture(state.texture);
  gl.deleteBuffer(state.positionBuffer);
  gl.deleteBuffer(state.uvBuffer);
  gl.deleteProgram(state.program);

  state = null;
  offscreen = null;
}