let currentSurface = null;

const inputs = {
  thicknessUnit: document.getElementById("thicknessUnit"),
  lengthUnit: document.getElementById("lengthUnit"),
  exportCoordUnit: document.getElementById("exportCoordUnit"),
  exportThicknessUnit: document.getElementById("exportThicknessUnit"),
  h0: document.getElementById("h0"),
  rq: document.getElementById("rq"),
  lxDomain: document.getElementById("lxDomain"),
  lyDomain: document.getElementById("lyDomain"),
  corrX: document.getElementById("corrX"),
  corrY: document.getElementById("corrY"),
  gridSize: document.getElementById("gridSize"),
  seed: document.getElementById("seed"),
};

const previewCanvas = document.getElementById("previewCanvas");
const statsBox = document.getElementById("surfaceStats");
const dataStatus = document.getElementById("dataStatus");

const generateDataButton = document.getElementById("generateData");
const renderPreviewButton = document.getElementById("renderPreview");
const downloadCsvButton = document.getElementById("downloadCsv");
const downloadTxtButton = document.getElementById("downloadTxt");

const mathDialog = document.getElementById("mathDialog");
const openMathDialog = document.getElementById("openMathDialog");
const closeMathDialog = document.getElementById("closeMathDialog");

const parameterFigure = document.getElementById("parameterFigure");
const openParameterFigure = document.getElementById("openParameterFigure");
const parameterFigureDialog = document.getElementById("parameterFigureDialog");
const closeParameterFigure = document.getElementById("closeParameterFigure");

openMathDialog.addEventListener("click", () => mathDialog.showModal());
closeMathDialog.addEventListener("click", () => mathDialog.close());

