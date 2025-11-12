var t = 0.0;
var width;
var height;
//////////// Fullscreen PR ///////////
// Fullscreen things
const canvas        = FIND("canvas_id");
const pcbCanvas     = FIND('pcb_canvas');
const previewType   = FIND("previewType");
const enlargeBtn    = FIND('ENLARGE_BUTTON');
const fullscreenBtn = FIND("FULLSCREEN_BUTTON");

const pageLeftTop = FIND("page_left_top");

function FIND(id) {
  var ret = document.getElementById(id);
  if (!ret) {
//    console.log("Failed to find " + id);
  }
  return ret;
}

const start_millis = new Date().getTime();
function actual_millis() {
  return new Date().getTime() - start_millis;
}
var current_micros = 0;
var current_micros_internal = 0;
function micros() {
  return current_micros;
}

function millis() {
  return current_micros / 1000;
}

function fract(v) {
  return v - Math.floor(v);
}

var max = Math.max;
var min = Math.min;
var sin = Math.sin;
function random(i) {
  return Math.floor(Math.random() * i);
}
function clamp(a, b, c) {
  if (a < b) return b;
  if (a > c) return c;
  return a;
}

class Matrix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.values = new Float32Array(w * h);
    if (w == h) {
      for (var z = 0; z < w; z++) {
        this.set(z, z, 1.0);
      }
    }
  }
  get(x, y) { return this.values[y * this.w + x]; }
  set(x, y, v) { this.values[y * this.w + x] = v; }
  mult(o) {
    var ret = new Matrix(o.w, this.h);
    for (var x = 0; x < o.w; x++) {
      for (var y = 0; y < this.h; y++) {
        var sum = 0.0;
        for (var z = 0; z < this.w; z++) {
          sum += this.get(z, y) * o.get(x, z);
        }
        ret.set(x, y, sum);
      }
    }
    return ret;
  }
  static mkzrot(a) {
    var ret = new Matrix(4, 4);
    var s = Math.sin(a);
    var c = Math.cos(a);
    ret.set(0, 0, c);
    ret.set(1, 1, c);
    ret.set(0, 1, s);
    ret.set(1, 0, -s);
    return ret;
  }
  static mkxrot(a) {
    var ret = new Matrix(4, 4);
    var s = Math.sin(a);
    var c = Math.cos(a);
    ret.set(1, 1, c);
    ret.set(2, 2, c);
    ret.set(1, 2, s);
    ret.set(2, 1, -s);
    return ret;
  }
  static mkyrot(a) {
    var ret = new Matrix(4, 4);
    var s = Math.sin(a);
    var c = Math.cos(a);
    ret.set(0, 0, c);
    ret.set(2, 2, c);
    ret.set(0, 2, s);
    ret.set(2, 0, -s);
    return ret;
  }
  static mktranslate(x, y, z) {
    var ret = new Matrix(4, 4);
    ret.set(0,3,x);
    ret.set(1,3,y);
    ret.set(2,3,z);
    return ret;
  }
//////////// indents and line returns PR ///////////

  static fromValues(a, b, c, d,
                  e, f, g, h,
                  i, j, k, l,
                  m, n, o, p) {
      var ret = new Matrix(4, 4);
      ret.values[0] = a;
      ret.values[1] = b;
      ret.values[2] = c;
      ret.values[3] = d;
      ret.values[4] = e;
      ret.values[5] = f;
      ret.values[6] = g;
      ret.values[7] = h;
      ret.values[8] = i;
      ret.values[9] = j;
      ret.values[10] = k;
      ret.values[11] = l;
      ret.values[12] = m;
      ret.values[13] = n;
      ret.values[14] = o;
      ret.values[15] = p;
      return ret;
  }

  tostr() {
    var ret = "{";
    for (var x = 0; x < this.w; x++) {
      for (var y = 0; y < this.h; y++) {
        ret += this.get(x, y);
        ret += ", ";
      }
      ret += ";";
    }
    ret += "}";
    return ret;
  }
};

function default_rotation_matrix() {
    var ret = Matrix.mktranslate(0.0, 0.0, 0.0);
//    ret  = ret.mult(Matrix.mkzrot(Math.PI/2.0));
//    ret  = ret.mult(Matrix.mkxrot(Math.PI/2.0));
    return ret;
}

function default_move_matrix() {
//    var ret = Matrix.mktranslate(0.0, 0.0, 0.0);
//  return Matrix.mktranslate(0.0, 1.6, -200.0);
//    var ret = Matrix.mktranslate(-0.023, 0.0, -0.12);

    //    ret  = ret.mult(Matrix.mkxrot(Math.PI/2.0));
    var ret = default_rotation_matrix();
   ret = ret.mult(Matrix.mktranslate(0.0, 0.0, -8.0));
    return ret;
    
}

var MOVE_MATRIX = default_move_matrix();
var OLD_MOVE_MATRIX = default_move_matrix();
var MOUSE_POSITIONS = [];
var IN_FRAME = false;
var BLADE_ANGLE = 0.0;
let HOME_POS = false;

function mouse_speed(t1, t2) {
  var dx = MOUSE_POSITIONS[t1+0]-MOUSE_POSITIONS[t2+0];
  var dy = MOUSE_POSITIONS[t1+1]-MOUSE_POSITIONS[t2+1];
  var dt = MOUSE_POSITIONS[t1+2]-MOUSE_POSITIONS[t2+2];
  if (dt == 0) return 0.0;
  return Math.sqrt(dx * dx + dy * dy) / Math.abs(dt);
}

// Helper: are we being driven by the board?
function usingRemoteControl() {
  try {
    return !!(window.ProffieLink && window.ProffieLink.isConnected && window.ProffieLink.isConnected());
  } catch (_) { return false; }
}

function mouse_move(e) {
  if (usingRemoteControl()) return;

  if (mouseSwingsState.get()) return;
  HOME_POS = false;
  IN_FRAME = true;
  // resizeCanvasAndCamera();

  const rect = canvas.getBoundingClientRect();
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  const d = Math.min(h, w);

  let x = (e.clientX - (rect.left + rect.right) / 2) / d * 2.5;
  let y = (e.clientY - (rect.top + rect.bottom) / 2) / d *
          ((document.fullscreenElement === pageLeftTop || window.enlargeCanvas) ? 1.5 : 1.0);

  window.drive_saber_from_xy(x, y);
}

function get_swing_speed() {
  var now = actual_millis();
  while (MOUSE_POSITIONS.length > 0 && now - MOUSE_POSITIONS[2] > 100) {
    MOUSE_POSITIONS = MOUSE_POSITIONS.slice(3);
  }
  var len = MOUSE_POSITIONS.length;
  if (len >= 6) {
    return mouse_speed(0, len - 6);
  }
  if (IN_FRAME || !autoswingState.get()) return 0.0;
  return Math.sin(millis() * Math.PI / 1000.0) * 250 + 250
}

function get_swing_accel() {
  var now = actual_millis();
  while (MOUSE_POSITIONS.length > 0 && now - MOUSE_POSITIONS[2] > 100) {
    MOUSE_POSITIONS = MOUSE_POSITIONS.slice(3);
  }
  var len = MOUSE_POSITIONS.length;
  if (len >= 6) {
    var speed = mouse_speed(0, len - 6);
    if (MOUSE_POSITIONS.length >= 9) {
      return (speed - mouse_speed(0, Math.floor(len/6)*3)) * 2.0;
    }
  }
  if (IN_FRAME) return 0.0;
  return Math.cos(millis() * Math.PI / 500.0) * 100 + 100
}

function mouse_leave(e) {
  if (usingRemoteControl()) return;
  HOME_POS = true;
  MOUSE_POSITIONS = [];
  IN_FRAME = false;
  window.bladeTrailTransforms = [];
  wasOverTrailThreshold = false;
  // resizeCanvasAndCamera();
}

// x ~ [-2.5..2.5] left/right, y ~ [-1.5..1.5] up/down (same ranges mouse_move uses)
let _lastCanvasW = -1, _lastCanvasH = -1;

window.drive_saber_from_xy = function(x, y) {
  HOME_POS = false;
  IN_FRAME = true;

  // // Only resize if dimensions changed (much cheaper)
  // const rect = canvas.getBoundingClientRect();
  // const w = rect.right - rect.left;
  // const h = rect.bottom - rect.top;
  // if (w !== _lastCanvasW || h !== _lastCanvasH) {
  //   _lastCanvasW = w; _lastCanvasH = h;
  //   resizeCanvasAndCamera();
  // }

  var SCALE = 100.0;
  BLADE_ANGLE = -y;

  const PIVOT_OFFSET_X = 0.5;
  const swing = x * 20;

  MOVE_MATRIX = default_rotation_matrix();
  MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mkyrot(Math.PI / 2.0));

  let yOffset = -0.04;
  if (window.enlargeCanvas && !window.fullscreenActive) yOffset = -0.10;

  MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mktranslate(PIVOT_OFFSET_X * SCALE, yOffset * SCALE, 0.0));
  MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mkyrot(-x / 3));
  MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mkzrot(y));
  MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mktranslate(-PIVOT_OFFSET_X * SCALE, 0.0, 0.0));
  MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mktranslate(-0.17 * SCALE, 0.0, 0.0));
  MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mktranslate(0, 0, swing));

  // Update swing data just like mouse_move so trails/sound stay in sync
  const now = actual_millis();
  MOUSE_POSITIONS = MOUSE_POSITIONS.concat([x * 10000, y * 10000, now]);
  while (MOUSE_POSITIONS.length > 0 && now - MOUSE_POSITIONS[2] > 100) {
    MOUSE_POSITIONS = MOUSE_POSITIONS.slice(3);
  }
  lastSwingSpeed = get_swing_speed();
  lastSwingUpdate = performance.now();
  triggerAccentEvent(lastSwingSpeed);
};

function compile() {
  // reinitialize render if required
}

var varnum = 0;
var variables = [];
var vartypes = {};

class MyError {
  constructor(desc) {
    this.desc = desc;
    this.begin_pos = -1;
    this.end_pos = -1;
  }
  setBegin(pos) { this.begin_pos = pos; return this; }
  setEnd(pos) { this.end_pos = pos; return this; }
  setArg(arg) {
    if (arg && arg.__end_pos) {
      this.begin_pos = arg.__begin_pos;
      this.end_pos = arg.__end_pos;
    }
    return this;
  }
  setThis(arg) {
    if (arg && arg.__end_pos && this.begin_pos == -1) {
      this.begin_pos = arg.__begin_pos;
      this.end_pos = arg.__end_pos;
    }
    return this;
  }
  valueOf() { return this.desc; }
};

var outerMostBracket = true;
var current_focus_pp = "$";

function style_base_check_detail(style, forceTopLevel = false) {
  // Only enforce at top-level unless explicitly forced (e.g., Copy()).
  if (!forceTopLevel && !outerMostBracket) return { ok: true };

  function isOverlayNode(node) {
    return !!(node && node.constructor && /LClass$/.test(node.constructor.name));
  }
  function isOpaque(c) { return c && c.a === 1.0; }
  function isBlack(c)  { return isOpaque(c) && c.r === 0 && c.g === 0 && c.b === 0; }

  // Non-Layers - forceTopLevel during Copy() to reject transparent only
  if (!(style instanceof LayersClass)) {
    if (!forceTopLevel) return { ok: true };
    if (isOverlayNode(style)) return { ok:false, msg:"Style is transparent." };
    const c = style.getColor(0);
    if (!isOpaque(c))        return { ok:false, msg:"Style is transparent." };
    return { ok:true };
  }

  // Flatten top-level sequence: [BASE, ...LAYERS]
  const seq = [style.BASE].concat(style.LAYERS || []);

  let baseIndex = -1;
  let baseColor = null;

  // Track the last opaque black in case we don't find a colored opaque
  let lastBlackIndex = -1;
  let lastBlackColor = null;

  // 1) Find effective base: first opaque non-black that isn't an overlay,
  //    skipping overlays, transparent, and black (we "keep going").
  for (let i = 0; i < seq.length; i++) {
    const node = seq[i];
    if (isOverlayNode(node)) continue;

    const c = node.getColor(0);
    if (!c || c.a === 0) continue;         // transparent → keep going

    if (isBlack(c)) {                       // black → “counts as nothing”, keep going
      lastBlackIndex = i;
      lastBlackColor = c;
      continue;
    }

    // first opaque non-black: this is our base
    baseIndex = i;
    baseColor = c;
    break;
  }

  // 2) If no colored opaque found, but we saw a black, treat black as base.
  if (baseIndex < 0 && lastBlackIndex >= 0) {
    baseIndex = lastBlackIndex;
    baseColor = lastBlackColor; // opaque black
  }

  // 3) If still no base, allow while composing (everything is overlay/transparent so far)
  if (baseIndex < 0) return { ok: true };

  // 4) Count opaque non-black solids above the base (ignore overlays, transparent, and black)
  let solidsAbove = 0;
  for (let j = baseIndex + 1; j < seq.length; j++) {
    const node = seq[j];
    if (isOverlayNode(node)) continue;
    const c = node.getColor(0);
    if (!isOpaque(c)) continue;
    solidsAbove++;
    if (solidsAbove > 0) {
      return { ok: false, msg: "Layers<> error: Only the base color may be solid." };
    }
  }

  return { ok: true };
}

function style_base_check(style, errorElemId, forceTopLevel = false) {
  const r = style_base_check_detail(style, forceTopLevel);
  if (!r.ok && errorElemId) {
    FIND(errorElemId).innerHTML = r.msg;
    return false;
  }
  if (errorElemId) FIND(errorElemId).innerHTML = "";
  return r.ok;
}

//////////// SafeguardInputs PR ///////////////
function ValidateInput(e) {
  e.target.classList.remove('invalid');

  if (e.target.value === "" || isNaN(Number(e.target.value))) {
    e.target.classList.add('invalid');
    // Force focus to keep user in the field
    setTimeout(() => {
      e.target.focus();
      e.target.select();
    }, 0);
    return false;
  }
}
//////////// SafeguardInputs PR ///////////////

function Arg(expected_type, arg, default_arg) {
  //console.log("ARGUMENT: " + expected_type);
  //console.log(arg);
  //if (typeof(arg) == "object") console.log(arg.ID);
  //console.log(default_arg);
  if (arg == undefined) {
    if (typeof(default_arg) == "number") {
      // console.log("DEFAULT ARG" + default_arg);
      return new INTEGER(default_arg);
    }
    if (default_arg != undefined) {
      // This must copy the argument!
      return default_arg;
    }
    throw "Too few arguments";
  }
  if (typeof(arg) != "number" && !arg.getType) {
     throw "What is this?? " + arg;
  }
  if (expected_type == "TIME_FUNCTION" && arg.getType() == "FUNCTION") {
    return arg;
  }
  if (typeof(arg) != "number" && arg.getType() != expected_type) {
    throw "Expected " + expected_type + " but got " + arg;
  }
  if (expected_type == "INT" && typeof(arg) == "number") {
    return new INTEGER(arg);
  }
  if (expected_type == "INT" || expected_type == "EFFECT" || expected_type == "LOCKUP_TYPE" || expected_type == "ArgumentName") {
    return arg;
  }
  if (expected_type == "COLOR" ||
     expected_type == "FireConfig" ||
     expected_type == "TRANSITION" ||
     expected_type == "FUNCTION" ||
     expected_type == "TIME_FUNCTION") {
    if (typeof(arg) != "object") {
      throw "Expected a " + expected_type;
    }
    return arg;
  }

  throw "Not INT, COLOR, EFFECT, LOCKUP_TYPE, FUNCTION or TRANSITION";
}

function IntArg(arg, def_arg) { return Arg("INT", arg, def_arg); }
function ColorArg(arg, def_arg) { return Arg("COLOR", arg, def_arg); }

var pp_is_url = 0;
var pp_is_verbose = 0;

var next_id = 1000;
var style_ids = {};

var identifiers = {};

function AddIdentifier(name, value) {
  identifiers[name] = value;
}

class ARG {
  constructor(name, type, comment, default_value) {
    this.name = name;
    this.type = type;
    this.comment = comment;
    this.default_value = default_value;
  }
};

class STYLE {
  constructor(comment, args) {
    this.comment = comment;
    // if (args) console.log(args);
    this.args = args;
    this.argnum = 0;
    this.argdefs = [];
    this.super_short_desc = false;
    this.ID = next_id;
    next_id ++;
  }

  add_arg(name, expected_type, comment, default_value) {
    if (focus_trace[0] == this.args[this.argnum]) {
      focus_trace = [this, name, expected_type, focus_trace];
    }
//     console.log("add_arg");
//     console.log(name);
//     console.log(this.args);
//     console.log(default_value);
    try {
      this[name] = Arg(expected_type, this.args[this.argnum], default_value);
//       console.log(this[name]);
    } catch(e) {
      if (typeof(e) == "string") {
        e = new MyError(e + " for argument " + (this.argnum + 1) + " (" + name + ")");
        e.setArg(this.args[this.argnum]);
      }
      throw e;
    }
    this.argnum++;
    this.argdefs.push(new ARG(name, expected_type, comment, default_value));
  }

  get_id() {
    style_ids[this.ID] = this;
    return this.ID;
  }

  DOCOPY() {
    pp_is_url++;
    var url = this.pp();
    pp_is_url--;
    var parser = new Parser(url, classes, identifiers);
    var ret = parser.parse();
    ret.COMMENT = this.COMMENT;
    return ret;
  }

