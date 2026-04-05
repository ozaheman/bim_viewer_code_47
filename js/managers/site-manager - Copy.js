import { Engine } from '../core/engine.js';
import { DEFAULTS } from '../core/constants.js';

export const SiteManager = (() => {
    // Site state
    let plotMesh = null;
    let siteBoundary = null;
    let plotDimensions = {
        width: DEFAULTS.PLOT_WIDTH,
        length: DEFAULTS.PLOT_LENGTH
    };
    
    // Initialize site manager
    function init() {
        console.log('SiteManager initializing...');
         window.SiteManager = this; // Expose to global scope for onclick handlers
        // Generate initial plot
        generatePlot();
        
        console.log('SiteManager initialized successfully');
    }
    
    // Generate plot with current dimensions
    function generatePlot() {
        const width = parseFloat(document.getElementById('plot-width')?.value) || DEFAULTS.PLOT_WIDTH;
        const length = parseFloat(document.getElementById('plot-length')?.value) || DEFAULTS.PLOT_LENGTH;
        
        // Update dimensions
        plotDimensions = { width, length };
        
        // Get scene
        const scene = Engine.getScene();
        if (!scene) return;
        
        // Remove existing plot
        if (plotMesh) {
            scene.remove(plotMesh);
            if (plotMesh.geometry) plotMesh.geometry.dispose();
            if (plotMesh.material) plotMesh.material.dispose();
        }
        
        if (siteBoundary) {
            scene.remove(siteBoundary);
            if (siteBoundary.geometry) siteBoundary.geometry.dispose();
            if (siteBoundary.material) siteBoundary.material.dispose();
        }
        
        // Create plot surface
        const plotGeometry = new THREE.PlaneGeometry(width, length);
        const plotMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8B4513, // Brown soil color
            side: THREE.DoubleSide,
            roughness: 0.9
        });
        
        plotMesh = new THREE.Mesh(plotGeometry, plotMaterial);
        plotMesh.rotation.x = -Math.PI / 2;
        plotMesh.position.y = -0.01; // Slightly below ground
        plotMesh.receiveShadow = true;
        scene.add(plotMesh);
        
        // Create site boundary
        const boundaryPoints = [
            new THREE.Vector3(-width/2, 0.02, -length/2),
            new THREE.Vector3(width/2, 0.02, -length/2),
            new THREE.Vector3(width/2, 0.02, length/2),
            new THREE.Vector3(-width/2, 0.02, length/2),
            new THREE.Vector3(-width/2, 0.02, -length/2)
        ];
        
        const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
        const boundaryMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 2
        });
        
        siteBoundary = new THREE.Line(boundaryGeometry, boundaryMaterial);
        scene.add(siteBoundary);
        
        // Create corner markers
        createCornerMarkers(width, length);
        
        // Emit plot changed event
        Engine.emitEvent('plot-changed', plotDimensions);
        
        // Update steps display
        if (window.StepsDisplay && window.StepsDisplay.recordAction) {
            window.StepsDisplay.recordAction(`Generated Plot: ${width}m x ${length}m`);
        }
        
        // Update excavation calculations if needed
        if (window.ExcavationManager && window.ExcavationManager.calculateVolumes) {
            window.ExcavationManager.calculateVolumes();
        }
    }
    
    // Create corner markers
    function createCornerMarkers(width, length) {
        const scene = Engine.getScene();
        if (!scene) return;
        
        // Remove existing corner markers
        scene.traverse(child => {
            if (child.userData?.isCornerMarker) {
                scene.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        
        // Create new corner markers
        const corners = [
            { x: -width/2, z: -length/2, label: 'SW' },
            { x: width/2, z: -length/2, label: 'SE' },
            { x: width/2, z: length/2, label: 'NE' },
            { x: -width/2, z: length/2, label: 'NW' }
        ];
        
        corners.forEach(corner => {
            // Create marker geometry
            const markerGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(corner.x, 0.25, corner.z);
            marker.userData = { isCornerMarker: true };
            scene.add(marker);
            
            // Create label
            createCornerLabel(corner.x, corner.z, corner.label);
        });
    }
    
    // Create corner label
    function createCornerLabel(x, z, text) {
        const scene = Engine.getScene();
        if (!scene) return;
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 32;
        
        context.fillStyle = '#00ff00';
        context.font = 'bold 16px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 32, 16);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x, 1, z);
        sprite.scale.set(4, 2, 1);
        sprite.userData = { isCornerLabel: true };
        scene.add(sprite);
    }
    
    // Get plot dimensions
    function getPlotDimensions() {
        return { ...plotDimensions };
    }
    
    // Set plot dimensions
    function setPlotDimensions(width, length) {
        plotDimensions = { width, length };
        
        // Update UI inputs
        const widthInput = document.getElementById('plot-width');
        const lengthInput = document.getElementById('plot-length');
        
        if (widthInput) widthInput.value = width;
        if (lengthInput) lengthInput.value = length;
        
        // Regenerate plot
        generatePlot();
    }
    
    // Get plot center
    function getPlotCenter() {
        return new THREE.Vector3(0, 0, 0);
    }
    
    // Get plot bounds
    function getPlotBounds() {
        return {
            minX: -plotDimensions.width / 2,
            maxX: plotDimensions.width / 2,
            minZ: -plotDimensions.length / 2,
            maxZ: plotDimensions.length / 2,
            minY: -0.01,
            maxY: 100 // Arbitrary high value
        };
    }
    
    // Check if point is within plot
    function isPointInPlot(x, z) {
        const bounds = getPlotBounds();
        return x >= bounds.minX && x <= bounds.maxX && 
               z >= bounds.minZ && z <= bounds.maxZ;
    }
    
    // Get plot area
    function getPlotArea() {
        return plotDimensions.width * plotDimensions.length;
    }
    
    // Public API
    return {
        init,
        generatePlot,
        getPlotDimensions,
        setPlotDimensions,
        getPlotCenter,
        getPlotBounds,
        isPointInPlot,
        getPlotArea
    };
})();