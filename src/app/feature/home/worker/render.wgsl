// Render shader: draws the grid as a full-screen quad.
// Reads cell tribe IDs from a storage buffer, looks up colors from a uniform array.
// Supports zoom, pan, and toroidal tiling.

struct Uniforms {
  canvas_size: vec2f,    // Canvas width, height in pixels.
  scale: f32,            // Pixels per cell.
  offset_frac: vec2f,    // Fractional camera offset in cell units.
  grid_size: vec2u,      // Grid cols, rows.
  offset_cell: vec2u,    // Integer camera offset in cell units.
  tribe_count: u32,      // Number of tribes.
  preview_center: vec2i, // Brush preview center cell.
  preview_size: u32,     // Brush preview size in cells.
  preview_shape: u32,    // 0=square 1=round 2=diamond 3=vline 4=hline.
  preview_visible: u32,  // 1 when the brush preview should render.
  export_origin_x: u32,  // Visual export unwrap origin column.
  export_origin_y: u32,  // Visual export unwrap origin row.
  export_visible: u32,   // 1 when the visual export framing overlay should render.
  topology: u32,         // 0=toroidal, 1=bounded.
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;
@group(0) @binding(2) var<storage, read> tribe_colors: array<u32>;

const CELLS_PER_WORD: u32 = __CELLS_PER_WORD__;
const WORD_SHIFT: u32 = __WORD_SHIFT__;
const CELL_SHIFT: u32 = __CELL_SHIFT__;
const CELL_INDEX_MASK: u32 = __CELL_INDEX_MASK__;
const CELL_MASK: u32 = __CELL_MASK__;

fn wrapAdd(base: u32, delta: u32, size: u32) -> u32 {
  let rem = delta % size;
  if (base >= size - rem) {
    return base - (size - rem);
  }
  return base + rem;
}

fn wrapCell(value: i32, size: u32) -> i32 {
  return ((value % i32(size)) + i32(size)) % i32(size);
}

fn signedWrapDelta(cell: u32, center: i32, size: u32) -> i32 {
  let wrapped_center = wrapCell(center, size);
  var delta = i32(cell) - wrapped_center;
  let half_size = i32(size) / 2;
  if (delta > half_size) {
    delta = delta - i32(size);
  } else if (delta < -half_size) {
    delta = delta + i32(size);
  }
  return delta;
}

fn signedGridDelta(cell: u32, center: i32, size: u32) -> i32 {
  if (u.topology == 1u) {
    return i32(cell) - center;
  }
  return signedWrapDelta(cell, center, size);
}

fn previewInShape(bx: i32, by: i32, size: u32, shape: u32) -> bool {
  if (bx < 0 || by < 0 || bx >= i32(size) || by >= i32(size)) { return false; }
  let hf = f32(size - 1u) / 2.0;
  let fdx = f32(bx) - hf;
  let fdy = f32(by) - hf;
  switch (shape) {
    case 1u: {
      let r = f32(size) / 2.0 - 0.25;
      return fdx * fdx + fdy * fdy <= r * r;
    }
    case 2u: {
      return abs(fdx) + abs(fdy) <= f32(size) / 2.0;
    }
    case 3u: {
      return bx == i32(size - 1u) / 2;
    }
    case 4u: {
      return by == i32(size - 1u) / 2;
    }
    default: {
      return true;
    }
  }
}

fn signedWrapWorldDelta(world: f32, center: i32, size: u32) -> f32 {
  let gridSize = f32(size);
  let wrappedCenter = f32(wrapCell(center, size));
  let delta = world - wrappedCenter;
  return delta - floor((delta + gridSize * 0.5) / gridSize) * gridSize;
}

fn signedGridWorldDelta(world: f32, center: i32, size: u32) -> f32 {
  if (u.topology == 1u) {
    return world - f32(center);
  }
  return signedWrapWorldDelta(world, center, size);
}

fn previewRectangleOutline(p: vec2f, halfSize: vec2f, stroke: f32) -> bool {
  let distanceInside = halfSize - abs(p);
  let inside = distanceInside.x >= 0.0 && distanceInside.y >= 0.0;
  return inside && min(distanceInside.x, distanceInside.y) <= stroke;
}

fn previewSubpixelRectangleOutline(p: vec2f, halfSize: vec2f, stroke: f32) -> bool {
  let q = abs(p) - halfSize;
  let outsideDistance = length(max(q, vec2f(0.0)));
  let insideDistance = min(max(q.x, q.y), 0.0);
  let signedDistance = outsideDistance + insideDistance;
  return abs(signedDistance) <= stroke;
}

fn previewCellBorderOutlineMask(ix: u32, iy: u32, cell_frac: vec2f) -> bool {
  let size = max(u.preview_size, 1u);
  let half = i32(size - 1u) / 2;
  let bx = signedGridDelta(ix, u.preview_center.x, u.grid_size.x) + half;
  let by = signedGridDelta(iy, u.preview_center.y, u.grid_size.y) + half;
  let inside = previewInShape(bx, by, size, u.preview_shape);
  let edge = min(1.0, 1.0 / max(u.scale, 0.001));
  return inside && (
    (!previewInShape(bx - 1, by, size, u.preview_shape) && cell_frac.x <= edge) ||
    (!previewInShape(bx + 1, by, size, u.preview_shape) && cell_frac.x >= 1.0 - edge) ||
    (!previewInShape(bx, by - 1, size, u.preview_shape) && cell_frac.y <= edge) ||
    (!previewInShape(bx, by + 1, size, u.preview_shape) && cell_frac.y >= 1.0 - edge)
  );
}

fn previewContinuousOutlineMask(local: vec2f) -> bool {
  let size = max(u.preview_size, 1u);
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;
  let delta = vec2f(
    signedGridWorldDelta(world.x, u.preview_center.x, u.grid_size.x),
    signedGridWorldDelta(world.y, u.preview_center.y, u.grid_size.y)
  );
  let footprintCenter = vec2f(0.5, 0.5);
  let p = delta - footprintCenter;
  let halfSize = f32(size) * 0.5;
  let stroke = 1.0 / max(u.scale, 0.001);

  switch (u.preview_shape) {
    case 1u: {
      return abs(length(p) - halfSize) <= stroke;
    }
    case 2u: {
      return abs(abs(p.x) + abs(p.y) - halfSize) <= stroke;
    }
    case 3u: {
      return previewSubpixelRectangleOutline(p, vec2f(0.5, halfSize), stroke);
    }
    case 4u: {
      return previewSubpixelRectangleOutline(p, vec2f(halfSize, 0.5), stroke);
    }
    default: {
      return previewRectangleOutline(p, vec2f(halfSize, halfSize), stroke);
    }
  }
}

fn previewOutlineMask(ix: u32, iy: u32, local: vec2f) -> bool {
  if (u.scale > 1.0) {
    return previewCellBorderOutlineMask(ix, iy, fract(local));
  }
  return previewContinuousOutlineMask(local);
}

fn exportMarkerPixel(local: vec2f, marker: vec2u) -> vec2f {
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;
  let delta = vec2f(
    signedGridWorldDelta(world.x, i32(marker.x), u.grid_size.x),
    signedGridWorldDelta(world.y, i32(marker.y), u.grid_size.y)
  );
  return (delta - vec2f(0.5, 0.5)) * u.scale;
}

fn exportMarkerMask(local: vec2f, marker: vec2u, includeCenterSquare: bool) -> bool {
  let p = exportMarkerPixel(local, marker);
  let arm = 32.0;
  let stroke = 2.0;
  let squareHalf = 8.0;
  let cross = (abs(p.x) <= stroke && abs(p.y) <= arm) || (abs(p.y) <= stroke && abs(p.x) <= arm);
  let centerSquare = includeCenterSquare && abs(p.x) <= squareHalf && abs(p.y) <= squareHalf;
  return cross || centerSquare;
}

fn exportBoundedCornerPixel(local: vec2f, corner: vec2f) -> vec2f {
  let world = vec2f(f32(u.offset_cell.x), f32(u.offset_cell.y)) + local;
  return (world - corner) * u.scale;
}

fn exportMarkerShape(p: vec2f, arm: f32, stroke: f32, squareHalf: f32, includeCenterSquare: bool) -> bool {
  let cross = (abs(p.x) <= stroke && abs(p.y) <= arm) || (abs(p.y) <= stroke && abs(p.x) <= arm);
  let centerSquare = includeCenterSquare && abs(p.x) <= squareHalf && abs(p.y) <= squareHalf;
  return cross || centerSquare;
}

fn exportBoundedCornerMarkerMask(local: vec2f) -> bool {
  let maxCorner = vec2f(f32(u.grid_size.x), f32(u.grid_size.y));
  return exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, 0.0)), 32.0, 2.0, 8.0, false) || exportMarkerShape(exportBoundedCornerPixel(local, vec2f(maxCorner.x, 0.0)), 32.0, 2.0, 8.0, false) || exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, maxCorner.y)), 32.0, 2.0, 8.0, false) || exportMarkerShape(exportBoundedCornerPixel(local, maxCorner), 32.0, 2.0, 8.0, false);
}

