# BIM Viewer - New Features Guide

## Overview
Three powerful new features have been added to enhance vertex editing, shape alignment, and parametric placement:

1. **Center Handle Movement** - Move entire shapes while maintaining vertex relationships
2. **Path Shape Alignment** - Align path shapes to walls automatically (X/Y alignment only)
3. **Bisector Tool** - Create perpendicular bisector lines for parametric window/door placement

---

## Feature 1: Center Handle Movement (SplineVertexTool Enhancement)

### What It Does
When editing a path shape or wall outline, you can now move the entire shape as a unit while maintaining all vertex relationships. This is useful for quickly repositioning shapes without individually adjusting each vertex. Shapes created with the drawing tools (line, rectangle, circle, polygon, arc, polyline) can now be edited with the SplineVertexTool.

### How to Use

1. **Activate Editing Mode**
   - Select a path-based object (wall, spline, shape, rectangle, polygon, etc.)
   - Press `V` key or use the Spline Vertex Tool to enter editing mode

2. **Identify the Center Handle**
   - A **cyan (light blue) sphere** appears in the center of all vertices
   - **Yellow spheres** represent individual vertices
   - **Green cubes** are insertion points for adding new vertices

3. **Move the Entire Shape**
   - Click and drag the **cyan center handle** to move all points together
   - The shape maintains its proportions and relative vertex positions
   - The entire shape translates as a rigid body

### Interactive Elements
- **Cyan sphere (center)**: Drag to move entire shape
- **Yellow spheres**: Drag to move individual vertices
- **Green cubes**: Click to add new vertex at that position
- **Right-click yellow sphere**: Delete that vertex
- **Press 'A' key**: Align with nearby wall (see Feature 2)

### Example Workflow
```
1. Draw a rectangular profile shape using the drawing tools
2. Select the shape to edit vertices
3. Drag the cyan center handle to reposition it near a wall
4. Press 'A' to auto-align with the wall center
5. Fine-tune individual vertices if needed
6. Exit editing window pressing Escape
```

---

## Feature 2: Path Shape Alignment (A-Key Shortcut)

### What It Does
Automatically aligns a path shape's center with the nearest wall's center line. This alignment only affects the X and Z coordinates (horizontal plane), preserving the Y coordinate (height/elevation).

### How to Use

1. **Enter Spline Vertex Tool**
   - Select your path shape
   - Press `V` key to activate Spline Vertex Tool
   - You'll see the cyan center handle appear

2. **Trigger Alignment**
   - While in editing mode, press the **A key**
   - The tool automatically finds the closest wall
   - Your shape will move to align with that wall's center

3. **Alignment Details**
   - **X-axis alignment**: Shape center X = Wall center X
   - **Z-axis alignment**: Shape center Z = Wall center Z
   - **Y-axis (height)**: UNCHANGED - preserves elevation
   - A message shows the applied offset values

### Example Workflow
```
1. Create a profile shape offset from the wall
2. Start editing the shape (V key)
3. Press 'A' to align with wall center automatically
4. The shape slides into position on the wall centerline
5. Adjust individual vertices if fine-tuning needed
6. Exit and rebuild the wall/loft with proper alignment
```

### Technical Notes
- Algorithm finds the closest wall by comparing path centers
- If multiple walls exist, selects the nearest one
- Alignment message format: "Offset: X=0.12, Z=-0.05" (in model units)
- Works with POLYLINE_WALL, SPLINE_WALL, and path-wall types

---

## Feature 3: Bisector Tool (2-Point Parametric Placement)

### What It Does
Creates a perpendicular bisector line from two points clicked on a wall. This bisector can be used as a reference for placing windows, doors, and parametric elements at precise horizontal positions within a wall.

### How to Use

1. **Activate the Bisector Tool**
   - Press `B` key or click the Bisector Tool button in the UI
   - You'll see the message: "Click 2 points on a wall"

2. **Click First Point**
   - Click on a wall surface where you want the first measurement point
   - A magenta (pink) preview line appears following your mouse
   - Message shows: "Point 1/2 added. Click second point on the wall."

3. **Click Second Point**
   - Click another point on the **same wall** (lateral position)
   - The tool automatically:
     - Calculates the midpoint between the two points
     - Creates a vertical bisector line at that midpoint
     - The bisector extends from the wall base to the wall top
     - Displays the distance between the two points
     - Auto-exits the tool

4. **Resulting Bisector Line**
   - A **magenta vertical line** is created at the midpoint
   - Stored as a 'bisector-line' object in your model
   - Can be used as a reference for parametric placement

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| **B** | Activate Bisector Tool |
| **Backspace** | Remove last point (before creating bisector) |
| **Escape** | Cancel tool without creating bisector |
| **Right-Click** | Cancel tool without creating bisector |

### Example Workflow
```
1. Create a wall (e.g., 10m long)
2. Activate Bisector Tool (B key)
3. Click at 3m position on wall (Point 1)
4. Click at 7m position on wall (Point 2)
5. Bisector line is created at 5m position (midpoint)
6. Message shows: "Distance between points: 4.00m"
7. Use this line as reference for window/door parametric placement
```

### Use Cases

