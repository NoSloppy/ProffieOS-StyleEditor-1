var gl = null;
var shaderProgram = null;
var t = 0.0;

var width;
var height;
var dpr = window.devicePixelRatio || 1;
const canvas = document.getElementById("canvas_id"); 
var enlargeCanvas = false;

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

function default_move_matrix() {
  return Matrix.mktranslate(-0.023, 0.0, -0.12);
}

var MOVE_MATRIX = default_move_matrix();
var OLD_MOVE_MATRIX = default_move_matrix();
var MOUSE_POSITIONS = [];
var IN_FRAME = false;
var BLADE_ANGLE = 0.0;

function mouse_speed(t1, t2) {
  var dx = MOUSE_POSITIONS[t1+0]-MOUSE_POSITIONS[t2+0];
  var dy = MOUSE_POSITIONS[t1+1]-MOUSE_POSITIONS[t2+1];
  var dt = MOUSE_POSITIONS[t1+2]-MOUSE_POSITIONS[t2+2];
  if (dt == 0) return 0.0;
  return Math.sqrt(dx * dx + dy * dy) / Math.abs(dt);
}

function mouse_move(e) {
  if (mouseswingsState.get()) return;
  IN_FRAME = true;

  const canvas = FIND("canvas_id");
  const rect   = canvas.getBoundingClientRect();
  const w      = rect.right - rect.left;
  const h      = rect.bottom - rect.top;
  const d = Math.min(h, w);

  let x;
  if (document.fullscreenElement === pageLeftTop || enlargeCanvas) {
    x = (e.clientX - (rect.left + rect.right) / 2) / d * 2.2;  // Fullscreen/Enlarge 
  } else {
    x = (e.clientX - (rect.left + rect.right) / 2) / d * 1.8;  // Normal
  }

  let y;
  if (document.fullscreenElement === pageLeftTop) {
    y = (e.clientY - (rect.top + rect.bottom) / 2) / d * 0.75; // Fullscreen, slightly less.
  } else {  // y already accounted for for enlarge.
    y = (e.clientY - (rect.top + rect.bottom) / 2) / d;
  }

  const now    = actual_millis();
  MOUSE_POSITIONS = MOUSE_POSITIONS.concat([x* 10000, y * 10000, now])
  while (MOUSE_POSITIONS.length > 0 && now - MOUSE_POSITIONS[2] > 100) {
    MOUSE_POSITIONS = MOUSE_POSITIONS.slice(3);
  }

//  console.log("x = "+x+" y = "+y);
  if (e.shiftKey) {
    MOVE_MATRIX = default_move_matrix();
  } else {
    BLADE_ANGLE=-y;
    MOVE_MATRIX = Matrix.mkzrot(Math.PI/2.0).mult(Matrix.mkxrot(-y)).mult(Matrix.mkzrot(y));

    MOVE_MATRIX = Matrix.mkyrot(Math.PI/2.0)
    MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mktranslate(1.0, 0.04, 0.0));
    MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mkyrot(-x/8));
    MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mktranslate(-1.0, 0.0, 0.0));
    MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mkzrot(-y));
    MOVE_MATRIX = MOVE_MATRIX.mult(Matrix.mktranslate(-0.17, 0.0, 0.0));
  }
//  console.log(MOVE_MATRIX.values);


  // SmoothSwing updates
  lastSwingSpeed = get_swing_speed();
  lastSwingUpdate = Date.now();
  // console.debug(
  //   `[SwingDebug][mouse_move] lastSwingSpeed=${lastSwingSpeed.toFixed(1)}, ` +
  //   `lastSwingUpdate=${lastSwingUpdate}`
  // );
    triggerAccentEvent(lastSwingSpeed);
}
//////////// BC ///////////

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
  console.log("Mouse leave!");
  MOVE_MATRIX = default_move_matrix();
  MOUSE_POSITIONS = [];
  IN_FRAME = false;
  // fadeAndStop('smoothLoopL', 300);
  // fadeAndStop('smoothLoopH', 300);
  //   console.log(`[mouse_leave] STOPPING smoothswings..`);
}

function compile() {
  // Create a shader that samples a 2D image.
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader,
                  FIND("vertex_shader").textContent);
  gl.compileShader(vertexShader);

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  var shader_code = FIND("fragment_shader").textContent;

  variables = [
    "#define AA " + AA,
  ];
//  shader_code = shader_code.replace("$FUNCTION$", current_style.gencode());
  shader_code = shader_code.replace("$VARIABLES$", variables.join("\n"));
  if (graflexState.get()) {
    shader_code = shader_code.replace("$HILT$", FIND("hilt_graflex").textContent);
  } else {
    shader_code = shader_code.replace("$HILT$", FIND("hilt_cylinder").textContent);
  }
  // console.log(shader_code);

  gl.shaderSource(fragmentShader, shader_code);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {

    var v = shader_code.split("\n");
    for (var i = 0; i < v.length; i++) {
      console.log( (i+1) + ": " + v[i]);
  }
    throw "Could not compile shader:\n\n" + gl.getShaderInfoLog(fragmentShader);
  }

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw "Could not link the shader program!\n\n" + gl.getProgramInfoLog(shaderProgram);
  }
  gl.useProgram(shaderProgram);

}

var varnum = 0;
var variables = [];
var vartypes = {};

function genvar(t) {
  varnum++;
  var variable = "u_" + varnum;
  variables.push( "uniform " + t + " " + variable + ";");
  vartypes[variable] = t;
  return variable;
}

function setvar(variable, val) {
  // console.log(variable + " = " + val);
  if (vartypes[variable] == "float") {
    gl.uniform1f(gl.getUniformLocation(shaderProgram, variable),  val);
    return;
  }
  if (vartypes[variable] == "int") {
    gl.uniform1i(gl.getUniformLocation(shaderProgram, variable),  val);
    return;
  }
  console.log("SETVAR ERROR " + variable);
}

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

EFFECT_ENUM_BUILDER = new EnumBuilder("EFFECT");
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

LOCKUP_ENUM_BUILDER = new EnumBuilder("LOCKUP_TYPE", "SaberBase::");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_NONE", 0);
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_NORMAL");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_DRAG");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_ARMED");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_AUTOFIRE");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_MELT");
LOCKUP_ENUM_BUILDER.addValue("LOCKUP_LIGHTNING_BLOCK");
LOCKUP_ENUM_BUILDER.build();

ArgumentName_ENUM_BUILDER = new EnumBuilder("ArgumentName");
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

//////////// BC ///////////
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
  [EFFECT_DRAG_BEGIN]:       "bgndrag",
  [EFFECT_DRAG_END]:         "enddrag",
  [EFFECT_LOCKUP_BEGIN]:     "bgnlock",
  [EFFECT_LOCKUP_END]:       "endlock",
  // Pseudo-events for sound playback / possible future use
  [EFFECT_MELT_BEGIN]:       "bgnmelt",
  [EFFECT_MELT_END]:         "endmelt",
  [EFFECT_LB_BEGIN]:         "bgnlb",
  [EFFECT_LB_END]:           "endlb",
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
//////////// BC ///////////

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

//////////// BC ///////////
/**
 * Read the current style textarea and return a Set of EFFECT_* IDs
 * that are actually referenced (either literally or via macros).
 */
function getAllowedEffectsFromStyleText() {
  const sty = FIND("style");
  let text = sty?.value || "";
  // Strip block comments: /* … */
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip line comments: //
  text = text.replace(/\/\/.*$/gm, "");  const allowed = new Set();

  // Any literal EFFECT_XXX constant in the text
  const consts = text.match(/\bEFFECT_[A-Z_]+\b/g) || [];
  for (const c of new Set(consts)) {
    if (window[c] !== undefined) {
      allowed.add(window[c]);
    }
  }

  // Known macros → their EFFECTs
  const macroMap = {
    ResponsiveClashL:        EFFECT_CLASH,
    ResponsiveStabL:         EFFECT_STAB,
    ResponsiveBlastL:        EFFECT_BLAST,
    ResponsiveBlastWaveL:    EFFECT_BLAST,
    ResponsiveBlastFadeL:     EFFECT_BLAST,

    ResponsiveLockupL:       [EFFECT_LOCKUP_BEGIN,   EFFECT_LOCKUP_END],
    ResponsiveDragL:         [EFFECT_DRAG_BEGIN,     EFFECT_DRAG_END],
    ResponsiveMeltL:         [EFFECT_MELT_BEGIN,     EFFECT_MELT_END],
    ResponsiveLightningBlockL:[EFFECT_LB_BEGIN,       EFFECT_LB_END],

    InOutTrL:                [EFFECT_IGNITION,       EFFECT_RETRACTION],
  };

  for (let [macro, val] of Object.entries(macroMap)) {
    if (text.includes(macro + "<")) {
      if (Array.isArray(val)) {
        val.forEach(v => allowed.add(v));
      } else if (val != null) {
        allowed.add(val);
      }
    }
  }
  // Also include lockup begin/end events for any literal LOCKUP_* in the style
  getAllowedLockupsFromStyleText().forEach(lockupType => {
    const evts = lockups_to_event[lockupType];
    if (evts) {
      evts.forEach(evt => allowed.add(evt));
    }
  });

  return allowed;
}

