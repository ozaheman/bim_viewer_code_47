import { Engine } from '../core/engine.js';
import { COLORS } from '../core/constants.js';

export const MeasureTool = (() => {
    // Tool state
    let state = {
        active: false,
        stage: 'pick_first', // 'pick_first', 'pick_second'
        point1: null,
        point2: null,
        measurementLine: null,
        measurementLabel: null,
        snapPoints: [],
        snapMarkers: [],
        // Persistent points for labels
        lastPoints: null,
        dragStart: { x: 0, y: 0 }
    };

    // Initialize tool
    function init(engine) {
        console.log('MeasureTool initialized');
    }

    // Start measure tool
    function start() {
        state.active = true;
        state.stage = 'pick_first';

        // Create measurement label if it doesn't exist
        if (!state.measurementLabel) {
            state.measurementLabel = document.getElementById('measure-label');
            if (!state.measurementLabel) {
                state.measurementLabel = document.createElement('div');
                state.measurementLabel.id = 'measure-label';
                state.measurementLabel.style.position = 'absolute';
                state.measurementLabel.style.pointerEvents = 'none';
                state.measurementLabel.style.display = 'none';
                document.getElementById('viewer-container').appendChild(state.measurementLabel);
            }
        }

        // Generate snap points
        generateSnapPoints();

        // Show instruction
        if (window.App && window.App.showInputOverlay) {
            window.App.showInputOverlay('Click first point to measure...');
        }

        console.log('MeasureTool started');
    }

    // Stop tool
    function stop() {
        if (!state.active) return;
        state.active = false;

        // Clear visualization
        clearMeasurement();
        clearSnapPoints();

        // Hide label
        if (state.measurementLabel) {
            state.measurementLabel.style.display = 'none';
        }

        // Hide overlay
        if (window.App && window.App.hideInputOverlay) {
            window.App.hideInputOverlay();
        }

        state.lastPoints = null;
    }

    // Generate snap points on objects
    function generateSnapPoints() {
        const scene = Engine.getScene();
        if (!scene) return;

        const objects = Engine.getObjects();

        // Generate snap points on all visible objects
        objects.forEach(obj => {
            if (!obj.mesh.visible) return;

            const bbox = new THREE.Box3().setFromObject(obj.mesh);
            const points = getSnapPointsForBoundingBox(bbox);

            points.forEach(point => {
                // Create visual marker
                const marker = createSnapMarker(point);
                marker.userData = {
                    isSnapPoint: true,
                    point: point.clone()
                };

                scene.add(marker);
                state.snapMarkers.push(marker);
                state.snapPoints.push(point);
            });
        });
    }

    // Get snap points for a bounding box
    function getSnapPointsForBoundingBox(bbox) {
        const points = [];
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Corners
        points.push(new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z));
        points.push(new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z));
        points.push(new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z));
        points.push(new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z));
        points.push(new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z));
        points.push(new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z));
        points.push(new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z));
        points.push(new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z));

        // Center
        points.push(center);

        return points;
    }

    // Create snap point marker
    function createSnapMarker(position) {
        const geometry = new THREE.SphereGeometry(0.1, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6
        });

        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);

        return marker;
    }

    // Clear snap points
    function clearSnapPoints() {
        const scene = Engine.getScene();
        if (!scene) return;

        state.snapMarkers.forEach(marker => {
            scene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });

        state.snapMarkers = [];
        state.snapPoints = [];
    }

    // Clear measurement visualization
    function clearMeasurement() {
        const scene = Engine.getScene();
        if (!scene) return;

        if (state.measurementLine) {
            scene.remove(state.measurementLine);
            if (state.measurementLine.geometry) state.measurementLine.geometry.dispose();
            if (state.measurementLine.material) state.measurementLine.material.dispose();
            state.measurementLine = null;
        }
    }

    // Raycast pick logic
    function getPointFromIntersects(intersects) {
        let pickedPoint = null;

        // Check for snap point first
        intersects.meshes.forEach(intersect => {
            if (intersect.object.userData?.isSnapPoint) {
                pickedPoint = intersect.object.userData.point;
            }
        });

        // If no snap point, check plane
        if (!pickedPoint && intersects.plane.length > 0) {
            pickedPoint = intersects.plane[0].point;
        }

        return pickedPoint;
    }

    // Pointer Down handler
    function onPointerDown(event) {
        if (!state.active) return;
        state.dragStart = { x: event.clientX, y: event.clientY };
    }

    // Pointer Up handler (handles picking)
    function onPointerUp(event) {
        if (!state.active) return;

        // Check for drag
        const dist = Math.sqrt(Math.pow(event.clientX - state.dragStart.x, 2) + Math.pow(event.clientY - state.dragStart.y, 2));
        if (dist > 5) return; // Ignore drags (camera movement)

        const intersects = Engine.getMouseIntersects(event);
        const clickedPoint = getPointFromIntersects(intersects);

        if (!clickedPoint) return;

        if (state.stage === 'pick_first') {
            state.point1 = clickedPoint.clone();
            state.stage = 'pick_second';

            if (window.App && window.App.showInputOverlay) {
                window.App.showInputOverlay('Click second point...');
            }
        } else {
            state.point2 = clickedPoint.clone();
            state.lastPoints = { p1: state.point1.clone(), p2: state.point2.clone() };
            createMeasurement(state.point1, state.point2);

            // Reset for next measurement
            state.stage = 'pick_first';
            state.point1 = null;
            state.point2 = null;

            if (window.App && window.App.showInputOverlay) {
                window.App.showInputOverlay('Click first point to measure...');
            }
        }
    }

    // Mouse click handler (backward compatibility or direct call)
    function onMouseClick(event) {
        onPointerDown(event);
        onPointerUp(event);
    }

    // Mouse move handler
    function onMouseMove(event, intersects) {
        if (!state.active) return;

        // If we don't have intersects provided by Engine, get them
        if (!intersects) {
            intersects = Engine.getMouseIntersects(event);
        }

        // Handle preview only in stage 2
        if (state.stage === 'pick_second' && state.point1) {
            const hoveredPoint = getPointFromIntersects(intersects);

            if (hoveredPoint) {
                state.point2 = hoveredPoint.clone();
                // Update preview line
                updatePreviewLine(state.point1, hoveredPoint);
                // Update label
                updateLabel(state.point1, hoveredPoint);
            }
        }
    }

    // Create measurement between two points
    function createMeasurement(point1, point2) {
        clearMeasurement();

        const scene = Engine.getScene();
        if (!scene) return;

        // Create line geometry
        const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
        const material = new THREE.LineBasicMaterial({
            color: COLORS.MEASURE,
            linewidth: 2
        });

        state.measurementLine = new THREE.Line(geometry, material);
        scene.add(state.measurementLine);

        // Calculate distance
        const distance = point1.distanceTo(point2);
        const deltaX = Math.abs(point2.x - point1.x);
        const deltaY = Math.abs(point2.y - point1.y);
        const deltaZ = Math.abs(point2.z - point1.z);

        // Create label
        const midPoint = new THREE.Vector3()
            .addVectors(point1, point2)
            .multiplyScalar(0.5);

        updateLabel(point1, point2);

        // Position label at midpoint
        if (state.measurementLabel) {
            const screenPoint = worldToScreen(midPoint);
            if (screenPoint) {
                state.measurementLabel.style.left = screenPoint.x + 'px';
                state.measurementLabel.style.top = screenPoint.y + 'px';
                state.measurementLabel.style.display = 'block';
            }
        }

        // Record action
        if (window.StepsDisplay && window.StepsDisplay.recordAction) {
            window.StepsDisplay.recordAction(`Measured distance: ${distance.toFixed(2)}m`);
        }
    }

    // Update preview line
    function updatePreviewLine(point1, point2) {
        clearMeasurement();

        const scene = Engine.getScene();
        if (!scene) return;

        const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
        const material = new THREE.LineBasicMaterial({
            color: COLORS.MEASURE,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });

        state.measurementLine = new THREE.Line(geometry, material);
        scene.add(state.measurementLine);
    }

    // Update measurement label
    function updateLabel(point1, point2) {
        if (!state.measurementLabel) return;

        const distance = point1.distanceTo(point2);
        const deltaX = (point2.x - point1.x).toFixed(2);
        const deltaY = (point2.y - point1.y).toFixed(2);
        const deltaZ = (point2.z - point1.z).toFixed(2);

        state.measurementLabel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 2px;">Distance: ${distance.toFixed(2)}m</div>
            <div style="font-size: 11px;">
                ΔX: ${deltaX}m | ΔY: ${deltaY}m | ΔZ: ${deltaZ}m
            </div>
        `;

        // Position label
        const midPoint = new THREE.Vector3()
            .addVectors(point1, point2)
            .multiplyScalar(0.5);

        const screenPoint = worldToScreen(midPoint);
        if (screenPoint) {
            state.measurementLabel.style.left = screenPoint.x + 'px';
            state.measurementLabel.style.top = screenPoint.y + 'px';
            state.measurementLabel.style.display = 'block';
        }
    }

    // Convert world coordinates to screen coordinates
    function worldToScreen(worldPoint) {
        const camera = Engine.getCamera();
        const renderer = Engine.getRenderer();

        if (!camera || !renderer) return null;

        const vector = worldPoint.clone();
        vector.project(camera);

        const width = window.innerWidth;
        const height = window.innerHeight;

        const x = (vector.x * 0.5 + 0.5) * width;
        const y = (-(vector.y * 0.5) + 0.5) * height;

        return { x: Math.round(x), y: Math.round(y) };
    }

    // Key down handler
    function onKeyDown(event) {
        if (event.key === 'Escape') {
            stop();
        }
    }

    // Update function called every frame by Engine
    function update() {
        if (!state.active) return;

        // If we are in the middle of a measurement, point2 is already being updated by onMouseMove
        if (state.stage === 'pick_second' && state.point1 && state.point2) {
            updateLabel(state.point1, state.point2);
        }
        // If we have a finished measurement, keep the label positioned correctly
        else if (state.lastPoints) {
            updateLabel(state.lastPoints.p1, state.lastPoints.p2);
        }
    }

    // Check if tool is active
    function isActive() {
        return state.active;
    }

    // Public API
    return {
        init,
        start,
        stop,
        isActive,
        update,
        onPointerDown,
        onPointerMove: onMouseMove,
        onPointerUp,
        onKeyDown,
        exit: stop
    };
})();