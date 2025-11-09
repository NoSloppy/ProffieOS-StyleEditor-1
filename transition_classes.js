// TRANSITIONS

function AddBend(O, t, len, scale) {
  if (O.bend) {
    return O.bend(t, len, scale);
  } else {
    return scale * t / len;
  }
}

class BendTimePowXClass extends TIME_FUNCTION {
  constructor(MILLIS, BEND_FUNCTION) {
     super("Bends time like a gamma function.", arguments);
     this.add_arg("MILLIS", "TIME_FUNCTION", "millis");
     this.add_arg("BEND_FUNCTION", "FUNCTION", "bend, 32768 = 1.0");
  }
  getInteger(led) { return this.MILLIS.getInteger(led); }
  bend(t, len, scale) {
    var exponent = this.BEND_FUNCTION.getInteger(0) / 32768.0;
    return scale * Math.pow(AddBend(this.MILLIS, t, len, 1.0), exponent);
  }
}

function BendTimePowX(MILLIS, BEND_FUNCTION) {
  return new BendTimePowXClass(MILLIS, BEND_FUNCTION);
}

class ReverseTimeXClass extends TIME_FUNCTION {
  constructor(MILLIS) {
     super("Reverses time in a transition.", arguments);
     this.add_arg("MILLIS", "TIME_FUNCTION", "millis");
  }
  getInteger(led) { return this.MILLIS.getInteger(led); }
  bend(t, len, scale) {
    return scale - AddBend(this.MILLIS, t, len, scale);
  }
}

function ReverseTimeX(MILLIS) {
  return new ReverseTimeXClass(MILLIS);
}

class BendTimePowInvXClass extends MACRO {
  constructor(MILLIS, BEND_FUNCTION) {
     super("Bends time like an inverted gamma function.", arguments);
     this.add_arg("MILLIS", "TIME_FUNCTION", "millis");
     this.add_arg("BEND_FUNCTION", "FUNCTION", "bend, 32768 = 1.0");
     this.SetExpansion(ReverseTimeX(BendTimePowX(ReverseTimeX(MILLIS.DOCOPY()), BEND_FUNCTION.DOCOPY())));
  }
}

function BendTimePowInvX(MILLIS, BEND_FUNCTION) {
  return new BendTimePowInvXClass(MILLIS, BEND_FUNCTION);
}


class BendTimePowClass extends MACRO {
  constructor(MILLIS, BEND_FUNCTION) {
     super("Bends time like an gamma function.", arguments);
     this.add_arg("MILLIS", "INT", "millis");
     this.add_arg("BEND_FUNCTION", "INT", "bend, 32768 = 1.0");
     this.SetExpansion(BendTimePowX(Int(MILLIS), Int(BEND_FUNCTION)));
  }
}

function BendTimePow(MILLIS, BEND_FUNCTION) {
  return new BendTimePowClass(MILLIS, BEND_FUNCTION);
}

class BendTimePowInvClass extends MACRO {
  constructor(MILLIS, BEND_FUNCTION) {
     super("Bends time like an inverted gamma function.", arguments);
     this.add_arg("MILLIS", "INT", "millis");
     this.add_arg("BEND_FUNCTION", "INT", "bend, 32768 = 1.0");
     this.SetExpansion(BendTimePowInvX(Int(MILLIS), Int(BEND_FUNCTION)));
  }
}

function BendTimePowInv(MILLIS, BEND_FUNCTION) {
  return new BendTimePowInvClass(MILLIS, BEND_FUNCTION);
}

class ReverseTimeClass extends MACRO {
  constructor(MILLIS) {
     super("Reverse time in transitions.", arguments);
     this.add_arg("MILLIS", "INT", "millis");
     this.SetExpansion(ReverseTimeX(Int(MILLIS)));
  }
}

function ReverseTime(MILLIS) {
  return new ReverseTimeClass(MILLIS);
}
//////////// indents and line returns PR ///////////
class TrInstantClass extends TRANSITION {
  constructor() {
    super("Instant transition");
  }
  run(blade) {}
  begin() {}
  done() { return true; }
  getColor(A, B, led) { return B; }
};

function TrInstant() { return new TrInstantClass(); }

class TRANSITION_BASE extends TRANSITION {
  constructor(comment, args) {
    super(comment, args);
    this.add_arg("MILLIS", "TIME_FUNCTION", "transition time in milliseconds");
    this.restart_ = false;
    this.start_millis = 0;
    this.len_ = 0;
  }
  begin() { this.restart_ = true; }
  done() { return this.len_ == 0; }
  run(blade) {
    super.run(blade);
    if (this.restart_) {
      this.start_millis_ = millis();
      this.len_ = this.MILLIS.getInteger(0);
      this.restart_ = false;
    }
  }

  update(scale) {
    if (this.len_ == 0) return scale;
    var ms = millis() - this.start_millis_;
    if (ms > this.len_) {
      this.len_ = 0;
      return scale;
    }
    var ret = AddBend(this.MILLIS, ms, this.len_, scale);
    return ret;
  }
  restart() { return this.restart_; }
};

// Same as TRANSITION_BASE, but with INT argument instead
// of FUNCTION
class TRANSITION_BASE2 extends TRANSITION {
  constructor(comment, args) {
    super(comment, args);
    this.add_arg("MILLIS", "INT", "WipeIn time in milliseconds");
    this.restart_ = false;
    this.start_millis = 0;
    this.len_ = 0;
  }
  begin() { this.restart_ = true; }
  done() { return this.len_ == 0; }
  run(blade) {
    this.MILLIS.run(blade);
    if (this.restart_) {
      this.start_millis_ = millis();
      this.len_ = this.MILLIS.getInteger(0);
      this.restart_ = false;
    }
  }

