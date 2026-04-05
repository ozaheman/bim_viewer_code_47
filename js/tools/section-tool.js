import { Engine } from '../core/engine.js';
import { COLORS } from '../core/constants.js';

export const SectionTool = (() => {
    let state = { active: false, clippingPlane: null, planeHelper: null };

    function init(engine) {
        console.log('SectionTool initialized');
        //Engine.registerTool('section', this);
    }

    function start() {
        if (state.active) {
            exit();
            if (window.App) App.cancelActiveTool();
            return;
        }
        state.active = true;
        state.clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);
        Engine.getRenderer().clippingPlanes = [state.clippingPlane];
        state.planeHelper = new THREE.PlaneHelper(state.clippingPlane, 50, COLORS.SECTION);
        Engine.getScene().add(state.planeHelper);
        Engine.getTransformControls().attach(state.planeHelper);
    }

    function exit() {
        if (!state.active) return;
        state.active = false;
        Engine.getRenderer().clippingPlanes = [];
        if (Engine.getTransformControls().object === state.planeHelper) {
            Engine.getTransformControls().detach();
        }
        if (state.planeHelper) Engine.getScene().remove(state.planeHelper);
        state.clippingPlane = null;
        state.planeHelper = null;
    }

    return { init, start, exit };
})();