import { DEFAULTS } from '../core/constants.js';

export const GeometryFactory = (() => {
    // Create an extruded mesh from a 2D profile (array of THREE.Vector2)
    function createExtrudedProfile(points, thickness = DEFAULTS.SLAB_THICKNESS, height = 0) {
        if (!points || points.length < 3) {
            console.warn('Cannot create profile with less than 3 points.');
            return null;
        }

        const shape = new THREE.Shape(points);

        const extrudeSettings = {
            steps: 1,
            depth: thickness,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.rotateX(Math.PI / 2); // Orient it flat on the grid
        geometry.translate(0, height + thickness, 0); // Position it at the given height

        return geometry;
    }

    /**
     * Build a THREE.CatmullRomCurve3 from points, optionally interpreting
     * a segments[] array with {type:'arc'|'bezier', bulge, cp} overrides.
     * Falls back to plain CatmullRomCurve3 if no segments provided.
     *
     * @param {THREE.Vector3[]} points
     * @param {Array|null} segments  - optional per-segment descriptors
     * @returns {THREE.Curve}
     */
    function createCurveFromSegments(points, segments = null) {
        if (!segments || segments.length === 0) {
            return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
        }

        // Build a CurvePath that respects per-segment types
        const path = new THREE.CurvePath();
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const seg = segments[i] || { type: 'line' };

            if (seg.type === 'bezier' && seg.cp && seg.cp.length >= 2) {
                const cp1 = new THREE.Vector3(seg.cp[0].x, p1.y, seg.cp[0].z);
                const cp2 = new THREE.Vector3(seg.cp[1].x, p1.y, seg.cp[1].z);
                path.add(new THREE.CubicBezierCurve3(p1, cp1, cp2, p2));
            } else if (seg.type === 'arc') {
                // Approximate arc via QuadraticBezier using bulge factor
                const bulge = seg.bulge || 0.3;
                const mid = p1.clone().add(p2).multiplyScalar(0.5);
                const perp = new THREE.Vector3(-(p2.z - p1.z), 0, p2.x - p1.x).normalize();
                const cp = mid.clone().addScaledVector(perp, p1.distanceTo(p2) * bulge);
                path.add(new THREE.QuadraticBezierCurve3(p1, cp, p2));
            } else {
                path.add(new THREE.LineCurve3(p1, p2));
            }
        }
        return path;
    }

    /**
     * Offset a polyline path by `distance` perpendicular to each segment.
     * Uses averaged normals at each vertex for smooth corners.
     *
     * @param {THREE.Vector3[]} points - Input polyline points (XZ plane, Y ignored).
     * @param {number} distance        - Offset distance (positive = right of travel).
     * @param {'left'|'right'} side    - Which side to offset.
     * @returns {THREE.Vector3[]}      - New offset points.
     */
    function createOffsetPolyline(points, distance, side = 'right') {
        if (!points || points.length < 2) return points;
        const sign = side === 'right' ? 1 : -1;

        // Compute per-segment normals (in XZ plane)
        const segNormals = [];
        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dz = points[i + 1].z - points[i].z;
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            // Perpendicular: rotate 90° CCW in XZ
            segNormals.push(new THREE.Vector2(-dz / len, dx / len));
        }

        return points.map((p, i) => {
            let nx, nz;
            if (i === 0) {
                nx = segNormals[0].x;
                nz = segNormals[0].y;
            } else if (i === points.length - 1) {
                nx = segNormals[segNormals.length - 1].x;
                nz = segNormals[segNormals.length - 1].y;
            } else {
                // Average of adjacent segment normals
                nx = (segNormals[i - 1].x + segNormals[i].x) / 2;
                nz = (segNormals[i - 1].y + segNormals[i].y) / 2;
                const nl = Math.sqrt(nx * nx + nz * nz) || 1;
                nx /= nl;
                nz /= nl;
            }
            return new THREE.Vector3(
                p.x + sign * nx * distance,
                p.y,
                p.z + sign * nz * distance
            );
        });
    }

    /**
     * Calculate signed area of a 2D polygon to determine winding.
     * @param {THREE.Vector3[]} points 
     * @returns {number} Positive = CCW, Negative = CW
     */
    function getPolygonWinding(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].z;
            area -= points[j].x * points[i].z;
        }
        return area;
    }

    /**
     * @param {Array<THREE.Vector3>} points       - Array of points defining the wall path.
     * @param {number} thickness                  - Thickness of the wall (ignored if profilePoints provided).
     * @param {number} height                     - Height of the wall.
     * @param {string} align                      - 'left' | 'mid' | 'right'
     * @param {Array<THREE.Vector2>} profilePoints - Custom 2D cross-section profile points.
     * @param {Array|null} segments               - Optional per-segment curve descriptors.
     * @param {Object} sweepParams                - Optional { normal, rotation, basePoint }
     * @returns {THREE.BufferGeometry}
     */
    function createPathWallGeometry(points, thickness = 0.2, height = 3.2, align = 'mid', profilePoints = null, segments = null, sweepParams = {}) {
        if (!points || points.length < 2) return null;

        const shape = new THREE.Shape();
        const basePoint = sweepParams.basePoint || { x: 0, y: 0, z: 0 };
        const rotation = (sweepParams.rotation || 0) * (Math.PI / 180); // Convert to radians
        
        // Helper to transform profile point
        const transformPoint = (p) => {
            // Apply base point offset (translate before rotate?) 
            // Usually 3ds Max does: Offset -> Rotate -> Scale -> Mirror
            let tx = p.x - basePoint.x;
            let ty = p.y - basePoint.y;
            
            // Apply rotation
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const rx = tx * cos - ty * sin;
            const ry = tx * sin + ty * cos;
            
            return { x: rx, y: ry };
        };

        if (profilePoints && profilePoints.length >= 3) {
            const first = transformPoint(profilePoints[0]);
            shape.moveTo(first.x, first.y);
            for (let i = 1; i < profilePoints.length; i++) {
                const pt = transformPoint(profilePoints[i]);
                shape.lineTo(pt.x, pt.y);
            }
            shape.closePath();
        } else {
            let startX, endX;
            let effectiveAlign = align;

            // Map inside/outside to left/right based on winding if closed
            if (align === 'inside' || align === 'outside') {
                const isClosed = points.length > 2 && points[0].distanceTo(points[points.length - 1]) < 0.01;
                if (isClosed) {
                    const winding = getPolygonWinding(points);
                    // Standard: CCW (winding > 0) -> Left is Outside, Right is Inside
                    if (winding > 0) {
                        effectiveAlign = align === 'inside' ? 'right' : 'left';
                    } else {
                        effectiveAlign = align === 'inside' ? 'left' : 'right';
                    }
                } else {
                    // Fallback for open paths
                    effectiveAlign = align === 'inside' ? 'right' : 'left';
                }
            }

            if (effectiveAlign === 'left') {
                startX = 0;
                endX = thickness;
            } else if (effectiveAlign === 'right') {
                startX = -thickness;
                endX = 0;
            } else {
                startX = -thickness / 2;
                endX = thickness / 2;
            }

            const p1 = transformPoint({ x: startX, y: 0 });
            const p2 = transformPoint({ x: endX, y: 0 });
            const p3 = transformPoint({ x: endX, y: height });
            const p4 = transformPoint({ x: startX, y: height });

            shape.moveTo(p1.x, p1.y);
            shape.lineTo(p2.x, p2.y);
            shape.lineTo(p3.x, p3.y);
            shape.lineTo(p4.x, p4.y);
            shape.closePath();
        }

        const curve = createCurveFromSegments(points, segments);
        const steps = points.length * 10;
        
        const extrudeSettings = {
            steps: steps,
            extrudePath: curve,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Always use custom frames for wall sweeping, ensuring Up is stable
        const upVec = sweepParams.normal || { x: 0, y: 1, z: 0 };
        const normal = new THREE.Vector3(upVec.x, upVec.y, upVec.z).normalize();
        if (normal.length() < 0.1) normal.set(0, 1, 0); // fallback

        const frames = computeSweepFrames(curve, steps, normal);
        applySweepFrames(geometry, frames, steps, shape, curve, basePoint.z || 0);

        return geometry;
    }

    function computeSweepFrames(curve, segments, up) {
        const tangents = [];
        const normals = [];
        const binormals = [];

        for (let i = 0; i <= segments; i++) {
            const u = i / segments;
            const tangent = curve.getTangentAt(u).normalize();
            tangents.push(tangent);

            // Side = tangent x up
            const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
            // If tangent is parallel to up, use a fallback
            if (side.length() < 0.001) {
                const fallbackUp = Math.abs(up.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
                side.crossVectors(tangent, fallbackUp).normalize();
            }
            
            // Actual Up = side x tangent
            const actualUp = new THREE.Vector3().crossVectors(side, tangent).normalize();

            normals.push(side);
            binormals.push(actualUp);
        }

        return { tangents, normals, binormals };
    }

    function applySweepFrames(geometry, frames, segments, shape, curve, zOffset = 0) {
        // This is a complex operation as ExtrudeGeometry doesn't easily let us override frames after creation.
        // We have to re-compute the positions.
        // Or better: we should have used a custom ExtrudeGeometry approach from the start.
        // However, we can iterate through vertices and re-project them.
        
        const positions = geometry.attributes.position;
        const count = positions.count;
        const shapePoints = shape.extractPoints(1).shape; // Basic points of the shape
        const shapeCount = shapePoints.length;
        
        // This is simplified and might miss caps/bevels if they were enabled.
        // Since bevel is disabled, we assume:
        // Vertices 0 to (segments+1)*shapeCount are the path extrusion.
        
        for (let i = 0; i <= segments; i++) {
            const frameIndex = i;
            const tangent = frames.tangents[frameIndex];
            const normal = frames.normals[frameIndex];
            const binormal = frames.binormals[frameIndex];
            const p = curve.getPointAt(i / segments);

            for (let j = 0; j < shapeCount; j++) {
                const idx = i * shapeCount + j;
                if (idx >= count) break;
                
                const sx = shapePoints[j].x;
                const sy = shapePoints[j].y;
                
                const vx = p.x + sx * normal.x + sy * binormal.x + zOffset * tangent.x;
                const vy = p.y + sx * normal.y + sy * binormal.y + zOffset * tangent.y;
                const vz = p.z + sx * normal.z + sy * binormal.z + zOffset * tangent.z;
                
                positions.setXYZ(idx, vx, vy, vz);
            }
        }
        positions.needsUpdate = true;
    }

    function createLoftedWallGeometry(bottomPoints, topPoints, thickness = 0.2, align = 'mid') {
        if (!bottomPoints || bottomPoints.length < 2 || !topPoints || topPoints.length < 2) return null;

        // Ensure same number of points (interpolate if necessary, but here we assume matched counts)
        if (bottomPoints.length !== topPoints.length) {
            console.warn('createLoftedWallGeometry: Point counts do not match. Using bottom points as path.');
            topPoints = bottomPoints.map(p => new THREE.Vector3(p.x, p.y + 3, p.z));
        }

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const indices = [];

        // Determine offsets for both layers
        const sign = align === 'left' ? 1 : (align === 'right' ? -1 : 0.5);
        const offsetDist = align === 'mid' ? thickness / 2 : thickness;
        
        // We'll create 4 loops: Outer Bottom, Inner Bottom, Outer Top, Inner Top
        // But let's simplify: Use createOffsetPolyline logic
        const getOffsets = (pts, side) => {
            return createOffsetPolyline(pts, offsetDist, side);
        };

        let loop1, loop2, loop3, loop4;
        if (align === 'mid') {
            loop1 = getOffsets(bottomPoints, 'right'); // Outer bottom
            loop2 = getOffsets(bottomPoints, 'left');  // Inner bottom
            loop3 = getOffsets(topPoints, 'right');    // Outer top
            loop4 = getOffsets(topPoints, 'left');     // Inner top
        } else if (align === 'left' || align === 'inside') { // inside mapping skipped for simplicity here, tool should map it
            loop1 = bottomPoints.map(p => p.clone());
            loop2 = getOffsets(bottomPoints, 'right');
            loop3 = topPoints.map(p => p.clone());
            loop4 = getOffsets(topPoints, 'right');
        } else {
            loop1 = getOffsets(bottomPoints, 'left');
            loop2 = bottomPoints.map(p => p.clone());
            loop3 = getOffsets(topPoints, 'left');
            loop4 = topPoints.map(p => p.clone());
        }

        // Add vertices: loop1 (0..N-1), loop2 (N..2N-1), loop3 (2N..3N-1), loop4 (3N..4N-1)
        const N = bottomPoints.length;
        [loop1, loop2, loop3, loop4].forEach(loop => {
            loop.forEach(p => positions.push(p.x, p.y, p.z));
        });

        // Add faces
        for (let i = 0; i < N - 1; i++) {
            const next = i + 1;
            
            // Outer Face (loop1 & loop3)
            indices.push(i, next, next + 2 * N);
            indices.push(i, next + 2 * N, i + 2 * N);

            // Inner Face (loop2 & loop4)
            indices.push(i + N, i + 3 * N, next + 3 * N);
            indices.push(i + N, next + 3 * N, next + N);

            // Left Side (start of segments)
            if (i === 0) {
               // indices.push(0, N, 3*N);
               // indices.push(0, 3*N, 2*N);
            }

            // Top Face (loop3 & loop4)
            indices.push(i + 2 * N, i + 3 * N, next + 3 * N);
            indices.push(i + 2 * N, next + 3 * N, next + 2 * N);

            // Bottom Face (loop1 & loop2)
            indices.push(i, next, next + N);
            indices.push(i, next + N, i + N);
        }

        // End caps
        const isClosed = bottomPoints[0].distanceTo(bottomPoints[N-1]) < 0.01;
        if (!isClosed) {
            // Start cap
            indices.push(0, 0 + N, 0 + 3 * N);
            indices.push(0, 0 + 3 * N, 0 + 2 * N);
            // End cap
            indices.push(N - 1, (N - 1) + 2 * N, (N - 1) + 3 * N);
            indices.push(N - 1, (N - 1) + 3 * N, (N - 1) + N);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    // Public API
    return {
        createExtrudedProfile,
        createPathWallGeometry,
        createOffsetPolyline,
        createCurveFromSegments,
        createLoftedWallGeometry
    };
})();