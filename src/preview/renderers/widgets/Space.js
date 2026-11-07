// claude 

import { BaseView } from './BaseView.js';

/**
 * Space - Invisible layout spacer
 * Used in GridLayout to create empty cells
 */
export class Space extends BaseView {
    async render(node, parentType) {
        // Space is completely invisible but takes up layout space
        const attr = node.attributes;
        const baseStyle = await this.getBaseStyles(attr, parentType);
        
        // Make it invisible
        const spaceStyle = `${baseStyle} visibility: hidden !important; pointer-events: none !important;`;
        
        return `<div class="android-view space-view" style="${spaceStyle}"></div>`;
    }
}