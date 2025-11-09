// FUNCTIONS

var BATTERY_LEVEL=24000

class BatteryLevelClass extends FUNCTION {
  constructor() {
    super("Returns 0-32768 based on battery level.", []);
  }
  run(blade) {}
  getInteger(led) { return 32768 - ((millis() * 3) & 0x7fff); }
};

function BatteryLevel() {
  return new BatteryLevelClass();
}

class VolumeLevelClass extends FUNCTION {
  constructor() {
    super("Returns 0-32768 based on volume level.", []);
  }
  run(blade) {}
  // getInteger(led) { return 0 + ((millis() * 7) & 0x7fff); }
  getInteger(led) { return 0 + ((millis() / 500) % 11) * 32767 / 10; }
};

function VolumeLevel() {
  return new VolumeLevelClass();
}

class BumpClass extends FUNCTION {
  constructor() {
    super("Function returning a bump shape", arguments);
    this.add_arg("BUMP_POSITION", "FUNCTION", "0=bump at hilt, 32768=bump at tip");
    this.add_arg("BUMP_WIDTH_FRACTION", "FUNCTION", "bump width", Int(16384));
  }
  run(blade) {
    this.BUMP_POSITION.run(blade);
    this.BUMP_WIDTH_FRACTION.run(blade);
    var fraction = this.BUMP_WIDTH_FRACTION.getInteger(0);
    if (fraction == 0) {
      this.mult = 1;
      this.location = -10000;
      return;
    }
    this.mult = 32 * 2.0 * 128 * 32768 / fraction / blade.num_leds();
    this.location = (this.BUMP_POSITION.getInteger(0) * blade.num_leds() * this.mult) / 32768;
  }
  getInteger(led) {
    var dist = Math.abs(led * this.mult - this.location);
    var p = dist >> 7;
    if (p >= 32) return 0;
    var m = dist & 0x3f;
    return blast_hump[p] * (128 - m) + blast_hump[p+1] * m;
  }
};

function Bump(P, F) {
  return new BumpClass(P, F);
}

//////////// indents and line returns PR ///////////
class ChangeSlowlyClass extends FUNCTION {
  constructor(F, SPEED) {
    super("Changes F by no more than SPEED values per second.", arguments);
    this.add_arg("F", "FUNCTION", "Function to moderate");
    this.add_arg("SPEED", "FUNCTION", "maximum change speed");
    this.last_micros = micros();
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var delta = now - this.last_micros;
    if (delta > 1000000) delta = 1;
    this.last_micros = now;
    delta *= this.SPEED.getInteger(0);
    delta /= 1000000;
    var target = this.F.getInteger(0);
    if (delta > Math.abs(this.value - target)) {
      this.value = target;
    } else if (this.value < target) {
      this.value += delta;
    } else {
      this.value -= delta;
    }
  }
  getInteger(led) { return this.value; }
}

function ChangeSlowly(F, SPEED) {
  return new ChangeSlowlyClass(F, SPEED);
}

class IfonClass extends FUNCTION {
  constructor(A, B) {
    super("A if on, B if off.", arguments);
    this.add_arg("A", "FUNCTION", "A");
    this.add_arg("B", "FUNCTION", "B");
  }
  run(blade) {
    this.A.run(blade);
    this.B.run(blade);
    this.on = blade.is_on();
  }
  getInteger(led) {
    if (this.on) return this.A.getInteger(led);
    return this.B.getInteger(led);
  }
};

function Ifon(A, B) { return new IfonClass(A, B); }

class InOutFuncXClass extends FUNCTION {
  constructor(OUT_MILLIS, IN_MILLIS) {
    super("0 when off, 32768 when on, OUT_MILLIS/IN_MILLIS determines speed in between.", arguments);
    this.add_arg("OUT_MILLIS", "FUNCTION", "millis to ramp up");
    this.add_arg("IN_MILLIS", "FUNCTION", "millis to ramp down");
    this.last_micros = 0;
    this.extension = 0.0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var delta = now - this.last_micros;
    if (delta < 0 || delta > 1000000) delta = 1;
    this.last_micros = now;
    if (blade.is_on()) {
      if (this.extension == 0.0) {
        this.extension = 0.00001;
      } else {
        this.extension += delta / (this.OUT_MILLIS.getInteger(0) * 1000.0);
        this.extension = Math.min(this.extension, 1.0);
      }
    } else {
      this.extension -= delta / (this.IN_MILLIS.getInteger(0) * 1000.0);
      this.extension = Math.max(this.extension, 0.0);
    }
    this.ret = this.extension * 32768;
  }
  getInteger(led) { return this.ret; }
  argify(status) {
    state.int_argument = IGNITION_TIME_ARG;
    this.OUT_MILLIS = this.OUT_MILLIS.argify(status);

    state.int_argument = RETRACTION_TIME_ARG;
    this.IN_MILLIS = this.IN_MILLIS.argify(status);

    return this;
  }
};

function InOutFuncX(O, I) {
  return new InOutFuncXClass(O, I);
}
function InOutFunc(O, I) {
  return InOutFuncX(Int(O), Int(I));
}

// TODO: InOutFuncTD

class IntClass extends FUNCTION {
  constructor(N) {
    super("Constant integer function", arguments);
    this.add_arg("N","INT","number to return.");
  }
  getInteger(led) { return this.N; }
  pp() {
    if (pp_is_url) {
      if (this.super_short_desc) return "$";
      return this.gencomment() + "Int<" + this.N + ">";
    }
    return this.PPshort("Int<" + this.N +">", "VALUE");
  }
  argify(state) {
    if (state.int_argument) {
      ret = IntArg_(ArgumentName(state.int_argument), this.N);
      state.int_argument = false;
      return ret;
    } else {
      return this;
    }
  }
};

function Int(n) { return new IntClass(Math.round(n)); }

class IntArgClass extends FUNCTION {
  constructor(ARG, N) {
    super("Dynamic Integer argument", arguments);
    this.add_arg("ARG","ArgumentName","argument number.");
    this.add_arg("DEFAULT","INT","default.");
  }
  run(blade) {
    super.run(blade);
    this.value = parseInt(getARG(this.ARG, "" + this.DEFAULT));
  }
  getInteger(led) { return this.value; }
  argify(state) {
    if (state.int_argument == this.ARG) {
        state.int_argument = false;
    }
    return this;
  }
};

function IntArg_(ARG, N) {
  return new IntArgClass(ARG, N);
}

class RgbArgClass extends STYLE {
  constructor(ARG, N) {
    super("Dynamic Color argument", arguments);
    this.add_arg("ARG","ArgumentName","number to return.");
    this.add_arg("DEFAULT","COLOR","default.");
  }
  run(blade) {
    super.run(blade);
    var d = Math.round(this.DEFAULT.r * 65535) + "," + Math.round(this.DEFAULT.g * 65535)+ "," +Math.round(this.DEFAULT.b * 65535);
    var v = getARG(this.ARG, d).split(",");
    this.value = Rgb16(parseInt(v[0]), parseInt(v[1]), parseInt(v[2]));
  }
  getColor(led) { return this.value; }
  argify(state) {
    if (state.color_argument == this.ARG) {
        state.color_argument = false;
    }
    return this;
  }
};

function RgbArg_(ARG, COLOR) {
  return new RgbArgClass(ARG, COLOR);
}