#### Window Placement Between Two Points
```
Wall Section 3m-7m (4m span)
│ • Point 1    • Point 2
├─────────────────────┤
│   Bisector at 5m
│         │
│        WIN (window centered between points)
```

#### Dividing Walls Into Equal Sections
```
Find midpoint of wall section → Create bisector → Place parametric elements symmetrically
```

#### Door Centering
```
Click left side of opening area → Click right side → Bisector marks center → Place door at center
```

---

## Technical Specifications

### SplineVertexTool Enhancements
- **File**: `js/tools/spline-vertex-tool.js`
- **Center Handle Color**: 0x00ffff (Cyan)
- **Center Handle Size**: 0.15 units (slightly larger for visibility)
- **Supported Objects**:
  - SPLINE_WALL
  - POLYLINE_WALL
  - SWEEP_PATH
  - SHAPE (created with drawing tools)
  - Any 'line', 'polyline', 'rectangle', 'polygon', 'arc', 'circle' (created with drawing tools)

### BisectorTool Specifications
- **File**: `js/tools/bisector-tool.js`
- **Bisector Line Color**: 0xff00ff (Magenta)
- **Object Type**: 'bisector-line'
- **Parameters Stored**:
  - `points`: [base, top] of bisector line
  - `wallRef`: reference to the source wall
  - `direction`: perpendicular direction (normalized)
  - `midpoint`: center point coordinates
  - `distance`: distance between input points

### Integration Points
- **Import Location**: `js/core/app.js`
- **Tool Registration**: `Engine.registerTool('bisector', BisectorTool)`
- **Global Exposure**: `window.BisectorTool`

---

## Tips & Best Practices

### For Shape Alignment
1. Always use center movement before alignment for best results
2. Press 'A' automatically finds the closest wall - no manual selection needed
3. If multiple walls exist, move your shape closer to the target wall first
4. Y-coordinate is never modified - elevation is always preserved

### For Bisector Creation
1. Ensure both points are on the **same wall surface**
2. Tool validates wall type automatically
3. If you click on different walls, it resets and asks you to click on the same wall
4. The distance message helps verify the two points are correct
5. Use precise clicking for parametric accuracy

### Common Keyboard Shortcuts
| Tool | Activation |
|------|------------|
| Spline Vertex Tool | V |
| Bisector Tool | B |
| Alignment in SplineVertexTool | A (while editing) |
| Delete Vertex | Right-click on yellow handle |
| Add Vertex | Click on green mid-handle |
| Undo | Ctrl+Z (after exiting tool) |
| Cancel Tool | Escape |

---

## Troubleshooting

### "No walls found to align with"
- **Cause**: No walls exist in the scene
- **Solution**: Create a wall first, then try alignment again

### Bisector tool won't accept second point
- **Cause**: Second point clicked on different wall
- **Solution**: The tool requires both points on the same wall surface. Click on the same wall again.

### Center handle not visible
- **Cause**: Object type not compatible with SplineVertexTool
- **Solution**: Ensure the object is a path-based type (wall, shape, spline, etc.)

### Shape moves in unexpected direction
- **Cause**: Camera orientation affecting drag interpretation
- **Solution**: Rotate your view perpendicular to the direction you want to move, or use the XY snapping features

---

## Advanced Usage

### Creating Parametric Window Arrays
1. Create base wall with bisector lines at regular intervals
2. Use bisector lines as snap/reference points
3. Place parametric windows aligned to bisectors
4. Bisectors serve as "control points" for parametric logic

### Multi-Shape Coordination
1. Create multiple profile shapes
2. Use center handles to position them
3. Use alignment feature to match wall centerlines
4. Create bisectors for evenly spaced parametric elements

### Workflow: Wall with Center-Aligned Profile
```
Step 1: Draw wall outline (polyline)
Step 2: Draw profile shape separately
Step 3: Enter SplineVertexTool on profile (V)
Step 4: Use cyan center handle to move near wall
Step 5: Press A to align with wall center
Step 6: Exit and loft between wall and aligned profile
```

---

## Files Modified/Created

### New Files
- `js/tools/bisector-tool.js` - New 2-point bisector tool

### Modified Files
- `js/tools/spline-vertex-tool.js` - Added center handle and alignment (A key)
- `js/core/app.js` - Added BisectorTool import and registration

### No Changes Needed To
- `js/core/engine.js` - Already supports new tool registration
- `js/core/constants.js` - Existing event system sufficient
- `js/core/block-factory.js` - Handles 'bisector-line' type automatically
- `js/factories/geometry-factory.js` - No changes needed

---

## Future Enhancements

Potential additions building on these features:
- Arc/Bezier segment type UI in SplineVertexTool
- Control point visualization for curved segments
- Batch alignment of multiple shapes
- Bisector angle visualization (45°, 90° options)
- Snap-to-grid for bisector creation
- Parametric window placement using bisectors
- Custom profile shape library with alignment presets

---

## Support & Feedback

These features are fully integrated with:
- ✅ History Manager (Undo/Redo support)
- ✅ Object Stack Manager (Selection tracking)
- ✅ Engine event system (Broadcasting changes)
- ✅ Snap vertex system (Snapping during vertex drag)
- ✅ Floor/elevation system (Y-coordinate preserved)

For issues or enhancement requests, refer to the tools' inline documentation and the Engine API.
