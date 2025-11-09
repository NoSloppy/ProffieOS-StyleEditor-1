class RgbClass extends STYLE {
  constructor(r,g,b,a) {
    super();
    this.r = IntArg(r)/255.0;
    this.g = IntArg(g)/255.0;
    this.b = IntArg(b)/255.0;
    if (this.r < 0) throw "Red is negative";
    if (this.g < 0) throw "Blue is negative";
    if (this.b < 0) throw "Green is negative";
    if (this.r > 1.0) throw "Red too big.";
    if (this.g > 1.0) throw "Green too big.";
    if (this.b > 1.0) throw "Blue too big.";
    if (a == undefined) {
      this.a = 1.0;
      this.name = colorNames[r+","+g+","+b]
    } else {
      this.a = a;
    }
  }
  run(blade) {}
  getColor(led) {
    return this;
  }
  pp() {
    if (this.name) return this.PPshort(this.name,"Color");
    return this.PPshort("Rgb",  "RGB Color",
                        Math.round(this.r*255), "Red component",
                        Math.round(this.g*255), "Green component",
                        Math.round(this.b*255), "Blue component");
  }
  mix(other, blend) {
    var ret = new RgbClass(0,0,0);
    ret.r = other.r * blend + this.r * (1.0 - blend);
    ret.g = other.g * blend + this.g * (1.0 - blend);
    ret.b = other.b * blend + this.b * (1.0 - blend);
    ret.a = other.a * blend + this.a * (1.0 - blend);
    return ret;
  }
  multiply(v) {
    var ret = new RgbClass(0,0,0);
    ret.r = this.r * v;
    ret.g = this.g * v;
    ret.b = this.b * v;
    ret.a = this.a * v;
    return ret;
  }
  paintOver(other) {
    var ret = new RgbClass(0,0,0);
    ret.r = this.r * (1.0 - other.a) + other.r;
    ret.g = this.g * (1.0 - other.a) + other.g;
    ret.b = this.b * (1.0 - other.a) + other.b;
    ret.a = this.a * (1.0 - other.a) + other.a;
    return ret;
  }

  // angle = 0 - 98304 (32768 * 3) (non-inclusive)
  rotate(angle) {
    var H;
    if (angle == 0) return this;
    var MAX = max(this.r, this.g, this.b);
    var MIN = min(this.r, this.g, this.b);
    var C = MAX - MIN;
    if (C == 0) return this;  // Can't rotate something without color.
    // Note 16384 = 60 degrees.
    if (this.r == MAX) {
      // r is biggest
      H = (this.g - this.b) / C;
    } else if (this.g == MAX) {
      // g is biggest
      H = (this.b - this.r) / C + 2;
    } else {
      // b is biggest
      H = (this.r - this.g) / C + 4;
    }
    H += angle / 16384.0;
    return new RgbClass(f(5+H, C, MAX), f(3+H, C, MAX), f(1+H, C, MAX));
  }
//////////// Because....vite PR ///////////
  argify(state) {
    if (state.color_argument) {
      var ret = RgbArg_(ArgumentName(state.color_argument), this);
      state.color_argument = false;
      return ret;
    } else {
      return this;
    }
  }
};

function f(n, C, MAX) {
  var k = n % 6;
  var x = MAX - C * clamp(min(k, 4 - k), 0, 1);
  return x*255.0;
}

function Rgb(r,g,b) {
  return new RgbClass(r,g,b);
}

function Transparent(r,g,b) {
  var ret = Rgb(0,0,0)
  ret.a = 0.0;
  return ret;
}

class Rgb16Class extends RgbClass {
  constructor(r,g,b) {
    super(r * 255.0/65535.0,g * 255.0/65535.0,b * 255.0/65535.0);
//    this.name = colorNames[r+","+g+","+b]
//    this.name
  }
  run(blade) {}
  getColor(led) {
    return this;
  }
  pp() {
    if (this.name) return this.PPshort(this.name,"Color");
    return this.PPshort("Rgb16",  "RGB Color",
                        Math.round(this.r*65535), "Red component",
                        Math.round(this.g*65535), "Green component",
                        Math.round(this.b*65535), "Blue component");
  }
};

function RgbF(r,g,b) {
  return new Rgb16Class(r * 65535,g * 65535,b * 65535);
}


function Rgb16(r,g,b) {
  return new Rgb16Class(r,g,b);
}

class AlphaLClass extends STYLE {
  isEffect() { return this.ALPHA.isEffect(); }
  constructor(COLOR, ALPHA) {
    super("Makes transparent color", Array.from(arguments));
    this.add_arg("COLOR", "COLOR", "COLOR");
    this.add_arg("ALPHA", "FUNCTION", "Alpha function");
  }
  getColor(led) {
    var ret = this.COLOR.getColor(led);
    if (ret == 0) return Transparent(0,0,0);
    return ret.multiply(this.ALPHA.getInteger(led)/32768.0)
  }
  IS_RUNNING() {
    if (this.ALPHA.IS_RUNNING)
      return this.ALPHA.IS_RUNNING();
    if (this.COLOR.IS_RUNNING)
      return this.COLOR.IS_RUNNING();
    return false;
  }
};

function AlphaL(COLOR, ALPHA) {
  return new AlphaLClass(COLOR, ALPHA);
}

class AlphaMixLClass extends MACRO {
  constructor(ARGS) {
    super("Mix and alpha", ARGS);
    this.COLORS = Array.from(ARGS).slice(1);
    this.add_arg("F", "FUNCTION", "0=first color, 32768=last color");
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);
    this.SetExpansion(AlphaL(new MixClass(ARGS), this.F.DOCOPY()));
  }
}

function AlphaMixL(F, C1, C2) {
  return new AlphaMixLClass(Array.from(arguments));
};

function ReplaceNode(old_node, new_node) {
  FocusOnLow(old_node.get_id());
  pp_is_url++;
  FIND("style").value = new_node.pp();
  pp_is_url--;
  Run();
}

function DuplicateLayer(id, arg, event) {
  event.stopPropagation();
  console.log("DuplicateLayer: "+id +", "+arg);
  arg-=2;
  var layer = style_ids[id];
  var new_layer = new LayersClass( [layer.BASE].concat(layer.LAYERS.slice(0, arg), [layer.LAYERS[arg].DOCOPY()], layer.LAYERS.slice(arg)) );
  ReplaceNode(layer, new_layer);
}

function RemoveLayer(id, arg, event) {
  event.stopPropagation();
  console.log("RemoveLayer: "+id +", "+arg);
  arg-=2;
  var layer = style_ids[id];
  var new_layer = new LayersClass( [layer.BASE].concat(layer.LAYERS.slice(0, arg), layer.LAYERS.slice(arg+1)) );
  ReplaceNode(layer, new_layer);
}

function DownLayer(id, arg, event) {
  event.stopPropagation();
  console.log("DownLayer: "+id +", "+arg);
  arg-=2;
  var layer = style_ids[id];
  var new_layer = new LayersClass( [layer.BASE].concat(layer.LAYERS.slice(0, arg),
                                    [layer.LAYERS[arg+1], layer.LAYERS[arg]],
                                    layer.LAYERS.slice(arg+2)) );
  ReplaceNode(layer, new_layer);
}

function UpLayer(id, arg, event) {
  console.log("UpLayer: "+id +", "+arg);
  DownLayer(id, arg-1, event);
}

class LayersClass extends STYLE {
  Indent(text) {
    if (text.substr(0, 2) == '/*') {
      var tmp = text.split('*/');
      if (tmp[1][0] != '\n') tmp[1] = '\n' + tmp[1].trimStart();
      text = tmp.join('*/');
    }
    return "\n  "  + text.split("\n").join("\n  ");
  }
  extraButtons(arg) {
    if (arg == 1) return "";
    var id = this.get_id();
    var ret = "<button class='extra-buttons' title='Duplicate Layer' onclick='DuplicateLayer("+id+","+arg+",event)'>+</button>";
    ret += "<button class='extra-buttons' title='Remove Layer' onclick='RemoveLayer("+id+","+arg+",event)'>X</button>";
    if (arg > 2) ret += "<button class='extra-buttons' title='Move Layer Up' onclick='UpLayer("+id+","+arg+",event)'>&#5169;</button>";
    if (arg <= this.LAYERS.length) ret += "<button class='extra-buttons' title='Move Layer Down'onclick='DownLayer("+id+","+arg+",event)'>&#5167;</button>";
    return ret;
  }
  constructor(ARGS) {
    super("Mix alpha-blended layers", ARGS);
    this.LAYERS = Array.from(ARGS).slice(1);
    this.add_arg("BASE", "COLOR", "Base layer");
    for (var i = 1; i < this.LAYERS.length + 1; i++)
      this.add_arg("LAYER" + i, "COLOR", "Layer " + i);
  }
  getColor(led) {
    var ret = this.BASE.getColor(led);
    for (var i = 0; i < this.LAYERS.length; i++) {
      ret = ret.paintOver(this.LAYERS[i].getColor(led));
    }
    return ret;
  }
  argify(state) {
    this.BASE = this.BASE.argify(state);
    state.color_argument = false;
    var ret = super.argify(state);
    state.color_argument = false;
    return ret;
  }
}

