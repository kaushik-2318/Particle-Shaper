const PARTICLE_COUNT = 8000;
const PARTICLE_SIZE = 0.15;
const SHAPE_SWITCH_COOLDOWN = 1500;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 50;
  targetPositions[i] = positions[i];
  colors[i] = 1;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: PARTICLE_SIZE,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  opacity: 0.8,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

function getSpherePoint(r) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi),
  };
}

const shapes = {
  sphere: (i) => {
    const p = getSpherePoint(10);
    return [p.x, p.y, p.z];
  },
  heart: (i) => {
    const t = Math.random() * Math.PI * 2;
    const u = Math.random() * Math.PI;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    const z = (Math.random() - 0.5) * 10;
    const scale = 0.6;
    return [x * scale, y * scale, z];
  },
  saturn: (i) => {
    const isRing = Math.random() > 0.6;
    if (isRing) {
      const theta = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 6;
      return [r * Math.cos(theta), Math.random() - 0.5, r * Math.sin(theta)];
    } else {
      const p = getSpherePoint(6);
      return [p.x, p.y, p.z];
    }
  },
  flower: (i) => {
    const theta = Math.random() * Math.PI * 2;
    const v = Math.random();
    const phi = Math.random() * Math.PI;
    const k = 4;
    const r = 10 * Math.cos(k * theta);
    return [
      r * Math.cos(theta),
      r * Math.sin(theta),
      (Math.random() - 0.5) * 5,
    ];
  },
  fireworks: (i) => {
    const p = getSpherePoint(1);
    const explodeScale = 20 * Math.random();
    return [p.x * explodeScale, p.y * explodeScale, p.z * explodeScale];
  },
};

let currentShape = "sphere";
const shapeKeys = Object.keys(shapes);
let shapeIndex = 0;

function updateTargetShape(shapeName) {
  currentShape = shapeName;
  document.getElementById("shape-name").innerText =
    shapeName.charAt(0).toUpperCase() + shapeName.slice(1);

  const positionsArray = geometry.attributes.position.array;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const coords = shapes[shapeName](i);
    targetPositions[i * 3] = coords[0];
    targetPositions[i * 3 + 1] = coords[1];
    targetPositions[i * 3 + 2] = coords[2];
  }
}

updateTargetShape("sphere");

const videoElement = document.getElementById("input_video");
let pinchStrength = 0;
let handX = 0.5;
let handY = 0.5;
let lastShapeSwitch = 0;

function onResults(results) {
  document.getElementById("loading").style.display = "none";

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];

    handX = 1 - landmarks[9].x;
    handY = landmarks[9].y;

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2)
    );

    let targetPinch = Math.max(0, Math.min(1, (distance - 0.02) * 4));
    pinchStrength += (targetPinch - pinchStrength) * 0.2;

    const isOpenHand =
      landmarks[8].y < landmarks[6].y &&
      landmarks[12].y < landmarks[10].y &&
      landmarks[16].y < landmarks[14].y &&
      landmarks[20].y < landmarks[18].y;

    const now = Date.now();
    if (
      isOpenHand &&
      distance > 0.15 &&
      now - lastShapeSwitch > SHAPE_SWITCH_COOLDOWN
    ) {
      shapeIndex = (shapeIndex + 1) % shapeKeys.length;
      updateTargetShape(shapeKeys[shapeIndex]);
      lastShapeSwitch = now;
    }
  }
}

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 320,
  height: 240,
});
cameraUtils.start();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();
  const positionsAttr = geometry.attributes.position;
  const colorsAttr = geometry.attributes.color;

  const expansionFactor = 0.5 + pinchStrength * 1.5;
  const rotSpeed = (handX - 0.5) * 2;

  particles.rotation.y += 0.005 + rotSpeed * 0.02;
  particles.rotation.z = (handY - 0.5) * 0.5;

  const baseHue = (time * 0.1 + handX) % 1.0;
  const colorObj = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const ix = i * 3;
    const iy = i * 3 + 1;
    const iz = i * 3 + 2;

    const lerpSpeed = 0.03 + Math.random() * 0.02;

    positions[ix] +=
      (targetPositions[ix] * expansionFactor - positions[ix]) * lerpSpeed;
    positions[iy] +=
      (targetPositions[iy] * expansionFactor - positions[iy]) * lerpSpeed;
    positions[iz] +=
      (targetPositions[iz] * expansionFactor - positions[iz]) * lerpSpeed;

    positions[ix] += Math.sin(time + positions[iy]) * 0.02;
    positions[iy] += Math.cos(time + positions[ix]) * 0.02;

    const dist = Math.sqrt(positions[ix] ** 2 + positions[iy] ** 2);
    colorObj.setHSL((baseHue + dist * 0.02) % 1.0, 0.8, 0.6);

    colors[ix] = colorObj.r;
    colors[iy] = colorObj.g;
    colors[iz] = colorObj.b;
  }

  positionsAttr.needsUpdate = true;
  colorsAttr.needsUpdate = true;

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