class ScaleClass extends FUNCTION {
  constructor(F, A, B) {
    super("Changes values in range 0-32768 to A-B.", arguments);
    this.add_arg("F","FUNCTION","input");
    this.add_arg("A","FUNCTION","lower output limit");
    this.add_arg("B","FUNCTION","upper output limit");
  }
  run(blade) {
    super.run(blade);
    var a = this.A.getInteger(0);
    var b = this.B.getInteger(0);
    this.mul = (b - a);
    this.add = a;
  }
  getInteger(led) {
    return (this.F.getInteger(led) * this.mul >> 15) + this.add;
  }
};

function Scale(F, A, B) { return new ScaleClass(F, A, B); }

class InvertFClass extends MACRO {
  constructor(F) {
    super("Invert input function", arguments);
    this.add_arg("F", "FUNCTION", "Function to invert.");
    this.SetExpansion(Scale(this.F, Int(32768), Int(0)));
  }
};

function InvertF(F) { return new InvertFClass(F); }


class SinClass extends FUNCTION {
  constructor(RPM, LOW, HIGH) {
     super("Pulses between LOW and HIGH RPM times per minute.", arguments);
     this.add_arg("RPM", "FUNCTION", "Revolutions per minute");
     this.add_arg("HIGH", "FUNCTION", "upper output limit", Int(32768));
     this.add_arg("LOW", "FUNCTION", "lower output limit", Int(0));
     this.pos = 0.0;
     this.last_micros = 0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var delta = now - this.last_micros;
    this.last_micros = now;
    this.pos = fract(this.pos + delta / 60000000.0 * this.RPM.getInteger(0));
    var high = this.HIGH.getInteger(0);
    var low = this.LOW.getInteger(0);
    var tmp = Math.sin(this.pos * Math.PI * 2.0) / 2.0;
    this.value = Math.floor( (tmp + 0.5) * (high - low) + low );
  }
  getInteger(led) { return this.value; }
};

function Sin(RPM, LOW, HIGH) { return new SinClass(RPM, LOW, HIGH); }

class SawClass extends FUNCTION {
  constructor(RPM, LOW, HIGH) {
     super("Pulses between LOW and HIGH RPM times per minute.", arguments);
     this.add_arg("RPM", "FUNCTION", "Revolutions per minute");
     this.add_arg("HIGH", "FUNCTION", "upper output limit", Int(32768));
     this.add_arg("LOW", "FUNCTION", "lower output limit", Int(0));
     this.pos = 0.0;
     this.last_micros = 0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var delta = now - this.last_micros;
    this.last_micros = now;
    this.pos = fract(this.pos + delta / 60000000.0 * this.RPM.getInteger(0));
    var high = this.HIGH.getInteger(0);
    var low = this.LOW.getInteger(0);
    this.value = Math.floor(low + this.pos * (high - low));
  }
  getInteger(led) { return this.value; }
};

function Saw(RPM, LOW, HIGH) { return new SawClass(RPM, LOW, HIGH); }

const  TRIGGER_DELAY = 0;
const  TRIGGER_ATTACK = 1;
const  TRIGGER_SUSTAIN = 2;
const  TRIGGER_RELEASE = 3;
const  TRIGGER_OFF = 4;

class TriggerClass extends FUNCTION {
  constructor(EFFECT, FADE_IN_MILLIS, SUSTAIN_MILLIS, FADE_OUT_MILLIS, DELAY_MILLIS) {
    super("When EFFECT occurs, DELAY_MILLIS controls a pause, then we ramp up from 0 to 32768, stay there for SUSTAIN_MILLIS, then ramp down again.", arguments);
    this.add_arg("EFFECT", "EFFECT", "Trigger event");
    this.add_arg("FADE_IN_MILLIS", "FUNCTION", "How long it takes to ramp to 32768");
    this.add_arg("SUSTAIN_MILLIS", "FUNCTION", "Stay at 32768 for this long.");
    this.add_arg("FADE_OUT_MILLIS", "FUNCTION", "How long it takes to ramp back down to zero.");
    this.add_arg("DELAY_MILLIS", "FUNCTION", "How long to delay before trigger starts.", Int(0));

    this.trigger_state = TRIGGER_OFF;
    console.log("EFFECT INIT");
    this.effect = new OneshotEffectDetector(this.EFFECT);
    this.start_time = 0;
  }
  run(blade) {
    super.run(blade);
    if (this.effect.Detect(blade)) {
      this.start_time = micros();
      this.trigger_state = TRIGGER_DELAY;
    }
    if (this.trigger_state == this.TRIGGER_OFF) {
      this.value = 0;
      return;
    }
    var t = micros() - this.start_time;
    while (true) {
      var micros_for_state = this.get_millis_for_state() * 1000;
      if (t < micros_for_state) {
        switch (this.trigger_state) {
        case TRIGGER_DELAY:
          this.value = 0;
          return;
        case TRIGGER_ATTACK:
          this.value = t * 32768.0 / micros_for_state;
          return;
        case TRIGGER_SUSTAIN:
          this.value = 32768;
          return;
        case TRIGGER_RELEASE:
          this.value = 32768 - t * 32768 / micros_for_state;
          return;
        case TRIGGER_OFF:
          this.value = 0;
          return;
        }
      }
      if (this.TRIGGER_STATE >= 4) throw "Weird state?";
      this.trigger_state++;
      t -= micros_for_state;
      this.start_time += micros_for_state;
    }
  }
  get_millis_for_state() {
    switch (this.trigger_state) {
      case TRIGGER_DELAY: return this.DELAY_MILLIS.getInteger(0);
      case TRIGGER_ATTACK: return this.FADE_IN_MILLIS.getInteger(0);
      case TRIGGER_SUSTAIN: return this.SUSTAIN_MILLIS.getInteger(0);
      case TRIGGER_RELEASE: return this.FADE_OUT_MILLIS.getInteger(0);
      case TRIGGER_OFF:
    }
    return 10000000;
  }
  getInteger(led) { return this.value; }
  IS_RUNNING() {
    return this.trigger_state != TRIGGER_OFF;
  }
};

function Trigger(EFFECT, FADE_IN_MILLIS, SUSTAIN_MILLIS, FADE_OUT_MILLIS, DELAY_MILLIS) {
  return new TriggerClass(EFFECT, FADE_IN_MILLIS, SUSTAIN_MILLIS, FADE_OUT_MILLIS, DELAY_MILLIS);
}

class SmoothStepClass extends FUNCTION {
  constructor(POS, WIDTH) {
    super("SmoothStep function", arguments);
    this.add_arg("POS", "FUNCTION", "Position 0=hilt, 32768=tip");
    this.add_arg("WIDTH", "FUNCTION", "Step width 32768=length of blade");
  }
  run(blade) {
    super.run(blade);
    var width=this.WIDTH.getInteger(0);
    if (width == 0) {
      this.mult = 32768;
    } else {
      this.mult = 32768 * 32768 / width / blade.num_leds();
    }
    this.location = blade.num_leds() * this.mult * (this.POS.getInteger(0) - width/2) / 32768;
  }
  getInteger(led) {
    var x = led * this.mult - this.location;
    if (x < 0) return 0;
    if (x > 32768) return 32768;
    return (((x * x) >> 14) * ((3<<14) - x)) >> 15;
  }
};

function SmoothStep(POS, WIDTH) { return new SmoothStepClass(POS, WIDTH); }

