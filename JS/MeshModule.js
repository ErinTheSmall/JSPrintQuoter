var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.setScalar(20);
var renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x404040);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var controls = new THREE.OrbitControls(camera, renderer.domElement);

var loader = new THREE.STLLoader();
loader.load('https://threejs.org/examples/models/stl/binary/pr2_head_pan.stl', function(geometry) {

  var mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true
  }));
  mesh.rotation.set(-Math.PI / 2, 0, 0);
  mesh.scale.setScalar(100);
  scene.add(mesh);

  console.log("stl volume is " + getVolume(geometry));
});

// check with known volume:
var hollowCylinderGeom = new THREE.LatheBufferGeometry([
  new THREE.Vector2(1, 0),
  new THREE.Vector2(2, 0),
  new THREE.Vector2(2, 2),
  new THREE.Vector2(1, 2),
  new THREE.Vector2(1, 0)
], 90).toNonIndexed();
console.log("pre-computed volume of a hollow cylinder (PI * (R^2 - r^2) * h): " + Math.PI * (Math.pow(2, 2) - Math.pow(1, 2)) * 2);
console.log("computed volume of a hollow cylinder: " + getVolume(hollowCylinderGeom));


function getVolume(geometry) {

  let position = geometry.attributes.position;
  let faces = position.count / 3;
  let sum = 0;
  let p1 = new THREE.Vector3(),
    p2 = new THREE.Vector3(),
    p3 = new THREE.Vector3();
  for (let i = 0; i < faces; i++) {
    p1.fromBufferAttribute(position, i * 3 + 0);
    p2.fromBufferAttribute(position, i * 3 + 1);
    p3.fromBufferAttribute(position, i * 3 + 2);
    sum += signedVolumeOfTriangle(p1, p2, p3);
  }
  return sum;

}

function signedVolumeOfTriangle(p1, p2, p3) {
  return p1.dot(p2.cross(p3)) / 6.0;
}

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});