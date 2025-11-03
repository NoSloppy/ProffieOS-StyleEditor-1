// proffie_link.js — minimal WebUSB monitor reader for ProffieOS "mon fusion"
// No UI, no commands beyond enabling monitor. Edge to edge canvas behavior lives in render.js.

(function () {
  const DEG2RAD = Math.PI / 180;
  const DEC = new TextDecoder();
  const ENC = new TextEncoder();

  // BLE UART services we’ll try (same list as Workbench)
  const UARTs = {
    '713d0000-389c-f637-b1d7-91b361ae7678' : { rx:'713d0002-389c-f637-b1d7-91b361ae7678', tx:'713d0003-389c-f637-b1d7-91b361ae7678' }, // Proffie custom
    "6e400001-b5a3-f393-e0a9-e50e24dcca9e" : { rx:"6e400002-b5a3-f393-e0a9-e50e24dcca9e", tx:"6e400003-b5a3-f393-e0a9-e50e24dcca9e" }, // Nordic UART
    "49535343-fe7d-4ae5-8fa9-9fafd205e455" : { rx:"49535343-8841-43f4-a8d4-ecbe34729bb3", tx:"49535343-1e4d-4bd9-ba61-23c647249616" }, // ISSC
    "0000fff0-0000-1000-8000-00805f9b34fb" : { rx:"0000fff1-0000-1000-8000-00805f9b34fb", tx:"0000fff2-0000-1000-8000-00805f9b34fb" }, // Transparent
    "0000ffe0-0000-1000-8000-00805f9b34fb" : { rx:"0000ffe1-0000-1000-8000-00805f9b34fb", tx:"0000ffe1-0000-1000-8000-00805f9b34fb" }, // HM-10
    "0000fefb-0000-1000-8000-00805f9b34fb" : { rx:"00000001-0000-1000-8000-008025000000", tx:"00000002-0000-1000-8000-008025000000" }, // Stollmann
    "569a1101-b87f-490c-92cb-11ba5ea5167c" : { rx:"569a2001-b87f-490c-92cb-11ba5ea5167c", tx:"569a2000-b87f-490c-92cb-11ba5ea5167c" }, // Laird
  };

  const state = {
    connected: false,
    usb: null,
    ifaceNumber: null,
    epIn: -1,
    epOut: -1,
    buf: "",
    // Pose (radians)
    pitch: 0,  // from dn
    roll: 0,   // from dn
    yaw: 0,    // integrated Gyro.z
    lastTs: null,
    // simple EMA for Gyro.z
    gzEma: 0,
    alpha: 0.2,

    // --- added for debug/watchdog ---
    transport: null,       // "USB" | "BLE" | null
    ble: null,             // { device, server, rxChar, txChar }
    lastLineTs: 0,         // ms since perf.now(), updated when a fusion line is parsed
    lines: 0,              // number of parsed fusion lines
    timer: null,           // setInterval handle
    debug: true,           // console spam toggle
    downX: 0,              // mapped down.x
    downY: 1,              // mapped down.y
    downZ: 0,              // mapped down.z
    yawOffset: 0,
      // --- perf bucket ---
    perf: {
      fps: 0,
      lastRafTs: 0,
      inputToRafMs: 0,
      usbWaitMs: 0,
      decodeParseMs: 0,
      lineDtMs: 0,
      lastLogTs: 0
    }
  };

// fine tune Centered yyaw getting lost with swings
  function parseFusionLine(line) {
    // Parse dn{...} or "dn= x y z"
    let dx, dy, dz;
    {
      const mDn = /\bdn\{([^}]+)\}/.exec(line);
      if (mDn) {
        const dn = mDn[1].split(",").map(Number);
        if (dn.length !== 3 || !dn.every(Number.isFinite)) return false;
        [dx, dy, dz] = dn;
      } else {
        const mEq = line.match(/dn=\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
        if (!mEq) return false;
        dx = parseFloat(mEq[1]); dy = parseFloat(mEq[2]); dz = parseFloat(mEq[3]);
      }
    }

    // Parse Gyro{...} or "Gyro= x y z" to get Z rate (deg/s)
    let gz = null;
    {
      const mG = /\bGyro\{([^}]+)\}/.exec(line);
      if (mG) {
        const g = mG[1].split(",").map(Number);
        if (g.length === 3 && g.every(Number.isFinite)) gz = g[2];
      } else {
        const mEqG = line.match(/Gyro=\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
        if (mEqG) gz = parseFloat(mEqG[3]);
      }
    }

    if (!Number.isFinite(gz)) {
      if (Number.isFinite(state._lastGz)) { gz = state._lastGz; } else { gz = 0; }
    }
    state._lastGz = gz;

    // Debug copy of dn
    state.downX = dx; state.downY = dy; state.downZ = dz;

    // Timing
    const now = performance.now();
    if (state.lastTs == null) state.lastTs = now;
    const dtRaw = Math.max(0, (now - state.lastTs) / 1000);
    const dt = Math.min(dtRaw, 0.05);  // clamp to 50ms
    state.lastTs = now;

    state.lastLineTs = now;

    // ----- Gyro Z bias cancel -----
    // Soft-learn bias only when the board is effectively still.
    if (!Number.isFinite(state._gzBias)) state._gzBias = 0;
    if (!Number.isFinite(state._lastDnX)) { state._lastDnX = dx; state._lastDnY = dy; state._lastDnZ = dz; }

    const dnDelta =
      Math.abs(dx - state._lastDnX) +
      Math.abs(dy - state._lastDnY) +
      Math.abs(dz - state._lastDnZ);

    state._lastDnX = dx; state._lastDnY = dy; state._lastDnZ = dz;

    // // --- moved skip detection here (after dnDelta exists) ---
    // if (!state._missCnt) state._missCnt = 0;
    // const moving = (Math.abs(gz || 0) > 10) || (dnDelta > 0.02);
    // if (moving && dtRaw > 0.12) {
    //   console.warn("[ProffieLink][skip] dtRaw=", dtRaw.toFixed(3), " s");
    //   state._missCnt++;
    // }
    // --------------------------------------------------------

    // Conditions to consider "still"
    const STILL_GZ   = 8.0;   // deg/s    // was 5.0
    const STILL_DN   = 0.005; //           // was 0.01
    const TAU_BIAS   = 5.0;   // seconds to converge bias


    // if (Number.isFinite(gz) && Math.abs(gz) < STILL_GZ && dnDelta < STILL_DN) {
    //   const aBias = 1 - Math.exp(-dt / TAU_BIAS);   // slow EMA
    //   state._gzBias += aBias * (gz - state._gzBias);
    // }

    if (!(state._biasFreezeUntil && now < state._biasFreezeUntil)) {
      // accumulate "still" time; reset when not still
      state._stillT = (state._stillT || 0);
      if (Number.isFinite(gz) && Math.abs(gz) < STILL_GZ && dnDelta < STILL_DN) {
        state._stillT += dt;
      } else {
        state._stillT = 0;
      }
      // only learn bias if we've been still for a short while
      if (state._stillT > 0.25) {
        const aBias = 1 - Math.exp(-dt / TAU_BIAS);   // slow EMA
        state._gzBias += aBias * (gz - state._gzBias);
      }
    }

    // Apply bias and *smaller* deadband (reduces stick/jump feeling)
    let gzCorr = Number.isFinite(gz) ? (gz - state._gzBias) : 0;
    if (Math.abs(gzCorr) < 0.1) gzCorr = 0;         // was 0.4
    if (dnDelta < STILL_DN * 0.5 && Math.abs(gz) < STILL_GZ) gzCorr = 0; // desk-still guard

    // ----- Map to x/y expected by mouse pipeline -----
    // Pitch (tip up/down) from gravity
    const pitchAngle = Math.atan2(-dx, dz);

    // Yaw (left/right pointing) from corrected gyro Z (deg/s → rad/s)
    state.yaw += (gzCorr * (Math.PI / 180)) * dt;

    // Recenter relative to the last 'C' press
    const yawAngle = -(state.yaw - (state.yawOffset || 0));

    // Faster smoothing to cut perceived lag
    const TAU = 0.006;                      // was 0.012
    const a = 1 - Math.exp(-dt / TAU);

    if (!Number.isFinite(state._vx)) state._vx = yawAngle;
    if (!Number.isFinite(state._vy)) state._vy = pitchAngle;

    state._vx += a * (yawAngle   - state._vx);
    state._vy += a * (pitchAngle - state._vy);

    // Tiny predictive lead using corrected rate (rad/s)
    state._lastGzRad = gzCorr * (Math.PI / 180);
    const LEAD = 0.006;                     // was 0.010; small but helpful
    let xPred = state._vx + state._lastGzRad * LEAD;

    // Horizontal sensitivity (keep your current feel)
    const HORIZ_GAIN = 1.8;
    xPred *= HORIZ_GAIN;

    // Clamp to mouse ranges
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const x = clamp(xPred, -2.5, 2.5);
    const y = clamp(state._vy, -1.5, 1.5);

    // --- targeted anomaly logs (now that dnDelta exists) ---
    const moving   = (Math.abs(gz || 0) > 10) || (dnDelta > 0.02);
    const suppress = state.suppressSkipUntil && now < state.suppressSkipUntil;
    if (!suppress && moving && dtRaw > 0.12) {
      console.warn("[ProffieLink][skip] dtRaw=", dtRaw.toFixed(3), " s");
    }

    // B) log if we appear "still" but yaw drifts noticeably
    if (dnDelta < STILL_DN * 0.5 && Math.abs(gz) < STILL_GZ) {
      if (!state._stillRefYaw) { state._stillRefYaw = state.yaw; state._stillRefT = now; }
      const drift = state.yaw - state._stillRefYaw;
      if (Math.abs(drift) > 0.08) { // ~4.6°
        console.warn("[ProffieLink][drift while still]", "Δyaw=", drift.toFixed(3), "rad over",
                     ((now - state._stillRefT)/1000).toFixed(2), "s");
        state._stillRefYaw = state.yaw; state._stillRefT = now; // rate-limit logs
      }
    } else {
      state._stillRefYaw = null;
    }

    // Drive the same math as the mouse
    if (window.drive_saber_from_xy) {
      window.drive_saber_from_xy(x, y);
    }

    // Estimate sensor→frame delay by waiting one RAF from this input
    const tInput = performance.now();
    requestAnimationFrame(ts => { state.perf.inputToRafMs = ts - tInput; });

    // // Compact perf line every ~500ms
    // const nowMs = performance.now();
    // if (state.debug && (nowMs - state.perf.lastLogTs > 500)) {
    //   state.perf.lastLogTs = nowMs;
    //   console.log(
    //     `[Perf] fps≈${state.perf.fps.toFixed(1)} ` +
    //     `input→raf=${state.perf.inputToRafMs.toFixed(1)}ms ` +
    //     `usbWait=${state.perf.usbWaitMs.toFixed(1)}ms ` +
    //     `decode+parse=${state.perf.decodeParseMs.toFixed(1)}ms`
    //   );
    // }

    // // Debug
    // state.lastLineTs = now;
    // state.lines++;
    // if (state.debug && (state.lines % 10 === 1)) {
    //   console.log(
    //     "[Fusion→mouse]",
    //     "dn=", dx.toFixed(2), dy.toFixed(2), dz.toFixed(2),
    //     "gz=", (typeof gz === 'number' && Number.isFinite(gz)) ? gz.toFixed(2) : gz,
    //     "bias=", state._gzBias.toFixed(2),
    //     "gz'=", gzCorr.toFixed(2),
    //     "| x=", x.toFixed(3), "y=", y.toFixed(3), "dt=", dt.toFixed(3)
    //   );
    // }
    return true;
  }


  function parseLoop() {
    if (!state.connected) return;

    const MAX_LINES = 5;
    let count = 0;

    while (lineQueue.length > 0 && count < MAX_LINES) {
      const line = lineQueue.shift();
      parseFusionLine(line);
      count++;
    }

    requestAnimationFrame(parseLoop);
  }

  function ensureStreaming(reason) {
    if (!state.connected) return;
    const now = performance.now();

    // resend if no fusion data for > 3s (keeps stream alive after refresh, etc.)
    const SILENCE_MS = 1000;
    if (!state.lastLineTs || (now - state.lastLineTs) > SILENCE_MS) {
      const msg = ENC.encode("mon fusion\n");
      if (state.usb) {
        state.usb.transferOut(state.epOut, msg);
      } else if (state.ble && state.ble.txChar) {
        state.ble.txChar.writeValue(msg);
      }
      state.lastLineTs = now;
      if (state.debug) {
        console.log("[ProffieLink] watchdog: resent 'mon fusion' (" + (reason || "interval") + ")");
      }
    }
  }

  function startWatchdog() {
    if (state.timer) clearInterval(state.timer);
    // check every 1s; resend only when silent > 3s
    state.timer = setInterval(() => ensureStreaming("interval"), 1000);
  }

  function stopWatchdog() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  function startPerfRafProbe() {
    function tick(ts) {
      if (state.perf.lastRafTs) {
        const dt = ts - state.perf.lastRafTs;
        state.perf.fps = dt > 0 ? (1000 / dt) : state.perf.fps;
      }
      state.perf.lastRafTs = ts;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Calibrate: press 'c' to recenter yaw to current pointing
  document.addEventListener('keydown', function(ev) {
    if (ev.key === 'c' || ev.key === 'C') {
      state.yawOffset = state.yaw || 0;
      console.log('[ProffieLink] Calibrated yaw; yawOffset=', state.yawOffset.toFixed(3));
    }
  });


async function readLoop() {
  console.log("[ProffieLink] readLoop started (transport=", state.transport, ", epIn=", state.epIn, ")");
  try {
    while (state.connected && state.usb) {
      // measure how long we block waiting for a USB packet
      const tWait0 = performance.now();
      const r = await state.usb.transferIn(state.epIn, 64);
      const tWait1 = performance.now();
      state.perf.usbWaitMs = tWait1 - tWait0;

      // measure decode + parse cost for this chunk
      const tDec0 = performance.now();
      const chunk = DEC.decode(r.data);
      state.buf += chunk;

        let idx;
        while ((idx = state.buf.indexOf("\n")) >= 0) {
          const line = state.buf.slice(0, idx).trim();
          state.buf = state.buf.slice(idx + 1);
          if (!line) continue;

          if (line.startsWith("-+=BEGIN_OUTPUT")) {
            state.frameBuf = "";
            continue;
          }
          if (line.startsWith("-+=END_OUTPUT")) {
            if (state.frameBuf) {
              const lines = state.frameBuf.split("\n");
              for (const l of lines) {
                const one = l.trim();
                if (!one) continue;
                // if (state.debug && one.includes("Gyro")) {
                //   console.log("[ProffieLink] frame:", one);
                // }
                parseFusionLine(one);
              }
            }
            state.frameBuf = undefined;
            continue;
          }
          if (state.frameBuf !== undefined) {
            state.frameBuf += line + "\n";
          } else {
            // if (state.debug && line.includes("Gyro")) {
            //   console.log("[ProffieLink] line:", line);
            // }
            parseFusionLine(line);
          }
        }
        state.perf.decodeParseMs = performance.now() - tDec0;
      }
       } catch (e) {
      console.log("[ProffieLink] read loop ended:", e);
      disconnect();
    }
  }

  async function connectUSB() {
    try {
      const filters = [{ vendorId: 0x1209, productId: 0x6668 }]; // Proffie
      let devs = await navigator.usb.getDevices();
      let usb = devs.find(d => d.vendorId === 0x1209 && d.productId === 0x6668);
      if (!usb) usb = await navigator.usb.requestDevice({ filters });
      await usb.open();
      if (usb.configuration === null) await usb.selectConfiguration(1);

      // Find vendor-specific interface/endpoints
      let ifaceNumber = null, epIn = -1, epOut = -1;
      usb.configuration.interfaces.forEach(intf => {
        intf.alternates.forEach(alt => {
          if (alt.interfaceClass === 0xff) {
            ifaceNumber = intf.interfaceNumber;
            alt.endpoints.forEach(ep => {
              if (ep.direction === "in")  epIn  = ep.endpointNumber;
              if (ep.direction === "out") epOut = ep.endpointNumber;
            });
          }
        });
      });
      if (ifaceNumber == null || epIn < 0 || epOut < 0) throw new Error("No WebUSB endpoints");
console.log("[ProffieLink] iface", ifaceNumber, "epIn", epIn, "epOut", epOut);
      await usb.claimInterface(ifaceNumber);
      await usb.selectAlternateInterface(ifaceNumber, 0);
      await usb.controlTransferOut({
        requestType: 'class', recipient: 'interface', request: 0x22, value: 0x01, index: ifaceNumber
      });

      state.connected = true;
      state.usb = usb; state.ifaceNumber = ifaceNumber; state.epIn = epIn; state.epOut = epOut;

      navigator.usb.addEventListener('disconnect', e => {
        if (e.device === usb) disconnect();
      });

      // Make sure WebUSB is the default console
      await usb.transferOut(epOut, ENC.encode("make_default_console\n"));

      // Kick monitor fusion on (single fire). Harmless if already enabled.
      await usb.transferOut(epOut, ENC.encode("mon fusion\n"));

      state.suppressSkipUntil = performance.now() + 3000;
      state.lastLineTs = performance.now();

      state.transport = "USB";
      state.lastLineTs = performance.now();
      startWatchdog();
      startPerfRafProbe();
      // turn on debug logging
      // state.debug = true;

      // Start the async read loop and catch any errors so it won’t silently die
      readLoop().catch(err => {
        console.error("[ProffieLink] readLoop error:", err);
        disconnect();
      });

      console.log("[ProffieLink] USB connected.");
    } catch (e) {
      console.error("[ProffieLink] USB connect failed:", e);
      disconnect();
      throw e;
    }
  }

  async function connectBLE() {
    if (!navigator.bluetooth) {
      alert("Web Bluetooth not supported in this browser.");
      return;
    }
    try {
      // Build filters for all known UART services
      const filters = Object.keys(UARTs).map(uuid => ({ services: [uuid] }));
      const device = await navigator.bluetooth.requestDevice({ filters, optionalServices: Object.keys(UARTs) });
      const server = await device.gatt.connect();

      // Find the first UART service we can open
      let service, rxChar, txChar;
      for (const uuid of Object.keys(UARTs)) {
        try {
          service = await server.getPrimaryService(uuid);
          const { rx, tx } = UARTs[uuid];
          rxChar = await service.getCharacteristic(rx);
          txChar = await service.getCharacteristic(tx);
          if (rxChar && txChar) break;
        } catch (_) { /* try next */ }
      }
      if (!service || !rxChar || !txChar) throw new Error("No compatible UART service/characteristics");

      // Subscribe to notifications
      await rxChar.startNotifications();
      rxChar.addEventListener('characteristicvaluechanged', (evt) => {
        const chunk = new TextDecoder().decode(evt.target.value);
        state.buf += chunk;
        let idx;
        while ((idx = state.buf.indexOf("\n")) >= 0) {
          const line = state.buf.slice(0, idx).trim();
          state.buf = state.buf.slice(idx + 1);
          if (!line) continue;
          if (line.startsWith("-+=") || line.startsWith("=+-")) {
            if (state.debug) console.log("[ProffieLink] skip frame marker:", line);
            continue; // ignore wrapper lines
          }
          if (state.debug) console.log("[ProffieLink] line:", line);
          parseFusionLine(line);
        }
      });

      // Send "mon fusion" once to start telemetry
      await txChar.writeValue(new TextEncoder().encode("mon fusion\n"));

      state.suppressSkipUntil = performance.now() + 3000;
      state.lastLineTs = performance.now();

      // Track connection; on disconnect, reset state
      device.addEventListener('gattserverdisconnected', () => disconnect());

      state.connected = true;
      state.usb = null;
      state.buf = "";
      state.lastTs = null;
      state.gzEma = 0;
      console.log("[ProffieLink] BLE connected.");
    } catch (e) {
      console.error("[ProffieLink] BLE connect failed:", e);
      disconnect();
      throw e;
    }
  }

  async function disconnect() {
    try {
      state.connected = false;
      stopWatchdog();
      if (state.usb) {
        try { await state.usb.close(); } catch (_) {}
      }
      if (state.ble && state.ble.device?.gatt?.connected) {
        try { state.ble.device.gatt.disconnect(); } catch (_) {}
      }
    } finally {
      state.usb = null;
      state.ble = null;
      state.transport = null;
      state.ifaceNumber = null;
      state.epIn = -1;
      state.epOut = -1;
      state.buf = "";
      state.lastTs = null;
      state.lastLineTs = 0;
      state.gzEma = 0;
      state.lines = 0;
      console.log("[ProffieLink] disconnected.");
    }
    mouse_leave();
  }

  // Expose simple API
  window.ProffieLink = {
    // Feature flags (include secure-context so callers don’t have to)
    usbSupported() { return ("usb" in navigator) && (window.isSecureContext === true); },
    bleSupported() { return ("bluetooth" in navigator) && (window.isSecureContext === true); },

    // Connectors
    async connectUSB() { return connectUSB(); },
    async connectBLE() { return connectBLE(); },

    // Commands
    async sendCommand(cmd) {
      const data = ENC.encode(cmd);
      if (state.usb) {
        return state.usb.transferOut(state.epOut, data);
      }
      if (state.ble && state.ble.txChar) {
        return state.ble.txChar.writeValue(data);
      }
      throw new Error("No transport connected");
    },

    // Debug toggle (getter/setter)
    get debug() { return state.debug; },
    set debug(v) { state.debug = !!v; },

    // State
    isConnected() { return state.connected; },
    getPose() {
      const PITCH_GAIN = 0.9;
      const YAW_GAIN   = 1/3;
      const ROLL_GAIN  = 1.0;

      return {
        pitch: state.pitch * PITCH_GAIN,
        yaw:   state.yaw   * YAW_GAIN,
        roll:  state.roll  * ROLL_GAIN,
        connected: state.connected
      };
    },
    resetYaw() { state.yaw = 0; },
    disconnect,
  };
})();
