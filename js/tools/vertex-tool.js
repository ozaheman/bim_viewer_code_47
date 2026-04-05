import { Engine } from '../core/engine.js';

export const VertexTool = (() => {
    let state = {
        active: false,
        selectedObject: null,
        selectedFaceIndex: -1,
        handles: [],
        draggingHandle: null,
        dragPlane: new THREE.Plane(),
        dragOffset: new THREE.Vector3(),
        dragStartWorld: new THREE.Vector3(),
        selectedVertexIds: new Set(),
        vertexStartPositions: [], // { id, worldPos }
        hoveredHandle: null,
        highlightMesh: null,
        vertexData: [], // { currentPos, indices }
        dragStartScreen: { x: 0, y: 0 }
    };

    function init(engine) {
        console.log('VertexTool initialized');
    }

    function start() {
        state.active = true;

        // Disable viewport controls for the full editing session
        const controls = Engine.getControls();
        if (controls) controls.enabled = false;

        createHighlightMesh();

        const container = document.getElementById('viewer-container');
        if (container) {
            container.addEventListener('pointermove', onPointerMove);
            container.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointerup', onPointerUp);
        }

        if (window.App && window.App.showInputOverlay) {
            window.App.showInputOverlay('Click a face to edit vertices');
        }

        // Auto-select if an object is already selected
        const sel = Engine.getSelection();
        if (sel && sel.mesh && sel.config?.params) {
            selectFace(sel.mesh, 0); // Start with first face
        }
    }

    function stop() {
        if (!state.active) return;

        // Re-enable viewport controls
        const controls = Engine.getControls();
        if (controls) controls.enabled = true;

        state.active = false;

        clearHandles();
        if (state.highlightMesh) {
            const scene = Engine.getScene();
            if (scene) scene.remove(state.highlightMesh);
            state.highlightMesh = null;
        }

        const container = document.getElementById('viewer-container');
        if (container) {
            container.removeEventListener('pointermove', onPointerMove);
            container.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointerup', onPointerUp);
        }

        const section = document.getElementById('vertex-section');
        if (section) section.style.display = 'none';

        state.selectedObject = null;
    }

    function createHighlightMesh() {
        const points = [
            new THREE.Vector3(-0.5, 0.5, 0),
            new THREE.Vector3(0.5, 0.5, 0),
            new THREE.Vector3(0.5, -0.5, 0),
            new THREE.Vector3(-0.5, -0.5, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });
        state.highlightMesh = new THREE.LineLoop(geometry, material);
        state.highlightMesh.visible = false;
        state.highlightMesh.renderOrder = 999;
        Engine.getScene().add(state.highlightMesh);
    }

    function onPointerMove(event) {
        if (!state.active) return;

        if (state.draggingHandle) {
            handleDrag(event);
            return;
        }

        const intersects = Engine.getMouseIntersects(event);

        const handleIntersect = intersects.meshes.find(i => i.object.userData?.isVertexHandle);
        if (handleIntersect) {
            updateHandleHover(handleIntersect.object);
            if (state.highlightMesh) state.highlightMesh.visible = false;
            return;
        } else {
            updateHandleHover(null);
        }

        const hit = intersects.meshes.find(i =>
            i.object.userData?.type === 'bim-object' &&
            i.object !== state.highlightMesh
        );

        if (hit) {
            updateFaceHighlight(hit);
        } else {
            if (state.highlightMesh) state.highlightMesh.visible = false;
        }
    }

    function updateFaceHighlight(hit) {
        const obj = hit.object;
        const face = hit.face;
        if (!face) {
            if (state.highlightMesh) state.highlightMesh.visible = false;
            return;
        }
        const n = face.normal;

        state.highlightMesh.visible = true;
        const geometry = obj.geometry;
        const p = geometry.parameters || { width: 1, height: 1, depth: 1 };
        const scale = obj.scale;

        state.highlightMesh.rotation.set(0, 0, 0);
        let w = 1, h = 1, axis = 'z';

        if (Math.abs(n.x) > 0.9) {
            axis = 'x';
            w = (p.depth || 1) * scale.z;
            h = (p.height || 1) * scale.y;
            state.highlightMesh.rotation.y = Math.PI / 2;
        } else if (Math.abs(n.y) > 0.9) {
            axis = 'y';
            w = (p.width || 1) * scale.x;
            h = (p.depth || 1) * scale.z;
            state.highlightMesh.rotation.x = -Math.PI / 2;
        } else {
            axis = 'z';
            w = (p.width || 1) * scale.x;
            h = (p.height || 1) * scale.y;
        }

        state.highlightMesh.scale.set(w, h, 1);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
        const worldNormal = n.clone().applyNormalMatrix(normalMatrix).normalize();

        let offset = 0;
        if (axis === 'x') offset = (p.width * scale.x) / 2;
        if (axis === 'y') offset = (p.height * scale.y) / 2;
        if (axis === 'z') offset = (p.depth * scale.z) / 2;

        const pos = obj.position.clone().add(worldNormal.multiplyScalar(offset + 0.01));
        state.highlightMesh.position.copy(pos);

        const q = new THREE.Quaternion().setFromEuler(obj.rotation);
        state.highlightMesh.quaternion.copy(q);
        if (axis === 'x') state.highlightMesh.rotateY(Math.PI / 2);
        if (axis === 'y') state.highlightMesh.rotateX(-Math.PI / 2);
    }

    function updateHandleHover(handle) {
        if (state.hoveredHandle && state.hoveredHandle !== handle) {
            state.hoveredHandle.material.color.set(0xffff00); // Reset to Yellow
            state.hoveredHandle.scale.set(1, 1, 1);
        }
        state.hoveredHandle = handle;
        if (handle) {
            handle.material.color.set(0xff0000); // Red hover
            handle.scale.set(1.5, 1.5, 1.5);
        }
    }

    function updateHandleColors() {
        state.handles.forEach((h, i) => {
            if (h === state.hoveredHandle) {
                h.material.color.set(0xff0000); // Red hover
                h.scale.set(1.5, 1.5, 1.5);
            } else if (state.selectedVertexIds.has(i)) {
                h.material.color.set(0x00ffff); // Cyan selected
                h.scale.set(1.2, 1.2, 1.2);
            } else {
                h.material.color.set(0xffff00); // Yellow default
                h.scale.set(1, 1, 1);
            }
        });
    }

    function onPointerDown(event) {
        if (!state.active) return;
        state.dragStartPos = { x: event.clientX, y: event.clientY };

        const intersects = Engine.getMouseIntersects(event);
        const handleIntersect = intersects.meshes.find(i => i.object.userData?.isVertexHandle);

        if (handleIntersect) {
            const h = handleIntersect.object;
            const vId = h.userData.vertexId;

            // Handle selection
            if (!event.ctrlKey && !event.shiftKey) {
                if (!state.selectedVertexIds.has(vId)) {
                    state.selectedVertexIds.clear();
                    state.selectedVertexIds.add(vId);
                }
            } else {
                if (state.selectedVertexIds.has(vId)) state.selectedVertexIds.delete(vId);
                else state.selectedVertexIds.add(vId);
            }

            state.draggingHandle = h;
            state.dragStartWorld.copy(h.position);

            // Store start positions for all selected vertices
            state.vertexStartPositions = Array.from(state.selectedVertexIds).map(id => ({
                id,
                worldPos: state.handles[id].position.clone()
            }));

            // Controls already disabled session-wide
            updateHandleColors();

            const camera = Engine.getCamera();
            const normal = new THREE.Vector3();
            camera.getWorldDirection(normal).negate();
            state.dragPlane.setFromNormalAndCoplanarPoint(normal, state.draggingHandle.position);

            const rect = Engine.getRenderer().domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const hitPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(state.dragPlane, hitPoint)) {
                state.dragOffset.copy(state.draggingHandle.position).sub(hitPoint);
            }
            updateVertexUI();
            return;
        }

        const hit = intersects.meshes.find(i =>
            i.object.userData?.type === 'bim-object' &&
            i.object !== state.highlightMesh
        );

        if (hit) {
            selectFace(hit.object, hit.faceIndex);
        }
    }

    function onPointerUp(event) {
        if (state.draggingHandle) {
            state.draggingHandle = null;
            // Controls remain disabled for the session; stop() re-enables them
            if (window.HistoryManager) window.HistoryManager.save();
            if (window.App) window.App.generateScript();
            updateVertexUI();
        }
    }

    function selectFace(obj, faceIndex) {
        state.selectedObject = obj;
        state.selectedFaceIndex = faceIndex;
        clearHandles();

        const geometry = obj.geometry;
        const positionAttr = geometry.attributes.position;
        const indexAttr = geometry.index;

        let faceIndices = [];

        if (indexAttr) {
            faceIndices = [
                indexAttr.getX(faceIndex * 3),
                indexAttr.getX(faceIndex * 3 + 1),
                indexAttr.getX(faceIndex * 3 + 2)
            ];

            const pairIndex = faceIndex % 2 === 0 ? faceIndex + 1 : faceIndex - 1;
            if (pairIndex >= 0 && pairIndex * 3 + 2 < indexAttr.count) {
                faceIndices.push(
                    indexAttr.getX(pairIndex * 3),
                    indexAttr.getX(pairIndex * 3 + 1),
                    indexAttr.getX(pairIndex * 3 + 2)
                );
            }
        } else {
            if (faceIndex * 3 + 2 < positionAttr.count) {
                faceIndices = [faceIndex * 3, faceIndex * 3 + 1, faceIndex * 3 + 2];
            }
        }

        if (faceIndices.length === 0) return;

        const uniquePosStrings = new Set();
        const faceVertices = [];

        faceIndices.forEach(idx => {
            const v = new THREE.Vector3().fromBufferAttribute(positionAttr, idx);
            const s = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
            if (!uniquePosStrings.has(s)) {
                uniquePosStrings.add(s);
                faceVertices.push(v);
            }
        });

        state.vertexData = faceVertices.map(pos => {
            const indices = [];
            for (let i = 0; i < positionAttr.count; i++) {
                const v = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
                if (v.distanceTo(pos) < 0.01) indices.push(i);
            }
            return { currentPos: pos.clone(), indices };
        });

        state.vertexData.forEach((vData, i) => {
            const handle = createHandle(vData.currentPos, i);
            state.handles.push(handle);
        });

        const section = document.getElementById('vertex-section');
        if (section) section.style.display = 'block';
        updateVertexUI();
    }

    function createHandle(localPos, id) {
        const worldPos = localPos.clone().applyMatrix4(state.selectedObject.matrixWorld);
        const geometry = new THREE.SphereGeometry(0.12, 12, 12);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(worldPos);
        mesh.userData = { isVertexHandle: true, vertexId: id };
        mesh.renderOrder = 1000;
        Engine.getScene().add(mesh);
        return mesh;
    }

    function clearHandles() {
        const scene = Engine.getScene();
        state.handles.forEach(h => {
            scene.remove(h);
            h.geometry.dispose();
            h.material.dispose();
        });
        state.handles = [];
    }

    function handleDrag(event) {
        if (!state.draggingHandle || !state.selectedObject) return;

        const rect = Engine.getRenderer().domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Engine.getCamera());

        const intersectPoint = new THREE.Vector3();
        const intersectResult = raycaster.ray.intersectPlane(state.dragPlane, intersectPoint);

        if (intersectResult) {
            let worldTarget = intersectPoint.clone().add(state.dragOffset);
            const worldDelta = worldTarget.clone().sub(state.dragStartWorld);

            // Constrain delta if Shift is held
            if (event.shiftKey) {
                if (Math.abs(worldDelta.x) >= Math.abs(worldDelta.y) && Math.abs(worldDelta.x) >= Math.abs(worldDelta.z)) {
                    worldDelta.set(worldDelta.x, 0, 0);
                } else if (Math.abs(worldDelta.y) >= Math.abs(worldDelta.x) && Math.abs(worldDelta.y) >= Math.abs(worldDelta.z)) {
                    worldDelta.set(0, worldDelta.y, 0);
                } else {
                    worldDelta.set(0, 0, worldDelta.z);
                }
            }

            // Move all selected vertices relative to their start positions
            state.vertexStartPositions.forEach(start => {
                const hNode = state.handles[start.id];
                const vData = state.vertexData[start.id];
                if (!hNode || !vData) return;

                const newWorldPos = start.worldPos.clone().add(worldDelta);
                hNode.position.copy(newWorldPos);

                state.selectedObject.updateMatrixWorld();
                const inverseMatrix = new THREE.Matrix4().copy(state.selectedObject.matrixWorld).invert();
                const localPoint = newWorldPos.clone().applyMatrix4(inverseMatrix);
                vData.currentPos.copy(localPoint);

                const geometry = state.selectedObject.geometry;
                const positionAttr = geometry.attributes.position;
                if (vData.indices.length > 0) {
                    vData.indices.forEach(idx => {
                        positionAttr.setXYZ(idx, localPoint.x, localPoint.y, localPoint.z);
                    });
                    positionAttr.needsUpdate = true;
                }
            });

            const geometry = state.selectedObject.geometry;
            if (geometry.attributes.normal) geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
            geometry.computeBoundingBox();

            updateVertexUI();
        }
    }

    function updateVertexUI() {
        const list = document.getElementById('vertex-list');
        if (!list) return;

        let html = `
            <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                <button onclick="App.vertexSelectAll()" class="tool-btn" style="flex:1; font-size: 10px; padding: 4px;">Select All</button>
                <button onclick="App.vertexClearSelection()" class="tool-btn" style="flex:1; font-size: 10px; padding: 4px;">Clear</button>
            </div>
        `;

        html += state.vertexData.map((v, i) => `
            <div style="background: ${state.selectedVertexIds.has(i) ? '#1a3a4a' : '#3c3c3c'}; padding: 6px; border-radius: 4px; margin-bottom: 4px; border: 1px solid ${state.selectedVertexIds.has(i) ? '#00ffff' : '#444'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <div style="font-weight: bold; color: ${state.selectedVertexIds.has(i) ? '#00ffff' : '#aaa'}; font-size: 10px;">VERTEX ${i + 1}</div>
                    <input type="checkbox" ${state.selectedVertexIds.has(i) ? 'checked' : ''} onchange="VertexTool.toggleVertexSelection(${i})" style="width: auto;">
                </div>
                <div style="font-size: 9px; color: #888;">X: ${v.currentPos.x.toFixed(2)}, Y: ${v.currentPos.y.toFixed(2)}, Z: ${v.currentPos.z.toFixed(2)}</div>
            </div>
        `).join('');

        if (state.selectedVertexIds.size === 1) {
            const idx = Array.from(state.selectedVertexIds)[0];
            const sel = state.selectedObject;
            if (sel && sel.config?.params?.points && idx < sel.config.params.points.length - 1) {
                const currentType = sel.config.params.segments?.[idx]?.type || 'line';
                html += `
                    <div style="margin-top: 10px; border-top: 1px solid #555; padding-top: 10px;">
                        <div style="font-size: 10px; color: #888; margin-bottom: 5px; text-transform: uppercase;">Segment Type (After V${idx + 1})</div>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="App.setSegmentType(${idx}, 'line')" class="tool-btn ${currentType === 'line' ? 'active-tool' : ''}" style="flex:1; font-size: 9px; padding: 2px;">Straight</button>
                            <button onclick="App.setSegmentType(${idx}, 'arc')" class="tool-btn ${currentType === 'arc' ? 'active-tool' : ''}" style="flex:1; font-size: 9px; padding: 2px;">Arc</button>
                            <button onclick="App.setSegmentType(${idx}, 'bezier')" class="tool-btn ${currentType === 'bezier' ? 'active-tool' : ''}" style="flex:1; font-size: 9px; padding: 2px;">Bezier</button>
                        </div>
                    </div>
                `;
            }
        }

        list.innerHTML = html;
    }

    function selectAll() {
        if (!state.vertexData.length) return;
        state.selectedVertexIds.clear();
        state.vertexData.forEach((_, i) => state.selectedVertexIds.add(i));
        updateHandleColors();
        updateVertexUI();
    }

    function clearSelection() {
        state.selectedVertexIds.clear();
        updateHandleColors();
        updateVertexUI();
    }

    function toggleSelection(id) {
        if (state.selectedVertexIds.has(id)) state.selectedVertexIds.delete(id);
        else state.selectedVertexIds.add(id);
        updateHandleColors();
        updateVertexUI();
    }

    function updateVertex(vId, axis, value) {
        if (!state.selectedObject || !state.vertexData[vId]) return;
        const vData = state.vertexData[vId];
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        vData.currentPos[axis] = numValue;
        const geometry = state.selectedObject.geometry;
        const positionAttr = geometry.attributes.position;
        vData.indices.forEach(idx => {
            positionAttr.setXYZ(idx, vData.currentPos.x, vData.currentPos.y, vData.currentPos.z);
        });
        positionAttr.needsUpdate = true;

        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();

        const worldPos = vData.currentPos.clone().applyMatrix4(state.selectedObject.matrixWorld);
        if (state.handles[vId]) state.handles[vId].position.copy(worldPos);

        if (window.HistoryManager) window.HistoryManager.save();
    }

    return {
        init,
        start,
        stop,
        updateVertex,
        selectAll,
        clearSelection,
        toggleSelection,
        exit: stop
    };
})();
