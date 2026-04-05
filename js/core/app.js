import { Engine } from './engine.js';
import { BLOCK_TYPES, EVENTS } from './constants.js';
import { BlockFactory } from '../factories/block-factory.js';
import { FloorManager } from '../managers/floor-manager.js';
import { HistoryManager } from '../managers/history-manager.js';
import { StepsDisplay } from '../managers/steps-display.js';
import { GridManager } from '../managers/grid-manager.js';
import { SiteManager } from '../managers/site-manager.js';
import { ExcavationManager } from '../managers/excavation-manager.js';
import { ObjectStackManager } from '../managers/object-stack-manager.js';
import { SidebarManager } from '../ui/sidebar-manager.js';
import { PanelManager } from '../ui/panel-manager.js';
import { FinishesManager } from '../tools/finishes-manager.js';
import { AlignTool } from '../tools/align-tool.js';
import { BooleanTool } from '../tools/boolean-tool.js';
import { MeasureTool } from '../tools/measure-tool.js';
import { ProfileEditor } from '../tools/profile-editor.js';
import { PushPullTool } from '../tools/push-pull-tool.js';
import { VertexTool } from '../tools/vertex-tool.js';
import { SectionTool } from '../tools/section-tool.js';
import { SnapMoveTool } from '../tools/snap-move-tool.js';
import { MoveArrayTool } from '../tools/move-array-tool.js';
import { DrawingTool } from '../tools/drawing-tool.js';
import { WallPathTool } from '../tools/wall-path-tool.js';
import { SplineVertexTool } from '../tools/spline-vertex-tool.js';
import { BisectorTool } from '../tools/bisector-tool.js';
import { RoomTool } from '../tools/room-tool.js';
import { PlacementTool } from '../tools/placement-tool.js';
import { WallReferenceLine } from '../tools/wall-reference-line.js';
import { TrimExtendTool } from '../tools/trim-extend-tool.js';
import { ModifierSystem } from '../tools/modifier-system.js';
import { ParametricPlacementTool } from '../tools/parametric-placement-tool.js';