  update(scale) {
    if (this.len_ == 0) return scale;
    var ms = millis() - this.start_millis_;
    if (ms > this.len_) {
      this.len_ = 0;
      return scale;
    }
    return ms * scale / this.len_;
  }
};

class TrFadeXClass extends TRANSITION_BASE {
  constructor(MILLIS) {
    super("Fading transition", arguments);
  }
  run(blade) {
    super.run(blade);
    this.fade_ = this.update(1.0);
  }
  getColor(A, B, led) {
    return A.mix(B, this.fade_);
  }
};

function TrFadeX(MILLIS) { return new TrFadeXClass(MILLIS); }

class TrFadeClass extends MACRO {
  constructor(MILLIS) {
    super("Fading transition", arguments);
    this.add_arg("MILLIS","INT", "Fade time in milliseconds.");
    this.SetExpansion(TrFadeX(Int(MILLIS)));
  }
}

function TrFade(MILLIS) { return new TrFadeClass(MILLIS); }

class TrSmoothFadeXClass extends TRANSITION_BASE {
  constructor(MILLIS) {
    super("Smooth fading transition", arguments);
  }
  run(blade) {
    super.run(blade);
    this.fade_ = this.update(1.0);
    this.fade_ = this.fade_ * this.fade_ * (3 - 2 * this.fade_);
  }
  getColor(A, B, led) {
    return A.mix(B, this.fade_);
  }
};

function TrSmoothFadeX(MILLIS) { return new TrSmoothFadeXClass(MILLIS); }

class TrSmoothFadeClass extends MACRO {
  constructor(MILLIS) {
    super("Smooth fading transition", arguments);
    this.add_arg("MILLIS","INT", "SmoothFade time in milliseconds.");
    this.SetExpansion(TrSmoothFadeX(Int(MILLIS)));
  }
}

function TrSmoothFade(MILLIS) { return new TrSmoothFadeClass(MILLIS); }

class TrDelayXClass extends TRANSITION_BASE {
  constructor(MILLIS) {
    super("Delay transition", arguments);
  }
  run(blade) {
    super.run(blade);
    this.update(1.0);
  }
  getColor(A, B, led) {
    if (this.done()) return B;
    return A;
  }
}

function TrDelayX(MILLIS) { return new TrDelayXClass(MILLIS); }

class TrDelayClass extends MACRO {
  constructor(MILLIS) {
    super("Delay transition", arguments);
    this.add_arg("MILLIS", "INT", "Delay time in milliseconds.");
    this.SetExpansion(TrDelayX(Int(MILLIS)));
  }
}

function TrDelay(MILLIS) { return new TrDelayClass(MILLIS); }

class TrBoingXClass extends TRANSITION_BASE {
  constructor(MILLIS, N) {
    super("Boing transition", arguments);
    this.add_arg("N", "INT", "Number of back-and-forth");
  }
  run(blade) {
    this.N.run(blade);
    super.run(blade);
    this.fade_ = this.update(2 * this.N.getInteger(0) + 1) % 2.0;
    if (this.fade_ > 1.0) {
      this.fade_ = 2.0 - this.fade_;
    }
  }
  getColor(A, B, led) {
    return A.mix(B, this.fade_);
  }
}

function TrBoingX(MILLIS, N) { return new TrBoingXClass(MILLIS, N); }

class TrBoingClass extends MACRO {
  constructor(MILLIS, N) {
    super("Boing transition", arguments);
    this.add_arg("MILLIS", "INT", "Boing time in milliseconds.");
    this.add_arg("N", "INT", "Number of back-and-forth");
    this.SetExpansion(TrBoingX(Int(MILLIS), N));
  }
}

function TrBoing(MILLIS, N) { return new TrBoingClass(MILLIS, N); }


class TrWipeXClass extends TRANSITION_BASE {
  constructor(MILLIS) {
    super("Wipe transition", arguments);
  }
  run(blade) {
    super.run(blade);
    this.num_leds_ = blade.num_leds();
    this.fade_ = this.update(this.num_leds_);
  }
  getColor(A, B, led) {
    var mix = (new Range(0, this.fade_).Intersect(new Range(led, (led + 1)))).Size();
    return A.mix(B, mix);
  }
}

function TrWipeX(MILLIS) { return new TrWipeXClass(MILLIS); }

class TrWipeClass extends MACRO {
  constructor(MILLIS) {
    super("Wipe transition", arguments);
    this.add_arg("MILLIS", "INT", "Wipe time in milliseconds.");
    this.SetExpansion(TrWipeX(Int(MILLIS)));
  }
}

function TrWipe(MILLIS) { return new TrWipeClass(MILLIS); }

class TrWipeInXClass extends TRANSITION_BASE {
  constructor(MILLIS) {
    super("WipeIn transition", arguments);
  }
  run(blade) {
    super.run(blade);
    this.num_leds_ = blade.num_leds();
    this.fade_ = new Range(this.num_leds_-
                           this.update(this.num_leds_),
                           this.num_leds_);
  }
  getColor(A, B, led) {
    var mix = this.fade_.Intersect(new Range(led, (led + 1))).Size();
    return A.mix(B, mix);
  }
}

function TrWipeInX(MILLIS) { return new TrWipeInXClass(MILLIS); }

class TrWipeInClass extends MACRO {
  constructor(MILLIS) {
    super("WipeIn transition", arguments);
    this.add_arg("MILLIS", "INT", "WipeIn time in milliseconds.");
    this.SetExpansion(TrWipeInX(Int(MILLIS)));
  }
}