generateDataButton.addEventListener("click", async () => {
  setStatus("Generating surface data...", "loading");
  setBusy(true);

  await waitForPaint();

  try {
    const config = readConfig();
    validateConfig(config);

    currentSurface = generateSurface(config);

    clearPreview();
    updateStats(currentSurface);
    setDownloadsEnabled(true);
    renderPreviewButton.disabled = false;

    setStatus(
      `Surface data generated successfully. Accepted seed: ${currentSurface.meta.accepted_seed}.`,
      "success"
    );
  } catch (error) {
    currentSurface = null;
    setDownloadsEnabled(false);
    renderPreviewButton.disabled = true;
    clearPreview();
    statsBox.textContent = "Generation failed. Please adjust the input parameters.";
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
});

renderPreviewButton.addEventListener("click", async () => {
  if (!currentSurface) return;

  setStatus("Rendering 3D preview...", "loading");
  renderPreviewButton.disabled = true;

  await waitForPaint();

  draw3DPreview(currentSurface);

  renderPreviewButton.disabled = false;
  setStatus("3D preview rendered. Downloads are available below the preview.", "success");
});

downloadCsvButton.addEventListener("click", () => {
  if (!currentSurface) return;
  downloadFile("hsurf_comsol.csv", surfaceToCsv(currentSurface), "text/csv");
});

downloadTxtButton.addEventListener("click", () => {
  if (!currentSurface) return;
  downloadFile("hsurf_comsol.txt", surfaceToTxt(currentSurface), "text/plain");
});

let previousThicknessUnit = inputs.thicknessUnit.value;
let previousLengthUnit = inputs.lengthUnit.value;

inputs.thicknessUnit.addEventListener("change", () => {
  convertInputValue(inputs.h0, previousThicknessUnit, inputs.thicknessUnit.value);
  convertInputValue(inputs.rq, previousThicknessUnit, inputs.thicknessUnit.value);
  previousThicknessUnit = inputs.thicknessUnit.value;
});

inputs.lengthUnit.addEventListener("change", () => {
  convertInputValue(inputs.lxDomain, previousLengthUnit, inputs.lengthUnit.value);
  convertInputValue(inputs.lyDomain, previousLengthUnit, inputs.lengthUnit.value);
  convertInputValue(inputs.corrX, previousLengthUnit, inputs.lengthUnit.value);
  convertInputValue(inputs.corrY, previousLengthUnit, inputs.lengthUnit.value);
  previousLengthUnit = inputs.lengthUnit.value;
});

openParameterFigure.addEventListener("click", () => {
  parameterFigureDialog.showModal();
});

parameterFigure.addEventListener("dblclick", () => {
  parameterFigureDialog.showModal();
});

closeParameterFigure.addEventListener("click", () => {
  parameterFigureDialog.close();
});

parameterFigureDialog.addEventListener("click", event => {
  if (event.target === parameterFigureDialog) {
    parameterFigureDialog.close();
  }
});

function convertInputValue(inputElement, fromUnit, toUnit) {
  const value = Number(inputElement.value);

  if (!Number.isFinite(value)) return;

  const valueInMetres = value * unitToMetres(fromUnit);
  const converted = valueInMetres / unitToMetres(toUnit);

  inputElement.value = formatConvertedInput(converted);
}

function formatConvertedInput(value) {
  if (Math.abs(value) >= 100) return value.toFixed(3).replace(/\.?0+$/, "");
  if (Math.abs(value) >= 1) return value.toFixed(4).replace(/\.?0+$/, "");
  return value.toPrecision(4).replace(/\.?0+$/, "");
}

function thicknessUnitToMetres(unit) {
  if (unit === "um") return 1e-6;
  if (unit === "mm") return 1e-3;
  throw new Error("Unsupported thickness unit.");
}

function lengthUnitToMetres(unit) {
  if (unit === "mm") return 1e-3;
  if (unit === "cm") return 1e-2;
  if (unit === "m") return 1;
  throw new Error("Unsupported length unit.");
}

function readConfig() {
  const thicknessFactor = unitToMetres(inputs.thicknessUnit.value);
  const lengthFactor = unitToMetres(inputs.lengthUnit.value);

  return {
    h0Input: Number(inputs.h0.value),
    rqInput: Number(inputs.rq.value),
    lxDomainInput: Number(inputs.lxDomain.value),
    lyDomainInput: Number(inputs.lyDomain.value),
    corrXInput: Number(inputs.corrX.value),
    corrYInput: Number(inputs.corrY.value),

    h0M: Number(inputs.h0.value) * thicknessFactor,
    rqM: Number(inputs.rq.value) * thicknessFactor,
    lxDomainM: Number(inputs.lxDomain.value) * lengthFactor,
    lyDomainM: Number(inputs.lyDomain.value) * lengthFactor,
    corrXM: Number(inputs.corrX.value) * lengthFactor,
    corrYM: Number(inputs.corrY.value) * lengthFactor,

    thicknessUnit: inputs.thicknessUnit.value,
    lengthUnit: inputs.lengthUnit.value,
    n: Number(inputs.gridSize.value),
    seed: Number(inputs.seed.value),
  };
}

function validateConfig(config) {
  const {
    h0M,
    rqM,
    lxDomainM,
    lyDomainM,
    corrXM,
    corrYM,
    n,
  } = config;

  if (!Number.isFinite(h0M) || h0M < 20e-6 || h0M > 2000e-6) {
    throw new Error("Mean thickness h₀ must be between 20 and 2000 µm.");
  }

  if (!Number.isFinite(rqM) || rqM < 0) {
    throw new Error("RMS roughness Rq must be zero or positive.");
  }

  const eta = rqM / h0M;

  if (eta > 0.30) {
    throw new Error(
      "Rq/h₀ is too large. Reduce Rq or increase h₀. For physical coating fields, try η = Rq/h₀ ≤ 0.20."
    );
  }

  if (!Number.isFinite(lxDomainM) || lxDomainM < 1e-3 || lxDomainM > 500e-3) {
    throw new Error("Domain length Lx must be between 1 and 500 mm.");
  }

  if (!Number.isFinite(lyDomainM) || lyDomainM < 1e-3 || lyDomainM > 500e-3) {
    throw new Error("Domain width Ly must be between 1 and 500 mm.");
  }

  if (!Number.isFinite(corrXM) || corrXM <= 0) {
    throw new Error("x-direction correlation length ℓx must be greater than zero.");
  }

  if (!Number.isFinite(corrYM) || corrYM <= 0) {
    throw new Error("y-direction correlation length ℓy must be greater than zero.");
  }

  if (!isPowerOfTwo(n)) {
    throw new Error("Grid size must be a power of two for FFT-based generation.");
  }

  const dxM = lxDomainM / (n - 1);
  const dyM = lyDomainM / (n - 1);

  if (corrXM < 2 * dxM) {
    throw new Error(
      `ℓx is too small for the selected grid. Increase ℓx or use a finer grid. Current grid spacing Δx ≈ ${(dxM * 1e3).toFixed(3)} mm.`
    );
  }

  if (corrYM < 2 * dyM) {
    throw new Error(
      `ℓy is too small for the selected grid. Increase ℓy or use a finer grid. Current grid spacing Δy ≈ ${(dyM * 1e3).toFixed(3)} mm.`
    );
  }
}

function generateSurface(config) {
  const h0 = config.h0M;
  const rq = config.rqM;
  const lxDomain = config.lxDomainM;
  const lyDomain = config.lyDomainM;
  const corrX = config.corrXM;
  const corrY = config.corrYM;
  const n = config.n;

  const minAllowed = 0.10 * h0;
  const maxAllowed = 2.00 * h0;
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = config.seed + attempt;
    const candidate = buildSurface({
      h0,
      rq,
      lxDomain,
      lyDomain,
      corrX,
      corrY,
      n,
      seed: attemptSeed,
    });

    const values = candidate.h.flat();
    const minH = Math.min(...values);
    const maxH = Math.max(...values);

    if (minH >= minAllowed && maxH <= maxAllowed) {
      candidate.meta.accepted_seed = attemptSeed;
      candidate.meta.lower_physical_limit_m = minAllowed;
      candidate.meta.upper_physical_limit_m = maxAllowed;
      candidate.meta.input_thickness_unit = config.thicknessUnit;
      candidate.meta.input_length_unit = config.lengthUnit;
      return candidate;
    }
  }

  throw new Error(
    "The requested roughness produced physically unrealistic local thickness after several attempts. Reduce Rq, increase h₀, or use longer correlation lengths."
  );
}