export const App = (() => {
    let shiftDown = false;
    let isEditingLive = false;
    let activeTool = null;

    // UI element cache
    const uiElements = {};

    function init() {
        console.log('App initializing...');

        window.selectedColumnShape = 'circular'; // Default shape


        // Initialize Engine first
        Engine.init('viewer-container');

        // Cache UI elements
        cacheUIElements();

        // Setup event listeners
        setupEventListeners();

        // Initialize components
        initComponents();

        // Generate initial script
        generateScript();

        console.log('App initialized successfully');
    }

    function cacheUIElements() {
        // Edit selection elements
        uiElements.editId = document.getElementById('e-id');
        uiElements.editFloor = document.getElementById('e-floor');
        uiElements.editMat = document.getElementById('e-mat');
        uiElements.editTx = document.getElementById('e-tx');
        uiElements.editTy = document.getElementById('e-ty');
        uiElements.editTz = document.getElementById('e-tz');
        uiElements.editRx = document.getElementById('e-rx');
        uiElements.editRy = document.getElementById('e-ry');
        uiElements.editRz = document.getElementById('e-rz');
        uiElements.editSx = document.getElementById('e-sx');
        uiElements.editSy = document.getElementById('e-sy');
        uiElements.editSz = document.getElementById('e-sz');

        // Tool buttons
        uiElements.toolSnapMove = document.getElementById('tool-snap-move');
        uiElements.toolAlign = document.getElementById('tool-align');
        uiElements.toolMeasure = document.getElementById('tool-measure');
        uiElements.toolSection = document.getElementById('tool-section');
        uiElements.toolFloorProfile = document.getElementById('tool-floor-profile');
        uiElements.toolCeilingProfile = document.getElementById('tool-ceiling-profile');
        uiElements.toolBooleanUnion = document.getElementById('tool-bool-union');
        uiElements.toolBooleanSubtract = document.getElementById('tool-bool-subtract');

        // Mode buttons
        uiElements.modeTranslate = document.getElementById('mode-translate');
        uiElements.modeRotate = document.getElementById('mode-rotate');
        uiElements.modeScale = document.getElementById('mode-scale');

        // Script elements
        uiElements.codeArea = document.getElementById('code-area');
        uiElements.scriptInput = document.getElementById('script-input');

        // Overlay
        uiElements.inputOverlay = document.getElementById('input-overlay');

        // Properties Panel
        uiElements.propsContent = document.getElementById('props-content');
        uiElements.noSelMsg = document.getElementById('no-selection-msg');
        uiElements.propThickness = document.getElementById('prop-thickness');
        uiElements.propBaseLevel = document.getElementById('prop-base-level');
        uiElements.propTopLevel = document.getElementById('prop-top-level');
        uiElements.propAlign = document.getElementById('prop-align');
        uiElements.propMaterial = document.getElementById('prop-material');
        uiElements.propHeight = document.getElementById('prop-height');
        
        uiElements.propPivotContainer = document.getElementById('prop-pivot-container');
        uiElements.propPivotX = document.getElementById('prop-pivot-x');
        uiElements.propPivotZ = document.getElementById('prop-pivot-z');

        uiElements.propGeomPoints = document.getElementById('prop-geometry-points');
        uiElements.propStartX = document.getElementById('prop-start-x');
        uiElements.propStartZ = document.getElementById('prop-start-z');
        uiElements.propEndX = document.getElementById('prop-end-x');
        uiElements.propEndZ = document.getElementById('prop-end-z');

        uiElements.propModContainer = document.getElementById('prop-modifier-container');
        uiElements.modListDynamic = document.getElementById('modifier-list-dynamic');

        uiElements.propSweepContainer = document.getElementById('prop-sweep-container');
        uiElements.propSweepRotation = document.getElementById('prop-sweep-rotation');
        uiElements.propSweepNormalX = document.getElementById('prop-sweep-normal-x');
        uiElements.propSweepNormalY = document.getElementById('prop-sweep-normal-y');
        uiElements.propSweepNormalZ = document.getElementById('prop-sweep-normal-z');
        uiElements.propSweepBaseX = document.getElementById('prop-sweep-base-x');
        uiElements.propSweepBaseY = document.getElementById('prop-sweep-base-y');
        uiElements.propSweepBaseZ = document.getElementById('prop-sweep-base-z');
    }

    function setupEventListeners() {
        // Engine events
        Engine.addEventListener('object-selected', (obj) => {
            populateUI(obj.config);
            updateObjectStackSelection(obj);
            // Show base reference line for walls and spline-walls
            const bt = obj.config?.blockType;
            if (bt === BLOCK_TYPES.WALL || bt === BLOCK_TYPES.SPLINE_WALL ||
                bt === BLOCK_TYPES.POLYLINE_WALL ||
                bt === BLOCK_TYPES.CURTAIN_WALL || bt === BLOCK_TYPES.CURVED_WALL) {
                WallReferenceLine.show(obj);
            } else {
                WallReferenceLine.hide();
            }
        });

        Engine.addEventListener('object-deselected', () => {
            clearUI();
            WallReferenceLine.hide();
        });

        Engine.addEventListener('object-added', (obj) => {
            if (obj.config.blockType === 'window-2-pane' || obj.config.blockType === 'door-detailed') {
                autoPlaceSillLintel(obj);
            }
            generateScript();
            updateStepsDisplay();
        });

        Engine.addEventListener('object-removed', () => {
            generateScript();
            updateStepsDisplay();
        });

        Engine.addEventListener('tool-changed', ({ mode }) => {
            updateToolUI(mode);
        });

        // --- FIX STARTS HERE ---
        // Listen for the engine's placement events to create the final object.

        // Handles click-to-place workflow
        Engine.addEventListener('placement-click', ({ point, event }) => {
            if (Engine.getSelection()) Engine.deselectObject();
            const config = Engine.getPlacementConfig();
            if (config) {
                // If PlacementTool is active, send point to it
                if (activeTool === '2point-placement') {
                    const tool = Engine.getTool('placement');
                    const intersects = event ? Engine.getMouseIntersects(event) : { meshes: [] };
                    const wall = intersects.meshes.find(o => 
                        o.object?.userData?.config?.blockType === 'wall' || 
                        o.object?.userData?.config?.blockType === 'spline-wall' ||
                        o.object?.userData?.config?.blockType === 'polyline-wall' ||
                        o.object?.userData?.config?.blockType === 'path-wall'
                    );
                    if (tool) tool.onPointSelection(point, wall ? wall.object.userData : null);
                } else {
                    createBlock(config.blockType, point);
                }
            }
        });

        // Handles drag-and-drop workflow
        Engine.addEventListener('drop-placement', ({ blockType, position }) => {
            if (Engine.getSelection()) Engine.deselectObject();
            createBlock(blockType, position);
        });
        // --- FIX ENDS HERE ---

        // Keyboard events
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    }

    function initComponents() {
        // Initialize core managers
        GridManager.init();
        HistoryManager.init();
        SiteManager.init();
        FloorManager.init();
        ExcavationManager.init();
        ObjectStackManager.init();
        SidebarManager.init();
        PanelManager.init();
        StepsDisplay.init();
        window.StepsDisplay = StepsDisplay;
        FinishesManager.init();

        // Initialize tools and register with Engine. Engine.registerTool calls tool.init(this) internally.
        Engine.registerTool('align', AlignTool);
        Engine.registerTool('boolean', BooleanTool);
        Engine.registerTool('measure', MeasureTool);
        Engine.registerTool('profile', ProfileEditor);
        Engine.registerTool('section', SectionTool);
        Engine.registerTool('snap-move', SnapMoveTool);
        Engine.registerTool('move-array', MoveArrayTool);
        Engine.registerTool('push-pull', PushPullTool);
        Engine.registerTool('vertex', VertexTool);
        Engine.registerTool('drawing', DrawingTool);
        Engine.registerTool('wall-path', WallPathTool);
        Engine.registerTool('spline-vertex', SplineVertexTool);
        Engine.registerTool('bisector', BisectorTool);
        Engine.registerTool('room', RoomTool);
        Engine.registerTool('placement', PlacementTool);

        // Expose new tools globally so HTML onclick can reach them
        window.WallReferenceLine = WallReferenceLine;
        window.BisectorTool = BisectorTool;
        window.TrimExtendTool = TrimExtendTool;
        window.ModifierSystem = ModifierSystem;
        window.ParametricPlacementTool = ParametricPlacementTool;

        // Global helper for the "Add Modifier" button in the properties panel
        window.addModifierToSelected = function() {
            const sel = Engine.getSelection();
            if (!sel) return;
            const type = document.getElementById('mod-type-select')?.value || 'offset';
            const descriptor = type === 'offset'
                ? { type: 'offset', distance: 0.3, side: 'right' }
                : { type: 'sweep', profilePoints: [] };
            ModifierSystem.addModifier(sel, descriptor);
            // Refresh modifier list in UI
            populateUI(sel.config);
        };

        // Setup asset library drag and drop
        initAssetLibrary();

        // Setup STL import
        initSTLImport();
    }

    function initAssetLibrary() {
        const assetButtons = document.querySelectorAll('.asset-btn');
        assetButtons.forEach(btn => {
            btn.addEventListener('dragstart', (e) => {
                const blockType = e.currentTarget.dataset.type; // Use currentTarget for safety
                e.dataTransfer.setData('text/plain', blockType);

                const floor = FloorManager.getCurrentFloorData();
                const floorHeight = floor ? floor.ffl : 0;

                Engine.enterPlacementMode({
                    type: 'block',
                    blockType: blockType,
                    mat: 'concrete',
                    pos: { x: 0, y: floorHeight, z: 0 },
                    rot: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    params: (blockType === 'column' && window.selectedColumnShape) ? { shape: window.selectedColumnShape } : {}
                });

                // Create preview
                let previewAsset = BlockFactory.create(blockType, (blockType === 'column' && window.selectedColumnShape) ? { shape: window.selectedColumnShape } : {});
                if (previewAsset) {
                    let previewMesh;
                    if (previewAsset.isBufferGeometry) {
                        const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.6 });
                        previewMesh = new THREE.Mesh(previewAsset, material);
                    } else {
                        previewMesh = previewAsset;
                        previewMesh.traverse(child => {
                            if (child.isMesh) {
                                child.material = child.material.clone();
                                child.material.transparent = true;
                                child.material.opacity = 0.6;
                            }
                        });
                    }
                    Engine.setPlacementPreview(previewMesh);
                }
            });

            // Add Click listener for click-to-place
            btn.addEventListener('click', (e) => {
                const blockType = e.currentTarget.dataset.type;
                startClickPlacement(blockType);
            });
        });
    }

    function initSTLImport() {
        const stlImporter = document.getElementById('stl-importer');
        if (stlImporter) {
            stlImporter.addEventListener('change', importSTL);
        }
    }

    // UI Management
    function populateUI(config) {
        if (!config) return;

        isEditingLive = true;

        const sel = Engine.getSelection();

        // Set values
        if (uiElements.editId) uiElements.editId.value = sel?.id || '';
        if (uiElements.editFloor) uiElements.editFloor.value = config.floor || '';
        if (uiElements.editMat) uiElements.editMat.value = config.mat || 'concrete';

        if (uiElements.editTx) uiElements.editTx.value = config.pos.x.toFixed(2);
        if (uiElements.editTy) uiElements.editTy.value = config.pos.y.toFixed(2);
        if (uiElements.editTz) uiElements.editTz.value = config.pos.z.toFixed(2);

        if (uiElements.editRx) uiElements.editRx.value = THREE.MathUtils.radToDeg(config.rot.x).toFixed(0);
        if (uiElements.editRy) uiElements.editRy.value = THREE.MathUtils.radToDeg(config.rot.y).toFixed(0);
        if (uiElements.editRz) uiElements.editRz.value = THREE.MathUtils.radToDeg(config.rot.z).toFixed(0);

        if (uiElements.editSx) uiElements.editSx.value = config.scale.x.toFixed(2);
        if (uiElements.editSy) uiElements.editSy.value = config.scale.y.toFixed(2);
        if (uiElements.editSz) uiElements.editSz.value = config.scale.z.toFixed(2);

        // Update Properties Panel
        if (uiElements.propsContent && uiElements.noSelMsg) {
            uiElements.propsContent.style.display = 'block';
            uiElements.noSelMsg.style.display = 'none';

            if (uiElements.propThickness) uiElements.propThickness.value = config.params?.t || 0.2;
            if (uiElements.propHeight) uiElements.propHeight.value = config.params?.h || 3.0;
            if (uiElements.propBaseLevel) uiElements.propBaseLevel.value = config.params?.base || 0;
            if (uiElements.propTopLevel) uiElements.propTopLevel.value = config.params?.top || 3.2;
            if (uiElements.propAlign) uiElements.propAlign.value = config.params?.align || 'mid';
            if (uiElements.propMaterial) uiElements.propMaterial.value = config.mat || 'concrete';
            
            const sweepBtn = document.getElementById('prop-edit-sweep');
            if (sweepBtn) {
                sweepBtn.style.display = (config.blockType === 'spline-wall' || config.blockType === 'polyline-wall') ? 'block' : 'none';
            }

            // Refresh modifier list
            const modList = document.getElementById('modifier-list');
            if (modList) {
                const mods = config.params?.modifiers || sel?.config?.modifiers || [];
                if (mods.length === 0) {
                    modList.textContent = 'No modifiers';
                } else {
                    modList.innerHTML = mods.map((m, i) =>
                        `<div style="display:flex;justify-content:space-between;padding:2px 0;">
                            <span>${m.type}${m.distance !== undefined ? ' ' + m.distance + 'm' : ''}</span>
                            <button class="tool-btn" style="padding:1px 6px;font-size:10px;" onclick="window.ModifierSystem.removeModifier(Engine.getSelection(),${i})">✕</button>
                        </div>`
                    ).join('');
                }
            }

            // Pivot Point (Center of object) logic for Line, Spline, Circle, Arc
            const bt = config.blockType;
            if (bt === 'shape' || bt === 'spline-wall' || bt === 'polyline-wall' || bt === 'sweep-path' ||
                bt === 'line' || bt === 'polyline' || bt === 'arc' || bt === 'circle' ||
                bt === 'line-arc' || bt === 'line-circle' || bt === 'line-rectangle') {
                if (uiElements.propPivotContainer) uiElements.propPivotContainer.style.display = 'block';
                
                // Calculate center from bounding box if possible, or average of points
                let center = new THREE.Vector3();
                if (sel && sel.mesh) {
                    const box = new THREE.Box3().setFromObject(sel.mesh);
                    box.getCenter(center);
                } else if (config.params?.points) {
                    const pts = config.params.points;
                    pts.forEach(p => { center.x += p.x; center.z += p.z; });
                    center.x /= pts.length;
                    center.z /= pts.length;
                }
            } else {
                if (uiElements.propModContainer) uiElements.propModContainer.style.display = 'none';
                if (uiElements.propSweepContainer) uiElements.propSweepContainer.style.display = 'none';
            }

            // Show sweep controls for sweep-path and all path-based walls
            if (uiElements.propSweepContainer) {
                const isSweep = bt === 'sweep-path' || bt === 'spline-wall' || bt === 'polyline-wall' || bt === BLOCK_TYPES.SWEEP_PATH;
                uiElements.propSweepContainer.style.display = isSweep ? 'block' : 'none';
                if (isSweep) {
                    const params = config.params || {};
                    if (uiElements.propSweepRotation) uiElements.propSweepRotation.value = params.rotation || 0;
                    if (uiElements.propSweepNormalX) uiElements.propSweepNormalX.value = params.normal?.x ?? 0;
                    if (uiElements.propSweepNormalY) uiElements.propSweepNormalY.value = params.normal?.y ?? 1;
                    if (uiElements.propSweepNormalZ) uiElements.propSweepNormalZ.value = params.normal?.z ?? 0;
                    if (uiElements.propSweepBaseX) uiElements.propSweepBaseX.value = params.basePoint?.x ?? 0;
                    if (uiElements.propSweepBaseY) uiElements.propSweepBaseY.value = params.basePoint?.y ?? 0;
                    if (uiElements.propSweepBaseZ) uiElements.propSweepBaseZ.value = params.basePoint?.z ?? 0;
                }
            }
        }
        // Update finishes UI if available
        if (window.FinishesManager && window.FinishesManager.updateFinishUI) {
            window.FinishesManager.updateFinishUI();
        }

        isEditingLive = false;
    }

    function updateSweepNormal(axis, value) {
        const sel = Engine.getSelection();
        if (!sel || isNaN(value)) return;
        sel.config.params.normal = sel.config.params.normal || { x: 0, y: 1, z: 0 };
        sel.config.params.normal[axis] = value;
        rebuildObject(sel);
        HistoryManager.save();
    }

    function updateSweepBase(axis, value) {
        const sel = Engine.getSelection();
        if (!sel || isNaN(value)) return;
        sel.config.params.basePoint = sel.config.params.basePoint || { x: 0, y: 0, z: 0 };
        sel.config.params.basePoint[axis] = value;
        rebuildObject(sel);
        HistoryManager.save();
    }

    function clearUI() {
        isEditingLive = true;

        // Clear all edit fields
        Object.values(uiElements).forEach(el => {
            if (el && el.tagName === 'INPUT' && el.type !== 'button' && el.type !== 'submit') {
                el.value = '';
            } else if (el && el.tagName === 'SELECT') {
                el.selectedIndex = 0;
            }
        });

        // Reset specific fields
        if (uiElements.editMat) uiElements.editMat.value = 'concrete';
        if (uiElements.editTx) uiElements.editTx.value = '0';
        if (uiElements.editTy) uiElements.editTy.value = '0';
        if (uiElements.editTz) uiElements.editTz.value = '0';
        if (uiElements.editRx) uiElements.editRx.value = '0';
        if (uiElements.editRy) uiElements.editRy.value = '0';
        if (uiElements.editRz) uiElements.editRz.value = '0';
        if (uiElements.editSx) uiElements.editSx.value = '1';
        if (uiElements.editSy) uiElements.editSy.value = '1';
        if (uiElements.editSz) uiElements.editSz.value = '1';

        // Reset Properties Panel
        if (uiElements.propsContent && uiElements.noSelMsg) {
            uiElements.propsContent.style.display = 'none';
            uiElements.noSelMsg.style.display = 'block';
            
            const sweepBtn = document.getElementById('prop-edit-sweep');
            if (sweepBtn) sweepBtn.style.display = 'none';
        }

        // Clear pivot UI
        if (uiElements.propPivotContainer) uiElements.propPivotContainer.style.display = 'none';

        // Hide finishes UI
        const finishControls = document.getElementById('finish-controls');
        if (finishControls) finishControls.style.display = 'none';

        isEditingLive = false;
    }

    function updateToolUI(mode) {
        // Update gizmo bar
        if (uiElements.modeTranslate) uiElements.modeTranslate.classList.remove('active-tool');
        if (uiElements.modeRotate) uiElements.modeRotate.classList.remove('active-tool');
        if (uiElements.modeScale) uiElements.modeScale.classList.remove('active-tool');

        switch (mode) {
            case 'selection':
            case 'translate':
                if (uiElements.modeTranslate) uiElements.modeTranslate.classList.add('active-tool');
                break;
            case 'rotate':
                if (uiElements.modeRotate) uiElements.modeRotate.classList.add('active-tool');
                break;
            case 'scale':
                if (uiElements.modeScale) uiElements.modeScale.classList.add('active-tool');
                break;
        }

        // Update tool buttons
        /*  const toolButtons = [
             'snap-move', 'align', 'measure', 'section',
             'floor-profile', 'ceiling-profile', 'bool-union', 'bool-subtract'
         ];
         
         toolButtons.forEach(tool => {
             const btn = document.getElementById(`tool-${tool}`); */
        // Update tool buttons
        const toolButtons = [
            'tool-snap-move', 'tool-align', 'tool-measure', 'tool-section',
            'tool-floor-profile', 'tool-ceiling-profile', 'tool-bool-union', 'tool-bool-subtract',
            'tool-smart-move', 'tool-radial-array', 'tool-push-pull', 'tool-vertex',
            'tool-draw-line', 'tool-draw-rectangle', 'tool-draw-circle', 'tool-draw-polygon', 'tool-draw-arc', 'tool-draw-polyline',
            'tool-wall-path'
        ];

        toolButtons.forEach(toolId => {
            const btn = document.getElementById(toolId);

            if (btn) btn.classList.remove('active-tool');
        });

        if (activeTool) {
            let btnId = `tool-${activeTool}`;
            // Map generic move-array to specific buttons if possible. 
            // Since activeTool doesn't distinguish mode, we might just highlight 'Smart Move' by default
            // or we need app.js to track 'move-array' state.
            // For now, let's map 'move-array' to 'tool-smart-move' as primary.
            if (activeTool === 'move-array') btnId = 'tool-smart-move';

            // Map draw-* to their specific button IDs
            if (activeTool.startsWith('draw-')) {
                btnId = `tool-${activeTool}`;
            }

            const btn = document.getElementById(btnId);
            if (btn) btn.classList.add('active-tool');
        }
    }

    // Object Creation
    function createBlock(type, position) {
        // Save history state
        HistoryManager.save(Engine.getObjects());

        // Get current floor level
        const currentFloor = FloorManager.getCurrentFloorData();
        const floorHeight = currentFloor ? currentFloor.ffl : 0;

        // Create config
        const config = {
            floor: currentFloor ? currentFloor.name : 'Ground Floor',
            mat: 'concrete',
            type: 'block',
            blockType: type,
            pos: { x: position.x, y: position.y, z: position.z },
            rot: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            params: (type === 'column' && window.selectedColumnShape) ? { shape: window.selectedColumnShape } : {}
        };

        // Adjust position based on object type
        const asset = BlockFactory.create(type, config.params);

        if (asset) {
            // Calculate appropriate Y position
            let yPosition = position.y;

            if (asset instanceof THREE.BufferGeometry) {
                asset.computeBoundingBox();
                const size = new THREE.Vector3();
                asset.boundingBox.getSize(size);
                yPosition = floorHeight + size.y / 2;
            } else if (asset instanceof THREE.Group) {
                // For groups, position at floor level
                yPosition = floorHeight;
            }

            config.pos.y = yPosition;

            // Add object to engine
            const obj = Engine.addObject(config, asset);

            // If geometry was centered, shift the mesh to maintain original position
            if (asset.userData && asset.userData.centerOffset) {
                const offset = asset.userData.centerOffset;
                obj.mesh.position.add(offset);
                Engine.syncConfigFromTransform(obj);
            }

            // Force update isolation if active
            if (FloorManager.getIsolationMode() !== 'none') {
                FloorManager.applyIsolation();
            }

            // Add to object stack
            if (window.ObjectStackManager) {
                window.ObjectStackManager.addToStack(obj);
            }

            generateScript();
            StepsDisplay.recordAction(`Created ${type} on ${config.floor}`);

            return obj;
        }

        return null;
    }

    function autoPlaceSillLintel(openingObj) {
        const config = openingObj.config;
        const pos = config.pos;
        const rot = config.rot;
        const scale = config.scale;
        
        // Use default params or current config params
        const params = config.params || {};
        const width = params.w || (config.blockType === 'window-2-pane' ? 2 : 1);
        const height = params.h || (config.blockType === 'window-2-pane' ? 1.5 : 2.2);
        const thickness = params.d || 0.2;

        const currentFloor = FloorManager.getCurrentFloorData();

        // Place Lintel (above)
        const lintelHeight = 0.2;
        const lintelConfig = {
            floor: config.floor,
            mat: config.mat,
            type: 'block',
            blockType: 'lintel',
            pos: { 
                x: pos.x, 
                y: pos.y + (height / 2) + (lintelHeight / 2), 
                z: pos.z 
            },
            rot: { ...rot },
            scale: { ...scale },
            params: { w: width, h: lintelHeight, t: thickness }
        };
        
        const lintelAsset = BlockFactory.create('lintel', lintelConfig.params);
        if (lintelAsset) Engine.addObject(lintelConfig, lintelAsset);

        // Place Sill (below) - only for windows
        if (config.blockType === 'window-2-pane') {
            const sillHeight = 0.1;
            const sillConfig = {
                floor: config.floor,
                mat: config.mat,
                type: 'block',
                blockType: 'sill',
                pos: { 
                    x: pos.x, 
                    y: pos.y - (height / 2) - (sillHeight / 2), 
                    z: pos.z 
                },
                rot: { ...rot },
                scale: { ...scale },
                params: { w: width, h: sillHeight, t: thickness }
            };
            
            const sillAsset = BlockFactory.create('sill', sillConfig.params);
            if (sillAsset) Engine.addObject(sillConfig, sillAsset);
        }
        
        StepsDisplay.recordAction(`Auto-placed sill/lintel for ${config.blockType}`);
    }

    function startClickPlacement(blockType) {
        const currentFloor = FloorManager.getCurrentFloorData();
        const floorHeight = currentFloor ? currentFloor.ffl : 0;

        Engine.enterPlacementMode({
            type: 'block',
            blockType: blockType,
            mat: 'concrete',
            pos: { x: 0, y: floorHeight, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            params: (blockType === 'column' && window.selectedColumnShape) ? { shape: window.selectedColumnShape } : {}
        });

        // Create preview
        let previewAsset = BlockFactory.create(blockType, {});
        if (previewAsset) {
            let previewMesh;
            // If the factory returns a geometry, create a mesh for the preview
            if (previewAsset.isBufferGeometry) {
                const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.6 });
                previewMesh = new THREE.Mesh(previewAsset, material);
            } else { // Otherwise, it's a Group or Mesh, so we can traverse it
                previewMesh = previewAsset;
                previewMesh.traverse(child => {
                    if (child.isMesh) {
                        child.material = child.material.clone(); // Clone to avoid changing original
                        child.material.transparent = true;
                        child.material.opacity = 0.6;
                    }
                });
            }
            Engine.setPlacementPreview(previewMesh);
        }

        showInputOverlay(`Click on grid to place ${blockType} on ${currentFloor ? currentFloor.name : 'current floor'}.`);
    }

    // Tools
    function setMode(mode) {
        Engine.setMode(mode);
    }

    function startSnapMove() {
        if (activeTool === 'smart-move') {
            cancelActiveTool();
            return;
        }

        activeTool = 'smart-move';

        // Get move array tool from engine
        const tool = Engine.getTool('move-array');
        if (tool) {
            tool.start('move');
        }

        updateToolUI();
    }

    function startRadialArray() {
        if (activeTool === 'radial-array') {
            const tool = Engine.getTool('move-array');
            tool.start('radial');
            return;
        }

        activeTool = 'radial-array';
        const tool = Engine.getTool('move-array');
        if (tool) tool.start('radial');

        updateToolUI();
    }

    function startMeasureTool() {
        if (activeTool === 'measure') {
            cancelActiveTool();
        } else {
            activeTool = 'measure';
            const measureTool = Engine.getTool('measure');
            if (measureTool) measureTool.start();
            showInputOverlay('Click first point to measure...');
            updateToolUI();
        }
    }

    function toggleSectionPlane() {
        if (activeTool === 'section') {
            cancelActiveTool();
        } else {
            activeTool = 'section';
            const sectionTool = Engine.getTool('section');
            if (sectionTool) sectionTool.start();
            showInputOverlay('Section Plane Active: Move/Rotate with gizmo.');
            updateToolUI();
        }
    }

    function startAlignTool() {
        const sel = Engine.getSelection();
        if (!sel) {
            alert('Select an object to align first.');
            return;
        }

        if (activeTool === 'align') {
            cancelActiveTool();
            return;
        }

        activeTool = 'align';
        const alignTool = Engine.getTool('align');
        if (alignTool) alignTool.start(sel);
        showInputOverlay('Click the TARGET object to align to.');
        updateToolUI();
    }

    function performAlign(axis, type) {
        const alignTool = Engine.getTool('align');
        if (alignTool) alignTool.performAlign(axis, type);
    }

    function startFloorProfile() {
        if (activeTool === 'floor-profile') {
            cancelActiveTool();
            return;
        }

        activeTool = 'floor-profile';
        const profileEditor = Engine.getTool('profile');
        if (profileEditor) profileEditor.startProfile('floor');
        updateToolUI();
    }

    function startCeilingProfile() {
        if (activeTool === 'ceiling-profile') {
            cancelActiveTool();
            return;
        }

        activeTool = 'ceiling-profile';
        const profileEditor = Engine.getTool('profile');
        if (profileEditor) profileEditor.startProfile('ceiling');
        updateToolUI();
    }

    function startPushPull() {
        // No selection required for push pull, it hovers
        if (activeTool === 'push-pull') {
            cancelActiveTool();
            return;
        }

        activeTool = 'push-pull';

        // Deselect any currently selected object to prevent default green highlight
        Engine.deselectAll();

        const tool = Engine.getTool('push-pull');
        if (tool) tool.start();
        showInputOverlay('Push/Pull: Hover face, Drag to resize');
        updateToolUI();
    }

    function startBoolean(type) {
        const sel = Engine.getSelection();
        if (!sel) {
            alert('Select an object first.');
            return;
        }

        if (activeTool === `bool-${type}`) {
            cancelActiveTool();
            return;
        }

        activeTool = `bool-${type}`;
        const booleanTool = Engine.getTool('boolean');
        if (booleanTool) booleanTool.start(type, sel);
        showInputOverlay(`Click object to ${type === 'union' ? 'merge with' : 'subtract from'} selected object.`);
        updateToolUI();
    }

    function startDrawing(type) {
        if (activeTool === `draw-${type}`) {
            cancelActiveTool();
            return;
        }

        activeTool = `draw-${type}`;
        const drawingTool = Engine.getTool('drawing');
        if (drawingTool) drawingTool.startDrawing(type);
        
        // Handle path wall specifically
        if (type === 'path-wall') {
            const wallTool = Engine.getTool('wall-path');
            if (wallTool) wallTool.start();
        }

        const hints = {
            'line': 'Click two points to draw a line.',
            'rectangle': 'Click two points to draw a rectangle.',
            'circle': 'Click center and a point on circumference.',
            'polygon': 'Click center and a point for radius.',
            'arc': 'Click three points to draw an arc.',
            'polyline': 'Click points to draw. Right-click to finish.'
        };

        showInputOverlay(hints[type] || `Drawing ${type}...`);
        updateToolUI();
    }

    function cancelActiveTool() {
        Engine.exitAllModes();
        activeTool = null;

        // Exit specific tools
        const tools = ['snap-move', 'measure', 'align', 'section', 'profile', 'boolean', 'move-array', 'push-pull'];
        tools.forEach(toolName => {
            const tool = Engine.getTool(toolName);
            if (tool && tool.exit) tool.exit();
        });

        // Hide align panel
        const alignPanel = document.getElementById('align-panel');
        if (alignPanel) alignPanel.style.display = 'none';

        // Hide input overlay
        hideInputOverlay();

        // Update UI
        updateToolUI();

        // Restore selection UI if there's a selection
        const sel = Engine.getSelection();
        if (sel) {
            populateUI(sel.config);
        } else {
            clearUI();
        }
    }

    // UI Actions
    function onLiveEdit() {
        if (isEditingLive) return;

        const sel = Engine.getSelection();
        if (!sel) return;

        // Update config from UI
        sel.config.floor = uiElements.editFloor ? uiElements.editFloor.value : '';
        sel.config.mat = uiElements.editMat ? uiElements.editMat.value : 'concrete';

        // Update material
        const materials = Engine.getMaterials();
        const newMaterial = materials[sel.config.mat] ? materials[sel.config.mat].clone() : materials.concrete.clone();

        sel.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                // Preserve custom properties if any
                if (child.userData.originalMaterial) {
                    child.userData.originalMaterial = newMaterial;
                }
                child.material = newMaterial;
            }
        });

        // Update transform
        if (uiElements.editTx && uiElements.editTy && uiElements.editTz) {
            sel.mesh.position.set(
                parseFloat(uiElements.editTx.value) || 0,
                parseFloat(uiElements.editTy.value) || 0,
                parseFloat(uiElements.editTz.value) || 0
            );
        }

        if (uiElements.editRx && uiElements.editRy && uiElements.editRz) {
            sel.mesh.rotation.set(
                THREE.MathUtils.degToRad(parseFloat(uiElements.editRx.value) || 0),
                THREE.MathUtils.degToRad(parseFloat(uiElements.editRy.value) || 0),
                THREE.MathUtils.degToRad(parseFloat(uiElements.editRz.value) || 0)
            );
        }

        if (uiElements.editSx && uiElements.editSy && uiElements.editSz) {
            sel.mesh.scale.set(
                parseFloat(uiElements.editSx.value) || 1,
                parseFloat(uiElements.editSy.value) || 1,
                parseFloat(uiElements.editSz.value) || 1
            );
        }

        // Update config
        Engine.syncConfigFromTransform(sel);

        // Save to history
        HistoryManager.save(Engine.getObjects());

        // Update script
        generateScript();
    }

    function deleteSelected() {
        const sel = Engine.getSelection();
        if (!sel) return;

        HistoryManager.save(Engine.getObjects());
        Engine.removeObject(sel);
        clearUI();
        generateScript();
    }

    function startVertexEdit() {
        Engine.exitAllModes();
        const sel = Engine.getSelection();
        if (sel) {
            const bt = sel.config.blockType;
            if (bt === 'spline-wall' || bt === 'polyline-wall' || bt === 'sweep-path' || bt === 'path-wall' ||
                bt === 'shape' || bt === 'line' || bt === 'polyline' || bt === 'rectangle' || bt === 'polygon' || bt === 'arc' || bt === 'circle') {
                const tool = Engine.getTool('spline-vertex');
                if (tool) {
                    tool.start();
                    updateToolUI('tool-vertex');
                    StepsDisplay.recordAction('Started Spline/Shape Vertex Edit');
                }
                return;
            }
        }
        
        const tool = Engine.getTool('vertex');
        if (tool) {
            tool.start();
            updateToolUI('tool-vertex');
            StepsDisplay.recordAction('Started Vertex Edit');
        }
    }

    function updateVertex(vId, axis, value) {
        const tool = Engine.getTool('vertex');
        if (tool && tool.updateVertex) {
            tool.updateVertex(vId, axis, value);
        }
    }

    function vertexSelectAll() {
        const tool = Engine.getTool('vertex');
        if (tool && tool.selectAll) tool.selectAll();
    }

    function vertexClearSelection() {
        const tool = Engine.getTool('vertex');
        if (tool && tool.clearSelection) tool.clearSelection();
    }

    function toggleVertexSelection(id) {
        const tool = Engine.getTool('vertex');
        if (tool && tool.toggleSelection) tool.toggleSelection(id);
    }

    function copySelected() {
        const sel = Engine.getSelection();
        if (!sel) {
            alert("Select an object to copy.");
            return;
        }

        // 1. Sync current mesh transformations to config first!
        Engine.syncConfigFromTransform(sel);

        // 2. Save history before adding new object
        HistoryManager.save(Engine.getObjects());

        // 3. Deep clone config
        const cfg = JSON.parse(JSON.stringify(sel.config));
        cfg.id = Date.now() % 1000000; // Unique ID

        // 4. Offset slightly so user can see it (0.5m instead of 1.0m)
        cfg.pos.x += 0.5;
        cfg.pos.z += 0.5;

        // 5. Create new object
        const asset = BlockFactory.create(cfg.blockType, cfg.params);
        if (asset) {
            const newObj = Engine.addObject(cfg, asset);

            // 6. Select the NEW object immediately
            Engine.selectObject(newObj);

            generateScript();
            StepsDisplay.recordAction(`Copied ${cfg.blockType}`);
        }
    }

    function toggleSnap() {
        const btn = document.getElementById('btn-snap');
        if (!btn) return;

        const enabled = !btn.classList.contains('active-tool');
        btn.classList.toggle('active-tool', enabled);
        btn.innerText = `Grid Snap: ${enabled ? 'On' : 'Off'}`;

        // Update grid snap value
        // This would be implemented in GridManager
        if (window.GridManager) {
            window.GridManager.setSnapEnabled(enabled);
        }
    }

    function setSnapPointType(type) {
        const buttons = document.querySelectorAll('#snap-point-modes button');
        buttons.forEach(b => b.classList.remove('active-tool'));

        const targetBtn = document.getElementById(`snap-mode-${type}`);
        if (targetBtn) targetBtn.classList.add('active-tool');

        // Update snap move tool if active
        const snapMoveTool = Engine.getTool('snap-move');
        if (snapMoveTool && snapMoveTool.setSnapType) {
            snapMoveTool.setSnapType(type);
        }
    }

    function toggleAutoFloor() {
        const btn = document.getElementById('auto-floor-toggle');
        if (!btn) return;

        const enabled = !btn.classList.contains('active-tool');
        btn.classList.toggle('active-tool', enabled);
        btn.innerText = `Auto Floor: ${enabled ? 'On' : 'Off'}`;

        // This would be implemented in AutoGenerationManager
        StepsDisplay.recordAction(`Auto Floor ${enabled ? 'enabled' : 'disabled'}`);
    }

    function toggleAutoRoof() {
        const btn = document.getElementById('auto-roof-toggle');
        if (!btn) return;

        const enabled = !btn.classList.contains('active-tool');
        btn.classList.toggle('active-tool', enabled);
        btn.innerText = `Auto Roof: ${enabled ? 'On' : 'Off'}`;

        // This would be implemented in AutoGenerationManager
        StepsDisplay.recordAction(`Auto Roof ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Script Generation
    function generateScript() {
        const objects = Engine.getObjects();
        let script = "// Generated BIM Script\n";
        script += "// Generated: " + new Date().toLocaleString() + "\n\n";
        script += "const blocks = [\n";

        objects.forEach((obj, i) => {
            const cfg = obj.config;
            script += `  {\n`;
            script += `    id: ${cfg.id || i},\n`;
            script += `    type: "${cfg.blockType}",\n`;
            script += `    material: "${cfg.mat}",\n`;
            script += `    floor: "${cfg.floor || 'Unknown'}",\n`;
            script += `    position: { x: ${cfg.pos.x.toFixed(2)}, y: ${cfg.pos.y.toFixed(2)}, z: ${cfg.pos.z.toFixed(2)} },\n`;
            script += `    rotation: { x: ${THREE.MathUtils.radToDeg(cfg.rot.x).toFixed(1)}, y: ${THREE.MathUtils.radToDeg(cfg.rot.y).toFixed(1)}, z: ${THREE.MathUtils.radToDeg(cfg.rot.z).toFixed(1)} },\n`;
            script += `    scale: { x: ${cfg.scale.x.toFixed(2)}, y: ${cfg.scale.y.toFixed(2)}, z: ${cfg.scale.z.toFixed(2)} }`;

            if (cfg.params && Object.keys(cfg.params).length > 0) {
                script += `,\n    params: ${JSON.stringify(cfg.params, null, 4).replace(/\n/g, '\n    ')}`;
            }

            script += `\n  }${i < objects.length - 1 ? ',' : ''}\n`;
        });

        script += "];\n\n";
        script += "// Total objects: " + objects.length + "\n";

        if (uiElements.codeArea) {
            uiElements.codeArea.value = script;
        }
    }

    // Parametric Utilities
    function setColumnShape(shape) {
        window.selectedColumnShape = shape;

        // Update UI
        const buttons = document.querySelectorAll('#column-type-panel .tool-btn');
        buttons.forEach(b => b.classList.remove('active-tool'));

        const targetBtn = document.getElementById(`col-shape-${shape}`);
        if (targetBtn) targetBtn.classList.add('active-tool');

        // If a column is selected, update it immediately
        const sel = Engine.getSelection();
        if (sel && sel.config.blockType === 'column') {
            sel.config.params.shape = shape;
            rebuildObject(sel);
        }
    }

    function rebuildObject(obj) {
        if (!obj || !obj.mesh || !obj.config) return;

        const config = obj.config;
        const oldMesh = obj.mesh;

        // Apply modifier stack non-destructively to get effective params
        const effectiveParams = ModifierSystem.applyModifiers(config);

        // Create new geometry from effective params
        const newGeometry = BlockFactory.create(config.blockType, effectiveParams);
        if (!newGeometry) return;

        // Update mesh geometry
        if (oldMesh.geometry) oldMesh.geometry.dispose();

        if (newGeometry instanceof THREE.Group) {
            Engine.removeObject(obj);
            Engine.addObject(config, newGeometry);
        } else {
            oldMesh.geometry = newGeometry;
            oldMesh.scale.set(1, 1, 1);
            config.scale = { x: 1, y: 1, z: 1 };
            
            // For shapes, polylines, and lines: recalculate center from points
            if ((config.blockType === 'shape' || config.blockType === 'polyline' || config.blockType === 'line') && 
                config.params && config.params.points) {
                // Recalculate center from actual points
                let centerX = 0, centerZ = 0;
                const points = config.params.points;
                points.forEach(p => {
                    centerX += p.x;
                    centerZ += (p.z !== undefined ? p.z : p.y); // Handle both {x,z} and {x,y} formats
                });
                centerX /= points.length;
                centerZ /= points.length;
                
                // Update mesh position to new center
                const ffl = config.pos.y; // Keep original floor level
                oldMesh.position.set(centerX, ffl, centerZ);
                config.pos = { x: centerX, y: ffl, z: centerZ };
            } else if (newGeometry.userData && newGeometry.userData.centerOffset) {
                // For other geometries that were centered, shift the mesh to maintain original position
                const offset = newGeometry.userData.centerOffset;
                oldMesh.position.add(offset);
                Engine.syncConfigFromTransform(obj);
            }
        }

        // Re-align parametric children (doors/windows placed on this wall)
        if (window.ParametricPlacementTool) window.ParametricPlacementTool.realignChildren(obj);

        // Refresh base reference line if this object is selected
        const sel = Engine.getSelection();
        if (sel && sel === obj && window.WallReferenceLine) WallReferenceLine.show(obj);

        generateScript();
    }

    function updateProperty(key, value) {
        const sel = Engine.getSelection();
        if (!sel) return;

        HistoryManager.save(Engine.getObjects());

        if (key === 'mat') {
            sel.config.mat = value;
            const materials = Engine.getMaterials();
            const newMaterial = materials[value] ? materials[value].clone() : materials.concrete.clone();
            sel.mesh.traverse(child => {
                if (child.isMesh) child.material = newMaterial;
            });
        } else {
            if (!sel.config.params) sel.config.params = {};
            sel.config.params[key] = value;
            rebuildObject(sel);
        }

        generateScript();
        StepsDisplay.recordAction(`Updated ${key} for ${sel.config.blockType}`);
    }

    function updatePivot(axis, value) {
        const sel = Engine.getSelection();
        if (!sel || isNaN(value)) return;

        // Moving by updating the base position 'pos' while keeping geometry relative
        // For shapes with pos={0,0,0}, we need to shift all points or just update pos.
        // If we update pos, the whole mesh translates.
        
        // Calculate current center
        let currentCenter = new THREE.Vector3();
        const box = new THREE.Box3().setFromObject(sel.mesh);
        box.getCenter(currentCenter);
        
        const delta = value - currentCenter[axis];
        sel.config.pos[axis] += delta;
        sel.mesh.position[axis] += delta;
        
        Engine.syncConfigFromTransform(sel);
        HistoryManager.save();
        generateScript();
    }

    function updatePoint(index, axis, value) {
        const sel = Engine.getSelection();
        if (!sel || isNaN(value)) return;
        const pts = sel.config.params.points;
        if (!pts) return;

        const idx = index === 'last' ? pts.length - 1 : index;
        if (pts[idx]) {
            pts[idx][axis] = value;
            rebuildObject(sel);
            HistoryManager.save();
        }
    }

    function setSegmentType(index, type) {
        const sel = Engine.getSelection();
        if (!sel || !sel.config?.params) return;
        const params = sel.config.params;
        if (!params.points) return;

        if (!params.segments) {
            params.segments = params.points.map(() => ({ type: 'line' }));
        }

        if (params.segments[index]) {
            params.segments[index].type = type;
            if (type === 'arc') params.segments[index].bulge = 0.5;
            rebuildObject(sel);
            HistoryManager.save();
            
            // Refresh vertex tool UI if active
            if (window.VertexTool && window.VertexTool.updateVertexUI) {
                window.VertexTool.updateVertexUI();
            }
        }
    }

    function flipObject() {
        const sel = Engine.getSelection();
        if (!sel) return;

        HistoryManager.save(Engine.getObjects());

        // Flip wall/spline-wall by reversing the point order
        if (sel.config.params?.points && sel.config.params.points.length >= 2) {
            sel.config.params.points = sel.config.params.points.slice().reverse();
            rebuildObject(sel);
            StepsDisplay.recordAction(`Flipped wall path for ${sel.config.blockType}`);
        } else {
            sel.mesh.rotation.y += Math.PI;
            Engine.syncConfigFromTransform(sel);
            generateScript();
            StepsDisplay.recordAction(`Flipped ${sel.config.blockType}`);
        }
    }

    function start2PointPlacement() {
        const type = document.getElementById('select-element-type')?.value || 'window';
        activeTool = '2point-placement';
        console.log(`Starting 2-point placement for ${type}`);
        showInputOverlay(`Click 2 points on a wall to place ${type}`);
        
        if (window.PlacementTool) {
            window.PlacementTool.start(type);
        }
        
        updateToolUI();
    }

    function generateRooms() {
        StepsDisplay.recordAction('Generating Rooms...');
        if (window.RoomTool) {
            window.RoomTool.generate();
        } else {
            alert('Room Tool not initialized');
        }
    }

    function finishWallPath() {
        if (window.WallPathTool) {
            window.WallPathTool.finish();
        }
    }

    function startSnapMove() {
        activeTool = 'snap-move';
        SnapMoveTool.start();
        SnapMoveTool.setCopyMode(false);
        updateToolUI();
    }

    function startSnapMoveCopy() {
        activeTool = 'snap-move';
        SnapMoveTool.start();
        SnapMoveTool.setCopyMode(true);
        updateToolUI();
    }

    function startArray(mode) {
        activeTool = 'move-array';
        MoveArrayTool.start(mode);
        updateToolUI();
    }

    function startRadialArray() {
        activeTool = 'move-array';
        MoveArrayTool.start('radial');
        updateToolUI();
    }

    function startSplineVertexEdit() {
        const sel = Engine.getSelection();
        if (!sel || sel.config.blockType !== BLOCK_TYPES.SPLINE_WALL) {
            alert('Select a Spline Wall to edit its path.');
            return;
        }
        activeTool = 'spline-vertex';
        SplineVertexTool.start(sel);
        updateToolUI();
    }

    function startSweepProfileEdit() {
        ProfileEditor.startSweepProfileEdit();
    }

    // ─── Trim / Extend ────────────────────────────────────────────────────────
    function startTrimTool() {
        if (TrimExtendTool.isActive()) { TrimExtendTool.deactivate(); activeTool = null; return; }
        activeTool = 'trim';
        TrimExtendTool.activate('trim');
        updateToolUI();
    }

    function startExtendTool() {
        if (TrimExtendTool.isActive()) { TrimExtendTool.deactivate(); activeTool = null; return; }
        activeTool = 'extend';
        TrimExtendTool.activate('extend');
        updateToolUI();
    }

    function startFilletTool() {
        if (TrimExtendTool.isActive()) { TrimExtendTool.deactivate(); activeTool = null; return; }
        activeTool = 'fillet';
        TrimExtendTool.activate('fillet');
        updateToolUI();
    }

    // ─── Parametric Placement ────────────────────────────────────────────────
    function startParametricPlace(insertType) {
        if (ParametricPlacementTool.isActive()) { ParametricPlacementTool.deactivate(); activeTool = null; return; }
        activeTool = 'parametric-place';
        ParametricPlacementTool.activate(insertType ?? BLOCK_TYPES.DOOR);
        updateToolUI();
    }

    // ─── Wall Conversion ─────────────────────────────────────────────────────
    /**
     * Convert the currently selected wall to a different type.
     * Preserves base geometry (points, t, h, base, top).
     */
    function convertWall(targetType) {
        const sel = Engine.getSelection();
        if (!sel || !sel.config.params) return;

        HistoryManager.save(Engine.getObjects());

        // Deep clone config so original is not mutated before removal
        const newConfig = JSON.parse(JSON.stringify(sel.config));
        newConfig.blockType = targetType;

        if (targetType === BLOCK_TYPES.CURTAIN_WALL) {
            newConfig.mat = 'glass';
            newConfig.params.t = newConfig.params.t ?? 0.05;
        } else if (targetType === BLOCK_TYPES.RAILING_MODERN || targetType === BLOCK_TYPES.RAILING_GLASS) {
            newConfig.params.h = Math.min(newConfig.params.h ?? 3.0, 1.1);
        } else if (targetType === BLOCK_TYPES.CURVED_WALL) {
            newConfig.params.curved = true;
        } else if (targetType === 'solid-block') {
            targetType = 'room';
            newConfig.blockType = 'room';
            if (newConfig.params.points && newConfig.params.points.length > 2) {
                const pts = newConfig.params.points;
                // Close the loop if not closed
                if (pts[0].Math && pts[0].distanceTo) {
                    if (pts[0].distanceTo(pts[pts.length - 1]) > 0.1) pts.push(pts[0].clone());
                } else if (Math.abs(pts[0].x - pts[pts.length - 1].x) > 0.1 || Math.abs(pts[0].z - pts[pts.length - 1].z) > 0.1) {
                    pts.push({ ...pts[0] });
                }
            }
        }

        Engine.removeObject(sel);

        const geo = BlockFactory.create(targetType, newConfig.params);
        if (geo) {
            Engine.addObject(newConfig, geo);
            StepsDisplay.recordAction(`Converted to ${targetType}`);
        }
    }

    // Import/Export
    function importSTL(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const loader = new THREE.STLLoader();
                const geometry = loader.parse(e.target.result);
                const currentFloor = FloorManager.getCurrentFloorData();

                const config = {
                    floor: currentFloor ? currentFloor.name : 'Ground Floor',
                    mat: 'concrete',
                    type: 'custom',
                    blockType: 'stl-import',
                    pos: { x: 0, y: 0, z: 0 },
                    rot: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    params: {
                        filename: file.name,
                        filesize: file.size
                    }
                };

                const obj = Engine.addObject(config, geometry);
                if (obj) {
                    geometry.computeBoundingBox();
                    const center = new THREE.Vector3();
                    geometry.boundingBox.getCenter(center);
                    obj.mesh.position.sub(center);
                    generateScript();
                    StepsDisplay.recordAction(`Imported STL: ${file.name}`);
                }
            } catch (error) {
                alert('Error loading STL file: ' + error.message);
            }
        };

        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    // UI Helpers
    function showInputOverlay(text) {
        if (uiElements.inputOverlay) {
            uiElements.inputOverlay.style.display = 'block';
            uiElements.inputOverlay.textContent = text;
        }
    }

    function hideInputOverlay() {
        if (uiElements.inputOverlay) {
            uiElements.inputOverlay.style.display = 'none';
        }
    }

    function updateObjectStackSelection(obj) {
        if (window.ObjectStackManager && window.ObjectStackManager.selectFromId) {
            window.ObjectStackManager.selectFromId(obj.id);
        }
    }

    function updateStepsDisplay() {
        if (window.StepsDisplay && window.StepsDisplay.updateDisplay) {
            window.StepsDisplay.updateDisplay();
        }
    }

    // Event Handlers
    function handleKeyDown(event) {
        if (event.key === "Shift") shiftDown = true;

        switch (event.key) {
            case 'Escape':
                cancelActiveTool();
                break;
            case 'Delete':
            case 'Backspace':
                if (Engine.getSelection()) {
                    deleteSelected();
                }
                break;
            case 'z':
            case 'Z':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        HistoryManager.redo();
                    } else {
                        HistoryManager.undo();
                    }
                }
                break;
            case 'y':
            case 'Y':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    HistoryManager.redo();
                }
                break;
            case 'd':
            case 'D':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    copySelected();
                }
                break;
        }
    }

    function handleKeyUp(event) {
        if (event.key === "Shift") shiftDown = false;
    }

    // Public API
    return {
        init,
        createBlock,
        startClickPlacement,
        startDrawing,
        start2PointPlacement,
        finishWallPath,
        generateRooms,
        updateProperty,
        flipObject,
        setMode,
        startSnapMove,
        startSnapMoveCopy,
        startArray,
        startRadialArray,
        startSplineVertexEdit,
        startSweepProfileEdit,
        startMeasureTool,
        toggleSectionPlane,
        startAlignTool,
        performAlign,
        startFloorProfile,
        startCeilingProfile,
        startPushPull,
        startBoolean,
        startVertexEdit,
        updateVertex,
        vertexSelectAll,
        vertexClearSelection,
        toggleVertexSelection,
        cancelActiveTool,
        setColumnShape,
        rebuildObject,
        onLiveEdit,
        deleteSelected,
        copySelected,
        toggleSnap,
        setSnapPointType,
        toggleAutoFloor,
        toggleAutoRoof,
        generateScript,
        importSTL,
        showInputOverlay,
        hideInputOverlay,
        populateUI,
        clearUI,
        updatePivot,
        updatePoint,
        setSegmentType,
        startTrimTool,
        startExtendTool,
        startFilletTool,
        startParametricPlace,
        convertWall
    };
})();
