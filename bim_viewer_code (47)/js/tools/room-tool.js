import { Engine } from '../core/engine.js';
import { BLOCK_TYPES } from '../core/constants.js';
import { BlockFactory } from '../factories/block-factory.js';

export const RoomTool = (() => {
    function init(engine) {
        console.log('RoomTool initialized');
    }

    function generate() {
        const objects = Engine.getObjects();
        const walls = objects.filter(obj => 
            obj.config.blockType === BLOCK_TYPES.SPLINE_WALL || 
            obj.config.blockType === BLOCK_TYPES.WALL
        );

        if (walls.length === 0) return;

        // 1. Extract all segments
        const segments = [];
        walls.forEach(wall => {
            const p = wall.config.params;
            if (wall.config.blockType === BLOCK_TYPES.SPLINE_WALL && p.points) {
                for (let i = 0; i < p.points.length - 1; i++) {
                    segments.push({
                        p1: new THREE.Vector3(p.points[i].x, 0, p.points[i].z),
                        p2: new THREE.Vector3(p.points[i+1].x, 0, p.points[i+1].z)
                    });
                }
            } else if (wall.config.blockType === BLOCK_TYPES.WALL) {
                // Conventional wall might be centered at pos with width/depth
                // For simplicity, skip if no points. 
                // In a real app, we'd translate mesh bounds to points.
            }
        });

        if (segments.length < 3) {
            console.log('Not enough wall segments to form a room.');
            return;
        }

        // 2. Build adjacency list with tolerance
        const nodes = [];
        const adj = new Map();
        const tolerance = 0.1;

        function getOrCreateNode(v) {
            for (let node of nodes) {
                if (v.distanceTo(node) < tolerance) return node;
            }
            nodes.push(v);
            adj.set(v, []);
            return v;
        }

        segments.forEach(s => {
            const n1 = getOrCreateNode(s.p1);
            const n2 = getOrCreateNode(s.p2);
            adj.get(n1).push(n2);
            adj.get(n2).push(n1);
        });

        // 3. Find cycles (Simplified: search for polygons)
        // This is a complex graph problem. For now, let's find one cycle if possible.
        const cycles = findCycles(nodes, adj);
        
        cycles.forEach(cycle => {
            createRoomObject(cycle);
        });
    }

    function findCycles(nodes, adj) {
        // Implementation of a cycle detection algorithm (e.g., recursive DFS)
        // Finding ALL minimal cycles (faces) in a planar graph.
        const cycles = [];
        const visited = new Set();
        
        // Very basic implementation for common simple shapes
        // (Real implementation should use Planar Graph Cycle Basis)
        nodes.forEach(startNode => {
            if (!visited.has(startNode)) {
                const path = [];
                dfs(startNode, null, path, visited, adj, cycles);
            }
        });

        return cycles;
    }

    function dfs(curr, prev, path, visited, adj, cycles) {
        if (path.includes(curr)) {
            // Found a cycle
            const cycleIndex = path.indexOf(curr);
            const cycle = path.slice(cycleIndex);
            if (cycle.length >= 3) {
                // Check if this cycle is already found (ignoring order/direction)
                cycles.push(cycle);
            }
            return;
        }

        path.push(curr);
        const neighbors = adj.get(curr) || [];
        neighbors.forEach(next => {
            if (next !== prev) {
                dfs(next, curr, [...path], visited, adj, cycles);
            }
        });
        
        visited.add(curr);
    }

    function createRoomObject(points) {
        const config = {
            floor: 'Ground Floor', // Default or from context
            mat: 'glass', // Transparent look
            type: 'block',
            blockType: BLOCK_TYPES.ROOM,
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            params: {
                points: points.map(p => ({ x: p.x, y: p.y, z: p.z })),
                h: 3.0
            }
        };

        const geometry = BlockFactory.create(BLOCK_TYPES.ROOM, config.params);
        if (geometry) {
            const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.3
            }));
            Engine.addObject(config, mesh);
        }
    }

    return { generate };
})();
window.RoomTool = RoomTool;
