import { BaseView } from './BaseView.js';
import { LogManager } from '../../core/LogManager.js'; // 🔥 LogManager

export class Barrier extends BaseView {
    
    async render(node, parentType) {
        const attr = node.attributes;
        const idStr = attr.id ? `id="${attr.id.replace('@+id/', '')}"` : '';
        const viewId = attr.id || 'NO_ID';
        
        const direction = attr['app:barrierDirection'] || attr['barrierDirection'] || 'undefined';
        const referencedIds = attr['app:constraint_referenced_ids'] || attr['constraint_referenced_ids'] || '';

        LogManager.i('ConstraintHelper', `Barrier [${viewId}] initialized. Direction: ${direction}, Refs: [${referencedIds}]`);

        // Barrier is a virtual helper. 
        // 'display: none' সরালাম। কারণ এটি থাকলে DOM measurement-এ সমস্যা হতে পারে।
        // তার বদলে 'visibility: hidden' এবং 0 size দিচ্ছি।
        
        return `<div class="android-view android-barrier" ${idStr} 
                    data-barrier-direction="${direction}"
                    data-referenced-ids="${referencedIds}"
                    style="visibility: hidden; position: absolute; width: 0px; height: 0px; top: 0; left: 0;">
                </div>`;
    }
}