function TrWipeIn(MILLIS) { return new TrWipeInClass(MILLIS); }

///// CenterWipe

class TrCenterWipeXClass extends TRANSITION_BASE {
  constructor(MILLIS, POS) {
    super("Center Wipe transition", arguments);
    this.add_arg("POS", "TIME_FUNCTION", "Position", Int(16384));
  }
  run(blade) {
    super.run(blade);
    var center = (this.POS.getInteger(0) * blade.num_leds()) / 32768.0;
    var fade_top = this.update(blade.num_leds() - center);
    var fade_bottom = this.update(center);
    var top = clamp(center + fade_top, center, blade.num_leds());
    var bottom = clamp(center - fade_bottom, 0, center);
    this.range = new Range(bottom, top);
  }
  getColor(A, B, led) {
    var mix = this.range.Intersect(new Range(led, (led + 1))).Size();
    return A.mix(B, mix);
  }
}

function TrCenterWipeX(MILLIS, POS) { return new TrCenterWipeXClass(MILLIS, POS); }

class TrCenterWipeClass extends MACRO {
  constructor(MILLIS, POS) {
    super("WipeIn transition", arguments);
    this.add_arg("MILLIS", "INT", "Center Wipe time in milliseconds.");
    this.add_arg("POS", "INT", "Position", 16384);
    this.SetExpansion(TrCenterWipeX(Int(MILLIS), Int(this.POS)));
  }
}

function TrCenterWipe(MILLIS, POS) { return new TrCenterWipeClass(MILLIS, POS); }

class TrCenterWipeSparkXClass extends MACRO {
  constructor(COLOR, MILLIS, POS) {
    super("WipeIn transition", arguments);
    this.add_arg("COLOR", "COLOR", "Color");
    this.add_arg("MILLIS", "FUNCTION", "Center Wipe time in milliseconds.");
    this.add_arg("POS", "FUNCTION", "Position", Int(16384));
    this.SetExpansion(TrJoin(TrCenterWipeX(MILLIS, this.POS),TrWaveX(COLOR, Sum(MILLIS, MILLIS, MILLIS, MILLIS), Int(200), Sum(MILLIS, MILLIS), this.POS)));
  }
}

function TrCenterWipeSparkX(COLOR, MILLIS, POS) { return new TrCenterWipeSparkXClass(COLOR, MILLIS, POS); }

class TrCenterWipeSparkClass extends MACRO {
  constructor(COLOR, MILLIS, POS) {
    super("WipeIn transition", arguments);
    this.add_arg("COLOR", "COLOR", "Color");
    this.add_arg("MILLIS", "INT", "Center Wipe time in milliseconds.");
    this.add_arg("POS", "INT", "Position", 16384);
    this.SetExpansion(TrJoin(TrCenterWipeX(Int(MILLIS), Int(this.POS)),TrWaveX(COLOR, Sum(Int(MILLIS), Int(MILLIS), Int(MILLIS), Int(MILLIS)), Int(200), Sum(Int(MILLIS), Int(MILLIS)), Int(this.POS))));
  }
}

function TrCenterWipeSpark(COLOR, MILLIS, POS) { return new TrCenterWipeSparkClass(COLOR, MILLIS, POS); }

///// CenterWipeIn

class TrCenterWipeInXClass extends TRANSITION_BASE {
  constructor(MILLIS, POS) {
    super("Center Wipe-in transition", arguments);
    this.add_arg("POS", "FUNCTION", "Position", Int(16384));
  }
  run(blade) {
    super.run(blade);
    var center = (this.POS.getInteger(0) * blade.num_leds()) / 32768.0;
    var fade_top = this.update(blade.num_leds() - center);
    var fade_bottom = this.update(center);
    var top = clamp(blade.num_leds() - fade_top, center, blade.num_leds());
    var bottom = clamp(fade_bottom, 0, center);
    this.range = new Range(bottom, top);
  }
  getColor(A, B, led) {
    var mix = this.range.Intersect(new Range(led, (led + 1))).Size();
    return B.mix(A, mix);
  }
}

function TrCenterWipeInX(MILLIS, POS) { return new TrCenterWipeInXClass(MILLIS, POS); }

class TrCenterWipeInClass extends MACRO {
  constructor(MILLIS, POS) {
    super("WipeIn transition", arguments);
    this.add_arg("MILLIS", "INT", "Center Wipe time in milliseconds.");
    this.add_arg("POS", "INT", "Position", 16384);
    this.SetExpansion(TrCenterWipeInX(Int(MILLIS), Int(this.POS)));
  }
}

function TrCenterWipeIn(MILLIS, POS) { return new TrCenterWipeInClass(MILLIS, POS); }

class TrCenterWipeInSparkXClass extends MACRO {
  constructor(COLOR, MILLIS, POS) {
    super("WipeIn transition", arguments);
    this.add_arg("COLOR", "COLOR", "Color");
    this.add_arg("MILLIS", "TIME_FUNCTION", "Center Wipe time in milliseconds.");
    this.add_arg("POS", "FUNCTION", "Position", Int(16384));
    this.SetExpansion(TrJoin(TrCenterWipeInX(MILLIS, this.POS),TrJoin(TrWaveX(COLOR, MILLIS.DOCOPY(), Int(200), Sum(MILLIS, MILLIS), Int(0)),TrWaveX(COLOR, MILLIS, Int(200), Sum(MILLIS, MILLIS), Int(32768)))));

  }
}

function TrCenterWipeInSparkX(COLOR, MILLIS, POS) { return new TrCenterWipeInSparkXClass(COLOR, MILLIS, POS); }

