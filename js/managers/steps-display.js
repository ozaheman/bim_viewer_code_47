import { Engine } from '../core/engine.js';
import { HistoryManager } from './history-manager.js';

export const StepsDisplay = (() => {
    // Display state
    let lastAction = '-';
    let actionCount = 0;
    let updateInterval = null;
    
    // Initialize steps display
    function init() {
        console.log('StepsDisplay initializing...');
        
        // Start update interval
        updateInterval = setInterval(updateDisplay, 1000);
        
        // Initial update
        updateDisplay();
        
        console.log('StepsDisplay initialized successfully');
    }
    
    // Update the display
    function updateDisplay() {
        const objects = Engine.getObjects();
        const selected = Engine.getSelection();
        const undoCount = HistoryManager ? HistoryManager.getUndoCount() : 0;
        const redoCount = HistoryManager ? HistoryManager.getRedoCount() : 0;
        
        // Update DOM elements
        const totalObjectsEl = document.getElementById('total-objects');
        const selectedObjectEl = document.getElementById('selected-object');
        const lastActionEl = document.getElementById('last-action');
        const undoCountEl = document.getElementById('undo-count');
        const redoCountEl = document.getElementById('redo-count');
        
        if (totalObjectsEl) {
            totalObjectsEl.textContent = objects.length;
        }
        
        if (selectedObjectEl) {
            if (selected) {
                selectedObjectEl.textContent = `${selected.config.blockType} (ID: ${selected.id})`;
            } else {
                selectedObjectEl.textContent = 'None';
            }
        }
        
        if (lastActionEl) {
            lastActionEl.textContent = lastAction;
        }
        
        if (undoCountEl) {
            undoCountEl.textContent = undoCount;
        }
        
        if (redoCountEl) {
            redoCountEl.textContent = redoCount;
        }
    }
    
    // Record an action
    function recordAction(action) {
        lastAction = `${action} (#${++actionCount})`;
        updateDisplay();
        
        // Log to console for debugging
        console.log(`Action: ${action}`);
    }
    
    // Clear actions
    function clearActions() {
        lastAction = '-';
        actionCount = 0;
        updateDisplay();
    }
    
    // Get last action
    function getLastAction() {
        return lastAction;
    }
    
    // Get action count
    function getActionCount() {
        return actionCount;
    }
    
    // Clean up
    function destroy() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    }
    
    // Public API
    return {
        init,
        updateDisplay,
        recordAction,
        clearActions,
        getLastAction,
        getActionCount,
        destroy
    };
})();