function getAllowedLockupsFromStyleText() {
  const sty = FIND("style");
  let text = sty?.value || "";
  // Strip block comments: /* … */
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip line comments: //
  text = text.replace(/\/\/.*$/gm, "");

  const allowed = new Set();

  // Direct matches: LOCKUP_NORMAL, LOCKUP_MELT, etc.
  const lockups = text.match(/\bLOCKUP_[A-Z_]+\b/g) || [];
  for (const c of new Set(lockups)) {
    if (window[c] !== undefined) {
      allowed.add(window[c]);
    }
  }

  // Macro usage detection
  const macroLockupMap = {
    ResponsiveLockupL: LOCKUP_NORMAL,
    ResponsiveDragL: LOCKUP_DRAG,
    ResponsiveMeltL: LOCKUP_MELT,
    ResponsiveLightningBlockL: LOCKUP_LIGHTNING_BLOCK
  };

  for (let macro in macroLockupMap) {
    if (text.includes(macro + "<")) {
      allowed.add(macroLockupMap[macro]);
    }
  }
  return allowed;
}

//////////// BC ///////////

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

//var qlinks = "<b>Colors</b> <input type=color id=COLOR value='#ff0000' onclick='ClickColor()' />";
//var effect_links = "<b>Effects:</b>";
//var layer_links = "";
//var effect_type_links = "<b>Effect Types:</b>";
//var template_links = "<b>Templates:</b>";
//var function_links = "<b>Functions:</b>";
//var transition_links = "<b>Transitions:</b>";

var effect_links = [];
var layer_links = [];
var effect_type_links = []
var template_links = [];
var function_links = []
var transition_links = [];

var all_colors = {};
var colorNames = {};
var colorData = [];

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
var STATE_WAIT_FOR_ON = 0;
// 1 = lockup
// 2 = drag
// 3 = lb
// 4 = melt
var STATE_LOCKUP = 0;
var STATE_ROTATE = 0;
var STATE_NUM_LEDS = 144;

var handled_lockups = {};

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
    var pos = led / this.num_leds_ * (this.COLORS.length - 1);
    var N = min(this.COLORS.length -2, Math.floor(pos));
    return this.COLORS[N].getColor(led).mix(this.COLORS[N+1].getColor(led), pos - N) ;
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

// blade.addEffect override
const origAddEffect = Blade.prototype.addEffect;