fn exportOriginMarkerMask(local: vec2f) -> bool {
  return exportMarkerMask(local, vec2u(u.export_origin_x, u.export_origin_y), false);
}

fn exportCenterMarkerMask(local: vec2f) -> bool {
  let center = vec2u(
    wrapAdd(u.export_origin_x, u.grid_size.x / 2u, u.grid_size.x),
    wrapAdd(u.export_origin_y, u.grid_size.y / 2u, u.grid_size.y)
  );
  return exportMarkerMask(local, center, true);
}

fn exportMarkerOutlineMask(local: vec2f, marker: vec2u, includeCenterSquare: bool) -> bool {
  let p = exportMarkerPixel(local, marker);
  let arm = 34.0;
  let stroke = 4.0;
  let squareHalf = 10.0;
  let cross = (abs(p.x) <= stroke && abs(p.y) <= arm) || (abs(p.y) <= stroke && abs(p.x) <= arm);
  let centerSquare = includeCenterSquare && abs(p.x) <= squareHalf && abs(p.y) <= squareHalf;
  return cross || centerSquare;
}

fn exportBoundedCornerMarkerOutlineMask(local: vec2f) -> bool {
  let maxCorner = vec2f(f32(u.grid_size.x), f32(u.grid_size.y));
  return exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, 0.0)), 34.0, 4.0, 10.0, false) ||
    exportMarkerShape(exportBoundedCornerPixel(local, vec2f(maxCorner.x, 0.0)), 34.0, 4.0, 10.0, false) ||
    exportMarkerShape(exportBoundedCornerPixel(local, vec2f(0.0, maxCorner.y)), 34.0, 4.0, 10.0, false) ||
    exportMarkerShape(exportBoundedCornerPixel(local, maxCorner), 34.0, 4.0, 10.0, false);
}

