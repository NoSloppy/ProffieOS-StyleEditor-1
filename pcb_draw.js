window.bladeColors = window.bladeColors || [];   // Hold blade pixel colors for PCB display
window.pcbColors   = window.pcbColors   || null; // Dedicated PCB colors (if any)

function drawPCB() {
  var glowSpread    = 3.5;
  var glowIntensity = 5.7;

  var ctx = pcbCanvas.getContext('2d');
  // Make sure size matches the other canvas
  pcbCanvas.width = FIND('canvas_id').width;
  pcbCanvas.height = FIND('canvas_id').height;
  ctx.clearRect(0, 0, pcbCanvas.width, pcbCanvas.height);
  // Fill black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, pcbCanvas.width, pcbCanvas.height);

  // Draw outer circle (PCB edge)
  var centerX = pcbCanvas.width / 2;
  var centerY = pcbCanvas.height / 2;
  var radius = Math.min(centerX, centerY) - 60;
  var BASE_R = 400;          // pick tuned radius (example)
  var S = radius / BASE_R;   // scale factor

  function sc(v) { return v * S; }

const bladeColors = window.bladeColors || [];
const pcbColors   = window.pcbColors   || null;

  function pickColor(i, mappedIdxFloat) {
    if (pcbdedicatedState.get()) {
      return (pcbColors && pcbColors[i]) ? pcbColors[i] : [255, 255, 0];
    } else {
      if (mappedIdxFloat == null) {
        return (bladeColors && bladeColors[i]) ? bladeColors[i] : [255, 255, 0];
      } else {
        var numBladePixels = bladeColors.length;
        var idx = Math.round(mappedIdxFloat);
        return bladeColors[idx] || [255, 255, 0];
      }
    }
  }

  function drawUprightNumber(ledX, ledY, angle, rectX, rectY, rectW, rectH, n, fontPx) {
    var cx = rectX + rectW / 2;
    var cy = rectY + rectH / 2;
    var tx = ledX + Math.cos(angle) * cx - Math.sin(angle) * cy;
    var ty = ledY + Math.sin(angle) * cx + Math.cos(angle) * cy;
    ctx.fillStyle = '#000';
    ctx.font = 'bold ' + fontPx + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), tx, ty);
  }

  // Draw a ring of identical pads (evenly spaced), with color + upright numbers
  function drawRadialPads(count, ringRadius, rectX, rectY, rectW, rectH, fontPx, startAngleRad) {
    startAngleRad = startAngleRad || 0;
    for (var i = 0; i < count; i++) {
      var angle = startAngleRad + (i / count) * 2 * Math.PI;
      var color = pickColor(i, null);
      // pass rectX/rectY so the pad is anchored at the outer edge (not centered)
      renderPadAt(angle, ringRadius, rectW, rectH, color, i + 1, fontPx, rectX, rectY);
    }
  }
  // ----- Shared glow/core helpers -----

  function padHazeOnly(w, h, color, px = -w/2, py = -h/2) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur  = Math.max(2, sc(28) * glowSpread);
    ctx.shadowColor = `rgba(${color[0]},${color[1]},${color[2]},0.9)`;
    ctx.fillStyle   = `rgb(${color[0]},${color[1]},${color[2]})`;

    const baseAlpha = 0.45;
    const whole = Math.max(1, Math.floor(glowIntensity));
    const frac  = Math.max(0, Math.min(1, glowIntensity - Math.floor(glowIntensity)));

    for (let n = 0; n < whole; n++) { ctx.globalAlpha = baseAlpha;       ctx.fillRect(px, py, w, h); }
    if (frac > 0)                     { ctx.globalAlpha = baseAlpha*frac; ctx.fillRect(px, py, w, h); }
  }

  // function padCoreOnly(w, h, color, px, py) {
  //   ctx.globalCompositeOperation = 'source-over';
  //   ctx.globalAlpha = 0.9;
  //   ctx.shadowBlur  = 0;
  //   ctx.fillStyle   = `rgb(${color[0]},${color[1]},${color[2]})`;
  //   ctx.fillRect(px, py, w, h);
  // }