Blade.prototype.addEffect = function(type, location, manual = false) {
  type = Number(type);

  // Log incoming effect + raw style text
  // let soundName = EFFECT_SOUND_MAP[type] || "(no sound mapping)";
  // console.log(`addEffect() → type=${type}, soundName='${soundName}'`);
  // console.log("Style textarea:\n", FIND("style").value);

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

 // Recompute allowed set and log it
  const allowedByStyle = getAllowedEffectsFromStyleText();
  // console.log("Allowed effects parsed from textarea:",
  //   Array.from(allowedByStyle).map(
  //     v => (EFFECT_ENUM_BUILDER.value_to_name[v] || v).replace(/^EFFECT_/, '')
  //   )
  // );

  const BEGIN_EFFECT_MAP = {
    [EFFECT_LOCKUP_BEGIN]: "bgnlock",
    [EFFECT_DRAG_BEGIN]:   "bgndrag",
    [EFFECT_MELT_BEGIN]:   "bgnmelt",
    [EFFECT_LB_BEGIN]:     "bgnlb"
  };
if (BEGIN_EFFECT_MAP[type]) {
  if (allowedByStyle.has(type)) {
    // Do Selected Effect triggered
    if (manual || window.lockupLoopSrc) playRandomEffect(BEGIN_EFFECT_MAP[type], true);
  }
  // Lockup chooser triggered
  if (!manual && !window.lockupLoopSrc && allowedByStyle.has(type)) startLockupLoop(type);
  return;
}

  const END_EFFECT_MAP = {
    [EFFECT_LOCKUP_END]: "endlock",
    [EFFECT_DRAG_END]:   "enddrag",
    [EFFECT_MELT_END]:   "endmelt",
    [EFFECT_LB_END]:     "endlb"
  };
if (END_EFFECT_MAP[type]) {
  // If being called because we are forcibly clearing a lockup (i.e. not allowedByStyle anymore),
  // always end the lockup loop (even if sound is denied by style)
  const forceEnd = !allowedByStyle.has(type) && window.lockupLoopSrc;
  endLockupLoop(type, (allowedByStyle.has(type) || forceEnd) ? END_EFFECT_MAP[type] : null, true);
  return;
}

  const allowedByFocus = (!current_focus || current_focus.constructor.name === 'LayersClass');

  // Else, only play sound if it's in the textarea.
  const effectName = EFFECT_SOUND_MAP[type];
  if (effectName) {
  const isAllowed = allowedByFocus || allowedByStyle.has(type);
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
  console.log("FOCUS=" + T);
  console.log(T);
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
    this.on_ = STATE_ON;
    // Track so that focusing back to full style doesn't re-trigger ignition.
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

  var classes = {
    AlphaL : AlphaL,
    AlphaMixL : AlphaMixL,
    AudioFlicker : AudioFlicker,
    AudioFlickerL : AudioFlickerL,
    Blast : Blast,
    BlastL : BlastL,
    BlastF : BlastF,
    BlastFadeout : BlastFadeout,
    BlastFadeoutL : BlastFadeoutL,
    BlastFadeoutF : BlastFadeoutF,
    Blinking : Blinking,
    BlinkingL : BlinkingL,
    BlinkingX : BlinkingX,
    BlinkingF : BlinkingF,
    BrownNoiseFlicker : BrownNoiseFlicker,
    BrownNoiseFlickerL : BrownNoiseFlickerL,
    BrownNoiseF : BrownNoiseF,
    ColorCycle : ColorCycle,
    ColorChange : ColorChange,
    ColorSelect : ColorSelect,
    IntSelect : IntSelect,
    ColorSequence : ColorSequence,
    EffectSequence : EffectSequence,
    Cylon : Cylon,
    EasyBlade : EasyBlade,
    FOCUS : Focus,
    FireConfig : FireConfig,
    Gradient : Gradient,
    HumpFlicker : HumpFlicker,
    HumpFlickerL : HumpFlickerL,
    HumpFlickerF : HumpFlickerF,
    HumpFlickerFX : HumpFlickerFX,
    IgnitionDelay : IgnitionDelay,
    IgnitionDelayX : IgnitionDelayX,
    RetractionDelay : RetractionDelay,
    RetractionDelayX : RetractionDelayX,
    InOutHelper : InOutHelper,
    InOutHelperX : InOutHelperX,
    InOutHelperL : InOutHelperL,
    InOutHelperF : InOutHelperF,
    InOutSparkTip : InOutSparkTip,
    Layers : Layers,
    LocalizedClash : LocalizedClash,
    LocalizedClashL : LocalizedClashL,
    Lockup : Lockup,
    LockupL : LockupL,
    LockupTr : LockupTr,
    LockupTrL : LockupTrL,
    Mix : Mix,
    OnSpark : OnSpark,
    OnSparkX : OnSparkX,
    OnSparkL : OnSparkL,
    OnSparkF : OnSparkF,
    OriginalBlast : OriginalBlast,
    OriginalBlastL : OriginalBlastL,
    OriginalBlastF : OriginalBlastF,
    Pixelate : Pixelate,
    PixelateX : PixelateX,
    Pulsing : Pulsing,
    PulsingX : PulsingX,
    PulsingL : PulsingL,
    PulsingF : PulsingF,
    RandomFlicker : RandomFlicker,
    RandomL : RandomL,
    RandomF : RandomF,
    RandomPerLEDFlicker : RandomPerLEDFlicker,
    RandomPerLEDFlickerL : RandomPerLEDFlickerL,
    RandomPerLEDF : RandomPerLEDF,
    RandomBlink : RandomBlink,
    RandomBlinkX : RandomBlinkX,
    RandomBlinkL : RandomBlinkL,
    RandomBlinkF : RandomBlinkF,
    Remap : Remap,
    Sequence : Sequence,
    SequenceL : SequenceL,
    SequenceF : SequenceF,
    Rgb : Rgb,
    Rgb16 : Rgb16,
    SimpleClash : SimpleClash,
    SimpleClashL : SimpleClashL,
    Sparkle : Sparkle,
    SparkleL : SparkleL,
    SparkleF : SparkleF,
    Strobe : Strobe,
    StrobeX : StrobeX,
    StrobeL : StrobeL,
    StrobeF : StrobeF,
    Stripes : Stripes,
    StripesX : StripesX,
    StyleFire : StyleFire,
    StylePtr : StylePtr,
    StyleFirePtr : StyleFirePtr,
    StyleNormalPtr : StyleNormalPtr,
    StyleRainbowPtr : StyleRainbowPtr,
    StyleStrobePtr : StyleStrobePtr,
    StaticFire : StaticFire,
    TransitionLoop : TransitionLoop,
    TransitionLoopL : TransitionLoopL,
    TransitionEffect : TransitionEffect,
    TransitionEffectL : TransitionEffectL,
    MultiTransitionEffect : MultiTransitionEffect,
    MultiTransitionEffectL : MultiTransitionEffectL,
    TransitionPulseL : TransitionPulseL,
    InOutTr : InOutTr,
    InOutTrL : InOutTrL,

    RotateColorsX : RotateColorsX,
    RotateColors : RotateColors,
    HueX : HueX,
    Hue : Hue,

    TrInstant : TrInstant,
    TrFade : TrFade,
    TrFadeX : TrFadeX,
    TrSmoothFade : TrSmoothFade,
    TrSmoothFadeX : TrSmoothFadeX,
    TrDelay : TrDelay,
    TrDelayX : TrDelayX,
    TrBoing : TrBoing,
    TrBoingX : TrBoingX,
    TrBlink : TrBlink,
    TrBlinkX : TrBlinkX,
    TrDoEffect : TrDoEffect,
    TrDoEffectX : TrDoEffectX,
    TrDoEffectAlways : TrDoEffectAlways,
    TrDoEffectAlwaysX : TrDoEffectAlwaysX,
    TrWipe : TrWipe,
    TrWipeX : TrWipeX,
    TrWipeIn : TrWipeIn,
    TrWipeInX : TrWipeInX,
    TrCenterWipe : TrCenterWipe,
    TrCenterWipeX : TrCenterWipeX,
    TrCenterWipeSpark : TrCenterWipeSpark,
    TrCenterWipeSparkX : TrCenterWipeSparkX,
    TrCenterWipeIn : TrCenterWipeIn,
    TrCenterWipeInX : TrCenterWipeInX,
    TrCenterWipeInSpark : TrCenterWipeInSpark,
    TrCenterWipeInSparkX : TrCenterWipeInSparkX,
    TrColorCycle : TrColorCycle,
    TrColorCycleX : TrColorCycleX,
    TrConcat : TrConcat,
    TrJoin : TrJoin,
    TrJoinR : TrJoinR,
    TrRandom : TrRandom,
    TrSelect : TrSelect,
    TrSequence : TrSequence,
    TrWaveX : TrWaveX,
    TrSparkX : TrSparkX,
    TrWipeSparkTip : TrWipeSparkTip,
    TrWipeSparkTipX : TrWipeSparkTipX,
    TrWipeInSparkTip : TrWipeInSparkTip,
    TrWipeInSparkTipX : TrWipeInSparkTipX,
    TrExtendX : TrExtendX,
    TrExtend : TrExtend,
    TrLoop : TrLoop,
    TrLoopN : TrLoopN,
    TrLoopNX : TrLoopNX,
    TrLoopUntil : TrLoopUntil,

    ReverseTime : ReverseTime,
    ReverseTimeX : ReverseTimeX,
    BendTimePow : BendTimePow,
    BendTimePowX : BendTimePowX,
    BendTimePowInv : BendTimePowInv,
    BendTimePowInvX : BendTimePowInvX,

    BatteryLevel : BatteryLevel,
    VolumeLevel : VolumeLevel,
    Bump : Bump,
    Ifon : Ifon,
    ChangeSlowly : ChangeSlowly,
    InOutFunc : InOutFunc,
    InOutFuncX : InOutFuncX,
    Int : Int,
    IntArg : IntArg_,
    RgbArg : RgbArg_,
    Scale : Scale,
    InvertF : InvertF,
    Sin : Sin,
    Saw : Saw,
    Trigger : Trigger,
    SmoothStep : SmoothStep,
    RampF : RampF,
    Mult : Mult,
    Percentage : Percentage,
    NoisySoundLevel : NoisySoundLevel,
    NoisySoundLevelCompat : NoisySoundLevelCompat,
    SmoothSoundLevel : SmoothSoundLevel,
    SwingSpeedX : SwingSpeedX,
    SwingSpeed : SwingSpeed,
    SwingAccelerationX : SwingAccelerationX,
    SwingAcceleration : SwingAcceleration,
    ClashImpactFX : ClashImpactFX,
    ClashImpactF : ClashImpactF,
    LayerFunctions : LayerFunctions,
    SlowNoise : SlowNoise,
    IsLessThan : IsLessThan,
    IsGreaterThan : IsGreaterThan,
    IsBetween : IsBetween,
    ClampFX : ClampFX,
    ClampF : ClampF,
    Variation : Variation,
    AltF : AltF,
    SyncAltToVarianceF : SyncAltToVarianceF,
    SyncAltToVarianceL : SyncAltToVarianceL,
    BladeAngleX : BladeAngleX,
    BladeAngle : BladeAngle,
    TwistAngle : TwistAngle,
    TwistAcceleration : TwistAcceleration,
    Sum : Sum,
    Divide : Divide,
    ModF : ModF,
    Subtract : Subtract,
    HoldPeakF : HoldPeakF,
    ThresholdPulseF : ThresholdPulseF,
    EffectRandomF : EffectRandomF,
    EffectPulseF : EffectPulseF,
    EffectPosition : EffectPosition,
    TimeSinceEffect : TimeSinceEffect,
    WavNum : WavNum,
    CenterDistF : CenterDistF,
    CircularSectionF : CircularSectionF,
    LinearSectionF : LinearSectionF,
    IncrementWithReset : IncrementWithReset,
    IncrementModuloF : IncrementModuloF,
    IncrementF : IncrementF,
    EffectIncrementF : EffectIncrementF,
    MarbleF : MarbleF,

    ResponsiveLockupL : ResponsiveLockupL,
    ResponsiveDragL : ResponsiveDragL,
    ResponsiveMeltL : ResponsiveMeltL,
    ResponsiveLightningBlockL : ResponsiveLightningBlockL,
    ResponsiveClashL : ResponsiveClashL,
    ResponsiveBlastL : ResponsiveBlastL,
    ResponsiveBlastWaveL : ResponsiveBlastWaveL,
    ResponsiveBlastFadeL : ResponsiveBlastFadeL,
    ResponsiveStabL : ResponsiveStabL,

    IgnitionTime : IgnitionTime,
    RetractionTime : RetractionTime,
    WavLen : WavLen,
    LockupPulseF : LockupPulseF,
};

AddIdentifier("RgbCycle", RgbCycle);
AddIdentifier("Rainbow", Rainbow);
AddIdentifier("WHITE", Rgb.bind(null, 255,255,255));
AddIdentifier("BLACK", Rgb.bind(null, 0,0,0));

AddIdentifier("RED", Rgb.bind(null, 255,0,0));
AddIdentifier("GREEN", Rgb.bind(null, 0,255,0));
AddIdentifier("BLUE", Rgb.bind(null, 0,0,255));
AddIdentifier("YELLOW", Rgb.bind(null, 255,255,0));
AddIdentifier("CYAN", Rgb.bind(null, 0,255,255));
AddIdentifier("MAGENTA", Rgb.bind(null, 255,0,255));
AddIdentifier("WHITE", Rgb.bind(null, 255,255,255));
AddIdentifier("BLACK", Rgb.bind(null, 0,0,0));

AddIdentifier("AliceBlue", Rgb.bind(null, 223, 239, 255));
AddIdentifier("Aqua", Rgb.bind(null, 0, 255, 255));
AddIdentifier("Aquamarine", Rgb.bind(null, 55, 255, 169));
AddIdentifier("Azure", Rgb.bind(null, 223, 255, 255));
AddIdentifier("Bisque", Rgb.bind(null, 255, 199, 142));
AddIdentifier("Black", Rgb.bind(null, 0, 0, 0));
AddIdentifier("BlanchedAlmond", Rgb.bind(null, 255, 213, 157));
AddIdentifier("Blue", Rgb.bind(null, 0, 0, 255));
AddIdentifier("Chartreuse", Rgb.bind(null, 55, 255, 0));
AddIdentifier("Coral", Rgb.bind(null, 255, 55, 19));
AddIdentifier("Cornsilk", Rgb.bind(null, 255, 239, 184));
AddIdentifier("Cyan", Rgb.bind(null, 0, 255, 255));
AddIdentifier("DarkOrange", Rgb.bind(null, 255, 68, 0));
AddIdentifier("DeepPink", Rgb.bind(null, 255, 0, 75));
AddIdentifier("DeepSkyBlue", Rgb.bind(null, 0, 135, 255));
AddIdentifier("DodgerBlue", Rgb.bind(null, 2, 72, 255));
AddIdentifier("FloralWhite", Rgb.bind(null, 255, 244, 223));
AddIdentifier("Fuchsia", Rgb.bind(null, 255, 0, 255));
AddIdentifier("GhostWhite", Rgb.bind(null, 239, 239, 255));
AddIdentifier("Green", Rgb.bind(null, 0, 255, 0));
AddIdentifier("GreenYellow", Rgb.bind(null, 108, 255, 6));
AddIdentifier("HoneyDew", Rgb.bind(null, 223, 255, 223));
AddIdentifier("HotPink", Rgb.bind(null, 255, 36, 118));
AddIdentifier("Ivory", Rgb.bind(null, 255, 255, 223));
AddIdentifier("LavenderBlush", Rgb.bind(null, 255, 223, 233));
AddIdentifier("LemonChiffon", Rgb.bind(null, 255, 244, 157));
AddIdentifier("LightCyan", Rgb.bind(null, 191, 255, 255));
AddIdentifier("LightPink", Rgb.bind(null, 255, 121, 138));
AddIdentifier("LightSalmon", Rgb.bind(null, 255, 91, 50));
AddIdentifier("LightYellow", Rgb.bind(null, 255, 255, 191));
AddIdentifier("Lime", Rgb.bind(null, 0, 255, 0));
AddIdentifier("Magenta", Rgb.bind(null, 255, 0, 255));
AddIdentifier("MintCream", Rgb.bind(null, 233, 255, 244));
AddIdentifier("MistyRose", Rgb.bind(null, 255, 199, 193));
AddIdentifier("Moccasin", Rgb.bind(null, 255, 199, 119));
AddIdentifier("NavajoWhite", Rgb.bind(null, 255, 187, 108));
AddIdentifier("Orange", Rgb.bind(null, 255, 97, 0));
AddIdentifier("OrangeRed", Rgb.bind(null, 255, 14, 0));
AddIdentifier("PapayaWhip", Rgb.bind(null, 255, 221, 171));
AddIdentifier("PeachPuff", Rgb.bind(null, 255, 180, 125));
AddIdentifier("Pink", Rgb.bind(null, 255, 136, 154));
AddIdentifier("Red", Rgb.bind(null, 255, 0, 0));
AddIdentifier("SeaShell", Rgb.bind(null, 255, 233, 219));
AddIdentifier("Snow", Rgb.bind(null, 255, 244, 244));
AddIdentifier("SpringGreen", Rgb.bind(null, 0, 255, 55));
AddIdentifier("SteelBlue", Rgb.bind(null, 14, 57, 118));
AddIdentifier("Tomato", Rgb.bind(null, 255, 31, 15));
AddIdentifier("White", Rgb.bind(null, 255, 255, 255));
AddIdentifier("Yellow", Rgb.bind(null, 255, 255, 0));

// New in ProffieOS 8
AddIdentifier("ElectricPurple", Rgb.bind(null, 127, 0, 255));
AddIdentifier("ElectricViolet", Rgb.bind(null, 71, 0, 255));
AddIdentifier("ElectricLime", Rgb.bind(null, 156, 255, 0));
AddIdentifier("Amber", Rgb.bind(null, 255, 135, 0));
AddIdentifier("CyberYellow", Rgb.bind(null, 255, 168, 0));
AddIdentifier("CanaryYellow", Rgb.bind(null, 255, 221, 0));
AddIdentifier("PaleGreen", Rgb.bind(null, 28, 255, 28));
AddIdentifier("Flamingo", Rgb.bind(null, 255, 80, 254));
AddIdentifier("VividViolet", Rgb.bind(null, 90, 0, 255));
AddIdentifier("PsychedelicPurple", Rgb.bind(null, 186, 0, 255));
AddIdentifier("HotMagenta", Rgb.bind(null, 255, 0, 156));
AddIdentifier("BrutalPink", Rgb.bind(null, 255, 0, 128));
AddIdentifier("NeonRose", Rgb.bind(null, 255, 0, 55));
AddIdentifier("VividRaspberry", Rgb.bind(null, 255, 0, 38));
AddIdentifier("HaltRed", Rgb.bind(null, 255, 0, 19));
AddIdentifier("MoltenCore", Rgb.bind(null, 255, 24, 0));
AddIdentifier("SafetyOrange", Rgb.bind(null, 255, 33, 0));
AddIdentifier("OrangeJuice", Rgb.bind(null, 255, 55, 0));
AddIdentifier("ImperialYellow", Rgb.bind(null, 255, 115, 0));
AddIdentifier("SchoolBus", Rgb.bind(null, 255, 176, 0));
AddIdentifier("SuperSaiyan", Rgb.bind(null, 255, 186, 0));
AddIdentifier("Star", Rgb.bind(null, 255, 201, 0));
AddIdentifier("Lemon", Rgb.bind(null, 255, 237, 0));
AddIdentifier("ElectricBanana", Rgb.bind(null, 246, 255, 0));
AddIdentifier("BusyBee", Rgb.bind(null, 231, 255, 0));
AddIdentifier("ZeusBolt", Rgb.bind(null, 219, 255, 0));
AddIdentifier("LimeZest", Rgb.bind(null, 186, 255, 0));
AddIdentifier("Limoncello", Rgb.bind(null, 135, 255, 0));
AddIdentifier("CathodeGreen", Rgb.bind(null, 0, 255, 22));
AddIdentifier("MintyParadise", Rgb.bind(null, 0, 255, 128));
AddIdentifier("PlungePool", Rgb.bind(null, 0, 255, 156));
AddIdentifier("VibrantMint", Rgb.bind(null, 0, 255, 201));
AddIdentifier("MasterSwordBlue", Rgb.bind(null, 0, 255, 219));
AddIdentifier("BrainFreeze", Rgb.bind(null, 0, 219, 255));
AddIdentifier("BlueRibbon", Rgb.bind(null, 0, 33, 255));
AddIdentifier("RareBlue", Rgb.bind(null, 0, 13, 255));
AddIdentifier("OverdueBlue", Rgb.bind(null, 13, 0, 255));
AddIdentifier("ViolentViolet", Rgb.bind(null, 55, 0, 255));

class Parser {
  constructor(str, classes, identifiers) {
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

var current_style = InOutHelper(SimpleClash(Lockup(new BlastClass(BLUE, WHITE), new AudioFlickerClass(BLUE, WHITE)), WHITE, 40), 300, 800);
//var current_style = InOutHelper(SimpleClash(Lockup(new BlastClass(new RainbowClass(), WHITE), new AudioFlickerClass(BLUE, WHITE)), WHITE, 40), 300, 800);
var blade = new Blade();
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

var popupIdentifier;
var popupWindow = FIND("popup_window");
var popupOverlay = FIND("popup_overlay");

function showPopupMessage(message, currentPopup) {
  popupIdentifier = currentPopup;
  var checkbox = FIND("dont_show_again");
  checkbox.checked = localStorage.getItem(popupIdentifier) === "false";

  if (localStorage.getItem(popupIdentifier) === "false") {
    console.log(popupIdentifier + " is disabled.");
  } else {
    FIND("popup_message").innerHTML = message;
    popupWindow.classList.add("show");
    popupOverlay.classList.add("show");
  }
}

function dismissPopupMessage() {
  popupWindow.classList.remove("show");
  popupOverlay.classList.remove("show");
}

function DontShowAgain(checkboxState) {
  checkboxState = !checkboxState;
  localStorage.setItem(popupIdentifier, checkboxState);
  console.log("Saving " + popupIdentifier + " " + checkboxState);
}

var pixels;
var AA = 1;
var AA_STEP_SIZE = 1;

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
  } else {
    if (bad_fps > 10 && graflexState.get()) {
      showPopupMessage("Struggling to render hilt model.<br>Switching to simpler design.<br>To re-enable Graflex model, go to Settings.", "graflexPopup");
      graflexState.set(false);
    }
  }
  num_leds = blade.num_leds()
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
  numTick++;
  if (S.getColor && S.getType && S.getType() == "COLOR" && numTick > framesPerUpdate) {
    numTick = 0;
    S.run(blade);
    for (var i = 0; i < num_leds; i++) {
        c = S.getColor(i);
        pixels[i*4 + 0] = Math.round(c.r * 255);
        pixels[i*4 + 1] = Math.round(c.g * 255);
        pixels[i*4 + 2] = Math.round(c.b * 255);
        pixels[i*4 + 3] = 255;
    }
    if (last_micros != 0) {
      current_micros += delta_us / 2;
    }
    if (framesPerUpdate == 0) {
      S.run(blade);
    }
    for (var i = 0; i < num_leds; i++) {
        c = S.getColor(i);
        pixels[i*4 + 0 + num_leds * 4] = Math.round(c.r * 255);
        pixels[i*4 + 1 + num_leds * 4] = Math.round(c.g * 255);
        pixels[i*4 + 2 + num_leds * 4] = Math.round(c.b * 255);
       pixels[i*4 + 3 + num_leds * 4] = 255;
    }
    S.update_displays();
  }
  // TODO: Generate mipmaps, then adjust level based on distance from blade
  gl.texImage2D(
      gl.TEXTURE_2D,
      0,                 // level
      gl.RGBA,           // internalFormat
      num_leds, 2,       // width, height
      0,                 // border
      gl.RGBA,           // source format
      gl.UNSIGNED_BYTE,  // source type
      pixels);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Draw these textures to the screen, offset by 1 pixel increments
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // Modified to canvas.width and height for fullscreen recovery.
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 1.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // gl.viewport(0, 0, canvas.width,  canvas.height);  // redundant?
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
  gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_time"),
               (new Date().getTime() - start) / 1000.0);
  gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_width"), width);
  gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_height"), height);

  gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "u_move_matrix"), false, rotation.values);
  gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "u_old_move_matrix"), false, OLD_MOVE_MATRIX.values);
  OLD_MOVE_MATRIX = rotation;
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  t += 1;
}

