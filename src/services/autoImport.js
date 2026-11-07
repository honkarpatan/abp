/**
 * Lightweight auto-import for Java / Kotlin / Dart (no tree-sitter).
 * Scans buffer for known type names and inserts missing import lines.
 */
import { getSettings } from './settings.js';

const JAVA_MAP = {
  ArrayList: 'java.util.ArrayList',
  HashMap: 'java.util.HashMap',
  List: 'java.util.List',
  Map: 'java.util.Map',
  Set: 'java.util.Set',
  HashSet: 'java.util.HashSet',
  Optional: 'java.util.Optional',
  UUID: 'java.util.UUID',
  Date: 'java.util.Date',
  Log: 'android.util.Log',
  Toast: 'android.widget.Toast',
  Intent: 'android.content.Intent',
  Bundle: 'android.os.Bundle',
  View: 'android.view.View',
  ViewGroup: 'android.view.ViewGroup',
  LayoutInflater: 'android.view.LayoutInflater',
  TextView: 'android.widget.TextView',
  ImageView: 'android.widget.ImageView',
  Button: 'android.widget.Button',
  EditText: 'android.widget.EditText',
  RecyclerView: 'androidx.recyclerview.widget.RecyclerView',
  LinearLayoutManager: 'androidx.recyclerview.widget.LinearLayoutManager',
  AppCompatActivity: 'androidx.appcompat.app.AppCompatActivity',
  MaterialButton: 'com.google.android.material.button.MaterialButton',
  Gson: 'com.google.gson.Gson',
  OkHttpClient: 'okhttp3.OkHttpClient',
  Retrofit: 'retrofit2.Retrofit',
};

const KOTLIN_MAP = {
  ...JAVA_MAP,
  mutableListOf: null, // stdlib
  listOf: null,
  mapOf: null,
  remember: 'androidx.compose.runtime.remember',
  mutableStateOf: 'androidx.compose.runtime.mutableStateOf',
  Column: 'androidx.compose.foundation.layout.Column',
  Row: 'androidx.compose.foundation.layout.Row',
  Modifier: 'androidx.compose.ui.Modifier',
  Text: 'androidx.compose.material3.Text',
  Button: 'androidx.compose.material3.Button',
  LazyColumn: 'androidx.compose.foundation.lazy.LazyColumn',
};

const DART_MAP = {
  material: 'package:flutter/material.dart',
  MaterialApp: 'package:flutter/material.dart',
  Scaffold: 'package:flutter/material.dart',
  AppBar: 'package:flutter/material.dart',
  Widget: 'package:flutter/material.dart',
  StatelessWidget: 'package:flutter/material.dart',
  StatefulWidget: 'package:flutter/material.dart',
  BuildContext: 'package:flutter/material.dart',
  CupertinoApp: 'package:flutter/cupertino.dart',
  http: 'package:http/http.dart',
  Provider: 'package:provider/provider.dart',
};

function getDocText(editor) {
  if (!editor) return '';
  if (editor.state && editor.state.doc) return editor.state.doc.toString();
  if (editor.session) return editor.session.getValue();
  return '';
}

function setDocText(editor, text) {
  if (editor.state && typeof editor.dispatch === 'function') {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text },
    });
    return;
  }
  if (editor.session) editor.session.setValue(text);
}

function existingJavaImports(code) {
  const set = new Set();
  const re = /^import\s+([\w.]+)\s*;/gm;
  let m;
  while ((m = re.exec(code))) set.add(m[1]);
  return set;
}

function existingKotlinImports(code) {
  const set = new Set();
  const re = /^import\s+([\w.]+)/gm;
  let m;
  while ((m = re.exec(code))) set.add(m[1]);
  return set;
}

function existingDartImports(code) {
  const set = new Set();
  const re = /^import\s+['"]([^'"]+)['"]\s*;/gm;
  let m;
  while ((m = re.exec(code))) set.add(m[1]);
  return set;
}

function insertAfterPackage(code, lines, isDart) {
  if (!lines.length) return code;
  const block = lines.join('\n') + '\n';
  if (isDart) {
    // after last import or at top
    const im = code.match(/^(import\s+.+;\n)+/m);
    if (im) {
      const idx = code.indexOf(im[0]) + im[0].length;
      return code.slice(0, idx) + block + code.slice(idx);
    }
    return block + code;
  }
  const pkg = code.match(/^package\s+[\w.]+;?\s*\n/);
  if (pkg) {
    const idx = pkg[0].length;
    return code.slice(0, idx) + '\n' + block + code.slice(idx);
  }
  return block + code;
}

export function runAutoImport() {
  const settings = getSettings();
  if (settings.enableAutoImport === false) {
    window.toast('Auto-import disabled in settings', 2000);
    return;
  }
  const file = editorManager.activeFile;
  if (!file) return;
  const name = (file.filename || '').toLowerCase();
  const editor = editorManager.editor;
  let code = getDocText(editor);
  if (!code) return;

  let added = 0;
  if (name.endsWith('.java')) {
    const have = existingJavaImports(code);
    const need = [];
    for (const [sym, imp] of Object.entries(JAVA_MAP)) {
      if (!imp || have.has(imp)) continue;
      if (new RegExp('\\b' + sym + '\\b').test(code)) {
        need.push(`import ${imp};`);
        have.add(imp);
        added++;
      }
    }
    if (need.length) {
      code = insertAfterPackage(code, need, false);
      setDocText(editor, code);
    }
  } else if (name.endsWith('.kt') || name.endsWith('.kts')) {
    const have = existingKotlinImports(code);
    const need = [];
    for (const [sym, imp] of Object.entries(KOTLIN_MAP)) {
      if (!imp || have.has(imp)) continue;
      if (new RegExp('\\b' + sym + '\\b').test(code)) {
        need.push(`import ${imp}`);
        have.add(imp);
        added++;
      }
    }
    if (need.length) {
      code = insertAfterPackage(code, need, false);
      setDocText(editor, code);
    }
  } else if (name.endsWith('.dart')) {
    const have = existingDartImports(code);
    const need = [];
    // material is common if Widget used
    if (/\b(Widget|Scaffold|MaterialApp|StatelessWidget|StatefulWidget)\b/.test(code)) {
      if (!have.has('package:flutter/material.dart')) {
        need.push("import 'package:flutter/material.dart';");
        have.add('package:flutter/material.dart');
        added++;
      }
    }
    for (const [sym, imp] of Object.entries(DART_MAP)) {
      if (!imp || have.has(imp)) continue;
      if (sym === 'material') continue;
      if (new RegExp('\\b' + sym + '\\b').test(code)) {
        need.push(`import '${imp}';`);
        have.add(imp);
        added++;
      }
    }
    if (need.length) {
      code = insertAfterPackage(code, need, true);
      setDocText(editor, code);
    }
  } else {
    window.toast('Auto-import: open a .java / .kt / .dart file', 2500);
    return;
  }
  window.toast(added ? `Auto-import: +${added} import(s)` : 'Auto-import: nothing to add', 2500);
}

export function registerAutoImportCommand() {
  try {
    const commands = acode.require('commands');
    if (commands && commands.set) {
      commands.set('xhlp:autoImport', runAutoImport);
    }
  } catch (_) {}
  // Ctrl+Alt+I style via editor command if available
  try {
    const editor = editorManager.editor;
    if (editor && editor.commands && editor.commands.addCommand) {
      editor.commands.addCommand({
        name: 'xhlpAutoImport',
        bindKey: { win: 'Ctrl-Alt-I', mac: 'Command-Alt-I' },
        exec: () => runAutoImport(),
      });
    }
  } catch (_) {}
}
