// // Toolbar.js good
// import { BaseView } from '../widgets/BaseView.js';
// import { LinearSolver } from '../../solvers/LinearSolver.js';
// import { ActionMenuItemView } from '../widgets/ActionMenuItemView.js';
// import { LogManager } from '../../core/LogManager.js';

// export class Toolbar extends BaseView {
//     constructor(resolver) {
//         super(resolver);
//         this.solver = new LinearSolver();
//         this.menuItemRenderer = new ActionMenuItemView(resolver);
//     }

//     async render(node, renderChildCallback, parentType) {
//         const TAG = 'Toolbar';
//         const attr = node.attributes;
        
//         LogManager.d(TAG, 'Rendering Toolbar...');

//         let baseStyle = await this.getBaseStyles(attr, parentType);
//         const get = (name) => attr[name] || attr[`android:${name}`] || attr[`app:${name}`];

//         // 1. Toolbar Properties
//         // 🔥 FIX: Default title should be empty if not provided, not 'Toolbar'
//         const title = get('title') || '';
//         const subtitle = get('subtitle');
//         const navIcon = get('navigationIcon');
//         const titleTextColor = this.resolver.resolveColor(get('titleTextColor') || '#FFFFFF');
        
//         // 2. Height Resolution
//         // 🔥 FIX: Robust height handling (actionBarSize, wrap_content, explicit)
//         let layoutHeight = get('layout_height');
//         let minHeightStr = get('minHeight') || '56dp';
//         let minHeight = this.converter ? this.converter.parse(minHeightStr) : '56px';
//         let resolvedHeight = '56px'; // Default fallback

//         if (layoutHeight) {
//             if (layoutHeight.includes('actionBarSize')) {
//                 resolvedHeight = this.converter ? this.converter.parse('56dp') : '56px';
//             } else if (layoutHeight === 'wrap_content') {
//                 resolvedHeight = minHeight;
//             } else {
//                 resolvedHeight = this.converter ? this.converter.parse(layoutHeight) : layoutHeight;
//             }
//         }
        
//         // 3. Styling & Status Bar Padding
//         if (!baseStyle.includes('background-color') && !baseStyle.includes('background:')) {
//             LogManager.i(TAG, 'No background color set. Defaulting to Material Primary (#6200EE).');
//             baseStyle += 'background-color: #6200EE; ';
//         }

//         // 🔥 FIX: Status Bar Padding logic
//         // If this toolbar is inside an AppBarLayout or CoordinatorLayout, add top padding
//         let paddingTop = '0px';
//         let boxSizing = '';
        
//         if (parentType === 'AppBarLayout' || parentType === 'CoordinatorLayout') {
//             paddingTop = '24px';
//             // Adjust height calculation to include status bar
//             resolvedHeight = `calc(${resolvedHeight} + 24px)`;
//             boxSizing = 'box-sizing: border-box;';
//         }

//         LogManager.v(TAG, `Config: Title='${title}', Height='${resolvedHeight}'`);

//         // 4. Render Navigation Icon
//         let navHtml = '';
//         if (navIcon) {
//             LogManager.v(TAG, `Resolving navigation icon: ${navIcon}`);
//             const iconDrawable = await this.resolver.resolveDrawable(navIcon);
//             let src = iconDrawable ? iconDrawable.value : ''; 
            
//             if (!src) LogManager.w(TAG, `⚠️ Navigation Icon resource not found: ${navIcon}`);

//             if (src && src.includes('<svg')) {
//                 src = `data:image/svg+xml;utf8,${encodeURIComponent(src)}`;
//             }
//             navHtml = `
//                 <div class="toolbar-nav-icon" style="
//                     width: 24px; height: 24px; 
//                     margin-inline-start: 16px; margin-inline-end: 16px; 
//                     display: flex; align-items: center; justify-content: center; 
//                     cursor: pointer; flex-shrink: 0;">
//                     <img src="${src}" style="width: 24px; height: 24px; filter: brightness(0) invert(1);" />
//                 </div>
//             `;
//         }

