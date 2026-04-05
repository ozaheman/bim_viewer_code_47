export async function loadAllModules() {
    const modules = {
        'floor-management': './ui/modules/floor-management.html',
        'asset-library': './ui/modules/asset-library.html',
        'edit-selection': './ui/modules/edit-selection.html',
        'modeling-tools': './ui/modules/modeling-tools.html',
        'finishes-layers': './ui/modules/finishes-layers.html',
        'auto-generation': './ui/modules/auto-generation.html',
        'profile-editor': './ui/modules/profile-editor.html',
        'object-stack': './ui/modules/object-stack.html',
        'properties': './ui/modules/properties.html',
        'steps-display': './ui/modules/steps-display.html'
    };

    console.log('Loading UI modules...');

    for (const [moduleId, url] of Object.entries(modules)) {
        try {
            await loadModule(moduleId, url);
            console.log(`✅ Loaded module: ${moduleId}`);
        } catch (error) {
            console.error(`❌ Failed to load module ${moduleId}:`, error);
            createFallbackContent(moduleId);
        }
    }

    // Initialize modules after loading
    initializeModules();
}

async function loadModule(moduleId, url) {
    const moduleElement = document.querySelector(`[data-module="${moduleId}"]`);
    if (!moduleElement) {
        throw new Error(`Module container not found: ${moduleId}`);
    }

    try {
        const htmlContent = getModuleContent(moduleId);

        if (!htmlContent) {
            throw new Error(`No content found for module: ${moduleId}`);
        }

        moduleElement.innerHTML = htmlContent;

    } catch (error) {
        console.warn(`Using fallback for ${moduleId}:`, error.message);
        createFallbackContent(moduleId);
    }
}

