/*
 * Game of Life: Tribes browser benchmark runner.
 *
 * Usage:
 * 1. Build and serve the app, for example:
 *      pnpm run build
 *      npx http-server docs
 *    or open the published app.
 * 2. Open the app in the browser.
 * 3. Paste this file into DevTools Console, or run it as a DevTools Snippet.
 * 4. Optionally validate the current production UI contract:
 *      await window.goltBenchmarkRunner.preflight()
 * 5. Run:
 *      await window.goltBenchmarkRunner.run()
 *
 * This runner works against the production UI. It explicitly prepares the
 * deterministic toroidal Conway workload used by the published benchmark,
 * drives the same controls a user would use manually, stores a checkpoint
 * after every sample, and downloads JSON plus CSV files when the run finishes
 * or is stopped.
 */
(() => {
  'use strict';

  const CHECKPOINT_KEY = 'golt-benchmark-results-v1';

  const CONFIG = {
    presetName: 'Conway',
    topologyLabel: 'Toroidal',
    runSeconds: 60,
    warmUpSeconds: 5,
    counterSettleSeconds: 2,
    preRunPauseSeconds: 3,
    repeats: 5,
    cooldownSeconds: 30,
    rebuildTimeoutSeconds: 240,
    readyStabilityMs: 300,
    settleAfterClickMs: 150,
    settleAfterStopMs: 1000,
    outputPrefix: 'golt-benchmark-run',
    modes: [
      {id: 'baseline', recording: false},
      {id: 'recording', recording: true}
    ],
    targetedSamples: [],
    grids: [
      {side: 128, packings: [1, 2, 4, 8, 16, 32]},
      {side: 256, packings: [1, 2, 4, 8, 16, 32]},
      {side: 512, packings: [1, 2, 4, 8, 16, 32]},
      {side: 1024, packings: [1, 2, 4, 8, 16, 32]},
      {side: 2048, packings: [1, 2, 4, 8, 16, 32]},
      {side: 4096, packings: [1, 2, 4, 8, 16, 32]},
      {side: 8192, packings: [1, 2, 4, 8, 16, 32]},
      {side: 16384, packings: [1, 2, 4, 8, 16, 32]},
      {side: 32768, packings: [1, 2, 4, 8, 16]},
      {side: 65536, packings: [1, 2, 4]},
      {side: 131072, packings: [1]}
    ]
  };

  const state = {
    stopRequested: false,
    running: false,
    results: [],
    startedAt: null,
    finishedAt: null
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const fileTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

  function dimensionsFor(side, bits) {
    let rows = side;
    if (side === 32768 && bits === 16) {
      rows = 32767;
    } else if (side === 65536 && bits === 4) {
      rows = 65535;
    } else if (side === 131072) {
      rows = 131071;
    }
    return {cols: side, rows};
  }

  function frameBytes(cols, rows, bits) {
    return Math.ceil(cols / (32 / bits)) * rows * 4;
  }

  function required(value, label) {
    if (!value) {
      throw new Error(`Missing UI element: ${label}`);
    }
    return value;
  }

  async function waitFor(predicate, timeoutMs, label) {
    const startedAt = performance.now();
    while (!predicate() && performance.now() - startedAt < timeoutMs) {
      await sleep(100);
    }
    if (!predicate()) {
      throw new Error(`Timed out waiting for ${label}.`);
    }
  }

  async function ensureSidebarOpen() {
    const panel = required(document.querySelector('gol-sidebar .sidebar-panel'), 'sidebar panel');
    if (!panel.classList.contains('open')) {
      required(document.querySelector('gol-sidebar .toggle-btn'), 'sidebar toggle').click();
      await waitFor(() => panel.classList.contains('open'), 2000, 'sidebar open');
    }
  }

  function section(selector) {
    return required(document.querySelector(selector), selector);
  }

  function findButton(root, label) {
    const buttons = Array.from(root.querySelectorAll('button'));
    return buttons.find(button => text(button).includes(label) || button.getAttribute('aria-label') === label) ?? null;
  }

  function hasValidationText(root) {
    return Array.from(root.querySelectorAll('.error-message')).some(item => Boolean(text(item)));
  }

  function hasFrameLimitError(root) {
    return root.querySelector('gol-frame-size-limits .error') !== null;
  }

  async function clickButton(root, label) {
    const button = findButton(root, label);
    let clicked = false;
    if (button && !button.disabled) {
      button.click();
      clicked = true;
      await sleep(CONFIG.settleAfterClickMs);
    }
    return clicked;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) {
      throw new Error('Could not resolve the native HTML input value setter.');
    }
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    input.dispatchEvent(new Event('blur', {bubbles: true}));
  }

  function queryFormControlInput(root, controlName) {
    const host = root.querySelector(`[formcontrolname="${controlName}"]`);
    if (host instanceof HTMLInputElement) {
      return host;
    }
    return host?.querySelector('input') ?? null;
  }

  function formControlInput(root, controlName, label) {
    return required(queryFormControlInput(root, controlName), label);
  }

  function switchFor(label) {
    const toggles = Array.from(section('gol-speed-section').querySelectorAll('mat-slide-toggle'));
    const host = toggles.find(toggle => text(toggle) === label || text(toggle).includes(label));
    return host?.querySelector('[role="switch"]') ?? host?.querySelector('button') ?? null;
  }

  function switchState(label) {
    const button = switchFor(label);
    const checked = button?.getAttribute('aria-checked') === 'true' || button?.classList.contains('mdc-switch--selected') || false;
    const disabled = button?.getAttribute('aria-disabled') === 'true' || button?.hasAttribute('disabled') || false;
    return {found: Boolean(button), checked, disabled};
  }

  async function setSwitch(label, desired) {
    const button = switchFor(label);
    if (!button) {
      throw new Error(`Missing toggle: ${label}`);
    }
    let stateNow = switchState(label);
    if (stateNow.checked !== desired && !stateNow.disabled) {
      button.click();
      await sleep(CONFIG.settleAfterClickMs);
      stateNow = switchState(label);
    }
    return stateNow.checked === desired;
  }

  function topologyOption(label) {
    const grid = section('gol-grid-size-section');
    const control = grid.querySelector('gol-segmented-control[formcontrolname="topology"]') ?? grid.querySelector('gol-segmented-control');
    return Array.from(control?.querySelectorAll('.segmented-option') ?? []).find(option => text(option) === label) ?? null;
  }

  function topologySelected(label) {
    const option = topologyOption(label);
    return option?.getAttribute('aria-checked') === 'true' || option?.classList.contains('active') || false;
  }

  function presetHost(name) {
    const presets = section('gol-presets-section');
    return Array.from(presets.querySelectorAll('gol-preset-button')).find(host => text(host.querySelector('.preset-name')) === name) ?? null;
  }

  function generationRow() {
    const rows = Array.from(section('gol-playback-section').querySelectorAll('gol-label-value'));
    return rows.find(item => text(item.querySelector('.label')) === 'Generation') ?? null;
  }

  function generation() {
    const raw = text(generationRow()?.querySelector('.value'));
    return Number(raw.replace(/[^\d]/g, '') || 0);
  }

  function isRunning() {
    const playback = section('gol-playback-section');
    const pauseButton = findButton(playback, 'Pause');
    return Boolean(pauseButton && !pauseButton.disabled);
  }

  function playbackReady() {
    const playback = document.querySelector('gol-playback-section');
    if (!playback) {
      return false;
    }
    const runButton = findButton(playback, 'Run') ?? findButton(playback, 'Pause');
    return Boolean(runButton && !runButton.disabled);
  }

  async function waitForReady() {
    const startedAt = performance.now();
    let stableSince = null;
    while (performance.now() - startedAt < CONFIG.rebuildTimeoutSeconds * 1000) {
      const now = performance.now();
      if (playbackReady()) {
        stableSince ??= now;
        if (now - stableSince >= CONFIG.readyStabilityMs) {
          return;
        }
      } else {
        stableSince = null;
      }
      await sleep(100);
    }
    throw new Error('Timed out waiting for engine ready.');
  }

  async function forceIdle(settleMs = CONFIG.settleAfterStopMs) {
    await ensureSidebarOpen();
    if (isRunning()) {
      await clickButton(section('gol-playback-section'), 'Pause');
    }
    await setSwitch('Max', false);
    await setSwitch('Rec', false).catch(() => false);
    await setSwitch('Metrics', false);
    await sleep(settleMs);
  }

  async function applyPreset(name) {
    const presets = section('gol-presets-section');
    const host = required(presetHost(name), `${name} preset`);
    const button = required(host.querySelector('button'), `${name} preset button`);
    button.click();
    await sleep(CONFIG.settleAfterClickMs);
    const applied = await clickButton(presets, 'Apply');
    if (!applied) {
      throw new Error(`Could not apply the ${name} preset.`);
    }
    await waitForReady();
  }

  async function setTopology(label) {
    const grid = section('gol-grid-size-section');
    const option = required(topologyOption(label), `${label} topology option`);
    if (!topologySelected(label)) {
      if (option.disabled) {
        throw new Error(`${label} topology is disabled.`);
      }
      option.click();
      await sleep(CONFIG.settleAfterClickMs);
      if (!topologySelected(label)) {
        throw new Error(`Could not select ${label} topology.`);
      }
      const applied = await clickButton(grid, 'Apply');
      if (!applied) {
        throw new Error(`Could not apply ${label} topology.`);
      }
      await waitForReady();
    }
  }

  async function prepareBenchmarkProfile() {
    await forceIdle();
    await applyPreset(CONFIG.presetName);
    await setTopology(CONFIG.topologyLabel);
    await clickButton(section('gol-playback-section'), 'Reset Simulation');
    await waitForReady();
    await setSwitch('Metrics', false);
    await sleep(CONFIG.settleAfterClickMs);
    console.info('[GOLT benchmark] Benchmark profile prepared', {
      preset: CONFIG.presetName,
      topology: CONFIG.topologyLabel
    });
  }

  async function preflight() {
    await ensureSidebarOpen();
    await waitForReady();

    const grid = section('gol-grid-size-section');
    const packing = section('gol-packing-section');
    const playback = section('gol-playback-section');
    const report = {
      url: location.href,
      presetName: CONFIG.presetName,
      topologyLabel: CONFIG.topologyLabel,
      presetFound: Boolean(presetHost(CONFIG.presetName)),
      topologyFound: Boolean(topologyOption(CONFIG.topologyLabel)),
      colsInputFound: Boolean(queryFormControlInput(grid, 'cols')),
      rowsInputFound: Boolean(queryFormControlInput(grid, 'rows')),
      packingOptions: Array.from(packing.querySelectorAll('.exclusive-button')).map(button => text(button)),
      maxToggleFound: switchState('Max').found,
      recordingToggleFound: switchState('Rec').found,
      metricsToggleFound: switchState('Metrics').found,
      playbackButtonFound: Boolean(findButton(playback, 'Run') ?? findButton(playback, 'Pause')),
      resetButtonFound: Boolean(findButton(playback, 'Reset Simulation')),
      generationRowFound: Boolean(generationRow())
    };

    const failures = [
      ['presetFound', report.presetFound],
      ['topologyFound', report.topologyFound],
      ['colsInputFound', report.colsInputFound],
      ['rowsInputFound', report.rowsInputFound],
      ['packingOptions', report.packingOptions.length > 0],
      ['maxToggleFound', report.maxToggleFound],
      ['recordingToggleFound', report.recordingToggleFound],
      ['metricsToggleFound', report.metricsToggleFound],
      ['playbackButtonFound', report.playbackButtonFound],
      ['resetButtonFound', report.resetButtonFound],
      ['generationRowFound', report.generationRowFound]
    ].filter(([, ok]) => !ok).map(([name]) => name);

    if (failures.length > 0) {
      console.error('[GOLT benchmark] Preflight failed', report);
      throw new Error(`Benchmark UI preflight failed: ${failures.join(', ')}.`);
    }

    console.info('[GOLT benchmark] Preflight passed', report);
    return report;
  }

  async function setGridSize(dims) {
    const grid = section('gol-grid-size-section');
    const columnsInput = formControlInput(grid, 'cols', 'grid cols input');
    const rowsInput = formControlInput(grid, 'rows', 'grid rows input');
    setInputValue(columnsInput, dims.cols);
    setInputValue(rowsInput, dims.rows);
    await sleep(CONFIG.settleAfterClickMs);
    const applied = await clickButton(grid, 'Apply');
    let status;
    if (applied) {
      await waitForReady();
      status = {supported: true, reason: ''};
    } else if (
      Number(columnsInput.value) === dims.cols &&
      Number(rowsInput.value) === dims.rows &&
      !hasValidationText(grid) &&
      !hasFrameLimitError(grid)
    ) {
      status = {supported: true, reason: ''};
    } else {
      status = {supported: false, reason: `Grid size ${dims.cols}x${dims.rows} is not supported or cannot be applied.`};
    }
    return status;
  }

  async function setPacking(bits) {
    const packing = section('gol-packing-section');
    const option = Array.from(packing.querySelectorAll('.exclusive-button')).find(button => text(button) === String(bits));
    let status;
    if (!option || option.disabled) {
      status = {supported: false, reason: `${bits}-bit packing is disabled.`};
    } else {
      option.click();
      await sleep(CONFIG.settleAfterClickMs);
      const applied = await clickButton(packing, 'Apply');
      if (applied) {
        await waitForReady();
        status = {supported: true, reason: ''};
      } else if (option.classList.contains('active') && !hasFrameLimitError(packing)) {
        status = {supported: true, reason: ''};
      } else {
        status = {supported: false, reason: `${bits}-bit packing is not supported for this grid.`};
      }
    }
    return status;
  }

  async function setRunning(running) {
    if (isRunning() !== running) {
      const clicked = await clickButton(section('gol-playback-section'), running ? 'Run' : 'Pause');
      if (!clicked) {
        throw new Error(`Could not ${running ? 'start' : 'pause'} the simulation.`);
      }
    }
  }

  function recordingUnavailableReason() {
    const stateNow = switchState('Rec');
    const speed = section('gol-speed-section');
    const gateMessage = text(speed.querySelector('.warning-message'));
    let reason = '';
    if (stateNow.disabled && !stateNow.checked) {
      if (gateMessage.includes('Grid is too large for recording.')) {
        reason = 'Recording is unavailable for this grid and bit packing.';
      } else if (gateMessage.includes('Not enough browser storage for one frame.')) {
        reason = 'Recording is unavailable because browser storage cannot hold one frame.';
      } else {
        reason = `Recording is unavailable: ${gateMessage || 'recording control is disabled.'}`;
      }
    }
    return reason;
  }

  async function setPackingAndGrid(bits, dims) {
    let packingStatus = await setPacking(bits);
    let gridStatus = {supported: false, reason: ''};

    if (packingStatus.supported) {
      gridStatus = await setGridSize(dims);
    } else {
      gridStatus = await setGridSize(dims);
      if (gridStatus.supported) {
        packingStatus = await setPacking(bits);
      }
    }

    if (packingStatus.supported && !gridStatus.supported) {
      packingStatus = await setPacking(bits);
      if (packingStatus.supported) {
        gridStatus = await setGridSize(dims);
      }
    }

    return packingStatus.supported && gridStatus.supported
      ? {supported: true, reason: ''}
      : {supported: false, reason: packingStatus.supported ? gridStatus.reason : packingStatus.reason};
  }

  async function configureSample(sample) {
    const dims = dimensionsFor(sample.side, sample.bits);
    const bytes = frameBytes(dims.cols, dims.rows, sample.bits);
    await forceIdle();

    const sizeStatus = await setPackingAndGrid(sample.bits, dims);
    let setup = {
      supported: sizeStatus.supported,
      reason: sizeStatus.reason,
      cols: dims.cols,
      rows: dims.rows,
      frameBytes: bytes
    };

    if (setup.supported) {
      const reset = await clickButton(section('gol-playback-section'), 'Reset Simulation');
      if (!reset) {
        throw new Error('Could not reset the simulation before the benchmark sample.');
      }
      await waitForReady();
      await setSwitch('Metrics', false);
      await sleep(CONFIG.settleAfterClickMs);

      if (sample.mode.recording) {
        const unavailableReason = recordingUnavailableReason();
        if (unavailableReason) {
          setup = {...setup, supported: false, reason: unavailableReason};
        }
      }

      if (setup.supported) {
        const recordingReached = await setSwitch('Rec', sample.mode.recording).catch(() => false);
        if (sample.mode.recording && !recordingReached) {
          setup = {
            ...setup,
            supported: false,
            reason: recordingUnavailableReason() || 'Recording is unavailable for this grid and bit packing.'
          };
        }
      }

      if (setup.supported) {
        const maxReached = await setSwitch('Max', true);
        if (!maxReached) {
          throw new Error('Could not enable max-speed mode.');
        }
      }
    }

    return setup;
  }

  async function runSample(sample) {
    const setup = await configureSample(sample);
    const startedAt = new Date().toISOString();
    let result;

    if (setup.supported) {
      await setRunning(true);
      await sleep(CONFIG.warmUpSeconds * 1000);
      await setRunning(false);
      await sleep(CONFIG.counterSettleSeconds * 1000);
      const startGeneration = generation();
      await sleep(CONFIG.preRunPauseSeconds * 1000);
      await setRunning(true);
      await sleep(CONFIG.runSeconds * 1000);
      await setRunning(false);
      await sleep(CONFIG.counterSettleSeconds * 1000);
      const endGeneration = generation();
      const elapsedGenerations = Math.max(0, endGeneration - startGeneration);
      result = {
        ...baseResult(sample, setup, startedAt),
        endedAt: new Date().toISOString(),
        status: 'ok',
        reason: '',
        startGeneration,
        endGeneration,
        elapsedGenerations,
        seconds: CONFIG.runSeconds,
        genPerSecond: elapsedGenerations / CONFIG.runSeconds
      };
    } else {
      result = buildUnsupportedResult(sample, setup, startedAt, setup.reason);
    }

    await forceIdle(result.status === 'ok' ? 0 : CONFIG.settleAfterStopMs);
    return result;
  }

  function baseResult(sample, setup, startedAt) {
    return {
      gridSide: sample.side,
      cols: setup.cols,
      rows: setup.rows,
      bitPacking: sample.bits,
      mode: sample.mode.id,
      recording: sample.mode.recording,
      repeat: sample.repeat,
      frameBytes: setup.frameBytes,
      warmUpSeconds: CONFIG.warmUpSeconds,
      counterSettleSeconds: CONFIG.counterSettleSeconds,
      preRunPauseSeconds: CONFIG.preRunPauseSeconds,
      startedAt
    };
  }

  function buildUnsupportedResult(sample, setup, startedAt, reason) {
    const currentGeneration = generation();
    return {
      ...baseResult(sample, setup, startedAt),
      endedAt: new Date().toISOString(),
      status: 'unsupported',
      reason,
      startGeneration: currentGeneration,
      endGeneration: currentGeneration,
      elapsedGenerations: 0,
      seconds: 0,
      genPerSecond: null
    };
  }

  function buildPlan() {
    const plan = [];
    const modeById = new Map(CONFIG.modes.map(mode => [mode.id, mode]));
    if (CONFIG.targetedSamples.length > 0) {
      for (const target of CONFIG.targetedSamples) {
        for (const modeId of target.modes) {
          const mode = modeById.get(modeId);
          if (mode) {
            for (let repeat = 1; repeat <= CONFIG.repeats; repeat++) {
              plan.push({side: target.side, bits: target.bits, mode, repeat});
            }
          }
        }
      }
    } else {
      for (const grid of CONFIG.grids) {
        for (const bits of grid.packings) {
          for (const mode of CONFIG.modes) {
            for (let repeat = 1; repeat <= CONFIG.repeats; repeat++) {
              plan.push({side: grid.side, bits, mode, repeat});
            }
          }
        }
      }
    }
    return plan;
  }

  function average(values) {
    let value = null;
    if (values.length > 0) {
      value = values.reduce((sum, next) => sum + next, 0) / values.length;
    }
    return value;
  }

  function buildSummary(results) {
    const groups = new Map();
    for (const result of results) {
      const key = `${result.gridSide}|${result.cols}|${result.rows}|${result.bitPacking}`;
      if (!groups.has(key)) {
        groups.set(key, {
          gridSide: result.gridSide,
          cols: result.cols,
          rows: result.rows,
          bitPacking: result.bitPacking,
          baseline: [],
          recording: []
        });
      }
      if (result.status === 'ok' && typeof result.genPerSecond === 'number') {
        groups.get(key)[result.mode].push(result.genPerSecond);
      }
    }
    return Array.from(groups.values()).map(group => ({
      gridSide: group.gridSide,
      cols: group.cols,
      rows: group.rows,
      bitPacking: group.bitPacking,
      genPerSecond: average(group.baseline),
      genPerSecondWithRecording: average(group.recording)
    }));
  }

  function runtimeMetadata() {
    return {
      url: location.href,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGiB: navigator.deviceMemory ?? null,
      language: navigator.language
    };
  }

  function checkpointPayload() {
    return {
      config: CONFIG,
      runtime: runtimeMetadata(),
      state: {
        startedAt: state.startedAt,
        finishedAt: state.finishedAt,
        running: state.running,
        stopRequested: state.stopRequested
      },
      results: state.results,
      summary: buildSummary(state.results)
    };
  }

  function saveCheckpoint() {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpointPayload()));
  }

  function readCheckpoint() {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function csvField(value) {
    let field = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(field)) {
      field = `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  function toCsv(rows, columns) {
    return `${[
      columns.map(csvField).join(','),
      ...rows.map(row => columns.map(column => csvField(row[column])).join(','))
    ].join('\n')}\n`;
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadPayload(payload) {
    const timestamp = fileTimestamp();
    downloadText(`${CONFIG.outputPrefix}-${timestamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    downloadText(
      `${CONFIG.outputPrefix}-samples-${timestamp}.csv`,
      toCsv(payload.results, [
        'gridSide',
        'cols',
        'rows',
        'bitPacking',
        'mode',
        'repeat',
        'status',
        'reason',
        'frameBytes',
        'warmUpSeconds',
        'counterSettleSeconds',
        'preRunPauseSeconds',
        'startGeneration',
        'endGeneration',
        'elapsedGenerations',
        'seconds',
        'genPerSecond',
        'startedAt',
        'endedAt'
      ]),
      'text/csv'
    );
    downloadText(
      `${CONFIG.outputPrefix}-summary-${timestamp}.csv`,
      toCsv(payload.summary, [
        'gridSide',
        'cols',
        'rows',
        'bitPacking',
        'genPerSecond',
        'genPerSecondWithRecording'
      ]),
      'text/csv'
    );
  }

  function downloadResults() {
    downloadPayload({
      config: CONFIG,
      runtime: runtimeMetadata(),
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      results: state.results,
      summary: buildSummary(state.results)
    });
  }

  function downloadCheckpoint() {
    const checkpoint = readCheckpoint();
    if (checkpoint) {
      downloadPayload({
        config: checkpoint.config,
        runtime: checkpoint.runtime,
        startedAt: checkpoint.state.startedAt,
        finishedAt: checkpoint.state.finishedAt,
        results: checkpoint.results,
        summary: checkpoint.summary
      });
    } else {
      console.warn('[GOLT benchmark] No checkpoint found.');
    }
  }

  function requestStop() {
    state.stopRequested = true;
    saveCheckpoint();
  }

  async function run() {
    if (state.running) {
      throw new Error('Benchmark is already running.');
    }

    await preflight();
    state.stopRequested = false;
    state.running = true;
    state.results = [];
    state.startedAt = new Date().toISOString();
    state.finishedAt = null;
    saveCheckpoint();

    try {
      await prepareBenchmarkProfile();
      const plan = buildPlan();
      for (let index = 0; index < plan.length; index++) {
        const sample = plan[index];
        if (state.stopRequested) {
          break;
        }

        console.info('[GOLT benchmark] Starting sample', {
          index: index + 1,
          total: plan.length,
          preset: CONFIG.presetName,
          topology: CONFIG.topologyLabel,
          grid: sample.side,
          bits: sample.bits,
          mode: sample.mode.id,
          repeat: sample.repeat
        });

        let result;
        try {
          result = await runSample(sample);
        } catch (error) {
          await forceIdle().catch(() => undefined);
          const dims = dimensionsFor(sample.side, sample.bits);
          const currentGeneration = generation();
          result = {
            gridSide: sample.side,
            ...dims,
            bitPacking: sample.bits,
            mode: sample.mode.id,
            recording: sample.mode.recording,
            repeat: sample.repeat,
            frameBytes: frameBytes(dims.cols, dims.rows, sample.bits),
            warmUpSeconds: CONFIG.warmUpSeconds,
            counterSettleSeconds: CONFIG.counterSettleSeconds,
            preRunPauseSeconds: CONFIG.preRunPauseSeconds,
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            status: 'failed',
            reason: error?.message ?? String(error),
            startGeneration: currentGeneration,
            endGeneration: currentGeneration,
            elapsedGenerations: 0,
            seconds: 0,
            genPerSecond: null
          };
        }

        state.results.push(result);
        saveCheckpoint();
        console.info('[GOLT benchmark] Finished sample', result);

        if (!state.stopRequested && result.status !== 'unsupported' && index < plan.length - 1) {
          const cooldownSeconds = result.status === 'ok'
            ? Math.max(0, CONFIG.cooldownSeconds - CONFIG.counterSettleSeconds)
            : CONFIG.cooldownSeconds;
          console.info(`[GOLT benchmark] Cooling down for ${cooldownSeconds}s more`);
          await sleep(cooldownSeconds * 1000);
        }
      }
    } finally {
      await forceIdle().catch(() => undefined);
      state.running = false;
      state.finishedAt = new Date().toISOString();
      saveCheckpoint();
      downloadResults();
    }

    return state.results;
  }

  window.goltBenchmarkRunner = {
    config: CONFIG,
    preflight,
    prepare: prepareBenchmarkProfile,
    run,
    stop: requestStop,
    checkpoint: readCheckpoint,
    downloadCheckpoint
  };

  console.info(
    'GOLT production benchmark runner loaded. Validate with: ' +
    'await window.goltBenchmarkRunner.preflight(); then run: ' +
    'await window.goltBenchmarkRunner.run()'
  );
})();