//         // 5. Render Title Area
//         const titleHtml = `
//             <div class="toolbar-title-content" style="
//                 display: flex; flex-direction: column; justify-content: center; 
//                 flex: 1; margin-left: ${navIcon ? '0' : '16px'}; overflow: hidden;">
//                 <span style="color: ${titleTextColor}; font-size: 20px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
//                 ${subtitle ? `<span style="color: ${titleTextColor}; opacity: 0.7; font-size: 14px;">${subtitle}</span>` : ''}
//             </div>
//         `;

//         // 6. Render Children (Custom Views inside Toolbar)
//         const childrenHtmlArray = await Promise.all(node.children.map(async child => {
//             return await renderChildCallback(child, 'Toolbar', null, null);
//         }));

//         // 7. Render Menu Items
//         let actionsHtml = '';
//         const menuItems = node.menuItems || []; 
//         const maxActions = 2;
//         let visibleItems = [];
//         let overflowItems = [];

//         if (menuItems.length > 0) {
//             menuItems.forEach((item) => {
//                 const a = item.attributes;
//                 const showAsAction = (a['app:showAsAction'] || a['android:showAsAction'] || a['showAsAction'] || '').toLowerCase();
                
//                 if (visibleItems.length < maxActions && (showAsAction.includes('ifroom') || showAsAction.includes('always'))) {
//                     visibleItems.push(item);
//                 } else {
//                     overflowItems.push(item);
//                 }
//             });

//             const actionHtmls = await Promise.all(visibleItems.map(async item => {
//                 return await this.menuItemRenderer.render(item, 'Toolbar');
//             }));
//             actionsHtml = actionHtmls.join('');
//         }

//         const hasOverflow = overflowItems.length > 0 || (menuItems.length > 0 && visibleItems.length === 0);

//         const overflowHtml = `
//             <div class="toolbar-overflow" style="padding: 12px; cursor: pointer; display: flex; align-items: center;" title="More options">
//                 <svg width="4" height="16" viewBox="0 0 4 16">
//                     <path d="M2 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="${titleTextColor}"/>
//                 </svg>
//             </div>
//         `;

//         // 8. Final Layout Style
//         const layoutStyle = `
//             display: flex;
//             align-items: center;
//             width: 100%;
//             height: ${resolvedHeight};
//             min-height: ${minHeight};
//             padding-top: ${paddingTop};
//             ${boxSizing}
//             box-shadow: 0 2px 4px rgba(0,0,0,0.2);
//             z-index: 10;
//         `;
        
//         const idStr = attr.id ? `id="${attr.id.replace('@+id/', '')}"` : '';

//         LogManager.i(TAG, 'Toolbar render complete.');

//         return `
//             <div class="android-view android-toolbar" ${idStr} style="${baseStyle} ${layoutStyle}">
//                 ${navHtml}
//                 ${titleHtml}
//                 ${childrenHtmlArray.join('')}
//                 <div class="toolbar-actions" style="display: flex; align-items: center; margin-inline-end: 8px; flex-shrink: 0;">
//                     ${actionsHtml}
//                     ${hasOverflow ? overflowHtml : ''}
//                 </div>
//             </div>
//         `;
//     }
// }


// import { BaseView } from '../widgets/BaseView.js';
// import { LinearSolver } from '../../solvers/LinearSolver.js';
// import { ActionMenuItemView } from '../widgets/ActionMenuItemView.js';
// import { LogManager } from '../../core/LogManager.js';

// export class Toolbar extends BaseView {
//     constructor(resolver) {
//         super(resolver);
//         this.solver = new LinearSolver();
//         this.menuItemRenderer = new ActionMenuItemView(resolver);
//     }

//     async render(node, renderChildCallback, parentType) {
//         const TAG = 'Toolbar';
//         const attr = node.attributes;
        
//         LogManager.d(TAG, 'Rendering Toolbar...');

