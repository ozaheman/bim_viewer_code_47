import { Engine } from '../core/engine.js';

/**
 * WallReferenceLine
 * Shows/hides a thin coloured line at the wall base level along the path.
 * Called when a wall or spline-wall is selected/deselected.
 */
export const WallReferenceLine = (() => {
    let _line = null;

    function show(obj) {
        hide();
        const params = obj?.config?.params;
        if (!params || !params.points || params.points.length < 2) return;

        const baseY = params.base !== undefined ? params.base : (obj.config.pos?.y || 0);

        const pts = params.points.map(
            p => new THREE.Vector3(p.x, baseY, p.z)
        );

        // Apply the object's world transform so the line stays aligned
        // even if the mesh has been translated after creation.
        const worldMatrix = obj.mesh ? obj.mesh.matrixWorld : new THREE.Matrix4();
        const transformedPts = pts.map(p => p.clone().applyMatrix4(worldMatrix));

        const geo = new THREE.BufferGeometry().setFromPoints(transformedPts);
        const mat = new THREE.LineBasicMaterial({
            color: 0xffdd00,
            depthTest: false,
            linewidth: 2
        });

        _line = new THREE.Line(geo, mat);
        _line.renderOrder = 999;
        _line.userData.isWallReferenceLine = true;
        Engine.getScene().add(_line);
    }

    function hide() {
        if (_line) {
            Engine.getScene().remove(_line);
            _line.geometry.dispose();
            _line.material.dispose();
            _line = null;
        }
    }

    function isVisible() { return _line !== null; }

    return { show, hide, isVisible };
})();
