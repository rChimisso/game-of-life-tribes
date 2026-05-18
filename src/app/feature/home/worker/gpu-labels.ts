/**
 * WebGPU diagnostic labels.
 *
 * @export
 * @type {Readonly<Record<string, string>>}
 */
export const GPU_LABELS = {
  trackedAllocationClearEncoder: 'tracked allocation clear encoder',
  gridClearEncoder: 'grid clear encoder',
  gridReadbackEncoder: 'grid readback encoder',
  simulationBatchEncoder: 'simulation batch encoder',
  simulationSingleStepEncoder: 'simulation single-step encoder',
  simulationStepPass: 'simulation step pass',
  interactiveMetricsEncoder: 'interactive metrics encoder',
  histogramMetricsPass: 'histogram metrics pass',
  interfaceMetricsPass: 'interface metrics pass',
  renderEncoder: 'render encoder',
  renderPass: 'render pass',
  brushEncoder: 'brush encoder',
  brushPass: 'brush pass',
  recordingFrameCopyEncoder: 'recording frame copy encoder',
  recordingSealCopyEncoder: 'recording seal copy encoder',
  recordingRestoreCopyEncoder: 'recording restore copy encoder',
  uniformBuffer: 'render uniform buffer',
  gridBufferA: 'grid buffer A',
  gridBufferB: 'grid buffer B',
  tribeColorBuffer: 'tribe color buffer',
  renderShaderModule: 'render shader module',
  renderPipeline: 'render pipeline',
  simulationShaderModule: 'simulation shader module',
  simulationPipeline: 'simulation pipeline',
  brushShaderModule: 'brush shader module',
  brushPipeline: 'brush pipeline',
  brushUniformBuffer: 'brush uniform buffer',
  gridReadbackBuffer: 'grid readback buffer',
  recordingChunkBuffer: 'recording chunk buffer',
  recordingStagingBuffer: 'recording staging buffer',
  histogramMetricsShaderModule: 'histogram metrics shader module',
  histogramMetricsPipeline: 'histogram metrics pipeline',
  histogramMetricsBuffer: 'histogram metrics buffer',
  histogramMetricsReadBuffer: 'histogram metrics read buffer',
  interfaceMetricsShaderModule: 'interface metrics shader module',
  interfaceMetricsPipeline: 'interface metrics pipeline',
  interfaceMetricsBuffer: 'interface metrics buffer',
  interfaceMetricsReadBuffer: 'interface metrics read buffer'
} as const;
