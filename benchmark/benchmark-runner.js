/*
 * Game of Life: Tribes browser benchmark runner.
 *
 * Usage:
 * 1. Build and serve the app, for example:
 *      pnpm run build
 *      npx http-server docs
 *    or run the development server if desired.
 * 2. Open the app in the browser.
 * 3. Paste this file into DevTools Console, or run it as a DevTools Snippet.
 * 4. Run:
 *      await window.goltBenchmarkRunner.run()
 *
 * This runner works against the production UI. It drives the same controls a
 * user would use manually, stores a checkpoint after every sample, and
 * downloads JSON plus CSV files when the run finishes or is stopped.
 */
(() => {
  'use strict';

  const CHECKPOINT_KEY = 'golt-benchmark-results-v1';

  const CONFIG = {
    runSeconds: 60,
    warmUpSeconds: 5,
    counterSettleSeconds: 2,
    preRunPauseSeconds: 3,
    repeats: 5,
    cooldownSeconds: 30,
    rebuildTimeoutSeconds: 240,
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

  /**
   * Returns the adjusted dimensions used in the README benchmark table.
   *
   * @param {number} side Requested side.
   * @param {number} bits Bit packing.
   * @returns {{cols: number; rows: number}} Dimensions.
   */
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

  /**
   * Computes one packed frame size.
   *
   * @param {number} cols Grid columns.
   * @param {number} rows Grid rows.
   * @param {number} bits Bit packing.
   * @returns {number} Frame bytes.
   */
  function frameBytes(cols, rows, bits) {
    return Math.ceil(cols / (32 / bits)) * rows * 4;
  }

  /**
   * Throws if a required element is missing.
   *
   * @template T
   * @param {T | null | undefined} value Element.
   * @param {string} label Element label.
   * @returns {T} Element.
   */
  function required(value, label) {
    if (!value) {
      throw new Error(`Missing UI element: ${label}`);
    }
    return value;
  }

  /**
   * Waits until a predicate becomes true.
   *
   * @param {() => boolean} predicate Condition.
   * @param {number} timeoutMs Timeout.
   * @param {string} label Timeout label.
   * @returns {Promise<void>} Promise resolved when the condition is true.
   */
  async function waitFor(predicate, timeoutMs, label) {
    const startedAt = performance.now();
    while (!predicate() && performance.now() - startedAt < timeoutMs) {
      await sleep(100);
    }
    if (!predicate()) {
      throw new Error(`Timed out waiting for ${label}.`);
    }
  }

  /**
   * Opens the sidebar if it is currently collapsed.
   *
   * @returns {Promise<void>} Promise resolved after the sidebar is open.
   */
  async function ensureSidebarOpen() {
    const panel = required(document.querySelector('gol-sidebar .sidebar-panel'), 'sidebar panel');
    if (!panel.classList.contains('open')) {
      required(document.querySelector('gol-sidebar .toggle-btn'), 'sidebar toggle').click();
      await waitFor(() => panel.classList.contains('open'), 2000, 'sidebar open');
    }
  }

  /**
   * Returns one custom section host.
   *
   * @param {string} selector Section selector.
   * @returns {Element} Section element.
   */
  function section(selector) {
    return required(document.querySelector(selector), selector);
  }

  /**
   * Finds a button by visible label or aria-label.
   *
   * @param {ParentNode} root Search root.
   * @param {string} label Button label.
   * @returns {HTMLButtonElement | null} Matching button.
   */
  function findButton(root, label) {
    const buttons = Array.from(root.querySelectorAll('button'));
    return buttons.find(button => text(button).includes(label) || button.getAttribute('aria-label') === label) ?? null;
  }

  /**
   * Returns whether a section is showing validation text.
   *
   * @param {ParentNode} root Search root.
   * @returns {boolean} Whether validation text is visible.
   */
  function hasValidationText(root) {
    return Array.from(root.querySelectorAll('.error-message')).some(item => Boolean(text(item)));
  }

  /**
   * Returns whether a section is over the supported frame-size limit.
   *
   * @param {ParentNode} root Search root.
   * @returns {boolean} Whether the supported frame-size limit is exceeded.
   */
  function hasFrameLimitError(root) {
    return root.querySelector('gol-frame-size-limits .error') !== null;
  }

  /**
   * Clicks a button and waits briefly for Angular to process the event.
   *
   * @param {ParentNode} root Search root.
   * @param {string} label Button label.
   * @returns {Promise<boolean>} Whether the button was clicked.
   */
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

  /**
   * Sets a native input value through the browser property setter.
   *
   * @param {HTMLInputElement} input Input element.
   * @param {string | number} value Value.
   */
  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    input.dispatchEvent(new Event('blur', {bubbles: true}));
  }

  /**
   * Returns the inner switch button for a slide-toggle label.
   *
   * @param {string} label Toggle label.
   * @returns {HTMLElement | null} Switch button.
   */
  function switchFor(label) {
    const toggles = Array.from(section('gol-speed-section').querySelectorAll('mat-slide-toggle'));
    const host = toggles.find(toggle => text(toggle).includes(label));
    return host?.querySelector('[role="switch"]') ?? host?.querySelector('button') ?? null;
  }

  /**
   * Reads a slide-toggle state.
   *
   * @param {string} label Toggle label.
   * @returns {{found: boolean; checked: boolean; disabled: boolean}} Toggle state.
   */
  function switchState(label) {
    const button = switchFor(label);
    const checked = button?.getAttribute('aria-checked') === 'true' || button?.classList.contains('mdc-switch--selected') || false;
    const disabled = button?.getAttribute('aria-disabled') === 'true' || button?.hasAttribute('disabled') || false;
    return {found: Boolean(button), checked, disabled};
  }

  /**
   * Sets a slide-toggle to the requested state.
   *
   * @param {string} label Toggle label.
   * @param {boolean} desired Desired checked state.
   * @returns {Promise<boolean>} Whether the desired state was reached.
   */
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

  /**
   * Parses the generation counter from the Playback section.
   *
   * @returns {number} Current generation.
   */
  function generation() {
    const rows = Array.from(section('gol-playback-section').querySelectorAll('gol-label-value'));
    const row = rows.find(item => text(item.querySelector('.label')) === 'Generation');
    const raw = text(row?.querySelector('.value'));
    return Number(raw.replace(/[^\d]/g, '') || 0);
  }

  /**
   * Returns whether the playback button currently offers pause.
   *
   * @returns {boolean} Whether the simulation is running.
   */
  function isRunning() {
    const playback = section('gol-playback-section');
    const pauseButton = findButton(playback, 'Pause');
    return Boolean(pauseButton && !pauseButton.disabled);
  }

  /**
   * Waits for playback controls to become usable after a rebuild.
   *
   * @returns {Promise<void>} Promise resolved when ready.
   */
  async function waitForReady() {
    await waitFor(() => {
      const runButton = findButton(section('gol-playback-section'), 'Run') ?? findButton(section('gol-playback-section'), 'Pause');
      return Boolean(runButton && !runButton.disabled);
    }, CONFIG.rebuildTimeoutSeconds * 1000, 'engine ready');
  }

  /**
   * Pauses the run and disables max speed, recording, and the metrics toggle.
   *
   * @param {number} settleMs Time to wait after controls settle.
   * @returns {Promise<void>} Promise resolved after controls settle.
   */
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

  /**
   * Applies one grid size.
   *
   * @param {{cols: number; rows: number}} dims Dimensions.
   * @returns {Promise<{supported: boolean; reason: string}>} Status.
   */
  async function setGridSize(dims) {
    const grid = section('gol-grid-size-section');
    const columnsInput = required(grid.querySelector('input[name="columns"]'), 'columns input');
    const rowsInput = required(grid.querySelector('input[name="rows"]'), 'rows input');
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

  /**
   * Applies one bit-packing format.
   *
   * @param {number} bits Bit packing.
   * @returns {Promise<{supported: boolean; reason: string}>} Status.
   */
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

  /**
   * Starts or stops playback via the Playback button.
   *
   * @param {boolean} running Desired run state.
   * @returns {Promise<void>} Promise resolved after the click.
   */
  async function setRunning(running) {
    if (isRunning() !== running) {
      await clickButton(section('gol-playback-section'), running ? 'Run' : 'Pause');
    }
  }

  /**
   * Returns whether the UI says recording is unavailable for the current grid.
   *
   * @returns {boolean} Whether recording is unavailable.
   */
  function recordingUnavailable() {
    return text(section('gol-speed-section')).includes('Grid is too large for recording.');
  }

  /**
   * Applies one packing and grid-size pair while recovering from stale UI state.
   *
   * @param {number} bits Bit packing.
   * @param {{cols: number; rows: number}} dims Dimensions.
   * @returns {Promise<{supported: boolean; reason: string}>} Status.
   */
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

    const status = packingStatus.supported && gridStatus.supported
      ? {supported: true, reason: ''}
      : {supported: false, reason: packingStatus.supported ? gridStatus.reason : packingStatus.reason};

    return status;
  }

  /**
   * Configures one benchmark sample through the production UI.
   *
   * @param {{side: number; bits: number; mode: object}} sample Sample.
   * @returns {Promise<{supported: boolean; reason: string; cols: number; rows: number; frameBytes: number}>} Setup result.
   */
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
      await clickButton(section('gol-playback-section'), 'Reset Simulation');
      await waitForReady();
      await setSwitch('Metrics', false);
      await sleep(CONFIG.settleAfterClickMs);
      if (setup.supported && sample.mode.recording && recordingUnavailable()) {
        setup = {
          ...setup,
          supported: false,
          reason: 'Recording is unavailable for this grid and bit packing.'
        };
      }
      if (setup.supported) {
        const recordingReached = await setSwitch('Rec', sample.mode.recording).catch(() => false);
        if (sample.mode.recording && !recordingReached) {
          setup = {
            ...setup,
            supported: false,
            reason: 'Recording is unavailable for this grid and bit packing.'
          };
        }
      }
      if (setup.supported) {
        await setSwitch('Max', true);
      }
    }

    return setup;
  }

  /**
   * Runs one sample.
   *
   * @param {{side: number; bits: number; mode: object; repeat: number}} sample Sample.
   * @returns {Promise<object>} Result.
   */
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

  /**
   * Builds common result fields.
   *
   * @param {{side: number; bits: number; mode: object; repeat: number}} sample Sample.
   * @param {{cols: number; rows: number; frameBytes: number}} setup Setup result.
   * @param {string} startedAt Start time.
   * @returns {object} Common fields.
   */
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

  /**
   * Builds an unsupported result row.
   *
   * @param {{side: number; bits: number; mode: object; repeat: number}} sample Sample.
   * @param {{cols: number; rows: number; frameBytes: number}} setup Setup result.
   * @param {string} startedAt Start time.
   * @param {string} reason Unsupported reason.
   * @returns {object} Result row.
   */
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

  /**
   * Builds all configured benchmark samples.
   *
   * @returns {object[]} Plan.
   */
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

  /**
   * Computes the average of values.
   *
   * @param {number[]} values Values.
   * @returns {number | null} Average.
   */
  function average(values) {
    let value = null;
    if (values.length > 0) {
      value = values.reduce((sum, next) => sum + next, 0) / values.length;
    }
    return value;
  }

  /**
   * Builds summary rows grouped by grid and packing.
   *
   * @param {object[]} results Raw results.
   * @returns {object[]} Summary rows.
   */
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

  /**
   * Writes a checkpoint to localStorage.
   */
  function saveCheckpoint() {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
      config: CONFIG,
      state: {
        startedAt: state.startedAt,
        finishedAt: state.finishedAt,
        running: state.running,
        stopRequested: state.stopRequested
      },
      results: state.results,
      summary: buildSummary(state.results)
    }));
  }

  /**
   * Reads the latest checkpoint.
   *
   * @returns {object | null} Checkpoint.
   */
  function readCheckpoint() {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Escapes a CSV value.
   *
   * @param {unknown} value Value.
   * @returns {string} CSV field.
   */
  function csvField(value) {
    let field = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(field)) {
      field = `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Serializes rows to CSV.
   *
   * @param {object[]} rows Rows.
   * @param {string[]} columns Columns.
   * @returns {string} CSV text.
   */
  function toCsv(rows, columns) {
    return `${[
      columns.map(csvField).join(','),
      ...rows.map(row => columns.map(column => csvField(row[column])).join(','))
    ].join('\n')}\n`;
  }

  /**
   * Downloads one text file.
   *
   * @param {string} filename Filename.
   * @param {string} content Contents.
   * @param {string} type MIME type.
   */
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

  /**
   * Downloads result files.
   *
   * @param {object} payload Payload.
   */
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

  /**
   * Downloads the in-memory result set.
   */
  function downloadResults() {
    downloadPayload({
      config: CONFIG,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      results: state.results,
      summary: buildSummary(state.results)
    });
  }

  /**
   * Downloads the latest checkpoint from localStorage.
   */
  function downloadCheckpoint() {
    const checkpoint = readCheckpoint();
    if (checkpoint) {
      downloadPayload({
        config: checkpoint.config,
        startedAt: checkpoint.state.startedAt,
        finishedAt: checkpoint.state.finishedAt,
        results: checkpoint.results,
        summary: checkpoint.summary
      });
    } else {
      console.warn('[GOLT benchmark] No checkpoint found.');
    }
  }

  /**
   * Requests a stop after the current sample.
   */
  function requestStop() {
    state.stopRequested = true;
    saveCheckpoint();
  }

  /**
   * Runs the full benchmark plan.
   *
   * @returns {Promise<object[]>} Raw results.
   */
  async function run() {
    if (state.running) {
      throw new Error('Benchmark is already running.');
    }

    await ensureSidebarOpen();
    await waitForReady();
    state.stopRequested = false;
    state.running = true;
    state.results = [];
    state.startedAt = new Date().toISOString();
    state.finishedAt = null;
    saveCheckpoint();

    const plan = buildPlan();
    try {
      for (let index = 0; index < plan.length; index++) {
        const sample = plan[index];
        if (state.stopRequested) {
          break;
        }

        console.info('[GOLT benchmark] Starting sample', {
          index: index + 1,
          total: plan.length,
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
            startGeneration: generation(),
            endGeneration: generation(),
            elapsedGenerations: 0,
            seconds: 0,
            genPerSecond: null
          };
        }

        state.results.push(result);
        saveCheckpoint();
        console.info('[GOLT benchmark] Finished sample', result);

        if (!state.stopRequested && result.status !== 'unsupported' && index < plan.length - 1) {
          const cooldownSeconds = result.status === 'ok' ? Math.max(0, CONFIG.cooldownSeconds - CONFIG.counterSettleSeconds) : CONFIG.cooldownSeconds;
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
    run,
    stop: requestStop,
    checkpoint: readCheckpoint,
    downloadCheckpoint
  };

  console.info('GOLT production benchmark runner loaded. Start with: await window.goltBenchmarkRunner.run()');
})();
