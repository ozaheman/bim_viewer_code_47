import { BLOCK_TYPES } from '../core/constants.js';
import { GeometryFactory } from '../factories/geometry-factory.js';

export const BlockFactory = (() => {
    // Create a block based on type and parameters
    function create(type, params = {}) {
        switch (type) {
            case BLOCK_TYPES.WALL:
                return createWall(params);
            case BLOCK_TYPES.COLUMN:
                return createColumn(params);
            case BLOCK_TYPES.BEAM:
                return createBeam(params);
            case BLOCK_TYPES.FOOTING:
                return createFooting(params);
            case BLOCK_TYPES.WINDOW:
                return createWindow(params);
            case BLOCK_TYPES.DOOR:
                return createDoor(params);
            case BLOCK_TYPES.RAILING_MODERN:
                return createRailingModern(params);
            case BLOCK_TYPES.RAILING_GLASS:
                return createRailingGlass(params);
            case BLOCK_TYPES.STAIRS:
                return createStairs(params);
            case BLOCK_TYPES.PARAPET:
                return createParapet(params);
            case BLOCK_TYPES.HOLE:
                return createHole(params);
            case BLOCK_TYPES.SHAPE:
                return createShape(params);
            case BLOCK_TYPES.SPLINE_WALL:
                return createSplineWall(params);
            case BLOCK_TYPES.CURTAIN_WALL:
                return createCurtainWall(params);
            case BLOCK_TYPES.CURVED_WALL:
                return createCurvedWall(params);
            case BLOCK_TYPES.SILL:
                return createSill(params);
            case BLOCK_TYPES.LINTEL:
                return createLintel(params);
            case BLOCK_TYPES.ROOM:
                return createRoom(params);
            case BLOCK_TYPES.POLYLINE_WALL:
                return createPolylineWall(params);
            case BLOCK_TYPES.LINE_ARC:
                return createLineArc(params);
            case BLOCK_TYPES.LINE_CIRCLE:
                return createLineCircle(params);
            case BLOCK_TYPES.LINE_RECTANGLE:
                return createLineRectangle(params);
            case BLOCK_TYPES.SWEEP_PATH:
                return createSweepPath(params);
            default:
                console.warn(`Unknown block type: ${type}`);
                return createDefaultBlock();
        }
    }

    // Room: transparent volume from path
    function createRoom(params) {
        if (!params.points || params.points.length < 3) return null;
        
        const shape = new THREE.Shape();
        const p0 = params.points[0];
        shape.moveTo(p0.x, p0.z);
        for (let i = 1; i < params.points.length; i++) {
            shape.lineTo(params.points[i].x, params.points[i].z);
        }
        shape.closePath();

        const height = params.h || 3.0;
        const extrudeSettings = {
            steps: 1,
            depth: height,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.rotateX(Math.PI / 2);
        centerGeometry(geometry);
        return geometry;
    }

    // Sill: filler below window
    function createSill(params) {
        const width = params.w || 2;
        const height = params.h || 0.1;
        const thickness = params.t || 0.25;
        const geometry = new THREE.BoxGeometry(width, height, thickness);
        centerGeometry(geometry);
        return geometry;
    }

    // Lintel: filler above window/door
    function createLintel(params) {
        const width = params.w || 2;
        const height = params.h || 0.2;
        const thickness = params.t || 0.25;
        const geometry = new THREE.BoxGeometry(width, height, thickness);
        centerGeometry(geometry);
        return geometry;
    }

    // Spline Wall: extruded along path
    function createSplineWall(params) {
        if (!params.points || params.points.length < 2) {
            return createWall(params); // Fallback
        }
        
        // Convert plain objects to Vector3 if needed
        const points = params.points.map(p => 
            p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y || 0, p.z)
        );
        
        const thickness = params.t || 0.2;
        const height = params.h || 3.2;
        const align = params.align || 'mid';
        const profilePoints = params.profilePoints ? params.profilePoints.map(p => new THREE.Vector2(p.x, p.y)) : null;
        const sweepParams = {
            normal: params.normal,
            rotation: params.rotation,
            basePoint: params.basePoint
        };
        
        // Always use direct GeometryFactory import – no window fallback needed
        const geometry = GeometryFactory.createPathWallGeometry(points, thickness, height, align, profilePoints, null, sweepParams);
        if (geometry) centerGeometry(geometry);
        return geometry;
    }

    function createPolylineWall(params) {
        if (!params.points || params.points.length < 2) return createWall(params);
        const points = params.points.map(p =>
            p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y || 0, p.z)
        );
        const thickness = params.t || 0.2;
        const height = params.h || 3.2;
        const align = params.align || 'mid';
        
        // Lofted Wall Support
        if (params.topPoints && params.topPoints.length === points.length) {
            const topPoints = params.topPoints.map(p =>
                p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y || 0, p.z)
            );
            const geometry = GeometryFactory.createLoftedWallGeometry(points, topPoints, thickness, align);
            if (geometry) centerGeometry(geometry);
            return geometry;
        }

        const profilePoints = params.profilePoints ? params.profilePoints.map(p => new THREE.Vector2(p.x, p.y)) : null;
        const sweepParams = {
            normal: params.normal,
            rotation: params.rotation,
            basePoint: params.basePoint
        };

        const segments = points.slice(0, -1).map(() => ({ type: 'line' }));
        const geometry = GeometryFactory.createPathWallGeometry(points, thickness, height, align, profilePoints, segments, sweepParams);
        if (geometry) centerGeometry(geometry);
        return geometry;
    }

    function centerGeometry(geometry) {
        if (!geometry) return;
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.userData = geometry.userData || {};
        geometry.userData.centerOffset = center; // Store offset if needed
        return center;
    }

    // Line Geometries
    function createLineArc(params) {
        const radius = params.r || 1;
        const startAngle = params.start || 0;
        const endAngle = params.end || Math.PI / 2;
        const segments = params.segments || 32;
        
        const curve = new THREE.ArcCurve(0, 0, radius, startAngle, endAngle, false);
        const points = curve.getPoints(segments);
        const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, 0, p.y)));
        centerGeometry(geometry);
        return geometry;
    }

    function createLineCircle(params) {
        const radius = params.r || 1;
        const segments = params.segments || 64;
        
        const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
        const points = curve.getPoints(segments);
        const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, 0, p.y)));
        centerGeometry(geometry);
        return geometry;
    }

    function createLineRectangle(params) {
        const w = params.w || 2;
        const h = params.h || 1;
        const points = [
            new THREE.Vector3(-w/2, 0, -h/2),
            new THREE.Vector3(w/2, 0, -h/2),
            new THREE.Vector3(w/2, 0, h/2),
            new THREE.Vector3(-w/2, 0, h/2),
            new THREE.Vector3(-w/2, 0, -h/2)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        centerGeometry(geometry);
        return geometry;
    }

    // Curtain Wall: spline-wall geometry but marked glazed (glass material applied by Engine)
    function createCurtainWall(params) {
        if (!params.points || params.points.length < 2) return createWall(params);
        const points = params.points.map(p =>
            p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y || 0, p.z)
        );
        // Curtain wall uses thinner glass panels via profilePoints if provided,
        // otherwise a thin rectangular profile
        const thickness = params.t || 0.05;
        const height = params.h || 3.2;
        const align = params.align || 'mid';
        const profilePoints = params.profilePoints
            ? params.profilePoints.map(p => new THREE.Vector2(p.x, p.y))
            : null;
        const geometry = GeometryFactory.createPathWallGeometry(points, thickness, height, align, profilePoints);
        if (geometry) centerGeometry(geometry);
        return geometry;
    }

    // Curved Wall: same as spline-wall but forces CatmullRom tension = 0 (smooth arc)
    function createCurvedWall(params) {
        if (!params.points || params.points.length < 2) return createWall(params);
        const modParams = { ...params, curved: true };
        return createSplineWall(modParams);
    }

    function createSweepPath(params) {
        if (!params.points || params.points.length < 2) return null;
        const points = params.points.map(p =>
            p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y || 0, p.z)
        );
        const thickness = params.t || 0.2;
        const height = params.h || 0.4;
        const align = params.align || 'mid';
        const profilePoints = params.profilePoints ? params.profilePoints.map(p => new THREE.Vector2(p.x, p.y)) : null;

        const sweepParams = {
            normal: params.normal || { x: 0, y: 1, z: 0 },
            rotation: params.rotation || 0,
            basePoint: params.basePoint || { x: 0, y: 0 }
        };

        const geometry = GeometryFactory.createPathWallGeometry(points, thickness, height, align, profilePoints, null, sweepParams);
        if (geometry) centerGeometry(geometry);
        return geometry;
    }

    // Wall: width x height x thickness
    function createWall(params) {
        const width = params.w || 4;
        const height = params.h || 3.2;
        const thickness = params.t || 0.2;

        const geometry = new THREE.BoxGeometry(width, height, thickness);
        centerGeometry(geometry);
        return geometry;
    }

    // Column: circular or rectangular
    function createColumn(params) {
        const height = params.h || 3;
        const shape = params.shape || 'circular';

        let geometry;
        if (shape === 'rectangular') {
            const width = params.w || 0.4;
            const depth = params.d || 0.4;
            geometry = new THREE.BoxGeometry(width, height, depth);
        } else {
            const radius = params.r || 0.25;
            const segments = params.segments || 32;
            geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
        }
        centerGeometry(geometry);
        return geometry;
    }

    // Beam: rectangular beam
    function createBeam(params) {
        const length = params.l || 4;
        const height = params.h || 0.4;
        const width = params.w || 0.3;

        const geometry = new THREE.BoxGeometry(length, height, width);
        centerGeometry(geometry);
        return geometry;
    }

    // Footing: square footing
    function createFooting(params) {
        const size = params.s || 1.5;
        const height = params.h || 0.5;

        const geometry = new THREE.BoxGeometry(size, height, size);
        centerGeometry(geometry);
        return geometry;
    }

    // Window with two panes
    function createWindow(params) {
        const width = params.w || 2;
        const height = params.h || 1.5;
        const depth = params.d || 0.2;

        const geometries = [];

        // Frame
        const frameTop = new THREE.BoxGeometry(width, 0.1, depth);
        frameTop.translate(0, height / 2 - 0.05, 0);

        const frameBottom = new THREE.BoxGeometry(width, 0.1, depth);
        frameBottom.translate(0, -height / 2 + 0.05, 0);

        const frameLeft = new THREE.BoxGeometry(0.1, height - 0.2, depth);
        frameLeft.translate(-width / 2 + 0.05, 0, 0);

        const frameRight = new THREE.BoxGeometry(0.1, height - 0.2, depth);
        frameRight.translate(width / 2 - 0.05, 0, 0);

        geometries.push(frameTop, frameBottom, frameLeft, frameRight);

        // Left sash
        const sashWidth = width / 2 + 0.05;
        const sashHeight = height - 0.2;

        // Left sash frame
        const leftSashTop = new THREE.BoxGeometry(sashWidth, 0.08, 0.08);
        leftSashTop.translate(-width / 4, sashHeight / 2 - 0.04, -0.02);

        const leftSashBottom = new THREE.BoxGeometry(sashWidth, 0.08, 0.08);
        leftSashBottom.translate(-width / 4, -sashHeight / 2 + 0.04, -0.02);

        const leftSashLeft = new THREE.BoxGeometry(0.08, sashHeight, 0.08);
        leftSashLeft.translate(-width / 2 + 0.04, 0, -0.02);

        const leftSashRight = new THREE.BoxGeometry(0.08, sashHeight, 0.08);
        leftSashRight.translate(0 - 0.04, 0, -0.02);

        // Left glass
        const leftGlass = new THREE.BoxGeometry(sashWidth - 0.16, sashHeight - 0.16, 0.03);
        leftGlass.translate(-width / 4, 0, -0.02);

        geometries.push(leftSashTop, leftSashBottom, leftSashLeft, leftSashRight, leftGlass);

        // Right sash
        const rightSashTop = new THREE.BoxGeometry(sashWidth, 0.08, 0.08);
        rightSashTop.translate(-width / 4 + width / 2, sashHeight / 2 - 0.04, 0.02);

        const rightSashBottom = new THREE.BoxGeometry(sashWidth, 0.08, 0.08);
        rightSashBottom.translate(-width / 4 + width / 2, -sashHeight / 2 + 0.04, 0.02);

        const rightSashLeft = new THREE.BoxGeometry(0.08, sashHeight, 0.08);
        rightSashLeft.translate(0 - 0.04 + width / 2, 0, 0.02);

        const rightSashRight = new THREE.BoxGeometry(0.08, sashHeight, 0.08);
        rightSashRight.translate(-width / 2 + 0.04 + width, 0, 0.02);

        // Right glass
        const rightGlass = new THREE.BoxGeometry(sashWidth - 0.16, sashHeight - 0.16, 0.03);
        rightGlass.translate(-width / 4 + width / 2, 0, 0.02);

        geometries.push(rightSashTop, rightSashBottom, rightSashLeft, rightSashRight, rightGlass);

        // Merge all geometries
        const geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        centerGeometry(geometry);
        return geometry;
    }

    // Detailed door
    function createDoor(params) {
        const width = params.w || 1;
        const height = params.h || 2.2;
        const depth = params.d || 0.05;
        const frameWidth = params.fw || 0.1;
        const frameDepth = params.fd || 0.15;

        const geometries = [];

        // Frame
        const frameTop = new THREE.BoxGeometry(width + frameWidth * 2, 0.1, frameDepth);
        frameTop.translate(0, height / 2 - 0.05, 0);

        const frameLeft = new THREE.BoxGeometry(frameWidth, height - 0.1, frameDepth);
        frameLeft.translate(-width / 2 - frameWidth / 2, -0.05, 0);

        const frameRight = new THREE.BoxGeometry(frameWidth, height - 0.1, frameDepth);
        frameRight.translate(width / 2 + frameWidth / 2, -0.05, 0);

        // Door slab
        const doorSlab = new THREE.BoxGeometry(width, height - 0.2, depth);
        doorSlab.translate(0, -0.1, 0);

        geometries.push(frameTop, frameLeft, frameRight, doorSlab);

        const geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        centerGeometry(geometry);
        return geometry;
    }

    // Modern railing with balusters
    function createRailingModern(params) {
        const length = params.l || 3;
        const height = params.h || 1.1;
        const postSize = params.ps || 0.1;
        const railSize = params.rs || 0.08;
        const balusterSize = params.bs || 0.04;

        const geometries = [];

        // Main posts
        const postGeometry = new THREE.BoxGeometry(postSize, height, postSize);
        geometries.push(
            postGeometry.clone().translate(-length / 2, 0, 0),
            postGeometry.clone().translate(length / 2, 0, 0)
        );

        // Rails
        const railGeometry = new THREE.BoxGeometry(length, railSize, postSize);
        geometries.push(
            railGeometry.clone().translate(0, height / 2 - railSize / 2, 0),
            railGeometry.clone().translate(0, -height / 2 + railSize / 2, 0)
        );

        // Balusters
        const balusterGeometry = new THREE.BoxGeometry(balusterSize, height - railSize * 2, balusterSize);
        const balusterCount = Math.max(2, Math.floor(length / 0.3));

        for (let i = 1; i < balusterCount; i++) {
            const xPos = -length / 2 + (length / balusterCount) * i;
            geometries.push(balusterGeometry.clone().translate(xPos, 0, 0));
        }

        const geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        centerGeometry(geometry);
        return geometry;
    }

    // Glass railing
    function createRailingGlass(params) {
        const length = params.l || 3;
        const height = params.h || 1.1;
        const postSize = params.ps || 0.1;
        const railSize = params.rs || 0.08;
        const glassThickness = params.gt || 0.02;

        const geometries = [];

        // Posts
        const postGeometry = new THREE.BoxGeometry(postSize, height, postSize);
        geometries.push(
            postGeometry.clone().translate(-length / 2, 0, 0),
            postGeometry.clone().translate(length / 2, 0, 0)
        );

        // Top rail
        const topRail = new THREE.BoxGeometry(length, railSize, postSize);
        geometries.push(topRail.clone().translate(0, height / 2 - railSize / 2, 0));

        // Glass panels
        const panelCount = Math.max(1, Math.floor(length / 1.5));
        const panelWidth = (length - postSize * (panelCount + 1)) / panelCount;
        const panelHeight = height - railSize - 0.08;

        const panelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, glassThickness);

        for (let i = 0; i < panelCount; i++) {
            const panel = panelGeometry.clone().translate(
                -length / 2 + postSize + panelWidth / 2 + i * (panelWidth + postSize),
                -railSize / 2,
                0
            );
            geometries.push(panel);
        }

        const geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
        centerGeometry(geometry);
        return geometry;
    }

    // Stairs
    function createStairs(params) {
        const numSteps = params.steps || 8;
        const width = params.width || 1.2;
        const treadDepth = params.treadDepth || 0.3;
        const riserHeight = params.riserHeight || 0.2;

        const stairGroup = new THREE.Group();

        // Stringers
        const stringerHeight = numSteps * riserHeight;
        const stringerLength = numSteps * treadDepth;

        const stringerShape = new THREE.Shape();
        stringerShape.moveTo(0, 0);
        stringerShape.lineTo(stringerLength, 0);
        stringerShape.lineTo(stringerLength, riserHeight);

        for (let i = 1; i < numSteps; i++) {
            stringerShape.lineTo(stringerLength - i * treadDepth, i * riserHeight);
            stringerShape.lineTo(stringerLength - i * treadDepth, (i + 1) * riserHeight);
        }

        stringerShape.lineTo(0, stringerHeight);
        stringerShape.lineTo(0, 0);

        const stringerGeometry = new THREE.ExtrudeGeometry(stringerShape, {
            depth: 0.1,
            bevelEnabled: false
        });

        stringerGeometry.rotateX(-Math.PI / 2);
        stringerGeometry.translate(-stringerLength / 2, -stringerHeight / 2, -width / 2);

        // Materials
        const steelMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8,
            roughness: 0.3
        });

        const woodMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.7
        });

        const concreteMaterial = new THREE.MeshStandardMaterial({
            color: 0x95a5a6,
            roughness: 0.8
        });

        // Left stringer
        const leftStringer = new THREE.Mesh(stringerGeometry, steelMaterial);
        stairGroup.add(leftStringer);

        // Right stringer
        const rightStringer = leftStringer.clone();
        rightStringer.position.z = width - 0.1;
        stairGroup.add(rightStringer);

        // Treads
        const treadGeometry = new THREE.BoxGeometry(width - 0.2, 0.05, treadDepth);

        for (let i = 0; i < numSteps; i++) {
            const tread = new THREE.Mesh(treadGeometry, woodMaterial);
            tread.position.set(
                0,
                -stringerHeight / 2 + i * riserHeight + riserHeight / 2,
                -stringerLength / 2 + stringerLength - i * treadDepth - treadDepth / 2
            );
            stairGroup.add(tread);
        }

        // Risers
        const riserGeometry = new THREE.BoxGeometry(width - 0.2, riserHeight, 0.02);

        for (let i = 0; i < numSteps; i++) {
            const riser = new THREE.Mesh(riserGeometry, concreteMaterial);
            riser.position.set(
                0,
                -stringerHeight / 2 + i * riserHeight,
                -stringerLength / 2 + stringerLength - i * treadDepth
            );
            stairGroup.add(riser);
        }

        // Handrail
        const handrailHeight = stringerHeight + 1.0;
        const handrailGeometry = new THREE.CylinderGeometry(0.03, 0.03, handrailHeight, 8);
        const handrail = new THREE.Mesh(handrailGeometry, steelMaterial);
        handrail.position.set(-stringerLength / 2 + 0.1, handrailHeight / 2 - stringerHeight / 2, width / 2 - 0.1);
        handrail.rotation.z = Math.PI / 2;
        stairGroup.add(handrail);

        return stairGroup;
    }

    // Parapet
    function createParapet(params) {
        const width = params.w || 4;
        const height = params.h || 0.9;
        const thickness = params.t || 0.2;

        const geometry = new THREE.BoxGeometry(width, height, thickness);
        centerGeometry(geometry);
        return geometry;
    }

    // Hole (for boolean operations)
    function createHole(params) {
        const size = params.s || 1;

        const geometry = new THREE.BoxGeometry(size, size, size);
        centerGeometry(geometry);
        return geometry;
    }

    // Default block (cube)
    function createDefaultBlock() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        centerGeometry(geometry);
        return geometry;
    }

    // Get default parameters for a block type
    function getDefaultParams(type) {
        switch (type) {
            case BLOCK_TYPES.WALL:
                return { w: 4, h: 3.2, t: 0.2 };
            case BLOCK_TYPES.COLUMN:
                return { r: 0.25, h: 3, shape: 'circular' };
            case BLOCK_TYPES.BEAM:
                return { l: 4, h: 0.4, w: 0.3 };
            case BLOCK_TYPES.FOOTING:
                return { s: 1.5, h: 0.5 };
            case BLOCK_TYPES.WINDOW:
                return { w: 2, h: 1.5, d: 0.2 };
            case BLOCK_TYPES.DOOR:
                return { w: 1, h: 2.2, d: 0.05, fw: 0.1, fd: 0.15 };
            case BLOCK_TYPES.RAILING_MODERN:
                return { l: 3, h: 1.1, ps: 0.1, rs: 0.08, bs: 0.04 };
            case BLOCK_TYPES.RAILING_GLASS:
                return { l: 3, h: 1.1, ps: 0.1, rs: 0.08, gt: 0.02 };
            case BLOCK_TYPES.STAIRS:
                return { steps: 8, width: 1.2, treadDepth: 0.3, riserHeight: 0.2 };
            case BLOCK_TYPES.PARAPET:
                return { w: 4, h: 0.9, t: 0.2 };
            case BLOCK_TYPES.SHAPE:
                return { points: [{x:0,y:0,z:0},{x:2,y:0,z:0},{x:2,y:0,z:2},{x:0,y:0,z:2},{x:0,y:0,z:0}] };
            case BLOCK_TYPES.SWEEP_PATH:
                return { points: [{x:0,y:0,z:0},{x:5,y:0,z:0}], t: 0.2, h: 0.4, normal: {x:0,y:1,z:0}, rotation: 0, basePoint: {x:0,y:0} };
            case BLOCK_TYPES.HOLE:
                return { s: 1 };
            default:
                return {};
        }
    }

    // Get display name for block type
    function getDisplayName(type) {
        const names = {
            [BLOCK_TYPES.WALL]: 'Wall',
            [BLOCK_TYPES.COLUMN]: 'Column',
            [BLOCK_TYPES.BEAM]: 'Beam',
            [BLOCK_TYPES.FOOTING]: 'Footing',
            [BLOCK_TYPES.WINDOW]: 'Window',
            [BLOCK_TYPES.DOOR]: 'Door',
            [BLOCK_TYPES.RAILING_MODERN]: 'Railing Modern',
            [BLOCK_TYPES.RAILING_GLASS]: 'Railing Glass',
            [BLOCK_TYPES.STAIRS]: 'Stairs',
            [BLOCK_TYPES.PARAPET]: 'Parapet',
            [BLOCK_TYPES.HOLE]: 'Hole',
            [BLOCK_TYPES.SHAPE]: 'Shape',
            [BLOCK_TYPES.EXCAVATION]: 'Excavation',
            [BLOCK_TYPES.SHORING]: 'Shoring',
            [BLOCK_TYPES.PROFILE]: 'Profile',
            [BLOCK_TYPES.POLYLINE_WALL]: 'Polyline Wall',
            [BLOCK_TYPES.LINE_ARC]: 'Line Arc',
            [BLOCK_TYPES.LINE_CIRCLE]: 'Line Circle',
            [BLOCK_TYPES.LINE_RECTANGLE]: 'Line Rectangle',
            [BLOCK_TYPES.SWEEP_PATH]: 'Sweep Path'
        };

        return names[type] || type;
    }

    // Get icon for block type (could be extended with actual icons)
    function getIcon(type) {
        const icons = {
            [BLOCK_TYPES.WALL]: '🧱',
            [BLOCK_TYPES.COLUMN]: '🏛️',
            [BLOCK_TYPES.BEAM]: '📏',
            [BLOCK_TYPES.FOOTING]: '⬛',
            [BLOCK_TYPES.WINDOW]: '🪟',
            [BLOCK_TYPES.DOOR]: '🚪',
            [BLOCK_TYPES.RAILING_MODERN]: '↕️',
            [BLOCK_TYPES.RAILING_GLASS]: '🔲',
            [BLOCK_TYPES.STAIRS]: '📶',
            [BLOCK_TYPES.PARAPET]: '🧱',
            [BLOCK_TYPES.HOLE]: '🕳️',
            [BLOCK_TYPES.SHAPE]: '🔷'
        };

        return icons[type] || '📦';
    }

    // Validate parameters for a block type
    function validateParams(type, params) {
        const defaultParams = getDefaultParams(type);
        const validated = { ...defaultParams, ...params };

        // Additional validation logic can be added here
        // For example, ensure positive dimensions
        Object.keys(validated).forEach(key => {
            if (typeof validated[key] === 'number') {
                validated[key] = Math.max(0.01, validated[key]);
            }
        });

        return validated;
    }

    // Calculate bounding box for a block type with given parameters
    function calculateBoundingBox(type, params = {}) {
        const validatedParams = validateParams(type, params);

        switch (type) {
            case BLOCK_TYPES.WALL:
                return new THREE.Box3(
                    new THREE.Vector3(-validatedParams.w / 2, -validatedParams.h / 2, -validatedParams.t / 2),
                    new THREE.Vector3(validatedParams.w / 2, validatedParams.h / 2, validatedParams.t / 2)
                );
            case BLOCK_TYPES.COLUMN:
                return new THREE.Box3(
                    new THREE.Vector3(-validatedParams.r, -validatedParams.h / 2, -validatedParams.r),
                    new THREE.Vector3(validatedParams.r, validatedParams.h / 2, validatedParams.r)
                );
            case BLOCK_TYPES.BEAM:
                return new THREE.Box3(
                    new THREE.Vector3(-validatedParams.l / 2, -validatedParams.h / 2, -validatedParams.w / 2),
                    new THREE.Vector3(validatedParams.l / 2, validatedParams.h / 2, validatedParams.w / 2)
                );
            default:
                return new THREE.Box3(
                    new THREE.Vector3(-0.5, -0.5, -0.5),
                    new THREE.Vector3(0.5, 0.5, 0.5)
                );
        }
    }

    // Public API
    return {
        create,
        getDefaultParams,
        getDisplayName,
        getIcon,
        validateParams,
        calculateBoundingBox
    };
})();