function buildSurface({ h0, rq, lxDomain, lyDomain, corrX, corrY, n, seed }) {
  const random = seededRandom(seed);

  const dx = lxDomain / (n - 1);
  const dy = lyDomain / (n - 1);

  const real = new Array(n);
  const imag = new Array(n);

  for (let j = 0; j < n; j++) {
    real[j] = new Array(n);
    imag[j] = new Array(n);

    for (let i = 0; i < n; i++) {
      real[j][i] = gaussianRandom(random);
      imag[j][i] = 0;
    }
  }

  fft2D(real, imag, false);

  for (let j = 0; j < n; j++) {
    const ky = waveNumber(j, n, dy);

    for (let i = 0; i < n; i++) {
      const kx = waveNumber(i, n, dx);

      const filter = Math.exp(
        -0.5 * ((kx * corrX) ** 2 + (ky * corrY) ** 2)
      );

      real[j][i] *= filter;
      imag[j][i] *= filter;
    }
  }

  fft2D(real, imag, true);

  const field = real;
  const flatField = field.flat();
  const meanField = average(flatField);

  const centered = field.map(row => row.map(value => value - meanField));
  const centeredFlat = centered.flat();
  const rms = Math.sqrt(average(centeredFlat.map(value => value * value)));

  const scale = rms > 0 ? rq / rms : 0;
  const h = centered.map(row => row.map(value => h0 + value * scale));

  const values = h.flat();
  const meanH = average(values);
  const rqAchieved = Math.sqrt(average(values.map(value => (value - meanH) ** 2)));

  return {
    x: Array.from({ length: n }, (_, i) => i * dx),
    y: Array.from({ length: n }, (_, j) => j * dy),
    h,
    meta: {
      generator: "Corrosion Atlas browser random surface generator",
      method: "FFT-based anisotropic Gaussian random field",
      h0_m: h0,
      rq_target_m: rq,
      rq_achieved_m: rqAchieved,
      lx_domain_m: lxDomain,
      ly_domain_m: lyDomain,
      corr_x_m: corrX,
      corr_y_m: corrY,
      anisotropy_alpha: corrX / corrY,
      normalized_roughness_eta: rq / h0,
      grid_size: n,
      requested_seed: seed,
      min_thickness_m: Math.min(...values),
      max_thickness_m: Math.max(...values),
      mean_thickness_m: meanH,
    },
  };
}