function Layers(BASE, Layer1, Layer2) {
  return new LayersClass(Array.from(arguments));
}
//////////// indents and line returns PR ///////////
function enc(s) {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function encstr(s) {
  return s.replace("\n", "\\n");
}

function mkbutton2(name, val) {
  return "<input type=button class='btn' onclick='SetToAndFormat(\""+val+"\", event)' value='"+enc(name)+"'>\n";
}
function mkbutton(name) {
  return mkbutton2(name, name);
}

function AddTemplate(name) {
  var val = name;
  if (name.length > 40) {
    name = name.slice(0,40) + '...';
  }
  template_links.push( mkbutton2(name, val) );
}
function AddEffect(val) {
  var name = val.split("<")[0];
  effect_links.push( mkbutton2(name, val) );
}
function AddLayer(val) {
  var name = val.split("<")[0];
  layer_links.push( mkbutton2(name, val) );
}
function AddFunction(val) {
  var name = val.split("<")[0];
  function_links.push( mkbutton2(name, val) );
}
function AddTransition(val) {
  var name = val.split("<")[0];
  transition_links.push( mkbutton2(name, val) );
}
function AddEffectWL(val) {
  AddEffect(val);
  val=val.slice(0, val.length-1);
  var tmp1 = val.split("<");
  var tmp2 = val.split(",");
  AddLayer(tmp1[0] + "L<" + tmp2.slice(1).join(",") + ">")
}
function AddEffectWLF(val) {
  AddEffect(val);
  val=val.slice(0, val.length-1);
  var tmp1 = val.split("<");
  var tmp2 = val.split(",");
  AddLayer(tmp1[0] + "L<" + tmp2.slice(1).join(",") + ">")
  AddFunction(tmp1[0] + "F<" + tmp2.slice(2).join(",") + ">")
}

var history_html = "";
function AddHistory(name, type) {
  var label = name;
  if (label.length > 80) label = label.slice(0,78) + "...";
  name = name.split("\n").join(" ").split("   ").join(" ").split("  ").join(" ").split("< ").join("<");
//////////// History PR ///////////
  // Add data-type and new class
  var btn = "<input type='button' class='history-btn' data-type='" + type + "' onclick='SetToAndFormat(\"" + name + "\", event)' value='" + enc(label) + "'>\n";
  history_html = btn + history_html.replace(btn, "");
  FIND("history_tabcontent").innerHTML = history_html;
}

function mapcolor(x) {
  x /= 255.0;
  x = Math.pow(x, 1.0/2.2);
  return Math.round(x * 255);
}

//sort color by hue
function rgbToHsl(r, g, b) {
  r /= 255, g /= 255, b /= 255;

  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return [ h, s, l ];
}

function mkcolorbutton(name, r, g, b) {
  r = mapcolor(r);
  g = mapcolor(g);
  b = mapcolor(b);
  var hsl = rgbToHsl(r, g, b);
//////////// Logging PR ///////////////
  // console.log("mkcolorbutton:name="+name+"  rgb="+r+","+g+","+b+"    hsl="+hsl[0]+","+hsl[1]+","+hsl[2]+"  ");
  var sortString;
  if (hsl[1] == 0.0) {
    sortString = "C:"+hsl[2];
  } else if (hsl[1] < 0.3 || hsl[2] > 0.8 || hsl[2] < 0.2) {
    sortString = "B:"+hsl[0];
  } else {
    sortString = "A:"+hsl[0];
  }
  var bgColor = "rgb("+r+","+g+","+b+")";
  if (r == 0 && g == 0 && b == 0) bgColor = "black"
  var textColor = (name === "Black" || name === "Blue") ? "white" : "black";
  return "<input srt='"+sortString+"' type=button style='border: 1px solid black;padding:8px;color:"+textColor+";background:"+bgColor+"' class=btn onclick='SetTo(\""+name+"\")' value='"+enc(name)+"'>\n";
}

function AddColor(name, r, g, b) {
  colorNames[r+","+g+","+b] = name;
  colorData.push(mkcolorbutton(name, r, g, b));
  all_colors[name] = new RgbClass(r, g, b);
}

AddTemplate("InOutHelper<SimpleClash<Lockup<Blast<Blue,White>,AudioFlicker<Blue,White>>,White>, 300, 800>");
// AddTemplate("StyleFirePtr<Red, Yellow>");
AddTemplate("InOutHelper<EasyBlade<OnSpark<Green>, White>, 300, 800>>");
AddTemplate("InOutHelper<EasyBlade<Sparkle<Blue>, White>, 300, 800>>");
AddTemplate("IgnitionDelay<500, InOutHelper<EasyBlade<OnSpark<Green>, White>, 300, 800>>>");
AddTemplate("RetractionDelay<500, InOutHelper<EasyBlade<OnSpark<Green>, White>, 300, 800>>>");
AddTemplate("StyleNormalPtr<AudioFlicker<Yellow, White>, Blue, 300, 800>");
AddTemplate("InOutSparkTip<EasyBlade<Magenta, White>, 300, 800>>");
AddTemplate("StyleNormalPtr<Gradient<Red, Blue>, Gradient<Cyan, Yellow>, 300, 800>");
AddTemplate("StyleNormalPtr<Pulsing<Red, Rgb<50,0,0>, 5000>, White, 300, 800, Red>");
AddTemplate("StyleRainbowPtr<300, 800>");
AddTemplate("StyleStrobePtr<White, Rainbow, 15, 300, 800>");
AddTemplate("StyleFirePtr<Red, Yellow>");
AddTemplate("Layers<Red,ResponsiveLockupL<White,TrInstant,TrFade<100>,Int<26000>>,ResponsiveLightningBlockL<White>,ResponsiveMeltL<Mix<TwistAngle<>,Red,Yellow>>,ResponsiveDragL<White>,ResponsiveClashL<White,TrInstant,TrFade<200>,Int<26000>>,ResponsiveBlastL<White>,ResponsiveBlastWaveL<White>,ResponsiveBlastFadeL<White>,ResponsiveStabL<White>,InOutTrL<TrWipe<300>,TrWipeIn<500>>>");

AddLayer("AlphaL<Red, Int<16000>>");
AddLayer("AlphaMixL<Bump<Int<16384>,Int<16384>>,Red,Green,Blue>");
AddEffectWL("AudioFlicker<White, Blue>");
AddEffectWLF("Blast<Blue, White>");
AddEffectWL("BlastFadeout<Blue, White>");
AddEffect("Blinking<Red, Blue, 1000, 500>");
AddLayer("BlinkingL<Blue, Int<1000>, Int<500>>");
AddEffect("BrownNoiseFlicker<Green, Magenta, 50>");
AddLayer("BrownNoiseFlickerL<Magenta, Int<50>>");
AddEffect("ColorChange<TrInstant, Red, Green, Blue>");
AddEffect("ColorSelect<Variation, TrInstant, Red, Green, Blue>");
AddFunction("IntSelect<Variation, 0, 8192,32768>");
//////////// indents and line returns PR ///////////
AddEffect("ColorCycle<Blue, 0, 1, Cyan, 100, 3000, 5000>");
AddEffect("ColorSequence<500, Red, Green, Blue>");
AddEffect("EffectSequence<EFFECT_CLASH, Red, Green, Blue>");
AddEffect("Cylon<Red, 5, 20>");
AddEffect("Gradient<Blue, Green, Yellow, Red>");
AddEffect("Gradient<Red, Blue, Green>");
AddEffect("Gradient<Red, Blue>");
AddEffect("Hue<16384>");
AddEffectWL("HumpFlicker<Green, Magenta, 50>");
AddEffect("InOutHelper<White, 300, 800, Black>");
AddEffect("InOutSparkTip<Red, 1000, 800, White>");
AddEffect("InOutTr<Green, TrColorCycle<3000>, TrFade<500>>");
AddEffect("Layers<Green, AlphaL<Red, Int<16000>>>");
AddEffectWL("LocalizedClash<Red, White>");
AddEffectWL("Lockup<Green, Red>");
AddEffectWL("LockupTr<Red, White, TrFade<100>, TrFade<100>, SaberBase::LOCKUP_MELT>");
AddEffect("Mix<Int<16384>, Red, Blue>");
AddEffect("OnSpark<Green, White, 200>");
AddLayer("OnSparkL<White, Int<200>>");
AddEffectWL("OriginalBlast<Blue, White>");
AddEffect("PixelateX<StaticFire<Blue,Cyan>,Int<10>>");
AddEffect("Pulsing<Blue, Red, 800>");
AddLayer("PulsingL<Red, Int<800>>");
AddEffect("Rainbow");
AddEffect("Remap<SmoothStep<Sin<Int<10>>, Sin<Int<7>>>, Rainbow>");
AddEffect("RandomBlink<3000>");
AddLayer("RandomBlinkL<Int<3000>, Green>");
AddEffect("RandomFlicker<Yellow, Blue>");
AddLayer("RandomL<Blue>");
AddEffectWL("RandomPerLEDFlicker<Green, Magenta>");
AddEffect("Rgb16<0,0,65536>");
AddEffect("Rgb<100,100,100>");
AddEffect("RgbCycle");
AddEffect("RotateColorsX<Variation,Red>");
AddEffect("Sequence<Red, Black, 100, 37, 0b0001010100011100, 0b0111000111000101, 0b0100000000000000>");
AddLayer("SequenceL<Red, 100, 37, 0b0001010100011100, 0b0111000111000101, 0b0100000000000000>");
AddEffectWL("SimpleClash<Red, White, 40>");
AddEffect("Sparkle<Blue>");
AddLayer("SparkleL");
AddEffect("Stripes<1000, 1000, Cyan, Magenta, Yellow, Blue>");
AddEffect("Strobe<Black, White, 15, 1>");
AddLayer("StrobeL<White, Int<15>, Int<1>>");
AddEffect("StyleFire<Blue, Cyan>");
AddEffect("MultiTransitionEffect<Blue, White, TrWipe<50>, TrWipe<50>, EFFECT_BLAST>");
AddEffect("TransitionEffect<Blue,Green,TrFade<500>,TrBoing<500,3>,EFFECT_BLAST>");
AddEffectWL("TransitionLoop<Blue, TrConcat<TrFade<200>, Red, TrFade<200>>>");
AddFunction("BendTimePow<1000, 16384>");
AddFunction("BendTimePowInv<1000, 16384>");
AddFunction("ReverseTime<1000, 16384>");

AddEffect("IgnitionDelay<500, InOutHelper<EasyBlade<OnSpark<Green>, White>, 300, 800>>>");
AddEffect("RetractionDelay<500, InOutHelper<EasyBlade<OnSpark<Green>, White>, 300, 800>>>");

AddLayer("TransitionEffectL<TrConcat<TrWipe<50>, White, TrWipe<50>>, EFFECT_BLAST>");
AddLayer("MultiTransitionEffectL<TrConcat<TrWipe<50>, White, TrWipe<50>>, EFFECT_BLAST>");
AddLayer("TransitionPulseL<TrConcat<TrFade<200>, Red, TrFade<200>>, ThresholdPulseF<Saw<Int<60>>, Int<16384>>>")

AddTransition("TrBoing<300, 2>");
AddTransition("TrBlink<1000, 3>");
AddTransition("TrColorCycle<3000>");
AddTransition("TrConcat<TrFade<100>, White, TrFade<100>>");
AddTransition("TrDelay<500>");
AddTransition("TrFade<300>");
AddTransition("TrInstant");
AddTransition("TrJoin<TrFade<500>, TrWipe<500>>");
AddTransition("TrJoinR<TrFade<500>, TrWipe<500>>");
AddTransition("TrRandom<TrFade<500>, TrWipe<500>, TrBoing<500, 2>>");
AddTransition("TrSelect<Variation,TrFade<500>, TrWipe<500>, TrBoing<500, 2>>");
AddTransition("TrSequence<TrFade<500>, TrWipe<500>, TrBoing<500, 2>>");
AddTransition("TrSmoothFade<300>");
AddTransition("TrWipe<500>");
AddTransition("TrWipeIn<500>");
AddTransition("TrCenterWipe<500>");
AddTransition("TrCenterWipeSpark<WHITE, 500>");
AddTransition("TrCenterWipeIn<500>");
AddTransition("TrCenterWipeInSpark<WHITE, 500>");
AddTransition("TrWaveX<White>");
AddTransition("TrSparkX<White>");
AddTransition("TrWipeSparkTip<White, 300>");
AddTransition("TrWipeInSparkTip<White, 300>");
AddTransition("TrWipeSparkTipX<White, Int<300>>");
AddTransition("TrWipeInSparkTipX<White, Int<300>>");
AddTransition("TrExtend<1000, TrFade<500>>");
AddTransition("TrLoop<TrFade<500>>");
AddTransition("TrLoopN<5, TrFade<500>>");
AddTransition("TrLoopUntil<EffectPulseF<EFFECT_CLASH>, TrConcat<TrFade<500>, Green, TrFade<500>>, TrFade<100>>");
AddTransition("TrDoEffect<TrFade<100>, EFFECT_BLAST>");
AddTransition("TrDoEffectAlways<TrFade<100>, EFFECT_BLAST>");

AddFunction("BatteryLevel");
AddFunction("VolumeLevel");
AddFunction("BlinkingF<Int<1000>, Int<500>>");
AddFunction("BrownNoiseF<Int<50>>");
AddFunction("HumpFlickerF<50>");
AddFunction("NoisySoundLevel");
AddFunction("SmoothSoundLevel");
AddFunction("SwingSpeed<250>");
AddFunction("SwingAcceleration<130>");
AddFunction("ClashImpactF<>");
AddFunction("Bump<Int<16384>>");
AddFunction("Ifon<Int<0>, Int<32768>>");
AddFunction("IgnitionTime<>");
AddFunction("RetractionTime<>");
AddFunction("InOutFunc<300, 800>");
AddFunction("InOutHelperF<InOutFunc<300, 800>>");
AddFunction("Int<32768>");
AddFunction("Scale<Sin<Int<10>>,Int<0>,Int<4000>>");
AddFunction("InvertF<Ifon<Int<0>, Int<32768>>>");
AddFunction("Sin<Int<10>>");
AddFunction("Saw<Int<10>>");
AddFunction("SmoothStep<Sin<Int<10>>, Sin<Int<7>>>");
AddFunction("Trigger<EFFECT_FORCE, Int<500>, Int<1000>, Int<500>>");
AddFunction("ChangeSlowly<NoisySoundLevel, Int<50000>>");
AddFunction("SlowNoise<Int<1000>>");
AddFunction("IsLessThan<SwingSpeed<250>, Int<100>>");
AddFunction("IsGreaterThan<SwingSpeed<250>, Int<100>>");
AddFunction("IsBetween<SwingSpeed<250>, Int<100>, Int<120>>");
AddFunction("ClampF<RandomPerLEDF, 8000, 12000>");
AddFunction("LayerFunctions<Bump<Int<0>>, Bump<Int<32768>>>");
AddFunction("OnSparkF<Int<200>>");
AddFunction("PulsingF<Int<800>>");
AddFunction("RandomBlinkF<Int<3000>>");
AddFunction("RandomF");
AddFunction("RandomPerLEDF");
AddFunction("RampF");
AddFunction("SequenceF<100, 37, 0b0001010100011100, 0b0111000111000101, 0b0100000000000000>");
AddFunction("SparkleF");
AddFunction("StrobeF<Int<15>, Int<1>>");
AddFunction("BlastFadeoutF");
AddFunction("OriginalBlastF");
AddFunction("Variation");
AddFunction("AltF");
AddFunction("SyncAltToVarianceF");
AddFunction("TwistAngle<>");
AddFunction("TwistAcceleration<>");
AddFunction("BladeAngle<>");
AddFunction("Sum<RandomPerLEDF, Bump<Int<16384>>>");
AddFunction("Subtract<RandomPerLEDF, Bump<Int<16384>>>");
AddFunction("Mult<RandomPerLEDF, Bump<Int<16384>>>");
AddFunction("Percentage<RandomPerLEDF, 20>");
AddFunction("Divide<RandomPerLEDF, Int<10>>");
AddFunction("ModF<Sin<Int<10>>, Int<8192>>");
AddFunction("HoldPeakF<RandomF, Int<300>, Int<32768>>");
AddFunction("CenterDistF<>");
AddFunction("EffectPosition<>");
AddFunction("TimeSinceEffect<>");
AddFunction("WavNum<>");
AddFunction("WavLen<>");
AddFunction("CircularSectionF<Sin<Int<3>>, Sin<Int<2>>>");
AddFunction("LinearSectionF<Sin<Int<3>>, Sin<Int<2>>>");
AddFunction("EffectRandomF<EFFECT_CLASH>");
AddFunction("EffectPulseF<EFFECT_CLASH>");
AddFunction("IncrementWithReset<EffectPulseF<EFFECT_CLASH>>");
AddFunction("IncrementModuloF<EffectPulseF<EFFECT_CLASH>>");
AddFunction("ThresholdPulseF<Saw<Int<60>>, Int<16384>>");
AddFunction("IncrementF<Saw<Int<60>>, Int<16384>, Int<32768>, Int<1024>>");
AddFunction("EffectIncrementF<EFFECT_CLASH, Int<32768>, Int<8192>>");
AddFunction("MarbleF<Int<-2000>, Int<40000>, Ifon<Int<827680>, Int<0>>, Int<1276800>>");
AddFunction("LockupPulseF<SaberBase::LOCKUP_NORMAL>");

AddColor("AliceBlue", 223, 239, 255);
AddColor("Aqua", 0, 255, 255);
AddColor("Aquamarine", 55, 255, 169);
AddColor("Azure", 223, 255, 255);
AddColor("Bisque", 255, 199, 142);
AddColor("Black", 0, 0, 0);
AddColor("BlanchedAlmond", 255, 213, 157);
AddColor("Blue", 0, 0, 255);
AddColor("Chartreuse", 55, 255, 0);
AddColor("Coral", 255, 55, 19);
AddColor("Cornsilk", 255, 239, 184);
AddColor("Cyan", 0, 255, 255);
AddColor("DarkOrange", 255, 68, 0);
AddColor("DeepPink", 255, 0, 75);
AddColor("DeepSkyBlue", 0, 135, 255);
AddColor("DodgerBlue", 2, 72, 255);
AddColor("FloralWhite", 255, 244, 223);
AddColor("GhostWhite", 239, 239, 255);
AddColor("Green", 0, 255, 0);
AddColor("GreenYellow", 108, 255, 6);
AddColor("HoneyDew", 223, 255, 223);
AddColor("HotPink", 255, 36, 118);
AddColor("Ivory", 255, 255, 223);
AddColor("LavenderBlush", 255, 223, 233);
AddColor("LemonChiffon", 255, 244, 157);
AddColor("LightCyan", 191, 255, 255);
AddColor("LightPink", 255, 121, 138);
AddColor("LightSalmon", 255, 91, 50);
AddColor("LightYellow", 255, 255, 191);
AddColor("Magenta", 255, 0, 255);
AddColor("MintCream", 233, 255, 244);
AddColor("MistyRose", 255, 199, 193);
AddColor("Moccasin", 255, 199, 119);
AddColor("NavajoWhite", 255, 187, 108);
AddColor("Orange", 255, 97, 0);
AddColor("OrangeRed", 255, 14, 0);
AddColor("PapayaWhip", 255, 221, 171);
AddColor("PeachPuff", 255, 180, 125);
AddColor("Pink", 255, 136, 154);
AddColor("Red", 255, 0, 0);
AddColor("SeaShell", 255, 233, 219);
AddColor("Snow", 255, 244, 244);
AddColor("SpringGreen", 0, 255, 55);
AddColor("SteelBlue", 14, 57, 118);
AddColor("Tomato", 255, 31, 15);
AddColor("White", 255, 255, 255);
AddColor("Yellow", 255, 255, 0);

// New in ProffieOS 8.x:
AddColor("ElectricPurple", 127, 0, 255);
AddColor("ElectricViolet", 71, 0, 255);
AddColor("ElectricLime", 156, 255, 0);
AddColor("Amber", 255, 135, 0);
AddColor("CyberYellow", 255, 168, 0);
AddColor("CanaryYellow", 255, 221, 0);
AddColor("PaleGreen", 28, 255, 28);
AddColor("Flamingo", 255, 80, 254);
AddColor("VividViolet", 90, 0, 255);
AddColor("PsychedelicPurple", 186, 0, 255);
AddColor("HotMagenta", 255, 0, 156);
AddColor("BrutalPink", 255, 0, 128);
AddColor("NeonRose", 255, 0, 55);
AddColor("VividRaspberry", 255, 0, 38);
AddColor("HaltRed", 255, 0, 19);
AddColor("MoltenCore", 255, 24, 0);
AddColor("SafetyOrange", 255, 33, 0);
AddColor("OrangeJuice", 255, 55, 0);
AddColor("ImperialYellow", 255, 115, 0);
AddColor("SchoolBus", 255, 176, 0);
AddColor("SuperSaiyan", 255, 186, 0);
AddColor("Star", 255, 201, 0);
AddColor("Lemon", 255, 237, 0);
AddColor("ElectricBanana", 246, 255, 0);
AddColor("BusyBee", 231, 255, 0);
AddColor("ZeusBolt", 219, 255, 0);
AddColor("LimeZest", 186, 255, 0);
AddColor("Limoncello", 135, 255, 0);
AddColor("CathodeGreen", 0, 255, 22);
AddColor("MintyParadise", 0, 255, 128);
AddColor("PlungePool", 0, 255, 156);
AddColor("VibrantMint", 0, 255, 201);
AddColor("MasterSwordBlue", 0, 255, 219);
AddColor("BrainFreeze", 0, 219, 255);
AddColor("BlueRibbon", 0, 33, 255);
AddColor("RareBlue", 0, 13, 255);
AddColor("OverdueBlue", 13, 0, 255);
AddColor("ViolentViolet", 55, 0, 255);

AddLayer("InOutHelperL<InOutFuncX<Int<300>,Int<800>>>");
AddLayer("InOutTrL<TrWipe<300>,TrWipeIn<500>>");

AddLayer("ResponsiveLockupL<White, TrInstant, TrInstant, Int<26000>, Int<6000>>");
AddLayer("ResponsiveLightningBlockL<White, TrInstant, TrInstant>");
AddLayer("ResponsiveMeltL<Mix<TwistAngle<>,Red,Yellow>, TrInstant, TrInstant, Int<4000>, Int<10000>>");
AddLayer("ResponsiveDragL<White, TrInstant, TrInstant, Int<2000>, Int<10000>>");
AddLayer("ResponsiveClashL<White, TrInstant, TrFade<200>, Int<26000>, Int<6000>>");
AddLayer("ResponsiveBlastL<White, Int<400>, Int<100>, Int<400>, Int<28000>, Int<8000>>");
AddLayer("ResponsiveBlastWaveL<White, Int<400>, Int<100>, Int<400>, Int<28000>, Int<8000>>");
AddLayer("ResponsiveBlastFadeL<White, Int<8000>, Int<400>, Int<28000>, Int<8000>>");
AddLayer("ResponsiveStabL<White, TrWipeIn<600>, TrWipe<600>, Int<14000>, Int<8000>>");
AddLayer("SyncAltToVarianceL");

var WHITE = Rgb(255,255,255);
var RED = Rgb(255,0,0);
var GREEN = Rgb(0,255,0);
var BLUE = Rgb(0,0,255);
var YELLOW = Rgb(255,255,0);
var CYAN = Rgb(0,255,255);
var MAGENTA = Rgb(255,0,255);
var WHITE = Rgb(255,255,255);
var BLACK = Rgb(0,0,0);
var OrangeRed = Rgb(255,14,0);
//////////// indents and line returns PR ///////////

//--
class RainbowClass extends STYLE {
  constructor() {
    super("Scrolling color rainbow", arguments);
  }
  run(blade) {
    this.m = millis();
  }
  getColor(led) {
    return RgbF(max(0.0, sin( (this.m * 3.0 + led * 50.0) % 1024.0 * Math.PI * 2.0 / 1000.0)),
                max(0.0, sin( (this.m * 3.0 + led * 50.0 + 1024.0/3.0) % 1024.0 * Math.PI * 2.0 / 1000.0)),
                max(0.0, sin( (this.m * 3.0 + led * 50.0 + 1024.0 * 2.0/3.0) % 1024.0 * Math.PI * 2.0 / 1000.0)));
  }

  pp() { return this.PPshort("Rainbow", "Scrolling color rainbow"); }
};

function Rainbow() {
  return  new RainbowClass();
}

var STATE_ON = 0;
//////////// SOUND1 PR ///////////
var STATE_WAIT_FOR_ON = 0;
// 1 = lockup
// 2 = drag
// 3 = lb
// 4 = melt
// 5 = autofire
var STATE_LOCKUP = 0;
var STATE_ROTATE = 0;
var STATE_NUM_LEDS = 144;

var handled_lockups = {};

// For logging
const LOCKUP_TYPE_NAMES = {
  1: "LOCKUP_NORMAL",
  2: "LOCKUP_DRAG",
  3: "LOCKUP_LIGHTNING_BLOCK",
  4: "LOCKUP_MELT",
  5: "LOCKUP_AUTOFIRE"
};

function lockupNameFromValue(val) {
  return LOCKUP_TYPE_NAMES[val] || val;
}

function IsHandledLockup(lockup_type) {
  return current_style.__handled_lockups[lockup_type];
}

function HandleLockup(lockup_type) {
  if (lockup_type.getInteger) {
    lockup_type = lockup_type.getInteger(0);
  }
  handled_lockups[lockup_type] = 1;
}

class BladeEffect {
  constructor(type, start_micros, location) {
    this.type = type;
    this.start_micros = start_micros;
    this.location = location;
    this.wavnum = random(10);
  }
};

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
  Size() { return max(0, this.end - this.start); }
  Intersect(other) {
    return new Range(max(this.start, other.start), min(this.end, other.end));
  }
};

// TODO
// Gray out buttons not applicable to the current type. - BC WIP.
// Save -> save to local storage (keep 10?) maybe with images?
// Mix

