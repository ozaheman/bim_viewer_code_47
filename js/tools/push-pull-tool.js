import { Engine } from '../core/engine.js';
import { BLOCK_TYPES } from '../core/constants.js';

export const PushPullTool = (() => {
    let state = {
        active: false,
        hoveredObject: null,
        hoveredFace: null, // Normal vector
        hoveredFaceIndex: -1,
        isDragging: false,
        dragStartPoint: null,
        originalParams: null,
        originalPosition: null,
        highlightMesh: null,
        axis: null // 'x', 'y', or 'z'
    };

    function init() {
        console.log('PushPullTool initialized');
    }

    function start() {
        state.active = true;
        createHighlightMesh();

        const container = document.getElementById('viewer-container');
        if (container) {
            container.addEventListener('mousemove', onMouseMove);
            container.addEventListener('mousedown', onMouseDown, true);
            window.addEventListener('mouseup', onMouseUp);
        }

        if (window.App && window.App.showInputOverlay) {
            window.App.showInputOverlay('Hover over a face to Push/Pull');
        }
    }

    function stop() {
        state.active = false;
        state.isDragging = false;
        state.hoveredObject = null;

        if (state.highlightMesh) {
            const scene = Engine.getScene();
            if (scene) scene.remove(state.highlightMesh);
            state.highlightMesh = null;
        }

        const container = document.getElementById('viewer-container');
        if (container) {
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mousedown', onMouseDown, true);
            window.removeEventListener('mouseup', onMouseUp);
        }

        if (window.App && window.App.hideInputOverlay) {
            window.App.hideInputOverlay();
        }
    }

    function createHighlightMesh() {
        // Create a square outline (1x1)
        const points = [];
        points.push(new THREE.Vector3(-0.5, 0.5, 0));
        points.push(new THREE.Vector3(0.5, 0.5, 0));
        points.push(new THREE.Vector3(0.5, -0.5, 0));
        points.push(new THREE.Vector3(-0.5, -0.5, 0));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 3,
            depthTest: false,
            transparent: true,
            opacity: 1.0 // Fully opaque red
        });

        state.highlightMesh = new THREE.LineLoop(geometry, material);
        state.highlightMesh.visible = false;
        state.highlightMesh.renderOrder = 999;
        Engine.getScene().add(state.highlightMesh);
    }

    function onMouseMove(event) {
        if (!state.active) return;

        // If dragging, process drag and skip highlighting
        if (state.isDragging) {
            handleDrag(event);
            return;
        }

        const intersects = Engine.getMouseIntersects(event);

        // Find the first valid mesh that isn't the highlight mesh or a helper
        const hit = intersects.meshes.find(i =>
            i.object !== state.highlightMesh &&
            i.object.userData.type === 'bim-object'
        );

        if (hit) {
            updateHighlight(hit);
        } else {
            if (state.highlightMesh) state.highlightMesh.visible = false;
            state.hoveredObject = null;
        }
    }

    // Update Highlight Logic
    function updateHighlight(hit) {
        const obj = hit.object;
        const face = hit.face;

        // console.log("Hovering:", obj.userData.id, "Normal:", face.normal);

        state.hoveredObject = obj;
        state.hoveredFace = face.normal;

        state.highlightMesh.visible = true;

        // Determine parameters
        const geometry = obj.geometry;
        // Default to scale 1 if params missing?
        // Note: For custom geometry, parameters might be undefined. Handle gracefully.
        const p = geometry.parameters || { width: 1, height: 1, depth: 1 };
        const scale = obj.scale;

        state.highlightMesh.rotation.set(0, 0, 0);

        let w = 1, h = 1;
        const n = face.normal;

        if (Math.abs(n.x) > 0.9) {
            state.axis = 'x';
            w = (p.depth || 1) * scale.z; // Use 1 as fallback
            h = (p.height || 1) * scale.y;
            state.highlightMesh.rotation.y = Math.PI / 2;
        } else if (Math.abs(n.y) > 0.9) {
            state.axis = 'y';
            w = (p.width || 1) * scale.x;
            h = (p.depth || 1) * scale.z;
            state.highlightMesh.rotation.x = -Math.PI / 2;
        } else {
            state.axis = 'z';
            w = (p.width || 1) * scale.x;
            h = (p.height || 1) * scale.y;
        }

        // Update highlight geometry scale
        state.highlightMesh.scale.set(w, h, 1);

        // Position slightly off the face to avoid z-fighting
        const faceNormalWorld = n.clone().transformDirection(obj.matrixWorld).normalize();

        // Center of the face?
        // hit.point is where we clicked, not necessarily center.
        // For BoxGeometry, center of face is object center + (normal * half_dimension)

        const objPos = obj.position.clone();
        let offset = 0;

        if (state.axis === 'x') offset = (p.width * scale.x) / 2;
        if (state.axis === 'y') offset = (p.height * scale.y) / 2;
        if (state.axis === 'z') offset = (p.depth * scale.z) / 2; // Fixed: depth is usually z

        // Check sign of normal
        // The normal from 'intersect' is in local space if we used obj.raycast? 
        // Actually intersects returned by Engine (Raycaster) have face.normal in OBJECT space usually for buffergeometry?
        // Wait, standard Three.js raycast returns face.normal in WORLD space? NO, it's rotated?
        // Check documentation: Raycaster intersect.face.normal is in World Space if transformed? 
        // No, usually it's derived from geometry, so it might need transformation.
        // Let's rely on hit.face.normal being sufficient for axis detection.

        const offsetVec = faceNormalWorld.clone().multiplyScalar(offset + 0.005);
        state.highlightMesh.position.copy(objPos).add(offsetVec);

        // Align rotation to object + face
        const q = new THREE.Quaternion().setFromEuler(obj.rotation);
        state.highlightMesh.quaternion.copy(q);

        // Rotate highlight specific to face
        if (state.axis === 'x') state.highlightMesh.rotateY(Math.PI / 2);
        if (state.axis === 'y') state.highlightMesh.rotateX(-Math.PI / 2);
        // z requires no extra rotation if plane is XY default
    }

    function onMouseDown(event) {
        // console.log("PushPull: MouseDown", state.active, state.hoveredObject);
        if (state.hoveredObject && state.active) {
            state.isDragging = true;
            event.stopImmediatePropagation();

            // Calculate intersection on the drag plane
            const intersects = Engine.getMouseIntersects(event);
            // We use a plane perpendicular to camera or the specific axis for dragging
            if (intersects.plane.length > 0) {
                state.dragStartPoint = intersects.plane[0].point;
            } else if (intersects.meshes.length > 0) {
                state.dragStartPoint = intersects.meshes[0].point;
            } else {
                // Fallback if Engine helper misses
                const raycaster = Engine.getRaycaster();
                const hits = raycaster.intersectObject(state.hoveredObject, false);
                if (hits.length > 0) state.dragStartPoint = hits[0].point;
            }

            // Store original state
            const config = state.hoveredObject.userData.config;
            state.originalParams = { ...config.params }; // Shallow copy params
            // If params don't exist (like generic cube), use default dimensions
            if (!state.originalParams.w) state.originalParams.w = 1;
            if (!state.originalParams.h) state.originalParams.h = 1;
            if (!state.originalParams.l) state.originalParams.l = 1; // Length/Depth

            state.originalScale = state.hoveredObject.scale.clone();
            state.originalPosition = state.hoveredObject.position.clone();

            // console.log("PushPull: Drag Start Point", state.dragStartPoint);

            // Disable controls
            Engine.getControls().enabled = false;
        }
    }

    function onMouseUp(event) {
        if (state.isDragging) {
            state.isDragging = false;
            Engine.getControls().enabled = true;

            // console.log("PushPull: Drag End");

            // Finalize change in history
            if (window.HistoryManager) {
                window.HistoryManager.save(Engine.getObjects());
            }
            if (window.App) {
                window.App.generateScript();
            }
        }
    }

    function handleDrag(event) {
        if (!state.dragStartPoint || !state.hoveredObject) return;

        const raycaster = Engine.getRaycaster();
        const camera = Engine.getCamera();
        const rect = Engine.getRenderer().domElement.getBoundingClientRect();

        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(mouse, camera);

        // 1. Create a plane at dragStartPoint, facing the camera (for robust intersection)
        const viewDir = new THREE.Vector3();
        camera.getWorldDirection(viewDir);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewDir, state.dragStartPoint);

        const targetPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, targetPoint);

        if (!targetPoint) return;

        // 2. Calculate the 3D offset vector
        const offsetVec = new THREE.Vector3().subVectors(targetPoint, state.dragStartPoint);

        // 3. Project this offset vector onto the Face Normal (World Space)
        // Get Normal in World Space
        const obj = state.hoveredObject;
        const localNormal = state.hoveredFace.clone();

        // Important: BoxGeometry normals are Axis Aligned. 
        // When object rotates, world normal rotates.
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
        const worldNormal = localNormal.clone().applyNormalMatrix(normalMatrix).normalize();

        // Dot product gives the magnitude of movement ALONG the normal
        const distance = offsetVec.dot(worldNormal);

        // Debug
        // console.log("Dist:", distance);

        applyPushPull(distance, worldNormal, localNormal);
    }

    function applyPushPull(distance, worldNormal, localNormal) {
        const obj = state.hoveredObject;
        const config = obj.userData.config;

        // Determine resizing based on local axis
        // Note: This logic assumes the geometry is centered (standard Three.js BoxGeometry)
        // New Dimension = Old Dimension + Distance
        // Position Shift = Distance / 2 (in direction of normal)

        let width = state.originalParams.w || 1;
        let height = state.originalParams.h || 1;
        let depth = state.originalParams.l || state.originalParams.t || state.originalParams.d || 1; // Handle wall thickness(t) vs beam length(l) vs depth(d)

        const scale = state.originalScale;



        // Apply scaling instead of regenerating geometry for performance
        // For standard Box, localNormal is (1,0,0), (0,1,0), etc.
        const nx = Math.abs(localNormal.x);
        const ny = Math.abs(localNormal.y);
        const nz = Math.abs(localNormal.z);

        const newPos = state.originalPosition.clone();

        // Shift position: center moves by half the distance in the direction of the normal
        const shift = worldNormal.clone().multiplyScalar(distance / 2);
        newPos.add(shift);

        if (nx > 0.9) {
            // X Axis
            const realDim = width * scale.x;
            const newRealDim = Math.max(0.1, realDim + distance);

            // Check if parametric rebuild should be used
            if (config.blockType.includes('railing') || config.blockType.includes('window') || config.blockType.includes('column')) {
                config.params.w = newRealDim;
                config.params.l = newRealDim; // Railings/Beams use 'l'
                if (window.App) window.App.rebuildObject(obj);
            } else {
                const newScaleX = newRealDim / width;
                obj.scale.set(newScaleX, scale.y, scale.z);
                config.params.w = newRealDim;
                config.params.l = newRealDim;
            }
        } else if (ny > 0.9) {
            // Y Axis (Height)
            const realDim = height * scale.y;
            const newRealDim = Math.max(0.1, realDim + distance);

            if (config.blockType.includes('railing') || config.blockType.includes('window') || config.blockType.includes('column')) {
                config.params.h = newRealDim;
                if (window.App) window.App.rebuildObject(obj);
            } else {
                const newScaleY = newRealDim / height;
                obj.scale.set(scale.x, newScaleY, scale.z);
                config.params.h = newRealDim;
            }
        } else {
            // Z Axis (Depth/Length)
            const realDim = depth * scale.z;
            const newRealDim = Math.max(0.1, realDim + distance);

            if (config.blockType.includes('railing') || config.blockType.includes('window') || config.blockType.includes('column')) {
                config.params.l = newRealDim; // Length or Thickness
                config.params.d = newRealDim; // Depth
                config.params.w = newRealDim; // Support blocks using W for depth
                if (window.App) window.App.rebuildObject(obj);
            } else {
                const newScaleZ = newRealDim / depth;
                obj.scale.set(scale.x, scale.y, newScaleZ);
                config.params.l = newRealDim;
                config.params.d = newRealDim;
                config.params.w = newRealDim;
            }
        }

        obj.position.copy(newPos);

        config.pos = { x: newPos.x, y: newPos.y, z: newPos.z };
        config.scale = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
    }

    return {
        init,
        start,
        stop
    };
})();