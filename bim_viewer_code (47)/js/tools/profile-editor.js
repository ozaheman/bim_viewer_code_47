import { Engine } from '../core/engine.js';
import { GeometryFactory } from '../factories/geometry-factory.js';
import { FloorManager } from '../managers/floor-manager.js';

export const ProfileEditor = (() => {
    let state = {
        active: false,
        profileType: null, // 'floor', 'ceiling', 'sweep'
        points: [],
        previewLine: null,
        thickness: 0.2,
        targetObject: null // Object being edited (for sweep profile)
    };

    function init(engine) {
        console.log('ProfileEditorTool initialized');
        window.ProfileEditor = this;
    }

    function startProfile(type, targetObj = null) {
        state.active = true;
        state.profileType = type;
        state.targetObject = targetObj;
        state.points = [];
        
        if (type === 'sweep' && targetObj) {
            // If editing existing sweep, maybe load points?
            // Actually user wants to "draw" a new profile.
        }

        document.getElementById('profile-toolbar').style.display = 'block';
        document.getElementById('profile-status').style.display = 'block';
        document.getElementById('profile-status').innerText = type === 'sweep' ? 'Click to draw 2D sweep profile. Right-click to apply.' : 'Click on grid to add profile points';

        Engine.addEventListener('viewport-click', onPointAdd);
        Engine.getRenderer().domElement.addEventListener('contextmenu', finishProfile, { once: true });
    }

    function startSweepProfileEdit(obj) {
        if (!obj) {
            const sel = Engine.getSelection();
            if (sel) obj = sel;
        }
        if (!obj) {
            alert('Select a wall to edit its profile.');
            return;
        }
        startProfile('sweep', obj);
    }

    function onPointAdd({ event }) {
        if (!state.active) return;
        const intersects = Engine.getMouseIntersects(event);
        if (intersects.plane.length > 0) {
            const point = intersects.plane[0].point;
            
            if (state.profileType === 'sweep') {
                // For sweep profile, we just need relative 2D points (x, y as cross-section)
                // We'll use the first point as 0,0 or just use raw coords then center?
                // Let's use raw coords and shift them later.
                state.points.push(new THREE.Vector2(point.x, point.y));
            } else {
                const currentFloor = FloorManager.getCurrentFloorData();
                point.y = currentFloor ? currentFloor.ffl : 0;
                state.points.push(new THREE.Vector2(point.x, point.z));
            }
            updatePreview(point.y);
        }
    }
    
    function updatePreview(yLevel) {
        if (state.previewLine) Engine.getScene().remove(state.previewLine);
        if (state.points.length < 2) return;

        let linePoints;
        if (state.profileType === 'sweep') {
            linePoints = state.points.map(p => new THREE.Vector3(p.x, p.y, 0));
        } else {
            linePoints = state.points.map(p => new THREE.Vector3(p.x, yLevel, p.y));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        state.previewLine = new THREE.Line(geometry, material);
        
        if (state.profileType === 'sweep') {
            // Just show it somewhere visible or HUD?
            // For now, world space is fine.
        }
        Engine.getScene().add(state.previewLine);
    }

    function finishProfile(event) {
        if (event) event.preventDefault();
        if (!state.active || state.points.length < 3) {
             cancelProfile();
             return;
        }

        if (state.profileType === 'sweep' && state.targetObject) {
            applySweepProfile();
        } else {
            const currentFloor = FloorManager.getCurrentFloorData();
            const geometry = GeometryFactory.createExtrudedProfile(state.points, state.thickness, currentFloor.ffl);
            if (geometry) {
                const config = {
                    floor: currentFloor.name, mat: 'concrete', type: 'block', blockType: 'profile',
                    pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
                    params: { points: state.points.map(p => ({x: p.x, y: p.y})) }
                };
                const obj = Engine.addObject(config, geometry);
                obj.mesh.position.set(0, 0, 0); 
                Engine.syncConfigFromTransform(obj);
            }
        }
        cancelProfile();
    }

    function applySweepProfile() {
        const obj = state.targetObject;
        if (!obj || !obj.config || !obj.config.params) return;

        // Center the profile points around 0,0 for cleaner extrusion
        const center = new THREE.Vector2(0, 0);
        state.points.forEach(p => center.add(p));
        center.divideScalar(state.points.length);
        
        const centeredPoints = state.points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));

        obj.config.params.profilePoints = centeredPoints;
        
        // Regerate geometry
        const newGeo = BlockFactory.create(obj.config.blockType, obj.config.params);
        if (newGeo) {
            obj.mesh.geometry.dispose();
            obj.mesh.geometry = newGeo;
            HistoryManager.save(Engine.getObjects());
        }
    }

    function undoProfilePoint() { state.points.pop(); updatePreview(FloorManager.getCurrentFloorData().ffl); }
    function cancelProfile() {
        state.active = false;
        state.points = [];
        state.targetObject = null;
        if (state.previewLine) Engine.getScene().remove(state.previewLine);
        state.previewLine = null;
        document.getElementById('profile-toolbar').style.display = 'none';
        document.getElementById('profile-status').style.display = 'none';
        Engine.removeEventListener('viewport-click', onPointAdd);
    }
    function updateThickness(value) { state.thickness = parseFloat(value); }
    function exit() { cancelProfile(); }

    return { init, startProfile, startSweepProfileEdit, finishProfile, undoProfilePoint, cancelProfile, updateThickness, exit };
})();