class ColorCycleClass extends STYLE {
  constructor(COLOR, percentage, rpm,
              ON_COLOR, on_percentage, on_rpm,
              fade_time_millis) {
    super();
    this.COLOR = ColorArg(COLOR);
    this.percentage = IntArg(percentage);
    this.rpm = IntArg(rpm);
    this.ON_COLOR = ColorArg(ON_COLOR, COLOR.DOCOPY());
    this.on_percentage = IntArg(on_percentage, percentage);
    this.on_rpm = IntArg(on_rpm, rpm);
    this.fade_time_millis = IntArg(fade_time_millis, 1);
    this.last_micros_ = 0;
    this.fade_ = 0.0;
    this.pos_ = 0.0;
  }
  run(blade) {
    this.COLOR.run(blade);
    this.ON_COLOR.run(blade);
    var now = millis();
    var delta = now - this.last_micros_;
    this.last_micros_ = now;
    if (delta > 1000) delta = 1;
    var fade_delta = delta / this.fade_time_millis;
    if (!blade.is_on()) fade_delta = - fade_delta;
    this.fade_ = Math.max(0.0, Math.min(1.0, this.fade_ + fade_delta));
    var rpm = this.rpm * (1.0 - this.fade_) + this.on_rpm * this.fade_;
    var percentage = this.percentage * (1.0 - this.fade_) + this.on_percentage * this.fade_;
    this.fraction_ = percentage / 100.0;
    this.pos_ = ((this.pos_ + delta /  60000.0 * rpm) % 1.0);
  }
  getColor(led) {
    var led_range = new Range(led / 144.0, (led + 1) / 144.0);
    var black_mix = 0.0;
    if (this.pos_ + this.fraction_ < 1.0) {
      black_mix = new Range(this.pos_, this.pos_ + this.fraction_).Intersect(led_range).Size();
    } else {
      black_mix = new Range(this.pos_, 1.0).Intersect(led_range).Size() +
        new Range(0.0, (this.pos_ + this.fraction_) % 1.0).Intersect(led_range).Size();
    }
    black_mix *= 144.0;
    var c = this.COLOR.getColor(led);
    var on_c = this.ON_COLOR.getColor(led);
    c = c.mix(on_c, this.fade_);
    c = BLACK.mix(c, black_mix);
    return c;
  }
  pp() {
    return this.PP("ColorCycle", "Rotating beam",
                   this.COLOR, "beam color",
                   this.percentage, "percentage of blade lit",
                   this.rpm, "rotation speed",
                   this.ON_COLOR, "beam color when on",
                   this.on_percentage, "percentage of blade lit when on",
                   this.on_rpm, "rotation speed when on",
                   this.fade_time_millis, "time to transition to/from on state");
  }
};

function ColorCycle(COLOR, percentage, rpm,
               ON_COLOR, on_percentage, on_rpm,
               fade_time_millis) {
  return new ColorCycleClass(COLOR, percentage, rpm,
                             ON_COLOR, on_percentage, on_rpm,
                             fade_time_millis);
}

class CylonClass extends STYLE {
  constructor(COLOR, percentage, rpm,
              ON_COLOR, on_percentage, on_rpm,
              fade_time_millis) {
    super();
    this.COLOR = ColorArg(COLOR);
    this.percentage = IntArg(percentage);
    this.rpm = IntArg(rpm);
    this.ON_COLOR = ColorArg(ON_COLOR, COLOR.DOCOPY());
    this.on_percentage = IntArg(on_percentage, percentage);
    this.on_rpm = IntArg(on_rpm, rpm);
    this.fade_time_millis = IntArg(fade_time_millis, 1);
    this.last_micros_ = 0;
    this.fade_ = 0.0;
    this.pos_ = 0.0;
  }
  run(blade) {
    this.COLOR.run(blade);
    this.ON_COLOR.run(blade);
    var now = millis();
    var delta = now - this.last_micros_;
    this.last_micros_ = now;
    if (delta > 1000) delta = 1;
    var fade_delta = delta / this.fade_time_millis;
    if (!blade.is_on()) fade_delta = - fade_delta;
    this.fade_ = Math.max(0.0, Math.min(1.0, this.fade_ + fade_delta));
    // setvar(this.MIX, this.fade_);
    var rpm = this.rpm * (1.0 - this.fade_) + this.on_rpm * this.fade_;
    var percentage = this.percentage * (1.0 - this.fade_) + this.on_percentage * this.fade_;
    this.fraction_ = percentage / 100.0;
    // TODO: FIXME THIS SHOULD BE SIN()
    this.pos_ = (this.pos_ + delta /  60000.0 * rpm) % 1.0;
    this.POS = (Math.sin(this.pos_ * Math.PI * 2.0) + 1.0) * (0.5 - percentage/200.0);
  }
  getColor(led) {
    var led_range = new Range(led / 144.0, (led + 1) / 144.0);
    var black_mix = new Range(this.POS, this.POS + this.fraction_).Intersect(led_range).Size();
    black_mix *= 144.0;
    var c = this.COLOR.getColor(led);
    var on_c = this.ON_COLOR.getColor(led);
    c = c.mix(on_c, this.fade_);
    c = BLACK.mix(c, black_mix);
    return c;
  }
  pp() {
    return this.PP("Cylon", "Rotating beam",
                   this.COLOR, "beam color",
                   this.percentage, "percentage of blade lit",
                   this.rpm, "rotation speed",
                   this.ON_COLOR, "beam color when on",
                   this.on_percentage, "percentage of blade lit when on",
                   this.on_rpm, "rotation speed when on",
                   this.fade_time_millis, "time to transition to/from on state");
  }
};

function Cylon(COLOR, percentage, rpm,
               ON_COLOR, on_percentage, on_rpm,
               fade_time_millis) {
  return new CylonClass(COLOR, percentage, rpm,
                        ON_COLOR, on_percentage, on_rpm,
                        fade_time_millis);
}

class OnSparkFClass extends FUNCTION {
  constructor(T, SPARK_COLOR, MILLIS) {
    super("Returns 32768 on startup and then fades out for 'MILLIS' milliseconds on startup.", arguments);
    this.add_arg("MILLIS", "FUNCTION", "Millis", 200);
    this.on_ = false;
    this.on_millis_ = 0;
  }
  run(blade) {
    super.run(blade);
    var ms = this.MILLIS.getInteger(0);

    var m = millis();
    if (blade.is_on() != this.on_) {
      this.on_ = blade.is_on();
      if (this.on_) this.on_millis_ = m;
    }
    var t = m - this.on_millis_;
    if (t < ms) {
      this.mix_ = 1.0 - t / ms;
    } else {
      this.mix_ = 0.0;
    }
  }
  getInteger(led) {
    return this.mix_ * 32768;
  }
};

function OnSparkF(MILLIS) {
  return new OnSparkFClass(MILLIS);
}

class OnSparkLClass extends MACRO {
  constructor(SPARK_COLOR, MILLIS) {
    super("Shows the spark color for 'MILLIS' milliseconds on startup.", arguments);
    this.add_arg("SPARK_COLOR", "COLOR", "Spark color", WHITE.DOCOPY());
    this.add_arg("MILLIS", "FUNCTION", "Millis", Int(200));
    this.SetExpansion(AlphaL(this.SPARK_COLOR, OnSparkF(this.MILLIS)));
  }
};

function OnSparkL(SPARK_COLOR, MILLIS) {
  return new OnSparkLClass(SPARK_COLOR, MILLIS);
}

class OnSparkXClass extends MACRO {
  constructor(T, SPARK_COLOR, MILLIS) {
    super("Shows the spark color for 'MILLIS' milliseconds on startup.", arguments);
    this.add_arg("T", "COLOR", "Base color");
    this.add_arg("SPARK_COLOR", "COLOR", "Spark color", WHITE.DOCOPY());
    this.add_arg("MILLIS", "FUNCTION", "Millis", Int(200));
    this.SetExpansion(Layers(T, OnSparkL(this.SPARK_COLOR, this.MILLIS)));
  }
};

function OnSparkX(T, SPARK_COLOR, MILLIS) {
  return new OnSparkXClass(T, SPARK_COLOR, MILLIS);
}

class OnSparkClass extends MACRO {
  constructor(T, SPARK_COLOR, MILLIS) {
    super("Shows the spark color for 'MILLIS' milliseconds on startup.", arguments);
    this.add_arg("T", "COLOR", "Base color");
    this.add_arg("SPARK_COLOR", "COLOR", "Spark color", WHITE.DOCOPY());
    this.add_arg("MILLIS", "INT", "Millis", 200);
    this.SetExpansion(OnSparkX(T, this.SPARK_COLOR, Int(this.MILLIS)));
  }
};

function OnSpark(T, SPARK_COLOR, MILLIS) {
  return new OnSparkClass(T, SPARK_COLOR, MILLIS);
}

class PixelateXClass extends STYLE {
  constructor(COLOR, PIXEL_SIZE_FUNC = new Int(2)) {
    super("Pixelate", Array.from(arguments)); // Include arguments for display
    this.COLOR = COLOR;
    this.PIXEL_SIZE_FUNC = PIXEL_SIZE_FUNC;
    this.last_led = -1;
    this.last_color = Rgb(0, 0, 0); // Assuming Rgb is a function that returns a color object
    this.add_arg("COLOR", "COLOR", "Color");
    this.add_arg("PIXEL_SIZE_FUNC", "FUNCTION", "Pixel Size");
  }

  run(blade) {
    super.run(blade);
    this.PIXEL_SIZE_FUNC.run(blade);
    return this.COLOR.run(blade);
  }

  getColor(led) {
    if (Math.abs(led - this.last_led) >= this.PIXEL_SIZE_FUNC.getInteger(led)) {
      this.last_led = led;
      this.last_color = this.COLOR.getColor(led);
    }
    return this.last_color;
  }
}

function PixelateX(COLOR, PIXEL_SIZE_FUNC = new Int(2)) {
  return new PixelateXClass(COLOR, PIXEL_SIZE_FUNC);
}

class PixelateClass extends MACRO {
  constructor(COLOR, PIXEL_SIZE = 2) {
    super("Pixelate", Array.from(arguments)); // Include arguments for display
    this.COLOR = COLOR;
    this.PIXEL_SIZE = PIXEL_SIZE;
    this.add_arg("COLOR", "COLOR", "Color");
    this.add_arg("PIXEL_SIZE", "INT", "Pixel Size");
    this.SetExpansion(new PixelateXClass(COLOR, new Int(this.PIXEL_SIZE)));
  }
}

function Pixelate(COLOR, PIXEL_SIZE = 2) {
  return new PixelateClass(COLOR, PIXEL_SIZE);
}

class PulsingFClass extends FUNCTION {
  constructor(PULSE_MILLIS) {
    super("Pulses between 0 and 32768 every M milliseconds", Array.from(arguments));
    this.add_arg("PULSE_MILLIS", "FUNCTION", "M");
  }
  run(blade) {
    super.run(blade)
    this.var_ = 0.5 + 0.5 * Math.sin(millis() * 3.1415 * 2.0/ this.PULSE_MILLIS.getInteger(0));
  }
  getInteger(led) {
    return this.var_ * 32768;
  }
}

function PulsingF(PULSE_MILLIS) {
  return new PulsingFClass(PULSE_MILLIS);
}

class PulsingLClass extends MACRO {
  constructor(COLOR2, PULSE_MILLIS) {
    super("Pulses between transparent and B every M milliseconds", Array.from(arguments));
    this.add_arg("COLOR2", "COLOR", "B");
    this.add_arg("PULSE_MILLIS", "FUNCTION", "M");
    this.SetExpansion(AlphaL(COLOR2, PulsingF(PULSE_MILLIS)));
  }
}

function PulsingL(COLOR2, PULSE_MILLIS) {
  return new PulsingLClass(COLOR2, PULSE_MILLIS);
}

class PulsingXClass extends MACRO {
  constructor(COLOR1, COLOR2, PULSE_MILLIS) {
    super("Pulses between A and B every M milliseconds", Array.from(arguments));
    this.add_arg("COLOR1", "COLOR", "A");
    this.add_arg("COLOR2", "COLOR", "B");
    this.add_arg("PULSE_MILLIS", "FUNCTION", "M");
    this.SetExpansion(Layers(COLOR1, PulsingL(COLOR2, PULSE_MILLIS)));
  }
}

function PulsingX(COLOR1, COLOR2, PULSE_MILLIS) {
  return new PulsingXClass(COLOR1, COLOR2, PULSE_MILLIS);
}

class PulsingClass extends MACRO {
  constructor(COLOR1, COLOR2, PULSE_MILLIS) {
    super("Pulses between A and B every M milliseconds", Array.from(arguments));
    this.add_arg("COLOR1", "COLOR", "A");
    this.add_arg("COLOR2", "COLOR", "B");
    this.add_arg("PULSE_MILLIS", "INT", "M");
    this.SetExpansion(PulsingX(COLOR1, COLOR2, Int(PULSE_MILLIS)));
  }
}

function Pulsing(COLOR1, COLOR2, PULSE_MILLIS) {
  return new PulsingClass(COLOR1, COLOR2, PULSE_MILLIS);
}

class SparkleFClass extends FUNCTION {
  constructor(SPARK_CHANCE_PROMILLE, SPARK_INTENSITY) {
    super("Sparkles!!", Array.from(arguments));
    this.add_arg("SPARK_CHANCE_PROMILLE", "INT", "Chance of new sparks.", 300);
    this.add_arg("SPARK_INTENSITY", "INT", "Initial spark intensity", 1024);
    this.sparks = new Uint16Array(144 + 4);
    this.last_update = 0;
  }
  run(blade) {
    super.run(blade);
    var m = millis();
    if (m - this.last_update >= 10) {
      this.last_update = m;
      var fifo = 0
      var N = blade.num_leds();
      for (var i = 2; i <= N + 2; i++) {
        var x = ((this.sparks[i-1] + this.sparks[i+1]) * 200 + this.sparks[i] * 570) / 1024;
        this.sparks[i-1] = fifo;
        fifo = x;
      }
      this.sparks[N] = fifo;
      if (random(1000) < this.SPARK_CHANCE_PROMILLE) {
        this.sparks[random(blade.num_leds()) + 2] += this.SPARK_INTENSITY;
      }
    }
  }
  getInteger(led) {
    return clamp(this.sparks[led + 2], 0, 255) << 7;
  }
}

function SparkleF(SPARK_CHANCE_PROMILLE, SPARK_INTENSITY) {
  return new SparkleFClass(SPARK_CHANCE_PROMILLE, SPARK_INTENSITY);
}

class SparkleLClass extends MACRO {
  constructor(SPARKLE_COLOR, SPARK_CHANCE_PROMILLE, SPARK_INTENSITY) {
    super("Sparkles!!", Array.from(arguments));
    this.add_arg("SPARKLE_COLOR", "COLOR", "Spark color", Rgb(255,255,255));
    this.add_arg("SPARK_CHANCE_PROMILLE", "INT", "Chance of new sparks.", 300);
    this.add_arg("SPARK_INTENSITY", "INT", "Initial spark intensity", 1024);
    this.SetExpansion(AlphaL(this.SPARKLE_COLOR, SparkleF(this.SPARK_CHANCE_PROMILLE, this.SPARK_INTENSITY)));
  }
}

function SparkleL(SPARKLE_COLOR, SPARK_CHANCE_PROMILLE, SPARK_INTENSITY) {
  return new SparkleLClass(SPARKLE_COLOR, SPARK_CHANCE_PROMILLE, SPARK_INTENSITY);
}

class SparkleClass extends MACRO {
  constructor(BASE, SPARKLE_COLOR, SPARK_CHANCE_PROMILLE, SPARK_INTENSITY) {
    super("Sparkles!!", Array.from(arguments));
    this.add_arg("BASE", "COLOR", "Normal blade color");
    this.add_arg("SPARKLE_COLOR", "COLOR", "Spark color", Rgb(255,255,255));
    this.add_arg("SPARK_CHANCE_PROMILLE", "INT", "Chance of new sparks.", 300);
    this.add_arg("SPARK_INTENSITY", "INT", "Initial spark intensity", 1024);
    this.SetExpansion(Layers(BASE, SparkleL(this.SPARKLE_COLOR, this.SPARK_CHANCE_PROMILLE, this.SPARK_INTENSITY)));
  }
}

function Sparkle(BASE, SPARKLE_COLOR, SPARK_CHANCE_PROMILLE, SPARK_INTENSITY) {
  return new SparkleClass(BASE, SPARKLE_COLOR, SPARK_CHANCE_PROMILLE, SPARK_INTENSITY);
}

class StrobeFClass extends FUNCTION {
  constructor(T, STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS) {
    super("Stroboscope effect", arguments);
    this.add_arg("STROBE_FREQUENCY", "FUNCTION", "Strobe frequency.");
    this.add_arg("STROBE_MILLIS", "FUNCTION", "Pulse length in milliseconds.");
    this.strobe_ = false;
    this.strobe_start_ = 0;
  }
  run(blade) {
    super.run(blade);
    var m = millis();
    var strobe_millis = this.STROBE_MILLIS.getInteger(0);
    var strobe_frequency = this.STROBE_FREQUENCY.getInteger(0);
    var timeout = this.strobe_ ?  strobe_millis : (1000 / strobe_frequency);
    if (m - this.strobe_start_ > timeout) {
      this.strobe_start_ += timeout;
      if (m - this.strobe_start_ > strobe_millis + (1000 / strobe_frequency))
        this.strobe_start_ = m;
      this.strobe_ = !this.strobe_;
    }
  }
  getInteger(led) {
    return this.strobe_ ? 32768 : 0;
  }
};

function StrobeF(STROBE_FREQUENCY, STROBE_MILLIS) {
  return new StrobeFClass(STROBE_FREQUENCY, STROBE_MILLIS);
}

class StrobeLClass extends MACRO {
  constructor(STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS) {
    super("Stroboscope effect", arguments);
    this.add_arg("STROBE_COLOR", "COLOR", "Strobe color");
    this.add_arg("STROBE_FREQUENCY", "FUNCTION", "Strobe frequency.");
    this.add_arg("STROBE_MILLIS", "FUNCTION", "Pulse length in milliseconds.");
    this.SetExpansion(AlphaL(STROBE_COLOR, StrobeF(STROBE_FREQUENCY, STROBE_MILLIS)));
  }
};

function StrobeL(STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS) {
  return new StrobeLClass(STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS);
}

