import { Engine } from '../core/engine.js';
import { HISTORY_LIMITS } from '../core/constants.js';

export const HistoryManager = (() => {
    // History state
    let historyStack = [];
    let currentIndex = -1;
    let isRestoring = false;
    
    // Initialize history manager
    function init() {
        console.log('HistoryManager initializing...');
        window.HistoryManager = this; // Expose to global scope for onclick handlers
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('HistoryManager initialized successfully');
    }
    
    // Setup event listeners
    function setupEventListeners() {
        // Listen for undo/redo requests
        Engine.addEventListener('undo-request', undo);
        Engine.addEventListener('redo-request', redo);
        
        // Listen for object changes that should trigger history saves
        Engine.addEventListener('object-added', () => {
            if (!isRestoring) {
                save();
            }
        });
        
        Engine.addEventListener('object-removed', () => {
            if (!isRestoring) {
                save();
            }
        });
        
        Engine.addEventListener('transform-end', () => {
            if (!isRestoring) {
                save();
            }
        });
    }
    
    // Save current state to history
    function save() {
        // Don't save if we're restoring a state
        if (isRestoring) return;
        
        const objects = Engine.getObjects();
        
        // Remove any future states if we're not at the end
        if (currentIndex < historyStack.length - 1) {
            historyStack = historyStack.slice(0, currentIndex + 1);
        }
        
        // Create snapshot of current state
        const snapshot = objects.map(obj => {
            const config = JSON.parse(JSON.stringify(obj.config));
            
            // For custom geometry or groups, we need to save geometry data
            if (config.type === 'Custom' || obj.mesh.geometry?.userData?.isEdited || obj.mesh.isGroup) {
                // Note: This is a simplified approach
                // In a real implementation, you'd need to properly serialize geometry
                config.geoData = 'custom'; // Placeholder
                delete config.geo;
            }
            
            return config;
        });
        
        // Add to history stack
        historyStack.push(snapshot);
        currentIndex++;
        
        // Limit history size
        if (historyStack.length > HISTORY_LIMITS.MAX_UNDO) {
            historyStack.shift();
            currentIndex--;
        }
        
        // Update UI
        updateHistoryUI();
        
        // Record action
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction('History saved');
        }
    }
    
    // Undo last action
    function undo() {
        if (currentIndex <= 0) {
            console.log('Nothing to undo');
            return;
        }
        
        currentIndex--;
        restoreState(historyStack[currentIndex]);
        
        // Update UI
        updateHistoryUI();
        
        // Record action
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction('Undo');
        }
    }
    
    // Redo last undone action
    function redo() {
        if (currentIndex >= historyStack.length - 1) {
            console.log('Nothing to redo');
            return;
        }
        
        currentIndex++;
        restoreState(historyStack[currentIndex]);
        
        // Update UI
        updateHistoryUI();
        
        // Record action
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction('Redo');
        }
    }
    
    // Restore state from snapshot
    function restoreState(snapshot) {
        isRestoring = true;
        
        try {
            Engine.restoreState(snapshot);
            
            // Restore any additional state that needs to be reconstructed
            if (snapshot && Array.isArray(snapshot)) {
                // Reconstruct custom geometry if needed
                snapshot.forEach(config => {
                    if (config.geoData === 'custom') {
                        // Reconstruct custom geometry
                        // This would need actual geometry reconstruction logic
                    }
                });
            }
            
            // Update script
            if (window.App && window.App.generateScript) {
                window.App.generateScript();
            }
            
        } catch (error) {
            console.error('Error restoring state:', error);
        } finally {
            isRestoring = false;
        }
    }
    
    // Clear history
    function clear() {
        historyStack = [];
        currentIndex = -1;
        updateHistoryUI();
    }
    
    // Update history UI
    function updateHistoryUI() {
        // Update undo/redo button states
        const undoBtn = document.querySelector('#undo-bar button:nth-child(1)');
        const redoBtn = document.querySelector('#undo-bar button:nth-child(2)');
        
        if (undoBtn) {
            undoBtn.disabled = currentIndex <= 0;
        }
        
        if (redoBtn) {
            redoBtn.disabled = currentIndex >= historyStack.length - 1;
        }
        
        // Update steps display if available
        if (window.StepsDisplay && window.StepsDisplay.updateDisplay) {
            window.StepsDisplay.updateDisplay();
        }
    }
    
    // Get undo count
    function getUndoCount() {
        return Math.max(0, currentIndex);
    }
    
    // Get redo count
    function getRedoCount() {
        return Math.max(0, historyStack.length - currentIndex - 1);
    }
    
    // Get current history index
    function getCurrentIndex() {
        return currentIndex;
    }
    
    // Get history stack size
    function getHistorySize() {
        return historyStack.length;
    }
    
    // Check if can undo
    function canUndo() {
        return currentIndex > 0;
    }
    
    // Check if can redo
    function canRedo() {
        return currentIndex < historyStack.length - 1;
    }
    
    // Public API
    return {
        init,
        save,
        undo,
        redo,
        clear,
        getUndoCount,
        getRedoCount,
        getCurrentIndex,
        getHistorySize,
        canUndo,
        canRedo
    };
})();