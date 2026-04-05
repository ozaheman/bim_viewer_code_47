import { Engine } from '../core/engine.js';
import { SiteManager } from './site-manager.js';
import { FloorManager } from './floor-manager.js';
import { BlockFactory } from '../factories/block-factory.js';
import { EXCAVATION_TYPES, SHORING_TYPES, DEFAULTS } from '../core/constants.js';

export const ExcavationManager = (() => {
    // Excavation state
    let excavationMesh = null;
    let shoringMeshes = [];
    let excavationVolume = 0;
    let backfillVolume = 0;
    
    // Initialize excavation manager
    function init() {
        console.log('ExcavationManager initializing...');
        window.ExcavationManager = this; // Expose to global scope for onclick
        console.log('ExcavationManager initialized successfully');
    }
    
    // Show excavation panel
    function showExcavationPanel() {
        const excavationPanel = document.getElementById('excavation-panel');
        if (excavationPanel) {
            // Only create the UI if it's not already there
            if (!excavationPanel.innerHTML.trim()) {
                 updateExcavationPanelUI();
            }
            excavationPanel.style.display = 'block';
        }
        calculateVolumes(); // Recalculate with potentially visible UI
    }
    
    // Hide excavation panel
    function hideExcavationPanel() {
        const excavationPanel = document.getElementById('excavation-panel');
        if (excavationPanel) excavationPanel.style.display = 'none';
    }
    
    // Update excavation panel UI
    function updateExcavationPanelUI() {
        const excavationPanel = document.getElementById('excavation-panel');
        if (!excavationPanel) return;
        
        excavationPanel.innerHTML = `
            <div class="panel-header">
                <h5>Excavation & Shoring</h5>
                <button class="close-panel-btn" onclick="ExcavationManager.hideExcavationPanel()">×</button>
            </div>
            <label>Excavation Type</label>
            <select id="excavation-type">
                <option value="${EXCAVATION_TYPES.OPEN}">Open Excavation (40-45°)</option>
                <option value="${EXCAVATION_TYPES.TIGHT}">Tight Space with Shoring</option>
            </select>
            <label>Basement Depth (m)</label>
            <input type="number" id="basement-depth" value="${DEFAULTS.BASEMENT_DEPTH}" step="0.5">
            <button onclick="ExcavationManager.calculateVolumes()" style="width: 100%; margin-top: 10px;">Calculate Volumes</button>
            <div class="volume-display" style="margin-top: 10px;">
                <div>Excavation: <span id="excavation-volume">0 m³</span></div>
                <div>Backfill: <span id="backfill-volume">0 m³</span></div>
            </div>
        `;
    }
    
    // Calculate volumes
    function calculateVolumes() {
        const plot = SiteManager.getPlotDimensions();
        
        // FIX: Check if UI elements exist before reading from them. Fallback to defaults.
        const depthInput = document.getElementById('basement-depth');
        const typeSelect = document.getElementById('excavation-type');

        const basementDepth = depthInput ? parseFloat(depthInput.value) : DEFAULTS.BASEMENT_DEPTH;
        const excavationType = typeSelect ? typeSelect.value : EXCAVATION_TYPES.OPEN;

        if (excavationType === EXCAVATION_TYPES.OPEN) {
            const slopeAngle = 42.5;
            const slopeDistance = basementDepth / Math.tan(THREE.MathUtils.degToRad(slopeAngle));
            const topWidth = plot.width + 2 * slopeDistance;
            const topLength = plot.length + 2 * slopeDistance;
            excavationVolume = ((topWidth * topLength + plot.width * plot.length) / 2) * basementDepth - (plot.width * plot.length * basementDepth);
            backfillVolume = excavationVolume * 0.3; 
        } else {
            excavationVolume = plot.width * plot.length * basementDepth;
            backfillVolume = excavationVolume * 0.1;
        }
        
        // Update UI only if it exists
        const excavationVolumeEl = document.getElementById('excavation-volume');
        const backfillVolumeEl = document.getElementById('backfill-volume');
        
        if (excavationVolumeEl) excavationVolumeEl.textContent = `${excavationVolume.toFixed(1)} m³`;
        if (backfillVolumeEl) backfillVolumeEl.textContent = `${backfillVolume.toFixed(1)} m³`;
    }
    
    // Public API
    return {
        init,
        showExcavationPanel,
        hideExcavationPanel,
        calculateVolumes,
    };
})();