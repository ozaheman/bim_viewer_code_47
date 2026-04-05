import { Engine } from '../core/engine.js';
import { BlockFactory } from '../factories/block-factory.js';
import { HistoryManager } from '../managers/history-manager.js';

export const PlacementTool = (() => {
    let state = {
        active: false,
        type: 'window',
        points: [],
        wall: null
    };

    function init(engine) {
        console.log('PlacementTool initialized');
    }

    function start(type) {
        state.active = true;
        state.type = type;
        state.points = [];
        state.wall = null;
        console.log(`PlacementTool started for ${type}`);
    }

    function onPointSelection(point, wall) {
        if (!state.active) return;
        
        state.points.push(point);
        state.wall = wall;

        if (state.points.length === 2) {
            finish();
        }
    }

    function finish() {
        if (state.points.length < 2) return;

        const p1 = state.points[0];
        const p2 = state.points[1];
        
        // Calculate center, width, and rotation
        const center = p1.clone().add(p2).multiplyScalar(0.5);
        const width = p1.distanceTo(p2);
        
        const direction = p2.clone().sub(p1).normalize();
        const angle = Math.atan2(direction.x, direction.z);

        const config = {
            floor: state.wall ? state.wall.config.floor : 'Ground Floor',
            mat: 'glass',
            type: 'block',
            blockType: getBlockType(state.type),
            pos: { x: center.x, y: center.y, z: center.z },
            rot: { x: 0, y: angle, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            params: {
                w: width,
                h: 2.2,
                d: 0.2
            }
        };

        const asset = BlockFactory.create(config.blockType, config.params);
        if (asset) {
            HistoryManager.save(Engine.getObjects());
            Engine.addObject(config, asset);
        }

        exit();
    }

    function getBlockType(type) {
        switch(type) {
            case 'window': return 'window-2-pane';
            case 'door': return 'door-detailed';
            case 'curtain-wall': return 'wall'; // Simple wall for now
            case 'railing': return 'railing-modern';
            case 'divider': return 'wall'; // thin wall?
            default: return 'window-2-pane';
        }
    }

    function exit() {
        state.active = false;
        state.points = [];
    }

    return { start, onPointSelection, exit };
})();
window.PlacementTool = PlacementTool;
