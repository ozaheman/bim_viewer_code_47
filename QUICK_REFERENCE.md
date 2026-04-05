# Quick Reference - New BIM Viewer Features

## 🎯 Three New Editing Capabilities

### 1️⃣ Center Handle Movement
**What**: Move entire shapes while keeping vertices intact  
**How**: Enter SplineVertexTool (V key) → Drag cyan sphere  
**When**: Repositioning profiles, shapes, or polylines

### 2️⃣ Path Shape Alignment  
**What**: Auto-align shape center with wall centerline (X,Z only)  
**How**: In SplineVertexTool, press A key  
**When**: Need perfect wall alignment with elevation preservation

### 3️⃣ Bisector Tool
**What**: Create vertical reference line at midpoint of 2 wall points  
**How**: Press B key → Click point 1 → Click point 2  
**When**: Parametric window/door placement, parametric spacing

---

## ⌨️ Keyboard Shortcuts

| Key | Function |
|:---:|----------|
| **V** | Activate Spline Vertex Tool |
| **B** | Activate Bisector Tool |
| **A** | Align with wall (in SplineVertexTool) |
| **Backspace** | Remove last point (Bisector Tool) |
| **Esc** | Cancel current tool |
| **Right-Click** | Cancel Bisector Tool / Delete vertex |

---

## 🎨 Visual Guides

### SplineVertexTool Colors
```
🔵 Cyan     = Center handle (drag to move entire shape)
🟡 Yellow   = Vertex handle (drag to move single point)
🟢 Green    = Insertion point (click to add vertex)
```

### Bisector Tool
```
🟣 Magenta  = Bisector preview line and final result
               (vertical, extends full wall height)
```

---

## 📋 Common Workflows

### Workflow A: Position Profile on Wall
```
1. Create wall              (draw polyline)
2. Create profile shape     (separate geometry)
3. V key                    (enter edit mode)
4. Drag cyan center         (move near wall)
5. Press A                  (auto-align to wall)
6. Exit mode               (press Esc)
7. Loft/extrude result     (use for complex walls)
```

### Workflow B: Create Window Reference Line
```
1. Create wall
2. B key                    (Bisector Tool)
3. Click left window edge   (point 1)
4. Click right window edge  (point 2)
5. Auto: bisector created   (at window center)
6. Use line for parametric  (placement reference)
```

### Workflow C: Multiple Shape Alignment
```
1. Draw 3 profile shapes
2. Select shape 1, press V
3. Press A to align
4. Esc to exit
5. Repeat for shapes 2 & 3
6. All now aligned on wall center
```

---

## 💡 Pro Tips

- **Alignment preserves Y**: Heights never change, only X,Z move
- **Auto-selects closest wall**: No manual wall selection needed
- **Bisector distance shown**: Check the distance message to verify
- **Snapping active**: Vertices snap to nearby geometry while dragging
- **Undo works**: All changes tracked by History Manager
- **Use grid snapping**: Enable grid for precise placements

---

## 🚀 Power Features

### Multi-Space Division
Create evenly-spaced parametric reference markers:
```
Draw wall → Create 3 bisectors at 2m, 4m, 6m → Use as snap points
```

### Parametric Alignment  
Coordinate multiple profile shapes:
```
Center alignment (A key) → All shapes follow wall centerline
Create parametric logic using aligned geometry
```

### Precise Element Placement
Reference bisector lines for exact positioning:
```
Bisector marks midpoint → Snap parametric elements to bisector
```

---

## ⚠️ Important Notes

✅ **Alignment only affects X,Z axes** - Y (elevation) never changes  
✅ **Bisector requires both points on same wall** - Tool validates  
✅ **Center movement is rigid body** - All relationships maintained  
✅ **Works with all path types** - Lines, polylines, shapes, walls  
✅ **Fully undoable** - All changes can be undone with Ctrl+Z  

---

## 📚 Learn More

Full documentation: See `FEATURE_GUIDE.md` in project root

---
