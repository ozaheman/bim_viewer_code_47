import { Engine } from '../core/engine.js';
import { GeometryFactory } from '../factories/geometry-factory.js';
import { BlockFactory } from '../factories/block-factory.js';
import { HistoryManager } from '../managers/history-manager.js';

/**
 * ModifierSystem
 *
 * Non-destructive modifiers stored in config.modifiers[].
 * Call applyModifiers(obj) during rebuildObject to bake modifiers
 * before final geometry creation.
 *
 * Supported modifier types:
 *   { type: 'offset',  distance: 0.3, side: 'right'|'left' }
 *   { type: 'sweep',   profilePoints: [{x,y},...] }
 *
 * Modifier stack UI is managed by module-loader.js.
 */
export const ModifierSystem = (() => {

    // ─── Core: applyModifiers ─────────────────────────────────────────────────

    /**
     * Apply the modifier stack to a config object.
     * Returns a (possibly mutated copy of) params that BlockFactory can use.
     * Does NOT mutate config.params directly.
     *
     * @param {Object} config  - The object's full config (config.params, config.modifiers[])
     * @returns {Object}       - Modified params ready for BlockFactory.create()
     */
    function applyModifiers(config) {
        if (!config.modifiers || config.modifiers.length === 0) return config.params;

        // Deep-clone params so we don't corrupt the original
        let params = JSON.parse(JSON.stringify(config.params));

        for (const mod of config.modifiers) {
            if (mod.type === 'offset') {
                params = _applyOffset(params, mod);
            } else if (mod.type === 'sweep') {
                params = _applySweep(params, mod);
            }
        }
        return params;
    }

    // ─── Offset Modifier ──────────────────────────────────────────────────────

    function _applyOffset(params, mod) {
        if (!params.points || params.points.length < 2) return params;
        const distance = mod.distance ?? 0.3;
        const side = mod.side ?? 'right';

        const pts = params.points.map(p => new THREE.Vector3(p.x, p.y || 0, p.z));
        const offsetPts = GeometryFactory.createOffsetPolyline(pts, distance, side);

        return {
            ...params,
            points: offsetPts.map(p => ({ x: p.x, y: p.y, z: p.z }))
        };
    }

    // ─── Sweep Modifier ───────────────────────────────────────────────────────

    function _applySweep(params, mod) {
        if (!mod.profilePoints || mod.profilePoints.length < 3) return params;
        return {
            ...params,
            profilePoints: mod.profilePoints   // passed through to createPathWallGeometry
        };
    }

    // ─── Modifier CRUD ────────────────────────────────────────────────────────

    /**
     * Add a modifier to an object's config.modifiers[].
     * Triggers a rebuild via App.rebuildObject.
     */
    function addModifier(obj, descriptor) {
        if (!obj?.config) return;
        if (!obj.config.modifiers) obj.config.modifiers = [];
        obj.config.modifiers.push({ ...descriptor });
        _rebuild(obj);
    }

    function removeModifier(obj, index) {
        if (!obj?.config?.modifiers) return;
        obj.config.modifiers.splice(index, 1);
        _rebuild(obj);
    }

    function updateModifier(obj, index, changes) {
        if (!obj?.config?.modifiers?.[index]) return;
        Object.assign(obj.config.modifiers[index], changes);
        _rebuild(obj);
    }

    // ─── UI HTML builder ──────────────────────────────────────────────────────

    /**
     * Build and return an HTML string for the modifier list panel.
     * Wire buttons up in module-loader using data-mod-index attributes.
     */
    function buildModifierPanelHtml(obj) {
        if (!obj?.config) return '';
        const mods = obj.config.modifiers || [];
        if (mods.length === 0) return '<div style="color: #666; font-style: italic; font-size: 11px; text-align: center; padding: 10px;">No modifiers</div>';

        return mods.map((mod, i) => {
            let innerHtml = '';
            if (mod.type === 'offset') {
                innerHtml = `
                    <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
                        <span style="color: #eee; font-size: 10px; min-width: 35px;">Offset</span>
                        <input type="number" step="0.05" value="${mod.distance ?? 0.3}" style="width: 45px; background: #252526; color: #fff; border: 1px solid #555; font-size: 10px; padding: 1px;" onchange="ModifierSystem.updateModifier(Engine.getSelection(), ${i}, {distance: parseFloat(this.value)})">
                        <select style="background: #252526; color: #fff; border: 1px solid #555; font-size: 10px; padding: 1px;" onchange="ModifierSystem.updateModifier(Engine.getSelection(), ${i}, {side: this.value})">
                            <option value="right" ${mod.side === 'right' ? 'selected' : ''}>R</option>
                            <option value="left" ${mod.side === 'left' ? 'selected' : ''}>L</option>
                        </select>
                    </div>`;
            } else if (mod.type === 'sweep') {
                innerHtml = `
                    <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
                        <span style="color: #eee; font-size: 10px; min-width: 35px;">Sweep</span>
                        <button class="tool-btn" style="padding: 1px 6px; font-size: 10px;" onclick="App.startSweepProfileEdit(${i})">Edit Profile</button>
                    </div>`;
            }

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #2d2d30; padding: 4px; border-radius: 3px; border: 1px solid #444; margin-bottom: 2px;">
                    ${innerHtml}
                    <button class="tool-btn" style="padding: 1px 6px; font-size: 10px; color: #ff6666; margin-left: 4px;" onclick="ModifierSystem.removeModifier(Engine.getSelection(), ${i})">✕</button>
                </div>`;
        }).join('');
    }

    function _rebuild(obj) {
        HistoryManager.save(Engine.getObjects());
        if (window.App?.rebuildObject) window.App.rebuildObject(obj);
    }

    // ─── Public API ───────────────────────────────────────────────────────────
    return {
        applyModifiers,
        addModifier,
        removeModifier,
        updateModifier,
        buildModifierPanelHtml
    };
})();