class TrCenterWipeInSparkClass extends MACRO {
  constructor(COLOR, MILLIS, POS) {
    super("WipeIn transition", arguments);
    this.add_arg("COLOR", "COLOR", "Color");
    this.add_arg("MILLIS", "INT", "Center Wipe time in milliseconds.");
    this.add_arg("POS", "INT", "Position", 16384);
    this.SetExpansion(TrJoin(TrCenterWipeInX(Int(MILLIS), Int(this.POS)),TrJoin(TrWaveX(COLOR, Int(MILLIS), Int(200), Sum(Int(MILLIS), Int(MILLIS)), Int(0)),TrWaveX(COLOR, Int(MILLIS), Int(200), Sum(Int(MILLIS), Int(MILLIS)), Int(32768)))));
  }
}

function TrCenterWipeInSpark(COLOR, MILLIS, POS) { return new TrCenterWipeInSparkClass(COLOR, MILLIS, POS); }

/////

class TrWipeSparkTipXClass extends MACRO {
  constructor(SPARK_COLOR, MILLIS, SIZE) {
    super("TrWipe with sparktip", arguments);
    this.add_arg("SPARK_COLOR", "COLOR", "Spark color");
    this.add_arg("MILLIS", "TIME_FUNCTION", "wipe milliseconds");
    this.add_arg("SIZE", "FUNCTION", "Size of spark.", Int(400));
    this.SetExpansion(TrJoin(TrWipeX(MILLIS),TrSparkX(SPARK_COLOR,this.SIZE,MILLIS,Int(0))));
  }
};

function TrWipeSparkTipX(C, M, S) { return new TrWipeSparkTipXClass(C, M, S); }

class TrWipeSparkTipClass extends MACRO {
  constructor(SPARK_COLOR, MILLIS, SIZE) {
    super("TrWipe with sparktip", arguments);
    this.add_arg("SPARK_COLOR", "COLOR", "Spark color");
    this.add_arg("MILLIS", "INT", "wipe milliseconds");
    this.add_arg("SIZE", "INT", "Size of spark.", 400);
    this.SetExpansion(TrJoin(TrWipe(MILLIS),TrSparkX(SPARK_COLOR,Int(this.SIZE),Int(MILLIS),Int(0))));
  }
};

function TrWipeSparkTip(C, M, S) { return new TrWipeSparkTipClass(C, M, S); }

class TrWipeInSparkTipXClass extends MACRO {
  constructor(SPARK_COLOR, MILLIS, SIZE) {
    super("TrWipeIn with sparktip", arguments);
    this.add_arg("SPARK_COLOR", "COLOR", "Spark color");
    this.add_arg("MILLIS", "TIME_FUNCTION", "wipe milliseconds");
    this.add_arg("SIZE", "FUNCTION", "Size of spark.", Int(400));
    this.SetExpansion(TrJoin(TrWipeInX(MILLIS),TrSparkX(SPARK_COLOR,this.SIZE,MILLIS,Int(32768))));
  }
};

function TrWipeInSparkTipX(C, M, S) { return new TrWipeInSparkTipXClass(C, M, S); }

class TrWipeInSparkTipClass extends MACRO {
  constructor(SPARK_COLOR, MILLIS, SIZE) {
    super("TrWipeIn with sparktip", arguments);
    this.add_arg("SPARK_COLOR", "COLOR", "Spark color");
    this.add_arg("MILLIS", "INT", "wipe milliseconds");
    this.add_arg("SIZE", "INT", "Size of spark.", 400);
    this.SetExpansion(TrJoin(TrWipeIn(MILLIS),TrSparkX(SPARK_COLOR,Int(this.SIZE),Int(MILLIS),Int(32768))));
  }
};

function TrWipeInSparkTip(C, M, S) { return new TrWipeInSparkTipClass(C, M, S); }

//////////// indents and line returns PR ///////////
class TrWaveXClass extends TRANSITION {
  constructor(COLOR, FADEOUT_MS, WAVE_SIZE, WAVE_MS, WAVE_CENTER) {
    super("Wave travelling outwards.", arguments);
    this.add_arg("COLOR", "COLOR", "Wave color.");
    this.add_arg("FADEOUT_MS", "FUNCTION", "Fadeout time in milliseconds.", Int(200));
    this.add_arg("WAVE_SIZE", "FUNCTION", "Wave size.", Int(100));
    this.add_arg("WAVE_MS", "FUNCTION", "Wave millis.", Int(400));
    this.add_arg("WAVE_CENTER", "FUNCTION", "Wave center.", Int(16384));
    this.restart_ = false;
    this.start_millis = 0;
    this.len_ = 0;
  }
  begin() { this.restart_ = true; }
  done() { return this.len_ == 0; }
  run(blade) {
    super.run(blade);

    if (this.restart_) {
      this.center_ = this.WAVE_CENTER.getInteger(0);
      this.size_ = this.WAVE_SIZE.getInteger(0);

      this.start_millis_ = millis();
      this.len_ = this.FADEOUT_MS.getInteger(0);
      this.restart_ = false;
    }

    this.mix_ = 32768 - this.update(32768);
    this.num_leds_ = blade.num_leds();
    this.offset_ = (millis() - this.start_millis_) * 32768 / this.WAVE_MS.getInteger(0);
  }
  getColor(A, B, led) {
    var dist = Math.abs(this.center_ - led * 32768 / this.num_leds_);
    var N = Math.abs(dist - this.offset_) * this.size_ >> 15;
    var mix;
    if (N <= 32) {
      mix = blast_hump[N] * this.mix_ >> 8;
    } else {
      mix = 0;
    }
    return A.mix(this.COLOR.getColor(led), mix / 32768.0);
  }

