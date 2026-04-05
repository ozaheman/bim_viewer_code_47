import { Engine } from '../core/engine.js';
import { HISTORY_LIMITS } from '../core/constants.js';

export const ObjectStackManager = (() => {
    // Stack state
    let objectStack = [];
    let hiddenObjects = new Set();
    let isolatedObjects = new Set();
    let currentIndex = -1;
    let currentFilter = null;
    
    // Initialize object stack manager
    function init() {
        console.log('ObjectStackManager initializing...');
        
        // Make manager globally available for inline HTML onclick events
        window.ObjectStackManager = this;
        
        // Load initial UI
        updateUI();
        
        // Listen for object events
        Engine.addEventListener('object-added', (obj) => {
            addToStack(obj);
        });
        
        Engine.addEventListener('object-removed', (obj) => {
            removeFromStack(obj.id);
        });
        
        Engine.addEventListener('object-selected', (obj) => {
            selectFromId(obj.id);
        });
        
        Engine.addEventListener('object-deselected', () => {
             // Clear selection highlight in stack
            currentIndex = -1;
            updateUI();
        });
        
        console.log('ObjectStackManager initialized successfully');
    }
    
    // Add object to stack
    function addToStack(obj) {
        if (!obj || !obj.id) return;
        
        // Remove if exists (update)
        const existingIndex = objectStack.findIndex(o => o.id === obj.id);
        if (existingIndex > -1) {
            objectStack.splice(existingIndex, 1);
        }
        
        // Add to beginning
        objectStack.unshift({
            id: obj.id,
            name: obj.config.blockType || 'Unknown',
            type: obj.config.type || 'block',
            floor: obj.config.floor || 'Unknown',
            timestamp: new Date().toISOString(),
            object: obj,
            visible: true
        });
        
        // Limit stack size
        if (objectStack.length > HISTORY_LIMITS.MAX_STACK_SIZE) {
            const removed = objectStack.pop();
            if (removed) {
                hiddenObjects.delete(removed.id);
                isolatedObjects.delete(removed.id);
            }
        }
        
        updateUI();
    }
    
    // Remove object from stack
    function removeFromStack(objId) {
        const index = objectStack.findIndex(item => item.id === objId);
        if (index > -1) {
            objectStack.splice(index, 1);
        }
        hiddenObjects.delete(objId);
        isolatedObjects.delete(objId);
        updateUI();
    }
    
    // Toggle object visibility
    function toggleVisibility(objId) {
        const item = objectStack.find(item => item.id === objId);
        if (!item) return;
        
        const isHidden = hiddenObjects.has(objId);
        
        if (isHidden) {
            // Show object
            hiddenObjects.delete(objId);
            item.object.mesh.visible = true;
            item.visible = true;
        } else {
            // Hide object
            hiddenObjects.add(objId);
            item.object.mesh.visible = false;
            item.visible = false;
        }
        
        updateUI();
        
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction(`${isHidden ? 'Showed' : 'Hid'} object: ${item.name}`);
        }
    }
    
    // Toggle object isolation
    function toggleIsolation(objId) {
        const item = objectStack.find(item => item.id === objId);
        if (!item) return;
        
        const isIsolated = isolatedObjects.has(objId);
        
        if (isIsolated) {
            // Remove isolation
            isolatedObjects.delete(objId);
            resetAllVisibility();
        } else {
            // Isolate this object
            isolatedObjects.clear();
            isolatedObjects.add(objId);
            
            // Hide all other objects
            objectStack.forEach(stackItem => {
                if (stackItem.id !== objId) {
                    stackItem.object.mesh.visible = false;
                    hiddenObjects.add(stackItem.id);
                }
            });
            
            // Show isolated object
            item.object.mesh.visible = true;
            hiddenObjects.delete(objId);
        }
        
        updateUI();
        
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction(`${isIsolated ? 'Removed isolation from' : 'Isolated'} object: ${item.name}`);
        }
    }
    
    // Show all objects
    function showAll() {
        objectStack.forEach(item => {
            item.object.mesh.visible = true;
            hiddenObjects.delete(item.id);
            item.visible = true;
        });
        isolatedObjects.clear();
        updateUI();
        
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction('Showed all objects');
        }
    }
    
    // Hide all objects
    function hideAll() {
        objectStack.forEach(item => {
            item.object.mesh.visible = false;
            hiddenObjects.add(item.id);
            item.visible = false;
        });
        isolatedObjects.clear();
        updateUI();
        
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction('Hid all objects');
        }
    }
    
    // Reset all visibility
    function resetAllVisibility() {
        objectStack.forEach(item => {
            item.object.mesh.visible = true;
            hiddenObjects.delete(item.id);
            item.visible = true;
        });
        isolatedObjects.clear();
        updateUI();
    }
    
    // Filter by floor
    function filterByFloor(floorName) {
        currentFilter = floorName;
        updateUI();
    }
    
    // Clear filter
    function clearFilter() {
        currentFilter = null;
        updateUI();
    }
    
    // Select object by ID
    function selectFromId(objId) {
        const index = objectStack.findIndex(item => item.id === objId);
        if (index > -1) {
            selectFromStack(index);
        } else {
            currentIndex = -1;
            updateUI();
        }
    }
    
    // Select object from stack index
    function selectFromStack(index) {
        if (index < 0 || index >= objectStack.length) return;
        
        const item = objectStack[index];
        
        // Find the actual current index in the full stack
        const fullStackIndex = objectStack.findIndex(o => o.id === item.id);
        if (fullStackIndex > -1) {
             currentIndex = fullStackIndex;
        }

        if (item && item.object) {
            Engine.selectObject(item.object);
            
            // Ensure object is visible when selected
            if (hiddenObjects.has(item.id)) {
                toggleVisibility(item.id);
            }
        }
        
        updateUI();
    }
    
    // Select previous object
    function selectPrevious() {
        if (objectStack.length === 0) return;
        
        currentIndex = (currentIndex - 1 + objectStack.length) % objectStack.length;
        selectFromStack(currentIndex);
    }
    
    // Select next object
    function selectNext() {
        if (objectStack.length === 0) return;
        
        currentIndex = (currentIndex + 1) % objectStack.length;
        selectFromStack(currentIndex);
    }
    
    // Clear stack
    function clearStack() {
        objectStack = [];
        hiddenObjects.clear();
        isolatedObjects.clear();
        currentIndex = -1;
        currentFilter = null;
        updateUI();
        
        if (window.StepsDisplay) {
            window.StepsDisplay.recordAction('Cleared object stack');
        }
    }
    
    // Update UI
    function updateUI() {
        const container = document.querySelector('[data-module="object-stack"]');
        if (!container) return;

        // If the module hasn't been loaded yet, just return
        const stackElement = container.querySelector('#object-stack');
        if (!stackElement) return;

        // Filter objects if needed
        let displayObjects = objectStack;
        if (currentFilter) {
            displayObjects = objectStack.filter(item => item.floor === currentFilter);
        }
        
        // Calculate counts
        const total = objectStack.length;
        const visible = total - hiddenObjects.size;
        const isolated = isolatedObjects.size;
        
        // Update header
        const header = stackElement.querySelector('.object-count');
        if (header) {
            header.textContent = `Total: ${total} | Visible: ${visible} | Isolated: ${isolated}`;
        }
        
        // Clear previous items but keep header and controls
        while (stackElement.querySelector('.stack-item')) {
            stackElement.querySelector('.stack-item').remove();
        }

        // Add stack items
        displayObjects.forEach((item) => {
            const isSelected = item.id === (objectStack[currentIndex] ? objectStack[currentIndex].id : -1);
            const isHidden = hiddenObjects.has(item.id);
            const isIsolated = isolatedObjects.has(item.id);
            
            let itemClass = 'stack-item';
            if (isSelected) itemClass += ' selected';
            if (isHidden) itemClass += ' hidden';
            if (isIsolated) itemClass += ' isolated';
            
            const itemEl = document.createElement('div');
            itemEl.className = itemClass;
            itemEl.dataset.objId = item.id;
            
            itemEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="visibility-indicator ${isHidden ? 'hidden' : isIsolated ? 'isolated' : 'visible'}"></div>
                    <div>
                        <div style="font-weight: bold; font-size: 11px;">${item.name}</div>
                        <div style="font-size: 9px; color: #aaa;">
                            ID: ${item.id} | Floor: ${item.floor}
                        </div>
                    </div>
                </div>
                <div class="stack-actions">
                    <button class="stack-action-btn" data-action="toggle-visibility" title="${isHidden ? 'Show' : 'Hide'}">
                        ${isHidden ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button class="stack-action-btn" data-action="toggle-isolation" title="${isIsolated ? 'Unisolate' : 'Isolate'}">
                        ${isIsolated ? '🔗' : '🔒'}
                    </button>
                </div>
            `;

            stackElement.appendChild(itemEl);
        });
        
        // Add click handlers using event delegation
        stackElement.onclick = (e) => {
            const itemEl = e.target.closest('.stack-item');
            if (!itemEl) return;

            const objId = parseInt(itemEl.dataset.objId);
            const actionBtn = e.target.closest('.stack-action-btn');

            if (actionBtn) {
                const action = actionBtn.dataset.action;
                if (action === 'toggle-visibility') toggleVisibility(objId);
                if (action === 'toggle-isolation') toggleIsolation(objId);
            } else {
                const itemIndex = displayObjects.findIndex(o => o.id === objId);
                if (itemIndex > -1) {
                    selectFromStack(itemIndex);
                }
            }
        };
        
        // Show empty message if no objects
        if (displayObjects.length === 0 && !stackElement.querySelector('.empty-stack-message')) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-stack-message';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.padding = '20px';
            emptyMsg.style.color = '#888';
            emptyMsg.style.fontSize = '11px';
            emptyMsg.textContent = currentFilter ? `No objects on floor: ${currentFilter}` : 'No objects in stack';
            stackElement.appendChild(emptyMsg);
        } else if (displayObjects.length > 0) {
            const emptyMsg = stackElement.querySelector('.empty-stack-message');
            if (emptyMsg) emptyMsg.remove();
        }
    }
    
    // Get object stack
    function getStack() {
        return [...objectStack];
    }
    
    // Get hidden objects
    function getHiddenObjects() {
        return new Set(hiddenObjects);
    }
    
    // Get isolated objects
    function getIsolatedObjects() {
        return new Set(isolatedObjects);
    }

    // Public API
    return {
        init,
        addToStack,
        removeFromStack,
        toggleVisibility,
        toggleIsolation,
        showAll,
        hideAll,
        resetAllVisibility,
        filterByFloor,
        clearFilter,
        selectFromId,
        selectFromStack,
        selectPrevious,
        selectNext,
        clearStack,
        updateUI,
        getStack,
        getHiddenObjects,
        getIsolatedObjects
    };
})();