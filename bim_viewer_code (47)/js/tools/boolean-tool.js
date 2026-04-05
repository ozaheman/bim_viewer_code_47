import { Engine } from '../core/engine.js';

// We'll use three-csg-ts from Skypack for CSG operations
// It works well with Three.js and provides a clean API
let CSG;

export const BooleanTool = (() => {
    let state = { active: false, operation: null, sourceObj: null };

    async function init(engine) {
        console.log('booleanTool initialized');
        try {
            // Pre-load CSG library
            // Using esm.sh instead of Skypack to avoid dependency issues
            const module = await import('https://esm.sh/three-csg-ts@3.1.11');
            CSG = module.CSG;
            console.log('CSG library loaded successfully');
        } catch (error) {
            console.error('Failed to load CSG library:', error);
        }
    }

    function start(operation, sourceObj) {
        if (!CSG) {
            alert('CSG library still loading or failed to load. Please try again in a moment.');
            return;
        }
        state.active = true;
        state.operation = operation;
        state.sourceObj = sourceObj;
        Engine.addEventListener('viewport-click', onTargetSelect);
    }

    function onTargetSelect({ event }) {
        const intersects = Engine.getMouseIntersects(event);
        if (intersects.meshes.length > 0) {
            // Find the object root
            let mesh = intersects.meshes[0].object;
            const targetObj = Engine.findObjectByMesh(mesh);

            if (targetObj && targetObj !== state.sourceObj) {
                performOperation(targetObj);
            }
        }
    }

    function performOperation(targetObj) {
        const sourceObj = state.sourceObj;
        const opType = state.operation;

        console.log(`Performing ${opType} between ${sourceObj.id} and ${targetObj.id}`);

        try {
            // Helper to ensure we are working with meshes and merged geometries
            const getMesh = (obj) => {
                if (obj.mesh.isMesh) return obj.mesh;
                // If it's a group, we might need to merge its children (simplified here to first mesh)
                let foundMesh = null;
                obj.mesh.traverse(child => {
                    if (child.isMesh && !foundMesh) foundMesh = child;
                });
                return foundMesh;
            };

            const meshA = getMesh(sourceObj);
            const meshB = getMesh(targetObj);

            if (!meshA || !meshB) {
                throw new Error('Could not find geometries for boolean operation');
            }

            // Ensure world matrices are up to date
            meshA.updateMatrixWorld();
            meshB.updateMatrixWorld();

            // Convert to CSG
            const csgA = CSG.fromMesh(meshA);
            const csgB = CSG.fromMesh(meshB);

            let resultCSG;
            if (opType === 'union') {
                resultCSG = csgA.union(csgB);
            } else if (opType === 'subtract') {
                resultCSG = csgA.subtract(csgB);
            } else {
                throw new Error('Unsupported boolean operation: ' + opType);
            }

            // Convert back to mesh first, then extract geometry to create a NEW mesh using our local THREE
            // This bypasses any version mismatch between the CSG library's THREE and our global THREE
            const tempMesh = CSG.toMesh(resultCSG, new THREE.Matrix4());
            const resultGeometry = tempMesh.geometry;

            console.log('CSG operation result geometry obtained');

            // Clean up the result geometry for selection/engine
            resultGeometry.computeBoundingBox();
            resultGeometry.computeBoundingSphere();

            // --- CENTER THE GIZMO ---
            const center = new THREE.Vector3();
            resultGeometry.boundingBox.getCenter(center);
            resultGeometry.translate(-center.x, -center.y, -center.z);

            // Fix Normals: Ensure lighting looks correct on the new geometry
            resultGeometry.computeVertexNormals();

            // Get the "normal" (original) material of the source object
            // If the object was selected, its current material is the highlight material
            // We want to ensure the result is created with the non-highlighted material
            const baseMaterial = meshA.userData.originalMaterial || meshA.material;
            const resultMaterial = baseMaterial.clone();
            resultMaterial.transparent = false;
            resultMaterial.opacity = 1.0;

            // Create mesh using GLOBAL THREE instance to ensure total compatibility
            const resultMesh = new THREE.Mesh(resultGeometry, resultMaterial);
            resultMesh.position.copy(center); // Move mesh to the visual center

            // Create new object config
            const newConfig = {
                ...sourceObj.config,
                id: Date.now(),
                blockType: 'custom',
                pos: { x: center.x, y: center.y, z: center.z },
                rot: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                params: { ...sourceObj.config.params, booleanResult: true }
            };

            // Add result to engine
            const newObj = Engine.addObject(newConfig, resultMesh);

            if (!newObj) {
                throw new Error('Engine failed to add the boolean result object');
            }

            // Remove originals
            Engine.removeObject(sourceObj);
            Engine.removeObject(targetObj);

            // Select the new object
            Engine.selectObject(newObj);

            console.log('Boolean operation completed successfully');
        } catch (error) {
            console.error('Boolean operation failed:', error);
            alert('Boolean operation failed: ' + error.message);
        }

        exit();
    }

    function exit() {
        Engine.removeEventListener('viewport-click', onTargetSelect);
        state.active = false;
        state.operation = null;
        state.sourceObj = null;

        // Hide overlay via App if possible, or just let App handle it
        if (window.App && window.App.hideInputOverlay) {
            window.App.hideInputOverlay();
        }
    }

    return { init, start, exit };
})();