fn exportOriginMarkerOutlineMask(local: vec2f) -> bool {
  return exportMarkerOutlineMask(local, vec2u(u.export_origin_x, u.export_origin_y), false);
}

fn exportCenterMarkerOutlineMask(local: vec2f) -> bool {
  let center = vec2u(
    wrapAdd(u.export_origin_x, u.grid_size.x / 2u, u.grid_size.x),
    wrapAdd(u.export_origin_y, u.grid_size.y / 2u, u.grid_size.y)
  );
  return exportMarkerOutlineMask(local, center, true);
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
  // Full-screen triangle trick: 3 vertices cover the entire clip space.
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  var out: VertexOutput;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  // UV: [0,1] range, y flipped so top-left = (0,0).
  out.uv = (pos[vi] + 1.0) * 0.5;
  out.uv.y = 1.0 - out.uv.y;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  // Convert pixel coordinate to local cell offset. The large integer camera
  // offset is applied separately to avoid f32 precision loss on wide grids.
  let px = in.uv * u.canvas_size;
  let local = px / u.scale + u.offset_frac;

  let direct_ix = min(u.grid_size.x - 1u, u.offset_cell.x + u32(local.x));
  let direct_iy = min(u.grid_size.y - 1u, u.offset_cell.y + u32(local.y));
  let ix = select(wrapAdd(u.offset_cell.x, u32(local.x), u.grid_size.x), direct_ix, u.topology == 1u);
  let iy = select(wrapAdd(u.offset_cell.y, u32(local.y), u.grid_size.y), direct_iy, u.topology == 1u);

  // Read tribe ID from the active packed grid buffer.
  let packed_cols = (u.grid_size.x + CELLS_PER_WORD - 1u) >> WORD_SHIFT;
  let word_idx = iy * packed_cols + (ix >> WORD_SHIFT);
  let shift = (ix & CELL_INDEX_MASK) << CELL_SHIFT;
  let tribe_id = (grid[word_idx] >> shift) & CELL_MASK;

  // Look up tribe color (packed as 0x00BBGGRR).
  let color_packed = tribe_colors[tribe_id];
  let r = f32(color_packed & 0xFFu) / 255.0;
  let g = f32((color_packed >> 8u) & 0xFFu) / 255.0;
  let b = f32((color_packed >> 16u) & 0xFFu) / 255.0;

  if (u.preview_visible == 1u && previewOutlineMask(ix, iy, local)) {
    return vec4f(0.82, 0.84, 0.86, 1.0);
  }

  let exportCornerMask = select(exportOriginMarkerMask(local), exportBoundedCornerMarkerMask(local), u.topology == 1u);
  let exportCornerOutlineMask = select(exportOriginMarkerOutlineMask(local), exportBoundedCornerMarkerOutlineMask(local), u.topology == 1u);

  if (u.export_visible == 1u && (exportCenterMarkerMask(local) || exportCornerMask)) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  if (u.export_visible == 1u && (exportCenterMarkerOutlineMask(local) || exportCornerOutlineMask)) {
    return vec4f(0.82, 0.84, 0.86, 1.0);
  }

  return vec4f(r, g, b, 1.0);
}