  call_pp_no_comment(arg) {
     var C = arg.COMMENT;
     arg.COMMENT = null;
     var ret;
     try {
       ret = arg.pp();
     }
     finally {
       arg.COMMENT = C;
     }
     return ret;
  }

  DescribeValue(arg) {
    if (typeof(arg) == "undefined") return "undefined";
    if (typeof(arg) == "number") {
      return "" + arg;
    } else {
      return arg.pp();
//      return this.call_pp_no_comment(arg);
    }
  }

  Indent(text) {
    return text;
  }

  gencomment() {
    if (!this.COMMENT) return "";
    var ret = this.COMMENT;
    if (ret[ret.length-1] != " ") ret += " ";
    ret = "/*"+ret+"*/";
    if (this.COMMENT.split("\n").length > 1) {
      ret += "\n";
    } else {
      ret += " ";
    }
    return ret;
  }

  addcomment(COMMENT) {
    if (!COMMENT) return;
    if (!this.COMMENT) {
      this.COMMENT = COMMENT;
    } else {
      this.COMMENT += "\n" + COMMENT;
    }
  }

  prependcomment(COMMENT) {
    if (!COMMENT) return;
    if (!this.COMMENT) {
      this.COMMENT = COMMENT;
    } else {
      this.COMMENT = COMMENT + "\n" + this.COMMENT;
    }
  }

  PPURL(name, note) {
    if (this.super_short_desc) return "$";
    pp_is_url++;
    var ret = name;
    ret = this.gencomment() + ret;
    var comma = false;
    if (arguments.length > 2 || this.argdefs.length > 0) {
      ret += "<";
      for (var i = 2; i < arguments.length; i += 2) {
        if (comma) ret += ",";
        comma = true;
        var V = this.DescribeValue(arguments[i]);
        var arg = this.Indent(V);
        ret += arg;
      }
      ret += ">";
    }
    pp_is_url--;

    return ret;
  }

  extraButtons(arg) {
    return "";
  }

  valueBox() {
    return "";
  }

  PP(name, note) {
    if (pp_is_url) {
      return this.PPURL.apply(this, arguments);
    }
    var id = this.get_id();
    var ret = "";
    if (this.COMMENT) {
      ret += "/* "+this.COMMENT.split("\n").join("<br>")+" */<br>";
      console.log("RET = " + ret);
    }
    ret += "<div id=X" + id + " class='pp-container' onclick='FocusOn(" + id + ",event)'>\n";
    ret += "<span title='" + note + "'>" + name + "</span>&lt;\n";
    ret += this.valueBox();
    ret += "<div class='pp-content'>\n";
    var comma = false;
    for (var i = 2; i < arguments.length; i += 2) {
      if (comma) ret += ",<br>";
      comma = true;
      var arg = arguments[i];
      var note = arguments[i+1];
      var comment = null;
      if (typeof(arg) == "number") {
        arg = "" + arg;
      } else {
        comment = arg.COMMENT;
        arg = this.call_pp_no_comment(arg);
      }
      if (arg.indexOf("<br>") == -1 && arg.indexOf("<div") == -1 && !comment) {
        ret += arg+" /* "+note+" */\n";
      } else {
        ret += "/* "+note+" */"+ this.extraButtons(i/2) +"<br>\n";
        if (comment) {
          ret += "/* "+comment+" */<br>\n";
        }
        ret += arg;
      }
    }
    ret += "</div>&gt;</div>\n";

    return ret;
  }

  PPshort(name, note) {
    if (pp_is_url) {
      return this.PPURL.apply(this, arguments);
    }
    var id = this.get_id();
    var ret = this.gencomment();
    ret += "<div id=X" + id + " class='pp-container' onclick='FocusOn(" + id + ",event)'>\n";
    ret += "<span title='" + note + "'>" + name + "</span>\n";

    if (arguments.length > 2) {
      ret += "&lt;";
      var comma = false;
      for (var i = 2; i < arguments.length; i += 2) {
        if (comma) ret += ",";
        comma = true;
        var arg = arguments[i];
        var note = arguments[i+1];
        if (typeof(arg) == "number") {
          ret += "<span title='"+note+"'>"+arg+"</span>";
        } else {
          ret += "<span>/* "+note+" */</span><br>\n";
          ret += arg.pp();
        }
      }
      ret += "&gt;";
    }
    ret += "</div>\n";

    return ret;
  }

  SameValue(a, b) {
    // console.log("SAMEVALUE");
    // console.log(a);
    // console.log(b);
    // console.log(this.DescribeValue(a));
    // console.log(this.DescribeValue(b));
    return a == b || this.DescribeValue(a) == this.DescribeValue(b);
  }

  pp() {
    var tmp = [this.constructor.name.replace("Class", ""), this.comment];
    var l = this.argdefs.length;
    if (pp_is_url && !pp_is_verbose) {
      // Drop default arguments
      while (l > 0 && this.argdefs[l-1].default_value != undefined &&
             this.SameValue(this[this.argdefs[l-1].name], this.argdefs[l-1].default_value)) l--;
    }
    for (var i = 0; i < l; i++) {
      tmp.push(this[this.argdefs[i].name]);
      tmp.push(this.argdefs[i].comment);
    }
    return this.PP.apply(this, tmp);
  }
  getType() { return "COLOR"; }

  run(blade) {
    for (var i = 0; i < this.argdefs.length; i++) {
      var arg = this[this.argdefs[i].name];
      if (typeof(arg) == "object") arg.run(blade);
    }
  }

  isEffect() {
    for (var i = 0; i < this.argdefs.length; i++) {
      if (this.argdefs[i].type == "EFFECT") return true;
      if (this.argdefs[i].type == "LOCKUP_TYPE") return true;
    }
    return false;
  }

  // Doesn't work??
  toString() { return this.constructor.name + "[id = " + this.ID + "]"; }

  set_right_side(right) {
    if (this.argdefs.length != right.argdefs.length) {
      console.log("SET RIGHT SIDE NON-MATCH");
      return;
    }
    this.right_side = right;
    for (var i = 0; i < this.argdefs.length; i++) {
      if (this.argdefs[i].name != right.argdefs[i].name) {
        console.log("SET RIGHT SIDE NON-MATCH");
        return;
      }

      var l_arg = this[this.argdefs[i].name];
      var r_arg = right[this.argdefs[i].name];
      if (typeof(l_arg) == "object" && typeof(r_arg) == "object") {
        l_arg.set_right_side(r_arg);
      }
    }
  }

  get_container_id() {
    var id = this.ID;
    if (this.right_side) id = this.right_side.ID;
    return id;
  }

  get_container() {
    return FIND("X" + this.get_container_id());
  }

  update_displays() {
    for (var i = 0; i < this.argdefs.length; i++) {
      var arg = this[this.argdefs[i].name];
      if (typeof(arg) == "object") arg.update_displays();
    }

    if (this.IS_RUNNING) {
      var container = this.get_container();
      if (container) {
        if (this.IS_RUNNING()) {
          container.classList.add('running');
        } else {
          container.classList.remove('running');
        }
      }
    }
  }

  argify(state) {
    for (var i = 0; i < this.argdefs.length; i++) {
      var arg = this[this.argdefs[i].name];
      if (typeof(arg) == "object") {
        this[this.argdefs[i].name] = arg.argify(state);
      }
    }
    return this;
  }
}


class MACRO extends STYLE {
  SetExpansion(expansion) {
    this.expansion = expansion;
  }
  run(blade) { this.expansion.run(blade); }
  getInteger(led) { return this.expansion.getInteger(led); }
  getColor(A,B,C) { return this.expansion.getColor(A,B,C); }
  getType() { return this.expansion.getType(); }
  isMacro() { return true; }
  isEffect() { return this.expansion.isEffect(); }
  begin() { this.expansion.begin(); }
  done() { return this.expansion.done(); }
  IS_RUNNING() {
    if (this.expansion.IS_RUNNING)
      return this.expansion.IS_RUNNING();
    return false;
  }
  bend(t, len, scale) {
    if (this.expansion.bend)
      return this.expansion.bend(t, len, scale);
    return scale * t / len;
  }
};

class INTEGER  extends STYLE {
  constructor(v) {
    super();
    this.value = v;
  }
  run(blade) {}
  getInteger(led) { return this.value; }
  valueOf() { return this.value; }
  pp() {
    if (pp_is_url) {
      if (this.super_short_desc) return "$";
      return this.gencomment() + this.value;
    }
    return this.PPshort(this.value, "VALUE");
  }
  getType() { return "INT"; }
};

function INT(x) {
  return new INTEGER(x);
}

class BINARY extends STYLE {
  constructor(v) {
    super();
    this.value = v;
  }
  run(blade) {}
  getInteger(led) { return this.value; }
  valueOf() { return this.value; }
  pp() {
    if (pp_is_url) {
      if (this.super_short_desc) return "$";
      return this.gencomment() + "0b" +this.value.toString(2);
    }
    return this.PPshort("0b" +this.value.toString(2), "VALUE");
  }
  getType() { return "INT"; }
};


function AddEnum(enum_type, name, value) {
  if (value == undefined) {
    value = enum_type.last_value + 1;
  }
  enum_type.last_value = value;
  enum_type.value_to_name[value] = name;
  window[name] = value;
  AddIdentifier(name, function() { return new enum_type(value); });
//////////// Logging PR ///////////////
  // console.log(" ENUM " + name + " = " + value);
}

class EnumBuilder {
  constructor(name, prefix) {
    this.name = name;
    this.prefix = prefix ? prefix : "";
    this.last_value = -1
    this.value_to_name = {};
  }
  addValue(name, value) {
    if (value == undefined) {
      value = this.last_value + 1;
    }
    this.last_value = value;
    this.value_to_name[value] = name;
    window[name] = value;
//////////// Logging PR ///////////////
    // console.log(" ENUM " + name + " = " + value);
  }
  addToTab(tab, common_prefix) {
    if (!common_prefix) {
      common_prefix = "florb";
    }
    var v = Object.keys(this.value_to_name);
    for (var i = 0; i < v.length; i++) {
      var V = parseInt(v[i]);
      var N = this.value_to_name[V];
      var label = N.replace(common_prefix, "");
      AddTabContent(tab, mkbutton2(label, this.prefix+N));
    }
  }
  build() {
    class ENUMClass extends INTEGER {
      pp() {
        if (pp_is_url) {
          if (this.super_short_desc) return "$";
        } else if (0) {
          var ret = "<select>";
          var v = Object.keys(this.constructor.value_to_name);
          for (var i = 0; i < v.length; i++) {
            var V = parseInt(v[i]);
            var N = this.constructor.value_to_name[V];
            ret += "<option value="+V;
            if (this.value == V) ret+=" selected";
            ret += ">"+N+"</option>";
          }
          ret += "</select>";
          return ret;
        }

        var ret = this.gencomment() + this.value;
        if (this.constructor.value_to_name[this.value]) {
          ret = this.constructor.prefix + this.constructor.value_to_name[this.value];
        }
        return this.PPshort(ret, this.getType());
      }
      getType() { return this.constructor.NAME; }
    };
    ENUMClass.value_to_name = this.value_to_name;
    ENUMClass.NAME = this.name;
    ENUMClass.prefix = this.prefix

    function ENUM(value) { return new ENUMClass(value); }
    window[this.name] = ENUM;

    var v = Object.keys(this.value_to_name);
    for (var i = 0; i < v.length; i++) {
      var V = parseInt(v[i]);
      var N = this.value_to_name[V];
      AddIdentifier(this.prefix + N, ENUM.bind(null, V));
    }
  }
}
//////////// Add Accent Swing and Slash to EFFECT ENUM, categorize list.PR ///////////////

const EFFECT_ENUM_BUILDER = new EnumBuilder("EFFECT");
EFFECT_ENUM_BUILDER.addValue("EFFECT_NONE", 0);
EFFECT_ENUM_BUILDER.addValue("EFFECT_CLASH");
EFFECT_ENUM_BUILDER.addValue("EFFECT_STAB");
EFFECT_ENUM_BUILDER.addValue("EFFECT_BLAST");
EFFECT_ENUM_BUILDER.addValue("EFFECT_FORCE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_ACCENT_SWING");
EFFECT_ENUM_BUILDER.addValue("EFFECT_ACCENT_SLASH");
EFFECT_ENUM_BUILDER.addValue("EFFECT_SPIN");

EFFECT_ENUM_BUILDER.addValue("EFFECT_BOOT");
EFFECT_ENUM_BUILDER.addValue("EFFECT_NEWFONT");
// In-Out
EFFECT_ENUM_BUILDER.addValue("EFFECT_PREON");
EFFECT_ENUM_BUILDER.addValue("EFFECT_POSTOFF");
EFFECT_ENUM_BUILDER.addValue("EFFECT_IGNITION");
EFFECT_ENUM_BUILDER.addValue("EFFECT_RETRACTION");
// Lockup
EFFECT_ENUM_BUILDER.addValue("EFFECT_DRAG_BEGIN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_DRAG_END");
EFFECT_ENUM_BUILDER.addValue("EFFECT_LOCKUP_BEGIN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_LOCKUP_END");
// PSEUDO FOR NOW
EFFECT_ENUM_BUILDER.addValue("EFFECT_MELT_BEGIN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_MELT_END");
EFFECT_ENUM_BUILDER.addValue("EFFECT_LB_BEGIN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_LB_END");
// Utility
EFFECT_ENUM_BUILDER.addValue("EFFECT_CHANGE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_BATTERY_LEVEL");
EFFECT_ENUM_BUILDER.addValue("EFFECT_VOLUME_LEVEL");
EFFECT_ENUM_BUILDER.addValue("EFFECT_POWERSAVE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_BLADEIN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_BLADEOUT");
// Other
EFFECT_ENUM_BUILDER.addValue("EFFECT_ON");
EFFECT_ENUM_BUILDER.addValue("EFFECT_OFF");
EFFECT_ENUM_BUILDER.addValue("EFFECT_OFF_CLASH");
EFFECT_ENUM_BUILDER.addValue("EFFECT_FAST_ON");
EFFECT_ENUM_BUILDER.addValue("EFFECT_FAST_OFF");
EFFECT_ENUM_BUILDER.addValue("EFFECT_QUOTE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_NEXT_QUOTE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_TRACK");
EFFECT_ENUM_BUILDER.addValue("EFFECT_SECONDARY_IGNITION");
EFFECT_ENUM_BUILDER.addValue("EFFECT_SECONDARY_RETRACTION");
EFFECT_ENUM_BUILDER.addValue("EFFECT_INTERACTIVE_PREON");
EFFECT_ENUM_BUILDER.addValue("EFFECT_INTERACTIVE_BLAST");
EFFECT_ENUM_BUILDER.addValue("EFFECT_BEGIN_BATTLE_MODE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_END_BATTLE_MODE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_BEGIN_AUTO_BLAST");
EFFECT_ENUM_BUILDER.addValue("EFFECT_END_AUTO_BLAST");
EFFECT_ENUM_BUILDER.addValue("EFFECT_CLASH_UPDATE");
// Sound effects
EFFECT_ENUM_BUILDER.addValue("EFFECT_ALT_SOUND");
EFFECT_ENUM_BUILDER.addValue("EFFECT_TRANSITION_SOUND");
EFFECT_ENUM_BUILDER.addValue("EFFECT_SOUND_LOOP");
// Blaster effects
EFFECT_ENUM_BUILDER.addValue("EFFECT_STUN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_FIRE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_CLIP_IN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_CLIP_OUT");
EFFECT_ENUM_BUILDER.addValue("EFFECT_RELOAD");
EFFECT_ENUM_BUILDER.addValue("EFFECT_MODE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_RANGE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_EMPTY");
EFFECT_ENUM_BUILDER.addValue("EFFECT_FULL");
EFFECT_ENUM_BUILDER.addValue("EFFECT_JAM");
EFFECT_ENUM_BUILDER.addValue("EFFECT_UNJAM");
EFFECT_ENUM_BUILDER.addValue("EFFECT_PLI_ON");
EFFECT_ENUM_BUILDER.addValue("EFFECT_PLI_OFF");
// PSEUDO FOR NOW
EFFECT_ENUM_BUILDER.addValue("EFFECT_AUTOFIRE_BEGIN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_AUTOFIRE_END");
////////// Add DESTRUCT PR /////////////////
EFFECT_ENUM_BUILDER.addValue("EFFECT_DESTRUCT");
EFFECT_ENUM_BUILDER.addValue("EFFECT_BOOM");
// Mini game effects
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_START");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_ACTION1");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_ACTION2");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_CHOICE");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_RESPONSE1");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_RESPONSE2");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_RESULT1");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_RESULT2");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_WIN");
EFFECT_ENUM_BUILDER.addValue("EFFECT_GAME_LOSE");
// User-definable effects
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER1");
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER2");
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER3");
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER4");
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER5");
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER6");
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER7");
EFFECT_ENUM_BUILDER.addValue("EFFECT_USER8");
// Errors
EFFECT_ENUM_BUILDER.addValue("EFFECT_LOW_BATTERY");
EFFECT_ENUM_BUILDER.addValue("EFFECT_SD_CARD_NOT_FOUND");
EFFECT_ENUM_BUILDER.addValue("EFFECT_ERROR_IN_BLADE_ARRAY");
EFFECT_ENUM_BUILDER.addValue("EFFECT_ERROR_IN_FONT_DIRECTORY");
EFFECT_ENUM_BUILDER.addValue("EFFECT_FONT_DIRECTORY_NOT_FOUND");
// Menu effects
EFFECT_ENUM_BUILDER.addValue("EFFECT_MENU_CHANGE");
EFFECT_ENUM_BUILDER.build();

