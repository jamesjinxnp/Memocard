/**
 * Generate a nanoid-style unique ID
 */
export function nanoid(size: number = 21): string {
    const alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
    let id = '';
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    for (let i = 0; i < size; i++) {
        id += alphabet[bytes[i] & 63];
    }
    return id;
}