function draw3DPreview(surface) {
  const canvas = previewCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const n = surface.h.length;
  const values = surface.h.flat();
  const minH = Math.min(...values);
  const maxH = Math.max(...values);
  const range = maxH - minH || 1;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(16, 41, 58, 0.22)";
  ctx.lineWidth = 1;

  const step = Math.max(1, Math.floor(n / 38));

  function project(i, j) {
    const nx = i / (n - 1) - 0.5;
    const ny = j / (n - 1) - 0.5;
    const z = (surface.h[j][i] - minH) / range - 0.5;

    return {
      x: width / 2 + (nx - ny) * width * 0.55,
      y: height * 0.62 + (nx + ny) * height * 0.23 - z * height * 0.32,
    };
  }

  for (let j = 0; j < n; j += step) {
    ctx.beginPath();

    for (let i = 0; i < n; i += step) {
      const p = project(i, j);

      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }

    ctx.stroke();
  }

  for (let i = 0; i < n; i += step) {
    ctx.beginPath();

    for (let j = 0; j < n; j += step) {
      const p = project(i, j);

      if (j === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }

    ctx.stroke();
  }

  ctx.fillStyle = "rgba(185, 77, 30, 0.92)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("Approximate 3D preview of generated coating thickness field", 22, 30);

  ctx.fillStyle = "rgba(16, 41, 58, 0.68)";
  ctx.fillText(
    `min ${(minH * 1e6).toFixed(1)} µm · max ${(maxH * 1e6).toFixed(1)} µm`,
    22,
    52
  );
}

function clearPreview() {
  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  ctx.fillStyle = "rgba(16, 41, 58, 0.58)";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText("Generate surface data first, then render the 3D preview.", 24, 40);
}

function updateStats(surface) {
  const m = surface.meta;

  statsBox.innerHTML = `
    <strong>Generated field summary</strong><br>
    Generated mean thickness <span class="math"><var>h</var><sub class="sub-upright">0</sub></span>:
    ${(m.mean_thickness_m * 1e6).toFixed(2)} µm<br>
    Minimum thickness: ${(m.min_thickness_m * 1e6).toFixed(2)} µm<br>
    Maximum thickness: ${(m.max_thickness_m * 1e6).toFixed(2)} µm<br>
    Target <span class="math"><var>R</var><sub class="sub-upright">q</sub></span>:
    ${(m.rq_target_m * 1e6).toFixed(2)} µm<br>

    Achieved <span class="math"><var>R</var><sub class="sub-upright">q</sub></span>:
    ${(m.rq_achieved_m * 1e6).toFixed(2)} µm<br>

    Normalized roughness
    <span class="math">
    <var>η</var> =
    <var>R</var><sub class="sub-upright">q</sub>/<var>h</var><sub class="sub-upright">0</sub>
    </span>:
    ${m.normalized_roughness_eta.toFixed(4)}<br>

    Anisotropy
    <span class="math">
    <var>α</var> =
    <var>&ell;</var><sub><var>x</var></sub>/<var>&ell;</var><sub><var>y</var></sub>
    </span>:
    ${m.anisotropy_alpha.toFixed(3)}<br>
    Grid size: ${m.grid_size} × ${m.grid_size}
  `;
}

function surfaceToCsv(surface) {
  const coordUnit = inputs.exportCoordUnit.value;
  const thicknessUnit = inputs.exportThicknessUnit.value;

  const coordFactor = metresToUnitFactor(coordUnit);
  const thicknessFactor = metresToUnitFactor(thicknessUnit);

  const coordHeader = unitHeader(coordUnit);
  const thicknessHeader = unitHeader(thicknessUnit);

  const lines = [`x_${coordHeader},y_${coordHeader},h_${thicknessHeader}`];

  for (let j = 0; j < surface.y.length; j++) {
    for (let i = 0; i < surface.x.length; i++) {
      lines.push(
        `${surface.x[i] * coordFactor},${surface.y[j] * coordFactor},${surface.h[j][i] * thicknessFactor}`
      );
    }
  }

  return lines.join("\n");
}

function surfaceToTxt(surface) {
  const coordUnit = inputs.exportCoordUnit.value;
  const thicknessUnit = inputs.exportThicknessUnit.value;

  const coordFactor = metresToUnitFactor(coordUnit);
  const thicknessFactor = metresToUnitFactor(thicknessUnit);

  const coordHeader = unitHeader(coordUnit);
  const thicknessHeader = unitHeader(thicknessUnit);

  const lines = [`% x_${coordHeader} y_${coordHeader} h_${thicknessHeader}`];

  for (let j = 0; j < surface.y.length; j++) {
    for (let i = 0; i < surface.x.length; i++) {
      lines.push(
        `${surface.x[i] * coordFactor} ${surface.y[j] * coordFactor} ${surface.h[j][i] * thicknessFactor}`
      );
    }
  }

  return lines.join("\n");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function setDownloadsEnabled(enabled) {
  downloadCsvButton.disabled = !enabled;
  downloadTxtButton.disabled = !enabled;
}

function setBusy(isBusy) {
  generateDataButton.disabled = isBusy;
}

function setStatus(message, type) {
  dataStatus.textContent = message;
  dataStatus.classList.remove("is-loading", "is-success", "is-error");

  if (type === "loading") dataStatus.classList.add("is-loading");
  if (type === "success") dataStatus.classList.add("is-success");
  if (type === "error") dataStatus.classList.add("is-error");
}

function waitForPaint() {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function seededRandom(seed) {
  let value = Math.floor(seed) % 2147483647;
  if (value <= 0) value += 2147483646;

  return function () {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function gaussianRandom(random) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function waveNumber(index, n, spacing) {
  const frequencyIndex = index <= n / 2 ? index : index - n;
  return 2 * Math.PI * frequencyIndex / (n * spacing);
}

function fft2D(real, imag, inverse) {
  const n = real.length;

  for (let j = 0; j < n; j++) {
    fft1D(real[j], imag[j], inverse);
  }

  for (let i = 0; i < n; i++) {
    const columnReal = new Array(n);
    const columnImag = new Array(n);

    for (let j = 0; j < n; j++) {
      columnReal[j] = real[j][i];
      columnImag[j] = imag[j][i];
    }

    fft1D(columnReal, columnImag, inverse);

    for (let j = 0; j < n; j++) {
      real[j][i] = columnReal[j];
      imag[j][i] = columnImag[j];
    }
  }
}

function fft1D(real, imag, inverse) {
  const n = real.length;

  if (!isPowerOfTwo(n)) {
    throw new Error("FFT grid size must be a power of two.");
  }

  let j = 0;

  for (let i = 1; i < n; i++) {
    let bit = n >> 1;

    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }

    j ^= bit;

    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const wLengthReal = Math.cos(angle);
    const wLengthImag = Math.sin(angle);

    for (let i = 0; i < n; i += length) {
      let wReal = 1;
      let wImag = 0;

      for (let k = 0; k < length / 2; k++) {
        const evenIndex = i + k;
        const oddIndex = i + k + length / 2;

        const oddReal =
          real[oddIndex] * wReal - imag[oddIndex] * wImag;
        const oddImag =
          real[oddIndex] * wImag + imag[oddIndex] * wReal;

        const evenReal = real[evenIndex];
        const evenImag = imag[evenIndex];

        real[evenIndex] = evenReal + oddReal;
        imag[evenIndex] = evenImag + oddImag;

        real[oddIndex] = evenReal - oddReal;
        imag[oddIndex] = evenImag - oddImag;

        const nextWReal =
          wReal * wLengthReal - wImag * wLengthImag;
        const nextWImag =
          wReal * wLengthImag + wImag * wLengthReal;

        wReal = nextWReal;
        wImag = nextWImag;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function unitToMetres(unit) {
  if (unit === "um") return 1e-6;
  if (unit === "mm") return 1e-3;
  if (unit === "cm") return 1e-2;
  if (unit === "m") return 1;
  throw new Error(`Unsupported unit: ${unit}`);
}

function metresToUnitFactor(unit) {
  if (unit === "um") return 1e6;
  if (unit === "mm") return 1e3;
  if (unit === "cm") return 1e2;
  if (unit === "m") return 1;
  throw new Error(`Unsupported unit: ${unit}`);
}

function unitHeader(unit) {
  if (unit === "um") return "um";
  return unit;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

clearPreview();