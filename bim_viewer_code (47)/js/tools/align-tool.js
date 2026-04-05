import { Engine } from '../core/engine.js';
import { HistoryManager } from '../managers/history-manager.js';

export const AlignTool = (() => {
    let state = {
        active: false,
        sourceObj: null,
        targetObj: null,
    };

    function init(engine) {
       console.log('AlignTool initialized');
       //Engine.registerTool('align', this);
    }

    function start(sourceObj) {
        state.active = true;
        state.sourceObj = sourceObj;
        document.getElementById('align-panel').innerHTML = `
            <div class="panel-header"><h5>Align Tool</h5></div>
            <p>Target: ${state.targetObj ? state.targetObj.id : 'None'}</p>
            <div class="row"><button onclick="App.performAlign('x', 'min')">X Min</button><button onclick="App.performAlign('x', 'center')">X Cen</button><button onclick="App.performAlign('x', 'max')">X Max</button></div>
            <div class="row"><button onclick="App.performAlign('y', 'min')">Y Min</button><button onclick="App.performAlign('y', 'center')">Y Cen</button><button onclick="App.performAlign('y', 'max')">Y Max</button></div>
            <div class="row"><button onclick="App.performAlign('z', 'min')">Z Min</button><button onclick="App.performAlign('z', 'center')">Z Cen</button><button onclick="App.performAlign('z', 'max')">Z Max</button></div>
            <button class="danger" onclick="App.cancelActiveTool()">Close</button>
        `;
        document.getElementById('align-panel').style.display = 'block';
        Engine.addEventListener('viewport-click', onTargetSelect);
    }

    function exit() {
        if (!state.active) return;
        state.active = false;
        state.sourceObj = null;
        state.targetObj = null;
        document.getElementById('align-panel').style.display = 'none';
        Engine.removeEventListener('viewport-click', onTargetSelect);
    }

    function onTargetSelect({ event }) {
        if (!state.active || state.targetObj) return;
        const intersects = Engine.getMouseIntersects(event);
        if (intersects.meshes.length > 0) {
            const clickedMesh = intersects.meshes[0].object;
            const targetObj = Engine.findObjectByMesh(clickedMesh);
            if (targetObj && targetObj !== state.sourceObj) {
                state.targetObj = targetObj;
                document.querySelector('#align-panel p').textContent = `Target: ${targetObj.id}`;
                if (window.App) App.hideInputOverlay();
            }
        }
    }

    function performAlign(axis, type) {
        if (!state.sourceObj || !state.targetObj) return;

        HistoryManager.save();
        const sourceBox = new THREE.Box3().setFromObject(state.sourceObj.mesh);
        const targetBox = new THREE.Box3().setFromObject(state.targetObj.mesh);
        const sourceSize = new THREE.Vector3();
        sourceBox.getSize(sourceSize);

        const targetCenter = new THREE.Vector3();
        targetBox.getCenter(targetCenter);
        
        let newPosition = state.sourceObj.mesh.position.clone();
        
        switch (type) {
            case 'min':
                newPosition[axis] = targetBox.min[axis] + (newPosition[axis] - sourceBox.min[axis]);
                break;
            case 'center':
                newPosition[axis] = targetCenter[axis];
                break;
            case 'max':
                newPosition[axis] = targetBox.max[axis] - (sourceBox.max[axis] - newPosition[axis]);
                break;
        }

        state.sourceObj.mesh.position[axis] = newPosition[axis];
        Engine.syncConfigFromTransform(state.sourceObj);
        if(window.App) App.populateUI(state.sourceObj.config);
        if(window.App) App.generateScript();
    }

    return { init, start, exit, performAlign };
})();