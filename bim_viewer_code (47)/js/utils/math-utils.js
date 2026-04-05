export const MathUtils = {
    // Clamp a value between a minimum and maximum
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    // Linearly interpolate between two values
    lerp(a, b, t) {
        return a * (1 - t) + b * t;
    },

    // Convert degrees to radians
    degToRad(degrees) {
        return degrees * (Math.PI / 180);
    },

    // Convert radians to degrees
    radToDeg(radians) {
        return radians * (180 / Math.PI);
    },
};