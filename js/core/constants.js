// Color constants
export const COLORS = {
    CONCRETE: 0x95a5a6,
    STEEL: 0x444444,
    GLASS: 0x3498db,
    PAINT: 0xffffff,
    SOIL: 0x8B4513,
    GRID_MAIN: 0x444444,
    GRID_SUB: 0x333333,
    AXES_X: 0xff0000,
    AXES_Y: 0x00ff00,
    AXES_Z: 0x0000ff,
    SNAP_CORNER: 0x00ffff,
    SNAP_MIDPOINT: 0x00ff00,
    SNAP_CENTER: 0xff00ff,
    SNAP_SELECTION: 0x007bff, // Bright Blue for selected snap point
    MEASURE: 0xff00ff,
    SECTION: 0xff0000,
    SELECTION: 0xffff00,
    HIGHLIGHT: 0x00ff00
};

// Material constants
export const MATERIALS = {
    CONCRETE: 'concrete',
    STEEL: 'steel',
    GLASS: 'glass',
    PAINT: 'paint',
    HOLE: 'hole',
    SOIL: 'soil',
    WOOD: 'wood',
    BRICK: 'brick'
};

// Floor types
export const FLOOR_TYPES = {
    'top-parapet': {
        name: 'Top Parapet',
        height: 0.9,
        offset: 0,
        color: COLORS.CONCRETE,
        order: 6
    },
    'roof-top': {
        name: 'Top of Roof',
        height: 0,
        offset: 0.35,
        color: 0x7f8c8d,
        order: 5
    },
    'roof': {
        name: 'Roof Floor',
        height: 3.5,
        offset: 0.35,
        color: COLORS.CONCRETE,
        order: 4
    },
    'first': {
        name: 'First Floor',
        height: 3.5,
        offset: 0.35,
        color: 0xecf0f1,
        order: 3
    },
    'ground': {
        name: 'Ground Floor',
        height: 3.5,
        offset: 0.35,
        color: 0xbdc3c7,
        order: 2
    },
    'basement-1': {
        name: 'Basement 1',
        height: 3.5,
        offset: 0.7,
        color: 0x34495e,
        isRaft: true,
        order: 1
    }
};

// Block types
export const BLOCK_TYPES = {
    WALL: 'wall',
    COLUMN: 'column',
    BEAM: 'beam',
    FOOTING: 'footing',
    WINDOW: 'window-2-pane',
    DOOR: 'door-detailed',
    RAILING_MODERN: 'railing-modern',
    RAILING_GLASS: 'railing-glass',
    STAIRS: 'stairs',
    PARAPET: 'parapet',
    HOLE: 'hole',
    EXCAVATION: 'excavation',
    SHORING: 'shoring',
    PROFILE: 'profile',
    SHAPE: 'shape',
    SPLINE_WALL: 'spline-wall',
    CURTAIN_WALL: 'curtain-wall',
    CURVED_WALL: 'curved-wall',
    SILL: 'sill',
    LINTEL: 'lintel',
    ROOM: 'room',
    POLYLINE_WALL: 'polyline-wall',
    LINE_ARC: 'line-arc',
    LINE_CIRCLE: 'line-circle',
    LINE_RECTANGLE: 'line-rectangle',
    SWEEP_PATH: 'sweep-path'
};

// Tool modes
export const TOOL_MODES = {
    NONE: 'none',
    PLACEMENT: 'placement',
    SELECTION: 'selection',
    TRANSLATE: 'translate',
    ROTATE: 'rotate',
    SCALE: 'scale',
    SNAP_MOVE: 'snap-move',
    MEASURE: 'measure',
    ALIGN: 'align',
    SECTION: 'section',
    PROFILE: 'profile',
    BOOLEAN: 'boolean',
    TRIM: 'trim',
    EXTEND: 'extend',
    VERTEX_EDIT: 'vertex-edit',
    PARAMETRIC_PLACE: 'parametric-place'
};

// Snap point types
export const SNAP_TYPES = {
    CORNERS: 'corners',
    MIDPOINTS: 'midpoints',
    CENTER: 'center',
    VERTICES: 'vertices',
    EDGES: 'edges'
};

// Isolation modes
export const ISOLATION_MODES = {
    NONE: 'none',
    SINGLE: 'single',
    SMART: 'smart'
};

// Excavation types
export const EXCAVATION_TYPES = {
    OPEN: 'open',
    TIGHT: 'tight'
};

// Shoring types
export const SHORING_TYPES = {
    SOLDIER: 'soldier',
    CONTIGUOUS: 'contiguous',
    SECANT: 'secant'
};

// Default values
export const DEFAULTS = {
    PLOT_WIDTH: 30,
    PLOT_LENGTH: 40,
    FLOOR_HEIGHT: 3.5,
    SLAB_THICKNESS: 0.25,
    SCREED_THICKNESS: 0.08,
    TILE_THICKNESS: 0.02,
    BASEMENT_DEPTH: 3.0,
    PILE_SPACING: 0.6,
    PILE_DEPTH: 6.0,
    GRID_SIZE: 100,
    GRID_DIVISIONS: 100,
    CAMERA_POSITION: { x: 40, y: 40, z: 40 },
    CAMERA_NEAR: 0.1,
    CAMERA_FAR: 1000,
    CAMERA_FOV: 45
};

// History limits
export const HISTORY_LIMITS = {
    MAX_UNDO: 50,
    MAX_OBJECTS: 1000,
    MAX_STACK_SIZE: 50
};

// UI constants
export const UI = {
    SIDEBAR_WIDTH: 320,
    SCRIPT_PANEL_HEIGHT: 200,
    FLOATING_PANEL_ZINDEX: 1000,
    OVERLAY_ZINDEX: 10000
};

// Event names
export const EVENTS = {
    OBJECT_ADDED: 'object-added',
    OBJECT_REMOVED: 'object-removed',
    OBJECT_SELECTED: 'object-selected',
    OBJECT_DESELECTED: 'object-deselected',
    FLOOR_CHANGED: 'floor-changed',
    ISOLATION_CHANGED: 'isolation-changed',
    GRID_TOGGLED: 'grid-toggled',
    TOOL_CHANGED: 'tool-changed',
    HISTORY_CHANGED: 'history-changed',
    VIEWPORT_CLICK: 'viewport-click',
    VIEWPORT_MOVE: 'viewport-move',
    KEY_DOWN: 'key-down',
    KEY_UP: 'key-up'
};