const LOCKUP_ENUM_BUILDER = new EnumBuilder("LOCKUP_TYPE", "SaberBase::");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_NONE", 0);
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_NORMAL");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_DRAG");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_MELT");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_LIGHTNING_BLOCK");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_AUTOFIRE");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_ARMED");

LOCKUP_ENUM_BUILDER.build();

const ArgumentName_ENUM_BUILDER = new EnumBuilder("ArgumentName");
ArgumentName_ENUM_BUILDER.addValue("BASE_COLOR_ARG", 1);
ArgumentName_ENUM_BUILDER.addValue("ALT_COLOR_ARG", 2);
ArgumentName_ENUM_BUILDER.addValue("STYLE_OPTION_ARG", 3);
ArgumentName_ENUM_BUILDER.addValue("IGNITION_OPTION_ARG", 4);
ArgumentName_ENUM_BUILDER.addValue("IGNITION_TIME_ARG", 5);
ArgumentName_ENUM_BUILDER.addValue("IGNITION_DELAY_ARG", 6);
ArgumentName_ENUM_BUILDER.addValue("IGNITION_COLOR_ARG", 7);
ArgumentName_ENUM_BUILDER.addValue("IGNITION_POWER_UP_ARG", 8);
ArgumentName_ENUM_BUILDER.addValue("BLAST_COLOR_ARG", 9);
ArgumentName_ENUM_BUILDER.addValue("CLASH_COLOR_ARG", 10);
ArgumentName_ENUM_BUILDER.addValue("LOCKUP_COLOR_ARG", 11);
ArgumentName_ENUM_BUILDER.addValue("LOCKUP_POSITION_ARG", 12);
ArgumentName_ENUM_BUILDER.addValue("DRAG_COLOR_ARG", 13);
ArgumentName_ENUM_BUILDER.addValue("DRAG_SIZE_ARG", 14);
ArgumentName_ENUM_BUILDER.addValue("LB_COLOR_ARG", 15);
ArgumentName_ENUM_BUILDER.addValue("STAB_COLOR_ARG", 16);
ArgumentName_ENUM_BUILDER.addValue("MELT_SIZE_ARG", 17);
ArgumentName_ENUM_BUILDER.addValue("SWING_COLOR_ARG", 18);
ArgumentName_ENUM_BUILDER.addValue("SWING_OPTION_ARG", 19);
ArgumentName_ENUM_BUILDER.addValue("EMITTER_COLOR_ARG", 20);
ArgumentName_ENUM_BUILDER.addValue("EMITTER_SIZE_ARG", 21);
ArgumentName_ENUM_BUILDER.addValue("PREON_COLOR_ARG", 22);
ArgumentName_ENUM_BUILDER.addValue("PREON_OPTION_ARG", 23);
ArgumentName_ENUM_BUILDER.addValue("PREON_SIZE_ARG", 24);
ArgumentName_ENUM_BUILDER.addValue("RETRACTION_OPTION_ARG", 25);
ArgumentName_ENUM_BUILDER.addValue("RETRACTION_TIME_ARG", 26);
ArgumentName_ENUM_BUILDER.addValue("RETRACTION_DELAY_ARG", 27);
ArgumentName_ENUM_BUILDER.addValue("RETRACTION_COLOR_ARG", 28);
ArgumentName_ENUM_BUILDER.addValue("RETRACTION_COOL_DOWN_ARG", 29);
ArgumentName_ENUM_BUILDER.addValue("POSTOFF_COLOR_ARG", 30);
ArgumentName_ENUM_BUILDER.addValue("OFF_COLOR_ARG", 31);
ArgumentName_ENUM_BUILDER.addValue("OFF_OPTION_ARG", 32);
ArgumentName_ENUM_BUILDER.addValue("ALT_COLOR2_ARG", 33);
ArgumentName_ENUM_BUILDER.addValue("ALT_COLOR3_ARG", 34);
ArgumentName_ENUM_BUILDER.addValue("STYLE_OPTION2_ARG", 35);
ArgumentName_ENUM_BUILDER.addValue("STYLE_OPTION3_ARG", 36);
ArgumentName_ENUM_BUILDER.addValue("IGNITION_OPTION2_ARG", 37);
ArgumentName_ENUM_BUILDER.addValue("RETRACTION_OPTION2_ARG", 38);
ArgumentName_ENUM_BUILDER.build();

//////////// SOUND1 PR ///////////
// Map each EFFECT constant → Proffie sound key (folder or file prefix)
const EFFECT_SOUND_MAP = {
  [EFFECT_NONE]:             null,        // no sound
  [EFFECT_CLASH]:            "clsh",
  [EFFECT_STAB]:             "stab",
  [EFFECT_BLAST]:            "blst",
  [EFFECT_FORCE]:            "force",
  [EFFECT_BOOT]:             "boot",
  [EFFECT_NEWFONT]:          "font",
  [EFFECT_PREON]:            "preon",
  [EFFECT_POSTOFF]:          "pstoff",
  [EFFECT_IGNITION]:         "out",
  [EFFECT_RETRACTION]:       "in",
  // Lockups
  [EFFECT_DRAG_BEGIN]:       "bgndrag",
  [EFFECT_DRAG_END]:         "enddrag",
  [EFFECT_LOCKUP_BEGIN]:     "bgnlock",
  [EFFECT_LOCKUP_END]:       "endlock",
  // Pseudo-events for lockup bgn/end sound playback / possible future ProffieOS use
  [EFFECT_MELT_BEGIN]:       "bgnmelt",
  [EFFECT_MELT_END]:         "endmelt",
  [EFFECT_LB_BEGIN]:         "bgnlb",
  [EFFECT_LB_END]:           "endlb",
  [EFFECT_AUTOFIRE_BEGIN]:   "bgnauto",
  [EFFECT_AUTOFIRE_END]:     "endauto",

  [EFFECT_CHANGE]:           "ccchange",
  [EFFECT_BATTERY_LEVEL]:    "battlevl",
  [EFFECT_VOLUME_LEVEL]:     "volup",
  [EFFECT_POWERSAVE]:        "dim",
  [EFFECT_BLADEIN]:          "bladein",
  [EFFECT_BLADEOUT]:         "bladeout",

  [EFFECT_ACCENT_SWING]:     "swng",
  [EFFECT_ACCENT_SLASH]:     "slsh",
  [EFFECT_SPIN]:             "spin",
  [EFFECT_FAST_ON]:          "fastout",
  [EFFECT_QUOTE]:            "quote",

  [EFFECT_BEGIN_BATTLE_MODE]:"bmbegin",
  [EFFECT_END_BATTLE_MODE]:  "bmend",
  [EFFECT_BEGIN_AUTO_BLAST]: "blstbgn",
  [EFFECT_END_AUTO_BLAST]:   "blstend",

  [EFFECT_TRANSITION_SOUND]: "tr",
  [EFFECT_SOUND_LOOP]:       "trloop",

  [EFFECT_STUN]:             "stun",
  [EFFECT_FIRE]:             "fire",
  [EFFECT_CLIP_IN]:          "clipin",
  [EFFECT_CLIP_OUT]:         "clipout",
  [EFFECT_RELOAD]:           "reload",
  [EFFECT_MODE]:             "mode",
  [EFFECT_RANGE]:            "range",
  [EFFECT_EMPTY]:            "empty",
  [EFFECT_FULL]:             "full",
  [EFFECT_JAM]:              "jam",
  [EFFECT_UNJAM]:            "unjam",
  [EFFECT_PLI_ON]:           "plion",
  [EFFECT_PLI_OFF]:          "plioff",
  [EFFECT_DESTRUCT]:         "destruct",
  [EFFECT_BOOM]:             "boom"
};

