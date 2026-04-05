import { Engine } from '../core/engine.js';
import { FloorManager } from '../managers/floor-manager.js';
import { GeometryFactory } from '../factories/geometry-factory.js';
import { HistoryManager } from '../managers/history-manager.js';

export const DrawingTool = (() => {
    let state = {
        active: false,
        type: null, // 'line', 'rectangle', 'arc', 'circle', 'polygon', 'polyline'
        points: [],
        previewLine: null,
        tempPoints: [],
        lastMousePoint: null
    };

    let drawingState = {
        inputBuffer: '',
        snapPoint: null,
        isClosing: false
    };

    function centerShapeGeometry(geometry) {
        if (!geometry) return;
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
        return center;
    }

    function init(engine) {
        console.log('DrawingTool initialized');
        window.DrawingTool = this;
    }

    function startDrawing(type) {
        if (state.active && state.type === type) {
            cancelDrawing();
            return;
        }

        cancelDrawing();
        state.active = true;
        state.type = type;
        drawingState.inputBuffer = '';
        drawingState.snapPoint = null;
        drawingState.isClosing = false;

        console.log(`Starting drawing: ${type}`);

        Engine.addEventListener('viewport-click', onPointAdd);
        Engine.getRenderer().domElement.addEventListener('mousemove', onMove);
        Engine.getRenderer().domElement.addEventListener('contextmenu', onRightClick);
        window.addEventListener('keydown', onKeyDown);
    }

    function onPointAdd({ event, type: clickType }) {
        if (!state.active || clickType !== 'down') return;

        let point;
        if (drawingState.snapPoint) {
            point = drawingState.snapPoint.clone();
        } else {
            const intersects = Engine.getMouseIntersects(event);
            if (intersects.plane.length > 0) {
                point = intersects.plane[0].point;
                const currentFloor = FloorManager.getCurrentFloorData();
                point.y = currentFloor ? currentFloor.ffl : 0;
            }
        }

        if (point) {
            if (drawingState.isClosing && state.type === 'polyline' && state.points.length >= 2) {
                state.points.push(state.points[0].clone());
                finishDrawing();
                return;
            }

            state.points.push(point.clone());
            drawingState.inputBuffer = '';
            checkCompletion();
        }
    }

    function onMove(event) {
        if (!state.active) return;

        const intersects = Engine.getMouseIntersects(event);
        if (intersects.plane.length > 0) {
            let point = intersects.plane[0].point;
            const currentFloor = FloorManager.getCurrentFloorData();
            point.y = currentFloor ? currentFloor.ffl : 0;
            state.lastMousePoint = point.clone();

            // Vertex Snapping
            const snap = Engine.getNearbyVertex(point, 0.4);
            drawingState.snapPoint = snap;
            drawingState.isClosing = false;

            if (snap) {
                point = snap;
                // Check for auto-close
                if (state.type === 'polyline' && state.points.length >= 2) {
                    if (snap.distanceTo(state.points[0]) < 0.1) {
                        drawingState.isClosing = true;
                        if (window.App) window.App.showInputOverlay('Click to Close Polygon');
                    }
                }
            } else if (window.App && state.points.length > 0) {
                const hints = {
                    'polyline': 'Click points to draw. Right-click to finish.',
                    'line': 'Click second point or type distance.'
                };
                window.App.showInputOverlay(drawingState.inputBuffer ? `Distance: ${drawingState.inputBuffer}m` : (hints[state.type] || 'Drawing...'));
            }

            if (state.points.length > 0) {
                updatePreview(point);
            }
        }
    }

    function onKeyDown(event) {
        if (!state.active) return;

        // Numeric input for distance
        if (/[0-9.]/.test(event.key)) {
            drawingState.inputBuffer += event.key;
            if (window.App) window.App.showInputOverlay(`Distance: ${drawingState.inputBuffer}m`);
            return;
        }

        if (event.key === 'Backspace') {
            drawingState.inputBuffer = drawingState.inputBuffer.slice(0, -1);
            if (window.App) window.App.showInputOverlay(`Distance: ${drawingState.inputBuffer}m`);
            return;
        }

        if (event.key === 'Enter' && drawingState.inputBuffer && state.points.length > 0) {
            const distance = parseFloat(drawingState.inputBuffer);
            if (!isNaN(distance)) {
                // Get mouse direction from last point
                const mousePos = state.lastMousePoint;
                if (mousePos) {
                    const lastPoint = state.points[state.points.length - 1];
                    const dir = new THREE.Vector3().subVectors(mousePos, lastPoint).normalize();
                    const nextPoint = lastPoint.clone().add(dir.multiplyScalar(distance));
                    state.points.push(nextPoint);
                    drawingState.inputBuffer = '';
                    checkCompletion();
                }
            }
        }

        if (event.key === 'Escape') {
            cancelDrawing();
        }
    }

    function updatePreview(mousePoint) {
        if (state.previewLine) Engine.getScene().remove(state.previewLine);

        let previewPoints = [];

        switch (state.type) {
            case 'line':
                previewPoints = [state.points[0], mousePoint];
                break;
            case 'polyline':
                previewPoints = [...state.points, mousePoint];
                break;
            case 'rectangle':
                const p1 = state.points[0];
                previewPoints = [
                    p1,
                    new THREE.Vector3(mousePoint.x, p1.y, p1.z),
                    mousePoint,
                    new THREE.Vector3(p1.x, p1.y, mousePoint.z),
                    p1
                ];
                break;
            case 'circle':
                const center = state.points[0];
                const radius = center.distanceTo(mousePoint);
                previewPoints = createCirclePoints(center, radius);
                break;
            case 'polygon':
                const pCenter = state.points[0];
                const pRadius = pCenter.distanceTo(mousePoint);
                previewPoints = createPolygonPoints(pCenter, pRadius, 6); // Default 6 sides
                break;
            case 'arc':
                if (state.points.length === 1) {
                    previewPoints = [state.points[0], mousePoint];
                } else if (state.points.length === 2) {
                    previewPoints = createArcPoints(state.points[0], state.points[1], mousePoint);
                }
                break;
        }

        if (previewPoints.length > 1) {
            const geometry = new THREE.BufferGeometry().setFromPoints(previewPoints);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            state.previewLine = new THREE.Line(geometry, material);
            Engine.getScene().add(state.previewLine);
        }
    }

    function checkCompletion() {
        let complete = false;

        switch (state.type) {
            case 'line':
                if (state.points.length === 2) complete = true;
                break;
            case 'rectangle':
                if (state.points.length === 2) complete = true;
                break;
            case 'circle':
                if (state.points.length === 2) complete = true;
                break;
            case 'polygon':
                if (state.points.length === 2) complete = true;
                break;
            case 'arc':
                if (state.points.length === 3) complete = true;
                break;
            // polyline is completed by right-click
        }

        if (complete) {
            finishDrawing();
        }
    }

    function finishDrawing() {
        if (state.points.length < 2) {
            cancelDrawing();
            return;
        }

        const currentFloor = FloorManager.getCurrentFloorData();
        const ffl = currentFloor ? currentFloor.ffl : 0;

        // Create shape points for all drawing types that can be edited with SplineVertexTool
        let shapePoints = [];
        let blockType = 'shape';
        let params = { type: state.type };

        switch (state.type) {
            case 'line':
                // Convert line to a shape with points that can be edited
                shapePoints = [
                    {x: state.points[0].x, y: ffl, z: state.points[0].z},
                    {x: state.points[1].x, y: ffl, z: state.points[1].z}
                ];
                break;
            case 'rectangle':
                const p1 = state.points[0];
                const p2 = state.points[1];
                shapePoints = [
                    {x: p1.x, y: ffl, z: p1.z},
                    {x: p2.x, y: ffl, z: p1.z},
                    {x: p2.x, y: ffl, z: p2.z},
                    {x: p1.x, y: ffl, z: p2.z},
                    {x: p1.x, y: ffl, z: p1.z} // Close the shape
                ];
                break;
            case 'circle':
                const center = state.points[0];
                const radius = center.distanceTo(state.points[1]);
                const circlePoints = createCirclePoints(center, radius);
                shapePoints = circlePoints.map(p => ({x: p.x, y: ffl, z: p.z}));
                params.radius = radius;
                break;
            case 'polygon':
                const pCenter = state.points[0];
                const pRadius = pCenter.distanceTo(state.points[1]);
                const polyPoints = createPolygonPoints(pCenter, pRadius, 6);
                shapePoints = polyPoints.map(p => ({x: p.x, y: ffl, z: p.z}));
                params.radius = pRadius;
                params.segments = 6;
                break;
            case 'arc':
                const arcPoints = createArcPoints(state.points[0], state.points[1], state.points[2]);
                shapePoints = arcPoints.map(p => ({x: p.x, y: ffl, z: p.z}));
                break;
            case 'polyline':
                shapePoints = state.points.map(p => ({x: p.x, y: ffl, z: p.z}));
                break;
        }

        // Add points to params for SplineVertexTool
        params.points = shapePoints;

        if (shapePoints.length >= 2) {
            // Calculate center for positioning
            let centerX = 0, centerZ = 0, centerY = 0;
            shapePoints.forEach(p => {
                centerX += p.x;
                centerY += p.y;
                centerZ += p.z;
            });
            centerX /= shapePoints.length;
            centerY /= shapePoints.length;
            centerZ /= shapePoints.length;

            // Create a line geometry that can be edited with SplineVertexTool
            const v3Points = shapePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
            const geometry = new THREE.BufferGeometry().setFromPoints(v3Points);
            
            // Center this geometry so position represents true pivot
            const bbox = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            geometry.translate(-center.x, -center.y, -center.z);

            if (geometry) {
                const config = {
                    floor: currentFloor ? currentFloor.name : 'Ground Floor',
                    mat: 'concrete',
                    type: 'block',
                    blockType: 'shape',
                    pos: { x: centerX, y: centerY, z: centerZ },
                    rot: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    params: params
                };
                
                // Use Line geometry for all shapes so they can be edited with SplineVertexTool
                const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x888888 }));
                
                const obj = Engine.addObject(config, mesh);
                if (obj && obj.mesh) {
                    obj.mesh.position.set(centerX, centerY, centerZ);
                    Engine.syncConfigFromTransform(obj);
                }
            }
        }

        cancelDrawing();
    }

    function createLineGeometry(points, thickness, height) {
        // Simple rectangular extrusion for a line
        const p1 = points[0];
        const p2 = points[1];
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const length = dir.length();
        const angle = Math.atan2(dir.z, dir.x);

        const geometry = new THREE.BoxGeometry(length, thickness, 0.1);
        geometry.translate(length / 2, height + thickness / 2, 0);
        geometry.rotateY(-angle);
        geometry.translate(p1.x, 0, p1.z);

        return geometry;
    }

    function createCirclePoints(center, radius, segments = 32) {
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                center.x + radius * Math.cos(theta),
                center.y,
                center.z + radius * Math.sin(theta)
            ));
        }
        return points;
    }

    function createPolygonPoints(center, radius, segments) {
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                center.x + radius * Math.cos(theta),
                center.y,
                center.z + radius * Math.sin(theta)
            ));
        }
        return points;
    }

    function createArcPoints(p1, p2, p3, segments = 20) {
        // Simple 3-point arc implementation or quadratic bezier
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * p2.x + t * t * p3.x;
            const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * p2.y + t * t * p3.y;
            const z = (1 - t) * (1 - t) * p1.z + 2 * (1 - t) * t * p2.z + t * t * p3.z;
            points.push(new THREE.Vector3(x, y, z));
        }
        return points;
    }

    function onRightClick(event) {
        event.preventDefault();
        if (state.type === 'polyline' && state.points.length >= 2) {
            finishDrawing();
        } else {
            cancelDrawing();
        }
    }

    function cancelDrawing() {
        state.active = false;
        state.points = [];
        if (state.previewLine) Engine.getScene().remove(state.previewLine);
        state.previewLine = null;

        Engine.removeEventListener('viewport-click', onPointAdd);
        Engine.getRenderer().domElement.removeEventListener('mousemove', onMove);
        Engine.getRenderer().domElement.removeEventListener('contextmenu', onRightClick);
        window.removeEventListener('keydown', onKeyDown);

        if (window.App) {
            // We need a way to tell App that we are done to update UI
            // But for now let's just assume App calls us.
        }
    }

    function exit() {
        cancelDrawing();
    }

    return { init, startDrawing, cancelDrawing, exit };
})();