  update(scale) {
    if (this.len_ == 0) return scale;
    var ms = millis() - this.start_millis_;
    if (ms > this.len_) {
      this.len_ = 0;
      return scale;
    }
    return ms * scale / this.len_;
  }
};

function TrWaveX(COLOR, FADEOUT_MS, WAVE_SIZE, WAVE_MS, WAVE_CENTER) {
  return new TrWaveXClass(COLOR, FADEOUT_MS, WAVE_SIZE, WAVE_MS, WAVE_CENTER);
}

class TrSparkXClass extends TRANSITION {
  constructor(COLOR, SPARK_SIZE, SPARK_MS, SPARK_CENTER) {
    super("Spark wave transition", arguments);
    this.add_arg("COLOR", "COLOR", "Color.");
    this.add_arg("SPARK_SIZE", "FUNCTION", "Spark size.", Int(100));
    this.add_arg("SPARK_MS", "TIME_FUNCTION", "Spark MS", Int(100));
    this.add_arg("SPARK_CENTER", "FUNCTION", "Spark center.", Int(16384));
    this.millis = new TRANSITION_BASE("millis", [this.SPARK_MS]);
  }
  begin() {
    this.millis.begin();
  }
  run(blade) {
    super.run(blade);
    if (this.millis.restart()) {
      this.center = this.SPARK_CENTER.getInteger(0);
      this.size = this.SPARK_SIZE.getInteger(0);
    }
    this.millis.run(blade);
    this.num_leds = blade.num_leds();
    this.offset = this.millis.update(32768);
  }
  done() {
    return this.millis.done();
  }
  getColor(A, B, led) {
    var dist = Math.abs(this.center - led * 32768 / this.num_leds);
    var N = Math.abs(dist - this.offset) * this.size >> 15;
    var mix;
    if (N <= 32) {
      mix = blast_hump[N] << 7;
    } else {
      mix = 0;
    }
    return A.mix(this.COLOR.getColor(led), mix / 32768.0);
  }
};

function TrSparkX(COLOR, SPARK_SIZE, SPARK_MS, SPARK_CENTER) {
  return new TrSparkXClass(COLOR, SPARK_SIZE, SPARK_MS, SPARK_CENTER);
}

class TrColorCycleXClass extends TRANSITION_BASE {
  constructor(MILLIS, START_RPM, END_RPM) {
    super("ColorCycle transition", arguments);
    this.add_arg("START_RPM", "INT", "RPM at the beginning of transition", 0);
    this.add_arg("END_RPM", "INT", "RPM at the end of transition", 6000);
    this.pos_ = 0.0;
    this.last_micros_ = 0.0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var delta = now - this.last_micros_;
    this.last_micros_ = now;
    if (delta > 1000000) delta = 1;

    this.fade_ = this.update(1.0);

    var current_rpm = this.START_RPM.getInteger(0) * (1 - this.fade_) + this.END_RPM.getInteger(0) * this.fade_;
    var current_percentage = 100.0 * this.fade_;
    this.pos_ = fract(this.pos_ + delta / 60000000.0 * current_rpm);
    this.num_leds_ = blade.num_leds();
    this.start_ = this.pos_ * this.num_leds_;
    if (current_percentage == 100.0) {
      this.start_ = 0;
      this.end_ = this.num_leds_;
    } else if (current_percentage == 0.0) {
      this.start_ = 0;
      this.end_ = 0;
    } else {
      this.end_ = fract(this.pos_ + current_percentage / 100.0) * this.num_leds_;
    }
  }
  getColor(A, B, led) {
    var led_range = new Range(led, led + 1);
    var mix = 0;
    if (this.start_ <= this.end_) {
      mix = (new Range(this.start_, this.end_).Intersect(led_range)).Size();
    } else {
      mix = (new Range(0, this.end_).Intersect(led_range)).Size() +
                  (new Range(this.start_, this.num_leds_).Intersect(led_range)).Size();
    }
    return A.mix(B, mix);
  }
}

function TrColorCycleX(MILLIS, START_RPM, END_RPM) { return new TrColorCycleXClass(MILLIS, START_RPM, END_RPM); }

class TrColorCycleClass extends MACRO {
  constructor(MILLIS, START_RPM, END_RPM) {
    super("ColorCycle transition", arguments);
    this.add_arg("MILLIS", "INT", "Transition length in milliseconds.")
    this.add_arg("START_RPM", "INT", "RPM at the beginning of transition", 0);
    this.add_arg("END_RPM", "INT", "RPM at the end of transition", 6000);
    this.SetExpansion(TrColorCycleX(Int(MILLIS), this.START_RPM, this.END_RPM))
  }
}

function TrColorCycle(MILLIS, START_RPM, END_RPM) { return new TrColorCycleClass(MILLIS, START_RPM, END_RPM); }

class TrConcatClass extends TRANSITION {
  constructor(ARGS) {
    super("Concatenate transitions", ARGS);
    this.ARGS = Array.from(ARGS);
    this.add_arg("TRANSITION", "TRANSITION","Transition");
    for (var i = 1; i < this.ARGS.length - 1; i++) {
      if (this.ARGS[i].getType() == "TRANSITION") {
        this.add_arg("TRANSITION" + i, "TRANSITION", "Transiton " + i);
      } else {
        this.add_arg("COLOR" + i, "COLOR", "Color " + i);
      }
    }
    // Last argument must be a transition.
    this.add_arg("TRANSITION" + i, "TRANSITION", "Transiton " + i);
    this.pos_ = this.ARGS.length;
    this.c1p = -1;
    this.c2p = -1;
  }
  updateC2P() {
     for (var i = this.pos_ + 1; i < this.ARGS.length - 1; i++) {
       if (this.ARGS[i].getType() != "TRANSITION") {
         this.c2p = i;
         return;
       }
     }
     this.c2p = -1;
  }
  begin() {
    this.pos_ = 0;
    this.c1p = -1;
    this.updateC2P();
    this.ARGS[0].begin();
  }
  done() {
    return this.pos_ >= this.ARGS.length;
  }

