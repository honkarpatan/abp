import { BaseView } from './BaseView.js';
import { LogManager } from '../../core/LogManager.js'; // 🔥 LogManager

export class Group extends BaseView {
    async render(node) {
        // Group নিজে UI তে কিছু দেখায় না, তাই display: none
        // কিন্তু আমরা class এবং id রাখছি যাতে Logic Apply করার সময় খুঁজে পাওয়া যায়
        const attr = node.attributes;
        const idStr = attr.id ? `id="${attr.id.replace('@+id/', '')}"` : '';
        const viewId = attr.id || 'NO_ID';
        
        // Data attribute এ referenced_ids স্টোর করে রাখছি লজিকের সুবিধার জন্য
        const refIds = attr['app:constraint_referenced_ids'] || attr['constraint_referenced_ids'] || '';
        
        LogManager.i('ConstraintHelper', `Group [${viewId}] initialized. Controls: [${refIds}]`);
        
        return `<div class="android-view android-group" ${idStr} 
                    data-referenced-ids="${refIds}"
                    style="display: none !important; width: 0px; height: 0px;">
                </div>`;
    }
}