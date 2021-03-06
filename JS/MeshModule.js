import * as THREE from '/node_modules/three/build/three.module.js';
import {STLLoader} from '/node_modules/three/examples/jsm/loaders/STLLoader.js'
import { CSS2DRenderer, CSS2DObject } from '/node_modules/three/examples/jsm/renderers/CSS2DRenderer.js';
import CameraControls from '/node_modules/camera-controls/dist/camera-controls.module.js'

let modelFile
document.getElementById ("3DModelUpload").addEventListener ("change", function () {
    let loaderDiv = document.getElementById("loaderContainer"); // re-add the loader div
    loaderDiv.style.opacity = "100";
    loaderDiv.style.pointerEvents = "auto";
    let reader = new FileReader();
    reader.readAsDataURL(this.files[0]);

    reader.addEventListener("load", function () {
        modelFile = reader.result;
        viewer();
    }, false);

});


function viewer() {

    let manager = new THREE.LoadingManager(); // create loadingmanager
    CameraControls.install( { THREE: THREE } ); // bind custom camera-controls library
    let clock = new THREE.Clock();

    let camera, cameraHome, scene, renderer, labelRenderer, cameraControls, crossSectionPlane;
    let scaleLabel, gridHelperSize;

    init();
    render();

    function init() {
        let canvasContainer = document.getElementById("canvasContainer"); // get label container div
        let renderCanvas = document.getElementById("canvas"); // get canvas div
        THREE.Object3D.DefaultUp.set(0, 0, 1); // set z up by default

        // camera

        camera = new THREE.PerspectiveCamera(70, canvasContainer.clientWidth/canvasContainer.clientHeight); // create new camera with width and height of the canvascontainer
        camera.position.set( -10, -10, 10 ); //set camera position to 50 to transition in when the boundingbox is computer in helpers()

        // renderer

        renderer = new THREE.WebGLRenderer({ canvas: renderCanvas, antialias: true, alpha: false } );
        renderer.localClippingEnabled = true;
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( canvasContainer.clientWidth, canvasContainer.clientHeight );

        // label renderer

        labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize( canvasContainer.clientWidth, canvasContainer.clientHeight );
        document.getElementById("labelContainer").innerHTML = ''; //clear previous instance
        labelContainer.appendChild( labelRenderer.domElement );


        //scene

        scene = new THREE.Scene();
        scene.background = new THREE.Color( 0x2a2a2a );
        while(scene.children.length > 0){  // remove previous scene if it exists
            scene.remove(scene.children[0]); 
        }
        scene.add(camera);


        let hemisphere = new THREE.HemisphereLight(0xffffff, 1,1,100);
        scene.add(hemisphere);
        let ambient = new THREE.AmbientLight( 0xffffff, 0.2 ); // soft white light
        scene.add( ambient );
        let point = new THREE.PointLight( 0xffffff, 0.5 );
        point.position.set(0,-5,0);
        camera.add(point); // add point light to the camera


        //controls

        cameraControls = new CameraControls( camera, renderer.domElement );



        //load mesh into scene

        function loadMesh(geometry) {

            geometry.computeBoundingBox();                    

            let material = new THREE.MeshPhongMaterial({ 
                color: 0x404A4C, 
                specular: 0x050505, 
                shininess: 50 ,
                clipShadows: true,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });
            let mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);

            let middle = new THREE.Vector3();
            geometry.boundingBox.getCenter(middle);
            mesh.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(-middle.x, -middle.y, -middle.z ));

            return mesh;

        }

        // grid and outline

        function helpers(geometry, mesh) {
            let largestDimension = Math.max(geometry.boundingBox.max.x, 
            geometry.boundingBox.max.y, 
            geometry.boundingBox.max.z) // calculate the largest dimensions


            let scaleFactor =1 / Math.pow(10, Math.round(largestDimension*2).toString().length - 1); // calculate how much smaller we need to scale the object (e.g: 20cm cube needs to be scaled down by 10 (* 0.1))

            let oneUnit = Math.pow(10, Math.round(largestDimension*2).toString().length - 1); // calculate the size of one unit before scaling down for display

            largestDimension = largestDimension * scaleFactor; // update largestDimension to reflect new scale
            geometry.scale(scaleFactor, scaleFactor, scaleFactor); //scale the geometry

            crossSectionPlane = new THREE.Plane(new THREE.Vector3(0, 0,-1), geometry.boundingBox.max.z + 0.01); // create clipping plane
            mesh.material.clippingPlanes = [crossSectionPlane]; // add the clipping plane to the model

            gridHelperSize = Math.ceil(largestDimension *2) + Math.ceil(largestDimension * 1.1) ; //size of largest axis + 10%x2 rounded up to 1 units

            camera.far = gridHelperSize * 5; // set the camera far clip plane
            camera.updateProjectionMatrix(); // updates the camera stuff so it works
            cameraControls.maxDistance = gridHelperSize * 4; // sets the max distance the user can move the camera out
            cameraControls.minDistance = 0.1; // set min distance so the scroll doesnt get "trapped" close
            cameraHome = new THREE.Vector3(-gridHelperSize, -gridHelperSize*1.1, gridHelperSize/2.5) //set the home point of the camera to global
            cameraControls.setLookAt(cameraHome.x, cameraHome.y, cameraHome.z, 0, 0, 0, false); // set camera position with slight offset and no transition so it slides into place
            cameraControls.dolly(2, false);
            cameraControls.addEventListener("update", onFirstRenderChanges);


            let edges = new THREE.EdgesGeometry(geometry, 75);
            let edgeGeom = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color: 0xacabab, clippingPlanes: [crossSectionPlane]}));
            edgeGeom.name = "edgeGeom";
            scene.add(edgeGeom); // edge highlighting

            let gridXZ = new THREE.GridHelper(gridHelperSize, gridHelperSize, 0xdedede, 0xffffff);
            gridXZ.rotation.x = Math.PI/2;
            gridXZ.position.set(0,0,-geometry.boundingBox.max.z - 0.001);
            scene.add(gridXZ); //gridhelper plane

            // making the scale label


            scaleLabel = makeLabel("scale",new THREE.Vector3(gridHelperSize/2 + 0.25,-gridHelperSize/2 + 0.5,-geometry.boundingBox.max.z), oneUnit + "mm") // make scale label

        }


        function crossSection(geometry, mesh) {

            let planes = [crossSectionPlane];                    
                // Set up the stencil materials

            let planeStencilMat = new THREE.MeshPhongMaterial({ //declare material of the plane stencil
                color: 0x606e71, 
                specular: 0x050505, 
                shininess: 50 ,
                clipShadows: true,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2
            });

            let stencilMats = initStencilMaterials(planeStencilMat);

            let backFaceStencilMat = stencilMats[0];
            let frontFaceStencilMat = stencilMats[1];
            planeStencilMat = stencilMats[2];

            // Clip the cylinder stencil materials
            frontFaceStencilMat.clippingPlanes = planes;
            backFaceStencilMat.clippingPlanes = planes;

                // Add the front face stencil
            let frontMesh = new THREE.Mesh(geometry, frontFaceStencilMat);
            frontMesh.rotation.copy(mesh.rotation);
            scene.add(frontMesh);

            // Add the back face stencil
            let backMesh = new THREE.Mesh(geometry, backFaceStencilMat);
            backMesh.rotation.copy(mesh.rotation);
            scene.add(backMesh);

            // Add the plane
            let planeGeom = new THREE.PlaneGeometry(geometry.boundingBox.max.x*2,geometry.boundingBox.max.y*2);
            let planeMesh = new THREE.Mesh(planeGeom, planeStencilMat);
            planeMesh.renderOrder = 1;
            planeMesh.visible = false;
            planeMesh.name = "crossSectionPlaneMesh";
            scene.add(planeMesh);

            crossSectionSlider.addEventListener('input', function() {

                let value = parseFloat(event.target.value);

                let factor = 1000 / (geometry.boundingBox.max.z * 2) //calculate how many times bigger 100 is than the size
                let currentZ = (value / factor) - geometry.boundingBox.max.z; //divide by that factor, to scale, then shift down by half of the size, because the midpoint is 0 
                crossSectionPlane.constant = currentZ;
                planeMesh.position.set(0,0,currentZ);

                if (value == 1000 ) { // if the slider is all the way up, hide the colour plane and move the clipping plane up to be invisible
                    planeMesh.visible = false;
                    crossSectionPlane.constant = currentZ + 0.0001;
                } else if (value == 0) { // if the slider is all the way down, move both the colour plane and clip plane to the lowest safe positions
                    planeMesh.visible = true;
                    crossSectionPlane.constant = currentZ + 0.0001;
                    planeMesh.position.set(0,0,currentZ + 0.0001);

                } else { 
                    planeMesh.visible = true; // set the colour plane to visible if anywhere inbetween max and min
                }

                renderer.render( scene, camera );

            });  
        }


        function UIManager(geometry, mesh) { //handles all ui interaction, other than slider
            let largestDimension = Math.max(geometry.boundingBox.max.x, 
            geometry.boundingBox.max.y, 
            geometry.boundingBox.max.z) // calculate the largest dimensions

            let edgeGeom = scene.getObjectByName("edgeGeom"); // get edge geometry
            let planeMesh = scene.getObjectByName("crossSectionPlaneMesh"); //get plane geometry
            let defaultMat = mesh.material;
            let defaultCrossSectionMat = planeMesh.material;
            let xrayMatBody = initXrayMaterials(true); // init xraymat with clippingplanes on
            let stencilMats = initStencilMaterials(initXrayMaterials(false)); // call initstencilmats with xray material as argument (calling initxraymaterials with clipping planes disabled)
            let xrayMatPlane = stencilMats[2]; // set xray plane material to the 3rd returned argument (planestencilmat)

            document.getElementById("zoomIn").addEventListener("click", function(){cameraControls.dolly(  largestDimension, true )});
            document.getElementById("zoomOut").addEventListener("click", function(){cameraControls.dolly(  -largestDimension, true )}); 
            document.getElementById("homeView").addEventListener("click", function(){cameraControls.setLookAt(cameraHome.x, cameraHome.y, cameraHome.z, 0, 0, 0, true);}); 
            document.getElementById("orthographicCam").addEventListener("click", function(){
                camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
            });
            document.getElementById("perspectiveCam").addEventListener("click", function(){
                camera = new THREE.PerspectiveCamera(70, canvasContainer.clientWidth/canvasContainer.clientHeight);

            });

            function defaultView () {
                mesh.material = defaultMat;
                edgeGeom.material.transparent = false;
                edgeGeom.material.opacity = 1; //get edge geometry
                mesh.material.wireframe = false;
                mesh.material.transparent = false;
                mesh.material.opacity = 1;
                planeMesh.material = defaultCrossSectionMat;
                planeMesh.material.opacity = 1;

            }

            document.getElementById("wireFrameView").addEventListener("click", function(){
                defaultView();
                edgeGeom.material.transparent = true;
                edgeGeom.material.opacity = 0; //get edge geometry
                mesh.material.wireframe = true;
                planeMesh.material.transparent = true;
                planeMesh.material.opacity = 0.5;
                renderer.render( scene, camera );
            });

            document.getElementById("xRayView").addEventListener("click", function(){
                defaultView();
                mesh.material = xrayMatBody;
                mesh.material.transparent = true;
                mesh.material.opacity = 0.3;
                planeMesh.material = xrayMatPlane;
                planeMesh.material.clippingPlanes = [];
                planeMesh.material.transparent = true;
                planeMesh.material.opacity = 0.3;
                renderer.render( scene, camera );
            });

            document.getElementById("solidView").addEventListener("click", function(){
                defaultView();
                renderer.render( scene, camera );
            });

        }

        // STL Loader

        let loader = new STLLoader(manager);

        loader.load( modelFile, function (geometry) { 
            let mesh = loadMesh(geometry);
            helpers(geometry, mesh);
            crossSection(geometry, mesh);
            UIManager(geometry, mesh);
        });

        window.addEventListener( 'resize', onWindowResize );
    }

    function initStencilMaterials(planeStencilMat) {
            // PASS 1
        // everywhere that the back faces are visible (clipped region) the stencil
        // buffer is incremented by 1.
        let backFaceStencilMat = new THREE.MeshBasicMaterial();
        backFaceStencilMat.depthWrite = false;
        backFaceStencilMat.depthTest = false;
        backFaceStencilMat.colorWrite = false;
        backFaceStencilMat.stencilWrite = true;
        backFaceStencilMat.stencilFunc = THREE.AlwaysStencilFunc;
        backFaceStencilMat.side = THREE.BackSide;
        backFaceStencilMat.stencilFail = THREE.IncrementWrapStencilOp;
        backFaceStencilMat.stencilZFail = THREE.IncrementWrapStencilOp;
        backFaceStencilMat.stencilZPass = THREE.IncrementWrapStencilOp;

            // PASS 2
        // everywhere that the front faces are visible the stencil
        // buffer is decremented back to 0.
        let frontFaceStencilMat = new THREE.MeshBasicMaterial();
        frontFaceStencilMat.depthWrite = false;
        frontFaceStencilMat.depthTest = false;
        frontFaceStencilMat.colorWrite = false;
        frontFaceStencilMat.stencilWrite = true;
        frontFaceStencilMat.stencilFunc = THREE.AlwaysStencilFunc;
        frontFaceStencilMat.side = THREE.FrontSide;
        frontFaceStencilMat.stencilFail = THREE.DecrementWrapStencilOp;
        frontFaceStencilMat.stencilZFail = THREE.DecrementWrapStencilOp;
        frontFaceStencilMat.stencilZPass = THREE.DecrementWrapStencilOp;

            // PASS 3
        // draw the plane everywhere that the stencil buffer != 0, which will
        // only be in the clipped region where back faces are visible.
        planeStencilMat.stencilWrite = true;
        planeStencilMat.stencilRef = 0;
        planeStencilMat.stencilFunc = THREE.NotEqualStencilFunc;
        planeStencilMat.stencilFail = THREE.ReplaceStencilOp;
        planeStencilMat.stencilZFail = THREE.ReplaceStencilOp;
        planeStencilMat.stencilZPass = THREE.ReplaceStencilOp;

        return [backFaceStencilMat, frontFaceStencilMat, planeStencilMat];
    }

    function initXrayMaterials(clippingPlanes) {
        let vertexShader = `
            uniform float p;
            varying float intensity;

            #include <clipping_planes_pars_vertex>

            void main()
            {
                #include <begin_vertex>

                vec3 vNormal = normalize( normalMatrix * normal );
                intensity = pow(abs(1.1 - abs(dot(vNormal, vec3(0, 0, 1)))), p);

                #include <project_vertex>
                #include <clipping_planes_vertex>
            }`

        let fragmentShader = ` 
            uniform vec3 glowColor;
            varying float intensity;

            #include <clipping_planes_pars_fragment>

            void main()
            {
                #include <clipping_planes_fragment>

                vec3 glow = glowColor * intensity;
                gl_FragColor = vec4( glow, 1.0 );
            }`

        let materialCameraPosition = camera.position.clone();
        materialCameraPosition.z += 10;

        var xrayMaterial = new THREE.ShaderMaterial(
        {
            uniforms: {
                "c": { type: "f", value: 0.5 },
                "p": { type: "f", value: 1 },
                glowColor: { type: "c", value: new THREE.Color(0x575757) },
                viewVector: { type: "v3", value: camera.position }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            clipping: true,
            opacity: 0.5,
            depthWrite: false
        });

        if (clippingPlanes) {
            xrayMaterial.clippingPlanes = [crossSectionPlane];
        }

        return xrayMaterial;
    }

    function makeLabel(name, position, text, className = "label") { //default to using the label class, but can be changed if passed in
            let labelDiv = document.createElement( 'div' );
            labelDiv.className = className;
            labelDiv.textContent = text;
            let textLabel = new CSS2DObject( labelDiv );
            textLabel.position.set(position.x,position.y,position.z); //set the rendered position to the passed in value
            scene.add(textLabel);
            return textLabel;
    }

    function onWindowResize() {

        camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( canvasContainer.clientWidth, canvasContainer.clientHeight );
        labelRenderer.setSize( canvasContainer.clientWidth, canvasContainer.clientHeight );
        renderer.render( scene, camera );
        labelRenderer.render( scene, camera );

    }

    function updateScaleGrid() {
        let cameraFacing = camera.getWorldDirection(new THREE.Vector3(0, 0, 0));
        let x = (cameraFacing.x);
        let y = (cameraFacing.y);
        let z = (cameraFacing.z);

        let newX, newY;

        if (Math.abs(x) > Math.abs(y)) { // determin which value of the cameras position vector is absolutely bigger
            if (x > 0) {
                newX = -gridHelperSize/2 - 0.25
                newY = gridHelperSize/2 - 0.5 // set position of label to EAST
            } else {
                newX = gridHelperSize/2 + 0.25
                newY = -gridHelperSize/2 + 0.5
            } // set position of label to WEST
        } else {
            if (y > 0) {
                newX = -gridHelperSize/2 + 0.5
                newY = -gridHelperSize/2 -0.25 // set position of label to NORTH
            } else {
                newX = gridHelperSize/2 - 0.5
                newY = gridHelperSize/2 + 0.25
            } // set position of label to SOUTH 
        };

        scaleLabel.position.set(newX, newY, scaleLabel.position.z);

    }

    function onFirstRenderChanges () { // code to call once, when the first frame of the render happens
        let loaderDiv = document.getElementById("loaderContainer"); // remove the loader div
        loaderDiv.style.opacity = "0";
        loaderDiv.style.pointerEvents = "none";
        cameraControls.dolly(-2, true); // transition into the final camera position
        cameraControls.removeEventListener( "update", onFirstRenderChanges );
    }

    function render() {

        let delta = clock.getDelta();
        let haveControlsUpdated = cameraControls.update( delta );
        requestAnimationFrame(render);

        if (haveControlsUpdated) {
            updateScaleGrid();
            renderer.render( scene, camera );
            labelRenderer.render( scene, camera );


        }

    }
};