  run(blade) {
    if (this.done()) return;
    if (this.c1p != -1) this.ARGS[this.c1p].run(blade);
    if (this.c2p != -1) this.ARGS[this.c2p].run(blade);
    while (this.pos_ < this.ARGS.length) {
      this.ARGS[this.pos_].run(blade);
      if (!this.ARGS[this.pos_].done()) break;
      this.pos_++;
      if (this.done()) break;
      if (this.ARGS[this.pos_].getType() != "TRANSITION") {
        this.c1p = this.c2p;
        this.updateC2P()
        if (this.c2p != -1) this.ARGS[this.c2p].run(blade);
        this.pos_++;
      }
      if (this.done()) break;
      this.ARGS[this.pos_].begin();
    }
  }
  getColor(A, B, led) {
    if (this.done()) return B;
    if (this.c1p != -1) A = this.ARGS[this.c1p].getColor(led);
    if (this.c2p != -1) B = this.ARGS[this.c2p].getColor(led);
    return this.ARGS[this.pos_].getColor(A, B, led);
  }
};

function TrConcat(ARGS) {
  return new TrConcatClass(Array.from(arguments));
}

class TrJoinClass extends TRANSITION {
  constructor(ARGS) {
    super("Join transitions", ARGS);
    this.ARGS = Array.from(ARGS);
    for (var i = 0; i < this.ARGS.length; i++) {
      this.add_arg("TRANSITION" + i, "TRANSITION", "Transiton " + i);
    }
  }
  begin() {
    for (var i = 0; i < this.ARGS.length; i++) this.ARGS[i].begin();
  }
  done() {
    for (var i = 0; i < this.ARGS.length; i++) if (!this.ARGS[i].done()) return false;
    return true;
  }
  getColor(A, B, led) {
    for (var i = 0; i < this.ARGS.length; i++) {
      A = this.ARGS[i].getColor(A, B, led);
    }
    return A;
  }
};

function TrJoin(ARGS) { return new TrJoinClass(arguments); }

class TrJoinRClass extends TRANSITION {
  constructor(ARGS) {
    super("Right join transitions", ARGS);
    this.ARGS = Array.from(ARGS);
    for (var i = 0; i < this.ARGS.length; i++) {
      this.add_arg("TRANSITION" + i, "TRANSITION", "Transiton " + i);
    }
  }
  begin() {
    for (var i = 0; i < this.ARGS.length; i++) this.ARGS[i].begin();
  }
  done() {
    for (var i = 0; i < this.ARGS.length; i++) if (!this.ARGS[i].done()) return false;
    return true;
  }
  getColor(A, B, led) {
    for (var i = 0; i < this.ARGS.length; i++) {
      B = this.ARGS[i].getColor(A, B, led);
    }
    return B;
  }
};

function TrJoinR(ARGS) { return new TrJoinRClass(arguments); }

class TrRandomClass extends TRANSITION {
  constructor(ARGS) {
    super("Random transitions", ARGS);
    this.ARGS = Array.from(ARGS);
    for (var i = 0; i < this.ARGS.length; i++) {
      this.add_arg("TRANSITION" + i, "TRANSITION", "Transiton " + i);
    }
    this.pos_ = random(this.ARGS.length);
  }
  begin() {
    this.pos_ = random(this.ARGS.length);
    this.ARGS[this.pos_].begin();
  }
  done() {
    return this.ARGS[this.pos_].done();
  }
  getColor(A, B, led) {
    return this.ARGS[this.pos_].getColor(A, B, led);
  }
};

function TrRandom(ARGS) { return new TrRandomClass(Array.from(arguments)); }

class TrSelectClass extends TRANSITION {
  constructor(ARGS) {
    super("Select transitions", ARGS);
    this.TRANSITIONS = Array.from(ARGS).slice(1);
    this.add_arg("F", "FUNCTION", "This FUNCTION selects which of the transitions to use");
    for (var i = 1; i <= max(this.TRANSITIONS.length, 1); i++) {
      this.add_arg("TRANSITION" + i, "TRANSITION", "Transiton " + i);
    }
    this.begin_ = true;
  }
  begin() {
    this.begin_ = true;
  }
  run(blade) {
    this.F.run(blade);
    if (this.begin_) {
      var f = this.F.getInteger(0) + 0;
      while (f < 0) f += this.TRANSITIONS.length * 255;
      f %= this.TRANSITIONS.length;
      this.selected = this.TRANSITIONS[f % this.TRANSITIONS.length];
      this.selected.begin();
      this.begin_ = false;
    }
    this.selected.run(blade);
  }
  done() {
    return this.selected && this.selected.done();
  }
  getColor(A, B, led) {
    return this.selected.getColor(A, B, led);
  }
};

function TrSelect(ARGS) {
  return new TrSelectClass(Array.from(arguments));
}

class TrSequenceClass extends TRANSITION {
  constructor(ARGS) {
    super("Sequence transitions", ARGS);
    this.TRANSITIONS = Array.from(ARGS);
    for (var i = 0; i < this.TRANSITIONS.length; i++) {
      this.add_arg("TRANSITION" + (i + 1), "TRANSITION", "Transition " + (i + 1));
    }
    this.n_ = -1;
    this.begin_ = true;
  }

