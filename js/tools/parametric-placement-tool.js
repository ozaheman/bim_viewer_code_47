import { Engine } from '../core/engine.js';
import { BlockFactory } from '../factories/block-factory.js';
import { FloorManager } from '../managers/floor-manager.js';
import { HistoryManager } from '../managers/history-manager.js';
import { BLOCK_TYPES, EVENTS } from '../core/constants.js';

/**
 * ParametricPlacementTool
 *
 * Allows the user to click TWO points on a wall / spline-wall / polyline to
 * define a segment. A door or window is then inserted:
 *   • Width  = distance between the two clicked points
 *   • Angle  = derived from wall direction at that location
 *   • Position = midpoint of the two clicks at base-level Y
 *
 * The placed element carries `parentWallId` in its params so that
 * App.rebuildObject can re-align it when the parent wall is edited.
 */
export const ParametricPlacementTool = (() => {
    const state = {
        active: false,
        insertType: BLOCK_TYPES.DOOR,   // 'door-detailed' | 'window-2-pane'
        phase: 'point1',                // 'point1' | 'point2'
        p1: null,
        snapPoint: null,
        previewDot: null,
        parentObj: null                 // wall object the user clicked on
    };

    // ─── Public API ────────────────────────────────────────────────────────────

    function activate(insertType = BLOCK_TYPES.DOOR) {
        if (state.active) deactivate();
        state.active = true;
        state.insertType = insertType;
        state.phase = 'point1';
        state.p1 = null;
        state.parentObj = null;

        _addListeners();
        _showStatus('Click first point on the wall to start placing ' + (insertType === BLOCK_TYPES.DOOR ? 'door' : 'window') + '.');
    }

    function deactivate() {
        state.active = false;
        _removePreviewDot();
        _removeListeners();
        if (window.App?.hideInputOverlay) window.App.hideInputOverlay();
    }

    // ─── Listeners ────────────────────────────────────────────────────────────

    function _onViewportClick({ event, type: clickType }) {
        if (!state.active || clickType !== 'down') return;

        const intersects = Engine.getMouseIntersects(event);
        const hit = intersects.meshes?.[0];
        const planeHit = intersects.plane?.[0];

        // Prefer snapped point, then mesh hit, then plane
        let worldPt;
        if (state.snapPoint) {
            worldPt = state.snapPoint.clone();
        } else if (hit) {
            worldPt = hit.point.clone();
        } else if (planeHit) {
            worldPt = planeHit.point.clone();
        }
        if (!worldPt) return;

        // Snap to floor Y
        const floor = FloorManager.getCurrentFloorData();
        worldPt.y = floor ? floor.ffl : 0;

        if (state.phase === 'point1') {
            state.p1 = worldPt;
            // Try to identify which wall object the user clicked on
            if (hit) {
                const obj = hit.object?.userData;
                if (obj?.config?.blockType) state.parentObj = obj;
            }
            state.phase = 'point2';
            _placePreviewDot(worldPt);
            _showStatus('Click second point to define width of ' + (state.insertType === BLOCK_TYPES.DOOR ? 'door' : 'window') + '.');
        } else {
            // Phase 2: place the element
            _place(state.p1, worldPt);
            deactivate();
        }
    }

    function _onMove(event) {
        if (!state.active) return;
        const intersects = Engine.getMouseIntersects(event);
        state.snapPoint = Engine.getNearbyVertex?.(intersects.plane?.[0]?.point, 0.4) ?? null;
    }

    function _onKeyDown(event) {
        if (!state.active) return;
        if (event.key === 'Escape') deactivate();
    }

    function _addListeners() {
        Engine.addEventListener(EVENTS.VIEWPORT_CLICK, _onViewportClick);
        Engine.getRenderer().domElement.addEventListener('mousemove', _onMove);
        window.addEventListener('keydown', _onKeyDown);
    }

    function _removeListeners() {
        Engine.removeEventListener(EVENTS.VIEWPORT_CLICK, _onViewportClick);
        Engine.getRenderer().domElement.removeEventListener('mousemove', _onMove);
        window.removeEventListener('keydown', _onKeyDown);
    }

    // ─── Placement Logic ──────────────────────────────────────────────────────

    function _place(p1, p2) {
        const mid = p1.clone().add(p2).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const width = dir.length();
        const angle = Math.atan2(dir.x, dir.z);   // rotation around Y

        const parentWallId = state.parentObj?.config?.id ?? null;
        const floor = FloorManager.getCurrentFloorData();
        const baseY = state.parentObj?.config?.params?.base ?? (floor?.ffl ?? 0);

        // Determine height from parent wall if available
        const wallH = state.parentObj?.config?.params?.h;
        const defaultH = state.insertType === BLOCK_TYPES.DOOR ? 2.2 : 1.5;
        const elemHeight = wallH ? Math.min(wallH - 0.1, defaultH) : defaultH;

        const params = {
            w: Math.max(0.3, width),
            h: elemHeight,
            d: state.parentObj?.config?.params?.t ?? 0.2,
            parentWallId,                // for parametric re-alignment
            tMin: 0,                     // reserved for future normalized position
            tMax: 1
        };

        const config = {
            id: `${state.insertType}-${Date.now()}`,
            floor: floor?.name ?? 'Ground Floor',
            mat: state.insertType === BLOCK_TYPES.WINDOW ? 'glass' : 'wood',
            type: 'block',
            blockType: state.insertType,
            pos: { x: mid.x, y: baseY, z: mid.z },
            rot: { x: 0, y: angle, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            params
        };

        const geo = BlockFactory.create(state.insertType, params);
        if (geo) {
            HistoryManager.save(Engine.getObjects());
            const obj = Engine.addObject(config, geo);
            if (obj?.mesh) {
                obj.mesh.position.set(mid.x, baseY + elemHeight / 2, mid.z);
                obj.mesh.rotation.y = angle;
                Engine.syncConfigFromTransform(obj);
            }
        }
    }

    // ─── Preview Dot ─────────────────────────────────────────────────────────

    function _placePreviewDot(pos) {
        _removePreviewDot();
        const geo = new THREE.SphereGeometry(0.12, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00aaff, depthTest: false });
        state.previewDot = new THREE.Mesh(geo, mat);
        state.previewDot.position.copy(pos);
        state.previewDot.renderOrder = 999;
        Engine.getScene().add(state.previewDot);
    }

    function _removePreviewDot() {
        if (state.previewDot) {
            Engine.getScene().remove(state.previewDot);
            state.previewDot.geometry.dispose();
            state.previewDot.material.dispose();
            state.previewDot = null;
        }
    }

    function _showStatus(msg) {
        if (window.App?.showInputOverlay) window.App.showInputOverlay(msg);
    }

    // ─── Parametric Child Update ──────────────────────────────────────────────
    /**
     * Called by App.rebuildObject after a parent wall is rebuilt.
     * Re-aligns all child door/window objects that reference the given wall ID.
     */
    function realignChildren(parentWallObj) {
        const parentId = parentWallObj?.config?.id;
        if (!parentId) return;

        Engine.getObjects().forEach(obj => {
            if (obj.config?.params?.parentWallId === parentId) {
                // Re-centre the child on the parent wall's midpoint (simple approach)
                const wallPts = parentWallObj.config.params.points;
                if (!wallPts || wallPts.length < 2) return;
                const first = wallPts[0];
                const last = wallPts[wallPts.length - 1];
                const midX = (first.x + last.x) / 2;
                const midZ = (first.z + last.z) / 2;
                const dx = last.x - first.x;
                const dz = last.z - first.z;
                const angle = Math.atan2(dx, dz);
                const baseY = parentWallObj.config.params.base ?? 0;
                const h = obj.config.params.h ?? 2.2;
                obj.mesh.position.set(midX, baseY + h / 2, midZ);
                obj.mesh.rotation.y = angle;
                Engine.syncConfigFromTransform(obj);
            }
        });
    }

    return {
        activate,
        deactivate,
        realignChildren,
        isActive: () => state.active
    };
})();
