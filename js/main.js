import { App } from './core/app.js';
import { loadAllModules } from './ui/module-loader.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded. Initializing application...');

    // Expose the main App object to the window for inline HTML event handlers.
    // This is necessary because the loaded HTML modules have `onclick="App.someFunction()"`
    window.App = App;

    // First, load the HTML for the UI modules into the sidebar.
    // This is async and must complete before the App can initialize,
    // as the App relies on DOM elements created by these modules.
    loadAllModules().then(() => {
        console.log('All UI modules loaded.');
        
        // Now that the DOM is fully populated, initialize the main application logic.
        // The App's init() function will orchestrate the initialization of all other managers and tools.
        App.init();

        console.log('BIM Editor initialized successfully.');
    }).catch(error => {
        console.error("Failed to initialize BIM Editor:", error);
    });
});