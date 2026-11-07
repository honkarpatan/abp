import { FrameLayout } from './FrameLayout.js';

export class CollapsingToolbarLayout extends FrameLayout {
    constructor(resolver) {
        super(resolver);
    }

    createElement() {
        const el = super.createElement();
        const attr = this.attributes;

        // 1. Scrim & Background Logic
        // রিয়েল অ্যান্ড্রয়েডে ইমেজ না থাকলে প্রাইমারি কালার দেখায়
        const scrimColor = this.resolver.resolveColor(attr['app:contentScrim']) || 
                           this.resolver.resolveColor('?attr/colorPrimary') || '#6200EE';
        
        el.setAttribute('data-scrim-color', scrimColor);

        // যদি কোনো ইমেজ চাইল্ড না থাকে, তবে ব্যাকগ্রাউন্ড সেট করো
        const hasImage = this.node.children.some(c => c.type.includes('ImageView'));
        if (!hasImage) {
            // Expanded অবস্থায় সাধারণত প্রাইমারি কালার বা সামান্য ডার্ক ভেরিয়েন্ট থাকে
            el.style.backgroundColor = scrimColor; 
        }

        // 2. Title Rendering (The Magic Part)
        const titleText = this.resolver.resolveString(attr['app:title'] || attr['android:title']);
        
        if (titleText) {
            const titleEl = document.createElement('div');
            titleEl.textContent = titleText;
            titleEl.className = 'collapsing-title'; // JS দিয়ে টার্গেট করার জন্য
            
            // Initial Styles (Expanded State)
            const expandedColor = this.resolver.resolveColor(attr['app:expandedTitleTextColor']) || '#FFFFFF';
            
            // টাইটেল পজিশনিং (Absolute Bottom-Left initially)
            Object.assign(titleEl.style, {
                position: 'absolute',
                left: '16px',
                bottom: '16px', // Expanded অবস্থায় নিচে থাকবে
                color: expandedColor,
                fontSize: '34px', // Expanded Text Size
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transformOrigin: '0% 50%', // Left-Center origin for scaling
                zIndex: '100', // টুলবারের উপরে যেন না যায়, কিন্তু ইমেজের উপরে থাকে
                transition: 'none', // আমরা স্ক্রল ইভেন্ট দিয়ে কন্ট্রোল করব
                fontFamily: 'Roboto, sans-serif'
            });

            el.appendChild(titleEl);
        }

        return el;
    }
}