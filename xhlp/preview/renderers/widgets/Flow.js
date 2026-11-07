import { BaseView } from './BaseView.js';
import { LogManager } from '../../core/LogManager.js'; // 🔥 LogManager

export class Flow extends BaseView {
    async render(node) {
        const attr = node.attributes;
        const idStr = attr.id ? `id="${attr.id.replace('@+id/', '')}"` : '';
        const viewId = attr.id || 'NO_ID';
        
        // Data attribute এ referenced_ids স্টোর করে রাখছি লজিকের সুবিধার জন্য
        const refIds = attr['app:constraint_referenced_ids'] || attr['constraint_referenced_ids'] || '';
        
        LogManager.i('ConstraintHelper', `Flow [${viewId}] initialized. Referenced IDs: [${refIds}]`);

        // Flow এর নিজস্ব কোনো ভিজ্যুয়াল নেই, কিন্তু সলভারের জন্য এটি DOM এ থাকা দরকার
        return `<div class="android-view android-flow" ${idStr} 
                    style="display: none !important; width: 0px; height: 0px;">
                </div>`;
    }
}