class RampFClass extends FUNCTION {
  constructor() {
    super("0 at base, 32768 at tip", arguments);
  }
  run(blade) {
    this.num_leds = blade.num_leds();
  }
  getInteger(led) {
    return led * 32768 / this.num_leds;
  }
}

function RampF() {
  return new RampFClass();
}

class MultClass extends FUNCTION {
  constructor(ARGS) {
    super("Multiply values. Uses fixed point 16.15 multiplication", ARGS);
    this.FUNCTIONS = Array.from(ARGS);
    for (var i = 1; i < this.FUNCTIONS.length + 1; i++)
      this.add_arg("FUNCTION" + i, "FUNCTION", "COLOR " + i);
  }
  getInteger(led) {
    var ret = this.FUNCTIONS[0].getInteger(led);
    for (var i = 1; i < this.FUNCTIONS.length; i++) {
      ret = (ret * this.FUNCTIONS[i].getInteger(led)) >> 15;
    }
    return ret;
  }
}

function Mult(ARGS) {
  return new MultClass(Array.from(arguments));
}

class PercentageClass extends MACRO {
  constructor(F, P) {
    super("Returns P % of F.", arguments);
    this.add_arg("F","FUNCTION","F");
    this.add_arg("P","INT", "Percent")
    this.SetExpansion(Mult(this.F.DOCOPY(), Int(this.P * 32768 / 100)));
  }
}

function Percentage(F, P) {
  return new PercentageClass(F, P);
}

class NoisySoundLevelClass extends FUNCTION {
  constructor() {
    super("Noisy sound level.", arguments);
  }
  run(blade) {
    this.var_ = (Math.random() * Math.random()) * 32768;
  }
  getInteger(led) { return this.var_; }
};

function NoisySoundLevel() { return new NoisySoundLevelClass(); }

class NoisySoundLevelCompatClass extends FUNCTION {
  constructor() {
    super("Noisy sound level.", arguments);
  }
  run(blade) {
    this.var_ = clamp((Math.random() * Math.random()) * 32768 * 2, 0, 32768);
  }
  getInteger(led) { return this.var_; }
};

function NoisySoundLevelCompat() { return new NoisySoundLevelCompatClass(); }

class SmoothSoundLevelClass extends FUNCTION {
  constructor() {
    super("Noisy sound level.", arguments);
    this.var_ = 0.0;
  }
  run(blade) {
    var v = Math.random() * 20000.0;
    v *= v;
    this.var_ = (this.var_ + v) / 100.0 ;
  }
  getInteger(led) { return this.var_; }
};

function SmoothSoundLevel() { return new SmoothSoundLevelClass(); }

class WavLenClass extends FUNCTION {
  constructor() {
    super("Length of associated wav file in MS", arguments);
    this.add_arg("EFFECT", "EFFECT", "Which effect to get the length of.", EFFECT(EFFECT_NONE));
  }
//////////////// WAVLEN PR /////////////////
  // WavLen value can be set in settings panel
  setLength(value) {
    this.wavlenValue = value;
     console.log("Updated WavLen: ", this.wavlenValue);
  }
  getInteger(led) {
    const effectArg  = this.EFFECT?.value;
    const effectName = EFFECT_SOUND_MAP[effectArg];
    // Build durations array from loaded buffers
    const durations  = pickLoopBuffers(effectName)
                          .map(b => b?.duration ? Math.round(b.duration * 1000) : null);

    // Prevent lastPlayedSoundIndex[effectName] from being undefined:
    // This keeps EFFECTS from missing the sound duration when loading the default font with Sound OFF.
    // Defaults to first buffer so WavLen uses the real duration even before any sound is actually played.
    const rawIdx = lastPlayedSoundIndex[effectName];
    const idx = (typeof rawIdx === 'number' && rawIdx >= 0 && rawIdx < durations.length)
                  ? rawIdx
                  : 0;
    let result;
    if (
      useFontWavLenState.get() &&
      effectName &&
      Array.isArray(durations) &&
      durations[idx] != null
    ) {
      result = durations[idx];
    } else {
      result = myWavLen.wavlenValue;
    }
    return result;
  }
};

function WavLen(EFFECT) { return new WavLenClass(EFFECT); }

class SwingSpeedXClass extends FUNCTION {
  constructor() {
    super("Swing Speed", arguments);
    this.add_arg("MAX", "FUNCTION", "What swing speed returns 32768.");
    this.var_ = 0.0;
  }
  run(blade) {
    super.run(blade);
    var speed = get_swing_speed();
    var v =  speed / this.MAX.getInteger(0);
    this.var_ = clamp(v * 32768, 0, 32768);
  }
  getInteger(led) { return this.var_; }
};

function SwingSpeedX(MAX) { return new SwingSpeedXClass(MAX); }

class SwingSpeedClass extends MACRO {
  constructor() {
    super("Swing Speed", arguments);
    this.add_arg("MAX", "INT", "What swing speed returns 32768.");
    this.SetExpansion(SwingSpeedX(Int(this.MAX)));
  }
};

function SwingSpeed(MAX) { return new SwingSpeedClass(MAX); }

class ClashImpactFXClass extends FUNCTION {
  constructor(MIN, MAX) {
    super("Returns clash strength.", arguments);
    this.add_arg("MIN", "FUNCTION", "Minimum, translates to zero", Int(200));
    this.add_arg("MAX", "FUNCTION", "Maximum, translates to 32768", Int(1600));
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    current_clash_strength = max(current_clash_strength, random(current_clash_value));
    current_clash_value -= random(random(current_clash_value));
    this.value = clamp((current_clash_strength - this.MIN.getInteger(0)) * 32768 / this.MAX.getInteger(0), 0, 32768);
  }
  getInteger(led) {
    return this.value;
  }
};

function ClashImpactFX(MIN, MAX) {
  return new ClashImpactFXClass(MIN, MAX);
}

class ClashImpactFClass extends MACRO {
  constructor(MIN, MAX) {
    super("Returns clash strength.", arguments);
    this.add_arg("MIN", "INT", "Minimum, translates to zero", 200);
    this.add_arg("MAX", "INT", "Maximum, translates to 32768", 1600);
    this.SetExpansion(ClashImpactFX(Int(this.MIN), Int(this.MAX)));
  }
}

function ClashImpactF(MIN, MAX) {
  return new ClashImpactFClass(MIN, MAX);
}

class SwingAccelerationXClass extends FUNCTION {
  constructor() {
    super("Swing Acceleration", arguments);
    this.add_arg("MAX", "FUNCTION", "What swing speed returns 32768.", Int(130));
    this.var_ = 0.0;
  }
  run(blade) {
    super.run(blade);
    var accel = get_swing_accel();
    var v = accel / this.MAX.getInteger(0);
    this.var_ = clamp(v * 32768, 0, 32768);
  }
  getInteger(led) { return this.var_; }
};

function SwingAccelerationX(MAX) { return new SwingAccelerationXClass(MAX); }

class SwingAccelerationClass extends MACRO {
  constructor() {
    super("Swing Speed", arguments);
    this.add_arg("MAX", "INT", "What swing speed returns 32768.", 130);
    this.SetExpansion(SwingAccelerationX(Int(this.MAX)));
  }
};

function SwingAcceleration(MAX) { return new SwingAccelerationClass(MAX); }