  begin() {
    this.begin_ = true;
  }

  run(blade) {
    if (this.begin_) {
      this.begin_ = false;
      this.n_ = (this.n_ + 1) % this.TRANSITIONS.length;
      this.selected = this.TRANSITIONS[this.n_];
      this.selected.begin();
    }
    this.selected.run(blade);
  }

  getColor(A, B, led) {
    return this.selected.getColor(A, B, led);
  }

  done() {
    return this.selected && this.selected.done();
  }
}

function TrSequence(ARGS) {
  return new TrSequenceClass(Array.from(arguments));
}

class TrExtendXClass extends TRANSITION {
  constructor(MILLIS, TRANSITION) {
    super("Extend a transition.", arguments);
    this.add_arg("MILLIS", "TIME_FUNCTION", "How much to extend the transition.");
    this.add_arg("TRANSITION", "TRANSITION", "Transition to extend.");
    this.extending = false;
    this.millis = new TRANSITION_BASE("millis", [this.MILLIS]);
  }
  begin() {
    this.extending = false;
    this.TRANSITION.begin();
  }
  run(blade) {
    this.TRANSITION.run(blade);
    if (!this.extending && this.TRANSITION.done()) {
        this.extending = true;
        this.millis.begin();
    }
    if (this.extending) {
       this.millis.run(blade);
       this.millis.update(0);
    }
  }
  done() { return this.extending && this.millis.done(); }
  getColor(A, B, led) {
    return this.TRANSITION.getColor(A, B, led);
  }
};

function TrExtendX(MILLIS, TRANSACTION) {
  return new TrExtendXClass(MILLIS, TRANSACTION);
}

class TrExtendClass extends MACRO {
  constructor(MILLIS, TRANSITION) {
    super("Extend a transition.", arguments);
    this.add_arg("MILLIS", "INT", "How much to extend the transition.");
    this.add_arg("TRANSITION", "TRANSITION", "Transition to extend.");
    this.SetExpansion(TrExtendX(Int(MILLIS), TRANSITION));
  }
};

function TrExtend(MILLIS, TRANSACTION) {
  return new TrExtendClass(MILLIS, TRANSACTION);
}

class TrBlinkXClass extends TRANSITION_BASE {
  constructor(MILLIS, N, WIDTH) {
    super("Blink N times", arguments);
    this.add_arg("N", "INT", "How many times to blink.");
    this.add_arg("WIDTH", "FUNCTION", "Blink pulse width, 16384 = 50%", Int(16384));
    this.blink = false
  }
  run(blade) {
    super.run(blade);
    this.blink = (this.update(32768 * this.N) & 0x7fff) < this.WIDTH.getInteger(0);
  }
  getColor(a, b, led) {
    if (this.blink) return a;
    return b;
  }
}

function TrBlinkX(MILLIS, N, WIDTH) {
  return new TrBlinkXClass(MILLIS, N, WIDTH);
}

class TrBlinkClass extends MACRO {
  constructor(MILLIS, N, WIDTH) {
    super("Blink N times", arguments);
    this.add_arg("MILLIS", "INT", "Transition length in milliseconds.")
    this.add_arg("N", "INT", "How many times to blink.");
    this.add_arg("WIDTH", "INT", "Blink pulse width, 16384 = 50%", 16384);
    this.SetExpansion(TrBlinkX(Int(MILLIS), N, Int(this.WIDTH)));
  }
}

function TrBlink(MILLIS, N, WIDTH) {
  return new TrBlinkClass(MILLIS, N, WIDTH);
}

class TrDoEffectAlwaysXClass extends TRANSITION {
  constructor(TRANSITION, EFFECT, WAVNUM, LOCATION) {
    super("Do effect", arguments);
    this.add_arg("TRANSITION","TRANSITION", "Wrapped transition");
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger.");
    this.add_arg("WAVNUM", "FUNCTION", "Select wave number.", Int(-1));
    this.add_arg("LOCATION", "FUNCTION", "Effect location.", Int(-1));
    this.begin_ = false;
  }
  begin() {
    this.TRANSITION.begin();
    this.begin_ = true;
  }
  run(blade) {
    super.run(blade);
    if (this.begin_) {
      var location = this.LOCATION.getInteger(0);
      if (location == -1) location = random(32768)/32768.0;
      blade.addEffect(this.EFFECT, location);
      this.begin_ = false;
    }
  }
  done() { return this.TRANSITION.done(); }
  getColor(a, b, led) { return this.TRANSITION.getColor(a, b, led); }
}

function TrDoEffectAlwaysX(TRANSITION, EFFECT, WAVNUM, LOCATION) {
  return new TrDoEffectAlwaysXClass(TRANSITION, EFFECT, WAVNUM, LOCATION);
}

class TrDoEffectAlwaysClass extends MACRO {
  constructor(TRANSITION, EFFECT, WAVNUM, LOCATION) {
    super("Do effect", arguments);
    this.add_arg("TRANSITION","TRANSITION", "Wrapped transition");
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger.");
    this.add_arg("WAVNUM", "INT", "Select wave number.", -1);
    this.add_arg("LOCATION", "INT", "Effect location.", -1);
    this.SetExpansion(TrDoEffectAlwaysX(TRANSITION, EFFECT, Int(this.WAVNUM), Int(this.LOCATION)));
  }
}

