import { Engine } from '../core/engine.js';
import { HistoryManager } from '../managers/history-manager.js';
import { TOOL_MODES } from '../core/constants.js';

/**
 * TrimExtendTool
 * AutoCAD-style trim/extend for lines, polylines, and spline-walls.
 *
 * Workflow:
 *   1. activate('trim' | 'extend')
 *   2. Phase 1: user clicks a cutting edge object → stored as cuttingEdge
 *   3. Phase 2: user clicks a segment of another object → segment is
 *      trimmed/extended to the intersection with the cutting edge
 */
export const TrimExtendTool = (() => {
    const state = {
        active: false,
        mode: 'trim',      // 'trim' | 'extend' | 'fillet'
        phase: 'edge',     // 'edge' (pick cutting edge / first fillet) | 'target' (pick segment)
        cuttingEdge: null, // { obj, segIndex, pts[] }
        targetEdge: null,  // { obj, segIndex, pts[] }
        highlightMesh: null,
        highlightMeshTarget: null
    };

    // ─── Public API ────────────────────────────────────────────────────────────

    function activate(mode = 'trim') {
        if (state.active) deactivate();
        state.active = true;
        state.mode = mode;
        state.phase = 'edge';
        state.cuttingEdge = null;
        state.targetEdge = null;

        _addListeners();
        if (mode === 'fillet') {
            _showStatus('Fillet: Click the first segment.');
        } else {
            _showStatus(`Click the cutting edge for ${mode}.`);
        }
    }

    function deactivate() {
        state.active = false;
        _removeListeners();
        _clearHighlight();
        if (window.App?.hideInputOverlay) window.App.hideInputOverlay();
    }

    // ─── Intersection Math (XZ plane) ──────────────────────────────────────────

    /**
     * Finds intersection between infinite line (a1-a2) and segment (b1-b2) in XZ.
     */
    function _lineSegmentIntersectXZ(a1, a2, b1, b2) {
        const dax = a2.x - a1.x, daz = a2.z - a1.z;
        const dbx = b2.x - b1.x, dbz = b2.z - b1.z;
        const det = dax * dbz - daz * dbx;
        if (Math.abs(det) < 1e-6) return null; // parallel

        // Parametric 'u' for segment b1-b2
        const u = ((a1.x - b1.x) * daz - (a1.z - b1.z) * dax) / det;
        if (u < 0 || u > 1) return null; // intersection outside segment b

        // Parametric 't' for infinite line a1-a2 (always find intersection if not parallel)
        const t = ((b1.x - a1.x) * dbz - (b1.z - a1.z) * dbx) / det;
        return new THREE.Vector3(a1.x + t * dax, a1.y, a1.z + t * daz);
    }

    function _lineLineIntersectXZ(a1, a2, b1, b2) {
        const dax = a2.x - a1.x, daz = a2.z - a1.z;
        const dbx = b2.x - b1.x, dbz = b2.z - b1.z;
        const det = dax * dbz - daz * dbx;
        if (Math.abs(det) < 1e-6) return null;
        const t = ((b1.x - a1.x) * dbz - (b1.z - a1.z) * dbx) / det;
        return new THREE.Vector3(a1.x + t * dax, a1.y, a1.z + t * daz);
    }

    /**
     * Extract world-space XZ polyline points from an object.
     * Works for lines, polylines (shape blockType) and spline-wall.
     */
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

    function _convertToPolylineIfNeeded(obj) {
        const params = obj?.config?.params;
        if (params && params.type && ['rectangle', 'circle', 'polygon', 'arc'].includes(params.type)) {
            const worldPts = _getWorldPoints({ ...obj, config: { params: { ...params } } });
            const invMatrix = new THREE.Matrix4().copy(obj.mesh.matrixWorld).invert();
            params.points = worldPts.map(wp => {
                const lp = wp.clone().applyMatrix4(invMatrix);
                return { x: lp.x, y: lp.y, z: lp.z };
            });
            params.type = 'polyline';
        }
    }

    function _getWorldPoints(obj) {
        const params = obj?.config?.params;
        if (!params) return [];
        let pts = [];

        if (params.type === 'rectangle' && params.points && params.points.length >= 2) {
            const p1 = params.points[0];
            const p2 = params.points[1];
            const y = p1.y || 0;
            pts = [
                new THREE.Vector3(p1.x, y, p1.z),
                new THREE.Vector3(p2.x, y, p1.z),
                new THREE.Vector3(p2.x, y, p2.z),
                new THREE.Vector3(p1.x, y, p2.z),
                new THREE.Vector3(p1.x, y, p1.z)
            ];
        } else if (params.type === 'circle' && params.points && params.points.length >= 2) {
            const center = new THREE.Vector3(params.points[0].x, params.points[0].y || 0, params.points[0].z);
            const radius = params.radius || center.distanceTo(new THREE.Vector3(params.points[1].x, params.points[1].y || 0, params.points[1].z));
            pts = createCirclePoints(center, radius);
        } else if (params.type === 'polygon' && params.points && params.points.length >= 2) {
            const center = new THREE.Vector3(params.points[0].x, params.points[0].y || 0, params.points[0].z);
            const radius = params.radius || center.distanceTo(new THREE.Vector3(params.points[1].x, params.points[1].y || 0, params.points[1].z));
            pts = createPolygonPoints(center, radius, params.segments || 6);
        } else if (params.type === 'arc' && params.points && params.points.length >= 3) {
            const p1 = new THREE.Vector3(params.points[0].x, params.points[0].y || 0, params.points[0].z);
            const p2 = new THREE.Vector3(params.points[1].x, params.points[1].y || 0, params.points[1].z);
            const p3 = new THREE.Vector3(params.points[2].x, params.points[2].y || 0, params.points[2].z);
            pts = createArcPoints(p1, p2, p3);
        } else if (params.points) {
            pts = params.points.map(p => new THREE.Vector3(p.x, p.y || 0, p.z));
        }

        if (pts.length > 0) {
            pts = pts.map(v => obj.mesh ? v.clone().applyMatrix4(obj.mesh.matrixWorld) : v);
        }

        return pts;
    }

    /**
     * Find the segment index (within obj's points) closest to a click point.
     * Returns { segIndex, t } where t is the parametric position along that segment.
     */
    function _findClosestSegment(obj, clickPt) {
        const pts = _getWorldPoints(obj);
        if (pts.length < 2) return null;
        let bestDist = Infinity, bestIdx = 0, bestT = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i], p2 = pts[i + 1];
            const seg = new THREE.Line3(p1, p2);
            const closest = new THREE.Vector3();
            seg.closestPointToPoint(clickPt, true, closest);
            const d = closest.distanceTo(clickPt);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
                bestT = p1.distanceTo(closest) / (p1.distanceTo(p2) || 1);
            }
        }
        return { segIndex: bestIdx, t: bestT };
    }

    function _doTrim(targetObj, segInfo) {
        const cutPts = _getWorldPoints(state.cuttingEdge.obj);
        const tgtPts = _getWorldPoints(targetObj);
        const { segIndex, t } = segInfo;

        const p1 = tgtPts[segIndex];
        const p2 = tgtPts[segIndex + 1];

        let intersection = null;
        for (let ci = 0; ci < cutPts.length - 1 && !intersection; ci++) {
            intersection = _lineSegmentIntersectXZ(p1, p2, cutPts[ci], cutPts[ci + 1]);
        }
        if (!intersection) {
            console.warn('TrimExtendTool: no intersection found.');
            return;
        }

        _convertToPolylineIfNeeded(targetObj);
        const invMatrix = new THREE.Matrix4().copy(targetObj.mesh.matrixWorld).invert();
        const localIntersect = intersection.clone().applyMatrix4(invMatrix);

        const params = targetObj.config.params;
        if (t < 0.5) {
            params.points[segIndex] = { x: localIntersect.x, y: localIntersect.y, z: localIntersect.z };
        } else {
            params.points[segIndex + 1] = { x: localIntersect.x, y: localIntersect.y, z: localIntersect.z };
        }
        _rebuild(targetObj);
    }

    function _doExtend(targetObj, segInfo) {
        const cutPts = _getWorldPoints(state.cuttingEdge.obj);
        const tgtPts = _getWorldPoints(targetObj);
        const { segIndex, t } = segInfo;

        const p1 = tgtPts[segIndex];
        const p2 = tgtPts[segIndex + 1];

        let intersection = null;
        for (let ci = 0; ci < cutPts.length - 1 && !intersection; ci++) {
            intersection = _lineSegmentIntersectXZ(p1, p2, cutPts[ci], cutPts[ci + 1]);
        }
        if (!intersection) {
            console.warn('TrimExtendTool: no intersection found for extend.');
            return;
        }

        _convertToPolylineIfNeeded(targetObj);
        const invMatrix = new THREE.Matrix4().copy(targetObj.mesh.matrixWorld).invert();
        const localIntersect = intersection.clone().applyMatrix4(invMatrix);

        const params = targetObj.config.params;
        if (t > 0.5) {
            params.points[segIndex + 1] = { x: localIntersect.x, y: localIntersect.y, z: localIntersect.z };
        } else {
            params.points[segIndex] = { x: localIntersect.x, y: localIntersect.y, z: localIntersect.z };
        }
        _rebuild(targetObj);
    }

    function _doFillet(obj1, info1, obj2, info2) {
        const pts1 = _getWorldPoints(obj1);
        const pts2 = _getWorldPoints(obj2);

        const a1 = pts1[info1.segIndex], a2 = pts1[info1.segIndex+1];
        const b1 = pts2[info2.segIndex], b2 = pts2[info2.segIndex+1];

        const intersect = _lineLineIntersectXZ(a1, a2, b1, b2);
        if (!intersect) return;

        _convertToPolylineIfNeeded(obj1);
        _convertToPolylineIfNeeded(obj2);

        const inv1 = new THREE.Matrix4().copy(obj1.mesh.matrixWorld).invert();
        const loc1 = intersect.clone().applyMatrix4(inv1);
        const p1 = obj1.config.params.points;
        if (info1.t < 0.5) p1[info1.segIndex] = { x: loc1.x, y: loc1.y, z: loc1.z };
        else p1[info1.segIndex+1] = { x: loc1.x, y: loc1.y, z: loc1.z };
        _rebuild(obj1);

        const inv2 = new THREE.Matrix4().copy(obj2.mesh.matrixWorld).invert();
        const loc2 = intersect.clone().applyMatrix4(inv2);
        const p2 = obj2.config.params.points;
        if (info2.t < 0.5) p2[info2.segIndex] = { x: loc2.x, y: loc2.y, z: loc2.z };
        else p2[info2.segIndex+1] = { x: loc2.x, y: loc2.y, z: loc2.z };
        _rebuild(obj2);

        HistoryManager.save(Engine.getObjects());
    }

    function _rebuild(obj) {
        HistoryManager.save(Engine.getObjects());
        if (window.App?.rebuildObject) window.App.rebuildObject(obj);
    }

    // ─── Event Handlers ───────────────────────────────────────────────────────

    function _onClick(event) {
        if (!state.active) return;
        const intersects = Engine.getMouseIntersects(event);
        const hit = intersects.meshes?.[0];
        if (!hit) return;
        
        // Find the full Engine object (which contains the .mesh reference)
        let obj = null;
        if (hit.object) {
            obj = Engine.findObjectByMesh(hit.object);
        }
        if (!obj?.config) return;

        if (state.phase === 'edge') {
            const segInfo = _findClosestSegment(obj, hit.point);
            state.cuttingEdge = { obj, segInfo };
            state.phase = 'target';
            _highlightObject(obj);
            if (state.mode === 'fillet') {
                _showStatus('Now click the second segment to fillet.');
            } else {
                _showStatus(`Cutting edge set. Now click the segment to ${state.mode}.`);
            }
        } else {
            const clickWorld = hit.point;
            const segInfo = _findClosestSegment(obj, clickWorld);
            if (!segInfo) return;

            if (state.mode === 'fillet') {
                _doFillet(state.cuttingEdge.obj, state.cuttingEdge.segInfo, obj, segInfo);
                _showStatus('Fillet complete. Click new first segment, or press Escape.');
                state.phase = 'edge';
                _clearHighlight();
            } else {
                if (obj === state.cuttingEdge.obj) return;
                if (state.mode === 'trim') _doTrim(obj, segInfo);
                else _doExtend(obj, segInfo);
                _showStatus(`Done. Click another segment to ${state.mode}, or press Escape.`);
            }
        }
    }

    function _onKeyDown(event) {
        if (!state.active) return;
        if (event.key === 'Escape') deactivate();
    }

    function _addListeners() {
        Engine.getRenderer().domElement.addEventListener('click', _onClick);
        window.addEventListener('keydown', _onKeyDown);
    }

    function _removeListeners() {
        Engine.getRenderer().domElement.removeEventListener('click', _onClick);
        window.removeEventListener('keydown', _onKeyDown);
    }

    // ─── Visual Feedback ──────────────────────────────────────────────────────

    function _highlightObject(obj) {
        _clearHighlight();
        if (!obj?.mesh) return;
        // Tint the mesh orange to indicate it's the cutting edge
        state.highlightMesh = obj.mesh;
        state.originalColor = obj.mesh.material?.color?.getHex?.() ?? null;
        if (obj.mesh.material?.color) obj.mesh.material.color.setHex(0xff6600);
    }

    function _clearHighlight() {
        if (state.highlightMesh && state.originalColor !== null) {
            if (state.highlightMesh.material?.color)
                state.highlightMesh.material.color.setHex(state.originalColor);
        }
        state.highlightMesh = null;
        state.originalColor = null;
    }

    function _showStatus(msg) {
        if (window.App?.showInputOverlay) window.App.showInputOverlay(msg);
    }

    return { activate, deactivate, isActive: () => state.active };
})();
