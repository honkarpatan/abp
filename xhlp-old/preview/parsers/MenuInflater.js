// parsers/MenuInflater.js
import { LogManager } from '../core/LogManager.js';

export class MenuInflater {
    constructor(resolver) {
        this.resolver = resolver;
    }

    /**
     * Parses a <menu> AST and returns a flat list of item nodes
     * that Toolbar.js can render.
     */
    parse(ast) {
        const TAG = 'MenuInflater';
        const items = [];
        
        if (!ast || ast.type !== 'menu') {
            console.warn('[MenuInflater] Root tag is not <menu>');
            LogManager.e(TAG, `Invalid Menu XML. Root tag expected 'menu', found '${ast ? ast.type : 'null'}'`);
            return items;
        }

        LogManager.d(TAG, 'Parsing Menu XML AST...');

        const traverse = (node) => {
            // শুধু <item> ট্যাগগুলো কালেক্ট করব
            if (node.type === 'item') {
                if (!node.attributes) node.attributes = {};
                
                const title = node.attributes['android:title'] || node.attributes['title'] || 'Untitled';
                LogManager.v(TAG, `Found menu item: ${title} (id: ${node.attributes['android:id'] || 'no-id'})`);

                // আইটেম নোডটি লিস্টে যোগ করি
                // Toolbar.js এটিকেই ActionMenuItemView দিয়ে রেন্ডার করবে
                items.push(node);
            } else if (node.type === 'group') {
                LogManager.v(TAG, 'Entering <group> tag...');
            } else if (node.type === 'menu' && node !== ast) {
                LogManager.v(TAG, 'Entering Nested <menu> (Submenu)...');
            }
            
            // Nested <menu> (Submenu) বা <group> থাকলে রিকার্সিভলি খুঁজব
            if (node.children) {
                node.children.forEach(traverse);
            }
        };

        if (ast.children) {
            ast.children.forEach(traverse);
        }

        console.log(`[MenuInflater] Parsed ${items.length} menu items.`);
        LogManager.i(TAG, `Menu parsing complete. Total items ready to render: ${items.length}`);
        
        return items;
    }
}