class StrobeXClass extends MACRO {
  constructor(T, STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS) {
    super("Stroboscope effect", arguments);
    this.add_arg("T", "COLOR", "Base color");
    this.add_arg("STROBE_COLOR", "COLOR", "Strobe color");
    this.add_arg("STROBE_FREQUENCY", "FUNCTION", "Strobe frequency.");
    this.add_arg("STROBE_MILLIS", "FUNCTION", "Pulse length in milliseconds.");
    this.SetExpansion(Layers(T, StrobeL(STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS)));
  }
};

function StrobeX(T, STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS) {
  return new StrobeXClass(T, STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS);
}

class StrobeClass extends MACRO {
  constructor(T, STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS) {
    super("Stroboscope effect", arguments);
    this.add_arg("T", "COLOR", "Base color");
    this.add_arg("STROBE_COLOR", "COLOR", "Strobe color");
    this.add_arg("STROBE_FREQUENCY", "INT", "Strobe frequency.");
    this.add_arg("STROBE_MILLIS", "INT", "Pulse length in milliseconds.");
    this.SetExpansion(StrobeX(T, STROBE_COLOR, Int(STROBE_FREQUENCY), Int(STROBE_MILLIS)));
  }
};

function Strobe(T, STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS) {
  return new StrobeClass(T, STROBE_COLOR, STROBE_FREQUENCY, STROBE_MILLIS);
}

class GradientClass extends STYLE {
  constructor(COLORS) {
    super("COLOR2 at base, COLOR2 at tip, smooth gradient in between.", COLORS);
    this.COLORS = COLORS;
    for (var i = 0; i < this.COLORS.length; i++)
      this.add_arg("COLOR" + (i + 1), "COLOR", "COLOR " + (i + 1));
  }
  run(blade) {
    for (var i = 0; i < this.COLORS.length; i++)
      this.COLORS[i].run(blade);
    this.num_leds_ = 1.0 * blade.num_leds();
  }
  getColor(led) {
    if (this.num_leds_ <= 1) return this.COLORS[0].getColor(led);

    const segment_count = this.COLORS.length;
    const pos = (led + 0.5) * segment_count / this.num_leds_;

    const N = Math.floor(pos);
    const blend = pos - N;

    const c1 = this.COLORS[clamp(N, 0, this.COLORS.length - 1)].getColor(led);
    const c2 = this.COLORS[clamp(N + 1, 0, this.COLORS.length - 1)].getColor(led);
    return c1.mix(c2, blend);
  }
};

function Gradient(A, B, C, D) {
  return new GradientClass(Array.from(arguments));
}


class MixClass extends STYLE {
  constructor(ARGS) {
    super("Mix between colors", ARGS);
    this.COLORS = Array.from(ARGS).slice(1);
    this.add_arg("F", "FUNCTION", "0=first color, 32768=last color");
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);
  }
  run(blade) {
    this.F.run(blade);
    for (var i = 0; i < this.COLORS.length; i++)
      this.COLORS[i].run(blade);
  }
  getColor(led) {
    var v = this.F.getInteger(led);
    var pos = max(0, min(32768, v)) * (this.COLORS.length - 1) / 32768;
    var N = min(this.COLORS.length -2, Math.floor(pos));
    return this.COLORS[N].getColor(led).mix(this.COLORS[N+1].getColor(led), pos - N) ;
  }
};

function Mix(F, C1, C2) {
  return new MixClass(Array.from(arguments));
};

class IgnitionDelayXClass extends STYLE {
  constructor(DELAY_MILLIS, BASE) {
    super("Delays ignition by DELAY_MILLIS", Array.from(arguments));
    this.add_arg("DELAY_MILLIS", "FUNCTION", "Ignition delay, in milliseconds");
    this.add_arg("BASE", "COLOR", "Blade style");
  }
  is_on() {
    return this.is_on_;
  }
  num_leds() {
    return this.blade.num_leds()
  }
  GetEffects() { return this.blade.GetEffects(); }
  run(blade) {
    this.DELAY_MILLIS.run(blade);
    var delay_millis = this.DELAY_MILLIS.getInteger(0);
    this.blade = blade;
    if (blade.is_on()) {
      if (!this.waiting) {
        this.waiting = true;
        this.wait_start_time = millis();
      }
      var waited = millis() - this.wait_start_time;
      if (waited > delay_millis) {
        this.is_on_ = true;
        this.wait_start_time = millis() - delay_millis - 1;
      }
    } else {
      this.waiting = false;
      this.is_on_ = false;
    }
    this.BASE.run(this)
  }
  getColor(led) {
    return this.BASE.getColor(led);
  }
}

function IgnitionDelayX(millis, base) {
  return new IgnitionDelayXClass(millis, base);
}

class IgnitionDelayClass extends MACRO {
  constructor(DELAY_MILLIS, BASE) {
    super("Delays ignition by DELAY_MILLIS", Array.from(arguments));
    this.add_arg("DELAY_MILLIS", "INT", "Ignition delay, in milliseconds");
    this.add_arg("BASE", "COLOR", "Blade style");
    this.SetExpansion(IgnitionDelayX(Int(DELAY_MILLIS), BASE));
  }
}

function IgnitionDelay(millis, base) {
  return new IgnitionDelayClass(millis, base);
}

class RetractionDelayXClass extends STYLE {
  constructor(DELAY_MILLIS, BASE) {
    super("Delays retraction by DELAY_MILLIS", Array.from(arguments));
    this.add_arg("DELAY_MILLIS", "FUNCTION", "Ignition delay, in milliseconds");
    this.add_arg("BASE", "COLOR", "Blade style");
  }
  is_on() {
    return this.is_on_;
  }
  num_leds() {
    return this.blade.num_leds()
  }
  GetEffects() { return this.blade.GetEffects(); }
  run(blade) {
    this.DELAY_MILLIS.run(blade);
    var delay_millis = this.DELAY_MILLIS.getInteger(0);
    this.blade = blade;
    if (!blade.is_on()) {
      if (!this.waiting) {
        this.waiting = true;
        this.wait_start_time = millis();
      }
      var waited = millis() - this.wait_start_time;
      if (waited > delay_millis) {
        this.is_on_ = false;
        this.wait_start_time = millis() - delay_millis - 1;
      }
    } else {
      this.waiting = false;
      this.is_on_ = true;
    }
    this.BASE.run(this)
  }
  getColor(led) {
    return this.BASE.getColor(led);
  }
}

function RetractionDelayX(millis, base) {
  return new RetractionDelayXClass(millis, base);
}

class RetractionDelayClass extends MACRO {
  constructor(DELAY_MILLIS, BASE) {
    super("Delays retraction by DELAY_MILLIS", Array.from(arguments));
    this.add_arg("DELAY_MILLIS", "INT", "Ignition delay, in milliseconds");
    this.add_arg("BASE", "COLOR", "Blade style");
    this.SetExpansion(RetractionDelayX(Int(DELAY_MILLIS), BASE));
  }
}
function RetractionDelay(millis, base) {
  return new RetractionDelayClass(millis, base);
}

class RandomBlinkFClass extends FUNCTION {
  constructor(MILLIHZ) {
    super("Blink each LED randomly MILLIHZ times per second.", arguments);
    this.add_arg("MILLIHZ", "FUNCTION", "how often to blink");
    this.last_update = 0;
    this.state = [];
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    if (now - this.last_update > 1000000000 / this.MILLIHZ.getInteger(0)) {
      this.last_update = now;
      for (var i = 0; i < blade.num_leds(); i++) {
        this.state[i] = random(2);
      }
    }
  }

  getInteger(led) {
    return this.state[led] ? 32768 : 0;
  }
};

function RandomBlinkF(millihz) {
  return new RandomBlinkFClass(millihz);
}

class RandomBlinkLClass extends MACRO {
  constructor(MILLIHZ, COLOR1, COLOR2) {
    super("Blink each LED randomly MILLIHZ times per second.", arguments);
    this.add_arg("MILLIHZ", "FUNCTION", "how often to blink");
    this.add_arg("COLOR2", "COLOR", "second color", BLACK.DOCOPY());
    this.SetExpansion(AlphaL(this.COLOR2, RandomBlinkF(MILLIHZ)));
  }
};

function RandomBlinkL(millihz, c1) {
  return new RandomBlinkLClass(millihz, c1);
}

class RandomBlinkXClass extends MACRO {
  constructor(MILLIHZ, COLOR1, COLOR2) {
    super("Blink each LED randomly MILLIHZ times per second.", arguments);
    this.add_arg("MILLIHZ", "FUNCTION", "how often to blink");
    this.add_arg("COLOR1", "COLOR", "first color", WHITE.DOCOPY());
    this.add_arg("COLOR2", "COLOR", "second color", BLACK.DOCOPY());
    this.SetExpansion(Layers(this.COLOR1, RandomBlinkL(this.MILLIHZ, this.COLOR2)));
  }
};

function RandomBlinkX(millihz, c1, c2) {
  return new RandomBlinkXClass(millihz, c1, c2);
}

class RandomBlinkClass extends MACRO {
  constructor(MILLIHZ, COLOR1, COLOR2) {
    super("Blink each LED randomly MILLIHZ times per second.", arguments);
    this.add_arg("MILLIHZ", "INT", "how often to blink");
    this.add_arg("COLOR1", "COLOR", "first color", WHITE.DOCOPY());
    this.add_arg("COLOR2", "COLOR", "second color", BLACK.DOCOPY());
    this.SetExpansion(RandomBlinkX(Int(this.MILLIHZ), this.COLOR1, this.COLOR2));
  }
};

function RandomBlink(MILLIHZ, COLOR1, COLOR2) {
  return new RandomBlinkClass(MILLIHZ, COLOR1, COLOR2);
}

class SequenceFClass extends FUNCTION {
  constructor(ARGS) {
    super("Pre-defined sequence of 0 and 32768", ARGS);
    this.add_arg("MILLIS_PER_BIT", "INT", "Milliseconds per bit.");
    this.add_arg("BITS", "INT", "total bits");
    for (var i = 0; i < this.BITS; i+= 16) {
      this.add_arg("BITS"+i, "INT", "Bit sequence " + ((i/16)+1));
    }
    this.SEQUENCE = Array.from(ARGS).slice(2);
  }
  run(blade) {
    super.run(blade);
    var now = millis();
    var bit = (now / this.MILLIS_PER_BIT) % min(this.BITS, this.SEQUENCE.length * 16);
    this.on = !!(this.SEQUENCE[bit >> 4] >> ((~bit) & 0xf) & 1)
  }
  getInteger(led) {
    return this.on ? 32768 : 0;
  }
};

function SequenceF(MILLIHZ_PER_BIT, BITS, SEQUENCE) {
  return new SequenceFClass(Array.from(arguments));
}

class SequenceLClass extends MACRO {
  constructor(ARGS) {
    super("Pre-defined sequence", ARGS);
    this.add_arg("COLOR", "COLOR", "Color if bit is 2");
    this.add_arg("MILLIS_PER_BIT", "INT", "Milliseconds per bit.");
    this.add_arg("BITS", "INT", "total bits");
    for (var i = 0; i < this.BITS; i+= 16) {
      this.add_arg("BITS"+i, "INT", "Bit sequence " + ((i/16)+1));
    }
    this.SetExpansion(AlphaL(this.COLOR, new SequenceFClass(ARGS.slice(1))));
  }
};

function SequenceL(COLOR2, MILLIHZ_PER_BIT, BITS, SEQUENCE) {
  return new SequenceLClass(Array.from(arguments));
}

class SequenceClass extends MACRO {
  constructor(ARGS) {
    super("Pre-defined sequence", ARGS);
    this.add_arg("COLOR1", "COLOR", "Color if bit is 1");
    this.add_arg("COLOR2", "COLOR", "Color if bit is 0");
    this.add_arg("MILLIS_PER_BIT", "INT", "Milliseconds per bit.");
    this.add_arg("BITS", "INT", "total bits");
    for (var i = 0; i < this.BITS; i+= 16) {
      this.add_arg("BITS"+i, "INT", "Bit sequence " + ((i/16)+1));
    }
    this.SetExpansion(Layers(this.COLOR2, new SequenceLClass([this.COLOR1].concat(ARGS.slice(2)))));
  }
};

function Sequence(COLOR1, COLOR2, MILLIHZ_PER_BIT, BITS, SEQUENCE) {
  return new SequenceClass(Array.from(arguments));
}

class ColorSequenceClass extends STYLE {
  constructor(ARGS) {
    super("Pre-defined sequence", ARGS);
    this.add_arg("MILLIS_PER_COLOR", "INT", "Milliseconds before moving to next color.");
    this.COLORS = Array.from(ARGS).slice(1);
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);
    this.last_micros = 0;
    this.n = 0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var millis_per_color = this.MILLIS_PER_COLOR.getInteger(0);
    if (now - this.last_micros > millis_per_color * 1000) {
      if (now - this.last_micros > millis_per_color * 10000) {
        this.n = 0;
        this.last_micros = now;
      } else {
        this.n = (this.n + 1) % this.COLORS.length;
        this.last_micros += millis_per_color * 1000;
      }
    }
  }
  getColor(led) { return this.COLORS[this.n].getColor(led); }
};

function ColorSequence(MPC, C) {
  return new ColorSequenceClass(Array.from(arguments));
};

class EffectSequenceClass extends STYLE {
  constructor(ARGS) {
    super("Sequence that changes on events.", ARGS);
    this.add_arg("EFFECT", "EFFECT", "effect that goes to next color");
    this.COLORS = Array.from(ARGS).slice(1);
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);
    this.last_micros = 0;
    this.n = this.COLORS.length - 1;
    this.effect_ = new OneshotEffectDetector(this.EFFECT);
  }
  run(blade) {
    super.run(blade);
    var now = micros();

    if (this.effect_.Detect(blade)) {
      this.n = (this.n + 1) % this.COLORS.length;
    }
  }
  getColor(led) { return this.COLORS[this.n].getColor(led); }
};

function EffectSequence(MPC, C) {
  return new EffectSequenceClass(Array.from(arguments));
};

class StripesXClass extends STYLE {
  constructor(ARGS) {
    super("Configurable rainbow", ARGS);
    this.add_arg("WIDTH", "FUNCTION", "Stripe width");
    this.add_arg("SPEED", "FUNCTION", "Scroll speed");
    this.COLORS = ARGS.slice(2);
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);
    this.last_micros = 0;
    this.m = 0;
  }
  run(blade) {
    super.run(blade);
    var now_micros = micros();
    var delta_micros = now_micros - this.last_micros;
    this.last_micros = now_micros;
    this.m = MOD( (this.m + delta_micros * this.SPEED.getInteger(0) / 333), (this.COLORS.length * 341 * 1024))
    this.mult = (50000 * 1024 / this.WIDTH.getInteger(0));
  }
  GET_COLOR(N, led, p, ret) {
    if (N >= this.COLORS.length || p < 0) return;
    if (p > 0 && p < 512) {
      var tmp = this.COLORS[N].getColor(led);
      var mul = sin(p * Math.PI / 512.0);
      ret.r += tmp.r * mul;
      ret.g += tmp.g * mul;
      ret.b += tmp.b * mul;
    }
    this.GET_COLOR(N+1, led, p - 341, ret);
  }
  getColor(led) {
    var p = ((this.m + led * this.mult) >> 10) % (this.COLORS.length * 341);
    var ret = Rgb(0,0,0);
    this.GET_COLOR(0, led, p, ret);
    this.GET_COLOR(0, led, p + 341 * this.COLORS.length, ret);
    return ret;
  }
}

function StripesX(W,S,C) {
  return new StripesXClass(Array.from(arguments));
}

class StripesClass extends MACRO {
  constructor(ARGS) {
    super("Configurable rainbow", ARGS);
    this.add_arg("WIDTH", "INT", "Stripe width");
    this.add_arg("SPEED", "INT", "Scroll speed");
    this.COLORS = ARGS.slice(2);
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);

    this.SetExpansion(new StripesXClass([Int(this.WIDTH), Int(this.SPEED)].concat(this.COLORS)));
  }
}

function Stripes(W,S,C) {
  return new StripesClass(Array.from(arguments));
}

class AudioFlickerLClass extends MACRO {
  constructor(COLOR) {
    super("Audio flicker layer, higher volumes means less transparent.", arguments);
    this.add_arg("COLOR", "COLOR", "COLOR");
    this.SetExpansion(AlphaL(this.COLOR, NoisySoundLevelCompat()));
  }
}

function AudioFlickerL(B) {
  return new AudioFlickerLClass(B);
}

class AudioFlickerClass extends MACRO {
  constructor(A, B) {
    super("Select between A and B based on audio. Higher volumes means more B.", arguments);
    this.add_arg("A","COLOR","A");
    this.add_arg("B","COLOR","B");
    this.SetExpansion(Layers(this.A, AudioFlickerL(this.B)));
  }
};

function AudioFlicker(A, B) {
  return new AudioFlickerClass(A, B);
}

class RandomFClass extends FUNCTION {
  constructor(A, B) {
    super("Random number 0 - 32768.", arguments);
  }
  run(blade) {
    this.var_ = Math.random() * 32768;;
  }
  getInteger(led) {
    return this.var_;
  }
};

function RandomF() {
  return new RandomFClass();
}

class RandomLClass extends MACRO {
  constructor(A) {
    super("Selects between A and transparent randomly.", arguments);
    this.add_arg("A", "COLOR", "A");
    this.SetExpansion(AlphaL(A, RandomF()));
  }
};

function RandomL(A) {
  return new RandomLClass(A);
}

class RandomFlickerClass extends MACRO {
  constructor(A, B) {
    super("Selects between A and B randomly.", arguments);
    this.add_arg("A", "COLOR", "A");
    this.add_arg("B", "COLOR", "B");
    this.SetExpansion(Layers(A, RandomL(B)));
  }
};

function RandomFlicker(A, B) {
  return new RandomFlickerClass(A, B);
}

