import { Engine } from '../core/engine.js';

export const FinishesManager = (() => {

    function init() {
        console.log('FinishesManager initialized');
        window.FinishesManager = this;
    }
    
    function updateFinishUI() {
        const sel = Engine.getSelection();
        const finishControls = document.getElementById('finish-controls');
        const finishStatus = document.getElementById('finish-status');
        
        if (sel && (sel.config.blockType === 'wall' || sel.config.blockType === 'column')) {
            if(finishControls) finishControls.style.display = 'block';
            if(finishStatus) finishStatus.textContent = `Editing finishes for: ${sel.config.blockType} (ID: ${sel.id})`;
        } else {
            if(finishControls) finishControls.style.display = 'none';
            if(finishStatus) finishStatus.textContent = 'Select a wall/column to add finishes';
        }
    }
    
    function applyFinishes() {
        alert('Applying finishes is a visual placeholder in this version.');
    }
    
    function removeFinishes() {
        alert('Removing finishes is a visual placeholder in this version.');
    }
    
    return {
        init,
        updateFinishUI,
        applyFinishes,
        removeFinishes,
    };
})();