class LayerFunctionsClass extends FUNCTION {
  constructor(ARGS) {
    super("Mix functions", ARGS);
    this.LAYERS = Array.from(ARGS);
    for (var i = 1; i < this.LAYERS.length + 1; i++)
      this.add_arg("FUNCTION" + i, "FUNCTION", "FUNCTION " + i);
  }
  getInteger(led) {
    var ret = 0;
    for (var i = 0; i < this.LAYERS.length; i++) {
      ret = 32768 - ((((32768 - ret) * (32768 - this.LAYERS[i].getInteger(led)))) >> 15);
    }
    return ret;
  }
};

function LayerFunctions(Layer1, Layer2) {
  return new LayerFunctionsClass(Array.from(arguments));
}

class SlowNoiseClass extends FUNCTION {
  constructor(SPEED) {
    super("Returns a value between 0 and 32768, which slowly changes up and down randomly.", Array.from(arguments));
    this.add_arg("SPEED", "FUNCTION", "Change speed");
    this.value = random(32768);
  }
  run(blade) {
    super.run(blade);
    var now = millis();
    var delta = now - this.last_millis;
    this.last_millis = now;
    if (delta > 100) delta = 1;
    var speed = this.SPEED.getInteger(0);
//    console.log("DELTA = " + delta + " SPEED = " + speed + " VALUE="+this.value);
    while (delta > 0) {
      this.value = clamp(this.value + random(speed * 2 + 1) - speed, 0, 32768);
      delta--;
    }
  }
  getInteger(led) { return this.value; }
};

function SlowNoise(SPEED) {
  return new SlowNoiseClass(SPEED);
}

class IsLessThanClass extends FUNCTION {
  constructor(F, V) {
    super("Returns 32768 if F < V, otherwise 0.", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("V", "FUNCTION", "V");
  }
  getInteger(led) {
    return this.F.getInteger(led) < this.V.getInteger(led) ? 32768 : 0;
  }
};

function IsLessThan(F, V) {
  return new IsLessThanClass(F, V);
}

class IsGreaterThanClass extends MACRO {
  constructor(F, V) {
    super("Returns 32768 if F > V, otherwise 0.", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("V", "FUNCTION", "V");
    this.SetExpansion(IsLessThan(V.DOCOPY(), F.DOCOPY()));
  }
};

function IsGreaterThan(F, V) {
  return new IsGreaterThanClass(F, V);
}

class IsBetweenClass extends FUNCTION {
  constructor(F, BOTTOM, TOP) {
    super("Returns 32768 if BOTTOM < F < TOP, otherwise 0.", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("BOTTOM", "FUNCTION", "BOTTOM");
    this.add_arg("TOP", "FUNCTION", "TOP");
  }
  getInteger(led) {
    var f = this.F.getInteger(led);
    return this.BOTTOM.getInteger(led) < f && f < this.TOP.getInteger(led) ? 32768 : 0;
  }
};

function IsBetween(F, BOTTOM, TOP) {
  return new IsBetweenClass(F, BOTTOM, TOP);
}

class ClampFXClass extends FUNCTION {
  constructor(F, MIN, MAX) {
    super("Returns F, clamped to MIN...MAX", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("MIN", "FUNCTION", "MIN");
    this.add_arg("MAX", "FUNCTION", "MAX");
  }
  getInteger(led) {
    return clamp(this.F.getInteger(led), this.MIN.getInteger(led), this.MAX.getInteger(led));
  }
};

function ClampFX(F, MIN, MAX) {
  return new ClampFXClass(F, MIN, MAX);
}

class ClampFClass extends MACRO {
  constructor(F, MIN, MAX) {
    super("Returns F, clamped to MIN...MAX", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("MIN", "INT", "MIN");
    this.add_arg("MAX", "INT", "MAX");
    this.SetExpansion(ClampFX(F.DOCOPY(), Int(MIN), Int(MAX)));
  }
};

function ClampF(F, MIN, MAX) {
  return new ClampFClass(F, MIN, MAX);
}

class VariationClass extends FUNCTION {
  constructor() {
    super("Returns the current variation", arguments);
  }
  getInteger(led) {
    return Variant() & 0x7fff;
  }
};

function Variation() {
  return new VariationClass();
}

class AltFClass extends FUNCTION {
  constructor() {
    super("Returns the current alt", arguments);
  }
  getInteger(led) {
    return Alt() & 0x7fff;
  }
};

function AltF() {
  return new AltFClass();
}

function MOD(x, m) {
  if (x >= 0) return x % m;
  return m + ~((~x) % m)
}

class SyncAltToVarianceFClass extends FUNCTION {
  constructor() {
    super("Synchronizes Alt and Variance.", arguments);
    this.last_ = 0x7fffffff;
  }
  run(blade) {
    super.run(blade)
    if (num_alternatives == 0) return;
    var VAR = MOD(Variant(), num_alternatives);
    if (VAR == this.last_ && Alt() == this.last_) return;
    if (this.last_ == 0x7fffffff) {
      console.log("SYNC FIRST");
//////////// SafeguardInputs PR ///////////////
      FIND("ALT_VALUE").value = VAR;
    } else if (VAR != this.last_) {
      if (isNaN(VAR)) VAR = 0;
      console.log("SYNC ALT: " + VAR);
      FIND("ALT_VALUE").value = VAR;
      blade.addEffect(EFFECT_ALT_SOUND, 0.0);
    } else {
      console.log("SYNC VAR");
      VAR = Alt();
      if (isNaN(VAR)) VAR = 0;
      console.log("SYNC VAR: " + VAR);
//////////// SafeguardInputs PR ///////////////
      FIND("VARIANT_VALUE").value = VAR;
    }
    this.last_ = VAR;
  }
  getInteger(led) { return 0; }
}

function SyncAltToVarianceF() {
  return new SyncAltToVarianceFClass();
}

class SyncAltToVarianceLClass extends MACRO {
  constructor() {
    super("Invisble layer for synchronizing Alt and Variance.", arguments);
    this.SetExpansion(AlphaL(BLACK, SyncAltToVarianceF()));
  }
}

function SyncAltToVarianceL() {
  return new SyncAltToVarianceLClass();
}

class EffectPulseFClass extends FUNCTION {
  constructor() {
    super("Generate a pulse every time an effect occurs", arguments);
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger new random.");
    this.effect = new OneshotEffectDetector(this.EFFECT);
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    if (this.effect.Detect(blade)) {
      this.value = 32768;
    } else {
      this.value = 0;
    }
  }
  getInteger(led) { return this.value; }
};

function EffectPulseF(EFFECT) {
  return new EffectPulseFClass(EFFECT);
}

class IncrementWithResetClass extends SVF_FUNCTION {
  constructor(PULSE, RESET_PULSE, MAX, I) {
    super("Increment by I each time PULSE occurs.", arguments);
    this.add_arg("PULSE", "FUNCTION", "Pulse.");
    this.add_arg("RESET_PULSE", "FUNCTION", "Reset pulse.", Int(0));
    this.add_arg("MAX", "FUNCTION", "Max value", Int(32768));
    this.add_arg("I", "FUNCTION", "Increment", Int(1));
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    if (this.RESET_PULSE.getInteger(0) != 0) {
      this.value = 0;
    }
    if (this.PULSE.getInteger(0) != 0) {
      this.value = min(this.value + this.I.getInteger(0), this.MAX.getInteger(0));
    }
  }
  getInteger(led) { return this.value; }
}

function IncrementWithReset(PULSE, RESET_PULSE, MAX, I) {
  return new IncrementWithResetClass(PULSE, RESET_PULSE, MAX, I);
}

class IncrementModuloFClass extends SVF_FUNCTION {
  constructor(PULSE, MAX, I) {
    super("Increment by I each time PULSE occurs.", arguments);
    this.add_arg("PULSE", "FUNCTION", "Pulse.");
    this.add_arg("MAX", "FUNCTION", "Max value", Int(32768));
    this.add_arg("I", "FUNCTION", "Increment", Int(1));
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    if (this.PULSE.getInteger(0) != 0) {
      this.value = (this.value + this.I.getInteger(0)) % this.MAX.getInteger(0);
    }
  }
  getInteger(led) { return this.value; }
}

function IncrementModuloF(PULSE, MAX, I) {
  return new IncrementModuloFClass(PULSE, MAX, I);
}

class ThresholdPulseFClass extends SVF_FUNCTION {
  constructor(F, THRESHOLD, HYST_PERCENT) {
    super("Generate a Pulse when F > THRESHOLD.", arguments);
    this.add_arg("F", "FUNCTION", "Input");
    this.add_arg("THRESHOLD", "FUNCTION", "Threshold", Int(32768));
    this.add_arg("HYST_PERCENT", "FUNCTION", "Hysteresis percent", Int(66));
    this.value = 0;
    this.triggered = 0;
  }
  run(blade) {
    super.run(blade);
    var f = this.F.getInteger(0);
    var threshold = this.THRESHOLD.getInteger(0);
    this.value = 0;
    if (this.triggered) {
       if (f < threshold * this.HYST_PERCENT.getInteger(0) / 100) {
           this.triggered = false;
       }
    } else {
       if (f >= threshold) {
           this.triggered = true;
           this.value = 32768;
       }
    }
  }
  getInteger(led) { return this.value; }
}

function ThresholdPulseF(F, THRESHOLD, HYST_PERCENT) {
  return new ThresholdPulseFClass(F, THRESHOLD, HYST_PERCENT);
}

class IncrementFClass extends MACRO {
  constructor(F, V, MAX, I, HYST_PERCENT) {
    super("Increase by I every time F > V.", arguments);
    this.add_arg("F", "FUNCTION", "Input");
    this.add_arg("V", "FUNCTION", "Compare value.", Int(32768));
    this.add_arg("MAX", "FUNCTION", "Max value.", Int(32768));
    this.add_arg("I", "FUNCTION", "Increment", Int(1));
    this.add_arg("HYST_PERCENT", "FUNCTION", "Hysteresis percent", Int(66));
    this.SetExpansion(IncrementModuloF(ThresholdPulseF(this.F, this.V, this.HYST_PERCENT), this.MAX, this.I));
  }
};

function IncrementF(F, V, MAX, I, HYST_PERCENT) {
  return new IncrementFClass(F, V, MAX, I, HYST_PERCENT);
}

class EffectIncrementFClass extends MACRO {
  constructor(EFFECT, MAX, I) {
    super("Increase by I every time F > V.", arguments);
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger increment.");
    this.add_arg("MAX", "FUNCTION", "Max value.", Int(32768));
    this.add_arg("I", "FUNCTION", "Increment", Int(1));
    this.SetExpansion(IncrementModuloF(EffectPulseF(this.EFFECT), this.MAX, this.I));
  }
};

function EffectIncrementF(EFFECT, MAX, I) {
  return new EffectIncrementFClass(EFFECT, MAX, I);
}

class EffectRandomFClass extends FUNCTION {
  constructor() {
    super("Select a new random value every time an effect occurs", arguments);
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger new random.");
    this.effect = new OneshotEffectDetector(this.EFFECT);
    this.value = random(32768);
  }
  run(blade) {
    super.run(blade);
    if (this.effect.Detect(blade)) {
      this.value = random(32768);
    }
  }