function getModuleContent(moduleId) {
    // In a real app, this would use fetch(url).
    // Here, we'll use a hardcoded map of the provided HTML files.
    const modulesContent = {
        'floor-management': `<h4>1. Floors & Site</h4>
<button onclick="window.FloorManager.showFloorPanel()" class="primary">Manage Floors</button>
<button onclick="window.ExcavationManager.showExcavationPanel()">Excavation & Shoring</button>
<label>Site Plot Dimensions (m)</label>
<div class="row">
    <div><input type="number" id="plot-width" value="30" step="0.5" min="10" max="200"><small style="font-size: 9px; color: #888;">Width</small></div>
    <div><input type="number" id="plot-length" value="40" step="0.5" min="10" max="200"><small style="font-size: 9px; color: #888;">Length</small></div>
</div>
<button onclick="window.SiteManager.generatePlot()" class="primary" style="margin-bottom: 8px;">Generate Plot</button>
<div class="tool-separator">
    <button onclick="window.FloorManager.autoGenerateAllFloors()" style="margin-bottom: 5px;">Auto Generate All Floors</button>
    <button onclick="window.FloorManager.showFloorLevels()">Show Floor Levels</button>
</div>
<div id="current-floor-display" style="margin-top: 15px; padding: 10px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">
    <strong>Current Floor:</strong> Ground Floor<br>
    <small style="font-size: 10px; color: #aaa;">FFL: 0.00m | Isolation: none</small>
</div>
<div id="isolation-controls" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
    <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px;">Floor Isolation</h4>
    <div class="row" style="margin-bottom: 8px;">
        <button id="isolate-none" class="tool-btn active-tool" onclick="window.FloorManager.setIsolationMode('none')">All Floors</button>
        <button id="isolate-single" class="tool-btn" onclick="window.FloorManager.setIsolationMode('single')">Single Floor</button>
        <button id="isolate-smart" class="tool-btn" onclick="window.FloorManager.setIsolationMode('smart')">Smart</button>
    </div>
    <div id="isolation-info" style="font-size: 11px; color: #aaa; background: #2d2d30; padding: 8px; border-radius: 4px; border: 1px solid #444;">
        <span id="isolation-status">Showing all floors</span>
    </div>
</div>`,
        'asset-library': `<h4>2. Asset Library</h4>
<div id="asset-grid">
    <div class="asset-btn" draggable="true" data-type="wall"><span style="font-size: 14px;">🧱</span><span>Wall</span></div>
    <div class="asset-btn" draggable="true" data-type="column"><span style="font-size: 14px;">🏛️</span><span>Column</span></div>
    <div class="asset-btn" draggable="true" data-type="beam"><span style="font-size: 14px;">📏</span><span>Beam</span></div>
    <div class="asset-btn" draggable="true" data-type="footing"><span style="font-size: 14px;">⬛</span><span>Footing</span></div>
    <div class="asset-btn" draggable="true" data-type="window-2-pane"><span style="font-size: 14px;">🪟</span><span>Window</span></div>
    <div class="asset-btn" draggable="true" data-type="door-detailed"><span style="font-size: 14px;">🚪</span><span>Door</span></div>
    <div class="asset-btn" draggable="true" data-type="railing-modern"><span style="font-size: 14px;">↕️</span><span>Railing</span></div>
    <div class="asset-btn" draggable="true" data-type="railing-glass"><span style="font-size: 14px;">🔲</span><span>Glass Rail</span></div>
    <div class="asset-btn" draggable="true" data-type="stairs"><span style="font-size: 14px;">📶</span><span>Stairs</span></div>
    <div class="asset-btn" draggable="true" data-type="parapet"><span style="font-size: 14px;">🧱</span><span>Parapet</span></div>
    <div class="asset-btn" draggable="true" data-type="hole"><span style="font-size: 14px;">🕳️</span><span>Hole</span></div>
    <div class="asset-btn" draggable="true" data-type="shape"><span style="font-size: 14px;">🔷</span><span>Shape</span></div>
</div>
<div id="column-type-panel" style="margin-top: 15px; padding: 10px; background: #2d2d30; border-radius: 6px; border: 1px solid #444;">
    <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #888;">Column Shape</h4>
    <div class="row">
        <button id="col-shape-circular" class="tool-btn active-tool" onclick="App.setColumnShape('circular')" style="flex:1;">Circular</button>
        <button id="col-shape-rectangular" class="tool-btn" onclick="App.setColumnShape('rectangular')" style="flex:1;">Rectangular</button>
    </div>
</div>
<div style="margin-top: 10px; font-size: 11px; color: #888; text-align: center;">Tip: Drag onto grid or click to place on current floor</div>`,
        'edit-selection': `<h4>3. Edit Selection</h4>
<div id="edit-selection">
    <div class="row">
        <div><label>ID</label><input type="number" id="e-id" readonly></div>
        <div><label>Floor</label><input type="text" id="e-floor"></div>
    </div>
    <label>Material</label>
    <select id="e-mat">
        <option value="concrete">Concrete</option>
        <option value="steel">Steel</option>
        <option value="glass">Glass</option>
        <option value="paint">Paint</option>
        <option value="wood">Wood</option>
        <option value="brick">Brick</option>
    </select>
    <div class="tool-separator">
        <label>Position (m)</label>
        <div class="row"><div><input type="number" id="e-tx" step="0.1"></div><div><input type="number" id="e-ty" step="0.1"></div><div><input type="number" id="e-tz" step="0.1"></div></div>
        <label>Rotation (°)</label>
        <div class="row"><div><input type="number" id="e-rx" step="1"></div><div><input type="number" id="e-ry" step="1"></div><div><input type="number" id="e-rz" step="1"></div></div>
        <label>Scale</label>
        <div class="row"><div><input type="number" id="e-sx" step="0.01"></div><div><input type="number" id="e-sy" step="0.01"></div><div><input type="number" id="e-sz" step="0.01"></div></div>
    </div>
    <div style="margin-top: 10px; display: flex; gap: 5px;">
        <button onclick="App.copySelected()" style="flex: 1;">Copy</button>
        <button class="danger" onclick="App.deleteSelected()" style="flex: 1;">Delete</button>
    </div>
</div>`,
        'modeling-tools': `<h4>4. Modeling Tools</h4>
<div class="group">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">Drafting</h5>
    <div class="row">
        <button id="tool-draw-line" class="tool-btn" onclick="App.startDrawing('line')" title="Line (L)">Line</button>
        <button id="tool-draw-rectangle" class="tool-btn" onclick="App.startDrawing('rectangle')" title="Rectangle (R)">Rect</button>
        <button id="tool-draw-circle" class="tool-btn" onclick="App.startDrawing('circle')" title="Circle (C)">Circle</button>
    </div>
    <div class="row" style="margin-top: 5px;">
        <button id="tool-draw-polyline" class="tool-btn" onclick="App.startDrawing('polyline')" title="Polyline (P)">Poly</button>
        <button id="tool-draw-polygon" class="tool-btn" onclick="App.startDrawing('polygon')" title="Polygon">Polygon</button>
        <button id="tool-draw-arc" class="tool-btn" onclick="App.startDrawing('arc')" title="Arc (A)">Arc</button>
    </div>
</div>

<div class="group" style="margin-top: 10px;">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">Walls & Elements</h5>
    <div class="row">
        <button id="tool-wall-path" class="tool-btn" onclick="App.startDrawing('path-wall')" title="Draw Wall along Path">Path Wall</button>
        <button id="tool-wall-derive" class="tool-btn" onclick="window.WallPathTool.deriveFromSelected()" title="Derive Wall from Selected Path">Derive Wall</button>
        <button id="tool-wall-join-top" class="tool-btn" onclick="window.WallPathTool.deriveWithTopJoin()" title="Join selected shape to floor above">Join Top</button>
        <button id="tool-wall-finish" class="tool-btn primary" onclick="App.finishWallPath()" title="Finish & Exit Wall Path Tool">Finish</button>
    </div>
    <div class="row" style="margin-top: 5px; gap: 5px;">
        <div style="flex: 1;">
            <label style="font-size: 9px; color: #888; display: block;">Thickness</label>
            <input type="number" id="wall-thickness-input" value="0.2" step="0.05" class="tool-select" style="width: 100%; height: 28px; background: #2d2d30; color: #eee; border: 1px solid #444; border-radius: 4px; padding: 0 5px;">
        </div>
        <div style="flex: 1.5;">
            <label style="font-size: 9px; color: #888; display: block;">Offset Mode</label>
            <select id="wall-offset-mode" class="tool-select" style="width: 100%; height: 28px; background: #2d2d30; color: #eee; border: 1px solid #444; border-radius: 4px; padding: 0 5px;">
                <option value="mid">Center</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="inside">Inside</option>
                <option value="outside">Outside</option>
            </select>
        </div>
    </div>
    <div class="row" style="margin-top: 5px;">
        <button id="tool-2point-element" class="tool-btn" onclick="App.start2PointPlacement()" title="Place opening/element by 2 points">2nd Point</button>
        <select id="select-element-type" class="tool-select" style="flex: 1; height: 32px; background: #2d2d30; color: #eee; border: 1px solid #444; border-radius: 4px; padding: 0 5px;">
            <option value="window">Window</option>
            <option value="door">Door</option>
            <option value="curtain-wall">Curtain Wall</option>
            <option value="railing">Railing</option>
            <option value="divider">Space Divider</option>
        </select>
    </div>
</div>

<div class="group" style="margin-top: 10px;">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">Trim & Extend</h5>
    <div class="row">
        <button id="tool-trim" class="tool-btn" onclick="App.startTrimTool()" title="Trim to cutting edge">Trim</button>
        <button id="tool-extend" class="tool-btn" onclick="App.startExtendTool()" title="Extend to cutting edge">Extend</button>
        <button id="tool-fillet" class="tool-btn" onclick="App.startFilletTool()" title="Fillet two segments">Fillet</button>
    </div>
</div>

<div class="group" style="margin-top: 10px;">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">Parametric Place</h5>
    <div class="row">
        <button id="tool-param-door" class="tool-btn" onclick="App.startParametricPlace('door-detailed')" title="Click 2 pts on wall to insert Door">Door</button>
        <button id="tool-param-window" class="tool-btn" onclick="App.startParametricPlace('window-2-pane')" title="Click 2 pts on wall to insert Window">Window</button>
    </div>
</div>

<div class="group" style="margin-top: 10px;">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">CSG Operations</h5>
    <div class="row">
        <button id="tool-union" class="tool-btn" onclick="App.startBoolean('union')" title="Union (Join)">Union</button>
        <button id="tool-subtract" class="tool-btn" onclick="App.startBoolean('subtract')" title="Subtract (Cut)">Subtract</button>
    </div>
</div>

<div class="group" style="margin-top: 10px;">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">Editing</h5>
    <div class="row">
        <button id="tool-snap-move" class="tool-btn" onclick="App.startSnapMove()" title="Move with Snapping">Move</button>
        <button id="tool-copy" class="tool-btn" onclick="App.startSnapMoveCopy()" title="Copy Geometry">Copy</button>
        <button id="tool-push-pull" class="tool-btn" onclick="App.startPushPull()" title="Push/Pull (P)">Push/Pull</button>
    </div>
    <div class="row" style="margin-top: 5px;">
        <button id="tool-array-linear" class="tool-btn" onclick="App.startArray('move')" title="Linear Array">Array</button>
        <button id="tool-array-radial" class="tool-btn" onclick="App.startArray('radial')" title="Radial Array">Radial</button>
        <button id="tool-edit-path" class="tool-btn" onclick="App.startSplineVertexEdit()" title="Edit Spline/Path Vertices">Edit Path</button>
        <button id="tool-vertex" class="tool-btn" onclick="App.startVertexEdit()" title="Mesh Vertex Edit">Vertex</button>
    </div>
</div>

<div class="group" style="margin-top: 10px;">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">Analysis & Rooms</h5>
    <div class="row">
        <button id="tool-generate-rooms" class="tool-btn" onclick="App.generateRooms()" title="Detect closed loops and create rooms">Gen Rooms</button>
    </div>
</div>

<div class="group" style="margin-top: 10px;">
    <h5 style="font-size: 11px; color: #aaa; text-transform: uppercase;">Snapping</h5>
    <div id="snap-point-modes" class="row">
        <button id="snap-mode-corners" class="tool-btn" onclick="App.setSnapPointType('corners')" title="Snap to Corners">Corners</button>
        <button id="snap-mode-midpoints" class="tool-btn" onclick="App.setSnapPointType('midpoints')" title="Snap to Midpoints">Mid</button>
        <button id="snap-mode-center" class="tool-btn" onclick="App.setSnapPointType('center')" title="Snap to Centers">Center</button>
    </div>
    <div class="row" style="margin-top: 5px;">
        <button id="btn-snap" class="tool-btn" onclick="App.toggleSnap()" style="width: 100%;">Grid Snap: Off</button>
    </div>
</div>`,
        'properties': `<h4>5. Properties</h4>
<div id="properties-panel" style="padding: 10px; background: #252526; border-radius: 4px;">
    <div id="no-selection-msg" style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">
        Select an object to view properties
    </div>
    <div id="props-content" style="display: none;">
        <div class="prop-row" style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #aaa;">Thickness (m)</label>
            <input type="number" id="prop-thickness" step="0.01" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateProperty('t', parseFloat(this.value))">
        </div>
        <div class="prop-row" style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #aaa;">Height (m)</label>
            <input type="number" id="prop-height" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateProperty('h', parseFloat(this.value))">
        </div>
        <div class="prop-row" style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #aaa;">Alignment</label>
            <select id="prop-align" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateProperty('align', this.value)">
                <option value="mid">Center</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="inside">Inside</option>
                <option value="outside">Outside</option>
            </select>
        </div>
        <div class="prop-row" style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #aaa;">Base Level (m)</label>
            <input type="number" id="prop-base-level" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateProperty('base', parseFloat(this.value))">
        </div>
        <div class="prop-row" style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #aaa;">Top Level (m)</label>
            <input type="number" id="prop-top-level" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateProperty('top', parseFloat(this.value))">
        </div>
        <div class="prop-row" style="margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;">
            <button class="tool-btn" onclick="App.flipObject()">&#8596; Flip Wall / Object</button>
            <button id="prop-edit-sweep" class="tool-btn" style="display: none;" onclick="App.startSweepProfileEdit()">Edit Sweep Profile</button>
        </div>
        <div class="prop-row" style="margin-bottom: 8px;">
            <label style="display: block; font-size: 11px; color: #aaa;">Convert To</label>
            <select id="prop-convert-to" style="width: 70%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;">
                <option value="">-- select --</option>
                <option value="curtain-wall">Curtain Wall</option>
                <option value="curved-wall">Curved Wall</option>
                <option value="railing-modern">Railing (Modern)</option>
                <option value="railing-glass">Railing (Glass)</option>
                <option value="solid-block">Solid Block</option>
            </select>
            <button class="tool-btn" style="width: 28%; margin-left: 2%;" onclick="App.convertWall(document.getElementById('prop-convert-to').value)">Convert</button>
        </div>
        <div id="prop-pivot-container" style="margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; display: none;">
            <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 5px; text-transform: uppercase;">Pivot Point (Center)</label>
            <div class="row" style="gap: 5px;">
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">X</small>
                    <input type="number" id="prop-pivot-x" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updatePivot('x', parseFloat(this.value))">
                </div>
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">Z</small>
                    <input type="number" id="prop-pivot-z" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updatePivot('z', parseFloat(this.value))">
                </div>
            </div>
        </div>
        <div id="prop-sweep-container" style="margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; display: none;">
            <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 5px; text-transform: uppercase;">Sweep Controls</label>
            <div class="prop-row" style="margin-bottom: 8px;">
                <label style="display: block; font-size: 11px; color: #aaa;">Profile Rotation (°)</label>
                <input type="number" id="prop-sweep-rotation" step="1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateProperty('rotation', parseFloat(this.value))">
            </div>
            <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 5px;">Normal Axis (Up)</label>
            <div class="row" style="gap: 5px; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">X</small>
                    <input type="number" id="prop-sweep-normal-x" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateSweepNormal('x', parseFloat(this.value))">
                </div>
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">Y</small>
                    <input type="number" id="prop-sweep-normal-y" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateSweepNormal('y', parseFloat(this.value))">
                </div>
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">Z</small>
                    <input type="number" id="prop-sweep-normal-z" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateSweepNormal('z', parseFloat(this.value))">
                </div>
            </div>
            <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 5px;">Base Point Offset</label>
            <div class="row" style="gap: 5px;">
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">X</small>
                    <input type="number" id="prop-sweep-base-x" step="0.05" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateSweepBase('x', parseFloat(this.value))">
                </div>
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">Y</small>
                    <input type="number" id="prop-sweep-base-y" step="0.05" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateSweepBase('y', parseFloat(this.value))">
                </div>
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px; display: block;">Z</small>
                    <input type="number" id="prop-sweep-base-z" step="0.05" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateSweepBase('z', parseFloat(this.value))">
                </div>
            </div>
        </div>
        <div id="prop-geometry-points" style="margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; display: none;">
            <label style="font-size: 11px; color: #aaa; text-transform: uppercase;">Endpoints</label>
            <div class="row" style="gap: 5px; margin-top: 5px;">
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px;">Start X</small>
                    <input type="number" id="prop-start-x" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updatePoint(0, 'x', parseFloat(this.value))">
                </div>
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px;">Start Z</small>
                    <input type="number" id="prop-start-z" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updatePoint(0, 'z', parseFloat(this.value))">
                </div>
            </div>
            <div class="row" style="gap: 5px; margin-top: 5px;">
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px;">End X</small>
                    <input type="number" id="prop-end-x" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updatePoint('last', 'x', parseFloat(this.value))">
                </div>
                <div style="flex: 1;">
                    <small style="color: #888; font-size: 9px;">End Z</small>
                    <input type="number" id="prop-end-z" step="0.1" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updatePoint('last', 'z', parseFloat(this.value))">
                </div>
            </div>
        </div>

        <div id="prop-modifier-container" style="margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <label style="font-size: 11px; color: #aaa; text-transform: uppercase;">Modifiers</label>
                <div style="display: flex; gap: 4px;">
                    <select id="mod-type-select" style="background: #3c3c3c; color: #eee; border: 1px solid #555; font-size: 10px; padding: 2px;">
                        <option value="offset">Offset</option>
                        <option value="sweep">Sweep</option>
                    </select>
                    <button class="tool-btn" style="padding: 2px 6px; font-size: 10px;" onclick="ModifierSystem.addModifier(Engine.getSelection(), {type: document.getElementById('mod-type-select').value})">+</button>
                </div>
            </div>
            <div id="modifier-list-dynamic" style="display: flex; flex-direction: column; gap: 4px;"></div>
        </div>
        <div class="prop-row">
            <label style="display: block; font-size: 11px; color: #aaa;">Material</label>
            <select id="prop-material" style="width: 100%; background: #3c3c3c; color: #eee; border: 1px solid #555; padding: 4px;" onchange="App.updateProperty('mat', this.value)">
                <option value="concrete">Concrete</option>
                <option value="brick">Brick</option>
                <option value="wood">Wood</option>
                <option value="glass">Glass</option>
                <option value="steel">Steel</option>
            </select>
        </div>
    </div>
</div>`,
        'finishes-layers': `<h4>6. Finishes & Layers</h4>
<div id="finish-status" style="font-size: 12px; color: #aaa; margin-bottom: 10px; padding: 8px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">Select a wall/column to add finishes</div>
<div id="finish-controls" style="display: none;">
    <div style="margin-bottom: 15px;"><label>Inner Finish</label><select id="finish-inner"><option value="none">None</option><option value="plaster">Plaster (18mm)</option><option value="drywall">Drywall (12mm)</option><option value="tile">Tile (10mm)</option><option value="paint">Paint (5mm)</option></select></div>
    <div style="margin-bottom: 15px;"><label>Outer Finish</label><select id="finish-outer"><option value="none">None</option><option value="render">Render (20mm)</option><option value="brick">Brick (100mm)</option><option value="cladding_75">Cladding (75mm)</option><option value="cladding_100">Cladding (100mm)</option></select></div>
    <div style="display: flex; gap: 8px; margin-top: 15px;">
        <button onclick="window.FinishesManager.applyFinishes()" class="primary" style="flex: 1;">Apply</button>
        <button onclick="window.FinishesManager.removeFinishes()" class="danger" style="flex: 1;">Remove</button>
    </div>
</div>
<div style="margin-top: 15px; padding: 10px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">
    <h5 style="margin: 0 0 8px 0; font-size: 11px; color: #aaa;">Finish Materials</h5>
    <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 5px;">
        <div style="display: flex; align-items: center; gap: 4px; font-size: 10px;"><div class="material-preview concrete" style="width: 12px; height: 12px;"></div><span>Concrete</span></div>
        <div style="display: flex; align-items: center; gap: 4px; font-size: 10px;"><div class="material-preview brick" style="width: 12px; height: 12px;"></div><span>Brick</span></div>
        <div style="display: flex; align-items: center; gap: 4px; font-size: 10px;"><div class="material-preview glass" style="width: 12px; height: 12px;"></div><span>Glass</span></div>
    </div>
    <div style="font-size: 10px; color: #888;">Finishes add layers to walls/columns</div>
</div>`,
        'auto-generation': `<h4>7. Auto Generation</h4>
<button id="auto-floor-toggle" onclick="App.toggleAutoFloor()">Auto Floor: Off</button>
<button id="auto-roof-toggle" onclick="App.toggleAutoRoof()">Auto Roof: Off</button>
<div style="margin-top: 15px; padding: 10px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">
    <h5 style="margin: 0 0 8px 0; font-size: 11px; color: #aaa;">Auto Generation Settings</h5>
    <label style="font-size: 11px;">Floor Thickness (mm)</label><input type="number" value="200" min="100" max="500" step="10" style="font-size: 11px; margin-bottom: 8px;">
    <label style="font-size: 11px;">Roof Thickness (mm)</label><input type="number" value="250" min="100" max="600" step="10" style="font-size: 11px; margin-bottom: 8px;">
    <label style="font-size: 11px;">Generation Mode</label><select style="font-size: 11px; margin-bottom: 10px;"><option value="bounding">Bounding Box</option><option value="footprint">Footprint</option><option value="custom">Custom Area</option></select>
    <div style="display: flex; gap: 5px; margin-top: 10px;">
        <button class="tool-btn" style="flex: 1; font-size: 11px;">Regenerate</button>
        <button class="tool-btn danger" style="flex: 1; font-size: 11px;">Clear All</button>
    </div>
</div>
<div style="margin-top: 15px; font-size: 11px; color: #888;"><strong>Note:</strong> Auto-generation creates floors/roofs based on object boundaries</div>`,
        'profile-editor': `<h4>8. Profile Editor</h4>
<div class="row">
    <button id="tool-floor-profile" class="tool-btn" onclick="App.startFloorProfile()">Floor Profile</button>
    <button id="tool-ceiling-profile" class="tool-btn" onclick="App.startCeilingProfile()">Ceiling Profile</button>
</div>
<div id="profile-toolbar" style="display: none; margin-top: 10px; padding: 10px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">
    <label>Profile Thickness (m)</label><input type="number" id="profile-thickness" value="0.2" step="0.05" min="0.05" max="1.0" onchange="window.ProfileEditor.updateThickness(this.value)">
    <div style="margin-top: 10px; display: flex; gap: 5px;">
        <button onclick="window.ProfileEditor.finishProfile()" class="primary" style="flex: 1;">Finish Profile</button>
        <button onclick="window.ProfileEditor.undoProfilePoint()" class="tool-btn">Undo Point</button>
    </div>
    <button onclick="window.ProfileEditor.cancelProfile()" class="danger" style="width: 100%; margin-top: 8px;">Cancel</button>
</div>
<div id="profile-status" style="font-size: 11px; color: #aaa; margin-top: 10px; padding: 8px; background: #2d2d30; border-radius: 4px; border: 1px solid #444; display: none;">Click on grid to add profile points</div>
<div style="margin-top: 15px; padding: 10px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">
    <h5 style="margin: 0 0 8px 0; font-size: 11px; color: #aaa;">Profile Types</h5>
    <div style="font-size: 11px; line-height: 1.5;">
        <div><strong>• Floor Profile:</strong> Creates custom floor shapes</div>
        <div><strong>• Ceiling Profile:</strong> Creates custom ceiling shapes</div>
        <div style="margin-top: 8px; color: #888;">Click points to define shape, right-click to finish</div>
    </div>
</div>`,
        'object-stack': `<h4>9. Object Stack</h4>
<div id="object-stack">
    <div class="stack-header"><div class="object-count">Total: 0 | Visible: 0 | Isolated: 0</div></div>
    <div class="stack-controls">
        <button onclick="window.ObjectStackManager.showAll()" class="tool-btn">Show All</button>
        <button onclick="window.ObjectStackManager.hideAll()" class="tool-btn">Hide All</button>
        <button onclick="window.ObjectStackManager.resetAllVisibility()" class="tool-btn">Reset</button>
    </div>
</div>
<div style="margin-top: 10px; display: flex; gap: 5px;">
    <button onclick="window.ObjectStackManager.selectPrevious()" style="flex: 1;">⬆ Prev</button>
    <button onclick="window.ObjectStackManager.selectNext()" style="flex: 1;">⬇ Next</button>
    <button onclick="window.ObjectStackManager.clearStack()" class="danger tool-btn" style="flex: 1;">Clear</button>
</div>
<div style="margin-top: 10px; padding: 8px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
        <div style="display: flex; align-items: center; gap: 4px; font-size: 10px;"><div class="visibility-indicator visible" style="width: 10px; height: 10px;"></div><span>Visible</span></div>
        <div style="display: flex; align-items: center; gap: 4px; font-size: 10px;"><div class="visibility-indicator hidden" style="width: 10px; height: 10px;"></div><span>Hidden</span></div>
        <div style="display: flex; align-items: center; gap: 4px; font-size: 10px;"><div class="visibility-indicator isolated" style="width: 10px; height: 10px;"></div><span>Isolated</span></div>
    </div>
    <div style="font-size: 10px; color: #888;">Click items to select, hover for actions</div>
</div>`,
        'steps-display': `<h4>10. Stats & History</h4>
<div id="steps-display">
    <div><strong>Total Objects:</strong> <span id="total-objects">0</span></div>
    <div><strong>Selected:</strong> <span id="selected-object">None</span></div>
    <div><strong>Last Action:</strong> <span id="last-action">-</span></div>
    <div><strong>Undo Steps:</strong> <span id="undo-count">0</span></div>
    <div><strong>Redo Steps:</strong> <span id="redo-count">0</span></div>
</div>
<div style="margin-top: 15px; padding: 10px; background: #2d2d30; border-radius: 4px; border: 1px solid #444;">
    <h5 style="margin: 0 0 8px 0; font-size: 11px; color: #aaa;">Quick Actions</h5>
    <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px;">
        <button class="tool-btn" onclick="window.HistoryManager.undo()" style="font-size: 11px;">↶ Undo</button>
        <button class="tool-btn" onclick="window.HistoryManager.redo()" style="font-size: 11px;">↷ Redo</button>
        <button class="tool-btn" onclick="window.App.generateScript()" style="font-size: 11px;">📜 Script</button>
        <button class="tool-btn" onclick="window.GridManager.toggleGrid()" style="font-size: 11px;">Grid</button>
    </div>
    <div style="font-size: 10px; color: #888;">Tracks modeling history and statistics</div>
</div>
<div style="margin-top: 15px; font-size: 11px; color: #888;">
    <strong>Status Indicators:</strong><br>
    • Green: Active/Visible<br>
    • Red: Hidden/Inactive<br>
    • Blue: Selected/Isolated
</div>`
    };

    return modulesContent[moduleId];
}