// Parse the style and return a Set containing all EFFECTs and LOCKUPs (including via macros)
// This is for which SOUNDS are allowed.
function getAllowedEventsFromText(text) {
  // Strip comments first
  text = (text || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
    .replace(/\/\/.*$/gm, "");         // line comments

  const allowed = new Set();

  // Literal EFFECT_/LOCKUP_ constants
  const consts = text.match(/\b(EFFECT|LOCKUP)_[A-Z_]+\b/g) || [];
  for (const c of new Set(consts)) {
    if (window[c] !== undefined) allowed.add(window[c]);
  }

  // Macros → effects/lockups
  const macroMap = {
    ResponsiveClashL:     EFFECT_CLASH,
    ResponsiveStabL:      EFFECT_STAB,
    ResponsiveBlastL:     EFFECT_BLAST,
    ResponsiveBlastWaveL: EFFECT_BLAST,
    ResponsiveBlastFadeL: EFFECT_BLAST,

    ResponsiveLockupL:    [EFFECT_LOCKUP_BEGIN, EFFECT_LOCKUP_END, LOCKUP_NORMAL],
    ResponsiveDragL:      [EFFECT_DRAG_BEGIN,   EFFECT_DRAG_END,   LOCKUP_DRAG],
    ResponsiveMeltL:      [EFFECT_MELT_BEGIN,   EFFECT_MELT_END,   LOCKUP_MELT],
    ResponsiveLightningBlockL:[EFFECT_LB_BEGIN, EFFECT_LB_END,     LOCKUP_LIGHTNING_BLOCK],

    InOutTrL:             [EFFECT_IGNITION,     EFFECT_RETRACTION],
    LockupL:              [LOCKUP_NORMAL, LOCKUP_DRAG, LOCKUP_LIGHTNING_BLOCK],
  };

  for (var macro in macroMap) {
    if (hasMacro(text, macro)) {
      var val = macroMap[macro];
      (Array.isArray(val) ? val : [val]).forEach(function(v){ allowed.add(v); });
    }
  }
  return allowed;
}

function hasMacro(text, name) {
  const re = new RegExp("\\b" + name + "\\s*<");
  return re.test(text);
}

// This is for which lockups are shown in the dropdown meny.
function getAllowedLockupsFromText(text) {
  // Strip comments
  text = (text || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const allowed = new Set();

  // Literally lockup
  const consts = text.match(/\bLOCKUP_(?:NORMAL|DRAG|MELT|LIGHTNING_BLOCK|AUTOFIRE)\b/g) || [];
  for (const c of new Set(consts)) if (window[c] !== undefined) allowed.add(window[c]);

  // Lockup macros
  if (hasMacro(text, "ResponsiveLockupL"))         allowed.add(LOCKUP_NORMAL);
  if (hasMacro(text, "ResponsiveDragL"))           allowed.add(LOCKUP_DRAG);
  if (hasMacro(text, "ResponsiveMeltL"))           allowed.add(LOCKUP_MELT);
  if (hasMacro(text, "ResponsiveLightningBlockL")) allowed.add(LOCKUP_LIGHTNING_BLOCK);

  // LockupL - allow all three lockups
  if (hasMacro(text, "LockupL")) {
    allowed.add(LOCKUP_NORMAL);
    allowed.add(LOCKUP_DRAG);
    allowed.add(LOCKUP_LIGHTNING_BLOCK);
  }

  // LockupTrL's specific lockup type.
  const m = text.match(/LockupTrL\s*<[^>]*,\s*[^>]*,\s*[^>]*,\s*(?:SaberBase::)?(LOCKUP_(?:NORMAL|DRAG|MELT|LIGHTNING_BLOCK|AUTOFIRE))/);
  if (m && window[m[1]] !== undefined) allowed.add(window[m[1]]);

  return allowed;
}

function getAllowedLockups() {
  const text = (FIND("style").value || "");
  const allowed = getAllowedLockupsFromText(text);

  // console.log("[Allowed lockups]:", Array.from(allowed));  // **************** DEBUG ONLY
  return allowed;
}

function getAllowedEventsFromStyleText() {
  var style = FIND("style");
  return getAllowedEventsFromText(style.value || "");
}

function getAllowedEventsFromNode(node) {
  // Make the focused part a string
  const u = window.pp_is_url, v = window.pp_is_verbose;
  window.pp_is_url = 0; window.pp_is_verbose = 0;
  const html = (node && typeof node.pp === "function") ? node.pp() : "";
  window.pp_is_url = u; window.pp_is_verbose = v;

  // Strip tags and get the 3 entities we need
  let text = html.replace(/<[^>]*>/g, "");
  text = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  // (Optional) text = text.replace(/\s+/g, " ").trim();

  return getAllowedEventsFromText(text);
}

function effect_to_argument(effect) {
  switch (effect + 0) {
    case EFFECT_CLASH: return CLASH_COLOR_ARG;
    case EFFECT_BLAST: return BLAST_COLOR_ARG;
    case EFFECT_STAB: return STAB_COLOR_ARG;
    case EFFECT_PREON: return PREON_COLOR_ARG;
    case EFFECT_POSTOFF: return POSTOFF_COLOR_ARG;
  }
  return undefined;
}

function lockup_to_argument(effect) {
  switch (effect + 0) {
    case LOCKUP_NORMAL: return LOCKUP_COLOR_ARG;
    case LOCKUP_DRAG: return DRAG_COLOR_ARG;
    case LOCKUP_LIGHTNING_BLOCK: return LB_COLOR_ARG;
  }
  return undefined;
}

class FUNCTION  extends STYLE {
  getType() { return "FUNCTION"; }
};

class SVF_FUNCTION  extends STYLE {
  getType() { return "FUNCTION"; }
  valueBox() {
    return "/* value = <span id=VAL"+this.get_container_id()+">X</span> */";
  }
  update_displays() {
    super.update_displays();
    var tag = FIND("VAL"+this.get_container_id());
    if (tag) tag.innerHTML="" + this.getInteger(0);
  }
};

class TIME_FUNCTION  extends FUNCTION {
  getType() { return "TIME_FUNCTION"; }
};

class TRANSITION extends STYLE {
  getType() { return "TRANSITION"; }

  IS_RUNNING() { return !this.done(); }
};

class CONFIG extends STYLE {
  PP(name, note) {
    if (pp_is_url) {
      return this.PPURL.apply(this, arguments);
    }
    var id = this.get_id();
    var ret = "";
    ret += "<span title='"+ note +"'>" + name + "</span>&lt;\n";
    ret += "<div>\n";
    var comma = false;
    for (var i = 2; i < arguments.length; i += 2) {
      if (comma) ret += ",<br>";
      comma = true;
      var arg = arguments[i];
      var note = arguments[i+1];
      if (typeof(arg) == "number") {
        arg = "" + arg;
      } else {
        arg = arg.pp();
      }
      var comment = arg.COMMENT;
      if (arg.indexOf("<br>") == -1 && arg.indexOf("<div") == -1 && !comment) {
        ret += arg+" /* "+note+" */\n";
      } else {
        ret += "/* "+note+" */<br>\n";
        if (comment) {
          ret += "/* "+comment+" */<br>\n";
        }
        ret += arg;
      }
    }
    ret += "</div>&gt;\n";

    return ret;
  }
  getType() { return "CONFIG"; }
};

function FixColor(c) {
  return min(65535, Math.floor(Math.pow(parseInt(c, 16) / 255.0, 2.2) * 65536));
}

function hex2(N) {
  var ret = N.toString(16);
  if (ret.length < 2) ret = "0" + ret;
  return ret;
}

function UnFixColor(c) {
  return hex2(min(255, Math.floor(Math.pow(parseInt(c) / 65535.0, 1.0/2.2) * 255)));
}

function ClickColor() {
  var color_button = FIND("COLOR");
  color_button.addEventListener("input", ClickColor, false);
  var R = FixColor(color_button.value.substr(1,2));
  var G = FixColor(color_button.value.substr(3,2));
  var B = FixColor(color_button.value.substr(5,2));
  SetTo("Rgb16<"+R+","+G+","+B+">");
}

var effect_links = [];
var layer_links = [];
var effect_type_links = []
var template_links = [];
var function_links = []
var transition_links = [];

var all_colors = {};
var colorNames = {};
var colorData = [];



class Parser {
  constructor(str, classes, identifiers) {
//////////// Logging PR ///////////////
    // console.log("PARSING: " + str);
    this.str = str;
    this.pos = 0;
    this.classes = classes;
    this.identifiers = identifiers;
  }
  peek() {
    if (this.pos >= this.str.length) return ""
    return this.str[this.pos]
  }
  peek2() {
    if (this.pos + 1 >= this.str.length) return ""
    return this.str[this.pos + 1]
  }
  gobble(c) {
    this.skipspace();
    if (this.peek() == c) {
      this.pos++;
      return true;
    }
    return false;
  }
  expect(c) {
    if (!this.gobble(c)) throw "Missing " + c;
  }
  skipspace2() {
    var start_pos = this.pos;
    while (true) {
      if (this.peek() == ' ' || this.peek() == '\t' || this.peek() == '\n' || this.peek() == '\r') { this.pos++; continue; }
      if (this.peek() == '/')  {
        if (this.peek2() == '*') {
          this.pos += 2;
          while (this.pos < this.str.length && !(this.peek() == '*' && this.peek2() == '/')) this.pos++;
          this.pos += 2;
          continue;
        }
        if (this.peek2() == '/') {
          this.pos += 2;
          while (this.pos < this.str.length && this.peek() != '\n') this.pos++;
          this.pos ++;
          continue;
        }
      }
      return this.str.substr(start_pos, this.pos - start_pos); // trim?
    }
  }

  skipspace() {
    var ret = this.skipspace2();
    if (ret.trim()) {
       console.log("COMMENT DROPPED ON GROUND: "+ret);
       console.trace();
    }
  }

  startswithnewline(str) {
    var tmp = str.trimStart();
    var start = str.substr(0, str.length - tmp.length);
    return start.split('\n').length > 1;
  }

  stripcomment(str) {
    var ret = "";
    while (true) {
      str = str.trim();
      if (str) console.log("STRIPCOMMENT: "+str);
      if (str == "") {
        if (ret) console.log("STRIPCOMMENT -> "+ret);
        return ret;
      }
      if (ret != "") ret += "\n";
      if (str[0] == '/' && str[1] == '/') {
        var tmp = str.split('\n');
        ret += tmp[0].substr(2);
        str = tmp.slice(1).join('\n');
      } else if (str[0] == '/' && str[1] == '*') {
        var tmp = str.split('*/');
        ret += tmp[0].substr(2);
        str = tmp.slice(1).join('*/');
      } else {
        if (ret) console.log("STRIPCOMMENT -> "+ret);
        return ret;
      }
    }
  }

  identifier() {
    var ret = "";
    while (true) {
      var c = this.peek();
      if ((c >= 'a' && c <= 'z') ||
          (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') || c == '_' || c == ':') {
        ret += c;
        this.pos++;
      } else {
        return ret;
      }
    }
  }

  parse_optional_string() {
    this.skipspace();
    if (this.peek() != '"') return null;
    var ret = "";
    while (this.gobble('"')) {
      while (this.peek() != '"') {
         ret += this.peek();
         this.pos++;
      }
      this.expect('"')
      this.skipspace();
    }
    return ret;
  }

  // recursive descent parser
  parse_atom() {
    this.skipspace();
    var start_of_atom = this.pos;
    var id = this.identifier();
    if (id == "") {
      throw "Expected identifier or number";
    }
    if ((id[0] >= '0' && id[0] <= '9')) {
      if (id.slice(0,2) == "0b") {
        return new BINARY(parseInt(id.slice(2), 2));
      }
      return new INTEGER(parseInt(id));
    }
    var midcomment = this.skipspace2();
    var args = 0;
    var argstring = 0;
    if (this.peek() == "<") {
      this.pos++;
      var POS = this.pos;
      this.skipspace2();
      args = [null];
      if (this.peek() != '>') {
        this.pos = POS; // backtrack for comments
        while (true) {
          var v = this.parse_internal();
          args.push(v);
          this.skipspace2();
          if (this.peek() != ',') break;
          this.pos++;
          POS = this.pos
          var comment = this.skipspace2();
          if (this.startswithnewline(comment)) {
            // Comment belongs to next value.
            // rewind and let parse_unary do it.
            this.pos = POS;
          } else {
            v.addcomment(this.stripcomment(comment));
            if (v.COMMENT) console.log("SETCOMMENT:" + v.COMMENT);
          }
        }
      }
      if (this.peek() != '>') {
        throw "Missing > or ,";
      }
      this.pos++;
      if (this.peek() == '(') {
        this.pos++;
        argstring = this.parse_optional_string();
        if (this.peek() != ')') throw "Missing )";
        this.pos++;
      }
    }
    var ret;
    if (this.identifiers[id]) {
      if (args != 0) {
        throw "Unexpected arguments";
      }
      ret = this.identifiers[id]();
    } else if (this.classes[id]) {
      //console.log(id);
      //console.log(this.classes[id]);
      //console.log(args);
      if (args == 0) args = [null];
      // var ret = new (Function.prototype.bind.apply(this.classes[id], args));
      try {
        ret = classes[id].apply(args[0], args.slice(1));
      } catch(e) {
        if (typeof(e) == "string")
          e = new MyError(id +": " + e);
        if (typeof(e) == "object" && e.constructor == MyError)
          e.desc = id + ": " + e.desc;
        if (typeof(e) == "object" && e.constructor == MyError && e.end_pos == -1) {
          e.setBegin(start_of_atom);
          e.setEnd(this.pos);
        }
        throw e;
      }
      // console.log(ret);
      if (argstring) {
        console.log("ARGSTRING : " + argstring);
        ret.argstring = argstring;
      }
    }
    if (!ret) {
      throw  "Unknown identifier: " + id;
    }
    ret.addcomment(this.stripcomment(midcomment));
    return ret;
  }

  parse_unary() {
    var pre_comment = this.skipspace2();
    var ret = 0;
    if (this.peek() == '-') {
      this.pos++;
      ret = this.parse_atom();
      if (ret.getType() != "INT")
        throw "Expected integer, got " + ret.getType();
      ret.value = - ret.value;
      return ret;
    } else {
      ret = this.parse_atom();
    }
    if (pre_comment.trim()) {
      ret.prependcomment(this.stripcomment(pre_comment));
    }
    return ret;
  }

  parse_internal() {
    var ret = this.parse_unary();
    this.skipspace();
    while (this.peek() == '|') {
      this.pos++;
      ret.value |= this.parse_unary();
      this.skipspace();
    }
    //console.log("PARSE, returns ID " + ret.get_id());
    // console.log(ret);
    //    console.trace();

    return ret;
  }

  parse() {
    var OLD = PushHandledTypes();
    var begin_pos = this.pos;
    var ret = this.parse_internal();

    // secret handshake
    ret.__begin_pos = begin_pos;
    ret.__end_pos = this.pos;
    ret.__handled_types = handled_types;
    ret.__handled_lockups = handled_lockups;
    PopHandledTypes(OLD);

    return ret;
  }
};

var current_style;
//var current_style = InOutHelper(SimpleClash(Lockup(new BlastClass(new RainbowClass(), WHITE), new AudioFlickerClass(BLUE, WHITE)), WHITE, 40), 300, 800);
var blade;
var rotate_start;
var last_micros;

var last_actual_millis= actual_millis() - 10;
var time_factor = 1000; // transforms ms to us

var last_style;
var show_style;

var numTick = 0;
var framesPerUpdate = 0;
var timeFactor = 1.0;
var bad_fps = 0;
var good_fps = 0;

var pixels;
var AA = 1;

var current_focus;
var current_focus_url;
var style_tree;
var AA_STEP_SIZE = 1;

// returns Float32Array with 3 * num_pixel values
function getSaberColors() {
    var now_actual_millis = actual_millis();
    var delta_actual_millis = now_actual_millis - last_actual_millis;
    last_actual_millis = now_actual_millis;
    
    var delta_us = delta_actual_millis * time_factor
    last_micros = current_micros;
    current_micros_internal += delta_us;
    current_micros = current_micros_internal
    if (current_micros - last_micros > 1000000/45) {
        bad_fps ++;
        if (good_fps) good_fps--;
    } else {
        if (bad_fps) bad_fps --;
        good_fps++;
    }
    if (benchmarkState.get()) {
        if (bad_fps > 20) {
            if (AA_STEP_SIZE < 0) AA_STEP_SIZE-=1; else AA_STEP_SIZE=-1;
            AA+=AA_STEP_SIZE;
            if (AA < 1) AA = 1;
            compile();
            bad_fps = 0;
            FIND("error_message").innerHTML = "AA="+AA;
        }
        if (good_fps > 20) {
            if (AA_STEP_SIZE > 0) AA_STEP_SIZE+=1; else AA_STEP_SIZE=1;
            AA+=AA_STEP_SIZE;
            compile();
            good_fps = 0;
            FIND("error_message").innerHTML = "AA="+AA;
        }
    }
    var num_leds = blade.num_leds()
    if (!pixels || pixels.length != num_leds * 3) {
        pixels = new Float32Array(num_leds * 3);
    }
    var S = current_style;
    if (S != last_style) {
        last_style = S;
        if (S.getType) {
            S.set_right_side(current_focus || style_tree)
            if (S.getType() == "TRANSITION") {
              S = TransitionLoop(Rgb(0,0,0), TrConcat(TrDelay(500), Rgb(255,0,0), S, Rgb(0,0,255), TrInstant()));
            }
            if (S.getType() == "FUNCTION") {
              S = Mix(S, Rgb(0,0,0), Rgb(255,255,255));
            }
        }
        show_style = S;
    } else {
        S = show_style;
    }
    // numTick++;
    // if (S.getColor && S.getType && S.getType() == "COLOR" && numTick > framesPerUpdate) {
    //     numTick = 0;
    if (S.getColor && S.getType && S.getType() == "COLOR") {
        S.run(blade);
        for (var i = 0; i < num_leds; i++) {
            var c = S.getColor(i);
            pixels[i*3 + 0] = c.r / 2;
            pixels[i*3 + 1] = c.g / 2;
            pixels[i*3 + 2] = c.b / 2;
        }
        if (last_micros != 0) {
            current_micros += delta_us / 2;
        }
        // if (framesPerUpdate == 0) {
        //     S.run(blade);
        // }
        S.run(blade);

        for (var i = 0; i < num_leds; i++) {
            var c = S.getColor(i);
            pixels[i*3 + 0] += c.r / 2;
            pixels[i*3 + 1] += c.g / 2;
            pixels[i*3 + 2] += c.b / 2;
        }
        S.update_displays();
    }
    t += 1;
    return pixels;
}

function getSaberMove() {
  var rotation = MOVE_MATRIX;
  if (STATE_ROTATE) {
    var u_value = (new Date().getTime() - rotate_start) / 3000.0;
    var rotation = default_move_matrix();
    rotation = rotation.mult(Matrix.mkyrot(u_value));
    rotation = rotation.mult(Matrix.mkzrot(u_value / 7.777));

  } else {
    if (0) {
      OLD_MOVE_MATRIX = default_move_matrix();
      rotation = default_move_matrix();
      rotation = rotation.mult(Matrix.mkzrot(0.2));
    }
    rotate_start = new Date().getTime();
//    rotation = default_move_matrix();
  }
  OLD_MOVE_MATRIX = rotation;
//  rotation = rotation.mult(Matrix.mkzrot(Math.PI));
//  rotation = rotation.mult(Matrix.mkxrot(Math.PI));
 //  rotation = rotation.mult(Matrix.mkyrot(Math.PI*3.0/2.0));
//  rotation = rotation.mult(Matrix.mkyrot(Math.PI/2.0));
 //  rotation = rotation.mult(Matrix.mkzrot(-Math.PI/2.0));
    //  rotation = rotation.mult(Matrix.mkyrot(-Math.PI/2.0));
    rotation = Matrix.fromValues(
        0.0, -1.0, 0.0, 0.0,
        0.0, 0.0, -1.0, 0.0,
        1.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 1.0).mult(rotation);
    rotation = rotation.mult(Matrix.mkyrot(Math.PI/2.0));
    rotation = rotation.mult(Matrix.mktranslate(0.0, 0.0, -250.0));
  return rotation;
}

function buildPcbColors(numLeds, numBladeLeds, style) {
  var arr = [];
  for (var k = 0; k < numLeds; k++) {
    var bladeIdx = Math.floor((k / numLeds) * numBladeLeds);
    var c = style.getColor ? style.getColor(bladeIdx) : { r: 1, g: 1, b: 0 };
    arr.push([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]);
  }
  return arr;
}

function drawScene() {
  var now_actual_millis = actual_millis();
  var delta_actual_millis = now_actual_millis - last_actual_millis;
  last_actual_millis = now_actual_millis;
  
  var delta_us = delta_actual_millis * time_factor
  last_micros = current_micros;
  current_micros_internal += delta_us;
  current_micros = current_micros_internal
  if (current_micros - last_micros > 1000000/45) {
     bad_fps ++;
     if (good_fps) good_fps--;
  } else {
     if (bad_fps) bad_fps --;
     good_fps++;
  }
  if (benchmarkState.get()) {
     if (bad_fps > 20) {
        if (AA_STEP_SIZE < 0) AA_STEP_SIZE-=1; else AA_STEP_SIZE=-1;
        AA+=AA_STEP_SIZE;
        if (AA < 1) AA = 1;
        compile();
        bad_fps = 0;
        FIND("error_message").innerHTML = "AA="+AA;
     }
     if (good_fps > 20) {
        if (AA_STEP_SIZE > 0) AA_STEP_SIZE+=1; else AA_STEP_SIZE=1;
        AA+=AA_STEP_SIZE;
        compile();
        good_fps = 0;
        FIND("error_message").innerHTML = "AA="+AA;
     }
  }
  var num_leds = blade.num_leds()
  if (!pixels || pixels.length < num_leds * 4 * 2) {
     pixels = new Uint8Array(num_leds * 4 * 2);
  }

  var S = current_style;
  if (S != last_style) {
    last_style = S;
    if (S.getType) {
      S.set_right_side(current_focus || style_tree)
      if (S.getType() == "TRANSITION") {
        S = TransitionLoop(Rgb(0,0,0), TrConcat(TrDelay(500), Rgb(255,0,0), S, Rgb(0,0,255), TrInstant()));
      }
      if (S.getType() == "FUNCTION") {
        S = Mix(S, Rgb(0,0,0), Rgb(255,255,255));
      }
    }
    show_style = S;
  } else {
    S = show_style;
  }
  // numTick++;
  // if (S.getColor && S.getType && S.getType() == "COLOR" && numTick > framesPerUpdate) {
  //   numTick = 0;
  if (S.getColor && S.getType && S.getType() == "COLOR") {
    S.run(blade);
    for (var i = 0; i < num_leds; i++) {
        var c = S.getColor(i);
        pixels[i*4 + 0] = Math.round(c.r * 255);
        pixels[i*4 + 1] = Math.round(c.g * 255);
        pixels[i*4 + 2] = Math.round(c.b * 255);
        pixels[i*4 + 3] = 255;

        // keep parallel-mode PCB sampling fed
        bladeColors[i] = [pixels[i*4 + 0], pixels[i*4 + 1], pixels[i*4 + 2]];
    }

    // Dedicated vs parallel PCB mapping
    if (previewType.value === 'blade') {
      pcbColors = null;
    } else if (pcbDedicatedState.get()) {
      var len = 0;
      switch (previewType.value) {
        case 'PCBa': len = 16; break;
        case 'PCBb': len = 30; break;
        case 'PCBc': len = 5;  break;
        case 'PCBd': len = 6;  break;
        case 'PCBe': len = 64; break;  // MTRX 64 pixel rectangular PCB
        case 'PCBf': len = 69; break;  // MTRX 69 pixel round PCB
        case 'PCBg': len = parseInt(FIND('pixelRingCount').value) || 6; break;
      }
      pcbColors = len ? buildPcbColors(len, num_leds, S) : null;
    } else {
      // PCB in parallel mode
      pcbColors = null;
    }

    if (last_micros != 0) {
      current_micros += delta_us / 2;
    }
    // if (framesPerUpdate == 0) {
    //   S.run(blade);
    // }
        S.run(blade);

    for (var i = 0; i < num_leds; i++) {
        var c = S.getColor(i);
        pixels[i*4 + 0 + num_leds * 4] = Math.round(c.r * 255);
        pixels[i*4 + 1 + num_leds * 4] = Math.round(c.g * 255);
        pixels[i*4 + 2 + num_leds * 4] = Math.round(c.b * 255);
        pixels[i*4 + 3 + num_leds * 4] = 255;
    }
    S.update_displays();
  }

  /// three.js animation stuff here!!

  var rotation = MOVE_MATRIX;
  if (STATE_ROTATE) {
    var u_value = (new Date().getTime() - rotate_start) / 3000.0;
    var rotation = default_move_matrix();
    rotation = rotation.mult(Matrix.mkyrot(u_value));
    rotation = rotation.mult(Matrix.mkzrot(u_value / 7.777));

  } else {
    if (0) {
      OLD_MOVE_MATRIX = default_move_matrix();
      rotation = default_move_matrix();
      rotation = rotation.mult(Matrix.mkzrot(0.2));
    }
    rotate_start = new Date().getTime();
  }
  OLD_MOVE_MATRIX = rotation;

  t += 1;
}


function tick() {
  window.requestAnimationFrame(tick);
  drawScene();
  // Update PCB preview in real time if visible
  if (!pcbCanvas.hidden) drawPCB();
}

  function openConnectOverlay() {
    const el      = FIND("connect-overlay");
    if (!el) return;

    const note    = FIND("connect-support-note");
    const title   = FIND("connect-overlay-title");
    const choices = FIND("CONNECT_CHOICES");
    const disc    = FIND("CONNECT_DISCONNECT");
    const usbBtn  = FIND("CONNECT_USB_BTN");
    const bleBtn  = FIND("CONNECT_BLE_BTN");

    if (title) title.textContent = "Connect Proffieboard";

    const libLoaded = !!window.ProffieLink;
    const connected = libLoaded && window.ProffieLink.isConnected && window.ProffieLink.isConnected();

    const secure  = window.isSecureContext === true;
    const usbFeat = "usb" in navigator;
    const bleFeat = "bluetooth" in navigator;

    const usbOK = libLoaded && (window.ProffieLink.usbSupported
      ? window.ProffieLink.usbSupported()
      : (usbFeat && secure));

    const bleOK = libLoaded && (window.ProffieLink.bleSupported
      ? window.ProffieLink.bleSupported()
      : (bleFeat && secure));

    if (connected) {
      // Connected view: show Disconnect block only
      if (note) note.textContent = "You are connected. Choose Disconnect to stop remote control.";
      if (choices) choices.style.display = "none";
      if (disc)    disc.style.display    = "flex";
    } else {
      // Not connected
      const msgs = [];
      if (!libLoaded) msgs.push("link script missing");
      if (!secure)    msgs.push("not a secure context (use https or localhost)");
      if (!usbFeat)   msgs.push("WebUSB unsupported");
      if (!bleFeat)   msgs.push("Web Bluetooth unsupported");
      if (!usbFeat || !bleFeat) msgs.push("Use Google Chrome browser");

      if (note) note.innerText = msgs.length ? ("Note:\n" + msgs.join("\n")) : "Choose a connection method:";

      if (usbBtn) { usbBtn.disabled = !usbOK; usbBtn.style.opacity = usbOK ? 1 : 0.5; }
      if (bleBtn) { bleBtn.disabled = !bleOK; bleBtn.style.opacity = bleOK ? 1 : 0.5; }

      if (choices) choices.style.display = "flex";
      if (disc)    disc.style.display    = "none";
    }

    if (!connected && window.__connecting) {
      if (title) title.textContent = "Connecting…";
      if (note)  note.textContent  =
        window.__connecting === 'USB' ? "Attempting USB connection…" : "Attempting Bluetooth connection…";

      if (choices) choices.style.display = "none";
      if (disc)    disc.style.display    = "none";

      // Clear banner after ~1s unless we become connected (overlay closes then)
      clearTimeout(window.__connectingTimer);
      window.__connectingTimer = setTimeout(() => {
        // if still not connected, restore normal overlay
        if (!window.ProffieLink?.isConnected?.()) {
          window.__connecting = null;
          try { openConnectOverlay(); } catch (_) {}
        } else {
          // Connected! Show calibration message
          if (title) title.textContent = "Calibrate:";
          if (note)  note.textContent  = "At any time,\npoint your saber at the screen and press \"c\" on the keyboard to re-center.";
          if (choices) choices.style.display = "none";
          if (disc)    disc.style.display    = "none";
        }
      }, 1000);
    }

    el.style.display = "flex";
  }

  function closeConnectOverlay() {
    const el = FIND("connect-overlay");
    if (el) el.style.display = "none";
  }

  async function connectProffieUSB() {
    alert("Note – 'Tools>USB Type: Serial+WebUSB' in Arduino must be enabled and uploaded to the Proffieboard for USB connection to work.");
    if (!window.ProffieLink || !window.ProffieLink.usbSupported()) { alert("WebUSB not supported in this browser."); return; }
    try {
      window.__connecting = 'USB';
      openConnectOverlay();
      await window.ProffieLink.connectUSB();
      // setTimeout(() => { try { closeConnectOverlay(); } catch (_) {} }, 1000);
    } catch (e) {
      console.error(e); alert("USB connect failed.");
    } finally {
      window.__connecting = null;
    }
  }

  async function connectProffieBLE() {
    if (!window.ProffieLink || !window.ProffieLink.bleSupported()) { alert("Web Bluetooth not supported in this browser."); return; }
    try {
      window.__connecting = 'BLE';
      openConnectOverlay();
      await window.ProffieLink.connectBLE();
      // setTimeout(() => { try { closeConnectOverlay(); } catch (_) {} }, 1000);
    } catch (e) {
      console.error(e); alert("Bluetooth connect failed.");
    } finally {
      window.__connecting = null;
    }
  }

  async function disconnectProffie() {
    try {
      if (window.ProffieLink && window.ProffieLink.disconnect) {
        window.ProffieLink.disconnect();
      }
    } finally {
      closeConnectOverlay();
    }
  }

var overall_string;

function ReplaceCurrentFocus(str) {
  current_focus_url = str;

  if (current_focus) {
    current_focus.super_short_desc = true;
    pp_is_url++;
    pp_is_verbose++;
    var url = style_tree.pp();
    //console.log("FOCUS URL: " + url);
    current_focus_pp = url;
    outerMostBracket = (url === "$");
    pp_is_url--;
    pp_is_verbose--;
    current_focus.super_short_desc = false;
    str = url.replace("$", "FOCUS<" + str + ">");
  }

  var old_focus = current_focus;
  current_focus = 0;
  focus_catcher = 0;

  var parser = new Parser(str, classes, identifiers);
  try {
      style_tree = parser.parse();
  }
  catch(e) {
    var err = FIND("error_message");
    current_focus = old_focus;
    console.log(e);
    console.log(e.stack);
    console.log(typeof(e));
    if (typeof(e) == "string") {
      err.innerHTML = e;
      return;
    } else if (typeof(e) == "object" && e.constructor == MyError) {
      err.innerHTML = e.desc;
      return;
    } else {
      throw e;
    }
  }
  var tmp = "";
  tmp += style_tree.pp();
  FIND("pp").innerHTML = tmp;
  if (focus_catcher) {
    current_focus = focus_catcher;
    var id = current_focus.get_id();
    var container = FIND("X"+id);
    if (!container) {
      console.log("Lost focus when parsing " + str);
      console.log(focus_trace);
    } else {
    container.classList.add("selected-area-container");
    }
  } else {
    console.log("No focus catcher found!!");
  }
  var type = "COLOR";
  var classname = "Style";
//////////// History PR ///////////

  if (current_style) {
    type = current_style.getType();
    classname = current_style.constructor.name;
  }

  AddHistory(current_focus_url, current_style.getType());
  highlightHistoryButtons(type);

  FIND("EXPAND_BUTTON").className = current_style && current_style.isMacro ? "button-on" : "button-off";
  FIND("LAYERIZE_BUTTON").className = CanLayerize(current_style) ? "button-on" : "button-off";

  if (type == "COLOR" && classname.endsWith("LClass")) {
    ActivateTab("layer", true);
  } else if (type == "COLOR" && (classname == "Rgb16Class" || classname == "RgbClass")) {
    ActivateTab("rgb", true);
  } else if (type === "ArgumentName") {
    ActivateTab("arguments", true);
  } else {
    ActivateTab(type.toLowerCase(), true);
  }
}

function highlightHistoryButtons(validType) {
  // console.log('highlightHistoryButtons called with type:', validType);
  const allButtons = document.querySelectorAll('#history_tabcontent .history-btn');
  allButtons.forEach(btn => {
    btn.classList.remove('history-btn-valid', 'history-btn-invalid');
    if (btn.dataset.type === validType) {
      btn.classList.add('history-btn-valid');
    } else {
      btn.classList.add('history-btn-invalid');
    }
  });
}
//////////// History PR ///////////

//////////// Resolve empty WavLen<> PR ///////////
// This replaces any empty WavLen<> in a TransitionEffectL with WavLen<EFFECT_XXXX>
function autoBindWavLen(styleString) {
  let out = '';
  let i = 0;
  while (i < styleString.length) {
    let start = styleString.indexOf('TransitionEffectL<', i);
    if (start === -1) {
      out += styleString.slice(i);
      break;
    }
    out += styleString.slice(i, start);
    let bracketDepth = 0;
    let j = start + 'TransitionEffectL<'.length;
    for (; j < styleString.length; ++j) {
      if (styleString[j] === '<') bracketDepth++;
      else if (styleString[j] === '>') {
        if (bracketDepth === 0) break;
        bracketDepth--;
      }
    }
    if (j >= styleString.length) {
      // Malformed, just copy rest
      out += styleString.slice(start);
      break;
    }
    // Now grab the inside: a comma-separated args list, last is effectName
    const inside = styleString.slice(start + 'TransitionEffectL<'.length, j);
    let depth = 0, lastComma = -1;
    for (let k = 0; k < inside.length; ++k) {
      if (inside[k] === '<') depth++;
      else if (inside[k] === '>') depth--;
      else if (inside[k] === ',' && depth === 0) lastComma = k;
    }
    if (lastComma === -1) {
      out += styleString.slice(start, j + 1);
      i = j + 1;
      continue;
    }
    const effectBody = inside.slice(0, lastComma).trim();
    const effectName = inside.slice(lastComma + 1).trim();
    // Replace all WavLen<> with WavLen<effectName> in effectBody
    const fixedBody = effectBody.replace(/WavLen\s*<\s*>/g, `WavLen<${effectName}>`);
    out += `TransitionEffectL<${fixedBody},${effectName}>`;
    i = j + 1;
  }
  return out;
}

// This replaces any empty WavLen<> in an InOutTrL with WavLen<EFFECT_XXXX>
function autoBindWavLenInOutTrL(styleString) {
  let out = '';
  let i = 0;
  while (i < styleString.length) {
    let start = styleString.indexOf('InOutTrL<', i);
    if (start === -1) {
      out += styleString.slice(i);
      break;
    }
    out += styleString.slice(i, start);
    let bracketDepth = 0;
    let j = start + 'InOutTrL<'.length;
    for (; j < styleString.length; ++j) {
      if (styleString[j] === '<') bracketDepth++;
      else if (styleString[j] === '>') {
        if (bracketDepth === 0) break;
        bracketDepth--;
      }
    }
    if (j >= styleString.length) {
      // Malformed, just copy rest
      out += styleString.slice(start);
      break;
    }
    const inside = styleString.slice(start + 'InOutTrL<'.length, j);
    // Bracket-aware split on top-level comma
    let depth = 0, split = -1;
    for (let k = 0; k < inside.length; ++k) {
      if (inside[k] === '<') depth++;
      else if (inside[k] === '>') depth--;
      else if (inside[k] === ',' && depth === 0) {
        split = k;
        break;
      }
    }
    if (split === -1) {
      out += styleString.slice(start, j + 1);
      i = j + 1;
      continue;
    }
    const inTr = inside.slice(0, split).trim();
    const outTr = inside.slice(split + 1).trim();
    let inFixed = inTr.replace(/WavLen\s*<\s*>/g, 'WavLen<EFFECT_IGNITION>');
    let outFixed = outTr.replace(/WavLen\s*<\s*>/g, 'WavLen<EFFECT_RETRACTION>');
    out += `InOutTrL<${inFixed},${outFixed}>`;
    i = j + 1;
  }
  return out;
}

// Prevent retriggering effects after re-parse (clicking Submit, or outermost bracket)
function PreventTransitionRetrigger(style, bladeObj, index = {v:0}) {
  if (!style) return;
  if (style.constructor.name === "TransitionEffectLClass") {
    for (const e of bladeObj.GetEffects()) {
      if (e.type === style.EFFECT.getInteger(0)) {
        style.effect_.last_detected_ = e.start_micros;
        break;
      }
    }
  }
  if (Array.isArray(style.args)) {
    for (const child of style.args) {
      index.v++;
      PreventTransitionRetrigger(child, bladeObj, index);
    }
  }
}

function Run() {
  var sty = FIND("style");
  var err = FIND("error_message");
  // grab the raw text
  var originalStr = sty.value;
  var str = originalStr;

//////////// Resolve empty WavLen<> PR ///////////
  // Only run autoBind if there is an empty WavLen<> placeholder
  const emptyWavLenRegex = /WavLen\s*<\s*>/;
  if (emptyWavLenRegex.test(str)) {
    str = autoBindWavLen(str);
    str = autoBindWavLenInOutTrL(str);
    // write it back so the textarea updates
    sty.value = str;
  }

  var parser = new Parser(str,
                          classes,
                          identifiers);
  err.innerHTML = "";
  try {
    current_style = parser.parse();
    PreventTransitionRetrigger(current_style, blade);
    ReplaceCurrentFocus(str);

    outerMostBracket = (!current_focus) || (current_focus_pp === "$");
    if (outerMostBracket) {
      if (!style_base_check(current_style, "error_message")) {
        const parser2 = new Parser("BLACK", classes, identifiers);
        current_style = parser2.parse();
        compile();
        return;
      }
    }
  }
  catch(e) {
    console.log(e);
    console.log(e.stack);
    console.log(typeof(e));
    if (typeof(e) == "string") {
//////////// indents and line returns PR ///////////
      err.innerHTML = e;
      sty.focus();
      sty.setSelectionRange(parser.pos, parser.pos);

      parser = new Parser("BLACK",
                          classes,
                          identifiers);
      current_style = parser.parse();
      compile();
      return;
    } else if (typeof(e) == "object" && e.constructor == MyError) {
      err.innerHTML = e.desc;
      sty.focus();
      if (e.begin_pos > -1) {
        sty.setSelectionRange(e.begin_pos, e.end_pos);
      } else {
        sty.setSelectionRange(parser.pos, parser.pos);
      }

      parser = new Parser("BLACK",
                          classes,
                          identifiers);
      current_style = parser.parse();
      compile();
      return;
    } else {
      throw e;
    }
  }
  compile();
//////////// Lockup Dropdown tweaks PR ///////////
  STATE_LOCKUP = LOCKUP_NONE;
  updateLockupDropdown();

  if (current_style.argstring) {
//////////// missing semicolon PR ///////////
    FIND("ARGSTR").value = "builtin 0 1 " + current_style.argstring;
    ArgStringChanged();
  }
}

var ARGUMENTS = ["builtin", "0", "1"];
var default_arguments = [];

function updateArgTag(ARG, VALUE) {
  var N = ArgumentName_ENUM_BUILDER.value_to_name[ARG];
  var tag = FIND("ARGSTR_"+N);
  if (VALUE.search(",") >= 0) {
    console.log("FIXING COLOR VALUE: "+VALUE);
    var values = VALUE.split(",")
    VALUE = '#' + UnFixColor(values[0])+UnFixColor(values[1])+UnFixColor(values[2]);
  }
  console.log("Setting tag from: " + tag.value + " to " + VALUE);
  tag.value = VALUE;
}

function getARG(ARG, DEFAULT) {
  ARG = ARG + 2;
  if (!default_arguments[ARG]) {
    updateArgTag(ARG - 2, DEFAULT);
  }
  default_arguments[ARG] = DEFAULT;
  if (ARGUMENTS[ARG] && ARGUMENTS[ARG] != "~")
    return ARGUMENTS[ARG];
  return DEFAULT;
}

function ArgStringChanged() {
  var tag = FIND("ARGSTR");
  ARGUMENTS = tag.value.split(" ");
  for (var i = 3; i < ARGUMENTS.length; i++) {
     if (ARGUMENTS[i] == "~") continue;
     if (!ARGUMENTS[i]) continue;
     var ARG = i - 2;
     updateArgTag(ARG, ARGUMENTS[i]);
  }
}

function setARG(ARG, TO) {
  ARG += 2;
  ARGUMENTS[ARG] = TO;
  for (var i = 0; i < ARGUMENTS.length; i++) {
    if (!ARGUMENTS[i]) {
      ARGUMENTS[i] = '~';
    }
  }
  FIND("ARGSTR").value = ARGUMENTS.join(" ");
}

function ArgChanged(ARG) {
  var N = ArgumentName_ENUM_BUILDER.value_to_name[ARG];
  var tag = FIND("ARGSTR_"+N);
  setARG(ARG, tag.value);
//////////// Logging PR ///////////////
  console.log("Updated " + N + " : " + tag.value)
}

function IncreaseArg(ARG, I) {
  var N = ArgumentName_ENUM_BUILDER.value_to_name[ARG];
  var tag = FIND("ARGSTR_"+N);
  tag.value = parseInt(tag.value) + I;
  setARG(ARG, tag.value);
//////////// Logging PR ///////////////
  console.log("Updated " + N + " : " + tag.value)
}

function ClickArgColor(ARG) {
  var N = ArgumentName_ENUM_BUILDER.value_to_name[ARG];
  var tag = FIND("ARGSTR_"+N);
  var R = FixColor(tag.value.substr(1,2));
  var G = FixColor(tag.value.substr(3,2));
  var B = FixColor(tag.value.substr(5,2));
  setARG(ARG, R+","+G+","+B);
}

function PopState(event) {
  if (event.state) {
    FIND("style").value = event.state;
    Run();
  }
}

function SetTo(str) {
//////////// Logging PR ///////////////
  // console.log("Style SetTo:\n", str);
  var old = FIND("style").value;
  var url = new URL(window.location.href);
  url.searchParams.set("S", str);

  // FIXME: Use pushState and fix back arrow
  window.history.replaceState(old, "Style Editor", window.location.href);
  window.history.pushState(str, "Style Editor", url);
  window.onpopstate = PopState;

  FIND("style").value = str;
  Run();
}

////////////////  TAB MANIA PR /////////////////
function SetToAndFormat(str, event) {
  var parser = new Parser(str, classes, identifiers);
  var style = parser.parse();
  pp_is_url++;
  var url = style.pp();
  pp_is_url--;
  SetTo(url);

  // If the clicked element is a button in either the "Examples" or "History" tab, enable all tabs
  if (event && (event.target.closest('.example-tabcontent') || event.target.closest('.history-tabcontent'))) {
    enableTabs();
  }
}
////////////////  TAB MANIA PR /////////////////

function FocusOnLow(id) {
  console.log("FOCUSON: " + id);
  var style = style_ids[id];
//////////// Logging PR ///////////////
  // console.log("style_ids[" + id + "] =", style);
  current_focus = style;
  var container = FIND("X"+id);
  //////////// Logging PR ///////////////
  // console.log(container);
//////////// CSS PR ///////////////
  // MOVED TO CSS container.style.backgroundColor = 'lightblue';
  pp_is_url++;
  var url = style.pp();
  pp_is_url--;
/////////// Logging PR ///////////////
  // console.log("pp URL =", url);
  current_focus_url = url;
  SetTo(url);
//////////// SOUND1 PR ///////////////
  FocusCheck();
  return true;
}

function FocusOn(id, event) {
  event.stopPropagation();
  FocusOnLow(id);
}

//////////// SOUND1 PR ///////////////
function FocusCheck() {
  // Detect whether this is the top-level in structured view.
  // console.log("************ outerMostBracket", outerMostBracket ? "YES" : "NO");

  if (outerMostBracket) {
    if (STATE_ON) {
      // console.log("[FocusCheck] resumeLoops()");
      resumeLoops();
    }
  } else {
    // console.log("[FocusCheck] stopAllLoops()");
    stopAllLoops(200, false);
  }
}

function ClickRotate() {
  STATE_ROTATE = !STATE_ROTATE;
  var rotate_button = FIND("ROTATE_BUTTON");
  rotate_button.classList.toggle("button-latched", STATE_ROTATE ? true : false);
  console.log("ROTATE");
}

//////////// BC ///////////

var power_button = FIND("POWER_BUTTON");
/*
Compute delay for triggering ignition/postoff.
For ignition delay, use preon sound duration (or global WavLen value)
For POSTOFF delay, use IN_TR total time.
*/
function ClickPower() {
  // Debounce
  if (ClickPower._debounced) {
    return;
  }
  ClickPower._debounced = true;
  setTimeout(() => { ClickPower._debounced = false; }, 400);
  console.log("POWER");
  stopAllLoops(200, true);  // Power button used: clear lockup state

  STATE_LOCKUP=0;
  updateLockupDropdown();

  if (!STATE_ON && !STATE_WAIT_FOR_ON) {
    STATE_WAIT_FOR_ON = true;
    const preonBuffers = pickLoopBuffers('preon');
    let ignitionDelay = 0;
    if (preonBuffers.length) {
      blade.addEffect(EFFECT_PREON, 0.0);
      let idx = lastPlayedSoundIndex['preon'];
      if (typeof idx !== 'number' || idx >= preonBuffers.length) idx = 0;
      ignitionDelay = Math.round(preonBuffers[idx].duration * 1000);
      console.log(`Delaying ignition by ${ignitionDelay} ms (preon.wav length)`);
    }

    // Store ignition timer for possible cancellation
    if (ClickPower._pendingIgnite) clearTimeout(ClickPower._pendingIgnite);
    ClickPower._pendingIgnite = setTimeout(() => {
      STATE_WAIT_FOR_ON = false;
      STATE_ON = true;
      // Ignite and start hum
      requestAnimationFrame(updateSmoothSwingGains)
      blade.addEffect(EFFECT_IGNITION, Math.random() * 0.7 + 0.2);
      setTimeout(() => {
        // Only start hum if still powered on!
        if (outerMostBracket) {
          startHum();
        } else {
          console.log('[ClickPower] Not focused full. not starting hum.');
        }
      }, 200);  // pseudo ProffieOSHumDelay hardcoded

      ClickPower._pendingIgnite = null;
    }, ignitionDelay);

    power_button.classList.toggle("button-latched", true);

  } else if (STATE_WAIT_FOR_ON) {
    // User turned OFF during preon: cancel ignition!
    if (ClickPower._pendingIgnite) {
      clearTimeout(ClickPower._pendingIgnite);
      ClickPower._pendingIgnite = null;
    }
    STATE_WAIT_FOR_ON = false;
    STATE_ON = false;
    power_button.classList.toggle("button-latched", false);
    console.log('[ClickPower().STATE_WAIT_FOR_ON] Power turned off during preon. Just returning to OFF state.');
    return;
  } else {
    STATE_ON = 0;
    power_button.classList.toggle("button-latched", false);
    blade.addEffect(EFFECT_RETRACTION, Math.random() * 0.7 + 0.2);
    stopAllLoops(200, true);  // Power button used: clear lockup state
    let styleDelay = 0;

    if (Array.isArray(current_style.LAYERS)) {
      const inout = current_style.LAYERS.find(
        l => l.constructor?.name === 'InOutTrLClass'
      );
      if (inout?.IN_TR) {
        // Recursively sum up all transition durations.
        const getDur = n => {
          if (n.constructor && n.constructor.name === 'WavLenClass') {
            return Number(n.getInteger(0));
          }
          if (n.MILLIS) {
            return Number(n.MILLIS.getInteger(0));
          }
          if (n.args) {
            if (!Array.isArray(n.args)) {
              console.warn('getDur: Non-array args:', n, 'n.args:', n.args);
            }
            // Convert to array and reduce, always
            return [...n.args].reduce((sum, a) => sum + getDur(a), 0);
          }
          return 0;
        };
        styleDelay = getDur(inout.IN_TR);
      }
    }
    const postoffBuffers = pickLoopBuffers('pstoff');
    if (postoffBuffers.length) {
      console.log(`Scheduling POSTOFF in ${styleDelay} ms`);
      setTimeout(() => { blade.addEffect(EFFECT_POSTOFF, 0.0); }, styleDelay);
    }
  }
}

var lockups_to_event = {};
lockups_to_event[LOCKUP_NORMAL]          = [ EFFECT_LOCKUP_BEGIN, EFFECT_LOCKUP_END ];
lockups_to_event[LOCKUP_DRAG]            = [ EFFECT_DRAG_BEGIN, EFFECT_DRAG_END ];
lockups_to_event[LOCKUP_MELT]            = [EFFECT_MELT_BEGIN, EFFECT_MELT_END];
lockups_to_event[LOCKUP_LIGHTNING_BLOCK] = [EFFECT_LB_BEGIN, EFFECT_LB_END];
lockups_to_event[LOCKUP_AUTOFIRE]        = [EFFECT_AUTOFIRE_BEGIN, EFFECT_AUTOFIRE_END];

// Reverse mapping bgn->lockup
function lockupTypeForEffect(effect) {
  for (const lockupType in lockups_to_event) {
    if (lockups_to_event[lockupType][0] === effect) {
      return Number(lockupType);  // make sure it’s a number
    }
  }
  return undefined;
}

function OnLockupChange() {
  console.log("OnLockupChange");
  var select = FIND("LOCKUP");
  var old = STATE_LOCKUP;
  STATE_LOCKUP = window[select.value];
  currentLockupType = STATE_LOCKUP;

  // If choosing a lockup that’s NOT allowed, bail and reset
  if (STATE_LOCKUP !== LOCKUP_NONE && !getAllowedLockups().has(STATE_LOCKUP)) {
    console.log("No", lockupNameFromValue(STATE_LOCKUP), "in the blade style, resetting dropdown.");
    STATE_LOCKUP = LOCKUP_NONE;
    currentLockupType = null;
    select.value = "LOCKUP_NONE";
    updateLockupDropdown();
    return;
  }
  updateLockupDropdown();
  // Trigger bgnlock
  if (STATE_LOCKUP && lockups_to_event[STATE_LOCKUP]) {
    blade.addEffect(lockups_to_event[STATE_LOCKUP][0], Math.random() * 0.7 + 0.2);
  // "Stop" chosen, trigger endlock
  } else if (old && lockups_to_event[old]) {
    blade.addEffect(lockups_to_event[old][1], Math.random() * 0.7 + 0.2);
  }
}

function updateLockupDropdown() {
  const lockupSelect = FIND("LOCKUP");
  lockupSelect.innerHTML = "";

// Silently stop loop if no lockup is selected
if ((!STATE_LOCKUP || STATE_LOCKUP === LOCKUP_NONE) && lockupLoopSrc) {
  lockupLoopSrc.stop();
  lockupLoopSrc.disconnect();
  lockupLoopSrc = null;
  if (lockupGainNode) {
    lockupGainNode.disconnect();
    lockupGainNode = null;
  }
  currentLockupType = null;
}
  // Map value to display label
  const lockupLabels = {
    [LOCKUP_NORMAL]: "Lockup",
    [LOCKUP_DRAG]: "Drag",
    [LOCKUP_MELT]: "Melt",
    [LOCKUP_LIGHTNING_BLOCK]: "LB",
    [LOCKUP_AUTOFIRE]: "Autofire"
    // Add more here if needed
  };

  if (!STATE_LOCKUP || STATE_LOCKUP === LOCKUP_NONE) {
    lockupSelect.appendChild(new Option("Choose Lockup", "LOCKUP_NONE"));
    const lockupTypeNames = {
      [LOCKUP_NORMAL]: "LOCKUP_NORMAL",
      [LOCKUP_DRAG]: "LOCKUP_DRAG",
      [LOCKUP_MELT]: "LOCKUP_MELT",
      [LOCKUP_LIGHTNING_BLOCK]: "LOCKUP_LIGHTNING_BLOCK",
      [LOCKUP_AUTOFIRE]: "LOCKUP_AUTOFIRE"
    };

    let optionsAdded = 0;
    for (const lockupType of [LOCKUP_NORMAL, LOCKUP_DRAG, LOCKUP_MELT, LOCKUP_LIGHTNING_BLOCK, LOCKUP_AUTOFIRE]) {
      // If at top-level, show ALL lockups.
      // If focused in, show ONLY the selected lockup.
      if (getAllowedLockups().has(lockupType)) {
      // if (outerMostBracket || getAllowedLockups().has(lockupType)) {
        lockupSelect.appendChild(new Option(
          lockupLabels[lockupType],
          lockupTypeNames[lockupType]
        ));
      }
    }
    lockupSelect.value = "LOCKUP_NONE";
//   } else {
//     const stopOption = new Option("Stop", "LOCKUP_NONE");
//     lockupSelect.appendChild(stopOption);
//     lockupSelect.value = "LOCKUP_NONE";
//     lockupSelect.options[0].text = "\u00A0\u00A0\u00A0\u00A0End Lockup \u00A0";
//     lockupSelect.appendChild(new Option("\u00A0\u00A0\u00A0\u00A0Stop", "LOCKUP_NONE"));
//   }
// }
  } else {
    const currentLabel =
      (lockupLabels && STATE_LOCKUP in lockupLabels && lockupLabels[STATE_LOCKUP]) ? lockupLabels[STATE_LOCKUP] : "Lockup";
    const endText = `\u00A0\u00A0\u00A0\u00A0End ${currentLabel} \u00A0`;

    const stopOption = new Option(endText, "LOCKUP_NONE");
    lockupSelect.appendChild(stopOption);
    lockupSelect.value = "LOCKUP_NONE";

    // Ensure the first option reflects the dynamic label even if options are reordered
    lockupSelect.options[0].text = endText;

    // If you want a second “Stop” entry, make it reflect the same dynamic label too
    lockupSelect.appendChild(new Option(endText, "LOCKUP_NONE"));
  }
}
//////////// BC ///////////

function ClickLockup() {
  STATE_LOCKUP = STATE_LOCKUP == LOCKUP_NORMAL ? 0 : LOCKUP_NORMAL;
  blade.addEffect(STATE_LOCKUP ? EFFECT_LOCKUP_BEGIN : EFFECT_LOCKUP_END, Math.random() * 0.7 + 0.2);
}

function ClickDrag() {
  STATE_LOCKUP = STATE_LOCKUP == LOCKUP_DRAG ? 0 : LOCKUP_DRAG;
  blade.addEffect(STATE_LOCKUP ? EFFECT_DRAG_BEGIN : EFFECT_DRAG_END, 1.0);
}

function ClickLB() {
  STATE_LOCKUP = STATE_LOCKUP == LOCKUP_LIGHTNING_BLOCK ? 0 : LOCKUP_LIGHTNING_BLOCK;
}

function ClickMelt() {
  STATE_LOCKUP = STATE_LOCKUP == LOCKUP_MELT ? 0 : LOCKUP_MELT;
}

/* Save blade style to local storage via user OS dialog */
function ClickSave() {
  Copy();
  let textArea = FIND("style");
  let content = "/*\nSaved from ProffieOS Style Editor - NoSloppy edition:\nhttps://nosloppy.github.io/ProffieOS-StyleEditor-1\n*/" + "\n\n" + textArea.value;
  var a = document.createElement("a");
  var file = new Blob([content], {type: "text/plain"});
  a.href = URL.createObjectURL(file);
  a.download = "blade-style.txt";
  a.click();
}

var num_alternatives = 1000;

function Alt() {
  return parseInt(FIND("ALT_VALUE").value);
}
//////////// SafeguardInputs PR ///////////////
function updateAltValue(newValue) {
  if (newValue > num_alternatives) {
    newValue = num_alternatives;
  }
  FIND("ALT_VALUE").value = newValue;
  console.log("Updated Alt: " + newValue);
}

function IncreaseAlt(n) {
  var v = Alt() + n;
  if (v < 0) v += num_alternatives;
  if (v > num_alternatives) v -= num_alternatives;
  FIND("ALT_VALUE").value = v;
  console.log("Updated Alt: " + v)
}

function Variant() {
 return parseInt(FIND("VARIANT_VALUE").value);
}

/* Variant Slider functions */

function updateVariantValue(newValue) {
  // Ensure values are in range, and auto-filled zeros get registered as 0.
  if (newValue < 0) {
    newValue = 0;
  } else if (newValue > 32768) {
    newValue = 32768;
  }
  FIND("VARIANT_VALUE").value = newValue;
  FIND("VARIANT_SLIDER").value = newValue;
  console.log("Updated Variant: " + newValue);
}

var timeoutId, intervalId;

// Single click arrow to adjust by 1, hold to accelerate.
function startAdjustingValue(adjustment, inputId) {
  adjustmentValue(adjustment, inputId);
  var speed = 100;
  clearTimeout(timeoutId);
  timeoutId = setTimeout(function() {
    var startTime = new Date().getTime();
    intervalId = setInterval(function() {
      var elapsedTime = new Date().getTime() - startTime;
      var progress = elapsedTime / speed;
      var ease = Math.pow(progress, 2);
      var value = Math.round(adjustment * ease);
      adjustmentValue(value, inputId);
    }, 1000 / 60); // 60 FPS for more responsive input.
  }, 500); // delay until hold down button acceleration starts.
}

function adjustmentValue(adjustment, inputId) {
  var variantInput = FIND(inputId);
  var newValue = parseInt(variantInput.value) + adjustment;
  variantInput.value = newValue;
  updateVariantValue(newValue);
}

// Release or mouse leave arrow button
function stopAdjustingValue() {
  clearInterval(intervalId);
  clearTimeout(timeoutId);
}
/* End Variant Slider functions */

function Copy() {
  if (current_style.getType() != "COLOR") {
    FIND("error_message").innerHTML = "Not a complete style.";
    return;
  }

  // Enforce top-level layering rules at copy time
  if (!style_base_check(current_style, "error_message", true)) {
    return;
  }

  var copyText = FIND("style");
  var argStr = '"' + ARGUMENTS.slice(3).join(" ") + '"';
  if (argStr == '""') argStr = "";
  if(copyText.value.includes("StylePtr") ||
     copyText.value.includes("StyleNormalPtr") ||
     copyText.value.includes("StyleFirePtr") ||
     copyText.value.includes("StyleRainbowPtr"))
  {
    if(!copyText.value.endsWith(")"))
      copyText.value = copyText.value + "("+ argStr +")";
  } else {
    copyText.value = "StylePtr<" + copyText.value + ">" + "("+ argStr  +")";
  }
  copyText.select();
  document.execCommand("copy");
  // alert("Copy to Clipboard" + copyText.value);
  // myAlertTop("Copy to Clipboard");
}

function DoExpand() {
  if (current_style && current_style.expansion) {
    pp_is_url++;
    var url = current_style.expansion.pp();
    pp_is_url--;
    SetTo(url);
  }
}

function ShouldJoin(layer1, layer2) {
  if (layer1.LAYERS.length == 0) return true;
  if (layer2.LAYERS.length == 0) return true;
  return layer1.LAYERS[0].isEffect() == layer2.LAYERS[0].isEffect();
}

function RecursiveLayerize(node) {
  while (node.isMacro) {
    node = node.expansion;
  }
  if (node.constructor == LayersClass) {
    node.BASE = RecursiveLayerize(node.BASE);
    while (node.BASE.constructor == LayersClass && ShouldJoin(node, node.BASE)) {
      node = new LayersClass([node.BASE.BASE].concat(node.BASE.LAYERS,node.LAYERS));
    }
  }
  return node;
}

function CanLayerize(node) {
  if (!node) return false;
  if (node.constructor == LayersClass) return false;
  while (node.isMacro) {
    node = node.expansion;
  }
  return node.constructor == LayersClass;
}

function DoLayerize() {
  var tmp = RecursiveLayerize(current_style);
  pp_is_url++;
  tmp = tmp.pp();
  pp_is_url--;
  SetTo(tmp);
}

function DoArgify() {
  state = {}
  // Only do this if at top level...
  state.color_argument = BASE_COLOR_ARG;
  var tmp = current_style.argify(state);
  pp_is_url++;
  tmp = tmp.pp();
  pp_is_url--;
  SetTo(tmp);
}

////////////////  TAB MANIA PR /////////////////
// Tab mania.
const allTabs = ["color", "rgb", "layer", "function", "transition", "effect", "lockup_type", "arguments", "example"];  // don't include History or argString
// The "color group" are the 3 tabs that contain valid replacements for a COLOR.
const colorGroup = ["color", "rgb", "layer"];
var wasTabClicked = false;
var allTabsEnabled = true;
var currentTab;

function AddTab(tab, name, contents) {
  FIND("TABLINKS").innerHTML += "<button id=" + tab + "_tab class=tablinks onclick=\"TabClicked('"+tab+"');\">" + name + "</button>";
  FIND("TABBODIES").innerHTML += "<div id=" + tab + "_tabcontent class='tabcontent " + tab + "-tabcontent'></div>";
  if (contents) {
    AddTabContent(tab, contents);
  }
}

function TabClicked(tab) {
  ActivateTab(tab, false);
}

function AddTabContent(tab, data) {
  FIND(tab + "_tabcontent").innerHTML += data;
}

function SetTabContent(tab, data) {
  FIND(tab + "_tabcontent").innerHTML = data;
}

function sortByName() {
  // Extract name from HTML string
  colorData.sort((a, b) => {
    const nameA = a.match(/value='(.*?)'/)[1];
    const nameB = b.match(/value='(.*?)'/)[1];
    return nameA.localeCompare(nameB);
  });
  return colorData;
}

function updateRgbTabContent() {
  let sortedRgbLinks;
  if (colorSortState.get()) {
    console.log("Sort colors by Name");
    sortedRgbLinks = sortByName();
  } else {
    console.log("Sort colors by Hue");
    sortedRgbLinks = colorData.sort();
  }

  SetTabContent("rgb", sortedRgbLinks.join("") +
    "<div class='custom-color'>" +
    "<label for='COLOR'>Custom color </label>" +
    "<input type='color' id='COLOR' value='#ff0000' class='color-picker' onclick='ClickColor()' /></div>");
}

var tablinks = document.getElementsByClassName("tablinks");

function enableTabs() {
  for (var i = 0; i < tablinks.length; i++) {
    tablinks[i].classList.remove("disabled");
    tablinks[i].disabled = false;
  }
  allTabsEnabled = true;
}

// Enable all tabs on page load - needs time to let tabs load
window.addEventListener("load", function () {
  setTimeout(function () {
    enableTabs();
  }, 0);
});

// Have non-applicable tabs be disabled, similar to how History works.
function ActivateTab(tab, fromStructuredView = false) {
  if (!FIND(tab + "_tab")) {
    console.log("No such tab");
    return;
  }
  // Get all elements with class="tabcontent" and hide them
  const tabcontent = document.querySelectorAll('.tabcontent');
  tabcontent.forEach(tc => tc.style.display = "none");

  // Get all elements with class="tablinks" and make available.
  const tablinks = document.querySelectorAll('.tablinks');
  tablinks.forEach(btn => {
    btn.className = btn.className.replace(" active", "").replace(" disabled", "");
    btn.disabled = false;
  });

  // Show current tab & set active
  FIND(tab + "_tabcontent").style.display = "block";
  const activeTab = FIND(tab + "_tab");
  activeTab.classList.add("active");

  // If clicking already-active tab (user), unlock all
  if (activeTab.classList.contains("active") && !fromStructuredView) {
    enableTabs();
    return;
  }

  // Figure out which tabs should be enabled:
  let validTabs;
  if (colorGroup.includes(tab)) {
    validTabs = colorGroup.concat("history", "arg_string");
  } else {
    validTabs = [tab, "history", "arg_string"];
  }

  // Disable everything except valid tabs
  tablinks.forEach(btn => {
    const btnTab = btn.id.replace("_tab", "");
    if (!validTabs.includes(btnTab)) {
      btn.classList.add("disabled");
      btn.disabled = true;
    }
  });
}
////////////////  TAB MANIA PR /////////////////

////////////// Recent EFFECTS PR ///////////
const menu = FIND('more_effects_menu');
const do_selected_button = FIND('do_selected');
let recentEffects = [EFFECT_NONE];
const MAX_RECENTS = 5;

// Get the menu and button elements
function rebuildMoreEffectsMenu() {
  const currentValue = typeof selectedValue !== 'undefined'
    ? selectedValue
    : menu.value;
  menu.innerHTML = '';
  // Only show placeholder if nothing is currently selected
  if (!currentValue || currentValue === '') {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select More Effects';
    placeholder.disabled = false;
    placeholder.selected = true;
    menu.appendChild(placeholder);
  }

  // Add sub-groups for the different categories of effects
  const recentEffectsMenu  = document.createElement('optgroup');
  recentEffectsMenu.label  = 'Recent Effects';
  const generalEffectsMenu = document.createElement('optgroup');
  generalEffectsMenu.label = 'Saber / General Effects';
  const userEffectsMenu    = document.createElement('optgroup');
  userEffectsMenu.label    = 'User Effects';
  const blasterEffectsMenu = document.createElement('optgroup');
  blasterEffectsMenu.label = 'Blaster Effects';
  const gameEffectsMenu    = document.createElement('optgroup');
  gameEffectsMenu.label    = 'Game Effects';
  const errorMessagesMenu  = document.createElement('optgroup');
  errorMessagesMenu.label  = 'Error Messages';

  // Add recent effects to the recentEffectsMenu optgroup
  // Always add Recents at the top (even if only EFFECT_NONE)
  recentEffects.forEach(type => {
    const name = EFFECT_ENUM_BUILDER.value_to_name[type] || `EFFECT_${type}`;
    const nameWithoutEffect = name.replace(/^EFFECT_/, '');
    const option = document.createElement('option');
    option.value = type;
    option.text = nameWithoutEffect;
    recentEffectsMenu.appendChild(option);
  });

  // List of EFFECTs to hide from dropdown (pseudo/future events)
  // const hiddenEffects = [
  //   "EFFECT_MELT_BEGIN",
  //   "EFFECT_MELT_END",
  //   "EFFECT_LB_BEGIN",
  //   "EFFECT_LB_END",
  //   "EFFECT_AUTOFIRE_BEGIN",
  //   "EFFECT_AUTOFIRE_END"
  // ];

  /* Add values from the enum builder to an array and sort alphabetically,
  excluding effects with dedicated buttons.*/
  const values = Object.entries(EFFECT_ENUM_BUILDER.value_to_name)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .filter(([value]) => ![
      EFFECT_CLASH,
      EFFECT_STAB,
      EFFECT_BLAST,
      EFFECT_FORCE,
      EFFECT_ACCENT_SWING,
    ].includes(Number(value)));

  // Add sorted values to the menu and actions dictionary,
  for (const [value, name] of values) {
    if (Number(value) === EFFECT_NONE) continue;
    const nameWithoutEffect = name.replace(/^EFFECT_/, '');
    const option = document.createElement('option');
    option.value = value;
    option.text = nameWithoutEffect;

    // Check if the effect belongs to a certain category and add it to the corresponding sub-group
    if (name.startsWith('EFFECT_GAME')) {
      gameEffectsMenu.appendChild(option);
    } else if (name.startsWith('EFFECT_USER')) {
      userEffectsMenu.appendChild(option);
    } else {
      switch (Number(value)) {
        case EFFECT_BOOM:
        case EFFECT_STUN:
        case EFFECT_FIRE:
        case EFFECT_CLIP_IN:
        case EFFECT_CLIP_OUT:
////////// Add DESTRUCT PR /////////////////
        case EFFECT_DESTRUCT:
        case EFFECT_RELOAD:
        case EFFECT_MODE:
        case EFFECT_RANGE:
        case EFFECT_EMPTY:
        case EFFECT_FULL:
        case EFFECT_JAM:
        case EFFECT_UNJAM:
        case EFFECT_PLI_ON:
        case EFFECT_PLI_OFF:
        case EFFECT_AUTOFIRE_BEGIN:
        case EFFECT_AUTOFIRE_END:
          blasterEffectsMenu.appendChild(option);
          break;
        case EFFECT_ERROR_IN_BLADE_ARRAY:
        case EFFECT_ERROR_IN_FONT_DIRECTORY:
        case EFFECT_FONT_DIRECTORY_NOT_FOUND:
        case EFFECT_SD_CARD_NOT_FOUND:
        case EFFECT_LOW_BATTERY:
          errorMessagesMenu.appendChild(option);
          break;
        default:
          generalEffectsMenu.appendChild(option);
          break;
      }
    }
  }

  // Add the sub-groups to the main menu
  menu.appendChild(recentEffectsMenu);
  menu.appendChild(generalEffectsMenu);
  menu.appendChild(userEffectsMenu);
  menu.appendChild(blasterEffectsMenu);
  menu.appendChild(gameEffectsMenu);
  menu.appendChild(errorMessagesMenu);

  // After populating options, set initial button state based on selection
  // If the selected value is not the default, enable the button and set its action
  updateDoSelectedButtonState(menu, do_selected_button);
}

// What to do when preview saber area is clicked
function AddClickedEffect() {
  const raw = menu.value;
  const type = Number(raw);
  const effectName = EFFECT_SOUND_MAP[type] || raw;

  // Update recents
  if (type && !recentEffects.includes(type)) {
    recentEffects.unshift(type);
    if (recentEffects.length > MAX_RECENTS) recentEffects.length = MAX_RECENTS;
  } else if (type) {
    // Move to top if already in the list
    recentEffects = [type, ...recentEffects.filter(t => t !== type)];
  }

  rebuildMoreEffectsMenu();  
  if (do_selected_button.disabled) {
    AddClash();
  } else {
    blade.addEffect(type, 0.0,);
  }
}

function updateDoSelectedButtonState(menu, button) {
  if (menu.value !== "") {
    button.disabled = false;
    button.className = "button-on";
    button.onclick   = AddClickedEffect;
  } else {
    button.disabled = true;
    button.onclick   = null;
    button.className = "button-off";
  }
}

menu.addEventListener('change', function() {
  updateDoSelectedButtonState(menu, do_selected_button);
});
////////////// Recent EFFECTS PR ///////////

//////////// SafeguardInputs PR ///////////////
const settingsPanel  = FIND('settings_panel');
const settingsButton = FIND('SETTINGS_BUTTON');

function toggleSettingsPanel() {
  if (document.querySelector('input.invalid')) {
    console.log('*** INVALID INPUT - Not closing panel.');
    return;
  }
  settingsPanel.classList.toggle('show');
}

// Click outside to close Settings Panel
document.body.addEventListener('click', function(e) {
  if (document.querySelector('input.invalid')) {
    console.log('*** INVALID INPUT - Not closing panel.');
    return;
  }
  if (settingsPanel.classList.contains('show') &&
      !settingsPanel.contains(e.target) &&
      e.target !== settingsButton) {
    settingsPanel.classList.remove('show');
  }
});
//////////// SafeguardInputs PR ///////////////

// Call the onPageLoad function when the page is loaded
window.addEventListener('DOMContentLoaded', onPageLoad);

var all_saved_states = [];
var state_by_checkbox = new Map();
var state_by_select = new Map();
var body = document.querySelector("body");
var structuredView;
//////////////// WAVLEN PR /////////////////
var wavlenInput = FIND("WAVLEN_VALUE");
var myWavLen;

/* Settings buttons saved as local storage */
function getSavedState(buttonState, defaultValue) {
  var value = localStorage.getItem(buttonState);
  console.log("Retrieved SavedState for " + buttonState + ": " + value);
  return (value === null ? defaultValue : value);
}

function saveState(buttonState, settingIsOn) {
  localStorage.setItem(buttonState, settingIsOn);
}

class SavedState {
  constructor(name, def, update_function) {
    this.name = name;
    this.def = def;
    this.update_function = update_function;
    all_saved_states.push(this);
  }
  onload() {
    this.set(getSavedState(this.name + "_Save", this.def));
  }
  get() { return this.value; }
}

class SavedStateBool extends SavedState {
  constructor(name, def, update_function) {
    super(name, def, update_function);
    // For checkboxes, store the mapping for use in handleSettings().
    const checkbox = FIND(name.toUpperCase() + "_BUTTON");
    state_by_checkbox.set(checkbox, this);
  }
  set(value) {
    const boolValue = (value === true || value === "true");
    const prev = this.value;
    this.value = boolValue;
    FIND(this.name.toUpperCase() + "_BUTTON").checked = boolValue;
    saveState(this.name + "_Save", boolValue);
    this.update_function(boolValue);
  }
}

class SavedStateNumber extends SavedState {
  constructor(name, def, update_function) {
    super(name, def, update_function);
    // For select and range input elements, store the mapping for use in handleSettings().
    const input = FIND(name.toUpperCase() + "_VALUE");
    if (input && (input.tagName === 'SELECT' || input.type === 'range')) {
      state_by_select.set(input, this);
    }
  }
  set(value) {
    this.value = value;
    // FIND(this.name.toUpperCase() + "_VALUE").value = value;
    const input = FIND(this.name.toUpperCase() + "_VALUE");
    if (input) {
      input.value = value;
    }
    saveState(this.name + "_Save", value);
    this.update_function(value);
  }
}
//////////////// WAVLEN PR /////////////////

var darkState = new SavedStateBool("dark", true, (on) => {
  body.classList.toggle("dark-mode", on);
  structuredView.classList.toggle("dark-mode", on);
});

var tipsState = new SavedStateBool("tips", true, (on) => {
 if (on) {
    const elementsWithDataTitles = document.querySelectorAll("[data-title]");
    elementsWithDataTitles.forEach((element) => {
      element.setAttribute("title", element.dataset.title);
      element.removeAttribute("data-title");
    });
  } else {
    const elementsWithTitles = document.querySelectorAll("[title]");
    elementsWithTitles.forEach((element) => {
      element.dataset.title = element.getAttribute("title");
      element.removeAttribute("title");
    });
  }
});
var colorSortState = new SavedStateBool("color_sort", false, (on) => {
  updateRgbTabContent();
});
var backgroundState = new SavedStateBool("background", true, (on) => {
  window.showBackground = on;
  if (window.bgPlane) window.bgPlane.visible = !!on;
});
var mouseSwingsState = new SavedStateBool("mouse_swings", false, (on) => {});
var bladeTrailsState = new SavedStateBool("blade_trails", true, (on) => { window.showBladeTrails = on; });
var autoswingState = new SavedStateBool("autoswing", true, (on) => {});
var inhiltState = new SavedStateBool("inhilt", false, (on) => { STATE_NUM_LEDS = on ? 1 : 144; });
// var slowState = new SavedStateBool("slow", false, (on) => { framesPerUpdate = on ? 10 : 0; time_factor = framesPerUpdate == 0 ? 1000 : (500/framesPerUpdate)});

// Slow motion state: checkbox enables/disables, speed slider controls the speed (1-100%)
var slowState = new SavedStateBool("slow", false, (on) => { 
  const percentage = slowMotionSpeedState ? slowMotionSpeedState.get() : 50;
  time_factor = on ? (percentage * 10) : 1000;

  // Enable/disable the speed slider
  const speedSlider = FIND("SLOWMOTION_SPEED_VALUE");
  if (speedSlider) {
    speedSlider.disabled = !on;
  }
  // Update display text
  updateSlowMotionDisplay();
});

var slowMotionSpeedState = new SavedStateNumber("slowmotion_speed", 50, (percentage) => {
  if (slowState && slowState.get()) {
    time_factor = percentage * 10;
  }
  // Update display text
  updateSlowMotionDisplay();
});

// Update the percentage display text for slow motion slider
function updateSlowMotionDisplay() {
  const display = FIND("SLOWMOTION_SPEED_DISPLAY");
  if (display && slowMotionSpeedState) {
    display.textContent = slowMotionSpeedState.get() + "%";
  }
}


var benchmarkState = new SavedStateBool("benchmark", false, (on) => { AA=1; compile(); FIND("error_message").innerHTML = ""; });
//////////////// WAVLEN PR /////////////////
var wavlenState = new SavedStateNumber("wavlen", 500, (value) => {
  myWavLen.setLength(value);
});
wavlenInput.addEventListener("focusout", function(e) {
  ValidateInput(e);
  if (!e.target.classList.contains('invalid')) {
    wavlenState.set(Number(e.target.value));
  }
});

//////////////// SOUND2 PR /////////////////
var soundOnState = new SavedStateBool("sound", true, (on) => {
  const icon = FIND("sound-toggle-icon");
  if (on) {
    icon.classList.remove("fa-volume-off");
    icon.classList.add("fa-volume-high");
  } else {
    icon.classList.remove("fa-volume-high");
    icon.classList.add("fa-volume-off");
  }

  if (!on) {
    console.log('Sound turned OFF → stopping all loops');
    stopAllLoops(200, false);  // Sound off button used: do NOT clear lockup state
  } else {
    console.log('Sound turned ON → resuming loops');
    resumeLoops();
  }
});

var fontFallbackState = new SavedStateBool("font_fallback", false, (on) => {});
var useFontWavLenState = new SavedStateBool("use_font_wavlen", true, (on, prev) => {
  handleWavLenControls();
  if (on && !prev) wavlenState.set(500);
});
var pcbDedicatedState = new SavedStateBool("pcb_dedicated", false, (on) => { drawPCB(); });
var pcbShowLedNumbersState = new SavedStateBool("pcb_show_led_numbers", false, (on) => { drawPCB(); });
var pcbViewPlusBladeState = new SavedStateBool("pcb_view_plus_blade", false, (on) => {
  previewType.dispatchEvent(new Event('change'));
});

// Create n textures of about 1MB each.
function SetupRendering() {
  // Clear existing tab links and tab bodies before populating
  var tabLinksElement = FIND("TABLINKS");
  var tabBodiesElement = FIND("TABBODIES");
  tabLinksElement.innerHTML = "";
  tabBodiesElement.innerHTML = "";

  AddTab("color", "Styles",effect_links.sort().join(""))
  AddTab("rgb", "Colors", ""); updateRgbTabContent();
  AddTab("layer", "Layers", layer_links.sort().join(""));
  AddTab("function", "Functions", function_links.sort().join(""));
  AddTab("transition", "Transitions", transition_links.sort().join(""));
  AddTab("effect", "Effects");
  AddTab("lockup_type", "Lockup Types");
  AddTab("arguments", "Arguments");
  AddTab("example", "Examples", template_links.join(""));
  AddTab("history", "History");
  AddTab("arg_string", "ArgString");
  EFFECT_ENUM_BUILDER.addToTab("effect", "EFFECT_");
  LOCKUP_ENUM_BUILDER.addToTab("lockup_type", "LOCKUP_");
  ArgumentName_ENUM_BUILDER.addToTab("arguments", "");

  // Add arg string.
  var A = "";
  A += "Arg string: <input id=ARGSTR name=arg type=text size=80 value='builtin 0 1' onchange='ArgStringChanged()' /><br><table>";
  var v = Object.keys(ArgumentName_ENUM_BUILDER.value_to_name);
  for (var i = 0; i < v.length; i++) {
    var V = parseInt(v[i]);
    var N = ArgumentName_ENUM_BUILDER.value_to_name[V];
    A += "<tr><td>" + N + "</td><td>";
    if (N.search("COLOR") >= 0) {
      A += "<input type=color id=ARGSTR_"+N+" onclick='ClickArgColor("+N+")' onchange='ClickArgColor("+N+")' >";
    } else {
      A += "<input type=button value='<'  onclick='IncreaseArg("+N+",-1)' >";
      A += "<input id=ARGSTR_"+N+" type='text' size=6 value=0 class='nofocus' onchange='ArgChanged("+N+")' onfocusout='ValidateInput(event)' >";
      A += "<input type=button value='>'  onclick='IncreaseArg("+N+",1)' >";
    }
    A += "</td></tr>\n";
  }
  A += "</table\n";
  AddTabContent("arg_string", A);

//////////// Fullscreen PR ///////////
  window.renderer.setPixelRatio( window.devicePixelRatio || 1 );

  var str = new URL(window.location.href).searchParams.get("S");
  if (!str) {
// Liquid Static
    str = "Layers<StripesX<Sin<Int<12>,Int<3000>,Int<7000>>,Scale<SwingSpeed<100>,Int<75>,Int<125>>,StripesX<Sin<Int<10>,Int<1000>,Int<3000>>,Scale<SwingSpeed<100>,Int<75>,Int<100>>,Pulsing<Blue,Mix<Int<2570>,Black,Blue>,1200>,Mix<SwingSpeed<200>,Mix<Int<16000>,Black,Blue>,Black>>,Mix<Int<7710>,Black,Blue>,Pulsing<Mix<Int<6425>,Black,Blue>,StripesX<Sin<Int<10>,Int<2000>,Int<3000>>,Sin<Int<10>,Int<75>,Int<100>>,Blue,Mix<Int<12000>,Black,Blue>>,2000>,Pulsing<Mix<Int<16448>,Black,Blue>,Mix<Int<642>,Black,Blue>,3000>>,AlphaL<StaticFire<Blue,Mix<Int<256>,Black,Blue>,0,1,10,2000,2>,Int<10000>>,AlphaL<LightCyan,SmoothStep<Int<2000>,Int<-6000>>>,TransitionEffectL<TrConcat<TrInstant,HumpFlickerL<White,40>,TrFade<1200>>,EFFECT_IGNITION>,TransitionEffectL<TrConcat<TrFadeX<WavLen<EFFECT_RETRACTION>>,Stripes<3000,3500,Blue,RandomPerLEDFlicker<Mix<Int<7710>,Black,Blue>,Black>,BrownNoiseFlicker<Blue,Mix<Int<3855>,Black,Blue>,200>,RandomPerLEDFlicker<Mix<Int<3137>,Black,Blue>,Mix<Int<3855>,Black,Blue>>>,TrInstant>,EFFECT_RETRACTION>,EffectSequence<EFFECT_POWERSAVE,AlphaL<Black,Int<16384>>,AlphaL<Black,Int<0>>>,TransitionEffectL<TrConcat<TrInstant,GreenYellow,TrDelay<25>,AlphaL<TransitionEffect<BrownNoiseFlicker<Rgb<255,150,0>,Black,50>,White,TrInstant,TrFade<300>,EFFECT_CLASH>,Bump<Scale<BladeAngle<>,Int<25000>,Int<8000>>,Int<18000>>>,TrFade<600>>,EFFECT_CLASH>,TransitionEffectL<TrConcat<TrInstant,GreenYellow,TrDelay<25>,AlphaL<Black,Int<0>>,TrWipeIn<300>,AlphaL<Stripes<5000,1000,Orange,DarkOrange,Rgb<150,60,0>,Rgb<60,30,0>,Rgb<150,14,0>,OrangeRed>,SmoothStep<Int<20000>,Int<20000>>>,TrJoin<TrSmoothFade<900>,TrWipe<700>>>,EFFECT_STAB>,TransitionEffectL<TrConcat<TrInstant,GreenYellow,TrDelay<25>>,EFFECT_BLAST>,BlastL<White,850,250,351>,AlphaL<TransitionEffectL<TrConcat<TrFade<300>,Rgb<255,70,70>,TrFade<300>>,EFFECT_BLAST>,BlastF<700,250,100000>>,BlastL<White,300,350,100000>,TransitionEffectL<TrConcat<TrInstant,Strobe<GreenYellow,Black,20,30>,TrFade<200>,BrownNoiseFlickerL<AlphaL<White,Int<16000>>,Int<5000>>,TrJoinR<TrWipe<200>,TrWipeIn<200>,TrFade<300>>>,EFFECT_LOCKUP_END>,LockupTrL<Layers<AlphaL<TransitionLoopL<TrConcat<TrDelayX<Scale<SlowNoise<Int<3000>>,Int<30>,Int<800>>>,Mix<SlowNoise<Int<1000>>,Black,Black,White,Black>,TrDelayX<Scale<SlowNoise<Int<1000>>,Int<10>,Int<50>>>>>,Int<32768>>,AlphaL<Blinking<Tomato,Strobe<Yellow,Black,15,30>,60,500>,Bump<Scale<BladeAngle<5000,28000>,Scale<BladeAngle<8000,16000>,Int<3000>,Int<44000>>,Int<3000>>,Scale<SlowNoise<Int<3000>>,Int<8000>,Int<18000>>>>,AlphaL<Blinking<BrownNoiseFlicker<White,Black,50>,BrownNoiseFlicker<Yellow,Tomato,50>,100,500>,Bump<Scale<BladeAngle<5000,28000>,Scale<BladeAngle<8000,16000>,Int<3000>,Int<44000>>,Int<3000>>,Int<9000>>>>,TrConcat<TrInstant,AlphaL<Blinking<White,Strobe<BrownNoiseFlicker<Yellow,Black,500>,Black,15,30>,60,500>,Bump<Scale<BladeAngle<5000,28000>,Scale<BladeAngle<8000,16000>,Int<3000>,Int<44000>>,Int<3000>>,Scale<SlowNoise<Int<3000>>,Int<25000>,Int<32000>>>>,TrFade<500>>,TrSmoothFade<900>,SaberBase::LOCKUP_NORMAL>,TransitionEffectL<TrConcat<TrInstant,AlphaL<Strobe<GreenYellow,Black,20,30>,Bump<Scale<BladeAngle<5000,28000>,Scale<BladeAngle<8000,16000>,Int<3000>,Int<44000>>,Int<3000>>,Int<15000>>>,TrFade<600>>,EFFECT_LOCKUP_BEGIN>,TransitionEffectL<TrConcat<TrInstant,GreenYellow,TrDelay<25>,HumpFlickerL<Strobe<AlphaL<White,Int<20000>>,Black,20,30>,30>,TrSmoothFade<225>>,EFFECT_LOCKUP_BEGIN>,LockupTrL<AlphaL<AudioFlicker<BrownNoiseFlicker<Strobe<Black,OrangeRed,20,25>,Yellow,200>,White>,SmoothStep<Int<30000>,Int<2000>>>,TrConcat<TrInstant,GreenYellow,TrDelay<25>,AlphaL<Black,Int<0>>,TrFade<150>>,TrColorCycle<1500,-2000,100>,SaberBase::LOCKUP_DRAG>,LockupTrL<Layers<AlphaL<Black,Int<16000>>,AlphaL<White,StrobeF<Scale<SlowNoise<Int<1000>>,Int<1>,Int<6>>,Scale<SlowNoise<Int<1000>>,Int<10>,Int<50>>>>,AlphaL<RandomFlicker<Strobe<White,Rgb<83,0,255>,50,10>,BrownNoiseFlicker<Rgb<83,0,255>,Black,500>>,LayerFunctions<Bump<Scale<SlowNoise<Int<2000>>,Int<3000>,Int<16000>>,Scale<BrownNoiseF<Int<10>>,Int<14000>,Int<8000>>>,Bump<Scale<SlowNoise<Int<2300>>,Int<26000>,Int<8000>>,Scale<NoisySoundLevel,Int<5000>,Int<10000>>>,Bump<Scale<SlowNoise<Int<2300>>,Int<20000>,Int<30000>>,Scale<IsLessThan<SlowNoise<Int<1500>>,Int<8000>>,Scale<NoisySoundLevel,Int<5000>,Int<0>>,Int<0>>>>>>,TrConcat<TrInstant,GreenYellow,TrDelay<25>,BrownNoiseFlicker<Rgb<83,0,255>,Black,500>,TrFade<100>>,TrConcat<TrInstant,GreenYellow,TrDelay<25>,BrownNoiseFlicker<Rgb<83,0,255>,Black,500>,TrFade<150>,BrownNoiseFlickerL<AlphaL<White,Int<16000>>,Int<50>>,TrJoinR<TrWipe<200>,TrWipeIn<200>,TrFade<400>> >,SaberBase::LOCKUP_LIGHTNING_BLOCK>,LockupTrL<AlphaL<Remap<Scale<RampF,Int<65536>,Int<0>>,StaticFire<Mix<TwistAngle<>,Rgb16<20393,93,93>,DarkOrange>,Mix<TwistAngle<>,Rgb16<20393,93,93>,Orange>,0,4,5,4000,10>>,SmoothStep<Scale<TwistAngle<>,Int<24000>,Int<29000>>,Int<4000>>>,TrConcat<TrInstant,GreenYellow,TrDelay<25>,AlphaL<Black,Int<0>>,TrWipeIn<600>,AlphaL<Red,SmoothStep<Scale<TwistAngle<>,Int<24000>,Int<29000>>,Int<2000>>>,TrExtend<3000,TrFade<300>>,AlphaL<Mix<TwistAngle<>,Red,Orange>,SmoothStep<Scale<TwistAngle<>,Int<24000>,Int<29000>>,Int<2000>>>,TrFade<3000>>,TrColorCycle<1500,-2000>,SaberBase::LOCKUP_MELT>,InOutTrL<TrWipeSparkTip<White,300>,TrWipeInSparkTipX<LightCyan,WavLen<EFFECT_RETRACTION>,Int<401>>>,TransitionEffectL<TrConcat<TrInstant,AlphaL<BrownNoiseFlickerL<White,Int<30>>,SmoothStep<Scale<SlowNoise<Int<2000>>,Int<2000>,Sum<Int<2000>,Int<4000>>>,Int<-2000>>>,TrDelayX<WavLen<EFFECT_PREON>>>,EFFECT_PREON>,TransitionEffectL<TrConcat<TrInstant,AlphaL<BrownNoiseFlickerL<White,Int<30>>,SmoothStep<Scale<SlowNoise<Int<2000>>,Int<2000>,Sum<Int<2000>,Int<3000>>>,Int<-4000>>>,TrDelayX<WavLen<EFFECT_POSTOFF>>>,EFFECT_POSTOFF>>";
  }
  FIND("style").value = str;

  Run();
  DoLayerize();
  resizeCanvasAndCamera();
//////////// Fullscreen PR ///////////

  // Start the event loop.
  tick();
}

function togglePixelRingCount() {
  const sel = FIND('pixelRingCount');
  if (!sel || sel.dataset.inited === '1') return;
  sel.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.text = 'Number of LEDs';
  placeholder.disabled = true;
  placeholder.selected = true;
  sel.appendChild(placeholder);

  for (let i = 1; i <= 20; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text  = i;
    sel.appendChild(opt);
  }
  sel.dataset.inited = '1';
}


function onPageLoad() {
  SetupRendering();
  rebuildMoreEffectsMenu();
  structuredView = FIND("structured_view");
  all_saved_states.forEach(state => {
    state.onload();
  });

  // Welcome click for unlocking audio
  const startOverlay = FIND('start-overlay');
  startOverlay.style.display = 'flex';
  startOverlay.onclick = function () {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startOverlay.style.display = 'none';
  };
  previewType.dispatchEvent(new Event('change'));
  window.addEventListener('resize', resizeCanvasAndCamera);
}

// Preview type dropdown handler - show/hide blade preview
previewType.addEventListener('change', function() {
  var bladeCanvas = FIND('canvas_id');
  var ringCount   = FIND('pixelRingCount');

  if (this.value === 'blade') {
    bladeCanvas.hidden = false;
    pcbCanvas.hidden   = true;
    ringCount.hidden   = true;
  } else {
    bladeCanvas.hidden = (pcbViewPlusBladeState.get() ? false : true);
    pcbCanvas.hidden   = false;

    // Only show ringCount if "Pixel ring" is selected
    if (this.value === 'PCBg') {
      ringCount.hidden = false;
      togglePixelRingCount();
    } else {
      ringCount.hidden = true;
    }
    drawPCB();
  }
});

enlargeBtn.onclick = function() {
  window.enlargeCanvas = !window.enlargeCanvas;
  this.innerText = window.enlargeCanvas ? 'Reduce' : 'Enlarge';
  resizeCanvasAndCamera();
};

let restorePcbViewPlusBlade = null;
fullscreenBtn.onclick = function() {
  if (!document.fullscreenElement) {
    pageLeftTop.requestFullscreen();
    // If we're on a PCB and "keep blade with PCB" is ON, turn it OFF so fullscreen shows only PCB
    if (previewType.value !== 'blade' && pcbViewPlusBladeState.get()) {
      restorePcbViewPlusBlade = true;
      pcbViewPlusBladeState.set(false);
    } else {
      restorePcbViewPlusBlade = null;
    }
  } else {
    document.exitFullscreen();
  }
};

document.addEventListener("fullscreenchange", function() {
  const fs = !!document.fullscreenElement;
  window.fullscreenActive = fs;
  fullscreenBtn.innerText = fs ? "Exit Fullscreen" : "Fullscreen";
  if (!fs && restorePcbViewPlusBlade) {
    pcbViewPlusBladeState.set(true);
    restorePcbViewPlusBlade = null;
  }
  resizeCanvasAndCamera();
});

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.fullscreenElement) {
      document.exitFullscreen();
    }
  });


