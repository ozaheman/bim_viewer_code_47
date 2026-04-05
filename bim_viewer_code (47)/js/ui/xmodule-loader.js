export async function loadAllModules() {
    const modules = {
        'floor-management': './ui/modules/floor-management.html',
        'asset-library': './ui/modules/asset-library.html',
        'edit-selection': './ui/modules/edit-selection.html',
        'modeling-tools': './ui/modules/modeling-tools.html',
        'finishes-layers': './ui/modules/finishes-layers.html',
        'auto-generation': './ui/modules/auto-generation.html',
        'profile-editor': './ui/modules/profile-editor.html',
        'object-stack': './ui/modules/object-stack.html',
        'steps-display': './ui/modules/steps-display.html'
    };
    
    console.log('Loading UI modules...');
    
    for (const [moduleId, url] of Object.entries(modules)) {
        try {
            await loadModule(moduleId, url);
            console.log(`✅ Loaded module: ${moduleId}`);
        } catch (error) {
            console.error(`❌ Failed to load module ${moduleId}:`, error);
            // Create fallback content
            createFallbackContent(moduleId);
        }
    }
    
    // Initialize modules after loading
    initializeModules();
}

async function loadModule(moduleId, url) {
    const moduleElement = document.querySelector(`[data-module="${moduleId}"]`);
    if (!moduleElement) {
        throw new Error(`Module container not found: ${moduleId}`);
    }
    
    try {
        // In a real implementation, you would fetch from the URL
        // For this example, we'll simulate loading
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Get the HTML content (in real implementation, fetch from URL)
        const htmlContent = getModuleContent(moduleId);
        
        if (!htmlContent) {
            throw new Error(`No content found for module: ${moduleId}`);
        }
        
        moduleElement.innerHTML = htmlContent;
        
    } catch (error) {
        console.warn(`Using fallback for ${moduleId}:`, error.message);
        createFallbackContent(moduleId);
    }
}

function getModuleContent(moduleId) {
    // This is a simulation - in real implementation, fetch from URL
    const modulesContent = {
        'floor-management': document.querySelector('[data-module="floor-management"]')?.innerHTML || '',
        'asset-library': document.querySelector('[data-module="asset-library"]')?.innerHTML || '',
        'edit-selection': document.querySelector('[data-module="edit-selection"]')?.innerHTML || '',
        'modeling-tools': document.querySelector('[data-module="modeling-tools"]')?.innerHTML || '',
        'finishes-layers': document.querySelector('[data-module="finishes-layers"]')?.innerHTML || '',
        'auto-generation': document.querySelector('[data-module="auto-generation"]')?.innerHTML || '',
        'profile-editor': document.querySelector('[data-module="profile-editor"]')?.innerHTML || '',
        'object-stack': document.querySelector('[data-module="object-stack"]')?.innerHTML || '',
        'steps-display': document.querySelector('[data-module="steps-display"]')?.innerHTML || ''
    };
    
    return modulesContent[moduleId];
}

