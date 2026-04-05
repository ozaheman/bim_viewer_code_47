import { Engine } from '../core/engine.js';
import { SNAP_TYPES, COLORS } from '../core/constants.js';

export const MoveArrayTool = (() => {
    // Tool state
    let state = {
        active: false,
        mode: 'move', // 'move', 'radial'
        sourceObj: null,
        sourcePoint: null,
        sourceOffset: null,
        targetPoint: null,
        snapType: SNAP_TYPES.CORNERS,
        snapMarkers: [],
        previewMesh: null,
        originalPosition: null,
        hoveredMarker: null,
        selectedMarker: null,
        previewVector: null,
        instructionElement: null,

        // Array/Copy state
        isCopyMode: false,
        awaitingArrayInput: false,
        arrayInput: '',
        lastMoveVector: null,
        lastCopiedObject: null,
        originalObject: null,
        moveStartPosition: null,

        // Radial Array specific
        radialCenter: null,
        radialStartAngle: 0,
        radialCurrentAngle: 0,
        radialAxis: new THREE.Vector3(0, 1, 0), // Default Y axis
        radialPreviewLine: null
    };

    // Initialize tool
    function init(engine) {
        console.log('MoveArrayTool initialized');
        createInstructionElement();
    }

    // Create instruction element
    function createInstructionElement() {
        if (document.getElementById('move-array-instruction')) return;

        state.instructionElement = document.createElement('div');
        state.instructionElement.id = 'move-array-instruction';
        state.instructionElement.style.position = 'absolute';
        state.instructionElement.style.top = '60px';
        state.instructionElement.style.left = '50%';
        state.instructionElement.style.transform = 'translateX(-50%)';
        state.instructionElement.style.backgroundColor = 'rgba(0,0,0,0.85)';
        state.instructionElement.style.color = 'white';
        state.instructionElement.style.padding = '12px 24px';
        state.instructionElement.style.borderRadius = '8px';
        state.instructionElement.style.zIndex = '1000';
        state.instructionElement.style.fontSize = '14px';
        state.instructionElement.style.fontWeight = 'bold';
        state.instructionElement.style.pointerEvents = 'none';
        state.instructionElement.style.border = '2px solid var(--accent)';
        state.instructionElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        state.instructionElement.style.display = 'none';
        document.getElementById('viewer-container').appendChild(state.instructionElement);
    }

    function showInstruction(text) {
        if (state.instructionElement) {
            state.instructionElement.textContent = text;
            state.instructionElement.style.display = 'block';
        }
    }

    function hideInstruction() {
        if (state.instructionElement) {
            state.instructionElement.style.display = 'none';
        }
    }

    // Start tool
    function start(mode = 'move') {
        console.log(`Starting MoveArrayTool in ${mode} mode...`);
        reset();

        state.active = true;
        state.mode = mode; // 'move' (includes copy toggle) or 'radial'

        // Check if selection exists
        const selection = Engine.getSelection();
        if (selection) {
            state.sourceObj = selection;
            state.originalObject = selection;
            state.originalPosition = selection.mesh.position.clone();

            if (state.mode === 'radial') {
                showInstruction('RADIAL ARRAY: Click point to set Center of Rotation');
            } else {
                showInstruction('MOVE: Click start point on object. Press Ctrl to toggle Copy.');
            }
        } else {
            showInstruction('Select an object first.');
            // Ideally we let user select, but let's assume selection first for now to match current flow
        }

        generateSnapPoints();

        const container = Engine.getRenderer().domElement;
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('click', onMouseClick);
        document.addEventListener('keydown', onKeyDown);
    }

    function stop() {
        if (!state.active) return;
        console.log('Stopping MoveArrayTool.');

        reset();

        const container = Engine.getRenderer().domElement;
        container.removeEventListener('mousemove', onMouseMove);
        container.removeEventListener('click', onMouseClick);
        document.removeEventListener('keydown', onKeyDown);

        state.active = false;
        hideInstruction();
    }

    function reset() {
        clearSnapPoints();
        clearPreview();
        clearPreviewVector();
        clearRadialVisuals();

        if (state.selectedMarker) {
            updateMarkerAppearance(state.selectedMarker, 'default');
        }

        state.sourceObj = null;
        state.sourcePoint = null;
        state.sourceOffset = null;
        state.targetPoint = null;
        state.hoveredMarker = null;
        state.selectedMarker = null;

        state.isCopyMode = false;
        state.awaitingArrayInput = false;
        state.arrayInput = '';
        state.lastMoveVector = null;
        state.lastCopiedObject = null;
        state.originalObject = null;
        state.moveStartPosition = null;

        state.radialCenter = null;
        state.radialStartAngle = 0;
    }

    // Toggle copy mode manually
    function setCopyMode(enabled) {
        state.isCopyMode = enabled;
        updateInstruction();
    }

    function updateInstruction() {
        if (state.mode === 'radial') return; // Handled separately

        if (state.awaitingArrayInput) {
            showInstruction('Array Input: Type count (5x) or divide (/5)...');
            return;
        }

        if (!state.sourcePoint) {
            showInstruction(`MOVE${state.isCopyMode ? ' (COPY)' : ''}: Click start point. (Ctrl to toggle Copy)`);
        } else {
            showInstruction(`MOVE${state.isCopyMode ? ' (COPY)' : ''}: Click target point. (Ctrl to toggle Copy)`);
        }
    }

    // --- Core Logic ---

    function createPreviewMesh() {
        if (!state.sourceObj?.mesh) return;
        const originalMesh = state.sourceObj.mesh;
        state.previewMesh = originalMesh.clone();
        state.previewMesh.traverse(child => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.5;
                child.material.depthWrite = false;
                child.material.needsUpdate = true;
            }
        });
        originalMesh.visible = false;
        Engine.getScene().add(state.previewMesh);
    }

    function generateSnapPoints() {
        const scene = Engine.getScene();
        if (!scene) return;
        const objects = Engine.getObjects();
        const renderer = Engine.getRenderer();

        objects.forEach(obj => {
            if (!obj.mesh.visible && obj !== state.sourceObj) return; // Allow source object snaps for radial center

            const bbox = new THREE.Box3().setFromObject(obj.mesh);
            const points = getSnapPointsForBoundingBox(bbox, state.snapType);

            points.forEach(point => {
                const marker = createSnapMarker(point, state.snapType);
                marker.userData = {
                    isSnapPoint: true,
                    object: obj,
                    point: point.clone(),
                    type: state.snapType
                };
                scene.add(marker);
                if (renderer && renderer.camera) {
                    marker.layers.mask = renderer.camera.layers.mask;
                }
                state.snapMarkers.push(marker);
            });
        });
    }

    function getSnapPointsForBoundingBox(bbox, snapType) {
        const points = [];
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Always include center for Radial Array preference? No, adhere to snapType.
        // But for Radial Center, we might want to snapping to anything.
        // For now, respect snapType.

        switch (snapType) {
            case SNAP_TYPES.CORNERS:
                points.push(
                    new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
                    new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
                    new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
                    new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
                    new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
                    new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
                    new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
                    new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
                );
                break;
            case SNAP_TYPES.MIDPOINTS:
                points.push(
                    new THREE.Vector3(center.x, bbox.min.y, bbox.min.z),
                    new THREE.Vector3(center.x, bbox.max.y, bbox.min.z),
                    new THREE.Vector3(center.x, bbox.min.y, bbox.max.z),
                    new THREE.Vector3(center.x, bbox.max.y, bbox.max.z),
                    new THREE.Vector3(bbox.min.x, center.y, bbox.min.z),
                    new THREE.Vector3(bbox.max.x, center.y, bbox.min.z),
                    new THREE.Vector3(bbox.min.x, center.y, bbox.max.z),
                    new THREE.Vector3(bbox.max.x, center.y, bbox.max.z),
                    new THREE.Vector3(bbox.min.x, bbox.min.y, center.z),
                    new THREE.Vector3(bbox.max.x, bbox.min.y, center.z),
                    new THREE.Vector3(bbox.min.x, bbox.max.y, center.z),
                    new THREE.Vector3(bbox.max.x, bbox.max.y, center.z)
                );
                break;
            case SNAP_TYPES.CENTER:
                points.push(center);
                break;
        }
        return points;
    }

    function createSnapMarker(position, snapType) {
        const colors = {
            [SNAP_TYPES.CORNERS]: 0x00ffff,
            [SNAP_TYPES.MIDPOINTS]: 0x00ff00,
            [SNAP_TYPES.CENTER]: 0xff00ff
        };
        const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        const material = new THREE.MeshBasicMaterial({
            color: colors[snapType] || 0xffff00,
            transparent: true,
            opacity: 0.7,
            depthTest: false // Visible through objects
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        marker.scale.set(1.2, 1.2, 1.2);
        return marker;
    }

    function clearSnapPoints() {
        const scene = Engine.getScene();
        if (!scene) return;
        state.snapMarkers.forEach(marker => {
            scene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });
        state.snapMarkers = [];
    }

    function clearPreview() {
        if (state.previewMesh) {
            Engine.getScene().remove(state.previewMesh);
            state.previewMesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            state.previewMesh = null;
        }
        if (state.sourceObj?.mesh) {
            state.sourceObj.mesh.visible = true;
        }
    }

    function updatePreviewVector(startPoint, endPoint) {
        if (!state.previewVector) {
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineDashedMaterial({
                color: 0xff9900,
                dashSize: 0.2,
                gapSize: 0.1,
                linewidth: 2
            });
            state.previewVector = new THREE.Line(geometry, material);
            Engine.getScene().add(state.previewVector);
        }
        state.previewVector.geometry.setFromPoints([startPoint, endPoint]);
        state.previewVector.computeLineDistances();
        state.previewVector.visible = true;
    }

    function clearPreviewVector() {
        if (state.previewVector) {
            Engine.getScene().remove(state.previewVector);
            state.previewVector.geometry.dispose();
            state.previewVector.material.dispose();
            state.previewVector = null;
        }
    }

    function updateMarkerAppearance(marker, type) {
        if (!marker) return;
        const color = type === 'selected' ? 0xff9900 : (type === 'hover' ? 0xffff00 : 0x00ffff); // Simplified
        marker.material.color.setHex(color);
        marker.scale.setScalar(type === 'selected' ? 1.5 : (type === 'hover' ? 1.3 : 1.2));
    }

    // --- Interaction Handlers ---

    function onMouseMove(event) {
        if (!state.active) return;

        const intersects = Engine.getMouseIntersects(event);
        let snapMarker = null;
        for (const intersect of intersects.meshes || []) {
            if (intersect.object.userData?.isSnapPoint) {
                snapMarker = intersect.object;
                break;
            }
        }

        // Hover Effect
        if (state.hoveredMarker && state.hoveredMarker !== snapMarker && state.hoveredMarker !== state.selectedMarker) {
            updateMarkerAppearance(state.hoveredMarker, 'default');
            state.hoveredMarker = null;
        }
        if (snapMarker && snapMarker !== state.selectedMarker) {
            state.hoveredMarker = snapMarker;
            updateMarkerAppearance(state.hoveredMarker, 'hover');
        }

        // Mode Specific Preview
        if (state.mode === 'move') {
            if (state.sourcePoint && state.previewMesh) {
                // If snapping, use snap point. Else use mouse plane intersection?
                // For now stick to snap-to-snap as default for precision
                let targetPos = null;
                if (snapMarker) {
                    targetPos = snapMarker.userData.point;
                } else {
                    // Optional: Project to plane logic here?
                    // Keeping it simple: must click snap point
                }

                if (targetPos) {
                    state.targetPoint = targetPos;
                    state.previewMesh.position.copy(targetPos).add(state.sourceOffset);
                    updatePreviewVector(state.sourcePoint, targetPos);
                } else {
                    // FALLBACK: If not snapping to a marker, project to the horizontal plane at the source object height
                    const mousePoint = getMouseWorldPosition(event);
                    if (mousePoint) {
                        // Keep the Y position of the source object for standard horizontal move?
                        // Or use the mousePoint.y? Usually in these apps, movement is constrained to a plane.
                        const horizontalTarget = new THREE.Vector3(mousePoint.x, state.sourcePoint.y, mousePoint.z);
                        state.targetPoint = horizontalTarget;
                        state.previewMesh.position.copy(horizontalTarget).add(state.sourceOffset);
                        updatePreviewVector(state.sourcePoint, horizontalTarget);
                    }
                }
            }
        } else if (state.mode === 'radial') {
            // Radial Preview
            if (state.radialCenter && state.previewMesh && state.sourceObj) {
                // Calculate angle based on mouse position relative to center
                const mouse = getMouseWorldPosition(event);
                if (mouse) {
                    // Project mouse to flat plane at center height for angle calc
                    const dx = mouse.x - state.radialCenter.x;
                    const dz = mouse.z - state.radialCenter.z;
                    const angle = Math.atan2(dz, dx);

                    // If we haven't set start angle yet, we just show object?
                    // Actually logic:
                    // 1. Click Center.
                    // 2. Click Start Handle (or default to object pos).
                    // Let's assume 2nd click defines 'start angle' and start of rotation.
                }
            }
        }
    }

    function getMouseWorldPosition(event) {
        // Helper to get mouse on ground plane or relevant plane
        const mouse = new THREE.Vector2();
        const canvas = Engine.getRenderer().domElement;
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Engine.getCamera());
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Ground plane
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        return target;
    }

    function onMouseClick(event) {
        if (!state.active) return;

        const canvas = Engine.getRenderer().domElement;
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Engine.getCamera());
        const intersects = raycaster.intersectObjects(state.snapMarkers);

        if (state.mode === 'move') {
            handleClickMove(intersects, event);
        } else if (state.mode === 'radial') {
            handleClickRadial(intersects, event);
        }
    }

    function handleClickMove(intersects, event) {
        let clickedMarker = intersects.length > 0 ? intersects[0].object : null;
        let point = clickedMarker ? clickedMarker.userData.point : null;
        let obj = clickedMarker ? clickedMarker.userData.object : null;

        // If no marker clicked, try to get point from the ground plane
        if (!point) {
            point = getMouseWorldPosition(event);
            if (point && state.sourcePoint) {
                // If we are on the second click, constrain Y to match source point for a flat move
                point.y = state.sourcePoint.y;
            }
        }

        if (!point) return;

        if (!state.sourcePoint) {
            // Pick Point 1 (Start)
            // If we didn't click a marker for the first point, we MUST have clicked an object
            // to know what we are moving.
            if (!obj) {
                // Try to find object under mouse directly
                const mouseIntersects = Engine.getMouseIntersects(event);
                const hit = mouseIntersects.meshes.find(m => m.object.userData.type === 'bim-object');
                if (hit) {
                    obj = hit.object; // Wait, Engine.findObjectByMesh?
                    // Let's rely on marker for first click to be safe, 
                    // or find the object via Engine.
                    const realObj = Engine.getObjects().find(o => o.mesh === hit.object || o.mesh.contains?.(hit.object));
                    obj = realObj;
                }
            }

            if (!obj) return; // Still no object? Can't move nothing.

            state.sourceObj = obj;
            state.originalObject = obj;
            state.moveStartPosition = obj.mesh.position.clone();
            state.sourcePoint = point.clone();
            state.sourceOffset = new THREE.Vector3().subVectors(obj.mesh.position, point);

            createPreviewMesh();

            if (clickedMarker) {
                state.selectedMarker = clickedMarker;
                updateMarkerAppearance(state.selectedMarker, 'selected');
            }

            updateInstruction();
            if (Engine.getSelection() === state.sourceObj) {
                Engine.deselectObject();
            }
        } else {
            // Pick Point 2 (End)
            performMove(point);
        }
    }

    function handleClickRadial(intersects, event) {
        // Step 1: Click Center
        // Step 2: Confirmation / Exec

        // Allow clicking ANY snap point as center
        let point = null;
        if (intersects.length > 0) {
            point = intersects[0].object.userData.point;
        } else {
            // Fallback: Raycast to ground plane?
            // For now enforce snap points for precision
            return;
        }

        if (!state.radialCenter) {
            state.radialCenter = point.clone();
            createRadialVisuals(point);
            showInstruction('RADIAL: Center set. Type Count (5x) or Angle (90) to create Array.');

            // Auto-enter array input mode for radial
            state.awaitingArrayInput = true;
            state.arrayInput = '';

            // Default to rotating around Y axis
            // Visual feedback?
        }
    }

    function createRadialVisuals(center) {
        // Show axis line
        const geometry = new THREE.BufferGeometry().setFromPoints([
            center.clone(),
            center.clone().add(new THREE.Vector3(0, 10, 0))
        ]);
        const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
        state.radialPreviewLine = new THREE.Line(geometry, material);
        Engine.getScene().add(state.radialPreviewLine);
    }

    function clearRadialVisuals() {
        if (state.radialPreviewLine) {
            Engine.getScene().remove(state.radialPreviewLine);
            state.radialPreviewLine = null;
        }
    }

    function performMove(targetPoint) {
        if (!state.sourceObj || !state.sourceOffset) return;

        const startPos = state.moveStartPosition;
        const newPosition = targetPoint.clone().add(state.sourceOffset);
        state.lastMoveVector = new THREE.Vector3().subVectors(newPosition, state.sourceObj.mesh.position);

        const sourceObj = state.sourceObj;

        if (state.isCopyMode) {
            const newObj = copyObject(sourceObj, newPosition);
            state.lastCopiedObject = newObj;

            // Restore original details
            sourceObj.mesh.visible = true;

            showInstruction('COPIED! Type "5x" (multiply) or "/5" (divide) to array.');
            state.awaitingArrayInput = true;
            state.arrayInput = '';
            state.isCopyMode = false; // Reset toggle? Or keep? Usually reset after action.
        } else {
            // Move Original
            sourceObj.mesh.position.copy(newPosition);
            Engine.syncConfigFromTransform(sourceObj);
            showInstruction('MOVED. Done.');

            // We can allow repeating move? No close tool.
            setTimeout(stop, 500);
        }

        clearPreview();
        clearPreviewVector();
        if (window.HistoryManager) HistoryManager.save();
    }

    function copyObject(original, position) {
        const newConfig = JSON.parse(JSON.stringify(original.config));
        newConfig.id = Date.now();
        newConfig.pos = { x: position.x, y: position.y, z: position.z };
        const newMesh = original.mesh.clone();
        newMesh.position.copy(position);
        return Engine.addObject(newConfig, newMesh);
    }

    function executeArray(input) {
        if (state.mode === 'move') {
            executeLinearArray(input);
        } else if (state.mode === 'radial') {
            executeRadialArray(input);
        }
    }

    function executeLinearArray(input) {
        if (!state.lastMoveVector || !state.lastCopiedObject || !state.originalObject) return;

        let count = 0;
        let mode = 'multiply';

        if (input.endsWith('x') || input.endsWith('*') || /^\d+$/.test(input)) {
            count = parseInt(input.replace(/[x*]/g, ''));
            mode = 'multiply';
        } else if (input.startsWith('/')) {
            count = parseInt(input.substring(1));
            mode = 'divide';
        }

        if (isNaN(count) || count <= 0) return;

        const baseObj = state.originalObject;
        const vector = state.lastMoveVector;

        if (mode === 'multiply') {
            // N copies total (including the one just made)
            // If user types 3x, and we already made 1 copy.
            // In SketchUp, 3x means 3 COPIES total. We have 1. Need 2 more.
            // Positions: Start + V*2, Start + V*3...
            const numMore = count - 1;
            for (let i = 1; i <= numMore; i++) {
                const multiplier = i + 1;
                const pos = state.moveStartPosition.clone().add(vector.clone().multiplyScalar(multiplier));
                copyObject(baseObj, pos);
            }
        } else if (mode === 'divide') {
            // Divide the space between start and end (current last copy)
            // Space is `vector`. We want `count` segments.
            // Move last copy is at `Start + Vector`.
            // We need copies at `Start + Vector * (1/count)`, `Start + Vector * (2/count)`...

            // Wait, standard Divide behavior:
            // You move copy to END Point.
            // Type /3.
            // 2 copies created in between.

            // Current state:
            // Original at Start.
            // LastCopy at Start + Vector (End).

            const step = vector.clone().divideScalar(count);
            for (let i = 1; i < count; i++) {
                const pos = state.moveStartPosition.clone().add(step.clone().multiplyScalar(i));
                copyObject(baseObj, pos);
            }
        }

        if (window.HistoryManager) HistoryManager.save();
        stop();
    }

    function executeRadialArray(input) {
        if (!state.radialCenter || !state.sourceObj) return;

        // Input: "360" (degrees total fill), "45" (step angle?), "5x" (count)
        // Let's assume user must provide Count AND Angle?
        // Or default angle = 360?
        // Standard behavior:
        // Type "5x" -> 5 copies distributed around 360? Or around last angle?
        // We haven't defined an angle yet!

        // Simplified Radial:
        // 1. User types "5x" -> Create 5 copies around 360 degrees.
        // 2. User types "45" -> Rotate object 45 degrees.

        // Let's try parsing:
        let count = 0;
        let angle = 360;

        if (input.includes('x')) {
            // "5x" or "x5"
            count = parseInt(input.replace('x', ''));
        } else {
            // Treat as angle?
            // Not enough info to just Rotate one?
            // Actually, Radial Array usually requires Angle AND Count.
            // Or Copy Mode in Rotate Tool.

            // Let's implement simple "Count around 360" for "x" input.
            // And "Count with 360" defaults.
        }

        if (count > 0) {
            const stepAngle = (Math.PI * 2) / count;
            const center = state.radialCenter;
            const axis = new THREE.Vector3(0, 1, 0); // Y axis default

            for (let i = 1; i < count; i++) {
                const newObj = copyObject(state.sourceObj, state.sourceObj.mesh.position); // Temp pos

                // Rotate position around center
                const objPos = newObj.mesh.position.clone().sub(center);
                objPos.applyAxisAngle(axis, stepAngle * i);
                newObj.mesh.position.copy(center.clone().add(objPos));

                // Rotate object itself
                newObj.mesh.rotateOnWorldAxis(axis, stepAngle * i);

                Engine.syncConfigFromTransform(newObj);
            }

            if (window.HistoryManager) HistoryManager.save();
            stop();
        }
    }

    function onKeyDown(event) {
        // Toggle Copy (Ctrl)
        if (event.key === 'Control') {
            if (state.mode === 'move' && !state.awaitingArrayInput) {
                state.isCopyMode = !state.isCopyMode;
                updateInstruction();
            }
        }

        // Array Input
        if (state.awaitingArrayInput) {
            if (event.key === 'Enter') {
                executeArray(state.arrayInput);
                return;
            }
            if (event.key === 'Escape') {
                stop();
                return;
            }
            if (event.key === 'Backspace') {
                state.arrayInput = state.arrayInput.slice(0, -1);
                showInstruction(`Array: ${state.arrayInput}`);
                return;
            }
            if (/^[0-9xX/*.-]$/.test(event.key)) {
                state.arrayInput += event.key;
                showInstruction(`Array: ${state.arrayInput}`);
                return;
            }
        }

        if (event.key === 'Escape') {
            stop();
            if (window.App) App.cancelActiveTool();
        }
    }

    // Public API
    return {
        init,
        start,
        stop,
        setSnapType: console.log, // Placeholder
        isActive: () => state.active,
        exit: stop,
        setCopyMode
    };
})();
