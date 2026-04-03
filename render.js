import {VRButton} from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from "three/examples/jsm/loaders/RGBELoader";
// import {PMREMGenerator} from "three/src/extras/PMREMGenerator";
// var EquirectangularToCubemap = require( 'three.equirectangular-to-cubemap' );
import { Vector3 } from 'three/src/math/Vector3.js';
import { Vector2 } from 'three/src/math/Vector2.js';
import { Float32BufferAttribute } from 'three/src/core/BufferAttribute.js';
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
// import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';

// let origin;
// window.origin = origin;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 14, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(0, 1.6, 0);

window.camera = camera;

window.fullscreenActive = false;
let normalHeight = null;
window.enlargeCanvas = false;

const pageLeft = document.querySelector('.page-left');
var CANVAS = document.getElementById("canvas_id");
const renderer = new THREE.WebGLRenderer( { canvas: CANVAS, antialias: true });
renderer.xr.enabled = true;
window.renderer = renderer;

//document.body.appendChild(VRButton.createButton(renderer));
renderer.setSize( CANVAS.clientWidth, CANVAS.clientHeight );
//document.body.appendChild( renderer.domElement );

// if (!origin) {
// const geometry = new THREE.SphereGeometry(1.5, 16, 16); // or even 0.5 for small
//   const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
//   origin = new THREE.Mesh(geometry, material);
//   scene.add(origin);
// }

let bgPlane = null;
let bgMaterial = null;
let bgUniforms = null;

function createBgPlane() {
  // depth of the plane (same as  .position.z)
  const planeZ = -300;

  // compute world-space height of the frustum at that depth
  const vFOV  = THREE.MathUtils.degToRad( camera.fov );               // vertical FOV in radians
  const height = 2 * Math.tan( vFOV / 2 ) * Math.abs( planeZ );      // full frustum height

  // compute width from aspect
  const width  = height * camera.aspect;

  // add some extra vertical overhang (here 50% taller than the view)
  const extra = 1.5; 

  if (bgPlane) {
    scene.remove(bgPlane);
    bgPlane.geometry.dispose();
  }

  bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry( width, height * extra ),
    bgMaterial
  );
  bgPlane.position.set(0, 1.6, planeZ);
  scene.add(bgPlane);
  bgPlane.visible = (window.showBackground !== false);
  window.bgPlane = bgPlane;
}

function getDesiredCanvasSize() {
  if (window.fullscreenActive) {
    // If we're fullscreen, base size on the actual fullscreen element
    const fullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    let rect;
    if (fullscreen) {
      rect = fullscreen.getBoundingClientRect();
    } else {
      rect = { width: window.innerWidth, height: window.innerHeight };
    }
    return {
      width: Math.floor(rect.width),
      height: Math.floor(rect.height)
    };
  }

  // Normal / Enlarge
  const width = pageLeft ? pageLeft.offsetWidth : window.innerWidth * 2 / 3;
  let height;
  if (enlargeCanvas) {
    height = window.innerHeight / 1.5;
  } else {
    height = window.innerHeight / 2.2;
  }
  return { width, height };
}

function resizeCanvasAndCamera() {
  const { width, height } = getDesiredCanvasSize();
  renderer.setSize(width, height, true);
  camera.aspect = width / height;

// Use width for resizing, not height
const visualDistance = 150; // manually tuned to fit nicely
const fitFov = 2 * THREE.MathUtils.radToDeg(
// Saber length in units = 100
  Math.atan((100.0 / camera.aspect) / (2 * visualDistance))
);
camera.fov = fitFov;

  camera.updateProjectionMatrix();
  normalHeight = window.innerHeight / 3;
}
window.resizeCanvasAndCamera = resizeCanvasAndCamera;


const bloom = false;

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 4, 1, 2.5);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);

if (bloom) {
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
}

var hilt;
var blade;
var blade_aura;
var blade_tip;

THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping(vec3 color) {
     color += vec3(dot(max(color - vec3(1), vec3(0)), vec3(0.33)));
     return color;
   }`
);

renderer.toneMapping = THREE.CustomToneMapping;

// Generates a standalone bullet-tip cap geometry, base ring at y=0, apex pointing in -y.
// Matches the shape of generateCap(true) in BladeGeometry (same tipPower / tipScaleY).
function makeTipCapGeometry(radius, radialSegments) {
  const tipPower  = 1.2;
  const tipScaleY = 2.20;
  const segments  = Math.floor(radialSegments / 4);

  const verts = [], norms = [], uvArr = [], idxArr = [];
  let idx = 0;
  const rings = [];

  // Base ring — sits flush with the open end of the cylinder
  const baseRing = [];
  for (let x = 0; x < radialSegments; x++) {
    const theta = (x / radialSegments) * Math.PI * 2;
    const sinT = Math.sin(theta), cosT = Math.cos(theta);
    verts.push(radius * sinT, 0, radius * cosT);
    norms.push(sinT, 0, cosT);
    uvArr.push(0.5, 1.0);
    baseRing.push(idx++);
  }
  baseRing.push(baseRing[0]);
  rings.push(baseRing);

  // Intermediate rings — same bullet-profile maths as BladeGeometry.generateCap
  for (let y = 1; y < segments; y++) {
    const angle = y * Math.PI / 2 / segments;
    const sinA  = Math.sin(angle), cosA = Math.cos(angle);
    const sinP  = Math.pow(sinA, tipPower);
    const cosP  = Math.pow(cosA, tipPower);
    const ring  = [];
    for (let x = 0; x < radialSegments; x++) {
      const theta = (x / radialSegments) * Math.PI * 2;
      const sinT  = Math.sin(theta), cosT = Math.cos(theta);
      verts.push(radius * sinT * cosP, -(sinP * radius * tipScaleY), radius * cosT * cosP);
      const nx = sinT * cosP, ny = sinP, nz = cosT * cosP;
      const nl = Math.sqrt(nx*nx + ny*ny + nz*nz);
      norms.push(nx/nl, -ny/nl, nz/nl);
      uvArr.push(0.5, 1.0);
      ring.push(idx++);
    }
    ring.push(ring[0]);
    rings.push(ring);
  }

  // Apex
  verts.push(0, -radius, 0);
  norms.push(0, -1, 0);
  uvArr.push(0.5, 1.0);
  const apexRing = [];
  for (let x = 0; x <= radialSegments; x++) apexRing.push(idx);
  idx++;
  rings.push(apexRing);

  // Build faces — winding matches bottom-cap (pointing -y) of BladeGeometry
  for (let y = 0; y < rings.length - 1; y++) {
    for (let x = 0; x < radialSegments; x++) {
      const a = rings[y][x], b = rings[y+1][x], c = rings[y+1][x+1], d = rings[y][x+1];
      idxArr.push(a, b, d);
      if (y < rings.length - 2) idxArr.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setIndex(idxArr);
  geom.setAttribute('position', new Float32BufferAttribute(verts, 3));
  geom.setAttribute('normal',   new Float32BufferAttribute(norms, 3));
  geom.setAttribute('uv',       new Float32BufferAttribute(uvArr, 2));
  return geom;
}

class BladeGeometry extends THREE.BufferGeometry {

  constructor( radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2 ) {
    super();
    this.type = 'CylinderGeometry';
    this.parameters = {
      radiusTop: radiusTop,
      radiusBottom: radiusBottom,
      height: height,
      radialSegments: radialSegments,
      heightSegments: heightSegments,
      openEnded: openEnded,
      thetaStart: thetaStart,
      thetaLength: thetaLength
    };

    const scope = this;

    radialSegments = Math.floor( radialSegments );
    heightSegments = Math.floor( heightSegments );

    // buffers
    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    // helper variables
    let index = 0;
    const indexArray = [];
    const halfHeight = height / 2;
    let groupStart = 0;

    // generate geometry
    generateTorso();

    if ( openEnded === false ) {
      if ( radiusTop > 0 ) generateCap( true );
      if ( radiusBottom > 0 ) generateCap( false );
    }

    // build geometry
    this.setIndex( indices );
    this.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
    this.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
    this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

    function generateTorso() {

      const normal = new Vector3();
      const vertex = new Vector3();

      let groupCount = 0;

      // this will be used to calculate the normal
      const slope = ( radiusBottom - radiusTop ) / height;

      // generate vertices, normals and uvs
      for ( let y = 0; y <= heightSegments; y ++ ) {
        const indexRow = [];
        const v = y / heightSegments;

        // calculate the radius of the current row
        const radius = v * ( radiusBottom - radiusTop ) + radiusTop;
        for ( let x = 0; x < radialSegments; x ++ ) {
          const u = x / radialSegments;
          const theta = u * thetaLength + thetaStart;
          const sinTheta = Math.sin( theta );
          const cosTheta = Math.cos( theta );

          // vertex
          vertex.x = radius * sinTheta;
          vertex.y = - v * height + halfHeight;
          vertex.z = radius * cosTheta;
          vertices.push( vertex.x, vertex.y, vertex.z );

          // normal
          normal.set( sinTheta, slope, cosTheta ).normalize();
          normals.push( normal.x, normal.y, normal.z );

          // uv
          uvs.push( 0.5,  1 - v );

          // save index of vertex in respective row
          indexRow.push( index ++ );
        }
        indexRow.push(indexRow[0]);

        // now save vertices of the row in our index array
        indexArray.push( indexRow );
      }

      // generate indices
      for ( let x = 0; x < radialSegments; x ++ ) {
        for ( let y = 0; y < heightSegments; y ++ ) {

          // we use the index array to access the correct indices
          const a = indexArray[ y ][ x ];
          const b = indexArray[ y + 1 ][ x ];
          const c = indexArray[ y + 1 ][ x + 1 ];
          const d = indexArray[ y ][ x + 1 ];

          // faces
          if ( radiusTop > 0 || y !== 0 ) {
            indices.push( a, b, d );
            groupCount += 3;
          }

          if ( radiusBottom > 0 || y !== heightSegments - 1 ) {
            indices.push( b, c, d );
            groupCount += 3;
          }
        }
      }

      // add a group to the geometry. this will ensure multi material support
      scope.addGroup( groupStart, groupCount, 0 );

      // calculate new start value for groups
      groupStart += groupCount;
    }

    function generateCap( top ) {
      const normal = new Vector3();

      // save the index of the first center vertex
      const centerIndexStart = index;

      const uv = new Vector2();
      const vertex = new Vector3();

      let groupCount = 0;

      const radius = ( top === true ) ? radiusTop : radiusBottom;
      const sign = ( top === true ) ? 1 : - 1;
      // --- bullet-tip tuning ---
      const tipPower   = 1.2;  // >1 sharpens the tip; try 1.6–2.2
      const tipScaleY  = 2.20; // >1 elongates the tip slightly along Y

      const capIndex = [];
      capIndex.push( indexArray[ top ? 0 : heightSegments] )
      const segments = Math.floor(radialSegments / 4);

      for (let y = 1; y < segments; y++) {
        const indexRow = [];
        const angle = y * Math.PI / 2 / segments;
        const sinAngle = Math.sin( angle );
        const cosAngle = Math.cos( angle );

        for ( let x = 0; x < radialSegments; x ++ ) {
          const u = x / radialSegments;
          const theta = u * thetaLength + thetaStart;
          const sinTheta = Math.sin( theta );
          const cosTheta = Math.cos( theta );

          // vertex.x = radius * sinTheta * cosAngle;
          // vertex.y = (halfHeight + sinAngle * radius) * sign;
          // vertex.z = radius * cosTheta * cosAngle;
        // remap hemisphere (sin/cos) → bullet-ish profile
        const sinP = Math.pow(sinAngle, tipPower);
        const cosP = Math.pow(cosAngle, tipPower);
        vertex.x = radius * sinTheta * cosP;
        vertex.y = (halfHeight + sinP * radius * tipScaleY) * sign;
        vertex.z = radius * cosTheta * cosP;
          vertices.push( vertex.x, vertex.y, vertex.z );

          // normal.set(sinTheta * cosAngle, sinAngle, cosTheta * cosAngle).normalize();
        // approximate normal from the same remap (good enough for smooth shading?)
        normal.set(sinTheta * cosP, sinP, cosTheta * cosP).normalize();
          normals.push(normal.x, normal.y, normal.z);

          uvs.push(0.5, top ? 1.0 : 0.0);

          indexRow.push(index++);
        }

        indexRow.push(indexRow[0]);
        capIndex.push(indexRow);
      }

      vertices.push(0, (halfHeight + radius) * sign, 0);
      normals.push(0, sign, 0);
      uvs.push(0.5, top ? 1.0 : 0.0);
      const indexRow = [];
      for ( let x = 0; x <= radialSegments; x ++ ) indexRow.push(index);
      index++;
      capIndex.push(indexRow);

      for (let y = 0; y < segments; y++) {
        for (let x = 0; x < radialSegments; x++) {
          const a = capIndex[y][x];
          const b = capIndex[y + 1][x];
          const c = capIndex[y + 1][x + 1];
          const d = capIndex[y][x + 1];

          if (top) {
            indices.push(d, b, a);
          } else {
            indices.push(a, b, d);
          }
          groupCount += 3;

          if (y !== segments - 1) {
            if (top) {
              indices.push(d, c, b);
            } else {
              indices.push(b, c, d);
            }
            groupCount += 3;
          }
        }
      }

      // add a group to the geometry. this will ensure multi material support
      scope.addGroup( groupStart, groupCount, top === true ? 1 : 2 );

      // calculate new start value for groups
      groupStart += groupCount;
    }
  }

  copy( source ) {
    super.copy( source );
    this.parameters = Object.assign( {}, source.parameters );
    return this;
  }

  static fromJSON( data ) {
    return new BladeGeometry( data.radiusTop, data.radiusBottom, data.height, data.radialSegments, data.heightSegments, data.openEnded, data.thetaStart, data.thetaLength );
  }
};

//
// Halo
//
const bladeHaloVertexShader = `
  varying vec3   vA;
  varying vec3   vB;
  varying vec3   vTarget;

  vec3 PD(vec4 p) { return p.xyz; }

  void main() {
    vA          = PD(viewMatrix * modelMatrix * vec4(  0.0, -75.0, 0.0, 1.0));
    vB          = PD(viewMatrix * modelMatrix * vec4(  0.0,  35.0, 0.0, 1.0));
    vTarget     = PD(viewMatrix * modelMatrix * vec4(position,     1.0));
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const bladeHaloFragmentShader = `
  varying vec3        vA;
  varying vec3        vB;
  varying vec3        vTarget;
  uniform sampler2D   iChannel0;
  uniform float       uBladeScale;

  float line_dist(vec3 pt1, vec3 dir1, vec3 pt2, vec3 dir2) {
    vec3 n = normalize(cross(dir1, dir2));
    return abs(dot(n, pt1 - pt2));
  }

  struct Ray   { vec3 start, dir; };
  struct Plane { vec3 pos, normal; };
  struct Range { float begin, end; };

  #define NOHIT 1000.0
  float FAR()          { return NOHIT; }
  float NEAR()         { return 0.0; }
  Range Everything()   { return Range(NEAR(), FAR()); }
  Range Nothing()      { return Range(FAR(), NEAR()); }
  float Max(float a, float b) { return max(a, b); }
  float Min(float a, float b) { return min(a, b); }
  bool  Empty(Range a)          { return a.begin >= a.end; }

  Range Intersect(Range a, Range b) {
    if (Empty(a)) return Nothing();
    if (Empty(b)) return Nothing();
    Range ret = Range(Max(a.begin, b.begin), Min(a.end, b.end));
    if (Empty(ret)) return Nothing();
    return ret;
  }

  Range Trace(Ray ray, Plane o) {
    vec3 pos    = o.pos;
    vec3 normal = o.normal;
    float tmp   = dot(pos - ray.start, normal);
    float div   = dot(ray.dir,    normal);
    if (div == 0.0) {
      if (tmp > 0.0) return Everything();
      else            return Nothing();
    }
    float dist = tmp / div;
    if (div > 0.0) return Range(NEAR(), dist);
    else           return Range(dist, FAR());
  }

  float blade_dist(vec3 pt1, vec3 dir1_un) {
    vec3 dir1 = normalize(dir1_un);
    vec3 pt2   = vA;
    vec3 dir2  = vB - vA;
    vec3 n     = normalize(cross(dir1, dir2));
    vec3 Q     = normalize(cross(n, dir1));
    float p    = clamp(Trace(Ray(vA, dir2), Plane(pt1, Q)).end, 0.0, 1.0);
    vec3 bp    = pt2 + dir2 * p;
    float q    = dot(bp - pt1, dir1);
    vec3 rp    = pt1 + dir1 * q;
    return length(bp - rp);
  }

  float get_point(vec3 pt1, vec3 dir1_un) {
    vec3 dir1 = normalize(dir1_un);
    vec3 pt2   = vA;
    vec3 dir2  = vB - vA;
    vec3 n     = normalize(cross(dir1, dir2));
    vec3 Q     = normalize(cross(n, dir1));
    float p    = clamp(Trace(Ray(vA, dir2), Plane(pt1, Q)).end, 0.0, 1.0);
    return p;
  }

  void main() {
    vec3  eye       = vec3(0.0, 0.0, 0.0);
    vec3  dir       = vTarget - eye;
    float dist      = blade_dist(eye, dir);
    float flyby_pt  = get_point(eye, dir);
    float cosA      = length(cross(normalize(vB - vA), normalize(dir)));
    dist           /= 30.0;
    vec3  haze_color = texture2D(
      iChannel0,
      vec2(1.0 - flyby_pt, sqrt(dist) / 2.0 / cosA)
    ).rgb;
    // vec3 haze_color = texture2D(iChannel0, vec2(flyby_pt, 1.0)).rgb;
//    haze_color    /= (dist * dist * dist * dist * 500.0 + 1.0);  // FH
    haze_color /= (dist * dist * 30.0 + 1.0);  // BC likey
    // haze_color *= 1.0 - sqrt(dist);
    gl_FragColor = vec4(haze_color, 1.0);
  }
`;

// good point

const max_haze_depth = 8;
const blade_data =  new Uint8Array(4 * 144);
const haze_data =  new Uint8Array(4 * 144 * max_haze_depth);
var blade_texture;
var haze_texture;
const TRAIL_LENGTH = 100;  // ~100
let bladeTrailMeshes = [];
window.bladeTrailTransforms = [];
let bladeTrailMeshesReady = false;
let trailCaptureInterval = 2;
const LERP_STEPS = 50;  //40-50 else it's distinct repeats
let frameCounter = 0;
const trailSpeedThreshold = 120;  // 120
let wasOverTrailThreshold = false;
// let framesBelow = 0;  // how many consecutive frames we’ve been under the speed threshold

function lerpMatrix4(m1, m2, alpha) {
  // Decompose matrices into position, quaternion, scale
  const pos1 = new THREE.Vector3(), quat1 = new THREE.Quaternion(), scale1 = new THREE.Vector3();
  m1.decompose(pos1, quat1, scale1);
  const pos2 = new THREE.Vector3(), quat2 = new THREE.Quaternion(), scale2 = new THREE.Vector3();
  m2.decompose(pos2, quat2, scale2);
  const mLerp = new THREE.Matrix4();
  mLerp.compose(
    pos1.clone().lerp(pos2, alpha),
    quat1.clone().slerp(quat2, alpha),
    scale1.clone().lerp(scale2, alpha)
  );
  return mLerp;
}

var loader = new RGBELoader().setPath('./');
// loader.load('ostrich_road_2k.hdr', function(texture) {
// loader.load('hallway_sky2.hdr', function(texture) {
loader.load('1965hallway_sky.hdr', function(texture) {

  texture.mapping = THREE.EquirectangularReflectionMapping;
  //  scene.background = texture;
  var envMap = texture;

  // Background “painting” behind the saber
  bgUniforms = {
    envMap: { value: envMap },
    zoom: { value: 2.1 },  // >1 zooms in <1 zooms out
    brightness: { value: 3.0 }
  };

  bgMaterial = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D envMap;
      uniform float zoom;
      uniform float brightness;
      varying vec2 vUv;
      void main() {
        vec2 uv = (vUv - 0.5) / zoom + 0.5;
        vec3 color = texture(envMap, uv).rgb;
        color *= brightness; // brighten
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthWrite: false
  });
createBgPlane(); 

  const gltf_loader = new GLTFLoader();
  gltf_loader.load('obi/scene.gltf', function(gltf) {
    gltf.scene.traverse(function(child) {
      if (child.isMesh) {
        // console.log("MESH");
        child.material.envMap = envMap;
      }
    });

    scene.add(gltf.scene);
    hilt = gltf.scene;
    window.hilt = hilt;
    hilt.position.set(0, 1.6, -200);  // turns out this isn't used?

    if (true) {
      // create a buffer with color data

      const width  = 1;
      const height = 144;
      const size   = width * height;

      blade_texture = new THREE.DataTexture(blade_data, width, height);
      blade_texture.colorSpace      = THREE.LinearSRGBColorSpace;
      blade_texture.generateMipmaps = false;
      blade_texture.magFilter       = THREE.LinearFilter;
      blade_texture.minFilter       = THREE.LinearFilter;
      blade_texture.needsUpdate     = true;

      haze_texture = new THREE.DataTexture(haze_data, height, max_haze_depth);
      haze_texture.colorSpace      = THREE.LinearSRGBColorSpace;
      haze_texture.generateMipmaps = false;
      haze_texture.magFilter       = THREE.LinearFilter;
      haze_texture.minFilter       = THREE.LinearFilter;
      haze_texture.needsUpdate     = true;

      const blade_translation = new THREE.Matrix4()
        .makeTranslation(0.0, -20, 0.0)
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI));

      const blade_geometry = new BladeGeometry(1.3, 1.3, 110, 64, 1, true); // openEnded — tip cap is a separate mesh
      blade_geometry.applyMatrix4(blade_translation);

      const blade_material = new THREE.MeshStandardMaterial({
        color:             0xCCCCCC,
        emissiveMap:       blade_texture,
        emissiveIntensity: 1.7,
        emissive:          0xffffffff,
        envMap:            envMap
      });

      blade = new THREE.Mesh(blade_geometry, blade_material);
      hilt.add(blade);

      // Tip cap — separate mesh so it never gets Y-scaled with the cylinder
      const blade_tip_geometry = makeTipCapGeometry(1.3, 64);
      const blade_tip_material = new THREE.MeshStandardMaterial({
        color:             0xCCCCCC,
        emissiveMap:       blade_texture,
        emissiveIntensity: 1.7,
        emissive:          0xffffffff,
        envMap:            envMap
      });
      blade_tip = new THREE.Mesh(blade_tip_geometry, blade_tip_material);
      hilt.add(blade_tip);

      // Trail
      for (let i = 0; i < TRAIL_LENGTH; ++i) {
        const trailMat = new THREE.MeshBasicMaterial({
          map: blade_texture,              // use the same live texture as the blade
          transparent: true,
          opacity: 0.6,                    // base; we’ll fade per-ghost below
          blending: THREE.AdditiveBlending,
          depthWrite: false,               // avoid z-fighting between ghosts
          side: THREE.DoubleSide           // optional, in case  geom is single-sided
        });

        const trailBlade = new THREE.Mesh(blade_geometry, trailMat);
        scene.add(trailBlade);
        bladeTrailMeshes.push(trailBlade);
      }
      bladeTrailMeshesReady = true;

      const blade_aura_geometry = new BladeGeometry(50, 50, 110, 16, 1);
      blade_aura_geometry.applyMatrix4(blade_translation);

      const blade_aura_material = new THREE.MeshStandardMaterial({
        color:             0x11111111,
        opacity:           0.1,
        transparent:       true,
        emissiveMap:       blade_texture,
        emissiveIntensity: 0.1,
        emissive:          0xffffffff,
        envMap:            envMap
      });

      const bladeHaloUniforms = {
        // iTime:       { value: 0 },
        // iResolution: { value: new THREE.Vector3(1, 1, 1) },
        iChannel0:     { value: haze_texture },
        uBladeScale:   { value: 1 }
      };

      const blade_halo_material = new THREE.ShaderMaterial({
        vertexShader:   bladeHaloVertexShader,
        fragmentShader: bladeHaloFragmentShader,
        uniforms:       bladeHaloUniforms,
        transparent:    true,
        blending:       THREE.AdditiveBlending
      });

      blade_aura = new THREE.Mesh(blade_aura_geometry, blade_halo_material);
      hilt.add(blade_aura);
    }
  }, undefined, function(error) {
    console.error(error);
  });
});


