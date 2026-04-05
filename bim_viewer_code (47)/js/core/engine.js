import { DEFAULTS, TOOL_MODES, COLORS, EVENTS } from './constants.js';

export const Engine = (() => {
    // Core Three.js objects
    let scene = null;
    let gizmoMode = 'translate';
    let camera = null;
    let renderer = null;
    let controls = null;
    let tControls = null;
    let raycaster = null;

    // State management
    let objects = [];

    let draggingGizmo = false;//hedit
    let gridSnapValue = null;//hedit
    let vertexEdit = { active: false, mesh: null, handles: [] };//hedit
    let parametricEdit = { active: false, obj: null, handles: [], dragStartPositions: null };//hedit
    let booleanOp = { active: false, type: null, base: null };//hedit
    let autoGen = { floor: false, roof: false, floors: [], roofs: [] };//hedit
    let snapMove = { active: false, stage: null, sourceObj: null, sourcePoint: null, sourceOffset: null, snapMarkers: [], originalMatrix: null, snapPointType: 'corners' };//hedit
    let alignOp = { active: false, source: null, target: null };//hedit
    let measureTool = { active: false, stage: 'pick_first', p1: null, line: null, label: null };//hedit
    let sectionTool = { active: false, plane: null, helper: null };//hedit
    let selection = null;

    let currentMode = TOOL_MODES.SELECTION;
    let eventListeners = {};
    let materials = {};
    let tools = {};

    // Tools state
    let placementTool = {
        active: false,
        config: null,
        plane: null,
        preview: null
    };

    // Initialize the engine
    function init(domId) {
        const container = document.getElementById(domId);
        if (!container) {
            throw new Error(`Container with id "${domId}" not found`);
        }

        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x222222);

        // Create camera
        camera = new THREE.PerspectiveCamera(
            DEFAULTS.CAMERA_FOV,
            container.clientWidth / container.clientHeight,
            DEFAULTS.CAMERA_NEAR,
            DEFAULTS.CAMERA_FAR
        );
        camera.position.set(
            DEFAULTS.CAMERA_POSITION.x,
            DEFAULTS.CAMERA_POSITION.y,
            DEFAULTS.CAMERA_POSITION.z
        );

        // Create renderer
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.localClippingEnabled = true;
        container.appendChild(renderer.domElement);

        // Create orbit controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 5;
        controls.maxDistance = 500;
        controls.maxPolarAngle = Math.PI;

        // Create transform controls
        tControls = new THREE.TransformControls(camera, renderer.domElement);
        scene.add(tControls);
        //alert('ok1');
        // Setup transform controls events
        tControls.addEventListener('dragging-changed', (event) => {
            controls.enabled = !event.value;
            draggingGizmo = event.value;
            if (event.value) {
                emitEvent(EVENTS.HISTORY_CHANGED, { action: 'transform-start' });
            } else {
                if (selection && !parametricEdit.active) {
                    syncConfigFromTransform(selection);
                    emitEvent(EVENTS.OBJECT_SELECTED, selection);
                }
                emitEvent(EVENTS.HISTORY_CHANGED, { action: 'transform-end' });
            }
        });

        tControls.addEventListener('change', () => {
            if (selection && tControls.dragging) {
                emitEvent(EVENTS.OBJECT_SELECTED, selection);
            }
        });

        // Create raycaster
        raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = 0.1;
        raycaster.params.Points.threshold = 0.1;

        // Create placement plane
        placementTool.plane = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshBasicMaterial({
                visible: false,
                side: THREE.DoubleSide
            })
        );
        placementTool.plane.rotation.x = -Math.PI / 2;
        scene.add(placementTool.plane);

        // Setup lighting
        setupLighting();

        // Create materials
        createMaterials();

        // Setup event listeners
        setupEventListeners(container);

        // Start animation loop
        animate();

        console.log('Engine initialized successfully');

        // Resize handler
        window.addEventListener('resize', () => {
            const container = document.getElementById(domId);
            if (container && camera && renderer) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });
    }

    // Setup lighting
    function setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Hemisphere light for natural outdoor lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        scene.add(hemisphereLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        scene.add(directionalLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-50, 30, -50);
        scene.add(fillLight);
    }

    // Create materials
    function createMaterials() {
        materials = {
            concrete: new THREE.MeshStandardMaterial({
                color: COLORS.CONCRETE,
                side: THREE.DoubleSide,
                roughness: 0.8,
                metalness: 0.2
            }),
            steel: new THREE.MeshStandardMaterial({
                color: COLORS.STEEL,
                metalness: 0.8,
                roughness: 0.3,
                side: THREE.DoubleSide
            }),
            glass: new THREE.MeshPhysicalMaterial({
                color: COLORS.GLASS,
                opacity: 0.6,
                transparent: true,
                transmission: 0.9,
                roughness: 0.1,
                side: THREE.DoubleSide
            }),
            paint: new THREE.MeshStandardMaterial({
                color: COLORS.PAINT,
                side: THREE.DoubleSide,
                roughness: 0.6
            }),
            hole: new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            }),
            soil: new THREE.MeshLambertMaterial({
                color: COLORS.SOIL,
                side: THREE.DoubleSide
            }),
            wood: new THREE.MeshLambertMaterial({
                color: 0x8B4513,
                side: THREE.DoubleSide
            }),
            brick: new THREE.MeshLambertMaterial({
                color: 0xB22222,
                side: THREE.DoubleSide
            }),
            wireframe: new THREE.MeshBasicMaterial({
                color: 0xffff00,
                wireframe: true,
                transparent: true,
                opacity: 0.6
            }),
            highlight: new THREE.MeshBasicMaterial({
                color: COLORS.HIGHLIGHT,
                transparent: true,
                opacity: 0.3
            }),
            measure: new THREE.LineBasicMaterial({
                color: COLORS.MEASURE,
                linewidth: 2
            }),
            snap: new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.8
            })
        };
    }

    // Setup event listeners
    function setupEventListeners(container) {
        // Mouse events
        container.addEventListener('pointerdown', onPointerDown);
        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerup', onPointerUp);
        container.addEventListener('wheel', onWheel, { passive: false });

        // Drag and drop
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        container.addEventListener('drop', onDrop);

        // Keyboard events
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Context menu
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Handle right-click context menu if needed
        });
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Update controls if needed
        if (controls && controls.enabled) {
            controls.update();
        }

        // Update any active tools
        Object.values(tools).forEach(tool => {
            if (tool.update) tool.update();
        });

        // Render the scene
        renderer.render(scene, camera);
    }

    function onPointerDown(event) {
        emitEvent(EVENTS.VIEWPORT_CLICK, { event, type: 'down' });

        // Don't interfere with transform controls
        if (tControls.dragging) return;

        const intersects = getMouseIntersects(event);

        // Handle placement tool
        if (placementTool.active) {
            if (intersects.plane.length > 0) {
                const point = intersects.plane[0].point.clone();
                emitEvent('placement-click', { point, config: placementTool.config, event });
            }
            if (!event.shiftKey) {
                exitPlacementMode();
            }
            return;
        }
        // Handle tool-specific pointer down
        // This allows SnapMoveTool to handle its own clicks first.
        let toolHandledClick = false;
        Object.values(tools).forEach(tool => {
            if (tool.onPointerDown) {
                // A bit of a hacky way to check if the tool consumed the event
                const initialSelection = selection;
                tool.onPointerDown(event, intersects);
                if (selection !== initialSelection || tool.isActive?.()) {
                    toolHandledClick = true;
                }
            }
        });

        if (toolHandledClick) return; // If a tool like SnapMove handled it, stop here.

        // Handle object selection if no tool was active
        // Allow selection in selection or transform modes
        const isTransformMode = [TOOL_MODES.SELECTION, TOOL_MODES.TRANSLATE, TOOL_MODES.ROTATE, TOOL_MODES.SCALE].includes(currentMode);
        if (isTransformMode) {
            if (intersects.meshes.length > 0) {
                const clickedMesh = intersects.meshes[0].object;
                const clickedObj = findObjectByMesh(clickedMesh);
                //console.log('clickedObj');
                //alert('clickedObj2');
                if (clickedObj) {
                    //console.log('deselectObject kk1');
                    //alert('deselectObject kk1');
                    // If a valid object was clicked, select it
                    selectObject(clickedObj);
                } else {
                    //alert('deselectObject kk2');
                    //console.log('deselectObject kk1');
                    // Fallback: if intersected mesh isn't a known object, deselect
                    deselectObject();
                }
            } else {
                //alert('deselectObject kk3');
                // console.log('deselectObject kk3');
                // If nothing was clicked (empty space), deselect
                deselectObject();
            }
        }
        // --- END: Replacement block ---
    }

    // Event handling
    async function onPointerDownxxx(event) {
        emitEvent(EVENTS.VIEWPORT_CLICK, { event, type: 'down' });

        // Don't interfere with transform controls
        if (tControls.dragging) return;

        const intersects = getMouseIntersects(event);

        // Handle placement tool
        if (placementTool.active) {
            if (intersects.plane.length > 0) {
                const point = intersects.plane[0].point.clone();
                emitEvent('placement-click', { point, config: placementTool.config, event });
            }
            if (!event.shiftKey) {
                exitPlacementMode();
            }
            return;
        }

        // Handle tool-specific pointer down
        Object.values(tools).forEach(tool => {
            if (tool.onPointerDown) tool.onPointerDown(event, intersects);
        });

        // Handle object selection
        if (currentMode === TOOL_MODES.SELECTION && intersects.meshes.length > 0) {
            //alert('ok9');
            const clickedMesh = intersects.meshes[0].object;
            const clickedObj = findObjectByMesh(clickedMesh);

            if (clickedObj) {
                //alert('ok7');
                selectObject(clickedObj);
            } else {
                deselectObject();
            }
        }
    }

    function onPointerMove(event) {
        emitEvent(EVENTS.VIEWPORT_MOVE, { event });

        const intersects = getMouseIntersects(event);
        const pointOnPlane = intersects.plane.length > 0 ? intersects.plane[0].point : null;

        // Update placement preview
        if (placementTool.active && placementTool.preview && pointOnPlane) {
            placementTool.preview.position.copy(pointOnPlane);
        }

        // Update tool-specific pointer move
        Object.values(tools).forEach(tool => {
            if (tool.onPointerMove) tool.onPointerMove(event, intersects, pointOnPlane);
        });
    }

    function onPointerUp(event) {
        emitEvent(EVENTS.VIEWPORT_CLICK, { event, type: 'up' });

        Object.values(tools).forEach(tool => {
            if (tool.onPointerUp) tool.onPointerUp(event);
        });
    }

    function onWheel(event) {
        event.preventDefault();

        // Zoom speed adjustment
        const zoomSpeed = 0.001;
        const delta = event.deltaY * zoomSpeed;

        if (camera.isPerspectiveCamera) {
            camera.fov += delta * 50;
            camera.fov = Math.max(10, Math.min(100, camera.fov));
            camera.updateProjectionMatrix();
        }

        emitEvent('viewport-zoom', { delta });
    }

    function onDrop(event) {
        event.preventDefault();

        const blockType = event.dataTransfer.getData('text/plain');
        if (blockType && placementTool.preview) {
            const position = placementTool.preview.position.clone();
            emitEvent('drop-placement', { blockType, position });
        }

        //exitPlacementMode();hedit
        setMode(TOOL_MODES.SELECTION); // Revert to selection after drop
    }

    function onKeyDown(event) {
        emitEvent(EVENTS.KEY_DOWN, { event });

        switch (event.key) {
            case 'Escape':
                exitAllModes();
                break;
            case 'Delete':
            case 'Backspace':
                if (selection) {
                    emitEvent('delete-selected', selection);
                }
                break;
            case 'z':
            case 'Z':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    emitEvent('undo-request');
                }
                break;
            case 'y':
            case 'Y':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    emitEvent('redo-request');
                }
                break;
            case 'd':
            case 'D':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    emitEvent('duplicate-selected');
                }
                break;
        }

        Object.values(tools).forEach(tool => {
            if (tool.onKeyDown) tool.onKeyDown(event);
        });
    }

    function onKeyUp(event) {
        emitEvent(EVENTS.KEY_UP, { event });

        Object.values(tools).forEach(tool => {
            if (tool.onKeyUp) tool.onKeyUp(event);
        });
    }

    // Core functions
    function addObject(config, geometryOrMesh) {
        if (!geometryOrMesh) {
            console.error('addObject: No geometry or mesh provided');
            return null;
        }

        let mesh;

        // Use property checks instead of instanceof to handle multiple Three.js instances
        if (geometryOrMesh.isBufferGeometry) {
            const material = config.blockType === 'hole'
                ? materials.hole.clone()
                : (materials[config.mat] || materials.concrete).clone();
            mesh = new THREE.Mesh(geometryOrMesh, material);
        } else if (geometryOrMesh.isMesh || geometryOrMesh.isGroup || geometryOrMesh.isLine || geometryOrMesh.isPoints) {
            mesh = geometryOrMesh;
        } else {
            console.error('Invalid geometry or mesh provided to addObject');
            console.log('Type of argument:', typeof geometryOrMesh);
            console.log('Value of argument:', geometryOrMesh);
            return null;
        }

        // Apply transformations
        mesh.position.set(config.pos.x, config.pos.y, config.pos.z);
        mesh.rotation.set(config.rot.x, config.rot.y, config.rot.z);
        mesh.scale.set(config.scale.x, config.scale.y, config.scale.z);

        // Add user data
        mesh.userData = {
            type: 'bim-object',
            id: config.id || Date.now(),
            config: config,
            selectable: true
        };

        // Enable shadows
        mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const obj = {
            id: mesh.userData.id,
            mesh: mesh,
            config: config
        };

        objects.push(obj);
        scene.add(mesh);

        emitEvent(EVENTS.OBJECT_ADDED, obj);

        return obj;
    }

    function removeObject(obj) {
        const index = objects.indexOf(obj);
        if (index > -1) {
            objects.splice(index, 1);
            scene.remove(obj.mesh);

            // Clean up geometry and materials
            obj.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });

            if (selection === obj) {
                deselectObject();
            }

            emitEvent(EVENTS.OBJECT_REMOVED, obj);
            return true;
        }
        return false;
    }
    // --- In engine.js ---

    // (replace the entire selectObject function with this one)
    function selectObject(obj) {
        if (!obj || !obj.mesh) return;

        // 1. Do nothing if the same object is clicked again
        if (selection === obj) {
            return;
        }

        // 2. Deselect the previous object if there was one
        if (selection) {
            deselectObject();
        }

        // 3. Select the new object
        selection = obj;
        tControls.attach(obj.mesh);

        // 4. Highlight the newly selected object
        obj.mesh.traverse(child => {
            if (child.isMesh || child.isLine) {
                // Store the original material before applying the highlight
                child.userData.originalMaterial = child.material;
                
                if (child.isLine) {
                    // For lines, we might just want to change the color or use a thicker line if supported
                    const highlightMaterial = child.material.clone();
                    highlightMaterial.color.set(0xffff00); // Yellow highlight
                    child.material = highlightMaterial;
                } else {
                    child.material = materials.highlight.clone();
                }
            }
        });

        emitEvent(EVENTS.OBJECT_SELECTED, obj);
    }
    function selectObjectxx(obj) {
        if (!obj || !obj.mesh) return;

        // Deselect current selection
        //if (selection && selection !== obj) {
        //   deselectObject();
        //}
        //alert('ok81');
        selection = obj;
        tControls.attach(obj.mesh);
        //alert('ok82');
        // Highlight the selected object
        obj.mesh.traverse(child => {
            //alert('ok4');
            if (child.isMesh) {
                child.userData.originalMaterial = child.material;
                const highlightMaterial = materials.highlight.clone();
                highlightMaterial.transparent = true;
                highlightMaterial.opacity = 0.3;
                child.material = highlightMaterial;
            }
        });
        //alert('ok82');
        emitEvent(EVENTS.OBJECT_SELECTED, obj);
    }

    function deselectObject() {
        if (selection) {
            // Restore original materials
            selection.mesh.traverse(child => {
                if ((child.isMesh || child.isLine) && child.userData.originalMaterial) {
                    child.material = child.userData.originalMaterial;
                    delete child.userData.originalMaterial;
                }
            });

            tControls.detach();
            emitEvent(EVENTS.OBJECT_DESELECTED, selection);
        }
        selection = null;
    }

    function syncConfigFromTransform(obj) {
        if (!obj || !obj.mesh) return;
        //alert('ok5');
        const mesh = obj.mesh;
        obj.config.pos = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
        obj.config.rot = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
        obj.config.scale = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
    }

    function getMouseIntersects(event) {
        if (!renderer || !camera || !scene) return { meshes: [], plane: [] };

        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(mouse, camera);

        // --- START: MODIFICATION ---
        // Raycast against all visible objects in the scene, not just the pre-filtered list.
        const allIntersects = raycaster.intersectObjects(scene.children, true);

        // Filter the results to include only selectable BIM objects and snap points.
        const filteredMeshes = allIntersects.filter(intersect => {
            let obj = intersect.object;
            // Traverse up the hierarchy to find the object with our userData tags.
            // This is crucial for grouped objects like our snap markers.
            while (obj.parent && !obj.userData.type && !obj.userData.isSnapPoint) {
                obj = obj.parent;
            }
            // Check if the object is a selectable BIM object OR a snap point helper.
            return (obj.userData.type === 'bim-object' && obj.userData.selectable !== false) || obj.userData.isSnapPoint === true;
        });

        return {
            meshes: filteredMeshes,
            plane: raycaster.intersectObject(placementTool.plane)
        };
        // --- END: MODIFICATION ---
    }
    // In engine.js, ensure getMouseIntersects includes snap markers
    function getMouseIntersectsxx(event) {
        const mouse = this.getNormalizedMousePosition(event);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Include ALL objects, including snap markers
        const allObjects = [...this.scene.children];
        // Or if you have a specific array of objects
        // const allObjects = [...this.objects.map(o => o.mesh), ...snapMarkers];

        const intersects = raycaster.intersectObjects(allObjects, true); // true = recursive

        return {
            meshes: intersects.filter(i => i.object.isMesh),
            // ... other data
        };
    }
    function getNormalizedMousePosition(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        return new THREE.Vector2(x, y);
    }
    function getMouseIntersectsyy(event) {


        if (!renderer || !camera) return { meshes: [], plane: [] };

        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        //const mouse1 = this.getNormalizedMousePosition(event);
        //const raycaster1 = new THREE.Raycaster();
        //raycaster.setFromCamera(mouse, this.camera);
        raycaster.setFromCamera(mouse, camera);
        //const allObjects = [...this.scene.children];

        const allIntersects = raycaster.intersectObjects(scene.children, true);
        //const intersects = raycaster.intersectObjects(allObjects, true); // true = recursive
        // Get intersectable objects (excluding helpers and invisible objects)
        const intersectableObjects = objects
            .filter(obj => obj.mesh.visible && obj.mesh.userData.selectable !== false)
            .map(obj => obj.mesh);

        return {
            //meshes: intersects.filter(i => i.object.isMesh),
            meshes: raycaster.intersectObjects(intersectableObjects, true),
            plane: raycaster.intersectObject(placementTool.plane)
        };
    }

    function findObjectByMesh(mesh) {
        // Traverse up to find the root object mesh
        let current = mesh;
        while (current.parent && !current.userData?.type) {
            current = current.parent;
        }

        return objects.find(obj => obj.mesh === current || obj.mesh === mesh);
    }

    // Tool management
    function setMode(mode) {
        if (currentMode === mode) return;

        // Exit current mode
        exitMode(currentMode);

        // Enter new mode
        currentMode = mode;

        switch (mode) {
            case TOOL_MODES.TRANSLATE:
                tControls.setMode('translate');
                break;
            case TOOL_MODES.ROTATE:
                tControls.setMode('rotate');
                break;
            case TOOL_MODES.SCALE:
                tControls.setMode('scale');
                break;
            case TOOL_MODES.SELECTION:
                tControls.setMode('translate');
                break;
        }

        emitEvent(EVENTS.TOOL_CHANGED, { mode });
    }

    function exitMode(mode) {
        switch (mode) {
            case TOOL_MODES.PLACEMENT:
                exitPlacementMode();
                break;
            // Add other mode exit logic here
        }
    }

    function exitAllModes() {
        exitPlacementMode();
        setMode(TOOL_MODES.SELECTION);

        Object.values(tools).forEach(tool => {
            if (tool.exit) tool.exit();
        });
    }

    function enterPlacementMode(config) {
        exitAllModes();

        placementTool.active = true;
        placementTool.config = config;
        currentMode = TOOL_MODES.PLACEMENT;

        emitEvent(EVENTS.TOOL_CHANGED, { mode: TOOL_MODES.PLACEMENT });
    }

    function exitPlacementMode() {
        if (placementTool.preview) {
            scene.remove(placementTool.preview);
            placementTool.preview.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            placementTool.preview = null;
        }

        if (placementTool.active) {

            placementTool.active = false;
            placementTool.config = null;
            // FIX: Set the mode back to selection after placement is finished
            setMode(TOOL_MODES.SELECTION);
        }
    }

    function setPlacementPreview(previewMesh) {
        if (placementTool.preview) {
            scene.remove(placementTool.preview);
        }

        placementTool.preview = previewMesh;
        if (previewMesh) {
            scene.add(previewMesh);
        }
    }

    // Helper functions
    function getObjectById(id) {
        return objects.find(obj => obj.id === id);
    }

    function getObjectsByFloor(floorName) {
        return objects.filter(obj => obj.config.floor === floorName);
    }

    function getObjectsByType(type) {
        return objects.filter(obj => obj.config.blockType === type);
    }

    function clearAllObjects() {
        while (objects.length > 0) {
            removeObject(objects[0]);
        }
    }

    function restoreState(stateConfigs) {
        clearAllObjects();
        exitAllModes();

        if (stateConfigs && Array.isArray(stateConfigs)) {
            stateConfigs.forEach(config => {
                emitEvent('restore-object', config);
            });
        }
    }

    function getNearbyVertex(point, threshold = 0.3) {
        let closestVertex = null;
        let minDistance = threshold;

        objects.forEach(obj => {
            const mesh = obj.mesh;
            const position = mesh.geometry.attributes.position;
            const matrix = mesh.matrixWorld;

            for (let i = 0; i < position.count; i++) {
                const v = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix);
                const d = v.distanceTo(point);
                if (d < minDistance) {
                    minDistance = d;
                    closestVertex = v.clone();
                }
            }
        });

        return closestVertex;
    }

    // Event system
    function emitEvent(eventName, data) {
        if (eventListeners[eventName]) {
            eventListeners[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }
    }

    function addEventListener(eventName, callback) {
        if (!eventListeners[eventName]) {
            eventListeners[eventName] = [];
        }
        eventListeners[eventName].push(callback);
    }

    function removeEventListener(eventName, callback) {
        if (eventListeners[eventName]) {
            const index = eventListeners[eventName].indexOf(callback);
            if (index > -1) {
                eventListeners[eventName].splice(index, 1);
            }
        }
    }

    // Register tool
    function registerTool(name, tool) {
        tools[name] = tool;
        if (tool.init) tool.init(this);
    }

    // Public API
    return {
        // Core
        init,
        getScene: () => scene,
        getCamera: () => camera,
        getRenderer: () => renderer,
        getControls: () => controls,
        getTransformControls: () => tControls,
        getRaycaster: () => raycaster,

        // Object management
        getObjects: () => objects,
        getSelection: () => selection,
        addObject,
        removeObject,
        selectObject,
        deselectObject,
        deselectAll: deselectObject,
        getObjectById,
        getObjectsByFloor,
        getObjectsByType,
        clearAllObjects,
        restoreState,

        // Transformation
        syncConfigFromTransform,

        // Mode management
        getMode: () => currentMode,
        setMode,
        exitAllModes,

        // Placement tool
        enterPlacementMode,
        exitPlacementMode,
        setPlacementPreview,
        getNearbyVertex,
        // Selection
        getPlacementConfig: () => placementTool.config,
        isPlacementActive: () => placementTool.active,

        // Intersection
        getMouseIntersects,
        findObjectByMesh,

        // Materials
        getMaterials: () => materials,

        // Tools
        registerTool,
        getTool: (name) => tools[name],

        // Events
        emitEvent,
        addEventListener,
        removeEventListener
    };
})();