  getInteger(led) { return this.value; }
};

function EffectRandomF(EFFECT) {
  return new EffectRandomFClass(EFFECT);
}

class EffectPositionClass extends FUNCTION {
  constructor() {
    super("Select a new random value every time an effect occurs", arguments);
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger new random.", EFFECT(EFFECT_NONE));
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    var effect;
    if (this.EFFECT+0 == 0) {
      effect = last_detected_blade_effect;
    } else {
      var e = new OneshotEffectDetector(this.EFFECT);
      effect = e.Detect(blade);
    }
    if (effect) {
       this.value = effect.location * 32768;
    } else {
       this.value = 0;
    }
  }
  getInteger(led) {
    return this.value;
  }
};

function EffectPosition(EFFECT) {
  return new EffectPositionClass(EFFECT);
}

class TimeSinceEffectClass extends FUNCTION {
  constructor() {
    super("Returns milliseconds since effect occured", arguments);
    this.add_arg("EFFECT", "EFFECT", "Effect to get time since.", EFFECT(EFFECT_NONE));
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    var effect;
    if (this.EFFECT == 0) {
      effect = last_detected_blade_effect;
    } else {
      var e = new OneshotEffectDetector(this.EFFECT);
      effect = e.Detect(blade);
    }
    if (effect) {
       this.value = (micros() - effect.start_micros) / 1000;
    }
  }
  getInteger(led) {
    return this.value;
  }
};

function TimeSinceEffect(EFFECT) {
  return new TimeSinceEffectClass(EFFECT);
}

class WavNumClass extends FUNCTION {
  constructor() {
    super("Returns milliseconds since effect occured", arguments);
    this.add_arg("EFFECT", "EFFECT", "Effect to get time since.", EFFECT(EFFECT_NONE));
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    var effect;
    if (this.EFFECT == 0) {
      effect = last_detected_blade_effect;
    } else {
      var e = new OneshotEffectDetector(this.EFFECT);
      effect = e.Detect(blade);
    }
    if (effect) {
       this.value = effect.wavnum;
    }
  }
  getInteger(led) {
    return this.value;
  }
};

function WavNum(EFFECT) {
  return new WavNumClass(EFFECT);
}

class CenterDistFClass extends FUNCTION {
  constructor(CENTER) {
    super("Distance from center.", arguments);
    this.add_arg("CENTER", "FUNCTION", "Center point", Int(16384));
  }
  run(blade) {
    super.run(blade);
    this.num_leds = blade.num_leds();
  }
  getInteger(led) {
    return Math.abs(led * 32768 / this.num_leds - this.CENTER.getInteger(led));
  }
};

function CenterDistF(CENTER) {
  return new CenterDistFClass(CENTER);
}

class BladeAngleXClass extends FUNCTION {
  constructor() {
    super("Blade Angle", arguments);
    this.add_arg("MIN", "FUNCTION", "What angle returns 0.", Int(0));
    this.add_arg("MAX", "FUNCTION", "What angle returns 32768.", Int(32768));
  }
  run(blade) {
    super.run(blade);
    if (IN_FRAME) {
      var min = this.MIN.getInteger(0);
      var max = this.MAX.getInteger(0);
      var v = fract( (BLADE_ANGLE + Math.PI / 2) / Math.PI);
      if (v > 1) v = 2 - v;
      v *= 32768.0;
      this.var_ = clamp((v - min) * 32768 / (max - min), 0, 32768);
    } else {
      var v = Math.sin(millis() * Math.PI / 10000.0)/2.0 + 0.5;
      this.var_ = clamp(v * 32768, 0, 32768);
    }
  }
  getInteger(led) { return this.var_; }
};

function BladeAngleX(MIN, MAX) {
  return new BladeAngleXClass(MIN, MAX);
}

class TwistAngleClass extends FUNCTION {
  constructor() {
    super("Twist Angle", arguments);
    this.add_arg("N", "INT", "Number of up/downs per rotation.", 2);
    this.add_arg("OFFSET", "INT", "Angular offset", 0);
  }
  run(blade) {
    super.run(blade);
    var v = Math.sin(millis() * Math.PI / 3000.0)/2.0 + 0.5;
    this.var_ = clamp(v * 32768, 0, 32768);
  }
  getInteger(led) { return this.var_; }
};

function TwistAngle(N, OFFSET) {
  return new TwistAngleClass(N, OFFSET);
}

class TwistAccelerationClass extends FUNCTION {
  constructor() {
    super("Twist Acceleration", arguments);
    this.add_arg("MAX", "INT", "Acceleration needed to return 32768", 90);
  }
  run(blade) {
    super.run(blade);
    var v = Math.cos(millis() * Math.PI / 3000.0)/2.0 + 0.5;
    this.var_ = clamp(v * 32768, 0, 32768);
  }
  getInteger(led) { return this.var_; }
};

function TwistAcceleration(N, OFFSET) {
  return new TwistAccelerationClass(N, OFFSET);
}

class BladeAngleClass extends MACRO {
  constructor() {
    super("Blade Angle", arguments);
    this.add_arg("MIN", "INT", "What angle returns 0.", 0);
    this.add_arg("MAX", "INT", "What angle returns 32768.", 32768);
    this.SetExpansion(BladeAngleX(Int(this.MIN), Int(this.MAX)));
  }
};

function BladeAngle(MIN, MAX) {
  return new BladeAngleClass(MIN, MAX);
}

class LockupPulseFClass extends FUNCTION {
  constructor() {
    super("32768 if specified lockup type, otherwise 0.", arguments);
    this.add_arg("LOCKUP_TYPE", "LOCKUP_TYPE", "Lockup type");
    this.value_ = 0;
  }
  run(blade) {
    super.run(blade)
    if (STATE_LOCKUP == this.LOCKUP_TYPE) {
      this.value_ = 32768;
    } else {
      this.value_ = 0;
    }
  }
  getInteger(led) { return this.value_; }
}

function LockupPulseF(LOCKUP_TYPE) {
  return new LockupPulseFClass(LOCKUP_TYPE);
}

class ResponsiveLockupLClass extends MACRO {
  constructor(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
    super("Responsive localized lockup layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("TR1", "TRANSITION", "Begin transition", TrInstant());
    this.add_arg("TR2", "TRANSITION", "End transition", TrInstant());
    this.add_arg("TOP", "FUNCTION", "uppermost lockup limit", Scale(BladeAngle(0, 16000), Int(4000), Int(26000)));
    this.add_arg("BOTTOM", "FUNCTION", "lowermost lockup limit", Int(6000));
    this.add_arg("SIZE", "FUNCTION", "lockup size", Scale(SwingSpeed(100), Int(9000), Int(14000)));
    this.SetExpansion(LockupTrL(AlphaL(COLOR, Bump(Scale(BladeAngle(), this.TOP, this.BOTTOM), this.SIZE)),
                                       this.TR1,
                                       this.TR2,
                                       LOCKUP_TYPE(LOCKUP_NORMAL)));;
  }
  argify(state) {
    state.color_argument = LOCKUP_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveLockupL(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
  return new ResponsiveLockupLClass(COLOR, TR1, TR2, TOP, BOTTOM, SIZE);
}

class ResponsiveDragLClass extends MACRO {
  constructor(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
    super("Responsive localized drag layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("TR1", "TRANSITION", "Begin transition", TrInstant());
    this.add_arg("TR2", "TRANSITION", "End transition", TrInstant());
    this.add_arg("SIZE1", "FUNCTION", "lower twist limit", Int(2000));
    this.add_arg("SIZE2", "FUNCTION", "upper twist limit", Int(10000));
    this.SetExpansion(LockupTrL(AlphaL(COLOR, SmoothStep(Int(32000), Scale(TwistAngle(), this.SIZE1, this.SIZE2))),
                                       this.TR1,
                                       this.TR2,
                                       LOCKUP_TYPE(LOCKUP_DRAG)));
  }
  argify(state) {
    state.color_argument = DRAG_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveDragL(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
  return new ResponsiveDragLClass(COLOR, TR1, TR2, TOP, BOTTOM, SIZE);
}

class ResponsiveMeltLClass extends MACRO {
  constructor(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
    super("Responsive localized melt layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.", Mix(TwistAngle(), OrangeRed.DOCOPY(), RED.DOCOPY()));
    this.add_arg("TR1", "TRANSITION", "Begin transition", TrWipeIn(600));
    this.add_arg("TR2", "TRANSITION", "End transition", TrWipe(600));
    this.add_arg("SIZE1", "FUNCTION", "lower twist limit", Int(4000));
    this.add_arg("SIZE2", "FUNCTION", "upper twist limit", Int(10000));
    this.SetExpansion(LockupTrL(AlphaL(this.COLOR, SmoothStep(Int(30000), Scale(TwistAngle(), this.SIZE1, this.SIZE2))),
                                       this.TR1,
                                       this.TR2,
                                       LOCKUP_TYPE(LOCKUP_MELT)));
  }
};

function ResponsiveMeltL(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
  return new ResponsiveMeltLClass(COLOR, TR1, TR2, TOP, BOTTOM, SIZE);
}

class ResponsiveLightningBlockLClass extends MACRO {
  constructor(COLOR, TR1, TR2) {
    super("Responsive lightning block layer", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("TR1", "TRANSITION", "Begin transition", TrInstant());
    this.add_arg("TR2", "TRANSITION", "End transition", TrInstant());
    this.SetExpansion(
     LockupTrL(
       AlphaL(COLOR,
         LayerFunctions(
           Bump(Scale(SlowNoise(Scale(BladeAngle(24000,32768),Int(2100),Int(1000))),Scale(BladeAngle(24000,32768),Int(3000),Int(10000)),Int(16000)),
                Scale(BrownNoiseF(Int(10)),Scale(TwistAngle(),Int(4000),Int(10000)),Scale(TwistAngle(),Int(9000),Int(14000)))),
           Bump(Scale(SlowNoise(Int(2200)),Scale(BladeAngle(24000,32768),Int(26000),Int(18000)),Int(8000)),
                Scale(NoisySoundLevel(),Scale(TwistAngle(),Int(6000),Int(10000)),Scale(TwistAngle(),Int(10000),Int(14000)))),
           Bump(Scale(SlowNoise(Int(2300)),Scale(BladeAngle(24000,32768),Int(20000),Int(16000)),Scale(BladeAngle(24000,32768),Int(30000),Int(24000))),
                Scale(IsLessThan(SlowNoise(Int(2000)),Int(12000)),Scale(NoisySoundLevel(),Scale(TwistAngle(),Int(9000),Int(5000)),Int(0)),Int(0))))),
     this.TR1,
     this.TR2,
     LOCKUP_TYPE(LOCKUP_LIGHTNING_BLOCK)));
  }
  argify(state) {
    state.color_argument = LB_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveLightningBlockL(COLOR, TR1, TR2) {
  return new ResponsiveLightningBlockLClass(COLOR, TR1, TR2);
}

class ResponsiveClashLClass extends MACRO {
  constructor(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
    super("Responsive localized lockup layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("TR1", "TRANSITION", "Begin transition", TrInstant());
    this.add_arg("TR2", "TRANSITION", "End transition", TrFade(200));
    this.add_arg("TOP", "FUNCTION", "uppermost lockup limit", Scale(BladeAngle(0, 16000), Int(4000), Int(26000)));
    this.add_arg("BOTTOM", "FUNCTION", "lowermost lockup limit", Int(6000));
    this.add_arg("SIZE", "FUNCTION", "lockup size", Int(10000));
    this.SetExpansion(TransitionEffectL(TrConcat(this.TR1,
                                                 AlphaL(COLOR, Bump(Scale(BladeAngle(), this.TOP, this.BOTTOM), this.SIZE)),
                                                 this.TR2),
                                        EFFECT(EFFECT_CLASH)));
  }
  argify(state) {
    state.color_argument = CLASH_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveClashL(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
  return new ResponsiveClashLClass(COLOR, TR1, TR2, TOP, BOTTOM, SIZE);
}

class ResponsiveBlastLClass extends MACRO {
  constructor(COLOR, FADE, SIZE, SPEED, TOP, BOTTOM, EFFECT_ARG) {
    super("Responsive localized blast layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("FADE", "FUNCTION", "fadeout time", Int(400));
    this.add_arg("SIZE", "FUNCTION", "blast size", Int(100));
    this.add_arg("SPEED", "FUNCTION", "blast speed", Int(400));
    this.add_arg("TOP", "FUNCTION", "uppermost blast limit", Int(28000));
    this.add_arg("BOTTOM", "FUNCTION", "lowermost blast limit", Int(8000));
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(
      AlphaL(MultiTransitionEffectL(
                   TrWaveX(this.COLOR, this.FADE, this.SIZE, this.SPEED, Scale(BladeAngle(), this.TOP, this.BOTTOM)),
                   this.EFFECT),
             Bump(Scale(BladeAngle(), this.TOP, this.BOTTOM), Int(24000))));
  }
  argify(state) {
    state.color_argument = BLAST_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveBlastL(COLOR, FADE, SIZE, SPEED, TOP, BOTTOM, EFFECT) {
  return new ResponsiveBlastLClass(COLOR, FADE, SIZE, SPEED, TOP, BOTTOM, EFFECT);
}

class ResponsiveBlastWaveLClass extends MACRO {
  constructor(COLOR, FADE, SIZE, SPEED, TOP, BOTTOM, EFFECT_ARG) {
    super("Responsive localized blast layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("FADE", "FUNCTION", "fadeout time", Int(400));
    this.add_arg("SIZE", "FUNCTION", "blast size", Int(100));
    this.add_arg("SPEED", "FUNCTION", "blast speed", Int(400));
    this.add_arg("TOP", "FUNCTION", "uppermost blast limit", Int(28000));
    this.add_arg("BOTTOM", "FUNCTION", "lowermost blast limit", Int(8000));
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(
        MultiTransitionEffectL(
                   TrWaveX(this.COLOR, this.FADE, this.SIZE, this.SPEED, Scale(BladeAngle(), this.TOP, this.BOTTOM)),
                   this.EFFECT));

  }
  argify(state) {
    state.color_argument = BLAST_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveBlastWaveL(COLOR, FADE, SIZE, SPEED, TOP, BOTTOM, EFFECT) {
  return new ResponsiveBlastWaveLClass(COLOR, FADE, SIZE, SPEED, TOP, BOTTOM, EFFECT);
}

class ResponsiveBlastFadeLClass extends MACRO {
  constructor(COLOR, FADE, SIZE, TOP, BOTTOM, EFFECT_ARG) {
    super("Responsive localized blast layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("SIZE", "FUNCTION", "blast size", Int(8000));
    this.add_arg("FADE", "FUNCTION", "fadeout time", Int(400));
    this.add_arg("TOP", "FUNCTION", "uppermost blast limit", Int(28000));
    this.add_arg("BOTTOM", "FUNCTION", "lowermost blast limit", Int(8000));
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(
        MultiTransitionEffectL(
            TrConcat(TrInstant(),
                     AlphaL(this.COLOR, Bump(Scale(BladeAngle(), this.TOP, this.BOTTOM), this.SIZE)),
                     TrFadeX(this.FADE)),
            this.EFFECT));

  }
  argify(state) {
    state.color_argument = BLAST_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveBlastFadeL(COLOR, FADE, SIZE, TOP, BOTTOM, EFFECT) {
  return new ResponsiveBlastFadeLClass(COLOR, FADE, SIZE, TOP, BOTTOM, EFFECT);
}

class ResponsiveStabLClass extends MACRO {
  constructor(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
    super("Responsive localized stab layer.", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("TR1", "TRANSITION", "Begin transition", TrWipeIn(600));
    this.add_arg("TR2", "TRANSITION", "End transition", TrWipe(600));
    this.add_arg("SIZE1", "FUNCTION", "lower twist limit", Int(14000));
    this.add_arg("SIZE2", "FUNCTION", "upper twist limit", Int(8000));
    this.SetExpansion(
       TransitionEffectL(TrConcat(this.TR1,
                                  AlphaL(COLOR, SmoothStep(Int(32000), Scale(BladeAngle(), this.SIZE1, this.SIZE2))),
                                  this.TR2),
                         EFFECT(EFFECT_STAB)));

  }
  argify(state) {
    state.color_argument = STAB_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function ResponsiveStabL(COLOR, TR1, TR2, TOP, BOTTOM, SIZE) {
  return new ResponsiveStabLClass(COLOR, TR1, TR2, TOP, BOTTOM, SIZE);
}

///////

class IgnitionTimeClass extends MACRO {
  constructor(DEFAULT_VALUE) {
    super("arg/wavlen ignition time", arguments);
    this.add_arg("DEFAULT_VALUE", "INT", "Default value.", 300);
    this.SetExpansion(Scale(IsLessThan(IntArg_(ArgumentName(IGNITION_TIME_ARG),this.DEFAULT_VALUE),Int(1)),IntArg_(ArgumentName(IGNITION_TIME_ARG),this.DEFAULT_VALUE),WavLen(EFFECT(EFFECT_IGNITION))));
  }
}

function IgnitionTime(DEFAULT_VALUE) {
  return new IgnitionTimeClass(DEFAULT_VALUE);
}

class RetractionTimeClass extends MACRO {
  constructor(DEFAULT_VALUE) {
    super("arg/wavlen ignition time", arguments);
    this.add_arg("DEFAULT_VALUE", "INT", "Default value.", 0);
    this.SetExpansion(Scale(IsLessThan(IntArg_(ArgumentName(RETRACTION_TIME_ARG),this.DEFAULT_VALUE),Int(1)),IntArg_(ArgumentName(RETRACTION_TIME_ARG),this.DEFAULT_VALUE),WavLen(EFFECT(EFFECT_RETRACTION))));
  }
}

function RetractionTime(DEFAULT_VALUE) {
  return new RetractionTimeClass(DEFAULT_VALUE);
}

////////////////

class SumClass extends FUNCTION {
  constructor(ARGS) {
    super("Add functions together", ARGS);
    this.F = Array.from(ARGS);
    for (var i = 1; i <= this.F.length; i++) {
      this.add_arg("FUN" + i, "FUNCTION", "Function " + i);
    }
  }
  getInteger(led) {
    var ret = 0;
    for (var i = 0; i < this.F.length; i++) {
      ret += this.F[i].getInteger(led);
    }
    return ret;
  }
}

function Sum(ARGS) {
  return new SumClass(Array.from(arguments));
}

class DivideClass extends FUNCTION {
  constructor(F, V) {
    super("Returns F / V", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("V", "FUNCTION", "V");
  }
  getInteger(led) {
    var v = this.V.getInteger(led);
    if (v == 0) return 0;
    return this.F.getInteger(led) / v;
  }
};

function Divide(F, V) {
  return new DivideClass(F, V);
}

class ModFClass extends FUNCTION {
  constructor(F, V) {
    super("Returns F mod V (always positive)", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("V", "FUNCTION", "V");
  }
  getInteger(led) {
    var v = this.V.getInteger(led);
    if (v == 0) return 0;
    return MOD(this.F.getInteger(led), v);
  }
};

function ModF(F, V) {
  return new ModFClass(F, V);
}

class SubtractClass extends FUNCTION {
  constructor(F, V) {
    super("Returns F - V", arguments);
    this.add_arg("F", "FUNCTION", "F");
    this.add_arg("V", "FUNCTION", "V");
  }
  getInteger(led) {
    return this.F.getInteger(led) - this.V.getInteger(led);
  }
};

function Subtract(F, V) {
  return new SubtractClass(F, V);
}
///////

class HoldPeakFClass extends FUNCTION {
  constructor(F, HOLD_MILLIS, SPEED) {
    super("Holds peak values for the given number of millis, then falls at given speed.", arguments);
    this.add_arg("F", "FUNCTION", "Function to process");
    this.add_arg("HOLD_MILLIS", "FUNCTION", "Millis to hold.");
    this.add_arg("SPEED", "FUNCTION", "Decay speed (per second)");
    this.last_micros = micros();
    this.last_peak = 0;
    this.value = 0;
  }
  run(blade) {
    super.run(blade);
    var current = this.F.getInteger(0);
    var hold_millis = this.HOLD_MILLIS.getInteger(0);
    var now = micros();
    var delta = now - this.last_micros;
    this.last_micros = now;
    if (millis() - this.last_peak > hold_millis) {
      if (delta > 1000000) delta = 1;
      delta *= this.SPEED.getInteger(0);
      delta /= 1000000;
      this.value -= delta;
    }
    if (current > this.value) {
      this.value = current;
      this.last_peak = millis();
    }
  }

  getInteger(led) {
    return this.value;
  }
}

function HoldPeakF(F, HOLD_MILLIS, SPEED) {
  return new HoldPeakFClass(F, HOLD_MILLIS, SPEED);
}

///////

class CircularSectionFClass extends FUNCTION {
  constructor(POSITION, FRACTION) {
    super("Circular section", arguments);
    this.add_arg("POSITION", "FUNCTION", "Position of circular secion.");
    this.add_arg("FRACTION", "FUNCTION", "Fraction of circle lit up.");
  }
  run(blade) {
    super.run(blade);
    this.num_leds = blade.num_leds();
    var fraction = this.FRACTION.getInteger(0);
    if (fraction == 32768) {
      this.start = 0;
      this.end = num_leds * 32768;
    } else if (fraction == 0) {
      this.start = 0;
      this.end = 0;
    } else {
      var pos = this.POSITION.getInteger(0);
      this.start = ((pos + 32768 - fraction / 2) & 32767) * this.num_leds;
      this.end = ((pos + fraction / 2) & 32767) * this.num_leds;
    }
    this.num_leds *= 32768;
//    console.log("START="+this.start+" END="+this.end +" num_leds="+this.num_leds);
  }
  getInteger(led) {
    var led_range = new Range(led * 32768, led * 32768 + 32768);
    var black_mix = 0;
    if (this.start <= this.end) {
      black_mix = (new Range(this.start, this.end).Intersect(led_range)).Size();
    } else {
      black_mix = (new Range(0, this.end).Intersect(led_range)).Size() +
                  (new Range(this.start, this.num_leds).Intersect(led_range)).Size();
    }
//    console.log("BLACK MIX = " + black_mix);
    return black_mix;
  }
}

function CircularSectionF(POSITION, FRACTION) {
  return new CircularSectionFClass(POSITION, FRACTION);
}

///////

class MarbleFClass extends FUNCTION {
  constructor(OFFSET, FRICTION, ACCELERATION, GRAVITY) {
    super("Circular marble simulator.", arguments);
    this.add_arg("OFFSET","FUNCTION", "Offset");
    this.add_arg("FRICTION","FUNCTION", "Friction");
    this.add_arg("ACCELERATION","FUNCTION", "Acceleration");
    this.add_arg("GRAVITY","FUNCTION", "Gravity");
    this.last_micros = 0;
    this.pos = 0;
    this.value = 0;
    this.pos = 0.0;
    this.speed = 0.0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var delta = now - this.last_micros;
    this.last_micros = now;
    if (delta > 1000000) delta = 1;
    var fraction = delta / 1000000.0;
    var rad = (this.pos + this.OFFSET.getInteger(0) / 32768.0) * Math.PI * 2.0;
    var down = { x:0.0, y:1.0, z:0.0 };
    var gravity = this.GRAVITY.getInteger(0) / 32768.0;
    var accel = (down.y * Math.sin(rad) + down.z * Math.cos(rad)) * gravity;
    accel += this.ACCELERATION.getInteger(0) / 32768.0;
    accel-= this.speed * this.FRICTION.getInteger(0) / 32768.0;
    this.speed += accel * fraction;
    this.pos = fract(this.pos + this.speed * fraction);
    this.value = this.pos * 32768.0;
  }
  getInteger(led) { return this.value; }
};

function MarbleF(OFFSET, FRICTION, ACCELERATION, GRAVITY) {
  return new MarbleFClass(OFFSET, FRICTION, ACCELERATION, GRAVITY);
}

///////

class LinearSectionFClass extends FUNCTION {
  constructor(POSITION, FRACTION) {
    super("Linear section", arguments);
    this.add_arg("POSITION", "FUNCTION", "Position of linear secion.");
    this.add_arg("FRACTION", "FUNCTION", "Fraction lit up.");
  }
  run(blade) {
    super.run(blade);
    var num_leds = blade.num_leds();
    var fraction = this.FRACTION.getInteger(0);
    var pos = this.POSITION.getInteger(0);
    this.range = new Range(clamp((pos - fraction / 2) * num_leds, 0, 32768 * num_leds), clamp((pos + fraction / 2) * num_leds, 0, 32768 * num_leds));
  }
  getInteger(led) {
    var led_range = new Range(led * 32768, led * 32768 + 32768);
    return this.range.Intersect(led_range).Size();
  }
}

function LinearSectionF(POSITION, FRACTION) {
  return new LinearSectionFClass(POSITION, FRACTION);
}

///////

var start = new Date().getTime();

var current_focus;
var current_focus_url;
var style_tree;

function newCall(Cls) {
  return new (Function.prototype.bind.apply(Cls, arguments));
}

