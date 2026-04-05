import { Engine } from '../core/engine.js';
import { DEFAULTS } from '../core/constants.js';

export const GridManager = (() => {
    // Grid state
    let mainGrid = null;
    let axesHelper = null;
    let gridVisible = true;
    let helpersVisible = true;
    let snapEnabled = false;
    let snapValue = 0.5;
    
    // Track all grids
    let allGrids = [];
    
    // Initialize grid manager
    function init() {
        console.log('GridManager initializing...');
         window.GridManager = this; // Expose to global scope for onclick handlers
        //createMainGrid();
        createAxesHelper();
        updateGridToggleUI();
        updateHelpersToggleUI();
        
        console.log('GridManager initialized successfully');
    }
    
    // Create main grid
    function createMainGrid() {
        const scene = Engine.getScene();
        if (!scene) return;
        
        // Remove existing main grid
        if (mainGrid) {
            scene.remove(mainGrid);
            if (mainGrid.geometry) mainGrid.geometry.dispose();
            if (mainGrid.material) mainGrid.material.dispose();
            mainGrid = null;
        }
        
        // Create new grid
        mainGrid = new THREE.GridHelper(
            DEFAULTS.GRID_SIZE,
            DEFAULTS.GRID_DIVISIONS,
            0x444444,
            0x333333
        );
        mainGrid.position.y = 0;
        mainGrid.userData = { isMainGrid: true };
        scene.add(mainGrid);
        
        // Add to tracking
        addToTracking(mainGrid);
        
        // Set initial visibility
        mainGrid.visible = gridVisible;
    }
    
    // Create axes helper
    function createAxesHelper() {
        const scene = Engine.getScene();
        if (!scene) return;
        
        // Remove existing axes helper
        if (axesHelper) {
            scene.remove(axesHelper);
            if (axesHelper.geometry) axesHelper.geometry.dispose();
            if (axesHelper.material) axesHelper.material.dispose();
            axesHelper = null;
        }
        
        // Create new axes helper
        axesHelper = new THREE.AxesHelper(10);
        axesHelper.position.y = 0.1; // Slightly above grid
        scene.add(axesHelper);
        
        // Set initial visibility
        axesHelper.visible = helpersVisible;
    }
    
    // Toggle grid visibility
    function toggleGrid() {
        gridVisible = !gridVisible;
        // Delegate the actual visibility update to the FloorManager
        if (window.FloorManager && window.FloorManager.updateFloorGridsVisibility) {
            window.FloorManager.updateFloorGridsVisibility();
        
        /* // Update all tracked grids
        allGrids.forEach(grid => {
            grid.visible = gridVisible;
        });
        
        // Also check scene for any other grid helpers
        const scene = Engine.getScene();
        if (scene) {
            scene.traverse(child => {
                if (child.isGridHelper && !allGrids.includes(child)) {
                    child.visible = gridVisible;
                    addToTracking(child);
                }
            }); */
        }
        
        updateGridToggleUI();
        
        // Record action
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction(`Grid ${gridVisible ? 'On' : 'Off'}`);
        }
        
        // Emit event
        Engine.emitEvent('grid-toggled', { visible: gridVisible });
    }
    
    // Toggle helpers visibility
    function toggleHelpers() {
        helpersVisible = !helpersVisible;
        
        // Toggle axes helper
        if (axesHelper) {
            axesHelper.visible = helpersVisible;
        }
        
        // Toggle other helpers (center lines, etc.)
        const scene = Engine.getScene();
        if (scene) {
            scene.traverse(child => {
                if (child.isLine && child.userData?.isHelper) {
                    child.visible = helpersVisible;
                }
            });
        }
        
        updateHelpersToggleUI();
        
        // Record action
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction(`Helpers ${helpersVisible ? 'On' : 'Off'}`);
        }
    }
    
    // Update grid toggle button UI
    function updateGridToggleUI() {
        const btn = document.getElementById('grid-toggle-btn');
        if (!btn) return;
        
        const indicator = btn.querySelector('.grid-status-indicator');
        
        if (gridVisible) {
            btn.classList.add('active');
            btn.innerHTML = '<span class="grid-status-indicator"></span>Grid: On';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<span class="grid-status-indicator off"></span>Grid: Off';
        }
    }
    
    // Update helpers toggle button UI
    function updateHelpersToggleUI() {
        const helpersBtn = document.querySelector('#undo-bar .tool-btn:nth-child(3)');
        if (!helpersBtn) return;
        
        if (helpersVisible) {
            helpersBtn.classList.add('active-tool');
            helpersBtn.textContent = 'Helpers: On';
        } else {
            helpersBtn.classList.remove('active-tool');
            helpersBtn.textContent = 'Helpers: Off';
        }
    }
    
    // Add grid to tracking
    function addToTracking(item) {
        if (!allGrids.includes(item)) {
            allGrids.push(item);
            item.visible = gridVisible;
        }
    }
    
    // Remove grid from tracking
    function removeGrid(grid) {
        const index = allGrids.indexOf(grid);
        if (index > -1) {
            allGrids.splice(index, 1);
        }
    }
    
    // Hide all grids
    function hideAllGrids() {
        allGrids.forEach(grid => {
            grid.visible = false;
        });
    }
    
    // Update all grids visibility
    function updateAllGridsVisibility() {
        allGrids.forEach(grid => {
            grid.visible = gridVisible;
        });
    }
    
    // Update floor grids visibility (called from floor manager)
    function updateFloorGridsVisibility() {
        if (window.FloorManager && window.FloorManager.updateFloorGridsVisibility) {
            window.FloorManager.updateFloorGridsVisibility();
        }
        
        
       /*  const scene = Engine.getScene();
        if (!scene) return;
        
        scene.traverse(child => {
            if (child.isGridHelper && child.userData?.isFloorGrid) {
                child.visible = gridVisible;
            }
        }); */
    }
    
    // Set snap enabled
    function setSnapEnabled(enabled) {
        snapEnabled = enabled;
        
        // Update UI
        const snapBtn = document.getElementById('btn-snap');
        if (snapBtn) {
            snapBtn.classList.toggle('active-tool', enabled);
            snapBtn.textContent = `Grid Snap: ${enabled ? 'On' : 'Off'}`;
        }
        
        // Record action
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction(`Grid Snap ${enabled ? 'enabled' : 'disabled'}`);
        }
    }
    
    // Set snap value
    function setSnapValue(value) {
        snapValue = Math.max(0.1, value);
    }
    
    // Snap a value to grid
    function snapToGrid(value) {
        if (!snapEnabled) return value;
        
        return Math.round(value / snapValue) * snapValue;
    }
    
    // Snap a vector to grid
    function snapVectorToGrid(vector) {
        if (!snapEnabled) return vector;
        
        return new THREE.Vector3(
            snapToGrid(vector.x),
            snapToGrid(vector.y),
            snapToGrid(vector.z)
        );
    }
    
    // Get grid visibility
    function getGridVisibility() {
        return gridVisible;
    }
    
    // Get helpers visibility
    function getHelpersVisibility() {
        return helpersVisible;
    }
    
    // Get snap enabled state
    function getSnapEnabled() {
        return snapEnabled;
    }
    
    // Get snap value
    function getSnapValue() {
        return snapValue;
    }
    
    // Public API
    return {
        init,
        toggleGrid,
        toggleHelpers,
        setSnapEnabled,
        setSnapValue,
        snapToGrid,
        snapVectorToGrid,
        getGridVisibility,
        getHelpersVisibility,
        getSnapEnabled,
        getSnapValue,
       /*  addToTracking,
        removeGrid,
        hideAllGrids,
        updateAllGridsVisibility, */
        updateFloorGridsVisibility,
        updateGridToggleUI,
        updateHelpersToggleUI
    };
})();