function tick() {
  window.requestAnimationFrame(tick);
  drawScene();
}

var overall_string;

function ReplaceCurrentFocus(str) {
  current_focus_url = str;

  if (current_focus) {
    current_focus.super_short_desc = true;
    pp_is_url++;
    pp_is_verbose++;
    var url = style_tree.pp();
    console.log("FOCUS URL: " + url);
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

  if (current_style) {
    type = current_style.getType();
    classname = current_style.constructor.name;
  }

  AddHistory(current_focus_url, current_style.getType());
  highlightHistoryButtons(type);

  FIND("expand_button").className = current_style && current_style.isMacro ? "button-on" : "button-off";
  FIND("layerize_button").className = CanLayerize(current_style) ? "button-on" : "button-off";

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
  console.log('highlightHistoryButtons called with type:', validType);
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
//////////// BC ///////////
function Run() {
  var sty = FIND("style");
  var err = FIND("error_message");
  // grab the raw text
  var originalStr = sty.value;
  var str = originalStr;

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
  }
  catch(e) {
    if (typeof(e) == "string") {
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
  ReplaceCurrentFocus(str);
  compile();
  STATE_LOCKUP = LOCKUP_NONE;
  updateLockupDropdown();

  if (current_style.argstring) {
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
  console.log("Updated " + N + " : " + tag.value)
}

function IncreaseArg(ARG, I) {
  var N = ArgumentName_ENUM_BUILDER.value_to_name[ARG];
  var tag = FIND("ARGSTR_"+N);
  tag.value = parseInt(tag.value) + I;
  setARG(ARG, tag.value);
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
  console.log("Style SetTo:\n", str);
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

function FocusOnLow(id) {
  console.log("FOCUSON: " + id);
  const style = style_ids[id];
  console.log("style_ids[" + id + "] =", style);
  current_focus = style;
  var container = FIND("X"+id);
  console.log(container);
  pp_is_url++;
  const url = style.pp();
  pp_is_url--;
  console.log("pp URL =", url);
  current_focus_url = url;
  SetTo(url);
  FocusCheck();
  return true;
}

function FocusOn(id, event) {
  event.stopPropagation();
  FocusOnLow(id);
}

function FocusCheck() {
  // Detect whether this is the top-level in structured view.
  const outerMostBracket = (!current_focus || (current_focus.constructor.name === "LayersClass"));
  // console.log('[FocusCheck] outerMostBracket = ' + outerMostBracket);
  if (outerMostBracket) {
    focusAllowsHum = true;
    if (STATE_ON) {
      // console.log("[FocusCheck] resumeLoops()");
      resumeLoops();
    }
  } else {
    // console.log("[FocusCheck] stopAllLoops()");
    stopAllLoops(200, false);
    focusAllowsHum = false;
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
For ignition delay, use preon sound duration.
For POSTOFF delay, use IN_TR total time.
*/
function ClickPower() {
  // Debounce
  if (ClickPower._debounced) {
    return;
  }
  ClickPower._debounced = true;
  setTimeout(() => { ClickPower._debounced = false; }, 400);
  stopAllLoops(200, true);  // Power button used: clear lockup state

  STATE_LOCKUP=0;
  updateLockupDropdown();
  console.log("POWER");

  function igniteAndStartHum() {
    requestAnimationFrame(updateSmoothSwingGains)
    blade.addEffect(EFFECT_IGNITION, Math.random() * 0.7 + 0.2);
    setTimeout(() => {
      // Only start hum if still powered on!
      // FocusCheck();
      if (focusAllowsHum) {
        startHum();
      } else {
        console.log('[STATE_WAIT_FOR_ON] Power turned off before ignition; or Not focused full. not starting hum.');
      }
    }, 200);  // pseudo ProffieOSHumDelay hardcoded
  }

  // if (!STATE_ON && !STATE_WAIT_FOR_ON) {
  //   STATE_WAIT_FOR_ON = true;
  //   const buffers = pickLoopBuffers('preon');
  // console.log('ClickPower DEBUG: soundOn=', soundOn, 'buffers:', buffers);    let ignitionDelay = 0;
  //   if (buffers.length) {
  //     blade.addEffect(EFFECT_PREON, 0.0);
  //     const idx = lastPlayedSoundIndex['preon'];
  //     ignitionDelay = Math.round(buffers[idx].duration * 1000);
  //     console.log(`Delaying ignition by ${ignitionDelay} ms (preon.wav length)`);
  //   }
  //   setTimeout(() => {
  //     STATE_WAIT_FOR_ON = false;
  //     STATE_ON = true;
  //     igniteAndStartHum();
  //   }, ignitionDelay);
  //     power_button.classList.toggle("button-latched", true);
  // } else {
  if (!STATE_ON && !STATE_WAIT_FOR_ON) {
    STATE_WAIT_FOR_ON = true;
    const buffers = pickLoopBuffers('preon');
    let ignitionDelay = 0;
    let idx = lastPlayedSoundIndex['preon'];
    if (typeof idx !== 'number' || idx >= buffers.length) idx = 0;
    if (buffers[idx]) {
      blade.addEffect(EFFECT_PREON, 0.0);
      ignitionDelay = Math.round(buffers[idx].duration * 1000);
      console.log(`Delaying ignition by ${ignitionDelay} ms (preon.wav length)`);
    }

    setTimeout(() => {
      STATE_WAIT_FOR_ON = false;
      STATE_ON = true;
      igniteAndStartHum();
    }, ignitionDelay);

    power_button.classList.toggle("button-latched", true);

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
          if (n.constructor && n.constructor.name === 'WavLenClass')
            return Number(n.getInteger(0));
          if (n.MILLIS)
            return Number(n.MILLIS.getInteger(0));
          if (n.args)
            return n.args.reduce((sum, a) => sum + getDur(a), 0);
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

function OnLockupChange() {
  console.log("OnLockupChange");
  var select = FIND("LOCKUP");
  var old = STATE_LOCKUP;
  STATE_LOCKUP = window[select.value];
  window.currentLockupType = STATE_LOCKUP;
  updateLockupDropdown();
  if (STATE_LOCKUP && lockups_to_event[STATE_LOCKUP]) {
    blade.addEffect(lockups_to_event[STATE_LOCKUP][0], Math.random() * 0.7 + 0.2);
  } else if (old && lockups_to_event[old]) {
    blade.addEffect(lockups_to_event[old][1], Math.random() * 0.7 + 0.2);
  }
}

function updateLockupDropdown() {
  // console.log("[LockupDropdown] ▶ update called; STATE_LOCKUP =", STATE_LOCKUP);
  const lockupSelect = FIND("LOCKUP");
  lockupSelect.innerHTML = "";

  // Get allowed lockup types from style code
  const allowedLockups = getAllowedLockupsFromStyleText();
  // console.log("[LockupDropdown]    allowedLockups =", Array.from(allowedLockups));

// THIS WORKS if we want to play the endlock when refocusing off a selected lockup layer.
// but maybe it should just stop playing instead ?
// // Auto‐end any running lockup if its layer is no longer allowed
// const prevBeginEvt = window.currentLockupType;
// console.log(
//   "[LockupDropdown] ▶ prevBeginEvt=", prevBeginEvt,
//   "allowedLockups=", Array.from(allowedLockups)
// );
// // figure out which lockup enum originally drove that begin‐event
// let prevEnum, endEvt;
// for (const [lk, [b,e]] of Object.entries(lockups_to_event)) {
//   if (b === prevBeginEvt) {
//     prevEnum = Number(lk);
//     endEvt   = e;
//     break;
//   }
// }
// if (prevEnum != null && !allowedLockups.has(prevEnum)) {
//   console.log("[LockupDropdown] ⚡ auto‐ending lockup enum", prevEnum);
//   const END_EFFECT_MAP = {
//     [EFFECT_LOCKUP_END]:   "endlock",
//     [EFFECT_DRAG_END]:     "enddrag",
//     [EFFECT_MELT_END]:     "endmelt",
//     [EFFECT_LB_END]:       "endlb"
//   };
//   // directly kill the loop and play its end‐sound
//   endLockupLoop(prevBeginEvt, END_EFFECT_MAP[endEvt], true);
//   // clear both state vars so dropdown & audio agree
//   STATE_LOCKUP = LOCKUP_NONE;
//   window.currentLockupType = null;
// }

// Silently stop loop if no lockup is selected
if ((!STATE_LOCKUP || STATE_LOCKUP === LOCKUP_NONE) && window.lockupLoopSrc) {
  try { window.lockupLoopSrc.stop(); window.lockupLoopSrc.disconnect(); } catch (_) {}
  window.lockupLoopSrc = null;
  if (window.lockupGainNode) {
    try { window.lockupGainNode.disconnect(); } catch (_) {}
    window.lockupGainNode = null;
  }
  window.currentLockupType = null;
}
  // Map value to display label
  const lockupLabels = {
    [LOCKUP_NORMAL]: "Lockup",
    [LOCKUP_DRAG]: "Drag",
    [LOCKUP_MELT]: "Melt",
    [LOCKUP_LIGHTNING_BLOCK]: "LB"
    // Add more here if needed
  };

  if (!STATE_LOCKUP || STATE_LOCKUP === LOCKUP_NONE) {
    lockupSelect.appendChild(new Option("Choose Lockup", "LOCKUP_NONE"));
    const lockupTypeNames = {
      [LOCKUP_NORMAL]: "LOCKUP_NORMAL",
      [LOCKUP_DRAG]: "LOCKUP_DRAG",
      [LOCKUP_MELT]: "LOCKUP_MELT",
      [LOCKUP_LIGHTNING_BLOCK]: "LOCKUP_LIGHTNING_BLOCK"
    };

    for (const lockupType of [LOCKUP_NORMAL, LOCKUP_DRAG, LOCKUP_MELT, LOCKUP_LIGHTNING_BLOCK]) {
      if (allowedLockups.has(lockupType)) {
        lockupSelect.appendChild(new Option(
          lockupLabels[lockupType],
          lockupTypeNames[lockupType]
        ));
      }
    }
    lockupSelect.value = "LOCKUP_NONE";
  } else {
    const stopOption = new Option("Stop", "LOCKUP_NONE");
    lockupSelect.appendChild(stopOption);
    lockupSelect.value = "LOCKUP_NONE";
    lockupSelect.options[0].text = "\u00A0\u00A0\u00A0\u00A0End Lockup \u00A0";
    lockupSelect.appendChild(new Option("\u00A0\u00A0\u00A0\u00A0Stop", "LOCKUP_NONE"));
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
  let content = "/*\nSaved from ProffieOS Style Editor:\nhttps://fredrik.hubbe.net/lightsaber/style_editor.html\n*/" + "\n\n" + textArea.value;
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
  var color = current_style.getColor(0);
  if (color.a != 1.0) {
    FIND("error_message").innerHTML = "Style is transparent.";
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
  if (colorsortState.get()) {
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

function ActivateTab(tab, fromStructuredView = false) {
  if (!FIND(tab + "_tab")) {
    console.log("No such tab");
    return;
  }

  // Hide all tab contents
  const tabcontents = document.querySelectorAll('.tabcontent');
  tabcontents.forEach(tc => tc.style.display = "none");

  // Remove active/disabled from all tabs
  const tablinks = document.querySelectorAll('.tablinks');
  tablinks.forEach(btn => {
    btn.classList.remove("active", "disabled");
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
  const menu = FIND('more_effects_menu');
  const do_selected_button = FIND('do_selected');
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
  generalEffectsMenu.label = 'General Effects';
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
  const hiddenEffects = [
    "EFFECT_MELT_BEGIN",
    "EFFECT_MELT_END",
    "EFFECT_LB_BEGIN",
    "EFFECT_LB_END"
  ];

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
//////////  PR /////////////////
        case EFFECT_DESTRUCT:
//////////  PR /////////////////
        case EFFECT_RELOAD:
        case EFFECT_MODE:
        case EFFECT_RANGE:
        case EFFECT_EMPTY:
        case EFFECT_FULL:
        case EFFECT_JAM:
        case EFFECT_UNJAM:
        case EFFECT_PLI_ON:
        case EFFECT_PLI_OFF:
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
  if (menu.value !== '') {
    do_selected_button.disabled = false;
    do_selected_button.className = "button-on";
    do_selected_button.onclick = function() {
      AddClickedEffect();
    };
  } else {
    do_selected_button.disabled = true;
    do_selected_button.onclick = null;
    do_selected_button.className = "button-off";
  }
}

// What to do when preview saber area is clicked
function AddClickedEffect() {
  const menu = FIND('more_effects_menu');
  const do_selected_button = FIND('do_selected');
  const raw = menu.value;
  const type = Number(raw);
  const effectName = EFFECT_SOUND_MAP[type] || raw;

  // console.log("🖱️ Manual trigger:", { type, effectName });
  // console.log("   customFontSounds:", customFontSounds[effectName]);
  // console.log("   customFontSoundDurations:", customFontSoundDurations[effectName]);
  // console.log("   lastPlayedSoundIndex:", lastPlayedSoundIndex[effectName]);
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
    blade.addEffect(type, 0.0, true);
  }
}

menu.addEventListener('change', function() {
  if (menu.value !== '') {
    do_selected_button.disabled = false;
    do_selected_button.className = "button-on";
    do_selected_button.onclick = function() {
      AddClickedEffect();
    };
  } else {
    do_selected_button.disabled = true;
    do_selected_button.onclick = null;
    do_selected_button.className = "button-off";
  }
});

function toggleSettingsPanel() {
  if (document.querySelector('input.invalid')) {
    console.log('*** INVALID INPUT - Not closing panel.');
    return;
  }
  const settingsPanel = FIND('settings_panel');
  settingsPanel.classList.toggle('show');
}

// Click outside to close Settings Panel
document.body.addEventListener('click', function(e) {
  if (document.querySelector('input.invalid')) {
    console.log('*** INVALID INPUT - Not closing panel.');
    return;
  }
  const settingsPanel = FIND('settings_panel');
  const settingsButton = FIND('SETTINGS_BUTTON');
  if (
    settingsPanel.classList.contains('show') &&
    !settingsPanel.contains(e.target) &&
    e.target !== settingsButton
  ) {
    settingsPanel.classList.remove('show');
  }
});

// Call the onPageLoad function when the page is loaded
window.addEventListener('DOMContentLoaded', onPageLoad);

var all_saved_states = [];
var state_by_checkbox = new Map();
var body = document.querySelector("body");
var structuredView;
//////////////// WAVLEN PR /////////////////
var wavlenInput = FIND("WAVLEN_VALUE");
var myWavLen = new WavLenClass();

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
    this.set(getSavedState(this.name + "Save", this.def));
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
    saveState(this.name + "Save", boolValue);
    this.update_function(boolValue);
  }
}

class SavedStateNumber extends SavedState {
  constructor(name, def, update_function) {
    super(name, def, update_function);
  }
  set(value) {
    this.value = value;
    FIND(this.name.toUpperCase() + "_VALUE").value = value;
    saveState(this.name + "Save", value);
    this.update_function(value);
  }
}
//////////////// WAVLEN PR /////////////////

var darkState = new SavedStateBool("dark", false, (on) => {
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
var colorsortState = new SavedStateBool("colorsort", false, (on) => {
  updateRgbTabContent();
});

var graflexState = new SavedStateBool("graflex", true, (on) => { compile(); });
var mouseswingsState = new SavedStateBool("mouseswings", false, (on) => {});
var autoswingState = new SavedStateBool("autoswing", true, (on) => {});
var inhiltState = new SavedStateBool("inhilt", false, (on) => { STATE_NUM_LEDS = on ? 1 : 144; });
var slowState = new SavedStateBool("slow", false, (on) => { framesPerUpdate = on ? 10 : 0; time_factor = framesPerUpdate == 0 ? 1000 : (500/framesPerUpdate)});
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

var soundOnState = new SavedStateBool("sound", true, (on) => {
  soundOn = on;
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

var fontfallbackState = new SavedStateBool("font_fallback",false, (on) => { useDefaultFontFallback = on; });

var useFontWavLenState = new SavedStateBool("use_font_wavlen", true, (on, prev) => {
  handleWavLenControls();
  if (on && !prev) wavlenState.set(500);
});

var origD;
// Create n textures of about 1MB each.
function initGL() {
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

  if(window.devicePixelRatio !== undefined) {
    dpr = window.devicePixelRatio;
  } else {
    dpr = 1;
  }

  width = window.innerWidth * 2 / 3;
  height = window.innerHeight / 3;
  let normalHeight = height;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  origD = Math.min(width, height);

  FIND('ENLARGE_BUTTON').onclick = function() {
    enlargeCanvas = !enlargeCanvas;
    this.innerText = enlargeCanvas ? 'Reduce' : 'Enlarge';
    if (enlargeCanvas) {
      height = window.innerHeight / 2.2;
    } else {
      height = normalHeight;
    }
    canvas.height = height * dpr;
    canvas.style.height = height + 'px';
  };

  FIND('FULLSCREEN_BUTTON').onclick = function() {
    if (!document.fullscreenElement) {
      pageLeftTop.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  document.addEventListener("fullscreenchange", function() {
    const fullscreenButton = FIND("FULLSCREEN_BUTTON");
    fullscreenButton.innerText = document.fullscreenElement
      ? "Exit Fullscreen"
      : "Fullscreen";

    if (!document.fullscreenElement) {
      // Exited fullscreen: restore enlarge or normal
      if (enlargeCanvas) {
        height = window.innerHeight / 2.2;
      } else {
        height = normalHeight;
      }
      canvas.height = height * dpr;
      canvas.style.height = height + 'px';
    } else {
      // Entered fullscreen: set to normal height
      height = normalHeight;
      canvas.height = height * dpr;
      canvas.style.height = height + 'px';
    }
    origD = Math.min(canvas.width, canvas.height);
  });


  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.fullscreenElement) {
      document.exitFullscreen();
    }
  });

  gl = canvas.getContext("experimental-webgl", {colorSpace: "srgb", antialias:false});

  if (!gl) {
    throw "Unable to fetch WebGL rendering context for Canvas";
  }

  var str = new URL(window.location.href).searchParams.get("S");
  if (!str) {
    str = "Layers<Red,InOutTrL<TrWipeX<WavLen<EFFECT_IGNITION>>,TrWipeInX<WavLen<EFFECT_RETRACTION>>>,ResponsiveLockupL<White,TrInstant,TrFade<100>,Int<26000>>,ResponsiveLightningBlockL<White>,ResponsiveMeltL<Mix<TwistAngle<>,Red,Yellow>>,ResponsiveDragL<White>,TransitionEffectL<TrConcat<TrWipe<100>,AliceBlue,TrDelayX<WavLen<EFFECT_CLASH>>>,EFFECT_CLASH>,TransitionEffectL<TrConcat<TrWipe<100>,Cyan,TrDelayX<WavLen<EFFECT_STAB>>>,EFFECT_STAB>,TransitionEffectL<TrConcat<TrWipe<100>,Aquamarine,TrDelayX<WavLen<EFFECT_BLAST>>>,EFFECT_BLAST>,TransitionEffectL<TrConcat<TrWipe<100>,Azure,TrDelayX<WavLen<EFFECT_FORCE>>>,EFFECT_FORCE>,TransitionEffectL<TrConcat<TrWipe<100>,Bisque,TrDelayX<WavLen<EFFECT_BOOT>>>,EFFECT_BOOT>,TransitionEffectL<TrConcat<TrWipe<100>,Black,TrDelayX<WavLen<EFFECT_NEWFONT>>>,EFFECT_NEWFONT>,TransitionEffectL<TrConcat<TrWipe<100>,BlanchedAlmond,TrDelayX<WavLen<EFFECT_PREON>>>,EFFECT_PREON>,TransitionEffectL<TrConcat<TrWipe<100>,Chartreuse,TrDelayX<WavLen<EFFECT_IGNITION>>>,EFFECT_IGNITION>,TransitionEffectL<TrConcat<TrWipe<100>,Coral,TrDelayX<WavLen<EFFECT_RETRACTION>>>,EFFECT_RETRACTION>,TransitionEffectL<TrConcat<TrWipe<100>,Blue,TrDelayX<WavLen<EFFECT_POSTOFF>>>,EFFECT_POSTOFF>,TransitionEffectL<TrConcat<TrWipe<100>,Cornsilk,TrDelayX<WavLen<EFFECT_DRAG_BEGIN>>>,EFFECT_DRAG_BEGIN>,TransitionEffectL<TrConcat<TrWipe<100>,Cyan,TrDelayX<WavLen<EFFECT_DRAG_END>>>,EFFECT_DRAG_END>,TransitionEffectL<TrConcat<TrWipe<100>,DarkOrange,TrDelayX<WavLen<EFFECT_LOCKUP_BEGIN>>>,EFFECT_LOCKUP_BEGIN>,TransitionEffectL<TrConcat<TrWipe<100>,DeepPink,TrDelayX<WavLen<EFFECT_LOCKUP_END>>>,EFFECT_LOCKUP_END>,TransitionEffectL<TrConcat<TrWipe<100>,DeepSkyBlue,TrDelayX<WavLen<EFFECT_MELT_BEGIN>>>,EFFECT_MELT_BEGIN>,TransitionEffectL<TrConcat<TrWipe<100>,FloralWhite,TrDelayX<WavLen<EFFECT_MELT_END>>>,EFFECT_MELT_END>,TransitionEffectL<TrConcat<TrWipe<100>,GhostWhite,TrDelayX<WavLen<EFFECT_LB_BEGIN>>>,EFFECT_LB_BEGIN>,TransitionEffectL<TrConcat<TrWipe<100>,Green,TrDelayX<WavLen<EFFECT_LB_END>>>,EFFECT_LB_END>,TransitionEffectL<TrConcat<TrWipe<100>,GreenYellow,TrDelayX<WavLen<EFFECT_CHANGE>>>,EFFECT_CHANGE>,TransitionEffectL<TrConcat<TrWipe<100>,HoneyDew,TrDelayX<WavLen<EFFECT_BATTERY_LEVEL>>>,EFFECT_BATTERY_LEVEL>,TransitionEffectL<TrConcat<TrWipe<100>,HotPink,TrDelayX<WavLen<EFFECT_VOLUME_LEVEL>>>,EFFECT_VOLUME_LEVEL>,TransitionEffectL<TrConcat<TrWipe<100>,Ivory,TrDelayX<WavLen<EFFECT_POWERSAVE>>>,EFFECT_POWERSAVE>,TransitionEffectL<TrConcat<TrWipe<100>,LavenderBlush,TrDelayX<WavLen<EFFECT_BLADEIN>>>,EFFECT_BLADEIN>,TransitionEffectL<TrConcat<TrWipe<100>,LemonChiffon,TrDelayX<WavLen<EFFECT_BLADEOUT>>>,EFFECT_BLADEOUT>,TransitionEffectL<TrConcat<TrWipe<100>,LightCyan,TrDelayX<WavLen<EFFECT_ACCENT_SWING>>>,EFFECT_ACCENT_SWING>,TransitionEffectL<TrConcat<TrWipe<100>,Blue,TrDelayX<WavLen<EFFECT_ACCENT_SLASH>>>,EFFECT_ACCENT_SLASH>,TransitionEffectL<TrConcat<TrWipe<100>,LightSalmon,TrDelayX<WavLen<EFFECT_SPIN>>>,EFFECT_SPIN>,TransitionEffectL<TrConcat<TrWipe<100>,LightYellow,TrDelayX<WavLen<EFFECT_ON>>>,EFFECT_ON>,TransitionEffectL<TrConcat<TrWipe<100>,Magenta,TrDelayX<WavLen<EFFECT_OFF>>>,EFFECT_OFF>,TransitionEffectL<TrConcat<TrWipe<100>,MintCream,TrDelayX<WavLen<EFFECT_OFF_CLASH>>>,EFFECT_OFF_CLASH>,TransitionEffectL<TrConcat<TrWipe<100>,MistyRose,TrDelayX<WavLen<EFFECT_FAST_ON>>>,EFFECT_FAST_ON>,TransitionEffectL<TrConcat<TrWipe<100>,Moccasin,TrDelayX<WavLen<EFFECT_FAST_OFF>>>,EFFECT_FAST_OFF>,TransitionEffectL<TrConcat<TrWipe<100>,NavajoWhite,TrDelayX<WavLen<EFFECT_QUOTE>>>,EFFECT_QUOTE>,TransitionEffectL<TrConcat<TrWipe<100>,Orange,TrDelayX<WavLen<EFFECT_NEXT_QUOTE>>>,EFFECT_NEXT_QUOTE>,TransitionEffectL<TrConcat<TrWipe<100>,OrangeRed,TrDelayX<WavLen<EFFECT_TRACK>>>,EFFECT_TRACK>,TransitionEffectL<TrConcat<TrWipe<100>,PapayaWhip,TrDelayX<WavLen<EFFECT_SECONDARY_IGNITION>>>,EFFECT_SECONDARY_IGNITION>,TransitionEffectL<TrConcat<TrWipe<100>,PeachPuff,TrDelayX<WavLen<EFFECT_SECONDARY_RETRACTION>>>,EFFECT_SECONDARY_RETRACTION>,TransitionEffectL<TrConcat<TrWipe<100>,Pink,TrDelayX<WavLen<EFFECT_INTERACTIVE_PREON>>>,EFFECT_INTERACTIVE_PREON>,TransitionEffectL<TrConcat<TrWipe<100>,Red,TrDelayX<WavLen<EFFECT_INTERACTIVE_BLAST>>>,EFFECT_INTERACTIVE_BLAST>,TransitionEffectL<TrConcat<TrWipe<100>,SeaShell,TrDelayX<WavLen<EFFECT_BEGIN_BATTLE_MODE>>>,EFFECT_BEGIN_BATTLE_MODE>,TransitionEffectL<TrConcat<TrWipe<100>,Snow,TrDelayX<WavLen<EFFECT_END_BATTLE_MODE>>>,EFFECT_END_BATTLE_MODE>,TransitionEffectL<TrConcat<TrWipe<100>,SpringGreen,TrDelayX<WavLen<EFFECT_BEGIN_AUTO_BLAST>>>,EFFECT_BEGIN_AUTO_BLAST>,TransitionEffectL<TrConcat<TrWipe<100>,SteelBlue,TrDelayX<WavLen<EFFECT_END_AUTO_BLAST>>>,EFFECT_END_AUTO_BLAST>,TransitionEffectL<TrConcat<TrWipe<100>,Tomato,TrDelayX<WavLen<EFFECT_CLASH_UPDATE>>>,EFFECT_CLASH_UPDATE>,TransitionEffectL<TrConcat<TrWipe<100>,White,TrDelayX<WavLen<EFFECT_ALT_SOUND>>>,EFFECT_ALT_SOUND>,TransitionEffectL<TrConcat<TrWipe<100>,Yellow,TrDelayX<WavLen<EFFECT_TRANSITION_SOUND>>>,EFFECT_TRANSITION_SOUND>,TransitionEffectL<TrConcat<TrWipe<100>,ElectricPurple,TrDelayX<WavLen<EFFECT_SOUND_LOOP>>>,EFFECT_SOUND_LOOP>,TransitionEffectL<TrConcat<TrWipe<100>,ElectricViolet,TrDelayX<WavLen<EFFECT_STUN>>>,EFFECT_STUN>,TransitionEffectL<TrConcat<TrWipe<100>,ElectricLime,TrDelayX<WavLen<EFFECT_FIRE>>>,EFFECT_FIRE>,TransitionEffectL<TrConcat<TrWipe<100>,Amber,TrDelayX<WavLen<EFFECT_CLIP_IN>>>,EFFECT_CLIP_IN>,TransitionEffectL<TrConcat<TrWipe<100>,CyberYellow,TrDelayX<WavLen<EFFECT_CLIP_OUT>>>,EFFECT_CLIP_OUT>,TransitionEffectL<TrConcat<TrWipe<100>,CanaryYellow,TrDelayX<WavLen<EFFECT_RELOAD>>>,EFFECT_RELOAD>,TransitionEffectL<TrConcat<TrWipe<100>,PaleGreen,TrDelayX<WavLen<EFFECT_MODE>>>,EFFECT_MODE>,TransitionEffectL<TrConcat<TrWipe<100>,Flamingo,TrDelayX<WavLen<EFFECT_RANGE>>>,EFFECT_RANGE>,TransitionEffectL<TrConcat<TrWipe<100>,VividViolet,TrDelayX<WavLen<EFFECT_EMPTY>>>,EFFECT_EMPTY>,TransitionEffectL<TrConcat<TrWipe<100>,PsychedelicPurple,TrDelayX<WavLen<EFFECT_FULL>>>,EFFECT_FULL>,TransitionEffectL<TrConcat<TrWipe<100>,HotMagenta,TrDelayX<WavLen<EFFECT_JAM>>>,EFFECT_JAM>,TransitionEffectL<TrConcat<TrWipe<100>,BrutalPink,TrDelayX<WavLen<EFFECT_UNJAM>>>,EFFECT_UNJAM>,TransitionEffectL<TrConcat<TrWipe<100>,NeonRose,TrDelayX<WavLen<EFFECT_PLI_ON>>>,EFFECT_PLI_ON>,TransitionEffectL<TrConcat<TrWipe<100>,VividRaspberry,TrDelayX<WavLen<EFFECT_PLI_OFF>>>,EFFECT_PLI_OFF>,TransitionEffectL<TrConcat<TrWipe<100>,HaltRed,TrDelayX<WavLen<EFFECT_DESTRUCT>>>,EFFECT_DESTRUCT>,TransitionEffectL<TrConcat<TrWipe<100>,MoltenCore,TrDelayX<WavLen<EFFECT_BOOM>>>,EFFECT_BOOM>>";
  }
  FIND("style").value = str;

  Run();
  DoLayerize();

  // Bind a vertex buffer with a single triangle
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  var bufferData = new Float32Array([
       -1.0, -1.0, 1.0, -1.0, -1.0,  1.0, 1.0, 1.0]);
  gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(shaderProgram.a_position);
  gl.vertexAttribPointer(shaderProgram.a_position, 2, gl.FLOAT, false, 0, 0);

  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Start the event loop.
  tick();
}

function onPageLoad() {
  initGL();
  updateLockupDropdown();
  rebuildMoreEffectsMenu();
  structuredView = FIND("structured_view");
  all_saved_states.forEach(state => {
    state.onload();
  });

const pageLeft = document.querySelector('.page-left');
const splitter = document.getElementById('splitter');

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

  // Welcome click for unlocking audio
  const startOverlay = document.getElementById('start-overlay');
  startOverlay.style.display = 'flex';
  startOverlay.onclick = function () {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startOverlay.style.display = 'none';
  };
}

function handleSettings(checkbox) {
  var state = state_by_checkbox.get(checkbox);
  state.set(!state.get());
}

// User can choose one or the other
function handleWavLenControls() {
  var wavlenLabel = document.querySelector('.wavlen-global-label');
  var wavlenInput = document.getElementById('WAVLEN_VALUE');

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
