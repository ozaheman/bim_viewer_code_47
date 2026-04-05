import { Engine } from '../core/engine.js';
import { FLOOR_TYPES, ISOLATION_MODES, DEFAULTS } from '../core/constants.js';

export const FloorManager = (() => {
    // Floor data
    const floors = [];
    let currentFloorId = 0;
    let isolationMode = ISOLATION_MODES.NONE;
    
    // Visualization
    let floorMeshes = [];
    let floorGrids = [];
    //let floorLabels = [];
    
    // Initialize floor manager
    function init() {
        console.log('FloorManager initializing...');
        window.FloorManager = this; // Expose to global scope for onclick handlers
        createUI();
        autoGenerateAllFloors();
        createIsolationUI();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('FloorManager initialized successfully');
    }
    
    // Create floor management UI
    function createUI() {
        // This would be loaded from a template
        // For now, we'll assume the HTML is already present
        updateCurrentFloorDisplay();
    }
    
    // Create isolation controls UI
    function createIsolationUI() {
        const isolationControls = document.getElementById('isolation-controls');
        if (!isolationControls) return;
        
        isolationControls.innerHTML = `
            <h4>Floor Isolation</h4>
            <div class="row" style="margin-bottom: 8px;">
                <button id="isolate-none" class="tool-btn active-tool" onclick="FloorManager.setIsolationMode('none')">
                    All Floors
                </button>
                <button id="isolate-single" class="tool-btn" onclick="FloorManager.setIsolationMode('single')">
                    Single Floor
                </button>
                <button id="isolate-smart" class="tool-btn" onclick="FloorManager.setIsolationMode('smart')">
                    Smart
                </button>
            </div>
            <div id="isolation-info">
                <span id="isolation-status">Showing all floors</span>
            </div>
        `;
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Listen for object additions to assign floors
        Engine.addEventListener('object-added', (obj) => {
            if (!obj.config.floor) {
                // Auto-assign floor based on Y position
                const floor = getFloorByElevation(obj.config.pos.y);
                if (floor) {
                    obj.config.floor = floor.name;
                }
            }
        });
        
        // Listen for floor changes
        Engine.addEventListener('floor-changed', ({ floorId }) => {
            selectFloor(floorId);
        });
    }
    
    // Auto-generate standard floors
    function autoGenerateAllFloors() {
        // Clear existing floors
        floors.length = 0;
        clearFloorVisualizations();
       // clearFloorGrids();
        
        // Create floors from bottom to top
       /*  const floorTypes = Object.values(FLOOR_TYPES).sort((a, b) => a.order - b.order).map(f => f.name);
         */
        let currentElevation = 0;
        let floorId = 1;

        // Reset elevations based on a fixed Ground Floor
        const groundFloorDef = Object.values(FLOOR_TYPES).find(f => f.name === 'Ground Floor');
        /* const groundFloorIndex = Object.values(FLOOR_TYPES).sort((a,b) => a.order - b.order).findIndex(f => f.name === 'Ground Floor'); */

        // Calculate total height of basements
        let basementHeight = 0;
        Object.values(FLOOR_TYPES).forEach(f => {
            if (f.order < groundFloorDef.order) {
                basementHeight += f.height;
            }
        });
        
        currentElevation = -basementHeight;

        Object.values(FLOOR_TYPES).sort((a, b) => a.order - b.order).forEach(floorDef => {
            const floor = {
                id: floorId++,
                name: floorDef.name,
                type: floorDef.name.toLowerCase().replace(/ /g, '-'),
                ffl: currentElevation + floorDef.offset,
                soffit: currentElevation,
                height: floorDef.height,
                offset: floorDef.offset,
                color: floorDef.color,
                isRaft: floorDef.isRaft || false,
                order: floorDef.order,
                isStandard: true, // Mark standard floors
            };
            
            floors.push(floor);
            currentElevation += floorDef.height;
        });
        
        // Set current floor to ground floor
        const groundFloor = floors.find(f => f.name === 'Ground Floor');
        if (groundFloor) {
            currentFloorId = groundFloor.id;
        }
        
        // Update UI
        updateFloorUI();
        updateCurrentFloorDisplay();
        //updateGridToCurrentFloor();
        createFloorGrids();
        //updateFloorGridsVisibility(); // This now handles everything
        applyIsolation();
    }
    
    function getOrdinalName(n) {
        if (n === 0) return 'Ground';
        if (n === 1) return 'First';
        if (n === 2) return 'Second';
        if (n === 3) return 'Third';
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    
    function recalculateFloors() {
        const oldFloorMap = new Map(floors.map(f => [f.name, { oldFFL: f.ffl }]));

        floors.sort((a, b) => a.order - b.order);

        let groundFloorIndex = floors.findIndex(f => f.name === 'Ground Floor');
        if (groundFloorIndex === -1) groundFloorIndex = 0; // Fallback

        // Recalculate basements downwards from Ground
        let currentElevation = 0;
        let basementCounter = 1;
        for (let i = groundFloorIndex - 1; i >= 0; i--) {
            const floor = floors[i];
            currentElevation -= floor.height;
            floor.ffl = currentElevation + floor.offset;
            floor.soffit = currentElevation;
            if (!floor.isStandard) {
                 floor.name = `Basement ${basementCounter++}`;
            }
        }
        
        // Recalculate upper floors upwards from Ground
        currentElevation = 0;
        let floorCounter = 0;
        for (let i = groundFloorIndex; i < floors.length; i++) {
            const floor = floors[i];
            floor.ffl = currentElevation + floor.offset;
            floor.soffit = currentElevation;
            currentElevation += floor.height;

            // Only rename non-standard floors
            if (!floor.isStandard) {
                 floor.name = `${getOrdinalName(floorCounter)} Floor`;
            }
            if (floor.name.includes('Floor')) floorCounter++;
        }
        
        updateObjectElevations(oldFloorMap);
    }

    function updateObjectElevations(oldFloorMap) {
        const objects = Engine.getObjects();
        objects.forEach(obj => {
            const oldFloorData = oldFloorMap.get(obj.config.floor);
            const newFloorData = floors.find(f => f.name === obj.config.floor); // Find by potentially new name if it wasn't renamed

            if (oldFloorData && newFloorData) {
                const deltaY = newFloorData.ffl - oldFloorData.oldFFL;
                obj.mesh.position.y += deltaY;
                Engine.syncConfigFromTransform(obj);
            }
        });
    }

    function insertFloor(relativePosition) {
        const selectedIndex = floors.findIndex(f => f.id === currentFloorId);
        if (selectedIndex === -1) {
            alert('Please select a floor first.');
            return;
        }

        const selectedFloor = floors[selectedIndex];
        const insertionIndex = relativePosition === 'above' ? selectedIndex + 1 : selectedIndex;
        
        //const isBasementInsertion = selectedFloor.name.includes('Basement');

        const newFloor = {
            id: Date.now(),
            name: 'New Floor', // Temporary name
            type: 'custom',
            ffl: 0, soffit: 0, // Will be recalculated
            height: DEFAULTS.FLOOR_HEIGHT,
            offset: DEFAULTS.SLAB_THICKNESS + DEFAULTS.SCREED_THICKNESS + DEFAULTS.TILE_THICKNESS,
            color: 0xecf0f1,
            isRaft: false,
            order: selectedFloor.order + (relativePosition === 'above' ? 0.5 : -0.5), // Temp order for sorting
            isStandard: false,
        };

        floors.splice(insertionIndex, 0, newFloor);
        
        // Re-assign order values to be integers
        floors.sort((a, b) => a.order - b.order).forEach((f, i) => f.order = i + 1);

        recalculateFloors();
        
        // Finalize
        currentFloorId = newFloor.id;
        updateFloorUI();
        createFloorGrids();
        applyIsolation();
        updateCurrentFloorDisplay();
        if(window.StepsDisplay) window.StepsDisplay.recordAction(`Inserted ${newFloor.name}`);
    }

    function addFloorAbove() { insertFloor('above'); }
    function addFloorBelow() { insertFloor('below'); }

    function removeFloor(floorId) {
        const index = floors.findIndex(f => f.id === floorId);
        if (index === -1) return false;
        
        const floor = floors[index];
        
        if (floor.isStandard) {
            alert('Cannot remove standard floors.');
            return false;
        }
        
        Engine.getObjects().forEach(obj => {
            if (obj.config.floor === floor.name) Engine.removeObject(obj);
        });
        
        floors.splice(index, 1);
        
        if (currentFloorId === floorId) {
            currentFloorId = floors[index] ? floors[index].id : floors[index - 1]?.id || 0;
        }
        
        recalculateFloors();

        updateFloorUI();
        createFloorGrids();
        applyIsolation();
        updateCurrentFloorDisplay();
        if(window.StepsDisplay) window.StepsDisplay.recordAction(`Removed floor: ${floor.name}`);
        
        return true;
    }
    
    // Select a floor
    function selectFloor(floorId) {
        const floor = floors.find(f => f.id === floorId);
        if (!floor) return;
        
        currentFloorId = floorId;
        
        updateFloorUI();
        updateCurrentFloorDisplay();
        //updateGridToCurrentFloor();
        updateFloorGridsVisibility();
        
        if (isolationMode !== ISOLATION_MODES.NONE) {
            applyIsolation();
        }
        
        if (window.ObjectStackManager?.filterByFloor) {
            window.ObjectStackManager.filterByFloor(floor.name);
        }
        
        Engine.emitEvent('floor-selected', floor);
    }
    
    // ... (rest of the functions: setIsolationMode, applyIsolation, etc. remain mostly the same)
    // ... I will include the full file content below for clarity.

    // Set isolation mode
    function setIsolationMode(mode) {
        if (!Object.values(ISOLATION_MODES).includes(mode)) {
            console.error(`Invalid isolation mode: ${mode}`);
            return;
        }
        
        isolationMode = mode;
        
        document.querySelectorAll('#isolation-controls .tool-btn').forEach(btn => btn.classList.remove('active-tool'));
        const modeButton = document.getElementById(`isolate-${mode}`);
        if (modeButton) modeButton.classList.add('active-tool');
        
        applyIsolation();
        updateIsolationInfo();
        
        /* if (window.GridManager?.updateFloorGridsVisibility) {
            window.GridManager.updateFloorGridsVisibility();
        } */
        if (window.StepsDisplay) window.StepsDisplay.recordAction(`Isolation mode: ${mode}`);
    }
    
    // Apply isolation based on current mode
    function applyIsolation() {
        const objects = Engine.getObjects();
        const currentFloor = getCurrentFloorData();
        
        if (!currentFloor) { // Show all if no floor is selected
            objects.forEach(obj => { obj.mesh.visible = true; });
            return;
        };
        
        const currentFloorIndex = floors.findIndex(f => f.id === currentFloorId);
        
        objects.forEach(obj => {
            obj.mesh.visible = true;
            obj.mesh.traverse(child => {
                if (child.isMesh && child.material.transparent) { // Only reset transparency if it was set
                    child.material.transparent = false;
                    child.material.opacity = 1.0;
                    child.material.needsUpdate = true;
                }
            });
        });
        
        switch (isolationMode) {
            case ISOLATION_MODES.SINGLE:
                objects.forEach(obj => {
                    obj.mesh.visible = obj.config.floor === currentFloor.name;
                });
                break;
                
            case ISOLATION_MODES.SMART:
                objects.forEach(obj => {
                    const floorIndex = floors.findIndex(f => f.name === obj.config.floor);
                    if (floorIndex === -1) {
                        obj.mesh.visible = false;
                        return;
                    }
                    if (Math.abs(floorIndex - currentFloorIndex) > 1) {
                         obj.mesh.visible = false;
                    } else if (floorIndex !== currentFloorIndex) {
                        obj.mesh.traverse(child => {
                            if (child.isMesh && child.material) {
                                child.material.transparent = true;
                                child.material.opacity = 0.25;
                                child.material.needsUpdate = true;
                            }
                        });
                    }
                });
                break;
                
            case ISOLATION_MODES.NONE:
            default:
                break;
        }
        
        //updateFloorGridsVisibility();
        if (window.ObjectStackManager?.updateUI) window.ObjectStackManager.updateUI();
    }
    
    // Update floor grids visibility based on isolation
     function updateFloorGridsVisibility() {
        const scene = Engine.getScene();
        if (!scene || !window.GridManager) return;

        //const isGridGloballyVisible = window.GridManager.getGridVisibility();
        const isGridGloballyOn = window.GridManager.getGridVisibility();
        const currentFloor = getCurrentFloorData();
floorGrids.forEach(grid => {
            if (!isGridGloballyOn) {
                // If the master grid toggle is off, hide all floor grids.
                grid.visible = false;
            } else {
                // Otherwise, check if this grid belongs to the current floor.
                grid.visible = currentFloor ? (grid.userData.floorId === currentFloor.id) : false;
            }
        });
        /* scene.traverse(child => {
            if (child.isGridHelper && child.userData?.isFloorGrid) {
                if (!isGridGloballyVisible) {
                    // If the master grid toggle is off, hide all grids.
                    child.visible = false;
                } else {
                    // Otherwise, only show the grid for the current floor.
                    child.visible = currentFloor ? (child.userData.floorId === currentFloor.id) : false;

                    // Reset material properties that might have been changed by old logic
                    if (child.material.transparent) {
                         child.material.transparent = false;
                         child.material.opacity = 1.0;
                    }
                }
            }
        }); */
    }
    
    // Create floor grids
    function createFloorGrids() {
        clearFloorGrids();
        const scene = Engine.getScene();
        if (!scene) return;
        
        floors.forEach(floor => {
            const gridMesh = new THREE.GridHelper(DEFAULTS.GRID_SIZE, DEFAULTS.GRID_DIVISIONS, 0x444444, 0x333333);
            gridMesh.position.y = floor.ffl;
            gridMesh.userData = { isFloorGrid: true, floorId: floor.id };
            scene.add(gridMesh);
            floorGrids.push(gridMesh);
        });
        
        updateFloorGridsVisibility();
    }
    
   // function updateGridToCurrentFloor() { updateFloorGridsVisibility(); }
    
    function showFloorLevels() {
        clearFloorVisualizations();
        const scene = Engine.getScene();
        if (!scene) return;
        
        floors.forEach(floor => {
            const geometry = new THREE.PlaneGeometry(50, 50);
            const material = new THREE.MeshBasicMaterial({ color: floor.color, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            const levelMesh = new THREE.Mesh(geometry, material);
            levelMesh.position.y = floor.ffl;
            levelMesh.rotation.x = -Math.PI / 2;
            scene.add(levelMesh);
            floorMeshes.push(levelMesh);
        });
        if (window.StepsDisplay) window.StepsDisplay.recordAction('Showing floor levels');
    }
    
    function hideFloorLevels() {
        clearFloorVisualizations();
        if (window.StepsDisplay) window.StepsDisplay.recordAction('Hiding floor levels');
    }
    
    function clearFloorVisualizations() {
        const scene = Engine.getScene();
        if (!scene) return;
        floorMeshes.forEach(mesh => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        floorMeshes = [];
    }
    
    function clearFloorGrids() {
        const scene = Engine.getScene();
        if (!scene) return;
        floorGrids.forEach(grid => {
            scene.remove(grid);
            grid.geometry.dispose();
            grid.material.dispose();
        });
        floorGrids = [];
    }
    
    function updateFloorPanelUI() {
        const floorPanel = document.getElementById('floor-panel');
        if (!floorPanel) return;
        
        floorPanel.innerHTML = `
            <div class="panel-header">
                <h5>Floor Management</h5>
                <button class="close-panel-btn" onclick="FloorManager.hideFloorPanel()">×</button>
            </div>
            <div id="floors-list"></div>
            <div style="margin-top: 10px; display: flex; gap: 8px;">
                <button onclick="FloorManager.addFloorAbove()" class="primary" style="flex: 1;">Add Above</button>
                <button onclick="FloorManager.addFloorBelow()" class="primary" style="flex: 1;">Add Below</button>
            </div>
            <button onclick="FloorManager.removeSelectedFloor()" class="danger" style="width: 100%; margin: 8px 0;">Remove Selected Floor</button>
        `;
        
        updateFloorUI();
    }
    
    function updateFloorUI() {
        const floorsList = document.getElementById('floors-list');
        if (!floorsList) return;
        
        floorsList.innerHTML = '';
        const sortedFloors = [...floors].sort((a,b) => b.order - a.order); // Display top-down

        sortedFloors.forEach(floor => {
            const floorItem = document.createElement('div');
            floorItem.className = 'floor-item';
            if (floor.id === currentFloorId) floorItem.classList.add('active');
            floorItem.dataset.floorId = floor.id;
            
            floorItem.innerHTML = `
                <div>
                    <strong>${floor.name}</strong><br>
                    <small style="font-size: 10px; color: #aaa;">
                        FFL: ${floor.ffl.toFixed(2)}m | Height: ${floor.height.toFixed(2)}m
                        ${floor.isRaft ? '<span class="raft-indicator">Raft</span>' : ''}
                    </small>
                </div>
            `;
            
            floorItem.addEventListener('click', () => { selectFloor(floor.id); });
            floorsList.appendChild(floorItem);
        });
    }
    
    function updateCurrentFloorDisplay() {
        const currentFloor = getCurrentFloorData();
        const displayDiv = document.getElementById('current-floor-display');
        if (!currentFloor || !displayDiv) return;
        
        displayDiv.innerHTML = `
            <strong>Current Floor:</strong> ${currentFloor.name}<br>
            <small style="font-size: 10px; color: #aaa;">
                FFL: ${currentFloor.ffl.toFixed(2)}m | 
                Isolation: ${isolationMode}
            </small>
        `;
    }
    
    function updateIsolationInfo() {
        const statusSpan = document.getElementById('isolation-status');
        if (!statusSpan) return;
        const currentFloor = getCurrentFloorData();
        
        switch (isolationMode) {
            case ISOLATION_MODES.SINGLE: statusSpan.textContent = `Showing only ${currentFloor?.name || 'current'}`; break;
            case ISOLATION_MODES.SMART: statusSpan.textContent = `${currentFloor?.name || 'Current'} + adjacent`; break;
            case ISOLATION_MODES.NONE: statusSpan.textContent = 'Showing all floors'; break;
        }
    }
    
    function getFloorByElevation(elevation) {
        return floors.find(floor => elevation >= floor.soffit && elevation < (floor.soffit + floor.height)) || null;
    }
    
    function getFloorByName(name) { return floors.find(f => f.name === name); }
    
    function getCurrentFloorData() { return floors.find(f => f.id === currentFloorId); }
    
    function showFloorPanel() {
        const floorPanel = document.getElementById('floor-panel');
        if (floorPanel) {
            if (!floorPanel.innerHTML.trim()) updateFloorPanelUI();
            floorPanel.style.display = 'block';
        }
    }
    
    function hideFloorPanel() {
        const floorPanel = document.getElementById('floor-panel');
        if (floorPanel) floorPanel.style.display = 'none';
    }
    
    function removeSelectedFloor() {
        if (!currentFloorId) { alert('Select a floor to remove.'); return; }
        removeFloor(currentFloorId);
    }
    
    // Public API
    return {
        init,
        autoGenerateAllFloors,
        addFloorAbove,
        addFloorBelow,
        removeFloor,
        removeSelectedFloor,
        selectFloor,
        setIsolationMode,
        showFloorLevels,
        hideFloorLevels,
        showFloorPanel,
        hideFloorPanel,
        getCurrentFloorData,
        getCurrentFloorId: () => currentFloorId,
        getFloors: () => floors,
        getFloorByElevation,
        getFloorByName,
        getIsolationMode: () => isolationMode,
        applyIsolation,
        updateFloorUI,
        updateCurrentFloorDisplay,
        updateFloorGridsVisibility
       // updateGridToCurrentFloor
    };
})();