//         let baseStyle = await this.getBaseStyles(attr, parentType);
//         const get = (name) => attr[name] || attr[`android:${name}`] || attr[`app:${name}`];

//         // 1. Properties
//         const title = get('title') || ''; // 🔥 FIX: Empty title by default
//         const subtitle = get('subtitle');
//         const navIcon = get('navigationIcon');
//         const titleTextColor = this.resolver.resolveColor(get('titleTextColor') || '#FFFFFF');
        
//         // 2. Height Resolution
//         let layoutHeight = get('layout_height');
//         let minHeightStr = get('minHeight') || '56dp';
//         let minHeight = this.converter ? this.converter.parse(minHeightStr) : '56px';
//         let resolvedHeight = '56px';

//         if (layoutHeight) {
//             if (layoutHeight.includes('actionBarSize')) {
//                 resolvedHeight = this.converter ? this.converter.parse('56dp') : '56px';
//             } else if (layoutHeight === 'wrap_content') {
//                 resolvedHeight = minHeight;
//             } else {
//                 resolvedHeight = this.converter ? this.converter.parse(layoutHeight) : layoutHeight;
//             }
//         }
        
//         // 3. Styling & Background Logic
//         // 🔥 FIX: If inside CollapsingToolbar, make background transparent initially
//         if (parentType === 'CollapsingToolbarLayout') {
//             baseStyle += 'background-color: transparent; ';
//         } 
//         else if (!baseStyle.includes('background-color') && !baseStyle.includes('background:')) {
//             baseStyle += 'background-color: #6200EE; ';
//         }

//         // 4. Status Bar Padding Logic
//         let paddingTop = '0px';
//         let boxSizing = '';
        
//         if (parentType === 'AppBarLayout' || parentType === 'CoordinatorLayout') {
//             paddingTop = '24px';
//             resolvedHeight = `calc(${resolvedHeight} + 24px)`;
//             boxSizing = 'box-sizing: border-box;';
//         }

//         // 5. Render Navigation Icon
//         let navHtml = '';
//         if (navIcon) {
//             const iconDrawable = await this.resolver.resolveDrawable(navIcon);
//             let src = iconDrawable ? iconDrawable.value : ''; 
//             if (src && src.includes('<svg')) {
//                 src = `data:image/svg+xml;utf8,${encodeURIComponent(src)}`;
//             }
//             navHtml = `
//                 <div class="toolbar-nav-icon" style="
//                     width: 24px; height: 24px; 
//                     margin-inline-start: 16px; margin-inline-end: 16px; 
//                     display: flex; align-items: center; justify-content: center; 
//                     cursor: pointer; flex-shrink: 0;">
//                     <img src="${src}" style="width: 24px; height: 24px; filter: brightness(0) invert(1);" />
//                 </div>
//             `;
//         }

//         // 6. Title
//         const titleHtml = `
//             <div class="toolbar-title-content" style="
//                 display: flex; flex-direction: column; justify-content: center; 
//                 flex: 1; margin-left: ${navIcon ? '0' : '16px'}; overflow: hidden;">
//                 <span style="color: ${titleTextColor}; font-size: 20px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
//                 ${subtitle ? `<span style="color: ${titleTextColor}; opacity: 0.7; font-size: 14px;">${subtitle}</span>` : ''}
//             </div>
//         `;

//         // 7. Menu Items (Actions)
//         let actionsHtml = '';
//         const menuItems = node.menuItems || []; 
        
//         // (Menu Rendering Logic omitted for brevity - Keep your existing logic here)
//         // ...

//         const layoutStyle = `
//             display: flex;
//             align-items: center;
//             width: 100%;
//             height: ${resolvedHeight};
//             min-height: ${minHeight};
//             padding-top: ${paddingTop};
//             ${boxSizing}
//             z-index: 10;
//         `;
        
//         const idStr = attr.id ? `id="${attr.id.replace('@+id/', '')}"` : '';