function createFallbackContent(moduleId) {
    const moduleElement = document.querySelector(`[data-module="${moduleId}"]`);
    if (!moduleElement) return;

    const fallbackContent = {
        'floor-management': `<h4>Site & Floor Management</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'asset-library': `<h4>Asset Library</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'edit-selection': `<h4>Edit Selection</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'modeling-tools': `<h4>Modeling Tools</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'finishes-layers': `<h4>Finishes & Layers</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'auto-generation': `<h4>Auto Generation</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'profile-editor': `<h4>Profile Editor</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'object-stack': `<h4>Object Stack</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'steps-display': `<h4>Steps Display</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`
    };

    moduleElement.innerHTML = fallbackContent[moduleId] || `<p>Module ${moduleId} failed to load</p>`;
}

function initializeModules() {
    console.log('Initializing UI modules...');

    initializeAssetLibrary();
    initializeEditSelection();
    initializeToolButtons();
    initializeModuleSpecificFeatures();
}

function initializeAssetLibrary() {
    const assetButtons = document.querySelectorAll('.asset-btn');
    assetButtons.forEach(btn => {
        btn.addEventListener('dragstart', (e) => {
            const blockType = e.currentTarget.dataset.type;
            e.dataTransfer.setData('text/plain', blockType);

            if (window.App && App.initAssetLibraryDrag) {
                App.initAssetLibraryDrag(blockType);
            }
        });

        btn.addEventListener('click', (e) => {
            const blockType = e.currentTarget.dataset.type;
            if (window.App && window.App.startClickPlacement) {
                window.App.startClickPlacement(blockType);
            }
        });
    });

    console.log(`✅ Initialized ${assetButtons.length} asset buttons`);
}

function initializeEditSelection() {
    const editInputs = document.querySelectorAll('#edit-selection input, #edit-selection select');
    editInputs.forEach(input => {
        const eventType = (input.tagName === 'SELECT' || input.type === 'checkbox') ? 'change' : 'input';
        input.addEventListener(eventType, () => {
            if (window.App && window.App.onLiveEdit) {
                window.App.onLiveEdit();
            }
        });
    });

    console.log(`✅ Initialized ${editInputs.length} edit inputs`);
}

function initializeToolButtons() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const parent = this.parentElement;
            if (parent && (parent.id === 'snap-point-modes' || parent.id === 'gizmo-bar' || parent.classList.contains('row'))) {
                const siblings = parent.querySelectorAll('.tool-btn');
                siblings.forEach(sib => sib.classList.remove('active-tool'));
                this.classList.add('active-tool');
            }
        });
    });

    console.log(`✅ Initialized ${toolButtons.length} tool buttons`);
}

function initializeModuleSpecificFeatures() {
    const stlImportBtn = document.querySelector('button[onclick*="stl-importer"]');
    if (stlImportBtn) {
        stlImportBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('stl-importer');
            if (fileInput) fileInput.click();
        });
    }
    console.log('✅ Initialized module-specific features');
}