function createFallbackContent(moduleId) {
    const moduleElement = document.querySelector(`[data-module="${moduleId}"]`);
    if (!moduleElement) return;
    
    const fallbackContent = {
        'floor-management': `<h4>Site & Floor Management</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'asset-library': `<h4>Asset Library</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'edit-selection': `<h4>Edit Selection</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'modeling-tools': `<h4>Modeling Tools</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'finishes-layers': `<h4>Finishes & Layers</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'auto-generation': `<h4>Auto Generation</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'profile-editor': `<h4>Profile Editor</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'object-stack': `<h4>Object Stack</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`,
        'steps-display': `<h4>Steps Display</h4><p style="color: #888; font-size: 11px;">Loading failed. Please refresh.</p>`
    };
    
    moduleElement.innerHTML = fallbackContent[moduleId] || `<p>Module ${moduleId} failed to load</p>`;
}

function initializeModules() {
    console.log('Initializing UI modules...');
    
    // Initialize asset library drag and drop
    initializeAssetLibrary();
    
    // Initialize edit selection events
    initializeEditSelection();
    
    // Initialize tool buttons
    initializeToolButtons();
    
    // Initialize other module-specific functionality
    initializeModuleSpecificFeatures();
}

function initializeAssetLibrary() {
    const assetButtons = document.querySelectorAll('.asset-btn');
    assetButtons.forEach(btn => {
        btn.addEventListener('dragstart', (e) => {
            const blockType = e.target.dataset.type;
            e.dataTransfer.setData('text/plain', blockType);
            
            // Set drag image (optional)
            const dragIcon = document.createElement('div');
            dragIcon.textContent = blockType;
            dragIcon.style.position = 'absolute';
            dragIcon.style.background = '#007acc';
            dragIcon.style.color = 'white';
            dragIcon.style.padding = '5px 10px';
            dragIcon.style.borderRadius = '3px';
            document.body.appendChild(dragIcon);
            e.dataTransfer.setDragImage(dragIcon, 10, 10);
            setTimeout(() => document.body.removeChild(dragIcon), 0);
        });
        
        // Add click handler if not already present
        if (!btn.onclick) {
            btn.addEventListener('click', (e) => {
                const blockType = e.currentTarget.dataset.type;
                if (window.App && window.App.startClickPlacement) {
                    window.App.startClickPlacement(blockType);
                }
            });
        }
    });
    
    console.log(`✅ Initialized ${assetButtons.length} asset buttons`);
}

function initializeEditSelection() {
    // Add live edit listeners to all edit inputs
    const editInputs = document.querySelectorAll('#edit-selection input, #edit-selection select');
    editInputs.forEach(input => {
        if (input.id.startsWith('e-')) {
            input.addEventListener('input', () => {
                if (window.App && window.App.onLiveEdit) {
                    window.App.onLiveEdit();
                }
            });
            
            input.addEventListener('change', () => {
                if (window.App && window.App.onLiveEdit) {
                    window.App.onLiveEdit();
                }
            });
        }
    });
    
    console.log(`✅ Initialized ${editInputs.length} edit inputs`);
}

function initializeToolButtons() {
    // Initialize tool button active states
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from siblings
            const parent = this.parentElement;
            if (parent.id === 'snap-point-modes' || parent.id === 'gizmo-bar' || parent.classList.contains('row')) {
                const siblings = parent.querySelectorAll('.tool-btn');
                siblings.forEach(sib => sib.classList.remove('active-tool'));
                this.classList.add('active-tool');
            }
        });
    });
    
    console.log(`✅ Initialized ${toolButtons.length} tool buttons`);
}

function initializeModuleSpecificFeatures() {
    // Initialize STL import button
    const stlImportBtn = document.querySelector('button[onclick*="stl-importer"]');
    if (stlImportBtn) {
        stlImportBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('stl-importer');
            if (fileInput) {
                fileInput.click();
            }
        });
    }
    
    // Initialize other module-specific features here
    console.log('✅ Initialized module-specific features');
}

// Export additional utility functions
export function reloadModule(moduleId) {
    const modules = {
        'floor-management': './ui/modules/floor-management.html',
        'asset-library': './ui/modules/asset-library.html',
        'edit-selection': './ui/modules/edit-selection.html',
        'modeling-tools': './ui/modules/modeling-tools.html',
        'finishes-layers': './ui/modules/finishes-layers.html',
        'auto-generation': './ui/modules/auto-generation.html',
        'profile-editor': './ui/modules/profile-editor.html',
        'object-stack': './ui/modules/object-stack.html',
        'steps-display': './ui/modules/steps-display.html'
    };
    
    if (modules[moduleId]) {
        return loadModule(moduleId, modules[moduleId]);
    }
}

export function refreshAllModules() {
    console.log('Refreshing all UI modules...');
    return loadAllModules();
}