const pageLeft = document.querySelector('.page-left');
const splitter = FIND('splitter');

let isDragging = false;
let startX = 0;
let startWidth = 0;

splitter.addEventListener('mousedown', (e) => {
  isDragging = true;
  startX = e.clientX;
  // Always use the current width at drag start as the minimum
  startWidth = pageLeft.offsetWidth;
  document.body.style.cursor = 'ew-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  // At page load, .page-left is at the minimum width the user can ever shrink it to.
  if (!isDragging) return;
  let dx = e.clientX - startX;
  let newWidth = startWidth + dx;
  // Don't let it get crazy
  const max = window.innerWidth * 0.9;
  // limit to starting width, never smaller
  if (newWidth < startWidth) newWidth = startWidth;
  if (newWidth > max) newWidth = max;
  pageLeft.style.width = newWidth + 'px';
  // pageRight will auto-shrink due to flex
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = '';
  }
});

// function handleSettings(checkbox) {
//   var state = state_by_checkbox.get(checkbox);
//   state.set(!state.get());
// }
function handleSettings(element) {
  // Handle checkboxes
  if (element.type === 'checkbox') {
    var state = state_by_checkbox.get(element);
    state.set(!state.get());
  }
  // Handle select elements and range inputs (using mapping for better maintainability)
  else if (element.tagName === 'SELECT' || element.type === 'range') {
    const state = state_by_select.get(element);
    if (state) {
      state.set(parseInt(element.value));
    }
  }
}
// User can choose one or the other
function handleWavLenControls() {
  var wavlenLabel = document.querySelector('.wavlen-global-label');
  var wavlenInput = FIND('WAVLEN_VALUE');

  if (useFontWavLenState.get()) {
    wavlenLabel.classList.add('disabled');
    wavlenInput.disabled = true;
  } else {
    wavlenLabel.classList.remove('disabled');
    wavlenInput.disabled = false;
  }
}

function ClickRestore() {
  localStorage.clear();
  onPageLoad();
}