class RandomPerLEDFClass extends FUNCTION {
  constructor() {
    super("Returns random 0-32768.", arguments);
  }
  getInteger(led) {
    return random(32768);
  }
};

function RandomPerLEDF() {
  return new RandomPerLEDFClass();
}

class RandomPerLEDFlickerLClass extends MACRO {
  constructor(A) {
    super("Selects between A and transparent randomly.", arguments);
    this.add_arg("A", "COLOR", "A");
    this.SetExpansion(AlphaL(A, RandomPerLEDF()));
  }
};

function RandomPerLEDFlickerL(A) {
  return new RandomPerLEDFlickerLClass(A);
}

class RandomPerLEDFlickerClass extends MACRO {
  constructor(A, B) {
    super("Selects between A and B randomly.", arguments);
    this.add_arg("A", "COLOR", "A");
    this.add_arg("B", "COLOR", "B");
    this.SetExpansion(Layers(A, RandomPerLEDFlickerL(B)));
  }
};

function RandomPerLEDFlicker(A, B) {
  return new RandomPerLEDFlickerClass(A, B);
}

class RemapClass extends STYLE {
  constructor(F, COLOR) {
    super("Remaps the pixels of COLOR based on F", arguments);
    this.add_arg("F", "FUNCTION", "remap function");
    this.add_arg("COLOR", "COLOR", "COLOR");
  }
  run(blade) {
    super.run(blade);
    this.num_leds = blade.num_leds();
  }
  getColor(led) {
    var pos = this.F.getInteger(led);
    var led = clamp(pos * this.num_leds, 0, this.num_leds * 32768 - 1);
    var fraction = led & 0x7fff;
    led = clamp(led >> 15, 0, this.num_leds);
    return this.COLOR.getColor(led).mix(
        this.COLOR.getColor(min(led + 1, this.num_leds - 1)),
        fraction / 32768);
  }
}

function Remap(F, COLOR) {
  return new RemapClass(F, COLOR);
}

class BrownNoiseFClass extends FUNCTION {
  constructor(grade) {
    super("Randomly return values between 0 and 32768, but keeps nearby values similar", Array.from(arguments));
    this.add_arg("GRADE", "FUNCTION", "grade");
  }
  run(blade) {
    super.run(blade);
    this.mix = Math.floor(Math.random()*32768);
  }
  getInteger(led) {
    var grade = this.GRADE.getInteger(led);
    this.mix += Math.floor(Math.random() * (grade * 2 + 1)) - grade;
    this.mix = clamp(this.mix, 0, 32768);
    return this.mix;
  }
};

function BrownNoiseF(grade) {
  return new BrownNoiseFClass(grade);
}

class BrownNoiseFlickerLClass extends MACRO {
  constructor(B, GRADE) {
    super("Randomly selects between A and B but keeps nearby pixels similar", Array.from(arguments));
    this.add_arg("B", "COLOR", "B");
    this.add_arg("GRADE", "FUNCTION", "grade");
    this.SetExpansion(AlphaL(B, BrownNoiseF(GRADE)))
  }
};

function BrownNoiseFlickerL(B, grade) {
  return new BrownNoiseFlickerLClass(B, grade);
}

class BrownNoiseFlickerClass extends MACRO {
  constructor(A, B, GRADE) {
    super("Randomly selects between A and B but keeps nearby pixels similar", Array.from(arguments));
    this.add_arg("A", "COLOR", "A");
    this.add_arg("B", "COLOR", "B");
    this.add_arg("GRADE", "INT", "grade");
    this.SetExpansion(Layers(A, BrownNoiseFlickerL(B, Int(this.GRADE * 128))))
  }
};

function BrownNoiseFlicker(A, B, grade) {
  return new BrownNoiseFlickerClass(A, B, grade);
}

class HumpFlickerFXClass extends FUNCTION {
  constructor(hump_width) {
    super("Picks a random spot for a bump each frame.", Array.from(arguments));
    this.add_arg("hump_width", "FUNCTION", "Hump width");
  }
  run(blade) {
    super.run(blade);
    this.pos = Math.floor(Math.random() * blade.num_leds());
  }
  getInteger(led) {
    return clamp(Math.abs(led - this.pos) * 32768 / this.hump_width.getInteger(led), 0, 32768);
  }
};

function HumpFlickerFX(hump_width) {
  return new HumpFlickerFXClass(hump_width);
}

class HumpFlickerFClass extends MACRO {
  constructor(hump_width) {
    super("Picks a random spot for a bump each frame.", Array.from(arguments));
    this.add_arg("hump_width", "INT", "Hump width");
    this.SetExpansion(HumpFlickerFX(Int(hump_width)));
  }
};

function HumpFlickerF(hump_width) {
  return new HumpFlickerFClass(hump_width);
}

class HumpFlickerLClass extends MACRO {
  constructor(B, hump_width) {
    super("Picks a random spot for a bump each frame.", Array.from(arguments));
    this.add_arg("B", "COLOR", "B");
    this.add_arg("hump_width", "INT", "Hump width");
    this.SetExpansion(AlphaL(B, HumpFlickerF(hump_width)));
  }
};

function HumpFlickerL(B, hump_width) {
  return new HumpFlickerLClass(B, hump_width);
}

class HumpFlickerClass extends MACRO {
  constructor(A, B, hump_width) {
    super("Picks a random spot for a bump each frame.", Array.from(arguments));
    this.add_arg("A", "COLOR", "A");
    this.add_arg("B", "COLOR", "B");
    this.add_arg("hump_width", "INT", "Hump width");
    this.SetExpansion(Layers(A, HumpFlickerL(B, hump_width)));
  }
};

function HumpFlicker(A, B, hump_width) {
  return new HumpFlickerClass(A, B, hump_width);
}

class FireConfigClass extends CONFIG {
  constructor(INTENSITY_BASE, INTENSITY_RAND, COOLING) {
    super("Fire configuration", Array.from(arguments));
    this.add_arg("intensity_base", "INT", "intensity base");
    this.add_arg("intensity_rand", "INT", "intensity random");
    this.add_arg("cooling", "INT", "cooling");
  }
  getType() { return "FireConfig"; }
}

function FireConfig(B, R, C) {
  return new FireConfigClass(B, R, C);
}

function FireConfigI(B, R, C) {
  return new FireConfigClass(new INTEGER(B), new INTEGER(R), new INTEGER(C));
}

const FIRE_STATE_OFF = 0
const FIRE_STATE_ACTIVATING = 1;
const FIRE_STATE_ON = 2;

class StyleFireClass extends STYLE {
  constructor(COLOR1, COLOR2, DELAY, SPEED, NORM, CLASH, LOCK, OFF) {
    super("Too complicated to describe briefly", Array.from(arguments));
    this.add_arg("COLOR1", "COLOR", "Warm color");
    this.add_arg("COLOR2", "COLOR", "Hot color");
    this.add_arg("DELAY", "INT", "Delay", 0);
    this.add_arg("SPEED", "INT", "Speed", 2);
    this.add_arg("NORM", "FireConfig", "Config when on", FireConfigI(0, 2000, 5));
    this.add_arg("CLASH", "FireConfig", "Config during clash", FireConfigI(3000, 0, 0));
    this.add_arg("LOCK", "FireConfig", "Config during lockup", FireConfigI(0, 5000, 10));
    this.add_arg("OFF", "FireConfig", "Config when off", FireConfigI(0, 0, this.NORM.cooling.value));
    this.heat = new Uint16Array(144 + 13);
    this.state = FIRE_STATE_OFF;
    this.last_update = 0;
    this.clash_detector_ = new OneshotEffectDetector(EFFECT_CLASH);
  }
  On(blade) {
    if (!blade.is_on()) {
      this.state = FIRE_STATE_OFF;
      return false;
    }
    if (this.state == FIRE_STATE_OFF) {
      this.state = FIRE_STATE_ACTIVATING;
      this.on_time = millis();
    }
    if (this.state = FIRE_STATE_ACTIVATING) {
      if (millis() - this.on_time < this.DELAY) return false;
      this.state = FIRE_STATE_ON;
    }
    return true;
  }
  run(blade) {
    super.run(blade);
    var m = millis();
    if (m - this.last_update < 10)
      return;
    if (m - this.last_update < 40) {
      this.last_update += 10;;
    } else {
      this.last_update = m;
    }
    var num_leds = blade.num_leds();
    this.num_leds = num_leds;
    var conf = this.OFF;
    if (this.clash_detector_.Detect(blade)) {
      conf = this.CLASH;
    } else if (this.On(blade)) {
      if (STATE_LOCKUP == 0) {
        conf = this.NORM;
      } else {
        conf = this.LOCK;
      }
    }

    for (var i = 0; i < this.SPEED; i++) {
      this.heat[num_leds + i] = conf.intensity_base +
        random(random(random(conf.intensity_rand)));
    }
    for (var i = 0; i < num_leds; i++) {
      var x = (this.heat[i + this.SPEED-1] * 3 + this.heat[i + this.SPEED] * 10 + this.heat[i + this.SPEED +1] * 3) >> 4;
      x -= random(conf.cooling);
      this.heat[i] = max(0, min(x, 65535));
    }
  }
  getColor(led) {
    var h = this.heat[this.num_leds - 1 - led];
    if (h < 256) {
      return  BLACK.mix(this.COLOR1.getColor(led), h / 255.0);
    } else if (h < 512) {
      return this.COLOR1.getColor(led).mix(this.COLOR2.getColor(led), (h-256)/255.0);
    } else if (h < 768) {
      return this.COLOR2.getColor(led).mix(WHITE, (h - 512) / 255.0);
    } else {
      return WHITE;
    }
  }
};

function StyleFire(COLOR1, COLOR2, DELAY, SPEED, NORM, CLASH, LOCK, OFF) {
  return new StyleFireClass(COLOR1, COLOR2, DELAY, SPEED, NORM, CLASH, LOCK, OFF);
}

class StaticFireClass extends MACRO {
  constructor(COLOR1, COLOR2, DELAY, SPEED, BASE, RAND, COOLING) {
    super("Non-responsive fire style alias.", Array.from(arguments));
    this.add_arg("COLOR1", "COLOR", "Warm color");
    this.add_arg("COLOR2", "COLOR", "Hot color");
    this.add_arg("DELAY", "INT", "Delay", 0);
    this.add_arg("SPEED", "INT", "Speed", 2);
    this.add_arg("BASE", "INT", "Base", 0);
    this.add_arg("RAND", "INT", "Random", 2000);
    this.add_arg("COOLING", "INT", "Cooling", 5);
    this.SetExpansion(StyleFire(COLOR1, COLOR2, this.DELAY, this.SPEED,
                                FireConfig(this.BASE, this.RAND, this.COOLING),
                                FireConfig(this.BASE, this.RAND, this.COOLING),
                                FireConfig(this.BASE, this.RAND, this.COOLING),
                                FireConfig(this.BASE, this.RAND, this.COOLING)));
  }
};

function StaticFire(COLOR1, COLOR2, DELAY, SPEED, BASE, RAND, COOLING) {
  return new StaticFireClass(COLOR1, COLOR2, DELAY, SPEED, BASE, RAND, COOLING);
}

class RgbCycleClass extends STYLE {
  constructor() {
    super();
    this.n = 0;
  }
  run(blade) {
    this.n++;
    if (this.n >= 3) this.n = 0;
    if (this.n == 0) this.RET = Rgb(255,0,0);
    if (this.n == 1) this.RET = Rgb(0,255,0);
    if (this.n == 2) this.RET = Rgb(0,0,250);
  }
  getColor(led) {
    return this.RET;
  }
  pp() {
    return this.PP("RgbCycle", "alternates betwen red, green and blue.");
  }
};

function RgbCycle() {
  return new RgbCycleClass();
}

function AddBlast() {
  blade.addEffect(EFFECT_BLAST, Math.random() * 0.7 + 0.2);
}
function AddForce() {
  blade.addEffect(EFFECT_FORCE, Math.random() * 0.7 + 0.2);
}
var current_clash_value = 0;
var current_clash_strength = 0;
function AddClash() {
  current_clash_value = 200 + random(1600);
  current_clash_strength = 100 + random(current_clash_value);
  blade.addEffect(EFFECT_CLASH, Math.random() * 0.7 + 0.2);
}
function AddStab() {
  blade.addEffect(EFFECT_STAB, 1.0);
}
//////////// Add swing button, boot and newfont to menu PR ///////////
function AddSwing() {
  blade.addEffect(EFFECT_ACCENT_SWING, Math.random() * 0.7 + 0.2);
}

var blast_hump = [ 255,255,252,247,240,232,222,211,
                   199,186,173,159,145,132,119,106,
                   94,82,72,62,53,45,38,32,
                   26,22,18,14,11,9,7,5,0 ];

class BlastFClass extends FUNCTION {
  constructor(FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT_ARG) {
    super("Blast effect function", Array.from(arguments));
    this.add_arg("FADEOUT_MS", "INT", "fadeout time in milliseconds", 200);
    this.add_arg("WAVE_SIZE", "INT", "wave size", 100);
    this.add_arg("WAVE_MS", "INT", "wave speed", 400);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
  }
  run(blade) {
    this.T = micros();
    this.num_leds_ = 1.0 * blade.num_leds();
    this.effects_ = blade.GetEffects();
  }
  getInteger(led) {
    var b = 0.0;
    for (var i = 0; i < this.effects_.length; i++) {
      if (this.effects_[i].type != this.EFFECT) continue;
      var T = (this.T - this.effects_[i].start_micros);
      var M = 1000 - T / this.FADEOUT_MS;
      if (M > 0) {
        var dist = Math.abs(this.effects_[i].location - led / this.num_leds_);
        var N = Math.floor(Math.abs(dist - T / (this.WAVE_MS * 1000.0)) * this.WAVE_SIZE);
        if (N < 32) {
          b += blast_hump[N] * M / 1000.0 / 255.0;
        }
      }
    }
    return clamp(b * 32768, 0, 32768);
  }
};

function BlastF(FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT) {
  return new BlastFClass(FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT);
}

class BlastLClass extends MACRO {
  constructor(BLAST, FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT_ARG) {
    super("Blast layer", Array.from(arguments));
    this.add_arg("BLAST", "COLOR", "blast color");
    this.add_arg("FADEOUT_MS", "INT", "fadeout time in milliseconds", 200);
    this.add_arg("WAVE_SIZE", "INT", "wave size", 100);
    this.add_arg("WAVE_MS", "INT", "wave speed", 400);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(AlphaL(BLAST, BlastF(FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT_ARG)));
  }
  argify(state) {
    state.color_argument = BLAST_COLOR_ARG;
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function BlastL(BLAST, FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT) {
  return new BlastLClass(BLAST, FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT);
}

class BlastClass extends MACRO {
  constructor(BASE, BLAST, FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT_ARG) {
    super("Blast effect", Array.from(arguments));
    this.add_arg("BASE", "COLOR", "base color");
    this.add_arg("BLAST", "COLOR", "blast color");
    this.add_arg("FADEOUT_MS", "INT", "fadeout time in milliseconds", 200);
    this.add_arg("WAVE_SIZE", "INT", "wave size", 100);
    this.add_arg("WAVE_MS", "INT", "wave speed", 400);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(Layers(BASE, BlastL(BLAST, FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT_ARG)));
  }
};

function Blast(BASE, BLAST, FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT) {
  return new BlastClass(BASE, BLAST, FADEOUT_MS, WAVE_SIZE, WAVE_MS, EFFECT);
}

class BlastFadeoutFClass extends FUNCTION {
  constructor(FADEOUT_MS, EFFECT_ARG) {
    super("Fadeout on blast function", Array.from(arguments));
    this.add_arg("FADEOUT_MS", "INT", "fadeout time in milliseconds", 200);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
  }
  run(blade) {
    super.run(blade);
    this.T = micros();
    this.effects_ = blade.GetEffects();
  }
  getInteger(led) {
    var b = 0.0;
    for (var i = 0; i < this.effects_.length; i++) {
      if (this.effects_[i].type != this.EFFECT) continue;
      var T = (this.T - this.effects_[i].start_micros);
      var M = 1000 - T / this.FADEOUT_MS;
      if (M > 0) {
        b += M / 1000.0;
      }
    }
    return clamp(b * 32768.0, 0, 32768.0);
  }
};

function BlastFadeoutF(FADEOUT_MS, EFFECT) {
  return new BlastFadeoutFClass(FADEOUT_MS, EFFECT);
}

class BlastFadeoutLClass extends MACRO {
  constructor(BLAST, FADEOUT_MS, EFFECT_ARG) {
    super("BlastFadeout layers", Array.from(arguments));
    this.add_arg("BLAST", "COLOR", "blast color");
    this.add_arg("FADEOUT_MS", "INT", "fadeout time in milliseconds", 200);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(AlphaL(BLAST, BlastFadeoutF(FADEOUT_MS, EFFECT_ARG)));
  }
};

function BlastFadeoutL(BLAST, FADEOUT_MS, EFFECT) {
  return new BlastFadeoutLClass(BLAST, FADEOUT_MS, EFFECT);
}

class BlastFadeoutClass extends MACRO {
  constructor(BASE, BLAST, FADEOUT_MS, EFFECT_ARG) {
    super("BlastFadeout effect", Array.from(arguments));
    this.add_arg("BASE", "COLOR", "base color");
    this.add_arg("BLAST", "COLOR", "blast color");
    this.add_arg("FADEOUT_MS", "INT", "fadeout time in milliseconds", 200);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(Layers(BASE, BlastFadeoutL(BLAST, FADEOUT_MS, EFFECT_ARG)));
  }
};

function BlastFadeout(BASE, BLAST, FADEOUT_MS, EFFECT) {
  return new BlastFadeoutClass(BASE, BLAST, FADEOUT_MS, EFFECT);
}

class OriginalBlastFClass extends FUNCTION {
  constructor(BASE, BLAST, EFFECT_ARG) {
    super("Original blast effect", Array.from(arguments));
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
  }
  run(blade) {
    super.run(blade);
    this.T = micros();
    this.num_leds_ = 1.0 * blade.num_leds();
    this.effects_ = blade.GetEffects();
  }
  getInteger(led) {
    var b = 0.0;
    for (var i = 0; i < this.effects_.length; i++) {
      if (this.effects_[i].type != this.EFFECT) continue;
      var x = (this.effects_[i].location - led/this.num_leds_) * 30.0;
      var T = (this.T - this.effects_[i].start_micros);
      var t = 0.5 + T / 200000.0;
      if (x == 0.0) {
        b += 1.0 / (t * t);
      } else {
        b += sin(x / (t*t)) / x;
      }
    }
    return min(b, 1.0) * 32768;
  }
};

function OriginalBlastF(EFFECT) {
  return new OriginalBlastFClass(EFFECT);
}

class OriginalBlastLClass extends MACRO {
  constructor(BLAST, EFFECT_ARG) {
    super("Original blast effect", Array.from(arguments));
    this.add_arg("BLAST", "COLOR", "blast color");
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(AlphaL(BLAST, OriginalBlastF(this.EFFECT)));
  }
};

function OriginalBlastL(BLAST, EFFECT) {
  return new OriginalBlastLClass(BLAST, EFFECT);
}

class OriginalBlastClass extends MACRO {
  constructor(BASE, BLAST, EFFECT_ARG) {
    super("Original blast effect", Array.from(arguments));
    this.add_arg("BASE", "COLOR", "base color");
    this.add_arg("BLAST", "COLOR", "blast color");
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_BLAST));
    this.SetExpansion(Layers(BASE, OriginalBlastL(BLAST, this.EFFECT)));
  }
};

