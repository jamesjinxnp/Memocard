/**
 * Utility functions for calculating Snake Path layout
 */

interface GridPosition {
    row: number;
    col: number;
}

/**
 * Calculates the grid position for a node in a snake (zigzag) pattern.
 * 
 * Pattern:
 * Row 0: 0 -> 1 -> 2 -> 3
 * Row 1: 3 <- 2 <- 1 <- 0 (Reversed)
 * Row 2: 0 -> 1 -> 2 -> 3
 * 
 * @param index The index of the node in the sequence
 * @param columns Total number of columns in the grid
 * @returns {GridPosition} The { row, col } coordinates (0-based)
 */
export function getSnakePosition(index: number, columns: number = 4): GridPosition {
    const row = Math.floor(index / columns);
    const col = index % columns;

    // Reverse direction on odd rows (1, 3, 5...)
    const actualCol = row % 2 !== 0 ? columns - 1 - col : col;

    return { row, col: actualCol };
}

/**
 * Calculates the SVG line path string for connecting two nodes
 */
export function getPathLine(
    start: GridPosition,
    end: GridPosition,
    cellWidth: number,
    cellHeight: number
): string {
    // Basic straight line for now, can be improved to curves
    const x1 = start.col * cellWidth + cellWidth / 2;
    const y1 = start.row * cellHeight + cellHeight / 2;
    const x2 = end.col * cellWidth + cellWidth / 2;
    const y2 = end.row * cellHeight + cellHeight / 2;
    return `M ${x1} ${y1} L ${x2} ${y2}`;
}
