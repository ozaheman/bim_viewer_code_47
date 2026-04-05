# Pivot Centering Implementation Complete

## Overview
All shapes and objects created in the BIM viewer now automatically have their pivot (center point) aligned to the geometric center of the shape.

## Changes Made

### 1. BlockFactory - Updated All Create Functions
**File**: `js/factories/block-factory.js`

Updated the following functions to call `centerGeometry()`:
- ✅ `createWall()` - Basic walls
- ✅ `createColumn()` - Circular and rectangular columns
- ✅ `createBeam()` - Rectangular beams
- ✅ `createFooting()` - Square footings
- ✅ `createWindow()` - Window geometries
- ✅ `createDoor()` - Door geometries
- ✅ `createRailingModern()` - Modern railing with balusters
- ✅ `createRailingGlass()` - Glass panel railings
- ✅ `createParapet()` - Parapet walls
- ✅ `createHole()` - Boolean hole shapes
- ✅ `createDefaultBlock()` - Default cube
- ✅ `createRoom()` - Room volumes
- ✅ `createSill()` - Window sill elements
- ✅ `createLintel()` - Lintel elements
- ✅ `createSplineWall()` - Curved walls (already had centerGeometry)
- ✅ `createPolylineWall()` - Polyline walls (already had centerGeometry)
- ✅ `createCurtainWall()` - Curtain walls (already had centerGeometry)

**Note**: `createStairs()` returns a THREE.Group and is excluded from direct centering, as groups work differently.

### 2. DrawingTool - Center Shapes on Creation
**File**: `js/tools/drawing-tool.js`

- Added `centerShapeGeometry()` helper function
- Updated `finishDrawing()` to center geometries for all shape types:
  - Rectangles
  - Circles
  - Polygons
  - Arcs
  - Other 2D shapes
- Lines and polylines are also supported

### 3. Integrated Tool Updates (via BlockFactory)
The following tools automatically benefit from BlockFactory updates:
- ✅ **WallPathTool** - Uses BlockFactory.create(POLYLINE_WALL)
- ✅ **RoomTool** - Uses BlockFactory.create(ROOM)
- ✅ **PlacementTool** - Uses BlockFactory for element creation
- ✅ **SplineVertexTool** - Geometry already has pivot, tool just edits vertices

## How It Works

### centerGeometry() Function
Located in: `js/factories/block-factory.js`

```javascript
function centerGeometry(geometry) {
    if (!geometry) return;
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.userData = geometry.userData || {};
    geometry.userData.centerOffset = center;
    return center;
}
```

**What it does:**
1. Computes the bounding box of the geometry
2. Calculates the geometric center point
3. Translates all vertices so the center moves to (0, 0, 0)
4. Stores the original center offset in userData for reference

### Result
- **Pivot Point**: Now at the exact geometric center of each shape
- **Mesh Position**: All transformations (move, rotate, scale) happen around the center
- **3D Rotation**: Objects rotate around their natural center, not their corner
- **Expected Behavior**: Shapes behave intuitively when manipulated

## Benefits

✅ **Intuitive Rotation**: Objects spin around their center, not an edge  
✅ **Centered Scaling**: Shapes grow/shrink from their center  
✅ **Snapping**: More reliable snap-point calculations  
✅ **Alignment**: Center-based alignment (like walls) works properly  
✅ **Visual Consistency**: All objects behave with center-based pivots  
✅ **Properties Panel**: Pivot coordinates now represent true center  

## Usage Example

```javascript
// User draws a rectangle in the DrawingTool
// Rectangle is created with geometry bottom-left at origin
// DrawingTool now calls centerShapeGeometry()
// Rectangle's pivot automatically moves to its center
// User can now rotate the rectangle around its center intuitively
```

## Verification Checklist

- ✅ All BlockFactory create functions updated
- ✅ DrawingTool shapes automatically centered
- ✅ WallPathTool leverages BlockFactory centering
- ✅ RoomTool leverages BlockFactory centering
- ✅ Helper function properly computes and applies centers
- ✅ No breaking changes to existing API
- ✅ Pivot centering works on first shape creation
- ✅ All shape types covered (walls, columns, beams, windows, doors, rooms, etc.)

## Backward Compatibility

✅ **No API Changes**: All function signatures remain unchanged  
✅ **Automatic**: No user configuration required  
✅ **Transparent**: Existing code works without modification  
✅ **Improves Behavior**: Existing functionality becomes more intuitive  

## Future Enhancements

- Add pivot offset editing in properties panel
- Create pivot offset presets for specific shape types
- Add visual pivot point markers during editing
- Support custom pivot points via UI

## Testing

When you create any shape:
1. **Rectangle** - Rotates around its center
2. **Circle** - Properly centered
3. **Wall** - Pivot at centerline
4. **Column** - Rotates around central axis
5. **Window/Door** - Centers on opening
6. **Room** - Centers on floor area

All shapes should now have their pivot point at the geometric center, making rotations, scaling, and alignment operations work intuitively.
