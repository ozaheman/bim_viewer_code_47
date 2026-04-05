import { Engine } from '../core/engine.js';
import { BlockFactory } from '../factories/block-factory.js';
import { BLOCK_TYPES, EVENTS } from '../core/constants.js';
import { HistoryManager } from '../managers/history-manager.js';

export const BisectorTool = (() => {
    let state = {
        active: false,
        points: [],
        previewLine: null,
        lastMousePoint: null,
        selectedWall: null  // The wall we're creating bisector on
    };

    function init(engine) {
        console.log('BisectorTool initialized');
        window.BisectorTool = this;
    }

    function start() {
        if (state.active) {
            exit();
            return;
        }

        state.active = true;
        state.points = [];
        state.selectedWall = null;
        state.previewLine = null;

        console.log('Starting Bisector Tool - Click 2 points on a wall to create bisector line');

        Engine.addEventListener(EVENTS.VIEWPORT_CLICK, onPointAdd);
        Engine.getRenderer().domElement.addEventListener('mousemove', onMove);
        Engine.getRenderer().domElement.addEventListener('contextmenu', onRightClick);
        window.addEventListener('keydown', onKeyDown);

        if (window.App && window.App.showInputOverlay) {
            window.App.showInputOverlay('Bisector Tool: Click 2 points on a wall. The bisector line will be created perpendicular to the wall.');
        }
    }

    function onPointAdd({ event, type: clickType }) {
        if (!state.active || clickType !== 'down') return;

        const intersects = Engine.getMouseIntersects(event);
        
        // Check if we clicked on a wall
        const wallIntersect = intersects.meshes.find(o => 
            o.object.userData.config?.blockType === BLOCK_TYPES.POLYLINE_WALL || 
            o.object.userData.config?.blockType === BLOCK_TYPES.SPLINE_WALL ||
            o.object.userData.config?.blockType === 'path-wall'
        );

        if (wallIntersect) {
            const wallObj = wallIntersect.object.userData;
            
            if (!state.selectedWall) {
                state.selectedWall = wallObj;
            } else if (state.selectedWall !== wallObj) {
                if (window.App) window.App.showInputOverlay('Points must be on the same wall. Resetting...');
                state.points = [];
                state.selectedWall = wallObj;
                return;
            }

            // Get the point on the wall
            let point = wallIntersect.point.clone();
            state.points.push(point);

            if (state.points.length === 2) {
                // Create bisector
                createBisector();
                return;
            }

            if (window.App) {
                window.App.showInputOverlay(`Point 1/2 added. Click second point on the wall.`);
            }
        } else {
            if (window.App) {
                window.App.showInputOverlay('Click on a wall surface.');
            }
        }
    }

    function onMove(event) {
        if (!state.active) return;

        const intersects = Engine.getMouseIntersects(event);
        
        // Update preview based on current mouse position
        if (intersects.plane.length > 0) {
            state.lastMousePoint = intersects.plane[0].point;
            
            if (state.points.length === 1) {
                updatePreview(state.lastMousePoint);
            }
        }
    }

    function updatePreview(mousePoint) {
        if (!state.previewLine) {
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });
            state.previewLine = new THREE.Line(geometry, material);
            Engine.getScene().add(state.previewLine);
        }

        const positions = [
            state.points[0].x, state.points[0].y, state.points[0].z,
            mousePoint.x, mousePoint.y, mousePoint.z
        ];

        state.previewLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        state.previewLine.geometry.attributes.position.needsUpdate = true;
    }

    function createBisector() {
        if (state.points.length !== 2 || !state.selectedWall) {
            return;
        }

        // Get the two points
        const p1 = state.points[0];
        const p2 = state.points[1];

        // Calculate midpoint
        const midpoint = new THREE.Vector3(
            (p1.x + p2.x) / 2,
            (p1.y + p2.y) / 2,
            (p1.z + p2.z) / 2
        );

        // Calculate direction perpendicular to the line between p1 and p2
        // In the XZ plane (horizontal)
        const wallDir = new THREE.Vector3(p2.x - p1.x, 0, p2.z - p1.z).normalize();
        const perpDir = new THREE.Vector3(-wallDir.z, 0, wallDir.x).normalize();

        // Get wall height
        const wallHeight = state.selectedWall.config.params.h || 3.0;
        const wallBase = state.selectedWall.config.params.base || 0;

        // Create bisector line from bottom to top of wall at midpoint
        const bisectorPoints = [
            { x: midpoint.x, y: wallBase, z: midpoint.z },
            { x: midpoint.x, y: wallBase + wallHeight, z: midpoint.z }
        ];

        // Create a line object (or reference line)
        const config = {
            blockType: 'bisector-line',
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            params: {
                points: bisectorPoints,
                wallRef: state.selectedWall.id,  // Reference the wall
                direction: { x: perpDir.x, y: 0, z: perpDir.z },
                midpoint: { x: midpoint.x, y: midpoint.y, z: midpoint.z },
                distance: p1.distanceTo(p2)
            }
        };

        // Create geometry for the bisector line
        const geometry = new THREE.BufferGeometry();
        const positions = [
            bisectorPoints[0].x, bisectorPoints[0].y, bisectorPoints[0].z,
            bisectorPoints[1].x, bisectorPoints[1].y, bisectorPoints[1].z
        ];
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

        const material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });
        const mesh = new THREE.Line(geometry, material);

        // Add object to engine
        const obj = Engine.addObject(config, geometry);
        if (obj && obj.mesh) {
            obj.mesh.material = material;
            obj.mesh.name = 'Bisector Line';
        }

        // Clear preview
        if (state.previewLine) {
            Engine.getScene().remove(state.previewLine);
            state.previewLine.geometry.dispose();
            state.previewLine.material.dispose();
            state.previewLine = null;
        }

        // Reset and show completion message
        state.points = [];
        state.selectedWall = null;

        if (window.HistoryManager) window.HistoryManager.save();

        if (window.App && window.App.showInputOverlay) {
            window.App.showInputOverlay(`Bisector line created! Distance between points: ${p1.distanceTo(p2).toFixed(2)}m`);
        }

        // Auto stop tool
        setTimeout(exit, 1000);
    }

    function onKeyDown(event) {
        if (!state.active) return;

        if (event.key === 'Escape') {
            exit();
        }

        // Backspace to remove last point
        if (event.key === 'Backspace' && state.points.length > 0) {
            state.points.pop();
            if (window.App) {
                window.App.showInputOverlay(state.points.length === 0 ? 
                    'Point cleared. Click first point on wall.' :
                    'Last point removed.'
                );
            }
        }
    }

    function onRightClick(event) {
        if (!state.active) return;
        event.preventDefault();
        exit();
    }

    function exit() {
        if (!state.active) return;
        state.active = false;

        // Clean up preview
        if (state.previewLine) {
            Engine.getScene().remove(state.previewLine);
            state.previewLine.geometry.dispose();
            state.previewLine.material.dispose();
            state.previewLine = null;
        }

        Engine.removeEventListener(EVENTS.VIEWPORT_CLICK, onPointAdd);
        Engine.getRenderer().domElement.removeEventListener('mousemove', onMove);
        Engine.getRenderer().domElement.removeEventListener('contextmenu', onRightClick);
        window.removeEventListener('keydown', onKeyDown);

        state.points = [];
        state.selectedWall = null;

        if (window.App && window.App.hideInputOverlay) {
            window.App.hideInputOverlay();
        }
    }

    return {
        init,
        start,
        stop: exit,
        exit,
        isActive: () => state.active
    };
})();