function padCoreOnly(w, h, color, px = -w/2, py = -h/2) {
  // brightness in [0..1] from the RGB the style produces
  var intensity = Math.max(color[0], color[1], color[2]) / 255;

  // no core if completely black (fully transparent)
  if (intensity <= 0) return;

  // optional gamma if you want a snappier fade: uncomment and tweak
  // intensity = Math.pow(intensity, 1.0); // 1.0 = linear, <1 brighter, >1 dimmer

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.9 * intensity; // alpha tracks brightness
  ctx.shadowBlur  = 0;

  // keep your original RGB so hue stays correct; brightness now comes from alpha
  ctx.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
  ctx.fillRect(px, py, w, h);
}
  // Wrapper: draw both passes for a single pad, centered by default
  function renderPadRect(w, h, color, px = -w/2, py = -h/2) {
    padHazeOnly(w, h, color, px, py);
    padCoreOnly(w, h, color, px, py);
  }

  // Convenience: place + draw a pad at (angle, radius) with size, color, label
  function renderPadAt(angle, R, w, h, color, label, fontPx, locX, locY) {
    var x  = centerX + Math.cos(angle) * R;
    var y  = centerY + Math.sin(angle) * R;
    var px = (typeof locX === 'number') ? locX : -w / 2; // top-left in local coords
    var py = (typeof locY === 'number') ? locY : -h / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    renderPadRect(w, h, color, px, py);   // use provided offsets
    ctx.restore();

    if (pcbshowlednumbersState.get() && label != null) {
      drawUprightNumber(x, y, angle, px, py, w, h, label, fontPx);
    }
  }

  // Equalized batch: each item = { x, y, angle, w, h, color, label?, fontPx? }
  function renderPadsEqualized(items) {
    // 1) haze pass for all
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.angle || 0);
      padHazeOnly(it.w, it.h, it.color);
      ctx.restore();
    }
    // 2) cores for all
    ctx.globalCompositeOperation = 'source-over';
    for (var j = 0; j < items.length; j++) {
      var it2 = items[j];
      ctx.save();
      ctx.translate(it2.x, it2.y);
      ctx.rotate(it2.angle || 0);
      padCoreOnly(it2.w, it2.h, it2.color);
      ctx.restore();

      if (pcbshowlednumbersState.get() && it2.label != null) {
        drawUprightNumber(it2.x, it2.y, it2.angle || 0, -it2.w/2, -it2.h/2, it2.w, it2.h, it2.label, it2.fontPx || Math.round(sc(36)));
      }
    }
    // reset
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 1-based LED→color that respects pcbdedicatedState via pickColor
  function colorFor1(num1based) {
    return pickColor(Math.max(0, (num1based|0) - 1), null);
  }
    // ------------------------------------------------------------

  // SCW NPXL V3-V4 Connector — PCBa (16 pads; equalized glow)
  if (previewType.value === 'PCBa') {
    var img = FIND('pcba_image');
    var scale = 1.08;
    var size  = radius * 2 * scale;
    var x     = centerX - (size / 2);
    var y     = centerY - (size / 2);
    ctx.drawImage(img, x, y, size, size);

    var items = [];
    var ledW = sc(95), ledH = sc(95);

    for (var i = 0; i < 16; i++) {
      var spoke = 7 - (i >> 1);                           // CCW in data order
      var angle = (spoke / 8) * 2 * Math.PI + (Math.PI/8);
      var isInner = (i % 2 === 0);
      var innerOffset = sc(155), outerOffset = sc(55);
      var R = isInner ? (radius - innerOffset) : (radius - outerOffset);

      var cx = centerX + Math.cos(angle) * R;
      var cy = centerY + Math.sin(angle) * R;
      // Only map across the blade when dedicated is ON; otherwise use 1:1 i → bladeColors[i]
      var mapped = pcbdedicatedState.get()
        ? Math.round(i * ((bladeColors.length || 1) - 1) / 15)
        : null;
      var color  = pickColor(i, mapped);

      items.push({ x: cx, y: cy, angle: angle, w: ledW, h: ledH, color: color, label: i+1, fontPx: Math.round(sc(36)) });
    }

    renderPadsEqualized(items);
    return;
  }
    // ------------------------------------------------------------

  // SCW ECO NPXL V4 Connector — PCBb (24 outer/middle + 6 inner; equalized glow)
  if (previewType.value === 'PCBb') {
    const img = FIND('pcbb_image');
    var scale = 1.08;
    var size  = radius * 2 * scale;
    var x     = centerX - (size / 2);
    var y     = centerY - (size / 2);
    ctx.drawImage(img, x, y, size, size);

    var deg = Math.PI / 180;
    var pinAngle = -Math.PI / 2;      // 12 o’clock
    var walk = -1;                    // CCW
    var extraRotDeg = 159;            // your alignment tweak

    // Radii (your tuned offsets)
    var R_outer  = radius - sc(55);
    var R_middle = radius - sc(150);
    var R_inner  = radius - sc(240);

    var ledW = sc(70), ledH = sc(70);
    var labelPx = Math.round(sc(36));
    var items = [];

    function pushRow3(a, o, m, i) {
      var cO = colorFor1(o), cM = colorFor1(m), cI = colorFor1(i);
      items.push(
        { x: centerX + Math.cos(a)*R_outer,  y: centerY + Math.sin(a)*R_outer,  angle: a, w: ledW, h: ledH, color: cO, label: o, fontPx: labelPx },
        { x: centerX + Math.cos(a)*R_middle, y: centerY + Math.sin(a)*R_middle, angle: a, w: ledW, h: ledH, color: cM, label: m, fontPx: labelPx },
        { x: centerX + Math.cos(a)*R_inner,  y: centerY + Math.sin(a)*R_inner,  angle: a, w: ledW, h: ledH, color: cI, label: i, fontPx: labelPx }
      );
    }
    function pushRow2(a, o, m) {
      var cO = colorFor1(o), cM = colorFor1(m);
      items.push(
        { x: centerX + Math.cos(a)*R_outer,  y: centerY + Math.sin(a)*R_outer,  angle: a, w: ledW, h: ledH, color: cO, label: o, fontPx: labelPx },
        { x: centerX + Math.cos(a)*R_middle, y: centerY + Math.sin(a)*R_middle, angle: a, w: ledW, h: ledH, color: cM, label: m, fontPx: labelPx }
      );
    }

    var a = pinAngle + walk * 19.5 * deg + extraRotDeg * deg;
    function step(d) { a += walk * d * deg; }

    // Your CCW chart:
    pushRow3(a, 2, 1, 25);
    step(19.5); /* pin */ step(19.5);
    pushRow3(a, 4, 3, 26);
    step(27);   pushRow2(a, 6, 5);
    step(27);   pushRow2(a, 8, 7);
    step(27);   pushRow3(a, 10, 9, 27);
    step(19.5); /* pin */ step(19.5);
    pushRow3(a, 12, 11, 28);
    step(27);   pushRow2(a, 14, 13);
    step(27);   pushRow2(a, 16, 15);
    step(27);   pushRow3(a, 18, 17, 29);
    step(19.5); /* pin */ step(19.5);
    pushRow3(a, 20, 19, 30);
    step(27);   pushRow2(a, 22, 21);
    step(27);   pushRow2(a, 24, 23);

    renderPadsEqualized(items);
    return;
  }
    // ------------------------------------------------------------

  // SCW NPXL Blade side pcb with 5-pixels (3535/5050)
  if (previewType.value === 'PCBc') {
    var img = FIND('pcbc_image');
    var scale = 1.08;
    var size  = radius * 2 * scale;
    var x     = centerX - (size / 2);
    var y     = centerY - (size / 2);
    ctx.drawImage(img, x, y, size, size);

    var SIZE = sc(160);           // ← change just this number to grow/shrink pads
    var OUTER_EDGE = sc(18.8);    // anchored outer edge (from -60.5 + 75)
    var rectW = SIZE, rectH = SIZE;
    var rectX = OUTER_EDGE - SIZE;
    var rectY = -SIZE / 2;
    var fontPx = Math.round(SIZE * 0.53); // ~40 when SIZE=75

    drawRadialPads(5, radius - sc(30), rectX, rectY, rectW, rectH, fontPx, -Math.PI/2);
    return;
  }
    // ------------------------------------------------------------

  // SCW NPXL Blade side pcb with 6-pixels (3535/5050)
  if (previewType.value === 'PCBd') {
    var img = FIND('pcbd_image');
    var scale = 1.08;
    var size  = radius * 2 * scale;
    var x     = centerX - (size / 2);
    var y     = centerY - (size / 2);
    ctx.drawImage(img, x, y, size, size);

    var SIZE = sc(160);           // ← tweak just this to match PCBc
    var OUTER_EDGE = sc(18.8);    // anchored outer edge
    var rectW = SIZE, rectH = SIZE;
    var rectX = OUTER_EDGE - SIZE;
    var rectY = -SIZE / 2;
    var fontPx = Math.round(SIZE * 0.53);

    drawRadialPads(6, radius - sc(30), rectX, rectY, rectW, rectH, fontPx, -Math.PI/3);
    return;
  }
    // ------------------------------------------------------------

  // PCBe — 64px, serpentine (top-left start), 4 rows × 16 cols
  if (previewType.value === 'PCBe') {
    // Draw the rectangular board image WITHOUT squishing
    var img = FIND('pcbe_image');
    var scaleImg = 1.08;                         // overall image zoom
    var imgH = radius * 2 * scaleImg;            // scale by height like other PCBs
    var imgW = imgH * (img.width / img.height);  // preserve aspect ratio
    var imgX = centerX - imgW / 2;
    var imgY = centerY - imgH / 2;
    ctx.drawImage(img, imgX, imgY, imgW, imgH);

    var rows = 4, cols = 16;

    var pcbeScale   = .83;
    var padW        = sc(65) * pcbeScale;
    var padH        = sc(65) * pcbeScale;
    var gapX        = sc(19.5) * pcbeScale;  // horizontal gap
    var gapY        = sc(20) * pcbeScale;  // vertical gap

    // Margins from top-left corner to the grid’s top-left
    var marginLeft  = sc(95);
    var marginTop   = sc(300);

    // Compute grid origin inside the image
    var gridLeft = imgX + marginLeft;
    var gridTop  = imgY + marginTop;

    // Build items in serpentine order (top-left start)
    var items = [];
    var fontPx = Math.round(sc(26));
    var idx = 0;  // 0-based data index

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // serpentine column index
        var scCol = (r % 2 === 0) ? c : (cols - 1 - c);

        var cx = gridLeft + scCol * (padW + gapX) + padW / 2;  // pad center X
        var cy = gridTop  + r     * (padH + gapY) + padH / 2;  // pad center Y

        var color = pickColor(idx, null);
        items.push({
          x: cx, y: cy, angle: 0,
          w: padW, h: padH,
          color: color,
          label: idx + 1, fontPx: fontPx
        });

        idx++;
      }
    }

    // Equalized draw (all haze, then all cores)
    renderPadsEqualized(items);
    return;
  }
    // ------------------------------------------------------------

  // MTRX 69‑pixel round PCB (centered row counts: 5,7,9,9,9,9,9,7,5; serpentine order)
  if (previewType.value === 'PCBf') {
    var img = FIND('pcbf_image');
    var scale = 1.08;
    var size  = radius * 2 * scale;
    var x     = centerX - (size / 2);
    var y     = centerY - (size / 2);
    ctx.drawImage(img, x, y, size, size);

    var ROWS = 9, COLS = 9;
    var rowCounts = [5, 7, 9, 9, 9, 9, 9, 7, 5]; // exact counts per row (top→bottom)
    var pad   = sc(64);                 // margin to board edge
    var gap   = sc(7);                  // spacing between LED squares
    var boxW  = sc(20), boxH = sc(20);  // base LED square size before scaling

    // Available circle (inside the image ring)
    var availR   = radius - pad;
    var availDia = availR * 2;

    // Scale full 9×9 frame to fit
    var rawW = COLS * boxW + (COLS - 1) * gap;
    var rawH = ROWS * boxH + (ROWS - 1) * gap;
    var scaleGrid = Math.min(availDia / rawW, availDia / rawH);
    var cellW = boxW * scaleGrid, cellH = boxH * scaleGrid, cellGap = gap * scaleGrid;
    var fontPx = Math.max(10, Math.round(cellW * 0.75));

    // Centered frame
    var gridW = COLS * cellW + (COLS - 1) * cellGap;
    var gridH = ROWS * cellH + (ROWS - 1) * cellGap;
    var gridLeft = centerX - gridW / 2;
    var gridTop  = centerY - gridH / 2;

    function cellCenter(r, c) {
      var cx = gridLeft + c * (cellW + cellGap) + cellW / 2;
      var cy = gridTop  + r * (cellH + cellGap) + cellH / 2;
      return { x: cx, y: cy };
    }

    // Build cells in serpentine order
    var items = [];
    var n = 0;  // 0‑based index for pickColor label mapping
    for (var r = 0; r < ROWS; r++) {
      var k = rowCounts[r];
      var startC = Math.floor((COLS - k) / 2);
      var endC   = startC + k - 1;

      if (r % 2 === 0) {
        for (var c = startC; c <= endC; c++) {
          var p = cellCenter(r, c);
          var color = pickColor(n, null);
          items.push({ x:p.x, y:p.y, angle:0, w:cellW, h:cellH, color, label:n+1, fontPx });
          n++;
        }
      } else {
        for (var c = endC; c >= startC; c--) {
          var p = cellCenter(r, c);
          var color = pickColor(n, null);
          items.push({ x:p.x, y:p.y, angle:0, w:cellW, h:cellH, color, label:n+1, fontPx });
          n++;
        }
      }
    }

    // Equalized: all haze then all cores → consistent brightness
    renderPadsEqualized(items);
    return;
  }
    // ------------------------------------------------------------

  // Pixel Ring PCBg — variable LED count
  if (previewType.value === 'PCBg') {
    var PCBgLength = parseInt(FIND('pixelRingCount').value) || 6;

    // Pad (LED) size
    var ledW = sc(70), ledH = sc(70); // center‑anchored in helpers

    // outlines + spacing
    var strokeW    = Math.max(1, sc(1.5));
    var gutter     = sc(33);
    var laneMargin = sc(20);

    // Use chord spacing so pads neither overlap at low counts nor drift apart at high counts.
    // Required tangential span per LED (rotated frame → tangential = ledH)
    var tangential = ledH + 2 * strokeW + gutter;
    var minR = tangential / (2 * Math.sin(Math.PI / PCBgLength));
    var ledRadius = minR;

    // Keep a small floor so lanes don’t collapse for tiny rings
    var minLaneR = ledH / 2 + laneMargin + 10;
    if (ledRadius < minLaneR) ledRadius = minLaneR;

    var outerLaneR = ledRadius + ledH/2 + laneMargin;
    var innerLaneR = ledRadius - ledH/2 - laneMargin;
    if (innerLaneR < 8) innerLaneR = 8;

    // Visual lanes
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2*Math.PI);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerLaneR, 0, 2*Math.PI);
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerLaneR, 0, 2*Math.PI);
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 4;
    ctx.stroke();

    // LED centers ride the midline between lanes
    var ringR = (outerLaneR + innerLaneR) / 2;

    // Start at 12 o’clock
    var startAngle = -Math.PI / 2;

    // Build items
    var items = [];
    for (var i = 0; i < PCBgLength; i++) {
      var angle = startAngle + (i / PCBgLength) * 2 * Math.PI;
      var x = centerX + Math.cos(angle) * ringR;
      var y = centerY + Math.sin(angle) * ringR;
      var color = pickColor(i, null);
      items.push({ x, y, angle, w:ledW, h:ledH, color, label:i+1, fontPx: Math.round(sc(30)) });
    }

    renderPadsEqualized(items);
    return;
  }
}