if (false) {
  const geometry = new THREE.BoxGeometry( 1, 1, 1 );
  const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
  const cube = new THREE.Mesh( geometry, material );
  scene.add( cube );
}

if (false) {
  const gltf_loader = new GLTFLoader();
  gltf_loader.load( 'public/obi/scene.gltf', function ( gltf ) {
    scene.add( gltf.scene );
  }, undefined, function ( error ) {
    console.error( error );
  } );
}
// camera.position.z = 200;

var Q = 0;

const start_millis = new Date().getTime();
function actual_millis() {
  return new Date().getTime() - start_millis;
}

function animate() {
  if (!bladeTrailMeshesReady) return;

  // Ensure arrays exist
  window.bladeTrailTransforms = window.bladeTrailTransforms || [];
  bladeTrailMeshes            = bladeTrailMeshes            || [];

  resizeCanvasAndCamera();
  Q++;

  // --- LED + haze update (unchanged) ---
  if (blade_texture) {
    const pixels = window.getSaberColors();
    // Stretch the N active LEDs across all 144 texture rows so the full scaled cylinder
    // shows lit pixels from hilt to tip rather than leaving the tip end dark.
    const activeLEDs = Math.max(1, window.STATE_NUM_LEDS || 144);
    for (let i = 0; i < 144; i++) {
      const srcIdx = Math.min(Math.floor(i * activeLEDs / 144), activeLEDs - 1);
      const stride = i * 4;
      blade_data[stride    ] = Math.round(255 * pixels[srcIdx*3    ]);
      blade_data[stride + 1] = Math.round(255 * pixels[srcIdx*3 + 1]);
      blade_data[stride + 2] = Math.round(255 * pixels[srcIdx*3 + 2]);
      blade_data[stride + 3] = 255;
    }
    blade_texture.needsUpdate = true;

    // Stretch the N active LEDs across all 144 haze columns, same as blade_data,
    // so the glow at the cylinder tip samples the bright tip LED (not dark unused LEDs).
    for (let depth = 0; depth < max_haze_depth; depth++) {
      for (let i = 0; i < 144; i++) {
        const centerLED = Math.min(Math.floor(i * activeLEDs / 144), activeLEDs - 1);
        let R = 0, G = 0, B = 0, W = 0;
        const haze_dist = 1 + 4 * depth;
        for (let D = -64; D <= 64; D++) {
          let p = centerLED + D;
          if (p < 0 || p >= activeLEDs) continue;
          const dist = (Math.abs(D) + 1) / haze_dist + 1;
          const wgt  = 1 / (dist * dist);
          R += pixels[p*3    ] * wgt;
          G += pixels[p*3 + 1] * wgt;
          B += pixels[p*3 + 2] * wgt;
          W += wgt;
        }
        R /= W; G /= W; B /= W;
        const off = (i + depth * 144) * 4;
        haze_data[off    ] = Math.round(R * 255);
        haze_data[off + 1] = Math.round(G * 255);
        haze_data[off + 2] = Math.round(B * 255);
        haze_data[off + 3] = 255;
      }
    }
    haze_texture.needsUpdate = true;
  }

  // Smooth home‐reset
  if (HOME_POS) {
    let done = true;
    for (let i = 0; i < MOVE_MATRIX.values.length; i++) {
      const diff = default_move_matrix().values[i] - MOVE_MATRIX.values[i];
      MOVE_MATRIX.values[i] += diff * 0.15;
      if (Math.abs(diff) > 1) done = false;
    }
    if (done) {
      HOME_POS  = false;
      MOVE_MATRIX = default_move_matrix();
    }
  }

  const trailsEnabled = !!window.showBladeTrails && IN_FRAME;
  if (!trailsEnabled) {
    bladeTrailMeshes.forEach(m => { m.visible = false; });
    window.bladeTrailTransforms.length = 0;
    // framesBelow = 0;
    wasOverTrailThreshold = false;
  }

  // Trail thresholds
  const START_TH = trailSpeedThreshold;
  const STOP_TH  = (window.trailStopThreshold || START_TH * 0.6);

  // Update hilt (always), capture/decay trails only when enabled
  if (hilt && blade) {
    const bladeScale = (window.STATE_NUM_LEDS || 144) / 144;
    blade.scale.y = bladeScale;
    blade.position.y = 35 * (1 - bladeScale);
    if (blade_aura) {
      blade_aura.scale.y = bladeScale;
      blade_aura.position.y = 35 * (1 - bladeScale);
      blade_aura.material.uniforms.uBladeScale.value = bladeScale;
    }
    // Keep the tip cap at the end of the scaled cylinder, without squashing it
    if (blade_tip) {
      blade_tip.position.y = 35 - 110 * bladeScale;
    }

    const mat = window.getSaberMove();
    hilt.matrixAutoUpdate = false;
    hilt.matrix.fromArray(mat.values);
    hilt.updateMatrixWorld(true);

    frameCounter++;

    const spd = Math.max(0, lastSwingSpeed);
    const overThreshold = spd > START_TH;
    const coastCaptureInterval = Math.max(2, trailCaptureInterval * 2);

    if (trailsEnabled) {
      if (overThreshold) {
        // // Prevent “retro” trails on rising edge
        // if (!wasOverTrailThreshold && framesBelow >= 4) {
        //   window.bladeTrailTransforms.length = 0;
        //  console.log("********************* HERE **********");
        // }
        // framesBelow = 0;

        // Record only while fast
        if (frameCounter % trailCaptureInterval === 0) {
          const s = Math.max(0, Math.min(1, (spd - START_TH) / START_TH));
          blade.updateMatrixWorld(true);
          window.bladeTrailTransforms.push({ m: blade.matrixWorld.clone(), t: performance.now(), s });
          if (window.bladeTrailTransforms.length > TRAIL_LENGTH) {
            window.bladeTrailTransforms.shift();
          }
        }
      } else {
        // Under start threshold: do not hard‑clear; coast until truly slow
        // framesBelow++;

        // While above STOP_TH, keep capturing but at a lower cadence
        if (spd > STOP_TH && (frameCounter % coastCaptureInterval === 0)) {
          const s = Math.max(0, Math.min(1, (spd - START_TH) / START_TH));
          blade.updateMatrixWorld(true);
          window.bladeTrailTransforms.push({ m: blade.matrixWorld.clone(), t: performance.now(), s });
          if (window.bladeTrailTransforms.length > TRAIL_LENGTH) {
            window.bladeTrailTransforms.shift();
          }
        }

        // Gentle decay of very old frames while slow
        if (window.bladeTrailTransforms.length && frameCounter % 12 === 0) {
          window.bladeTrailTransforms.shift();
        }
      }

      wasOverTrailThreshold = overThreshold;
    }
  }

  // Reset blade trail visibility every frame before rendering !important!
  bladeTrailMeshes.forEach(m => m.visible = false);

  // Hysteresis for showing trails (start vs stop)
  window.renderTrailsActive = window.renderTrailsActive || false;
  window.renderTrailsActive = lastSwingSpeed > (window.renderTrailsActive ? STOP_TH : START_TH);


  // Only render trails if toggle is ON, we’re “active”, and we have data
  if (trailsEnabled &&
    window.renderTrailsActive &&
    window.bladeTrailTransforms.length > 1 &&
    bladeTrailMeshes.length > 0) {

    const baseLocal = new THREE.Vector3(0, 35, 0);
    const tipLocal  = new THREE.Vector3(0, -75, 0);

    // Track current emitter position for anchor
    const currentBaseWorld = baseLocal.clone().applyMatrix4(blade.matrixWorld);

    // Interpolate trail matrices; also carry timestamps and strength
    const VM  = [];
    const VMt = [];
    const VMs = [];
    const T   = window.bladeTrailTransforms; // [{ m, t, s }, ...]

    if (T.length === 1) {
      VM.push(T[0].m); VMt.push(T[0].t); VMs.push(T[0].s ?? 1.0);
    } else {
      for (let i = 0; i < T.length - 1; i++) {
        VM.push(T[i].m);  VMt.push(T[i].t);  VMs.push(T[i].s ?? 1.0);
        for (let s = 1; s <= LERP_STEPS; s++) {
          const u = s / (LERP_STEPS + 1);
          VM.push(lerpMatrix4(T[i].m, T[i+1].m, u));
          VMt.push(T[i].t + u * (T[i+1].t - T[i].t));           // interpolated time
          VMs.push((T[i].s ?? 1.0) + u * ((T[i+1].s ?? 1.0) - (T[i].s ?? 1.0))); // interpolated strength
        }
      }
      VM.push(T[T.length - 1].m);
      VMt.push(T[T.length - 1].t);
      VMs.push(T[T.length - 1].s ?? 1.0);
    }

    // Constants for fading & pruning (hard-coded)
    const now      = performance.now();
    const FADE_MS  = 1000;   // time from full → 0 opacity per ghost
    const BASE_OPA = 0.90;  // starting opacity
    const PRUNE_MS = FADE_MS * 2;

    // Prune totally invisible source frames
    const cutoff = now - PRUNE_MS;
    while (window.bladeTrailTransforms.length &&
           window.bladeTrailTransforms[0].t < cutoff) {
      window.bladeTrailTransforms.shift();
    }

    // Render most-recent ghosts first; fade by age and scale by speed strength
    const meshes = bladeTrailMeshes;
    const count  = Math.min(meshes.length, VM.length);

    for (let k = 0; k < count; k++) {
      const idx = VM.length - 1 - k;     // newest first
      const ghostMat = VM[idx];

      // Pose from recorded frame (anchor locked to recorded base for stability)
      const oldBaseWorld = baseLocal.clone().applyMatrix4(ghostMat);
      const oldTipWorld  = tipLocal.clone().applyMatrix4(ghostMat);
      // const anchor       = oldBaseWorld;
      // Keep anchored at emitter end, but slightly loose to maintain taper
      const anchor  = oldBaseWorld.clone().lerp(currentBaseWorld, 0.5);

      const dir          = oldTipWorld.clone().sub(anchor).normalize();
      const quat         = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      // Extract the blade Y-scale baked into the captured matrix so trail ghosts
      // render at the same shortened length as the blade, not always full 144.
      const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
      ghostMat.decompose(_p, _q, _s);
      const trailScale   = _s.y;
      const offset       = new THREE.Vector3(0, 35 * trailScale, 0).applyQuaternion(quat);
      const m4           = new THREE.Matrix4().compose(anchor.clone().sub(offset), quat, new THREE.Vector3(1, trailScale, 1));

      const mesh = meshes[k];
      mesh.matrixAutoUpdate = false;
      mesh.visible          = true;
      mesh.matrix.copy(m4);

      // Age-based fade: ski-jump curve (fast initial drop, long tail)
      const ageMs = Math.max(0, now - VMt[idx]);
      const lifeT = Math.min(1, ageMs / FADE_MS);      // 0 → 1 over FADE_MS
      const fade  = Math.pow(1.0 - lifeT, 35);         // steep early, smooth tail

      // Speed-based strength (from recording): 0..1
      const strength = Math.max(0, Math.min(1, VMs[idx]));

      mesh.material.opacity = BASE_OPA * strength * fade;
      mesh.material.needsUpdate = true;

      if (mesh.material.opacity <= 0.01) mesh.visible = false;
    }

    // Hide extra meshes not used this frame
    for (let k = count; k < meshes.length; k++) {
      meshes[k].visible = false;
    }
  }

  // Final render - real blade always there
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
