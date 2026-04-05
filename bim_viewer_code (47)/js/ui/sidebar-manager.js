export const SidebarManager = (() => {
    function init() {
        console.log('SidebarManager initialized');
        const groups = document.querySelectorAll('#sidebar .group');
        groups.forEach(group => {
            const header = group.querySelector('h4');
            if (header) {
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    // Toggle 'collapsed' class on the content div, not the group
                    const content = header.nextElementSibling;
                    if (content) {
                       content.classList.toggle('collapsed');
                       header.classList.toggle('collapsed'); // for styling the arrow if any
                    }
                });
            }
        });
    }

    return {
        init
    };
})();