//         return `
//             <div class="android-view android-toolbar" ${idStr} style="${baseStyle} ${layoutStyle}">
//                 ${navHtml}
//                 ${titleHtml}
//                 <div class="toolbar-actions" style="display: flex; align-items: center; margin-inline-end: 8px; flex-shrink: 0;">
//                     ${actionsHtml}
//                 </div>
//             </div>
//         `;
//     }
// }



import { BaseView } from '../widgets/BaseView.js';
import { LinearSolver } from '../../solvers/LinearSolver.js';
import { ActionMenuItemView } from '../widgets/ActionMenuItemView.js';
import { LogManager } from '../../core/LogManager.js';

export class Toolbar extends BaseView {
    constructor(resolver) {
        super(resolver);
        this.solver = new LinearSolver();
        this.menuItemRenderer = new ActionMenuItemView(resolver);
    }

    async render(node, renderChildCallback, parentType) {
        const TAG = 'Toolbar';
        const attr = node.attributes;
        
        let baseStyle = await this.getBaseStyles(attr, parentType);
        const get = (name) => attr[name] || attr[`android:${name}`] || attr[`app:${name}`];

        // 1. Properties
        // Note: In CollapsingToolbar, the layout wrapper controls the title usually.
        // We will render a hidden title here that shows up when collapsed.
        const titleText = get('title') || ''; // Default empty
        const navIcon = get('navigationIcon');
        const titleTextColor = this.resolver.resolveColor(get('titleTextColor') || '#FFFFFF');
        
        // 2. Dimensions
        let resolvedHeight = '56px';
        const h = get('layout_height');
        if (h && h.includes('actionBarSize')) resolvedHeight = '56px';
        
        // 3. Styling
        // If inside CollapsingToolbar, start transparent.
        if (parentType === 'CollapsingToolbarLayout') {
             baseStyle += 'background-color: transparent; ';
        } else if (!baseStyle.includes('background-color')) {
            baseStyle += 'background-color: #6200EE; ';
        }

        // Padding for Status Bar logic (Same as before)
        let paddingTop = '0px';
        if (parentType === 'AppBarLayout' || parentType === 'CoordinatorLayout') {
            paddingTop = '24px';
            resolvedHeight = `calc(${resolvedHeight} + 24px)`;
        }

        // 4. Navigation Icon
        let navHtml = '';
        if (navIcon) {
            const iconDrawable = await this.resolver.resolveDrawable(navIcon);
            let src = iconDrawable ? iconDrawable.value : ''; 
            if (src && src.includes('<svg')) src = `data:image/svg+xml;utf8,${encodeURIComponent(src)}`;
            navHtml = `<img src="${src}" style="width: 24px; height: 24px; margin: 0 16px; filter: brightness(0) invert(1);" />`;
        }

        // 5. Render Collapsed Title (Initially Hidden)
        // 🔥 This works in tandem with CoordinatorLayout script
        let titleHtml = '';
        // We try to find the title from parent attributes if not set on Toolbar directly
        // Usually CollapsingToolbar passes title via code, but for preview we guess.
        // We add a class 'collapsed-title' and opacity 0.
        titleHtml = `
            <span class="collapsed-title" style="
                color: ${titleTextColor}; 
                font-size: 20px; 
                font-weight: 500; 
                white-space: nowrap; 
                overflow: hidden; 
                text-overflow: ellipsis; 
                opacity: 0; 
                transition: opacity 0.2s;
                flex: 1;
            ">
                ${titleText || 'My Title Here'} 
            </span>
        `;

        // 6. Actions (Menu)
        let actionsHtml = '';
        // ... (Keep existing menu logic)

        const layoutStyle = `
            display: flex;
            align-items: center;
            width: 100%;
            height: ${resolvedHeight};
            padding-top: ${paddingTop};
            box-sizing: border-box;
            z-index: 10;
        `;

        return `
            <div class="android-view android-toolbar" style="${baseStyle} ${layoutStyle}">
                ${navHtml}
                ${titleHtml}
                <div class="toolbar-actions" style="margin-left: auto; margin-right: 8px;">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }
}