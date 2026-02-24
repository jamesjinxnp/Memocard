/**
 * S-Curve Path Layout
 * 
 * Nodes flow along a smooth continuous sine wave:
 * 
 *       ●           
 *         ●         → smooth curve right
 *           ●       
 *         ●         
 *       ●           → center
 *     ●             
 *   ●               → smooth curve left
 *     ●             
 *       ●           → center (repeat)
 */

export interface PathPosition {
    x: number;  // Percentage from left (0-100)
    y: number;  // Pixel offset from top
}

const VERTICAL_SPACING = 80;  // px between nodes
const CENTER_X = 50;          // center of container
const AMPLITUDE = 18;         // how far left/right from center (%)
const WAVE_PERIOD = 6;        // nodes per full sine wave cycle

/**
 * Returns smooth S-curve position using sine wave.
 */
export function getDuolingoPosition(index: number, _total: number): PathPosition {
    // Sine wave: smooth continuous curve
    const angle = (index / WAVE_PERIOD) * Math.PI * 2;
    const offset = Math.sin(angle) * AMPLITUDE;

    return {
        x: CENTER_X + offset,
        y: index * VERTICAL_SPACING,
    };
}

/**
 * Returns the total pixel height needed for the node path.
 */
export function getPathHeight(nodeCount: number): number {
    return (nodeCount - 1) * VERTICAL_SPACING + 80;
}

/**
 * Generate a smooth SVG path string through all node positions.
 * Uses Catmull-Rom-to-Bezier conversion for a natural flowing curve.
 */
export function getSmoothPath(positions: PathPosition[]): string {
    if (positions.length < 2) return '';

    const points = positions.map(p => ({ x: p.x, y: p.y + 30 })); // +30 to center on node

    // Start at first point
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        // Catmull-Rom to Cubic Bezier control points
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return d;
}

// Legacy export
export function getSnakePosition(index: number, columns: number = 4) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const actualCol = row % 2 !== 0 ? columns - 1 - col : col;
    return { row, col: actualCol };
}
