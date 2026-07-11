/**
 * Runs epidemic density experiments from a browser snippet.
 *
 * Paste this whole file into a Chromium DevTools Snippet while the app is open,
 * then run it. Set `window.goltEpidemicDensityExperiment.stop = true` to stop
 * after the current wait loop.
 */
(async () => {
  const config = {
    repetitionsPerDensity: 30,
    densities: [...Array.from({length: 7}, (_, i) => 30 + i * 5), ...Array.from({length: 4}, (_, i) => 41 + i)],
    gridSize: 512,
    susceptibleBrushSize: 128,
    susceptibleBrushStep: 64,
    infectiousBrushSize: 4,
    targetSpeed: 300,
    sampleMs: 1000,
    maxRunMs: 10 * 60 * 1000,
    maxGeneration: 100000,
    drawSettleMs: 80,
    rebuildTimeoutMs: 60000,
    downloadTimeoutMs: 30 * 60 * 1000
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const log = (...args) => console.info('[epidemic-density]', ...args);
  const ngApi = window.ng;
  const homeEl = document.querySelector('gol-home');
  const home = ngApi?.getComponent?.(homeEl);
  const automation = {
    stop: false,
    config,
    results: []
  };

  window.goltEpidemicDensityExperiment = automation;

  if (home) {
    const presetSection = ngApi.getComponent(document.querySelector('gol-presets-section'));
    const epidemic = presetSection?.presets?.find(preset => preset.name === 'SIRD Epidemic' || preset.name.includes('Epidemic'));

    if (epidemic) {
      let currentDownloadName = '';
      let downloadCount = 0;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;

      HTMLAnchorElement.prototype.click = function patchedDownloadClick(...args) {
        if (currentDownloadName && this.download === 'golt-export.zip') {
          this.download = `${currentDownloadName}.zip`;
        }
        if (this.download) {
          downloadCount += 1;
        }
        return originalAnchorClick.apply(this, args);
      };

      const applyChanges = () => {
        if (typeof ngApi.applyChanges === 'function') {
          ngApi.applyChanges(home);
        }
      };

      const send = (action, value) => {
        if (value === undefined) {
          home.onSidebarEvent({action});
        } else {
          home.onSidebarEvent({action, value});
        }
        applyChanges();
      };

      const waitFor = async(label, predicate, timeoutMs = 60000, intervalMs = 100) => {
        const startedAt = performance.now();
        let done = predicate();
        while (!done) {
          if (automation.stop) {
            throw new Error('Stopped by window.goltEpidemicDensityExperiment.stop');
          }
          if (performance.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for ${label}`);
          }
          await sleep(intervalMs);
          done = predicate();
        }
      };

      const waitForIdleEngine = async() => {
        await waitFor(
          'engine rebuild',
          () => !home.rebuilding && home.engine?.workerClient?.initialized && !home.gpuErrorMessage,
          config.rebuildTimeoutMs
        );
        await sleep(250);
      };

      const sortedRecord = record => Object.fromEntries(Object.keys(record ?? {}).sort().map(key => [key, record[key]]));
      const round = value => typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(9)) : value;

      const metricSignature = metrics => JSON.stringify({
        population: sortedRecord(metrics.population),
        aliveCells: metrics.aliveCells ?? null,
        deadCells: metrics.deadCells ?? null,
        occupancy: round(metrics.occupancy),
        shannonEntropy: round(metrics.shannonEntropy),
        simpsonIndex: round(metrics.simpsonIndex),
        extinctionTime: sortedRecord(metrics.extinctionTime),
        interfaces: metrics.interfaces ? {
          sameStateContactEdges: metrics.interfaces.sameStateContactEdges,
          crossStateContactEdges: metrics.interfaces.crossStateContactEdges,
          sameStateContactFraction: round(metrics.interfaces.sameStateContactFraction),
          crossStateContactFraction: round(metrics.interfaces.crossStateContactFraction)
        } : null
      });

      const showBrushPreview = (x, y) => {
        home.engine.workerClient.setBrushPreview({
          type: 'brushPreview',
          visible: true,
          x,
          y,
          size: home.brushSize,
          shape: home.brushShape
        });
      };

      const clearBrushPreview = () => {
        home.engine.workerClient.setBrushPreview({
          type: 'brushPreview',
          visible: false,
          x: 0,
          y: 0,
          size: home.brushSize,
          shape: home.brushShape
        });
      };

      const draw = async(x, y) => {
        showBrushPreview(x, y);
        home.engine.workerClient.draw({
          type: 'draw',
          x,
          y,
          size: home.brushSize,
          shape: home.brushShape,
          fill: home.brushFill,
          density: home.activeBrushDensity,
          tribes: home.drawTribes
        });
        await sleep(config.drawSettleMs);
      };

      const waitForGenerationAdvance = async(previousGeneration) => {
        await waitFor(
          `generation > ${previousGeneration}`,
          () => (home.latestMetrics?.generation ?? 0) > previousGeneration,
          30000,
          50
        );
      };

      const stepForwardOnce = async() => {
        const previousGeneration = home.latestMetrics?.generation ?? 0;
        home.engine.stepForward(1);
        await waitForGenerationAdvance(previousGeneration);
      };

      const drawSusceptible = async density => {
        send('selectTribe', 'Susceptible');
        send('setBrushFill', 'spray');
        send('setBrushShape', 'round');
        send('setBrushSize', config.susceptibleBrushSize);
        send('setBrushDensity', density);

        for (let y = config.susceptibleBrushSize / 2; y <= config.gridSize; y += config.susceptibleBrushStep) {
          for (let x = 0; x <= config.gridSize; x += config.susceptibleBrushStep) {
            await draw(x, y);
          }
          clearBrushPreview();
          await sleep(config.drawSettleMs);
        }

        await stepForwardOnce();
        return metricSignature(home.latestMetrics);
      };

      const drawInfectiousSeed = async() => {
        send('selectTribe', 'Infectious');
        send('setBrushFill', 'full');
        send('setBrushShape', 'round');
        send('setBrushSize', config.infectiousBrushSize);
        send('setBrushDensity', 100);

        const center = config.gridSize / 2;
        await draw(center, center);
      };

      const resetSimulation = async() => {
        if (home.state === 'running') {
          send('toggleRun');
          await waitFor('simulation pause', () => home.state === 'paused');
        }
        if (home.recording) {
          send('setRecording', false);
        }
        if (home.maxSpeed) {
          send('setMaxSpeed', false);
        }
        send('restart');
        await waitForIdleEngine();
      };

      const infectiousCount = metrics => metrics.population?.Infectious ?? 0;

      const waitUntilInfectiousExtinct = async(initialSignature) => {
        const startedAt = performance.now();
        let reason = 'infectiousExtinct';
        let done = false;

        while (!done) {
          await sleep(config.sampleMs);

          const metrics = home.latestMetrics;
          if (metrics) {
            const signature = metricSignature(metrics);
            const changedFromInitial = signature !== initialSignature;
            const activeInfectious = infectiousCount(metrics);

            done = changedFromInitial && activeInfectious === 0;

            log('sample', {
              generation: metrics.generation,
              changedFromInitial,
              infectiousCount: activeInfectious,
              occupancy: metrics.occupancy,
              population: metrics.population
            });

            if (!home.recording) {
              throw new Error('Recording stopped before metrics stabilized, probably because browser storage quota was reached.');
            }

            if (metrics.generation >= config.maxGeneration) {
              reason = 'maxGeneration';
              done = true;
            }

            if (performance.now() - startedAt >= config.maxRunMs) {
              reason = 'timeout';
              done = true;
            }
          }
        }

        return reason;
      };

      const downloadRun = async(density, run, reason) => {
        const before = downloadCount;
        currentDownloadName = `golt-epidemic-density-${density}-run-${String(run).padStart(2, '0')}-${reason}`;

        send('download', {
          saves: true,
          metrics: true,
          png: true,
          mp4: true,
          fps: 30,
          bitrate: 4_000_000,
          frameRange: null,
          forceChunkDownload: false
        });

        await waitFor(`download ${currentDownloadName}`, () => downloadCount > before, config.downloadTimeoutMs, 250);
        await waitFor(`download cleanup ${currentDownloadName}`, () => home.downloadProgress < 0 && !home.downloadWorker, 60000, 250);

        return `${currentDownloadName}.zip`;
      };

      try {
        log('starting', config);

        if (home.ruleset.cols !== config.gridSize || home.ruleset.rows !== config.gridSize) {
          send('setGridSize', {
            cols: config.gridSize,
            rows: config.gridSize,
            topology: home.ruleset.topology ?? 'toroidal',
            boundaryTribe: home.ruleset.boundaryTribe ?? 'dead'
          });
          await waitForIdleEngine();
        }

        send('applyPreset', epidemic);
        await waitForIdleEngine();

        for (const density of config.densities) {
          for (let run = 1; run <= config.repetitionsPerDensity; run += 1) {
            log(`density ${density}, run ${run}/${config.repetitionsPerDensity}`);

            await resetSimulation();
            send('setLiveMetrics', {
              enabled: true,
              sections: {
                population: true,
                diversity: true,
                interfaces: true
              }
            });
            const initialSignature = await drawSusceptible(density);
            await drawInfectiousSeed();

            send('setRecording', true);
            await waitFor('recording enabled', () => home.recording);

            if (home.maxSpeed) {
              send('setMaxSpeed', false);
            }
            send('setSpeed', config.targetSpeed);
            send('toggleRun');
            await waitFor('simulation running', () => home.state === 'running');

            const reason = await waitUntilInfectiousExtinct(initialSignature);

            if (home.state === 'running') {
              send('toggleRun');
              await waitFor('simulation pause', () => home.state === 'paused');
            }

            if (home.maxSpeed) {
              send('setMaxSpeed', false);
            }

            const generation = home.latestMetrics?.generation ?? null;
            const filename = await downloadRun(density, run, reason);

            automation.results.push({
              density,
              run,
              generation,
              reason,
              filename
            });
            localStorage.setItem('golt-epidemic-density-results', JSON.stringify(automation.results));

            send('setRecording', false);
          }
        }

        log('completed', automation.results);
      } finally {
        currentDownloadName = '';
        HTMLAnchorElement.prototype.click = originalAnchorClick;
        if (home.state === 'running') {
          send('toggleRun');
        }
        if (home.recording) {
          send('setRecording', false);
        }
        if (home.maxSpeed) {
          send('setMaxSpeed', false);
        }
      }
    } else {
      throw new Error('Could not find the SIRD Epidemic preset in the active app.');
    }
  } else {
    throw new Error('Could not find Angular HomePage component. Open the app in dev mode, then run the snippet after it loads.');
  }
})();