function OriginalBlast(BASE, BLAST, EFFECT) {
  return new OriginalBlastClass(BASE, BLAST, EFFECT);
}

class BlinkingFClass extends SVF_FUNCTION {
  constructor(BLINK_MILLIS, BLINK_PROMILLE) {
    super("Blinks between 0 and 32768", Array.from(arguments));
    this.add_arg("BLINK_MILLIS", "FUNCTION", "milliseconds between blinks");
    this.add_arg("BLINK_PROMILLE", "FUNCTION", "0 = off, 1000 = on");
    this.on_ = false;
    this.pulse_start_micros_ = 0;
  }
  run(blade) {
    super.run(blade);
    var now = micros();
    var pulse_millis = this.BLINK_MILLIS.getInteger(0);
    if (pulse_millis <= 0) return;
    var pulse_progress_micros = now - this.pulse_start_micros_;
    if (pulse_progress_micros > pulse_millis * 1000) {
      // Time to start a new pulse
      if (pulse_progress_micros < pulse_millis * 2000) {
        this.pulse_start_micros_ += pulse_millis * 1000;
      } else {
        this.pulse_start_micros_ = now;
      }
      pulse_progress_micros = now - this.pulse_start_micros_;
    }
    var pulse_progress_promille = pulse_progress_micros / pulse_millis;
      this.value_ = pulse_progress_promille <= this.BLINK_PROMILLE.getInteger(0) ? 0 : 32768;
  }
  getInteger(led) {
    return this.value_;
  }
};

function BlinkingF(BM, BP) {
  return new BlinkingFClass(BM, BP);
}

class BlinkingLClass extends MACRO {
  constructor(COLOR, BLINK_MILLIS, BLINK_PROMILLE) {
    super("Blinks transparent/opaque COLOR", Array.from(arguments));
    this.add_arg("COLOR", "COLOR", "COLOR");
    this.add_arg("BLINK_MILLIS", "FUNCTION", "milliseconds between blinks");
    this.add_arg("BLINK_PROMILLE", "FUNCTION", "0 = off, 1000 = on");
    this.SetExpansion(AlphaL(COLOR, BlinkingF(BLINK_MILLIS, BLINK_PROMILLE)));
  }
};

function BlinkingL(A, B, BM, BP) {
  return new BlinkingLClass(A, B, BM, BP);
}

class BlinkingXClass extends MACRO {
  constructor(COLOR1, COLOR2, BLINK_MILLIS, BLINK_PROMILLE) {
    super("Blinks between A and B", Array.from(arguments));
    this.add_arg("COLOR1", "COLOR", "A");
    this.add_arg("COLOR2", "COLOR", "B");
    this.add_arg("BLINK_MILLIS", "FUNCTION", "milliseconds between blinks");
    this.add_arg("BLINK_PROMILLE", "FUNCTION", "0 = off, 1000 = on");
    this.SetExpansion(Layers(COLOR1, BlinkingL(COLOR2, BLINK_MILLIS, BLINK_PROMILLE)));
  }
};

function BlinkingX(A, B, BM, BP) {
  return new BlinkingXClass(A, B, BM, BP);
}

class BlinkingClass extends MACRO {
  constructor(COLOR1, COLOR2, BLINK_MILLIS, BLINK_PROMILLE) {
    super("Blinks between A and B", Array.from(arguments));
    this.add_arg("COLOR1", "COLOR", "A");
    this.add_arg("COLOR2", "COLOR", "B");
    this.add_arg("BLINK_MILLIS", "INT", "milliseconds between blinks");
    this.add_arg("BLINK_PROMILLE", "INT", "0 = off, 1000 = on");
    this.SetExpansion(BlinkingX(COLOR1, COLOR2, Int(BLINK_MILLIS), Int(BLINK_PROMILLE)));
  }
};

function Blinking(A, B, BM, BP) {
  return new BlinkingClass(A, B, BM, BP);
}

class SimpleClashLClass extends STYLE {
  constructor(T, CLASH, CLASH_MILLIS, EFFECT_ARG, STAB_SHAPE) {
    super("Implements the clash effect", Array.from(arguments));
    this.add_arg("CLASH", "COLOR", "Clash color");
    this.add_arg("CLASH_MILLIS", "INT", "How many MS to show the clash color for.", 40);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_CLASH));
    this.add_arg("STAB_SHAPE", "FUNCTION", "Stab shape", SmoothStep(Int(16384), Int(24000)));
    this.effect_ = new OneshotEffectDetector(this.EFFECT);
    this.clash_ = false;
    this.stab_ = false;
  }
  run(blade) {
    super.run(blade);

    if (this.clash_ && micros() - this.effect_.last_detected_ > this.CLASH_MILLIS * 1000) {
      this.clash_ = false;
    }
    var e = this.effect_.Detect(blade);
    if (e) {
      this.clash_ = true;
      this.stab_ = this.EFFECT == EFFECT_CLASH && e.type == EFFECT_STAB && blade.num_leds() > 1;
    }
  }
  getColor(led) {
    var ret = Transparent();
    if (this.clash_) {
      var ret = this.CLASH.getColor(led);
      if (this.stab_) {
        ret = ret.multiply(this.STAB_SHAPE.getInteger(led) / 32768.0);
      }
    }
    return ret;
  }
  IS_RUNNING() {
    return this.clash_;
  }
  argify(state) {
    state.color_argument = effect_to_argument(this.EFFECT);
    console.log("STATE IN SIMPLECLASHL:");
    console.log(state);
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function SimpleClashL(T, CLASH, MILLIS, EF, SS) {
  return new SimpleClashLClass(T, CLASH, MILLIS, EF, SS);
}

class SimpleClashClass extends MACRO {
  constructor(T, CLASH, CLASH_MILLIS, EFFECT_ARG, STAB_SHAPE) {
    super("Implements the clash effect", Array.from(arguments));
    this.add_arg("T", "COLOR", "base color");
    this.add_arg("CLASH", "COLOR", "Clash color");
    this.add_arg("CLASH_MILLIS", "INT", "How many MS to show the clash color for.", 40);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_CLASH));
    this.add_arg("STAB_SHAPE", "FUNCTION", "Stab shape", SmoothStep(Int(16384), Int(24000)));
    this.SetExpansion(Layers(T, SimpleClashL(CLASH, this.CLASH_MILLIS, this.EFFECT, this.STAB_SHAPE)));
  }
};

function SimpleClash(T, CLASH, MILLIS, EF, SS) {
  return new SimpleClashClass(T, CLASH, MILLIS, EF, SS);
}

class LocalizedClashLClass extends STYLE {
  constructor(CLASH_COLOR, CLASH_MILLIS, CLASH_WIDTH_PERCENT, EFFECT_ARG) {
    super("Localized clash", arguments);
    this.add_arg("CLASH_COLOR", "COLOR", "Clash color", WHITE.DOCOPY());
    this.add_arg("CLASH_MILLIS", "INT", "Clash duration in milliseconds", 40);
    this.add_arg("CLASH_WIDTH_PERCENT", "INT", "Clash width in percent of entire blade", 50);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_CLASH));
    this.effect_ = new OneshotEffectDetector(this.EFFECT);
  }
  run(blade) {
    super.run(blade);

    var m = millis();
    var clashing = 0;
    var e = this.effect_.Detect(blade);
    if (e) {
      this.clash = true;
      this.mult = blast_hump.length * 2 * 102400 / this.CLASH_WIDTH_PERCENT / blade.num_leds();
      this.clash_location = e.location * blade.num_leds() * this.mult;
    } else if (micros() - this.effect_.last_detected_ < this.CLASH_MILLIS.getInteger(0) * 1000) {
      this.clash = true;
    } else {
      this.clash = false;
    }
  }
  getColor(led) {
    var ret = Transparent();
    if (this.clash) {
      var dist = Math.floor(Math.abs(led * this.mult - this.clash_location) / 1024);
      if (dist < blast_hump.length) {
        var ret = this.CLASH_COLOR.getColor(led);
        ret = ret.multiply(blast_hump[dist] / 255.0);
      }
    }
    return ret;
  }
  IS_RUNNING() {
    return this.clash;
  }
  argify(state) {
    state.color_argument = effect_to_argument(this.EFFECT);
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
}

function LocalizedClashL(CLASH_COLOR, CLASH_MILLIS, CLASH_WIDTH_PERCENT, EF) {
  return new LocalizedClashLClass(CLASH_COLOR, CLASH_MILLIS, CLASH_WIDTH_PERCENT, EF);
}

class LocalizedClashClass extends MACRO {
  constructor(T, CLASH_COLOR, CLASH_MILLIS, CLASH_WIDTH_PERCENT, EFFECT_ARG) {
    super("Localized clash", arguments);
    this.add_arg("T", "COLOR", "base color");
    this.add_arg("CLASH_COLOR", "COLOR", "Clash color", WHITE.DOCOPY());
    this.add_arg("CLASH_MILLIS", "INT", "Clash duration in milliseconds", 40);
    this.add_arg("CLASH_WIDTH_PERCENT", "INT", "Clash width in percent of entire blade", 50);
    this.add_arg("EFFECT", "EFFECT", "effect type", EFFECT(EFFECT_CLASH));
    this.SetExpansion(Layers(T, LocalizedClashL(this.CLASH_COLOR, this.CLASH_MILLIS, this.CLASH_WIDTH_PERCENT, this.EFFECT)));
  }
}

function LocalizedClash(T, CLASH_COLOR, CLASH_MILLIS, CLASH_WIDTH_PERCENT, EF) {
  return new LocalizedClashClass(T, CLASH_COLOR, CLASH_MILLIS, CLASH_WIDTH_PERCENT, EF);
}

class LockupLClass extends STYLE {
  isEffect() { return true; }
  constructor(LOCKUP, DRAG_COLOR, LOCKUP_SHAPE, DRAG_SHAPE, LB_SHAPE) {
    super("Implements the lockup and drag effects.", arguments);
    this.add_arg("LOCKUP", "COLOR", "lockup color");
    this.add_arg("DRAG_COLOR", "COLOR", "drag color", this.LOCKUP.DOCOPY());
    this.add_arg("LOCKUP_SHAPE", "FUNCTION", "Lockup shape", Int(32768));
    this.add_arg("DRAG_SHAPE", "FUNCTION", "Drag shape", SmoothStep(Int(28671), Int(4096)));
    this.add_arg("LB_SHAPE", "FUNCTION", "Lightning block shape",
            LayerFunctions(Bump(Scale(SlowNoise(Int(2000)),Int(3000),Int(16000)),
                                Scale(BrownNoiseF(Int(10)),Int(14000),Int(8000))),
                           Bump(Scale(SlowNoise(Int(2300)),Int(26000),Int(8000)),
                                Scale(NoisySoundLevel(),Int(5000),Int(10000))),
                           Bump(Scale(SlowNoise(Int(2300)),Int(20000),Int(30000)),
                                Scale(IsLessThan(SlowNoise(Int(1500)),Int(8000)),Scale(NoisySoundLevel(),Int(5000),Int(0)),Int(0)))));
  }
  run(blade) {
    super.run(blade);
    this.single_pixel_ = blade.num_leds() == 1;
    this.handled = IsHandledLockup(STATE_LOCKUP);
  }
  getColor(led) {
    var ret = Transparent();
    if (this.handled) return ret;
    if (STATE_LOCKUP == LOCKUP_LIGHTNING_BLOCK) {
      ret = ret.mix(this.LOCKUP.getColor(led), this.LB_SHAPE.getInteger(led) / 32768.0);
    }
    if (STATE_LOCKUP == LOCKUP_DRAG) {
      var blend = this.single_pixel_ ? 32768 : this.DRAG_SHAPE.getInteger(led);
      ret = ret.mix(this.DRAG_COLOR.getColor(led), blend / 32768.0);
    }
    if (STATE_LOCKUP == LOCKUP_NORMAL) {
      ret = ret.mix(this.LOCKUP.getColor(led), this.LOCKUP_SHAPE.getInteger(led) / 32768.0);
    }
    return ret;
  }
  IS_RUNNING() {
    if (this.handled) return false;
    if (STATE_LOCKUP == LOCKUP_LIGHTNING_BLOCK) true;
    if (STATE_LOCKUP == LOCKUP_DRAG) return true;
    if (STATE_LOCKUP == LOCKUP_NORMAL) return true;
    return false;
  }
  argify(state) {
    state.color_argument = LOCKUP_COLOR_ARG;
    this.LOCKUP = this.LOCKUP.argify(state);
    state.color_argument = DRAG_COLOR_ARG;
    this.DRAG_COLOR = this.DRAG_COLOR.argify(state);
    state.color_argument = null;
    return this;
  }
};

function LockupL(LOCKUP, DRAG, LOCKUP_SHAPE, DRAG_SHAPE, LB_SHAPE) {
  return new LockupLClass(LOCKUP, DRAG, LOCKUP_SHAPE, DRAG_SHAPE, LB_SHAPE);
}

class LockupClass extends MACRO {
  constructor(BASE, LOCKUP, DRAG_COLOR, LOCKUP_SHAPE, DRAG_SHAPE) {
    super("Implements the lockup and drag effects.", arguments);
    this.add_arg("BASE", "COLOR", "base color");
    this.add_arg("LOCKUP", "COLOR", "lockup color");
    this.add_arg("DRAG_COLOR", "COLOR", "drag color", this.LOCKUP.DOCOPY());
    this.add_arg("LOCKUP_SHAPE", "FUNCTION", "Lockup shape", Int(32768));
    this.add_arg("DRAG_SHAPE", "FUNCTION", "Drag shape", SmoothStep(Int(28671), Int(4096)));
    this.SetExpansion(Layers(BASE, LockupL(LOCKUP, DRAG_COLOR,  LOCKUP_SHAPE, DRAG_SHAPE)));
  }
};

function Lockup(BASE, LOCKUP, DRAG, LOCKUP_SHAPE, DRAG_SHAPE) {
  return new LockupClass(BASE, LOCKUP, DRAG, LOCKUP_SHAPE, DRAG_SHAPE);
}

