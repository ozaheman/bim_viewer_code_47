import { Engine } from '../core/engine.js';
import { FloorManager } from '../managers/floor-manager.js';
import { BlockFactory } from '../factories/block-factory.js';
import { HistoryManager } from '../managers/history-manager.js';
import { BLOCK_TYPES, EVENTS } from '../core/constants.js';

export const WallPathTool = (() => {
    let state = {
        active: false,
        points: [],
        previewLine: null,
        thickness: 0.2,
        height: 0.2,
        lastMousePoint: null
    };

    let wallState = {
        inputBuffer: '',
        snapPoint: null,
        isClosing: false
    };

    function init(engine) {
        console.log('WallPathTool initialized');
        window.WallPathTool = this;
    }

    function start() {
        if (state.active) {
            exit();
            return;
        }

        state.active = true;
        state.points = [];
        wallState.inputBuffer = '';
        wallState.snapPoint = null;
        wallState.isClosing = false;
        
        console.log('Starting Wall Path Tool');

        Engine.addEventListener(EVENTS.VIEWPORT_CLICK, onPointAdd);
        Engine.getRenderer().domElement.addEventListener('mousemove', onMove);
        Engine.getRenderer().domElement.addEventListener('contextmenu', onRightClick);
        window.addEventListener('keydown', onKeyDown);
    }

    function onPointAdd({ event, type: clickType }) {
        if (!state.active || clickType !== 'down') return;

        const intersects = Engine.getMouseIntersects(event);
        
        // Check if we clicked on an existing shape/polyline to derive from
        const shapeIntersect = intersects.meshes.find(o => 
            o.object.userData.config?.blockType === 'polyline' || 
            o.object.userData.config?.blockType === 'polygon' ||
            o.object.userData.config?.blockType === 'rectangle'
        );

        if (shapeIntersect) {
            console.log('Shape clicked, deriving wall...');
            const originalSelection = Engine.getSelection();
            Engine.selectObject(shapeIntersect.object.userData);
            deriveFromSelected();
            return;
        }

        let point;
        if (wallState.snapPoint) {
            point = wallState.snapPoint.clone();
        } else if (intersects.plane.length > 0) {
            point = intersects.plane[0].point;
            const currentFloor = FloorManager.getCurrentFloorData();
            point.y = currentFloor ? currentFloor.ffl : 0;
        }

        if (point) {
            if (wallState.isClosing && state.points.length >= 2) {
                state.points.push(state.points[0].clone());
                finish();
                return;
            }

            state.points.push(point.clone());
            wallState.inputBuffer = '';
            createPointMarker(point);
        }
    }

    function onMove(event) {
        if (!state.active || state.points.length === 0) return;

        const intersects = Engine.getMouseIntersects(event);
        if (intersects.plane.length > 0) {
            let point = intersects.plane[0].point;
            const currentFloor = FloorManager.getCurrentFloorData();
            point.y = currentFloor ? currentFloor.ffl : 0;
            state.lastMousePoint = point.clone();

            // Snapping
            const snap = Engine.getNearbyVertex(point, 0.4);
            wallState.snapPoint = snap;
            wallState.isClosing = false;

            if (snap) {
                point = snap;
                if (state.points.length >= 2 && snap.distanceTo(state.points[0]) < 0.1) {
                    wallState.isClosing = true;
                    if (window.App) window.App.showInputOverlay('Click to Close Wall Loop');
                }
            } else if (window.App) {
                window.App.showInputOverlay(wallState.inputBuffer ? `Distance: ${wallState.inputBuffer}m` : 'Click points or type distance. Right-click to finish.');
            }

            updatePreview(point);
        }
    }

    function onKeyDown(event) {
        if (!state.active) return;

        if (/[0-9.]/.test(event.key)) {
            wallState.inputBuffer += event.key;
            if (window.App) window.App.showInputOverlay(`Distance: ${wallState.inputBuffer}m`);
            return;
        }

        if (event.key === 'Backspace') {
            wallState.inputBuffer = wallState.inputBuffer.slice(0, -1);
            if (window.App) window.App.showInputOverlay(`Distance: ${wallState.inputBuffer}m`);
            return;
        }

        if (event.key === 'Enter' && wallState.inputBuffer && state.points.length > 0) {
            const distance = parseFloat(wallState.inputBuffer);
            if (!isNaN(distance)) {
                const mousePos = state.lastMousePoint;
                if (mousePos) {
                    const lastPoint = state.points[state.points.length - 1];
                    const dir = new THREE.Vector3().subVectors(mousePos, lastPoint).normalize();
                    const nextPoint = lastPoint.clone().add(dir.multiplyScalar(distance));
                    state.points.push(nextPoint);
                    wallState.inputBuffer = '';
                    createPointMarker(nextPoint);
                }
            }
        }

        if (event.key === 'Escape') {
            exit();
        }
    }

    function updatePreview(mousePoint) {
        if (state.previewLine) Engine.getScene().remove(state.previewLine);

        const previewPoints = [...state.points, mousePoint];
        if (previewPoints.length > 1) {
            const geometry = new THREE.BufferGeometry().setFromPoints(previewPoints);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
            state.previewLine = new THREE.Line(geometry, material);
            Engine.getScene().add(state.previewLine);
        }
    }

    function onRightClick(event) {
        event.preventDefault();
        if (state.points.length >= 2) {
            finish();
        } else {
            exit();
        }
    }

    function finish() {
        if (state.points.length < 2) {
            exit();
            return;
        }

        const currentFloor = FloorManager.getCurrentFloorData();
        const floors = FloorManager.getFloors();
        const currentIndex = floors.findIndex(f => f.id === currentFloor?.id);
        const nextFloor = (currentIndex !== -1 && currentIndex < floors.length - 1) ? floors[currentIndex + 1] : null;
        
        const baseLevel = currentFloor ? currentFloor.ffl : 0;
        const topLevel = nextFloor ? nextFloor.ffl : baseLevel + 3.0;
        const wallHeight = topLevel - baseLevel;

        // Wall position is at the center of the drawn points
        let centerX = 0, centerZ = 0;
        state.points.forEach(p => {
            centerX += p.x;
            centerZ += p.z;
        });
        centerX /= state.points.length;
        centerZ /= state.points.length;

        // Convert drawn world space points to local coordinates relative to mesh position
        const localPoints = state.points.map(p => ({
            x: p.x - centerX,
            y: baseLevel,
            z: p.z - centerZ
        }));

        const config = {
            floor: currentFloor ? currentFloor.name : 'Ground Floor',
            mat: 'concrete',
            type: 'block',
            blockType: BLOCK_TYPES.POLYLINE_WALL,
            pos: { x: centerX, y: baseLevel, z: centerZ },
            rot: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            params: {
                points: localPoints,
                topPoints: localPoints.map(p => ({ x: p.x, y: topLevel, z: p.z })),
                t: getThickness(),
                h: wallHeight,
                base: baseLevel,
                top: topLevel,
                align: getAlignment()
            }
        };
        const geometry = BlockFactory.create(BLOCK_TYPES.POLYLINE_WALL, config.params);
        if (geometry) {
            HistoryManager.save(Engine.getObjects());
            const obj = Engine.addObject(config, geometry);
            obj.mesh.position.set(centerX, baseLevel, centerZ);
            // Note: centerOffset is already handled by shape's centered position
            Engine.syncConfigFromTransform(obj);
        }

        exit();
    }

    function getThickness() {
        const input = document.getElementById('wall-thickness-input');
        return input ? parseFloat(input.value) : state.thickness;
    }

    function getAlignment() {
        const select = document.getElementById('wall-offset-mode');
        return select ? select.value : 'mid';
    }

    function deriveFromSelected() {
        const selection = Engine.getSelection();
        if (!selection) {
            alert('Select a polyline or shape to derive wall from.');
            return;
        }

        let points = extractPointsFromSelection(selection);
        if (points.length < 2) {
            alert('Could not extract a valid path from selected object.');
            return;
        }

        const currentFloor = FloorManager.getFloorByName(selection.config.floor) || FloorManager.getCurrentFloorData();
        const floors = FloorManager.getFloors();
        const currentIndex = floors.findIndex(f => f.id === currentFloor?.id);
        const nextFloor = (currentIndex !== -1 && currentIndex < floors.length - 1) ? floors[currentIndex + 1] : null;
        
        const baseLevel = currentFloor ? currentFloor.ffl : 0;
        const topLevel = nextFloor ? nextFloor.ffl : baseLevel + 3.0;
        const wallHeight = topLevel - baseLevel;

        // Wall position is at the center of the derived points
        let centerX = 0, centerZ = 0;
        points.forEach(p => {
            centerX += p.x;
            centerZ += p.z;
        });
        centerX /= points.length;
        centerZ /= points.length;

        // Convert world space points to local coordinates relative to mesh position
        const localPoints = points.map(p => ({
            x: p.x - centerX,
            y: baseLevel,
            z: p.z - centerZ
        }));

        const config = {
            floor: currentFloor ? currentFloor.name : 'Ground Floor',
            mat: selection.config.mat || 'concrete',
            type: 'block',
            blockType: BLOCK_TYPES.POLYLINE_WALL,
            pos: { x: centerX, y: baseLevel, z: centerZ },
            rot: { x: selection.mesh.rotation.x, y: selection.mesh.rotation.y, z: selection.mesh.rotation.z },
            scale: { x: 1, y: 1, z: 1 },
            params: {
                points: localPoints,
                topPoints: localPoints.map(p => ({ x: p.x, y: topLevel, z: p.z })),
                t: getThickness(),
                h: wallHeight,
                base: baseLevel,
                top: topLevel,
                align: getAlignment()
            }
        };
        const geometry = BlockFactory.create(BLOCK_TYPES.POLYLINE_WALL, config.params);
        if (geometry) {
            HistoryManager.save(Engine.getObjects());
            const obj = Engine.addObject(config, geometry);
            obj.mesh.position.set(centerX, baseLevel, centerZ);
            // Shape position already centered - no offset needed
            Engine.syncConfigFromTransform(obj);
            
            Engine.removeObject(selection);
            if (window.StepsDisplay) {
                window.StepsDisplay.recordAction(`Derived ${BLOCK_TYPES.POLYLINE_WALL} from ${selection.config.blockType}`);
            }
        }
    }

    function deriveWithTopJoin() {
        const selection = Engine.getSelection();
        if (!selection) {
            alert('Select a polyline or shape to join to top floor.');
            return;
        }

        const bottomPoints = extractPointsFromSelection(selection);
        if (bottomPoints.length < 2) {
            alert('Could not extract a valid path from selected object.');
            return;
        }

        const currentFloor = FloorManager.getFloorByName(selection.config.floor) || FloorManager.getCurrentFloorData();
        const floors = FloorManager.getFloors();
        const currentIndex = floors.findIndex(f => f.id === currentFloor?.id);
        const nextFloor = (currentIndex !== -1 && currentIndex < floors.length - 1) ? floors[currentIndex + 1] : null;
        
        if (!nextFloor) {
            alert('No floor found above the selected object.');
            return;
        }

        const baseLevel = currentFloor ? currentFloor.ffl : 0;
        const topLevel = nextFloor.ffl;

        // Try to find a matching shape on the top floor
        let topPoints = null;
        const topFloorObjects = Engine.getObjects().filter(o => o.config.floor === nextFloor.name);
        // Basic match based on footprint? For now, we'll just use the same points at topLevel
        topPoints = bottomPoints.map(p => new THREE.Vector3(p.x, topLevel, p.z));

        // Wall position is at the center of the bottom points
        let centerX = 0, centerZ = 0;
        bottomPoints.forEach(p => {
            centerX += p.x;
            centerZ += p.z;
        });
        centerX /= bottomPoints.length;
        centerZ /= bottomPoints.length;

        // Convert world space points to local coordinates relative to mesh position
        const localBottomPoints = bottomPoints.map(p => ({
            x: p.x - centerX,
            y: baseLevel,
            z: p.z - centerZ
        }));

        const localTopPoints = topPoints.map(p => ({
            x: p.x - centerX,
            y: topLevel,
            z: p.z - centerZ
        }));

        const config = {
            floor: currentFloor ? currentFloor.name : 'Ground Floor',
            mat: selection.config.mat || 'concrete',
            type: 'block',
            blockType: BLOCK_TYPES.POLYLINE_WALL,
            pos: { x: centerX, y: baseLevel, z: centerZ },
            rot: { x: selection.mesh.rotation.x, y: selection.mesh.rotation.y, z: selection.mesh.rotation.z },
            scale: { x: 1, y: 1, z: 1 },
            params: {
                points: localBottomPoints,
                topPoints: localTopPoints,
                t: getThickness(),
                base: baseLevel,
                top: topLevel,
                align: getAlignment()
            }
        };

        const geometry = BlockFactory.create(BLOCK_TYPES.POLYLINE_WALL, config.params);
        if (geometry) {
            HistoryManager.save(Engine.getObjects());
            const obj = Engine.addObject(config, geometry);
            obj.mesh.position.set(centerX, baseLevel, centerZ);
            // Shape position already centered - no offset needed
            Engine.syncConfigFromTransform(obj);
            
            Engine.removeObject(selection);
            if (window.StepsDisplay) {
                window.StepsDisplay.recordAction(`Created lofted Wall joining ${currentFloor.name} and ${nextFloor.name}`);
            }
        }
    }

    function extractPointsFromSelection(selection) {
        let points = [];
        const params = selection.config.params || {};
        const floor = FloorManager.getFloorByName(selection.config.floor) || FloorManager.getCurrentFloorData();
        const ffl = floor ? floor.ffl : 0;

        if (params.type === 'rectangle' && params.points && params.points.length >= 2) {
            const p1 = params.points[0];
            const p2 = params.points[1];
            points = [
                new THREE.Vector3(p1.x, ffl, p1.z),
                new THREE.Vector3(p2.x, ffl, p1.z),
                new THREE.Vector3(p2.x, ffl, p2.z),
                new THREE.Vector3(p1.x, ffl, p2.z),
                new THREE.Vector3(p1.x, ffl, p1.z) // Close it
            ];
        } else if (params.type === 'circle' && params.points && params.points.length >= 2) {
            const center = new THREE.Vector3(params.points[0].x, ffl, params.points[0].z);
            const radius = params.radius || center.distanceTo(new THREE.Vector3(params.points[1].x, ffl, params.points[1].z));
            points = createCirclePoints(center, radius);
        } else if (params.type === 'polygon' && params.points && params.points.length >= 2) {
            const center = new THREE.Vector3(params.points[0].x, ffl, params.points[0].z);
            const radius = params.radius || center.distanceTo(new THREE.Vector3(params.points[1].x, ffl, params.points[1].z));
            points = createPolygonPoints(center, radius, params.segments || 6);
        } else if (params.type === 'arc' && params.points && params.points.length >= 3) {
            const p1 = new THREE.Vector3(params.points[0].x, ffl, params.points[0].z);
            const p2 = new THREE.Vector3(params.points[1].x, ffl, params.points[1].z);
            const p3 = new THREE.Vector3(params.points[2].x, ffl, params.points[2].z);
            points = createArcPoints(p1, p2, p3);
        } else if (params.points && params.points.length >= 2) {
            points = params.points.map(p => {
                if (p.y !== undefined) return new THREE.Vector3(p.x, p.y, p.z);
                return new THREE.Vector3(p.x, ffl, p.z || 0);
            });
        } else if (selection.mesh.geometry.attributes.position) {
            const pos = selection.mesh.geometry.attributes.position;
            const tempPoints = [];
            for (let i = 0; i < pos.count; i++) {
                tempPoints.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(selection.mesh.matrixWorld));
            }
            const unique = [];
            tempPoints.forEach(p => {
                if (!unique.some(u => u.distanceTo(p) < 0.01)) unique.push(p);
            });
            points = unique;
        }

        return points;
    }

    function createCirclePoints(center, radius, segments = 32) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            pts.push(new THREE.Vector3(
                center.x + radius * Math.cos(theta),
                center.y,
                center.z + radius * Math.sin(theta)
            ));
        }
        return pts;
    }

    function createPolygonPoints(center, radius, segments) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            pts.push(new THREE.Vector3(
                center.x + radius * Math.cos(theta),
                center.y,
                center.z + radius * Math.sin(theta)
            ));
        }
        return pts;
    }

    function createArcPoints(p1, p2, p3, segments = 20) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * p2.x + t * t * p3.x;
            const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * p2.y + t * t * p3.y;
            const z = (1 - t) * (1 - t) * p1.z + 2 * (1 - t) * t * p2.z + t * t * p3.z;
            pts.push(new THREE.Vector3(x, y, z));
        }
        return pts;
    }

    function createPointMarker(point) {
        const geo = new THREE.SphereGeometry(0.1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(point);
        mesh.userData.isWallMarker = true;
        Engine.getScene().add(mesh);
    }

    function clearMarkers() {
        const scene = Engine.getScene();
        const toRemove = [];
        scene.traverse(child => {
            if (child.userData.isWallMarker) toRemove.push(child);
        });
        toRemove.forEach(c => scene.remove(c));
    }

    function exit() {
        state.active = false;
        state.points = [];
        if (state.previewLine) Engine.getScene().remove(state.previewLine);
        state.previewLine = null;
        clearMarkers();

        Engine.removeEventListener(EVENTS.VIEWPORT_CLICK, onPointAdd);
        Engine.getRenderer().domElement.removeEventListener('mousemove', onMove);
        Engine.getRenderer().domElement.removeEventListener('contextmenu', onRightClick);
        window.removeEventListener('keydown', onKeyDown);
    }

    return { init, start, finish, deriveFromSelected, deriveWithTopJoin, exit };
})();
