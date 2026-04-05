export const PanelManager = (() => {
    let openPanel = null;

    function init() {
        console.log('PanelManager initialized');
        const panels = document.querySelectorAll('.floating-panel');
        panels.forEach(makeDraggable);
    }

    function showPanel(panelId) {
        if (openPanel && openPanel.id !== panelId) {
            hidePanel(openPanel.id);
        }
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'block';
            openPanel = panel;
        }
    }

    function hidePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'none';
            if (openPanel === panel) {
                openPanel = null;
            }
        }
    }

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.panel-header');
        
        const dragTarget = header || element;
        dragTarget.onmousedown = dragMouseDown;
        dragTarget.style.cursor = 'move';

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
    
    return {
        init,
        showPanel,
        hidePanel
    };
})();