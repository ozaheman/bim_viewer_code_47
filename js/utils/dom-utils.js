export const DOMUtils = {
    // Query selector shorthand
    $(selector, parent = document) {
        return parent.querySelector(selector);
    },

    // Query selector all shorthand
    $$(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    },

    // Create an element with optional classes and attributes
    create(tag, options = {}) {
        const el = document.createElement(tag);
        if (options.class) {
            el.className = Array.isArray(options.class) ? options.class.join(' ') : options.class;
        }
        if (options.text) {
            el.textContent = options.text;
        }
        if (options.attrs) {
            for (const [key, value] of Object.entries(options.attrs)) {
                el.setAttribute(key, value);
            }
        }
        return el;
    },

    // Show an element
    show(element) {
        if (element) element.style.display = 'block';
    },

    // Hide an element
    hide(element) {
        if (element) element.style.display = 'none';
    },
};