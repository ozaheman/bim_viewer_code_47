import { Engine } from '../core/engine.js';
import { SNAP_TYPES, COLORS } from '../core/constants.js';

export const SnapMoveTool = (() => {
    // Tool state
    let state = {
        active: false,
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
        moveStartPosition: null
    };

    // Initialize tool
    function init(engine) {
        console.log('SnapMoveTool initialized');
        createInstructionElement();
    }

    // Create instruction element
    function createInstructionElement() {
        state.instructionElement = document.createElement('div');
        state.instructionElement.id = 'snap-move-instruction';
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

    // Show instruction
    function showInstruction(text) {
        if (state.instructionElement) {
            state.instructionElement.textContent = text;
            state.instructionElement.style.display = 'block';
        }
    }

    // Hide instruction
    function hideInstruction() {
        if (state.instructionElement) {
            state.instructionElement.style.display = 'none';
        }
    }

    // Start snap move tool
    function start() {
        console.log('Starting Snap Move tool...');

        // Reset state
        reset();

        state.active = true;

        // Get active snap type from UI
        const activeSnapBtn = document.querySelector('#snap-point-modes button.active-tool');
        if (activeSnapBtn) {
            const btnId = activeSnapBtn.id;
            if (btnId.includes('corners')) state.snapType = SNAP_TYPES.CORNERS;
            else if (btnId.includes('midpoints')) state.snapType = SNAP_TYPES.MIDPOINTS;
            else if (btnId.includes('center')) state.snapType = SNAP_TYPES.CENTER;
        }

        // Generate snap points on all objects
        generateSnapPoints();

        // Show initial instruction
        showInstruction('STEP 1: Click a snap point on any object to move');

        // Setup event listeners
        const container = Engine.getRenderer().domElement;
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('click', onMouseClick);
        document.addEventListener('keydown', onKeyDown);
    }

    // Stop tool
    function stop() {
        if (!state.active) return;
        console.log('Stopping Snap Move tool.');

        reset();

        const container = Engine.getRenderer().domElement;
        container.removeEventListener('mousemove', onMouseMove);
        container.removeEventListener('click', onMouseClick);
        document.removeEventListener('keydown', onKeyDown);

        state.active = false;
        hideInstruction();
    }

    // Reset all tool state
    function reset() {
        clearSnapPoints();
        clearPreview();
        clearPreviewVector();

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
    }

    // Set snap type
    function setSnapType(type) {
        if (Object.values(SNAP_TYPES).includes(type)) {
            state.snapType = type;
            if (state.active) {
                clearSnapPoints();
                generateSnapPoints();
            }
        }
    }

    // Create preview mesh (semi-transparent copy of object)
    function createPreviewMesh() {
        if (!state.sourceObj?.mesh) return;
        const originalMesh = state.sourceObj.mesh;

        // Clone the mesh
        state.previewMesh = originalMesh.clone();

        // Make it semi-transparent
        state.previewMesh.traverse(child => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.5;
                child.material.depthWrite = false;
                child.material.needsUpdate = true;
            }
        });

        // Hide original while in preview mode
        originalMesh.visible = false;
        Engine.getScene().add(state.previewMesh);
    }
    function generateSnapPoints() {
        const scene = Engine.getScene();
        if (!scene) return;

        // Get all objects
        const objects = Engine.getObjects();
        const renderer = Engine.getRenderer();

        objects.forEach(obj => {
            if (!obj.mesh.visible) return;

            const bbox = new THREE.Box3().setFromObject(obj.mesh);
            let points = getSnapPointsForBoundingBox(bbox, state.snapType);

            // For CENTER snap type, use mesh.position as the actual center
            // This ensures non-closed shapes move correctly from their pivot
            if (state.snapType === SNAP_TYPES.CENTER) {
                points = [obj.mesh.position.clone()];
            }

            points.forEach(point => {
                const marker = createSnapMarker(point, state.snapType);
                if (!marker) { // Safety check
                    console.error('Failed to create snap marker');
                    return;
                }

                marker.userData = {
                    isSnapPoint: true,
                    object: obj,
                    point: point.clone(),
                    type: state.snapType,
                    isCube: true
                };

                // Make sure marker is added to scene graph
                scene.add(marker);

                // Ensure marker layers match camera layers
                if (renderer && renderer.camera) {
                    marker.layers.mask = renderer.camera.layers.mask;
                }

                state.snapMarkers.push(marker);
            });
        });
    }
    // Generate snap points on all visible objects
    function generateSnapPointsxx() {
        const scene = Engine.getScene();
        if (!scene) return;

        const objects = Engine.getObjects();

        objects.forEach(obj => {
            if (!obj.mesh.visible) return;

            // Get bounding box and snap points
            const bbox = new THREE.Box3().setFromObject(obj.mesh);
            const points = getSnapPointsForBoundingBox(bbox, state.snapType);

            // Create visual markers for each snap point
            points.forEach(point => {
                const marker = createSnapMarker(point, state.snapType);
                marker.userData = {
                    isSnapPoint: true,
                    object: obj,
                    point: point.clone(),
                    type: state.snapType,
                    isCube: true
                };

                scene.add(marker);
                state.snapMarkers.push(marker);
            });
        });
    }

    // Get snap points for a bounding box based on snap type
    function getSnapPointsForBoundingBox(bbox, snapType) {
        const points = [];
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        switch (snapType) {
            case SNAP_TYPES.CORNERS:
                // 8 corner points
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
                // 12 edge midpoints
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
                // 1 center point
                points.push(center);
                break;
        }

        return points;
    }

    // Replace createSnapMarker with a simpler version
    function createSnapMarker(position, snapType) {
        const colors = {
            [SNAP_TYPES.CORNERS]: 0x00ffff,    // Cyan
            [SNAP_TYPES.MIDPOINTS]: 0x00ff00,  // Green
            [SNAP_TYPES.CENTER]: 0xff00ff      // Magenta
        };

        const markerSize = 0.25;
        const geometry = new THREE.BoxGeometry(markerSize, markerSize, markerSize);

        // SIMPLER: Create just a cube mesh, not a group
        const material = new THREE.MeshBasicMaterial({
            color: colors[snapType] || 0xffff00,
            transparent: true,
            opacity: 0.7,
            depthTest: true
        });

        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);

        // Make it slightly larger for easier clicking
        marker.scale.set(1.2, 1.2, 1.2);

        // Ensure it can be raycast
        marker.raycast = THREE.Mesh.prototype.raycast;

        return marker;
    }

    // Clear all snap point markers
    function clearSnapPoints() {
        const scene = Engine.getScene();
        if (!scene) return;

        state.snapMarkers.forEach(marker => {
            scene.remove(marker);
            marker.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });

        state.snapMarkers = [];
    }

    // Clear preview mesh
    function clearPreview() {
        if (state.previewMesh) {
            const scene = Engine.getScene();
            if (scene) scene.remove(state.previewMesh);

            state.previewMesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });

            state.previewMesh = null;
        }

        // Restore original object visibility
        if (state.sourceObj?.mesh) {
            state.sourceObj.mesh.visible = true;
        }
    }

    // Create/update preview vector line
    function updatePreviewVector(startPoint, endPoint) {
        if (!state.previewVector) {
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineDashedMaterial({
                color: COLORS.SNAP_SELECTION || 0xff9900,
                dashSize: 0.2,
                gapSize: 0.1,
                linewidth: 2
            });
            state.previewVector = new THREE.Line(geometry, material);
            Engine.getScene().add(state.previewVector);
        }

        const points = [startPoint, endPoint];
        state.previewVector.geometry.setFromPoints(points);
        state.previewVector.computeLineDistances(); // Required for dashed lines
        state.previewVector.visible = true;
    }

    // Clear preview vector
    function clearPreviewVector() {
        if (state.previewVector) {
            Engine.getScene().remove(state.previewVector);
            state.previewVector.geometry.dispose();
            state.previewVector.material.dispose();
            state.previewVector = null;
        }
    }

    // Update updateMarkerAppearance for simpler mesh
    function updateMarkerAppearance(marker, appearanceState) {
        if (!marker || !marker.material) return;

        const baseColors = {
            [SNAP_TYPES.CORNERS]: 0x00ffff,
            [SNAP_TYPES.MIDPOINTS]: 0x00ff00,
            [SNAP_TYPES.CENTER]: 0xff00ff
        };

        const colorMap = {
            'selected': 0xff9900,  // Orange
            'hover': 0xffff00,     // Yellow
            'default': baseColors[marker.userData?.type] || 0xffff00
        };

        const opacityMap = {
            'selected': 1.0,
            'hover': 0.9,
            'default': 0.7
        };

        const scaleMap = {
            'selected': 1.4,
            'hover': 1.2,
            'default': 1.0
        };

        if (appearanceState in colorMap) {
            marker.material.color.set(colorMap[appearanceState]);
            marker.material.opacity = opacityMap[appearanceState];
            marker.material.needsUpdate = true;
            marker.scale.setScalar(scaleMap[appearanceState]);
        }
    }

    // Simplify getSnapMarkerFromIntersects
    function getSnapMarkerFromIntersects(intersects) {
        if (!intersects || !intersects.meshes) return null;

        for (const intersect of intersects.meshes) {
            const obj = intersect.object;
            if (obj.userData?.isSnapPoint) {
                return obj;
            }
        }

        return null;
    }

    // Mouse move handler
    function onMouseMove(event) {
        if (!state.active || !state.previewMesh) return;

        const intersects = Engine.getMouseIntersects(event);
        console.log('All intersections:', intersects); // Debug log
        const snapMarker = getSnapMarkerFromIntersects(intersects);

        // Handle hover effects
        if (!state.sourcePoint || (state.sourcePoint && snapMarker && snapMarker !== state.selectedMarker)) {
            // Clear previous hover
            if (state.hoveredMarker && state.hoveredMarker !== state.selectedMarker) {
                updateMarkerAppearance(state.hoveredMarker, 'default');
            }

            // Set new hover
            state.hoveredMarker = snapMarker;

            if (state.hoveredMarker && state.hoveredMarker !== state.selectedMarker) {
                updateMarkerAppearance(state.hoveredMarker, 'hover');
            }
        }

        // Update preview position and vector line
        if (state.sourcePoint && state.hoveredMarker) {
            state.targetPoint = state.hoveredMarker.userData.point;
            state.previewMesh.position.copy(state.targetPoint).add(state.sourceOffset);
            updatePreviewVector(state.sourcePoint, state.targetPoint);
        } else if (state.sourcePoint && !state.hoveredMarker) {
            clearPreviewVector();
        }
    }

    // Mouse click handler
    function onMouseClick(event) {
        if (!state.active) return;

        const canvas = Engine.getRenderer().domElement;
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();

        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Create raycaster directly
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Engine.getCamera());

        // Check intersections with all snap markers
        const intersects = raycaster.intersectObjects(state.snapMarkers);

        if (intersects.length === 0) return;

        const clickedMarker = intersects[0].object;
        const clickedSnapData = clickedMarker.userData;

        if (!state.sourcePoint) {
            // FIRST CLICK: Select source object and point
            // FIRST CLICK: Select source object and point
            state.sourceObj = clickedSnapData.object;
            state.originalObject = state.sourceObj;
            state.originalPosition = state.sourceObj.mesh.position.clone();
            state.moveStartPosition = state.originalPosition.clone();

            // Now that we have the object, create its preview mesh
            createPreviewMesh();

            // Set the source point for movement calculation
            state.sourcePoint = clickedSnapData.point.clone();
            state.sourceOffset = new THREE.Vector3().subVectors(
                state.sourceObj.mesh.position,
                state.sourcePoint
            );

            // Highlight the selected source marker
            if (state.selectedMarker) {
                updateMarkerAppearance(state.selectedMarker, 'default');
            }
            state.selectedMarker = clickedMarker;
            updateMarkerAppearance(state.selectedMarker, 'selected');

            console.log('Source object and point set:', state.sourceObj.id, state.sourcePoint);
            showInstruction('STEP 2: Click a target snap point on another object');

            // If the source object was selected, deselect it visually
            if (Engine.getSelection() === state.sourceObj) {
                Engine.deselectObject();
            }

        } else {
            // SECOND CLICK: Select target point and perform move
            if (clickedSnapData.object === state.sourceObj) {
                showInstruction('ERROR: Target must be on a different object');
                return; // Ignore clicks on the same object for the target
            }

            performMove(clickedSnapData.point, event.shiftKey);
        }
    }

    // Perform the actual movement or copy
    // Perform the actual movement or copy
    function performMove(targetPoint, isCopy = false) {
        if (!state.sourceObj || !state.sourceOffset) return;

        const sourceObj = state.sourceObj; // Capture reference before potential reset
        state.isCopyMode = isCopy;

        // Calculate new position
        const newPosition = targetPoint.clone().add(state.sourceOffset);

        // Calculate move vector for array operations
        state.lastMoveVector = new THREE.Vector3().subVectors(newPosition, sourceObj.mesh.position);

        if (state.isCopyMode) {
            // COPY MODE
            const originalConfig = sourceObj.config;
            const newConfig = JSON.parse(JSON.stringify(originalConfig));
            newConfig.id = Date.now(); // New ID
            newConfig.pos = { x: newPosition.x, y: newPosition.y, z: newPosition.z };

            // Create the new object using Engine
            // We need to clone the geometry to ensure independence if needed, 
            // though Engine.addObject handles mesh creation if we pass config.
            // But here we want to use the exact same geometry/mesh type.
            // Best to let Engine create it from config if possible, or clone mesh.
            // Let's clone the mesh to be safe and passed it.
            const newMesh = sourceObj.mesh.clone();
            newMesh.position.copy(newPosition);

            const newObj = Engine.addObject(newConfig, newMesh);
            state.lastCopiedObject = newObj;

            // Restore original object visibility (it was hidden by preview)
            sourceObj.mesh.visible = true;

            // Message for array
            showInstruction('COPIED! Type "5x" (multiply) or "/5" (divide) to array, or Esc to finish.');
            state.awaitingArrayInput = true;
            state.arrayInput = '';

        } else {
            // MOVE MODE (Standard)
            // Apply the move
            sourceObj.mesh.position.copy(newPosition);
            Engine.syncConfigFromTransform(sourceObj);

            // Message for array (Move doesn't usually support array in SketchUp, but we can if we want. 
            // SketchUp DOES support array after move? No, only after Copy. 
            // Wait, actually Move tool in SketchUp does support entering length. 
            // But arraying is usually for Copy. Let's restrict array to Copy mode for now as per request.)
        }

        // Clean up preview
        clearPreview();
        clearPreviewVector();

        // Update UI and history
        if (window.App) {
            if (state.isCopyMode) {
                App.showInputOverlay('Object copied. Type quantity...');
            } else {
                App.populateUI(sourceObj.config);
                App.generateScript();
                App.showInputOverlay('Object moved successfully.');
                setTimeout(() => App.hideInputOverlay(), 1500);
            }
        }

        if (window.HistoryManager) HistoryManager.save();
        if (window.StepsDisplay) window.StepsDisplay.recordAction(state.isCopyMode ? 'Copied object' : 'Moved object');

        // Reselect the moved/copied object
        Engine.selectObject(state.isCopyMode ? state.lastCopiedObject : sourceObj);

        // Stop the tool ONLY if in Move mode (not waiting for array input)
        // For Copy mode, we stay active to listen for array input via onKeyDown
        if (!state.isCopyMode) {
            stop();
        }
    }

    // Execute array operation based on input
    function executeArray(inputString) {
        if (!state.lastMoveVector || !state.lastCopiedObject || !state.originalObject) return;

        let count = 0;
        let mode = 'multiply'; // 'multiply' or 'divide'

        // Parse input
        if (inputString.endsWith('x') || inputString.endsWith('*')) {
            count = parseInt(inputString);
            mode = 'multiply';
        } else if (inputString.startsWith('*')) {
            count = parseInt(inputString.substring(1));
            mode = 'multiply';
        } else if (inputString.startsWith('/')) {
            count = parseInt(inputString.substring(1));
            mode = 'divide';
        } else {
            // Default: treat number as multiply if no operator? 
            // SketchUp treats plain number as distance usually, but for array context '5x' is explicit.
            // If user just types '5', is it distance or count? 
            // Context: "like SketchUp allow to type number for array" -> usually 5x.
            // Let's assume explicit 'x' or '/' is required for array, 
            // or if it is just an integer, maybe treat as count?
            // Let's stick to x/ for safety, or check if user said "allow to type number".
            // "type number for array".
            if (/^\d+$/.test(inputString)) {
                // If just a number, treat as multiply count (SketchUp behavior for array after copy?)
                // Actually in SketchUp, typing '5' after copy makes 5 copies? verify?
                // Yes, after Ctrl+Move, typing 5x or 5* makes copies. Typing just 5 changes distance.
                // We'll require 'x' or '/' for clear distinction, OR simple integer = count?
                // Let's implement x and / first.
                // If the user *just* types a number, we'll assume they might want to change the distance (Length).
                // But implementing Length change is complex (need to move the last copied object).
                // Let's support 'x' and '/' and also '5' as 5x for simplicity if easy.
                if (inputString.toLowerCase().includes('x')) {
                    count = parseInt(inputString);
                    mode = 'multiply';
                }
            }
        }

        if (isNaN(count) || count <= 0) return;

        const originalConfig = state.originalObject.config;
        const baseMesh = state.originalObject.mesh;

        const newObjects = [];

        if (mode === 'multiply') {
            // Create N MORE copies (we already have 1, so total N? or N additional?)
            // SketchUp: 5x means 5 COPIES TOTAL (including the one you just made? or 5 arrays?)
            // Usually 5x means 5 gaps. So 1 already made, make 4 more.
            // Let's make 'count' copies total including the first one. 
            // So we need count - 1 more.

            const numToCreate = count - 1;

            for (let i = 1; i <= numToCreate; i++) {
                // Next position: last pos + (vector * i)
                // Actually lastCopiedObject is at start + vector.
                // Next one is at start + vector * 2.
                // i starts at 1 (offset 2 vectors), i=2 (offset 3 vectors)...

                const offsetMultiplier = i + 1;
                const positionOffset = state.lastMoveVector.clone().multiplyScalar(offsetMultiplier);
                const newPosition = state.moveStartPosition.clone().add(positionOffset);

                // Clone
                const newConfig = JSON.parse(JSON.stringify(originalConfig));
                newConfig.id = Date.now() + i;
                newConfig.pos = { x: newPosition.x, y: newPosition.y, z: newPosition.z };

                const newMesh = baseMesh.clone();
                newMesh.position.copy(newPosition);

                const newObj = Engine.addObject(newConfig, newMesh);
                newObjects.push(newObj);
            }

            showInstruction(`Array created: ${count} copies.`);

        } else if (mode === 'divide') {
            // Create copies BETWEEN start and end
            // We have start (A) and end (B). We want 'count' segments.
            // So we need count-1 intermediate copies.

            const numToCreate = count - 1;
            const stepVector = state.lastMoveVector.clone().divideScalar(count);

            for (let i = 1; i <= numToCreate; i++) {
                const positionOffset = stepVector.clone().multiplyScalar(i);
                const newPosition = state.moveStartPosition.clone().add(positionOffset);

                // Clone
                const newConfig = JSON.parse(JSON.stringify(originalConfig));
                newConfig.id = Date.now() + i;
                newConfig.pos = { x: newPosition.x, y: newPosition.y, z: newPosition.z };

                const newMesh = baseMesh.clone();
                newMesh.position.copy(newPosition);

                const newObj = Engine.addObject(newConfig, newMesh);
                newObjects.push(newObj);
            }
            showInstruction(`Array created: ${count} divisions.`);
        }

        if (window.HistoryManager) HistoryManager.save();

        // Finish
        state.awaitingArrayInput = false;
        state.arrayInput = '';
        setTimeout(() => stop(), 1000);
    }

    // Key down handler
    function onKeyDown(event) {
        // Handle Array Input
        if (state.awaitingArrayInput) {
            if (event.key === 'Enter') {
                executeArray(state.arrayInput);
                return;
            }
            if (event.key === 'Escape') {
                state.awaitingArrayInput = false;
                state.arrayInput = '';
                stop();
                return;
            }
            if (event.key === 'Backspace') {
                state.arrayInput = state.arrayInput.slice(0, -1);
                showInstruction(`Array: ${state.arrayInput}`);
                return;
            }
            // Allow numbers, x, /, *
            if (/^[0-9xX/*]$/.test(event.key)) {
                state.arrayInput += event.key;
                showInstruction(`Array: ${state.arrayInput}`);
                return;
            }
        }

        if (event.key === 'Escape') {
            // Cancel and restore original position
            if (state.sourceObj && state.originalPosition && !state.isCopyMode) {
                clearPreview();
                state.sourceObj.mesh.position.copy(state.originalPosition);
                Engine.syncConfigFromTransform(state.sourceObj);
            }
            stop();

            if (window.App) App.cancelActiveTool();
        }
    }

    // Check if tool is active
    function isActive() {
        return state.active;
    }

    function setCopyMode(val) {
        state.isCopyMode = !!val;
    }

    // Public API
    return {
        init,
        start,
        stop,
        setSnapType,
        setCopyMode,
        isActive,
        reset,
        exit: stop
    };
})();