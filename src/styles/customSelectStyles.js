/**
 * CustomSelect styles — for EditorFile stylesheets / pageStyles.
 * Do NOT inject into document.head (Shadow DOM pages will not see them).
 */
export const customSelectStyles = `
.xcs{position:relative;display:inline-block;width:100%;min-width:0;font-size:.8rem;color:inherit;}
.xcs-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;
  background:rgba(0,0,0,.28);border:none;border-bottom:1px solid rgba(255,255,255,.14);
  border-radius:2px;padding:6px 8px;color:inherit;cursor:pointer;text-align:left;
  font:inherit;line-height:1.25;min-height:30px;}
.xcs-trigger:hover{background:rgba(255,255,255,.06);}
.xcs.is-open .xcs-trigger{border-bottom-color:rgba(124,156,255,.55);box-shadow:0 0 0 2px rgba(124,156,255,.12);}
.xcs.is-disabled .xcs-trigger{opacity:.45;cursor:not-allowed;}
.xcs-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.xcs-label.is-placeholder{opacity:.4;}
.xcs-caret{opacity:.55;font-size:.7rem;flex:0 0 auto;}
.xcs-menu{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:80;
  max-height:200px;overflow:auto;-webkit-overflow-scrolling:touch;
  background:var(--secondary-color, #1a1d26);border:1px solid rgba(255,255,255,.12);border-radius:2px;
  box-shadow:0 8px 24px rgba(0,0,0,.45);padding:4px;}
.xcs-item{display:block;width:100%;text-align:left;padding:7px 8px;border:0;border-radius:2px;
  background:transparent;color:inherit;font:inherit;cursor:pointer;}
.xcs-item:hover,.xcs-item:focus{background:rgba(124,156,255,.16);outline:none;}
.xcs-item.is-active{background:rgba(124,156,255,.22);}
.xcs-item.is-disabled{opacity:.4;cursor:not-allowed;}
`;