function TrDoEffectAlways(TRANSITION, EFFECT, WAVNUM, LOCATION) {
  return new TrDoEffectAlwaysClass(TRANSITION, EFFECT, WAVNUM, LOCATION);
}
//////////// indents and line returns PR ///////////
class TrDoEffectXClass extends TRANSITION {
  constructor(TRANSITION, EFFECT, WAVNUM, LOCATION) {
    super("Do effect", arguments);
    this.add_arg("TRANSITION","TRANSITION", "Wrapped transition");
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger.");
    this.add_arg("WAVNUM", "FUNCTION", "Select wave number.", Int(-1));
    this.add_arg("LOCATION", "FUNCTION", "Effect location.", Int(-1));
    this.begin_ = false;
    this.done_ = false;
  }
  begin() {
    this.TRANSITION.begin();
    this.begin_ = true;
    this.done_ = false;
  }
  run(blade) {
    super.run(blade);
    if (this.begin_) {
      if (blade.is_on()) {
        var location = this.LOCATION.getInteger(0);
        if (location == -1) location = random(32768)/32768.0;
        blade.addEffect(this.EFFECT.value, location);
      }
      this.begin_ = false;
    }
    if (!this.done_) {
      /*
        if (!blade.is_on() && !blade.is_powered()) {
          this.done_ = true;
        }
      */
    }
  }
  done() { return this.done_ || this.TRANSITION.done(); }
  getColor(a, b, led) {
    if (this.done_) return b;
    return this.TRANSITION.getColor(a, b, led);
  }
}

function TrDoEffectX(TRANSITION, EFFECT, WAVNUM, LOCATION) {
  return new TrDoEffectXClass(TRANSITION, EFFECT, WAVNUM, LOCATION);
}

class TrDoEffectClass extends MACRO {
  constructor(TRANSITION, EFFECT, WAVNUM, LOCATION) {
    super("Do effect", arguments);
    this.add_arg("TRANSITION","TRANSITION", "Wrapped transition");
    this.add_arg("EFFECT", "EFFECT", "Effect to trigger.");
    this.add_arg("WAVNUM", "INT", "Select wave number.", -1);
    this.add_arg("LOCATION", "INT", "Effect location.", -1);
    this.SetExpansion(TrDoEffectX(TRANSITION, EFFECT, Int(this.WAVNUM), Int(this.LOCATION)));
  }
}

function TrDoEffect(TRANSITION, EFFECT, WAVNUM, LOCATION) {
  return new TrDoEffectClass(TRANSITION, EFFECT, WAVNUM, LOCATION);
}


class TrLoopClass extends TRANSITION {
  constructor(TRANSITION) {
    super("Loop transition", arguments);
    this.add_arg("TRANSITION", "TRANSITION", "Transition to loop");
  }
  run(blade) {
    if (this.TRANSITION.done()) this.TRANSITION.begin();
    super.run(blade);
  }
  begin() { this.TRANSITION.begin(); }
  done() { return false; }
  getColor(a, b, led) { return this.TRANSITION.getColor(a, b, led); }
}

function TrLoop(TRANSITION) {
  return new TrLoopClass(TRANSITION);
}

class TrLoopNXClass extends TRANSITION {
  constructor(N, TRANSITION) {
    super("Loop transition", arguments);
    this.add_arg("N","FUNCTION", "How many loops.");
    this.add_arg("TRANSITION", "TRANSITION", "Transition to loop");
    this.loops = 0;
  }
  run(blade) {
    this.N.run(blade);
    if (this.loops < 0) this.loops = this.N.getInteger(0) + 1;
    if (this.loops > 0 && this.TRANSITION.done()) {
       if (this.loops > 1) this.TRANSITION.begin();
       this.loops --;
    }
    this.TRANSITION.run(blade);
  }
  begin() {
    this.TRANSITION.begin();
    this.loops = -1;
  }
  done() { return this.loops == 0; }
  getColor(a, b, led) { return this.TRANSITION.getColor(a, b, led); }
}

function TrLoopNX(N, TRANSITION) {
  return new TrLoopNXClass(N, TRANSITION);
}

class TrLoopNClass extends MACRO {
  constructor(N, TRANSITION) {
    super("Loop transition", arguments);
    this.add_arg("N","INT", "How many loops.");
    this.add_arg("TRANSITION", "TRANSITION", "Transition to loop");
    this.SetExpansion(TrLoopNX(Int(N), TRANSITION))
  }
}

function TrLoopN(N, TRANSITION) {
  return new TrLoopNClass(N, TRANSITION);
}

class TrLoopUntilClass extends TRANSITION {
  constructor(PULSE, TR, OUT) {
    super("Loop transition until pulse occurs.", arguments);
    this.add_arg("PULSE", "FUNCTION", "Pulse");
    this.add_arg("TR", "TRANSITION", "Transition");
    this.add_arg("OUT", "TRANSITION", "Fade-out transition");
    this.pulsed = false;
  }
  begin() {
    this.TR.begin();
    this.pulsed = false;
  }
  done() {
    return this.pulsed && this.OUT.done();
  }
  run(blade) {
    this.PULSE.run(blade);
    if (this.TR.done()) {
      this.TR.begin();
    }
    this.TR.run(blade);
    if (!this.pulsed) {
      if (this.PULSE.getInteger(0) != 0) {
        this.OUT.begin();
        this.pulsed = true;
      }
    }
    if (this.pulsed) {
      this.OUT.run(blade);
    }
  }
  getColor(a, b, led) {
    var ret = this.TR.getColor(a, a, led);
    if (this.pulsed) {
       ret = this.TR.getColor(ret, b, led);
    }
    return ret;
  }
}

function TrLoopUntil(PULSE, TR, OUT) {
  return new TrLoopUntilClass(PULSE, TR, OUT);
}

