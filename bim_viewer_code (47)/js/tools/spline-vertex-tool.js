import { Engine } from '../core/engine.js';
import { BLOCK_TYPES } from '../core/constants.js';

export const SplineVertexTool = (() => {
    let state = {
        active: false,
        selectedObject: null,
        handles: [],
        midHandles: [], // Handles between vertices for adding new points
        centerHandle: null, // Handle for moving the entire path center
        draggingHandle: null,
        dragPlane: new THREE.Plane(),
        dragOffset: new THREE.Vector3(),
        dragStartWorld: new THREE.Vector3(),
        hoveredHandle: null,
        points: [],
        centerPoint: new THREE.Vector3() // Center of all points
    };

    function init(engine) {
        console.log('SplineVertexTool initialized');
    }

    function start(obj) {
        if (!obj) obj = Engine.getSelection();
        if (!obj || (obj.config.blockType !== BLOCK_TYPES.SPLINE_WALL && 
                     obj.config.blockType !== BLOCK_TYPES.POLYLINE_WALL && 
                     obj.config.blockType !== BLOCK_TYPES.SWEEP_PATH &&
                     obj.config.blockType !== BLOCK_TYPES.SHAPE &&
                     obj.config.blockType !== 'path-wall' &&
                     obj.config.blockType !== 'line' &&
                     obj.config.blockType !== 'polyline' &&
                     obj.config.blockType !== 'rectangle' &&
                     obj.config.blockType !== 'polygon' &&
                     obj.config.blockType !== 'arc' &&
                     obj.config.blockType !== 'circle')) {
            console.warn('SplineVertexTool requires a path-based object');
            return;
        }

        state.active = true;
        state.selectedObject = obj;
        state.points = JSON.parse(JSON.stringify(obj.config.params.points));

        // Disable viewport controls for the full editing session
        // so drag interactions go to vertices, not the camera.
        const controls = Engine.getControls();
        if (controls) controls.enabled = false;

        refreshHandles();

        const container = document.getElementById('viewer-container');
        if (container) {
            container.addEventListener('pointermove', onPointerMove);
            container.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('keydown', onKeyDown);
        }

        if (window.App && window.App.showInputOverlay) {
            window.App.showInputOverlay('Editing Path: Drag green center to move all points. Drag yellow handles to move vertices. Click green mid-handles to add. Right-click to delete. A-key to align with wall. Hover for preview.');
        }
    }

    function stop() {
        if (!state.active) return;
        state.active = false;

        // Re-enable viewport controls
        const controls = Engine.getControls();
        if (controls) controls.enabled = true;

        clearHandles();

        const container = document.getElementById('viewer-container');
        if (container) {
            container.removeEventListener('pointermove', onPointerMove);
            container.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('keydown', onKeyDown);
        }

        state.selectedObject = null;
        if (window.App && window.App.hideInputOverlay) {
            window.App.hideInputOverlay();
        }
    }

    function refreshHandles() {
        clearHandles();
        const scene = Engine.getScene();
        const objMatrix = state.selectedObject.mesh.matrixWorld;

        // Calculate center point in local coordinates
        let centerLocal = new THREE.Vector3(0, 0, 0);
        state.points.forEach(p => {
            centerLocal.x += p.x;
            centerLocal.y += (p.y || 0);
            centerLocal.z += p.z;
        });
        centerLocal.divideScalar(state.points.length);
        state.centerPoint.copy(centerLocal).applyMatrix4(objMatrix);

        // Create center handle for moving entire path
        const centerHandle = createCenterHandle(state.centerPoint);
        state.centerHandle = centerHandle;
        scene.add(centerHandle);

        state.points.forEach((p, i) => {
            const worldPos = new THREE.Vector3(p.x, p.y || 0, p.z).applyMatrix4(objMatrix);
            const handle = createHandle(worldPos, i, false);
            state.handles.push(handle);
            scene.add(handle);

            // Create mid-handle for adding points between vertices
            if (i < state.points.length - 1) {
                const pNext = state.points[i + 1];
                const midPos = new THREE.Vector3(
                    (p.x + pNext.x) / 2,
                    ((p.y || 0) + (pNext.y || 0)) / 2,
                    (p.z + pNext.z) / 2
                ).applyMatrix4(objMatrix);
                
                const midHandle = createHandle(midPos, i, true);
                state.midHandles.push(midHandle);
                scene.add(midHandle);
            }
        });
    }

    function createHandle(worldPos, index, isMid) {
        const geometry = isMid ? new THREE.BoxGeometry(0.15, 0.15, 0.15) : new THREE.SphereGeometry(0.15, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color: isMid ? 0x00ff00 : 0xffff00, 
            depthTest: false,
            transparent: true,
            opacity: 0.85
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(worldPos);
        mesh.userData = { 
            isSplineHandle: true, 
            index: index, 
            isMid: isMid,
            baseColor: isMid ? 0x00ff00 : 0xffff00,
            baseOpacity: 0.85,
            baseScale: 1.0
        };
        mesh.renderOrder = 1000;
        // Make sure geometry updates can be seen
        mesh.scale.set(1, 1, 1);
        return mesh;
    }

    function createCenterHandle(worldPos) {
        const geometry = new THREE.SphereGeometry(0.18, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, // Green for center
            depthTest: false,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(worldPos);
        mesh.userData = { 
            isSplineHandle: true, 
            isCenter: true,
            baseColor: 0x00ff00,
            baseOpacity: 0.9,
            baseScale: 1.0
        };
        mesh.renderOrder = 1001; // Render above vertices
        return mesh;
    }

    function clearHandles() {
        const scene = Engine.getScene();
        [...state.handles, ...state.midHandles].forEach(h => {
            scene.remove(h);
            h.geometry.dispose();
            h.material.dispose();
        });
        if (state.centerHandle) {
            scene.remove(state.centerHandle);
            state.centerHandle.geometry.dispose();
            state.centerHandle.material.dispose();
            state.centerHandle = null;
        }
        state.handles = [];
        state.midHandles = [];
    }

    function onPointerMove(event) {
        if (!state.active) return;

        if (state.draggingHandle) {
            handleDrag(event);
            return;
        }

        const intersects = Engine.getMouseIntersects(event);
        const handleIntersect = intersects.meshes.find(i => i.object.userData?.isSplineHandle);
        
        if (handleIntersect) {
            updateHandleHover(handleIntersect.object);
        } else {
            updateHandleHover(null);
        }
    }

    function updateHandleHover(handle) {
        // Reset previously hovered handle
        if (state.hoveredHandle && state.hoveredHandle !== handle) {
            const prevHandle = state.hoveredHandle;
            const baseColor = prevHandle.userData.baseColor;
            prevHandle.material.color.set(baseColor);
            prevHandle.material.opacity = prevHandle.userData.baseOpacity;
            prevHandle.material.needsUpdate = true;
            prevHandle.scale.set(1, 1, 1);
        }
        
        state.hoveredHandle = handle;
        
        // Apply hover effect to new handle
        if (handle) {
            handle.material.opacity = 1.0;
            handle.material.emissive.set(0x444444); // Add glow effect
            handle.material.needsUpdate = true;
            handle.scale.set(1.3, 1.3, 1.3);
        }
    }

    function updateHandleSelection(handle) {
        // Visual feedback when handle is actively being dragged/selected
        if (handle) {
            handle.material.color.set(0xff6600); // Orange when selected
            handle.material.opacity = 1.0;
            handle.scale.set(1.6, 1.6, 1.6);
            handle.material.needsUpdate = true;
        }
    }

    function resetHandleSelection(handle) {
        // Return handle to normal state
        if (handle) {
            const baseColor = handle.userData.baseColor;
            handle.material.color.set(baseColor);
            handle.material.opacity = handle.userData.baseOpacity;
            handle.material.emissive.set(0x000000);
            handle.scale.set(1, 1, 1);
            handle.material.needsUpdate = true;
        }
    }

    function onPointerDown(event) {
        if (!state.active) return;

        const intersects = Engine.getMouseIntersects(event);
        const handleIntersect = intersects.meshes.find(i => i.object.userData?.isSplineHandle);

        if (handleIntersect) {
            const handle = handleIntersect.object;
            
            // Show selection feedback
            updateHandleSelection(handle);
            
            // Handle center dragging
            if (handle.userData.isCenter) {
                state.draggingHandle = handle;
                state.draggingHandle.userData.isCenter = true;
                state.dragStartWorld.copy(handle.position);
                
                const camera = Engine.getCamera();
                const normal = new THREE.Vector3();
                camera.getWorldDirection(normal).negate();
                state.dragPlane.setFromNormalAndCoplanarPoint(normal, handle.position);

                const rect = Engine.getRenderer().domElement.getBoundingClientRect();
                const mouse = new THREE.Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    -((event.clientY - rect.top) / rect.height) * 2 + 1
                );
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse, camera);
                const hitPoint = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(state.dragPlane, hitPoint)) {
                    state.dragOffset.copy(handle.position).sub(hitPoint);
                }
                return;
            }
            
            if (event.button === 2 && !handle.userData.isMid) {
                // Right click to delete vertex
                resetHandleSelection(handle);
                deleteVertex(handle.userData.index);
                return;
            }

            if (handle.userData.isMid) {
                // Mid handle clicked - add new vertex
                resetHandleSelection(handle);
                addVertex(handle.userData.index);
                return;
            }

            state.draggingHandle = handle;
            state.dragStartWorld.copy(handle.position);
            
            // Don't toggle controls here — already disabled session-wide

            const camera = Engine.getCamera();
            const normal = new THREE.Vector3();
            camera.getWorldDirection(normal).negate();
            state.dragPlane.setFromNormalAndCoplanarPoint(normal, handle.position);

            const rect = Engine.getRenderer().domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const hitPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(state.dragPlane, hitPoint)) {
                state.dragOffset.copy(handle.position).sub(hitPoint);
            }
        }
    }

    function onPointerUp() {
        if (state.draggingHandle) {
            resetHandleSelection(state.draggingHandle);
            state.draggingHandle = null;
            // Controls remain disabled for the session; stop() re-enables them
            if (window.HistoryManager) window.HistoryManager.save();
            refreshHandles();
        }
    }

    function handleDrag(event) {
        const rect = Engine.getRenderer().domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Engine.getCamera());

        const intersectPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(state.dragPlane, intersectPoint)) {
            let worldTarget = intersectPoint.clone().add(state.dragOffset);
            
            // Snapping implementation
            const snap = Engine.getNearbyVertex ? Engine.getNearbyVertex(worldTarget, 0.4) : null;
            if (snap) {
                worldTarget.copy(snap);
            }

            state.draggingHandle.position.copy(worldTarget);

            const inverseMatrix = new THREE.Matrix4().copy(state.selectedObject.mesh.matrixWorld).invert();

            // Handle center movement - move all points by the same offset
            if (state.draggingHandle.userData.isCenter) {
                const offset = worldTarget.clone().sub(state.centerPoint);
                
                // Check if the object is a closed shape (more than 2 points and first/last points are close)
                const isClosedShape = state.points.length > 2 && 
                    Math.abs(state.points[0].x - state.points[state.points.length-1].x) < 0.01 &&
                    Math.abs(state.points[0].z - state.points[state.points.length-1].z) < 0.01;
                
                // For non-closed shapes, we need to maintain the distance from origin
                if (!isClosedShape) {
                    // Calculate current distance from origin
                    const currentDistance = getObjectCenterDistanceFromOrigin(state.points);
                    
                    // Apply the offset
                    state.points.forEach(p => {
                        const pWorld = new THREE.Vector3(p.x, p.y || 0, p.z).applyMatrix4(state.selectedObject.mesh.matrixWorld);
                        pWorld.add(offset);
                        const pLocal = pWorld.applyMatrix4(inverseMatrix);
                        p.x = pLocal.x;
                        p.y = pLocal.y;
                        p.z = pLocal.z;
                    });
                    
                    // Recalculate center after applying offset
                    const newCenter = calculatePathCenter(state.points);
                    const newDistance = Math.sqrt(newCenter.x * newCenter.x + newCenter.z * newCenter.z);
                    
                    // If the distance changed significantly, adjust to maintain relative distance
                    if (Math.abs(newDistance - currentDistance) > 0.01) {
                        const scaleFactor = currentDistance / newDistance;
                        if (isFinite(scaleFactor) && scaleFactor > 0) {
                            const center = calculatePathCenter(state.points);
                            state.points.forEach(p => {
                                p.x = center.x + (p.x - center.x) * scaleFactor;
                                p.z = center.z + (p.z - center.z) * scaleFactor;
                            });
                        }
                    }
                } else {
                    // For closed shapes, just apply the offset directly
                    state.points.forEach(p => {
                        const pWorld = new THREE.Vector3(p.x, p.y || 0, p.z).applyMatrix4(state.selectedObject.mesh.matrixWorld);
                        pWorld.add(offset);
                        const pLocal = pWorld.applyMatrix4(inverseMatrix);
                        p.x = pLocal.x;
                        p.y = pLocal.y;
                        p.z = pLocal.z;
                    });
                }
                
                // Update the center point
                const newCenter = calculatePathCenter(state.points);
                state.centerPoint.copy(new THREE.Vector3(newCenter.x, newCenter.y, newCenter.z).applyMatrix4(state.selectedObject.mesh.matrixWorld));
            } else {
                // Normal vertex dragging
                const localPoint = worldTarget.clone().applyMatrix4(inverseMatrix);
                const idx = state.draggingHandle.userData.index;
                state.points[idx] = { x: localPoint.x, y: localPoint.y, z: localPoint.z };
            }
            
            updateObject();
        }
    }

    function addVertex(index) {
        const p1 = state.points[index];
        const p2 = state.points[index + 1];
        const newPoint = {
            x: (p1.x + p2.x) / 2,
            y: ((p1.y || 0) + (p2.y || 0)) / 2,
            z: (p1.z + p2.z) / 2
        };
        state.points.splice(index + 1, 0, newPoint);
        updateObject();
        refreshHandles();
    }

    function deleteVertex(index) {
        if (state.points.length <= 2) {
            alert('Cannot have less than 2 points in a path.');
            return;
        }
        state.points.splice(index, 1);
        updateObject();
        refreshHandles();
    }

    function updateObject() {
        state.selectedObject.config.params.points = JSON.parse(JSON.stringify(state.points));
        if (window.App && window.App.rebuildObject) {
            window.App.rebuildObject(state.selectedObject);
        }
    }

    function calculatePathCenter(points) {
        const center = { x: 0, y: 0, z: 0 };
        points.forEach(p => {
            center.x += p.x;
            center.y += (p.y || 0);
            center.z += p.z;
        });
        center.x /= points.length;
        center.y /= points.length;
        center.z /= points.length;
        return center;
    }

    function getObjectCenterDistanceFromOrigin(points) {
        // Calculate the center of the object
        const center = calculatePathCenter(points);
        // Calculate distance from origin (0,0,0)
        const distance = Math.sqrt(center.x * center.x + center.z * center.z);
        return distance;
    }

    function alignWithWall() {
        // Get all walls in the scene
        const walls = Engine.getObjects().filter(obj => 
            obj.config && (obj.config.blockType === BLOCK_TYPES.POLYLINE_WALL || 
                          obj.config.blockType === BLOCK_TYPES.SPLINE_WALL ||
                          obj.config.blockType === 'path-wall')
        );

        if (walls.length === 0) {
            alert('No walls found to align with. Create a wall first.');
            return;
        }

        // Find closest wall to current path's center
        let closestWall = walls[0];
        let minDist = Infinity;
        
        const currentCenter = new THREE.Vector3(
            state.centerPoint.x, state.centerPoint.y, state.centerPoint.z
        );

        walls.forEach(wall => {
            if (wall === state.selectedObject) return; // Skip self
            const wallPoints = wall.config.params.points || [];
            if (wallPoints.length < 2) return;
            
            const wallCenter = calculatePathCenter(wallPoints);
            const wallCenterVec = new THREE.Vector3(wallCenter.x, wallCenter.y || 0, wallCenter.z);
            const dist = currentCenter.distanceTo(wallCenterVec);
            
            if (dist < minDist) {
                minDist = dist;
                closestWall = wall;
            }
        });

        if (!closestWall) {
            alert('Could not find suitable wall for alignment.');
            return;
        }

        // Calculate wall centerline points (in X and Z only, preserve Y)
        const wallPoints = closestWall.config.params.points || [];
        const wallCenter = calculatePathCenter(wallPoints);
        
        // Calculate offset to align current path center with wall center (X and Z only)
        const offsetX = wallCenter.x - calculatePathCenter(state.points).x;
        const offsetZ = wallCenter.z - calculatePathCenter(state.points).z;

        // Apply offset to all points (only X and Z, preserve Y)
        state.points.forEach(p => {
            p.x += offsetX;
            p.z += offsetZ;
        });

        updateObject();
        refreshHandles();
        
        if (window.App && window.App.showInputOverlay) {
            window.App.showInputOverlay(`Aligned with wall. Offset: X=${offsetX.toFixed(2)}, Z=${offsetZ.toFixed(2)}`);
        }
    }

    function onKeyDown(event) {
        if (!state.active) return;
        
        if (event.key.toUpperCase() === 'A') {
            event.preventDefault();
            alignWithWall();
        }
    }

    return {
        init,
        start,
        stop,
        isActive: () => state.active,
        exit: stop,
        alignWithWall // Export for external use
    };
})();