class LockupTrLClass extends STYLE {
  constructor(COLOR, BeginTr, EndTr, LOCKUP_TYPE) {
    super("Transition based lockup effect.", arguments);
    this.add_arg("COLOR", "COLOR", "Effect color.");
    this.add_arg("BEGIN_TR", "TRANSITION", "Begin lockup transition.");
    this.add_arg("END_TR", "TRANSITION", "End lockup transition.");
    this.add_arg("LOCKUP_TYPE", "LOCKUP_TYPE", "Lockup type");
    this.add_arg("CONDITION", "FUNCTION", "Lockup is postponed if conditition is zero.", Int(1));
    HandleLockup(LOCKUP_TYPE);
    this.active = "inactive";
    this.begin_active = false;
    this.end_active = false;
  }
  run(blade) {
    super.run(blade);
    switch (this.active) {
       case "inactive":
          if (STATE_LOCKUP == this.LOCKUP_TYPE) {
            if (this.CONDITION.getInteger(0) != 0) {
              this.active = "active";
              this.BEGIN_TR.begin();
              this.begin_active = true;
            } else {
              this.active = "skipped";
            }
          }
          break;
       case "active":
         if (STATE_LOCKUP != this.LOCKUP_TYPE) {
           this.END_TR.begin();
           this.end_active = true;
           this.active = "inactive";
         }
         break;
       case "skipped":
         if (STATE_LOCKUP != this.LOCKUP_TYPE) {
           this.active = "inactive";
         }
         break;
    }


    if (this.begin_active) {
      this.BEGIN_TR.run(blade);
      if (this.BEGIN_TR.done()) this.begin_active = false;
    }
    if (this.end_active) {
      this.END_TR.run(blade);
      if (this.END_TR.done()) this.end_active = false;
    }
  }
  runBegin(a, b, led) {
    if (this.begin_active) {
      return this.BEGIN_TR.getColor(a, b, led);
    } else {
      return b;
    }
  }
  runEnd(a, b, led) {
    if (this.end_active) {
      return this.END_TR.getColor(a, b, led);
    } else {
      return b;
    }
  }
  getColor(led) {
    var off_color = Transparent();
    if (!this.begin_active && !this.end_active) {
      if (this.active == "active") {
        return this.COLOR.getColor(led);
      } else {
        return off_color;
      }
    } else {
      var on_color = this.COLOR.getColor(led);
      if (this.active == "active") {
        return this.runBegin(this.runEnd(on_color, off_color, led), on_color, led);
      } else {
        return this.runEnd(this.runBegin(off_color, on_color, led), off_color, led);
      }
    }
  }
  IS_RUNNING() {
    return this.active == "active";
  }
  argify(state) {
    state.color_argument = lockup_to_argument(this.LOCKUP_TYPE);
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function LockupTrL(COLOR, BeginTr, EndTr, LOCKUP_TYPE, CONDITION) {
  return new LockupTrLClass(COLOR, BeginTr, EndTr, LOCKUP_TYPE, CONDITION);
}

class LockupTrClass extends MACRO {
  constructor(BASE, COLOR, BeginTr, EndTr, LOCKUP_TYPE, CONDITION) {
    super("Transition based lockup effect.", arguments);
    this.add_arg("BASE", "COLOR", "Base color.");
    this.add_arg("COLOR", "COLOR", "Effect color.");
    this.add_arg("BEGIN_TR", "TRANSITION", "Begin lockup transition.");
    this.add_arg("END_TR", "TRANSITION", "End lockup transition.");
    this.add_arg("LOCKUP_TYPE", "LOCKUP_TYPE", "Lockup type");
    this.add_arg("CONDITION", "FUNCTION", "Lockup is postponed if conditition is zero.", Int(1));
    this.SetExpansion(Layers(BASE, LockupTrL(COLOR, BeginTr, EndTr, LOCKUP_TYPE, this.CONDITITION)));
  }
  argify(state) {
    state.color_argument = lockup_to_argument(this.LOCKUP_TYPE);
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
}

function LockupTr(BASE, COLOR, BeginTr, EndTr, LOCKUP_TYPE, CONDITION) {
  return new LockupTrClass(BASE, COLOR, BeginTr, EndTr, LOCKUP_TYPE, CONDITION);
}

class Blade {
  constructor() {
    this.effects_ = [];
  }
  is_on() {
    return STATE_ON;
  }
  num_leds() {
    return STATE_NUM_LEDS;
  }
  addEffect(type, location) {
//////////// Logging PR ///////////////
    // Use actual effect name for console logging clarity.
    const effectName = Object.keys(window).find(
      key => window[key] === type && key.indexOf("EFFECT_") === 0) || type;
    console.log("Add effect " + effectName + " (" + type + ") @ " + location);
    this.effects_.push(new BladeEffect(type, micros(), location));
  }
  GetEffects() {
    while (this.effects_.length > 0 && micros() - this.effects_[0].start_micros >= 5000000) {
      this.effects_.shift();
    }
    return this.effects_;
  }
};

//////////// SOUND1 PR ///////////////
// blade.addEffect override
const origAddEffect = Blade.prototype.addEffect;

Blade.prototype.addEffect = function(type, location) {
  type = Number(type);
  // Run the original so visuals still trigger
  origAddEffect.call(this, type, location);

  // Auto-follow DESTRUCT → BOOM
  if (type === EFFECT_DESTRUCT) {
    setTimeout(() => {
      const idx = lastPlayedSoundIndex['destruct'];
      const rawDur = customFontSoundDurations['destruct']?.[idx];
      const dur = (typeof rawDur === 'number' && rawDur > 50) ? rawDur : 500;
      setTimeout(() => {
        this.addEffect(EFFECT_BOOM, location);
      }, dur);
    }, 10);
  }

  const allowedByStyle = new Set(
    Array.from(getAllowedEventsFromStyleText())
      .filter(x =>
        EFFECT_ENUM_BUILDER.value_to_name.hasOwnProperty(x) ||
        LOCKUP_ENUM_BUILDER.value_to_name.hasOwnProperty(x)
      )
  );
  const BEGIN_EFFECT_MAP = {
    [EFFECT_LOCKUP_BEGIN]:    "bgnlock",
    [EFFECT_DRAG_BEGIN]:      "bgndrag",
    [EFFECT_MELT_BEGIN]:      "bgnmelt",
    [EFFECT_LB_BEGIN]:        "bgnlb",
    [EFFECT_AUTOFIRE_BEGIN]:  "bgnauto"
  };
  if (BEGIN_EFFECT_MAP[type]) {
    const lockupType = lockupTypeForEffect(type);
    if (allowedByStyle.has(lockupType)) {
      // Triggered by Do Selected Effect button
      if (lockupLoopSrc) playRandomEffect(BEGIN_EFFECT_MAP[type], true);
      // Triggered by Lockup chooser dropdown
      if (!lockupLoopSrc) startLockupLoop(type);
    }
    return;
  }

    const END_EFFECT_MAP = {
      [EFFECT_LOCKUP_END]:    "endlock",
      [EFFECT_DRAG_END]:      "enddrag",
      [EFFECT_MELT_END]:      "endmelt",
      [EFFECT_LB_END]:        "endlb",
      [EFFECT_AUTOFIRE_END]:  "endauto"
    };
    // if (END_EFFECT_MAP[type]) {
// needed this for some reason, now not...?
    //   // If being called because we are forcibly ending a lockup with "Stop"
    //   // always end the lockup loop (even if sound is denied by style)
    //   const forceEnd = !allowedByStyle.has(type) && lockupLoopSrc;
    //   endLockupLoop(type, (allowedByStyle.has(type) || forceEnd) ? END_EFFECT_MAP[type] : null, true);
    //   return;
    // }
    if (END_EFFECT_MAP[type]) {
      // Always play the end sound for lockup ends, regardless of allowedByStyle
      endLockupLoop(type, END_EFFECT_MAP[type], true);
      return;
    }

  // Else, only play sound if it's in the textarea.
  const effectName = EFFECT_SOUND_MAP[type];
  if (effectName) {
  const isAllowed = outerMostBracket || allowedByStyle.has(type);
  playRandomEffect(effectName, isAllowed);
  }
};

var last_detected_blade_effect;

var handled_types = {};
function PushHandledTypes() {
  var ret = [ handled_types, handled_lockups ];
  handled_types = {};
  handled_lockups = {};
  return ret;
}
function PopHandledTypes(old) {
  handled_types = old[0];
  handled_lockups = old[1];
}
function HandleEffectType(t) {
  if (t.getInteger) t = t.getInteger(0);
  handled_types[t] = 1;
}
function IsHandledEffectType(t) {
  return current_style.__handled_types[EFFECT_STAB];
}

class OneshotEffectDetector {
  constructor(type) {
    this.last_detected_ = 0;
    if (type.getInteger) {
      type = type.getInteger(0);
    }
    this.type_ = type;
    HandleEffectType(type);
  }
  Detect(blade) {
    var mask = {};
    mask[this.type_] = 1;
    if (this.type_ ==  EFFECT_CLASH && !(current_style.__handled_types[EFFECT_STAB])) {
      mask[EFFECT_STAB] = 1;
    }

    var effects = blade.GetEffects();
    for (var i = effects.length -1 ; i >=0 ; i--) {
      if (mask[effects[i].type]) {
        if (effects[i].start_micros == this.last_detected_)
          return 0;
        this.last_detected_ = effects[i].start_micros;
        last_detected_blade_effect = effects[i];
        return effects[i];
      }
    }
    return 0;
  }
  getDetected(blade) {
    var mask = {};
    mask[this.type_] = 1;
    var effects = blade.GetEffects();
    for (var i = effects.length -1 ; i >=0 ; i--)
      if (mask[effects[i].type])
        if (effects[i].start_micros == this.last_detected_)
          return effects[i];
    return 0;
  }
};

var focus_catcher;
var focus_trace = [undefined];

function Focus(T) {
//////////// Logging PR ///////////////
//  console.log("FOCUS=" + T);
//  console.log(T);
  focus_catcher = T;
  focus_trace = [T];
  return T;
}

function StylePtr(T) {
  return T;
}

class EasyBladeClass extends MACRO {
  constructor(COLOR, CLASH_COLOR, LOCKUP_FLICKER_COLOR) {
    super("Adds clash/lockup/blast/drag", arguments);
    this.add_arg("COLOR","COLOR","Main color");
    this.add_arg("CLASH_COLOR", "COLOR", "Clash color");
    this.add_arg("LOCKUP_FLICKER_COLOR", "COLOR", "lockup flicker color", WHITE.DOCOPY());

    this.SetExpansion(
      SimpleClash(Lockup(Blast(this.COLOR, WHITE.DOCOPY()), AudioFlicker(this.COLOR.DOCOPY(), this.LOCKUP_FLICKER_COLOR)), this.CLASH_COLOR)
    );
  }
};

function EasyBlade(color, clash_color, lockup_flicker_color) {
  return new EasyBladeClass(color, clash_color, lockup_flicker_color);
}

class StyleNormalPtrClass extends MACRO {
  constructor(base_color, clash_color, out_ms, in_ms, lockup_flicker_color, blast_color) {
    super("Blade to color.", arguments);
    this.add_arg("BASE_COLOR","COLOR","Main color");
    this.add_arg("CLASH_COLOR", "COLOR", "Clash color");
    this.add_arg("OUT_MS", "INT", "extension length in milliseconds");
    this.add_arg("IN_MS", "INT", "retraction length in milliseconds");
    this.add_arg("LOCKUP_FLICKER_COLOR", "COLOR", "lockup flicker color", WHITE.DOCOPY());
    this.add_arg("BLAST_COLOR", "COLOR", "Blast color", WHITE.DOCOPY());

    var tmp = AudioFlicker(this.BASE_COLOR, this.LOCKUP_FLICKER_COLOR);
    var tmp2 = Blast(this.BASE_COLOR.DOCOPY(), this.BLAST_COLOR);
    tmp = Lockup(tmp2, tmp);
    tmp = SimpleClash(tmp, this.CLASH_COLOR);
    this.SetExpansion(InOutHelper(tmp, this.OUT_MS, this.IN_MS));
  }
}

function StyleNormalPtr(base_color, clash_color, out_ms, in_ms, lockup_flicker_color, blast_color) {
  return new StyleNormalPtrClass(base_color, clash_color, out_ms, in_ms, lockup_flicker_color, blast_color);
}

class StyleRainbowPtrClass extends MACRO {
  constructor(OUT_MS, IN_MS, CLASH_COLOR, LOCKUP_FLICKER_COLOR) {
    super("Rainbow style template", arguments);
    this.add_arg("OUT_MS", "INT", "extension length in milliseconds");
    this.add_arg("IN_MS", "INT", "retraction length in milliseconds");
    this.add_arg("CLASH_COLOR", "COLOR", "Clash color", WHITE.DOCOPY());
    this.add_arg("LOCKUP_FLICKER_COLOR", "COLOR", "lockup flicker color", WHITE.DOCOPY());

    var tmp = AudioFlicker(Rainbow(), this.LOCKUP_FLICKER_COLOR);
    tmp = Lockup(Rainbow(), tmp);
    tmp = SimpleClash(tmp, this.CLASH_COLOR);
    this.SetExpansion(InOutHelper(tmp, this.OUT_MS, this.IN_MS));
  }
};

function StyleRainbowPtr(out_ms, in_ms, clash_color, lockup_flicker_color) {
  return new StyleRainbowPtrClass(out_ms, in_ms, clash_color, lockup_flicker_color);
}


class StyleStrobePtrClass extends MACRO {
  constructor(STROBE_COLOR, CLASH_COLOR, FREQUENCY, OUT_MS, IN_MS) {
    super("Rainbow style template", arguments);
    this.add_arg("STROBE_COLOR","COLOR","Strobe color");
    this.add_arg("CLASH_COLOR", "COLOR", "Clash color");
    this.add_arg("FREQUENCY", "INT", "frequency");
    this.add_arg("OUT_MS", "INT", "extension length in milliseconds");
    this.add_arg("IN_MS", "INT", "retraction length in milliseconds");

    var strobe = Strobe(BLACK.DOCOPY(), this.STROBE_COLOR, this.FREQUENCY, 1);
    var fast_strobe = Strobe(BLACK.DOCOPY(), this.STROBE_COLOR.DOCOPY(), this.FREQUENCY * 3, 1);
    var tmp = Lockup(strobe, fast_strobe);
    tmp = SimpleClash(tmp, this.CLASH_COLOR);
    this.SetExpansion(InOutHelper(tmp, this.OUT_MS, this.IN_MS));
  }
};

function StyleStrobePtr(strobe_color, clash_color, frequency, out_ms, in_ms) {
  return new StyleStrobePtrClass(strobe_color, clash_color, frequency, out_ms, in_ms);
}

class StyleFirePtrClass extends MACRO {
  constructor(COLOR1, COLOR2,
                      BLADE_NUM, DELAY, SPEED,
                      NORM_BASE, NORM_RAND, NORM_COOL,
                      CLSH_BASE, CLSH_RAND, CLSH_COOL,
                      LOCK_BASE, LOCK_RAND, LOCK_COOL,
                      OFF_BASE, OFF_RAND, OFF_COOL) {
    super("Fire Blade", arguments);
    this.add_arg("COLOR1", "COLOR", "Warm color.");
    this.add_arg("COLOR2", "COLOR", "Hot color.");
    this.add_arg("BLADE_NUM", "INT", "Ignored", INT(1));
    this.add_arg("DELAY", "INT", "ignition delay", INT(0));
    this.add_arg("SPEED", "INT", "fire speed", INT(2));
    this.add_arg("NORM_BASE", "INT", "constant heat added in normal mode", INT(0));
    this.add_arg("NORM_RAND", "INT", "random heat added in normal mode", INT(2000));
    this.add_arg("NORM_COOL", "INT", "cooling in normal mode", INT(5));

    this.add_arg("CLSH_BASE", "INT", "constant heat added in clash mode", INT(3000));
    this.add_arg("CLSH_RAND", "INT", "random heat added in clash mode", INT(0));
    this.add_arg("CLSH_COOL", "INT", "cooling in clash mode", INT(0));

    this.add_arg("LOCK_BASE", "INT", "constant heat added in lockup mode", INT(0));
    this.add_arg("LOCK_RAND", "INT", "random heat added in lockup mode", INT(5000));
    this.add_arg("LOCK_COOL", "INT", "cooling in lockup mode", INT(10));

    this.add_arg("OFF_BASE", "INT", "constant heat added in off mode", INT(0));
    this.add_arg("OFF_RAND", "INT", "random heat added in off mode", INT(0));
    this.add_arg("OFF_COOL", "INT", "cooling in off mode", INT(10));
    this.SetExpansion(StyleFire(
      this.COLOR1, this.COLOR2,
      this.DELAY, this.SPEED,
      FireConfig(this.NORM_BASE, this.NORM_RAND, this.NORM_COOL),
      FireConfig(this.CLSH_BASE, this.CLSH_RAND, this.CLSH_COOL),
      FireConfig(this.LOCK_BASE, this.LOCK_RAND, this.LOCK_COOL),
      FireConfig(this.OFF_BASE, this.OFF_RAND, this.OFF_COOL)));
  }
};

function StyleFirePtr(COLOR1, COLOR2,
                      BLADE_NUM, DELAY, SPEED,
                      NORM_BASE, NORM_RAND, NORM_COOL,
                      CLSH_BASE, CLSH_RAND, CLSH_COOL,
                      LOCK_BASE, LOCK_RAND, LOCK_COOL,
                      OFF_BASE, OFF_RAND, OFF_COOL) {
  return new StyleFirePtrClass(COLOR1, COLOR2,
      BLADE_NUM, DELAY, SPEED,
      NORM_BASE, NORM_RAND, NORM_COOL,
      CLSH_BASE, CLSH_RAND, CLSH_COOL,
      LOCK_BASE, LOCK_RAND, LOCK_COOL,
      OFF_BASE,  OFF_RAND , OFF_COOL);
}

class InOutHelperFClass extends FUNCTION {
  constructor(T, EXTENSION, OFF_COLOR, ALLOW_DISABLE) {
    super("0=retracted, 32768=extended", arguments);
    this.add_arg("EXTENSION", "FUNCTION", "extension amount");
    this.add_arg("ALLOW_DISABLE", "INT", "allow disable?", 1);
  }
  run(blade) {
    super.run(blade);
    this.thres = (this.EXTENSION.getInteger(0) * blade.num_leds());
  }
  getInteger(led) {
    return 32768 - clamp(this.thres - led * 32768, 0, 32768);
  }
}

function InOutHelperF(EX, AD) {
  return new InOutHelperFClass(EX, AD);
}

class InOutHelperLClass extends MACRO {
  isEffect() { return true; }
  constructor(EXTENSION, OFF_COLOR, ALLOW_DISABLE) {
    super("0=retracted, 32768=extended", arguments);
    this.add_arg("EXTENSION", "FUNCTION", "extension amount");
    this.add_arg("OFF_COLOR", "COLOR", "color when retracted", BLACK.DOCOPY());
    this.add_arg("ALLOW_DISABLE", "INT", "allow disable?", 1);
    this.SetExpansion(AlphaL(this.OFF_COLOR, InOutHelperF(EXTENSION, this.ALLOW_DISABLE)));
  }
}

function InOutHelperL(EX, O, AD) {
  return new InOutHelperLClass(EX, O, AD);
}
//////////// indents and line returns PR ///////////

class InOutHelperXClass extends MACRO {
  constructor(T, EXTENSION, OFF_COLOR, ALLOW_DISABLE) {
    super("0=retracted, 32768=extended", arguments);
    this.add_arg("T", "COLOR", "base color");
    this.add_arg("EXTENSION", "FUNCTION", "extension amount");
    this.add_arg("OFF_COLOR", "COLOR", "color when retracted", BLACK.DOCOPY());
    this.add_arg("ALLOW_DISABLE", "INT", "allow disable?", 1);
    this.SetExpansion(Layers(T, InOutHelperL(EXTENSION, this.OFF_COLOR, this.ALLOW_DISABLE)));
  }
}

function InOutHelperX(T, EX, O, AD) {
  return new InOutHelperXClass(T, EX, O, AD);
}

//--
class InOutHelperClass extends MACRO {
  constructor(T, OUT_MILLIS, IN_MILLIS, OFF_COLOR) {
    super("Extend/extract blade", arguments);
    this.add_arg("T", "COLOR", "Base color");
    this.add_arg("OUT_MILLIS", "INT", "Time to extend.");
    this.add_arg("IN_MILLIS", "INT", "Time to retract.");
    this.add_arg("OFF_COLOR", "COLOR", "color when retracted", BLACK.DOCOPY());
    this.SetExpansion(InOutHelperX(T, InOutFunc(OUT_MILLIS, IN_MILLIS), this.OFF_COLOR));
  }
};

function InOutHelper(T, I, O, OFF) {
  return new InOutHelperClass(T, I, O, OFF);
}

class InOutSparkTipClass extends STYLE {
  constructor(T, OUT_MILLIS, IN_MILLIS, OFF_COLOR) {
    super("Implements extention/retraction", arguments);
    this.add_arg("T", "COLOR", "base color");
    this.add_arg("OUT_MILLIS", "INT", "extentions length in ms");
    this.add_arg("IN_MILLIS", "INT", "retraction length in ms");
    this.add_arg("SPARK_COLOR", "COLOR", "color of spark tip", WHITE.DOCOPY());
    this.last_micros_ = 0;
    this.extension = 0;
  }
  run(blade) {
    this.T.run(blade);
    this.SPARK_COLOR.run(blade);

    var now = micros();
    var delta = now - this.last_micros_;
    this.last_micros_ = now;
    if (blade.is_on()) {
      if (this.extension == 0.0) {
        // We might have been off for a while, so delta might
        // be insanely high.
        this.extension = 0.00001;
      } else {
        this.extension += delta / (this.OUT_MILLIS * 1000.0);
        this.extension = Math.min(this.extension, 1.0);
      }
    } else {
      this.extension -= delta / (this.IN_MILLIS * 1000.0);
      this.extension = Math.max(this.extension, 0.0);
    }
    var thres = this.extension * (blade.num_leds() + 5) * 256;
    this.thres1 = Math.floor(thres);
    if (blade.is_on()) {
      this.thres2 = Math.floor(thres) - 1024;
    } else {
      this.thres2 = Math.floor(thres) + 1024;
    }
  }
  getColor(led) {
    var x1 = led + 1 - this.thres1 / 256.0;
    x1 = min(x1, 1.0);
    x1 = max(x1, 0.0);
    var x2 = led + 1 - this.thres2 / 256.0;
    x2 = min(x2, 1.0);
    x2 = max(x2, 0.0);
    var c = this.T.getColor(led);
    var spark_color = this.SPARK_COLOR.getColor(led);
    var off = Rgb(0,0,0);
    return c.mix(spark_color, x2).mix(off, x1);
  }
};

function InOutSparkTip(T, I, O, S) {
  return new InOutSparkTipClass(T, I, O, S);
}

class ColorChangeClass extends MACRO {
  constructor(ARGS) {
    super("Change color based on variation", ARGS);
    this.COLORS = Array.from(ARGS).slice(1);
    this.add_arg("TRANSITION", "TRANSITION","Transition");
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);
    this.SetExpansion(new ColorSelectClass([Variation(), this.TRANSITION].concat(this.COLORS)));
  }
};

function ColorChange(T, A, B) {
  return new ColorChangeClass(Array.from(arguments));
}

class ColorSelectClass extends STYLE {
  constructor(ARGS) {
    super("Change color based on function", ARGS);
    this.COLORS = Array.from(ARGS).slice(2);
    this.add_arg("F", "FUNCTION","Selector function");
    this.add_arg("TRANSITION", "TRANSITION","Transition");
    for (var i = 1; i < this.COLORS.length + 1; i++)
      this.add_arg("COLOR" + i, "COLOR", "COLOR " + i);
    this.selection = this.F.getInteger(0);
    this.old_selection = this.selection;
    if (this.F.pp() == "Variation") {
      HandleEffectType(EFFECT_CHANGE);
    }
  }
  run(blade) {
    this.F.run(blade);
    for (var i = 0; i < this.COLORS.length; i++)
      this.COLORS[i].run(blade);
    var f = this.F.getInteger(0);
    while (f < 0) f += this.COLORS.length * 256;
    var selection = f % this.COLORS.length;
    if (selection != this.selection) {
      // Start transition
      this.old_selection = this.selection;
      this.selection = selection;
      this.TRANSITION.begin();
    }
    if (this.selection != this.old_selection) {
      this.TRANSITION.run(blade);
      if (this.TRANSITION.done()) {
        this.old_selection = this.selection;
      }
    }
  }
  getColor(led) {
    var ret = this.COLORS[this.selection + 0].getColor(led);
    if (this.selection != this.old_selection) {
      var old = this.COLORS[this.old_selection].getColor(led);
      ret = this.TRANSITION.getColor(old, ret, led);
    }
    return ret;
  }
};

function ColorSelect(F, T, A, B) {
  return new ColorSelectClass(Array.from(arguments));
}

class IntSelectClass extends FUNCTION {
  constructor(ARGS) {
    super("Select number based on function", ARGS);
    this.INTS = Array.from(ARGS).slice(1);
    this.add_arg("F", "FUNCTION","Selector function");
    for (var i = 1; i <= this.INTS.length; i++)
      this.add_arg("INT" + i, "INT", "Integer " + i);
  }
  run(blade) {
    this.F.run(blade);
    var f = this.F.getInteger(0);
    while (f < 0) f += this.COLORS.length * 256;
    f = f % this.INTS.length;
    this.value = this.INTS[f];
  }
  getInteger(led) {
    return this.value;
  }
};

function IntSelect(ARGS) {
  return new IntSelectClass(Array.from(arguments));
}

class TransitionLoopLClass extends STYLE {
  constructor(TRANSITION) {
    super("Continiously loop a transition",arguments);
    this.add_arg("TRANSITION", "TRANSITION", "Transition");
    this.TRANSITION.begin();
  }
  run(blade) {
    if (this.TRANSITION.done()) this.TRANSITION.begin();
    super.run(blade);
  }
  getColor(led) {
    return this.TRANSITION.getColor(Transparent(), Transparent(), led);
  }
};

function TransitionLoopL(T) { return new TransitionLoopLClass(T); }

class TransitionLoopClass extends MACRO {
  constructor(COLOR, TRANSITION) {
    super("Continiously loop a transition",arguments);
    this.add_arg("COLOR", "COLOR", "Color");
    this.add_arg("TRANSITION", "TRANSITION", "Transition");
    this.SetExpansion(Layers(COLOR, TransitionLoopL(TRANSITION)));
  }
};

function TransitionLoop(C, T) { return new TransitionLoopClass(C, T); }

class MultiTransitionEffectLClass extends STYLE {
  constructor(TRANSITION, EFFECT_ARG, N) {
    super("Trigger transitions on an effect.", arguments);
    this.add_arg("TRANSITION", "TRANSITION", "Transition Effects");
    this.add_arg("EFFECT", "EFFECT", "Effect type");
    this.add_arg("N", "INT", "Simultaneous effects.", 3);
    this.effect_ = new OneshotEffectDetector(this.EFFECT);
    this.TRANSITIONS=[];
    this.running=[];
    this.E=[];
    this.pos = 0;
    for (var i = 0; i < this.N; i++) {
      this.TRANSITIONS.push(this.TRANSITION.DOCOPY());
      this.running.push(false);
      this.E.push(null);
    }
    HandleEffectType(EFFECT_ARG);
  }
  run(blade) {
    var TMP = last_detected_blade_effect;
    var e = this.effect_.Detect(blade);
    if (e) {
      this.TRANSITIONS[this.pos].begin();
      this.running[this.pos] = true;
      this.E[this.pos] = last_detected_blade_effect;
      this.pos++;
      if (this.pos >= this.N) this.pos = 0;
    }
    for (var i = 0; i < this.N; i++) {
      if (this.running[i]) {
        last_detected_blade_effect = this.E[i];
        this.TRANSITIONS[i].run(blade);
        if (this.TRANSITIONS[i].done()) {
          this.running[i] = false;
        }
      }
    }
    last_detected_blade_effect = last_detected_blade_effect;
  }
  getColor(led) {
    var ret = Transparent();
    var P = this.pos + 1;
    for (var i = 0; i < this.N; i++) {
      if (P >= this.N) P = 0;
      if (this.running[P]) {
        ret = this.TRANSITIONS[P].getColor(ret, ret, led);
      }
      P++;
    }
    return ret;
  }
  IS_RUNNING() {
    for (var i = 0; i < this.N; i++) {
      if(this.running[i]) return true;
    }
    return false;
  }

  argify(state) {
    state.color_argument = effect_to_argument(this.EFFECT);
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function MultiTransitionEffectL(T, E, N) {
  return new MultiTransitionEffectLClass(T, E, N);
}

class MultiTransitionEffectClass extends MACRO {
  constructor(T, EFFECT_COLOR, TRANSITION1, TRANSITION2, EFFECT, N) {
    super("Trigger transitions on an effect.", arguments);
    this.add_arg("T", "COLOR", "Base color.");
    this.add_arg("EFFECT_COLOR", "COLOR", "Effect color.");
    this.add_arg("TRANSITION1", "TRANSITION", "from Base to Effect Color");
    this.add_arg("TRANSITION2", "TRANSITION", "from Effect Color back to Base");
    this.add_arg("EFFECT", "EFFECT", "Effect type");
    this.add_arg("N", "INT", "Number of simultaneous effects.", 3);
    this.SetExpansion(Layers(this.T, MultiTransitionEffectL(TrConcat(this.TRANSITION1, this.EFFECT_COLOR, this.TRANSITION2), this.EFFECT, this.N)));
  }
};

function MultiTransitionEffect(T, EC, T1, T2, E, N) {
  return new MultiTransitionEffectClass(T, EC, T1, T2, E, N);
}

class TransitionEffectLClass extends STYLE {
  constructor(EFFECT_COLOR, TRANSITION1, TRANSITION2, EFFECT_ARG) {
    super("Trigger transitions on an effect.", arguments);
    this.add_arg("TRANSITION", "TRANSITION", "Transition Effect");
    this.add_arg("EFFECT", "EFFECT", "Effect type");
    this.effect_ = new OneshotEffectDetector(this.EFFECT);
    this.run_ = false;
  }
  run(blade) {
    var e = this.effect_.Detect(blade);
    if (e) {
      this.TRANSITION.begin();
      this.run_ = true;
    }
    this.TRANSITION.run(blade);
    if (this.run_ && this.TRANSITION.done()) {
      this.run_ = false;
    }
  }
  getColor(led) {
    var ret = Transparent();
    if (this.run_) {
      ret = this.TRANSITION.getColor(ret, ret, led);
    }
    return ret;
  }
  IS_RUNNING() { return this.run_; }

  argify(state) {
    state.color_argument = effect_to_argument(this.EFFECT);
    var ret = super.argify(state);
    state.color_argument = null;
    return ret;
  }
};

function TransitionEffectL(T, E) {
  return new TransitionEffectLClass(T, E);
}

class TransitionEffectClass extends MACRO {
  constructor(T, EFFECT_COLOR, TRANSITION1, TRANSITION2, EFFECT_ARG) {
    super("Trigger transitions on an effect.", arguments);
    this.add_arg("T", "COLOR", "Base color.");
    this.add_arg("EFFECT_COLOR", "COLOR", "Effect color.");
    this.add_arg("TRANSITION1", "TRANSITION", "from Base to Effect Color");
    this.add_arg("TRANSITION2", "TRANSITION", "from Effect Color back to Base");
    this.add_arg("EFFECT", "EFFECT", "Effect type");
    this.SetExpansion(Layers(this.T, TransitionEffectL(TrConcat(this.TRANSITION1, this.EFFECT_COLOR, this.TRANSITION2), this.EFFECT)));
  }
};

function TransitionEffect(T, EC, T1, T2, E) {
  return new TransitionEffectClass(T, EC, T1, T2, E);
}

class TransitionPulseLClass extends STYLE {
  constructor(TRANSITION, PULSE) {
    super("Triggers transition when pulse occurs.", arguments);
    this.add_arg("TRANSITION", "TRANSITION", "Transition.");
    this.add_arg("PULSE", "FUNCTION", "Pulse.");
    this.run_ = false;
  }

  run(blade) {
    this.PULSE.run(blade);
    if (this.PULSE.getInteger(0) != 0) {
      this.TRANSITION.begin();
      this.run_ = true;
    }
    if (this.run_) {
      this.TRANSITION.run(blade);
      if (this.TRANSITION.done()) this.run_ = false;
    }
  }

  getColor(led) {
    if (this.run_) {
      return this.TRANSITION.getColor(Transparent(), Transparent(), led);
    } else {
      return Transparent();
    }
  }
}

function TransitionPulseL(TRANSITION, PULSE) {
  return new TransitionPulseLClass(TRANSITION, PULSE);
}

class InOutTrLClass extends STYLE {
  isEffect() { return true; }
  constructor(OUT_TR, IN_TR, OFF, AD) {
    super("In-out based on transitions", arguments);
    this.add_arg("OUT_TR", "TRANSITION", "IN-OUT transition");
    this.add_arg("IN_TR", "TRANSITION", "OUT-IN transition");
    this.add_arg("OFF", "COLOR", "Color when off", BLACK.DOCOPY());
    this.add_arg("ALLOW_DISABLE", "INT", "allow disable?", 1);
//////////// No re-ignition on focusout PR ///////////////
    // Only triggers ignition on a real on/off change (not just a focus event).
    this.on_ = STATE_ON;
    this._last_state = STATE_ON;
    this.out_active_ = false;
    this.in_active_ = false;
  }
  run(blade) {
    this.OFF.run(blade);

    // If blade power state just changed:
    const nowOn = blade.is_on();
    if (nowOn !== this._last_state) {
      this._last_state = nowOn;
      this.on_         = nowOn;

      if (nowOn) {
        this.OUT_TR.begin();
        this.out_active_ = true;
      } else {
        this.IN_TR.begin();
        this.in_active_ = true;
      }
    }

    if (this.out_active_) {
      this.OUT_TR.run(blade);
      if (this.OUT_TR.done()) {
        this.out_active_ = false;
      }
    }

    if (this.in_active_) {
      this.IN_TR.run(blade);
      if (this.IN_TR.done()) {
        this.in_active_ = false;
      }
    }
  }

  runIn(A, B, led) {
    if (this.in_active_) {
      return this.IN_TR.getColor(A, B, led);
    } else {
      return B;
    }
  }

  runOut(A, B, led) {
    if (this.out_active_) {
      return this.OUT_TR.getColor(A, B, led);
    } else {
      return B;
    }
  }

  getColor(led) {
    if (!this.out_active_ && !this.in_active_) {
      if (this.on_) {
        return Transparent();
      } else {
        return this.OFF.getColor(led);
      }
    } else {
      var on = Transparent();
      var off = this.OFF.getColor(led);
      if (this.on_) {
        return this.runOut(this.runIn(on, off, led), on, led);
      } else {
        return this.runIn(this.runOut(off, on, led), off, led);
      }
    }
  }
};

function InOutTrL(OUT_TR, IN_TR, OFF, AD) {
  return new InOutTrLClass(OUT_TR, IN_TR, OFF, AD);
}

class InOutTrClass extends MACRO {
  constructor(ON, OUT_TR, IN_TR, OFF, AD) {
    super("In-out based on transitions", arguments);
    this.add_arg("ON", "COLOR", "Color when on.");
    this.add_arg("OUT_TR", "TRANSITION", "IN-OUT transition");
    this.add_arg("IN_TR", "TRANSITION", "OUT-IN transition");
    this.add_arg("OFF", "COLOR", "Color when off", BLACK.DOCOPY());
    this.add_arg("ALLOW_DISABLE", "INT", "allow disable?", 1);
    this.SetExpansion(Layers(ON, InOutTrL(OUT_TR, IN_TR, this.OFF, this.ALLOW_DISABLE)));
  }
};

function InOutTr(ON, OUT_TR, IN_TR, OFF, AD) {
  return new InOutTrClass(ON, OUT_TR, IN_TR, OFF, AD);
}

class RotateColorsXClass extends STYLE {
  constructor(ROTATION, COLOR) {
    super("Rotate colors", arguments);
    this.add_arg("ROTATION", "FUNCTION", "Rotation");
    this.add_arg("COLOR", "COLOR", "Color");
  }
  getColor(led) {
    var ret = this.COLOR.getColor(led);
    return ret.rotate((this.ROTATION.getInteger(led) & 0x7fff) * 3);
  }
  argify(state) {
    if (this.ROTATION.constructor == VariationClass) {
      return this.COLOR.argify(state);
    }
    return super.argify(state);
  }
};

function RotateColorsX(R, C) { return new RotateColorsXClass(R, C); }

class RotateColorsClass extends MACRO {
  constructor(ROTATION, COLOR) {
    super("Rotate colors", arguments);
    this.add_arg("ROTATION", "INT", "Rotation");
    this.add_arg("COLOR", "COLOR", "Color");
    this.SetExpansion(RotateColorsX(Int(this.ROTATION), this.COLOR));
  }
};

function RotateColors(R, C) { return new RotateColorsClass(R, C); }

class HueXClass extends MACRO {
  constructor(ROTATION, COLOR) {
    super("Rotate colors", arguments);
    this.add_arg("HUE", "FUNCTION", "Hue");
    this.SetExpansion(RotateColorsX(this.HUE, RED.DOCOPY()));
  }
};

function HueX(H) { return new HueXClass(H); }

class HueClass extends MACRO {
  constructor(ROTATION, COLOR) {
    super("Rotate colors", arguments);
    this.add_arg("HUE", "INT", "Hue");
    this.SetExpansion(HueX(Int(this.HUE)));
  }
};

function Hue(H) { return new HueClass(H); }

