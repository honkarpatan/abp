/**
 * File Operations Module
 * Reusable functions for managing project folders and files in Acode
 */

// Get filesystem API
const fs = acode.require('fs');

/**
 * Get currently opened project folder information
 * @returns {Object|null} { name, uri, path } or null if no project found
 */
export async function getProjectFolder() {
  try {
    const fileList = acode.require('fileList');
    const files = await fileList();
    
    if (!files || files.length === 0) {
      return null;
    }

    // Check first 5 files to detect project folder
    const filesToCheck = Math.min(5, files.length);
    
    for (let i = 0; i < filesToCheck; i++) {
      const file = files[i];
      
      if (file.path && file.url && file.url.startsWith('content://')) {
        // Get project folder name from path (first segment)
        const projectName = file.path.split('/')[0];
        
        if (projectName) {
          // Extract full URI
          const parts = file.url.split('::');
          if (parts.length === 2) {
            const treePart = parts[0];
            const fullPath = parts[1];
            
            // Find project folder in full path
            const projectIndex = fullPath.indexOf('/' + projectName + '/');
            const projectIndexRoot = fullPath.indexOf('/' + projectName);
            
            let projectPath = null;
            let projectUri = null;
            
            if (projectIndex !== -1) {
              projectPath = fullPath.substring(0, projectIndex + projectName.length + 1);
              projectUri = treePart + '::' + projectPath;
            } else if (projectIndexRoot !== -1) {
              projectPath = fullPath.substring(0, projectIndexRoot + projectName.length + 1);
              projectUri = treePart + '::' + projectPath;
            }
            
            if (projectUri && projectPath) {
              return {
                name: projectName,
                uri: projectUri,
                path: projectPath
              };
            }
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('Error getting project folder:', error);
    return null;
  }
}

/**
 * Get all opened project folders
 * @returns {Array} Array of { name, uri, path } objects
 */
export async function getAllProjectFolders() {
  try {
    const fileList = acode.require('fileList');
    const files = await fileList();
    
    if (!files || files.length === 0) {
      return [];
    }

    const projectFolders = new Map(); // Use Map to avoid duplicates
    
    // Check first 10 files to catch multiple projects
    const filesToCheck = Math.min(10, files.length);
    
    for (let i = 0; i < filesToCheck; i++) {
      const file = files[i];
      
      if (file.path && file.url && file.url.startsWith('content://')) {
        const projectName = file.path.split('/')[0];
        
        if (projectName && !projectFolders.has(projectName)) {
          const parts = file.url.split('::');
          if (parts.length === 2) {
            const treePart = parts[0];
            const fullPath = parts[1];
            
            const projectIndex = fullPath.indexOf('/' + projectName + '/');
            const projectIndexRoot = fullPath.indexOf('/' + projectName);
            
            let projectPath = null;
            let projectUri = null;
            
            if (projectIndex !== -1) {
              projectPath = fullPath.substring(0, projectIndex + projectName.length + 1);
              projectUri = treePart + '::' + projectPath;
            } else if (projectIndexRoot !== -1) {
              projectPath = fullPath.substring(0, projectIndexRoot + projectName.length + 1);
              projectUri = treePart + '::' + projectPath;
            }
            
            if (projectUri && projectPath) {
              projectFolders.set(projectName, {
                name: projectName,
                uri: projectUri,
                path: projectPath
              });
            }
          }
        }
      }
    }
    
    return Array.from(projectFolders.values());
    
  } catch (error) {
    console.error('Error getting all project folders:', error);
    return [];
  }
}

/**
 * Remove a specific opened folder by URI
 * @param {string} uri - The folder URI to remove
 * @returns {boolean} true if removed, false otherwise
 */
export function removeFolder(uri) {
  try {
    const openFolder = acode.require('openFolder');
    const folder = openFolder.find(uri);
    
    if (folder) {
      folder.remove();
      console.log('✅ Folder removed:', uri);
      return true;
    } else {
      console.log('❌ Folder not found:', uri);
      return false;
    }
  } catch (error) {
    console.error('Error removing folder:', error);
    return false;
  }
}

/**
 * Remove all currently opened project folders
 * @returns {Object} { removed: number, failed: number, folders: Array }
 */
export async function removeAllOpenedFolders() {
  try {
    const folders = await getAllProjectFolders();
    
    if (folders.length === 0) {
      return { removed: 0, failed: 0, folders: [] };
    }

    let removed = 0;
    let failed = 0;
    const removedFolders = [];
    
    for (const folder of folders) {
      const success = removeFolder(folder.uri);
      if (success) {
        removed++;
        removedFolders.push(folder);
      } else {
        failed++;
      }
    }
    
    return { removed, failed, folders: removedFolders };
    
  } catch (error) {
    console.error('Error removing all folders:', error);
    return { removed: 0, failed: 0, folders: [] };
  }
}

/**
 * Open a project folder
 * @param {string} uri - The folder URI to open
 * @param {Object} options - Options for opening folder
 * @returns {Promise<boolean>} true if successful
 */
export async function openProjectFolder(uri, options = {}) {
  try {
    const openFolder = acode.require('openFolder');
    
    const defaultOptions = {
      name: options.name || 'Project',
      id: options.id || 'project-' + Date.now(),
      saveState: options.saveState !== undefined ? options.saveState : true,
      reloadOnResume: options.reloadOnResume !== undefined ? options.reloadOnResume : true
    };
    
    await openFolder(uri, defaultOptions);
    console.log('✅ Folder opened:', uri);
    return true;
    
  } catch (error) {
    console.error('Error opening folder:', error);
    return false;
  }
}

/**
 * Check if a folder is currently opened
 * @param {string} uri - The folder URI to check
 * @returns {boolean} true if opened
 */
export function isFolderOpened(uri) {
  try {
    const openFolder = acode.require('openFolder');
    const folder = openFolder.find(uri);
    return folder !== null && folder !== undefined;
  } catch (error) {
    console.error('Error checking folder:', error);
    return false;
  }
}

/**
 * Replace currently opened folder with a new one
 * Removes all opened folders and opens the new one
 * @param {string} uri - New folder URI to open
 * @param {Object} options - Options for opening folder
 * @returns {Promise<Object>} { success: boolean, removed: number, message: string }
 */
export async function replaceProjectFolder(uri, options = {}) {
  try {
    // Remove all opened folders
    const removeResult = await removeAllOpenedFolders();
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Open new folder
    const opened = await openProjectFolder(uri, options);
    
    if (opened) {
      return {
        success: true,
        removed: removeResult.removed,
        message: `Removed ${removeResult.removed} folder(s) and opened new project`
      };
    } else {
      return {
        success: false,
        removed: removeResult.removed,
        message: 'Failed to open new folder'
      };
    }
    
  } catch (error) {
    console.error('Error replacing folder:', error);
    return {
      success: false,
      removed: 0,
      message: error.message
    };
  }
}

// ========================================
// FILE SYSTEM OPERATIONS
// ========================================

/**
 * Create a new folder
 * @param {string} url - Parent directory URL
 * @param {string} folderName - Name of the folder
 * @param {Object} options - { overwrite: boolean } (Default: false aka "Keep Both")
 */
export async function createFolder(url, folderName, options = { overwrite: false }) {
  try {
    const fsInstance = fs(url);
    if (!fsInstance) throw new Error("Invalid parent path URL");

    // 1. Check if folder exists
    let existingUrl = null;
    try {
      const siblings = await fs(url).lsDir();
      const found = siblings.find(item => item.name === folderName && item.isDirectory);
      if (found) existingUrl = found.url;
    } catch (e) {}

    // 2. Logic based on overwrite flag
    if (existingUrl) {
        if (options.overwrite) {
            // Case: Replace/Use Existing
            console.log(`📂 Using existing folder: ${folderName}`);
            return {
                success: true,
                url: existingUrl,
                message: `Folder "${folderName}" already exists (Used)`
            };
        } else {
            // Case: Keep Both (Rename new one)
            const newName = await getUniqueName(url, folderName);
            const dirUrl = await fsInstance.createDirectory(newName);
            return {
                success: true,
                url: dirUrl,
                message: `Folder created as "${newName}"`
            };
        }
    }

    // 3. Create if not exists
    const dirUrl = await fsInstance.createDirectory(folderName);
    return {
      success: true,
      url: dirUrl,
      message: `Folder "${folderName}" created`
    };

  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, url: null, message: error.message };
  }
}

/**
 * Create a new file
 * @param {string} url - Parent directory URL
 * @param {string} fileName - Name of the file
 * @param {string|ArrayBuffer|Uint8Array} content - File content
 * @param {Object} options - { overwrite: boolean, encoding?: 'utf-8'|'base64' }
 */
export async function createFile(url, fileName, content = '', options = { overwrite: false }) {
  try {
    const encoding = options && options.encoding ? options.encoding : null;

    const write = async (fileUrl, data) => {
      if (encoding) {
        try {
          await fs(fileUrl).writeFile(data, encoding);
          return;
        } catch (_) {
          await fs(fileUrl).writeFile(data, { encoding });
        }
      } else {
        await fs(fileUrl).writeFile(data);
      }
    };

    const create = async (parentUrl, name, data) => {
      if (encoding) {
        try {
          await fs(parentUrl).createFile(name, data, { encoding });
          return;
        } catch (_) {
          try {
            await fs(parentUrl).createFile(name, data, encoding);
            return;
          } catch (__) {
            // create then overwrite with encoding
            try {
              await fs(parentUrl).createFile(name, '');
            } catch (___) {}
            await write(`${String(parentUrl).replace(/\/+$/, '')}/${name}`, data);
          }
        }
      } else {
        await fs(parentUrl).createFile(name, data);
      }
    };

    // 1. Check if file exists
    let existingItem = null;
    try {
        const siblings = await fs(url).lsDir();
        existingItem = siblings.find(item => item.name === fileName && item.isFile);
    } catch(e) {}

    // 2. Logic based on overwrite flag
    if (existingItem) {
        if (options.overwrite) {
            console.log(`♻️ Overwriting file: ${fileName}${encoding ? ' [' + encoding + ']' : ''}`);
            await write(existingItem.url, content);
            return {
                success: true,
                url: existingItem.url,
                message: `File "${fileName}" updated`
            };
        } else {
            const uniqueName = await getUniqueName(url, fileName);
            console.log(`✨ Creating duplicate: ${uniqueName}`);
            await create(url, uniqueName, content);
            return {
                success: true,
                url: `${url}/${uniqueName}`,
                message: `File created as "${uniqueName}"`
            };
        }
    }

    // 3. Create normal file (No conflict)
    await create(url, fileName, content);
    return {
      success: true,
      url: `${url}/${fileName}`,
      message: `File "${fileName}" created`
    };

  } catch (error) {
    console.error('Error creating file:', error);
    return { success: false, url: null, message: error.message };
  }
}

/**
 * Write binary bytes (PNG/WebP/JPEG) for Acode FS.
 *
 * CRITICAL (Acode SDcard plugin):
 *   sdcard.write(filename, content, isArrayBuffer)
 *   - isArrayBuffer ONLY when content instanceof ArrayBuffer
 *   - native side Base64-decodes when isArrayBuffer=true
 *   - Uint8Array / Blob / base64-string → treated as TEXT → corrupt PNG
 *
 *   writeFile(string, 'base64') is NOT base64-decode — it is charset encode!
 *   Always pass a pure ArrayBuffer and NO encoding flag.
 */
export async function writeBinaryFile(folderUrl, fileName, data, options = {}) {
  const dirUrl = String(folderUrl || '').replace(/\/+$/, '');
  const full = `${dirUrl}/${fileName}`;

  let u8;
  if (data instanceof Uint8Array) {
    u8 = data;
  } else if (data instanceof ArrayBuffer) {
    u8 = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else {
    return { success: false, url: null, message: 'empty/invalid binary buffer: ' + fileName };
  }
  if (!u8.byteLength) {
    return { success: false, url: null, message: 'empty binary buffer: ' + fileName };
  }

  // Detached pure ArrayBuffer (NOT a view) — required for content:// binary path
  const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

  const isPng =
    u8.length >= 4 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47;
  const isJpg = u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xd8;
  const isWebp =
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45;
  if (!(isPng || isJpg || isWebp)) {
    console.warn(
      '[writeBinary] unexpected magic',
      fileName,
      u8[0],
      u8[1],
      u8[2],
      u8[3]
    );
  }

  const fsOp = () => {
    try {
      return (typeof acode !== 'undefined' && (acode.require('fs') || acode.require('fsOperation'))) || null;
    } catch (_) {
      return null;
    }
  };
  const fs = fsOp();
  if (!fs) return { success: false, url: null, message: 'fs API unavailable' };

  const verify = async () => {
    try {
      // Prefer raw ArrayBuffer read (no encoding)
      let raw = null;
      try {
        raw = await fs(full).readFile();
      } catch (_) {}
      let bytes = null;
      if (raw instanceof ArrayBuffer) {
        bytes = new Uint8Array(raw);
      } else if (ArrayBuffer.isView(raw)) {
        bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      } else if (raw && raw.data instanceof ArrayBuffer) {
        bytes = new Uint8Array(raw.data);
      } else if (typeof raw === 'string') {
        // Text on disk = corrupt for PNG. Detect base64-as-text mistake.
        if (raw.startsWith('iVBOR') || raw.startsWith('/9j/') || raw.startsWith('UklGR')) {
          console.warn('[writeBinary] file is base64 TEXT, not binary:', fileName);
          return false;
        }
        // Maybe latin1 binary string
        bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
      }
      if (!bytes || bytes.length < 4) return false;
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
      if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
      // ASCII "PNG" or "iVBO" means text corruption
      if (bytes[0] === 0x69 && bytes[1] === 0x56 && bytes[2] === 0x42) {
        console.warn('[writeBinary] looks like ASCII iVBOR text on disk');
        return false;
      }
      console.warn('[writeBinary] verify magic fail', fileName, bytes[0], bytes[1], bytes[2], bytes[3]);
      return false;
    } catch (e) {
      console.warn('[writeBinary] verify error', e);
      return false;
    }
  };

  // Delete stale file so create+write is clean
  try {
    if (await fs(full).exists().catch(() => false)) {
      try {
        await fs(full).delete();
      } catch (_) {}
    }
  } catch (_) {}

  const attempts = [
    // 1) create empty then write ArrayBuffer (best for content://)
    async () => {
      try {
        await fs(dirUrl).createFile(fileName, '');
      } catch (_) {
        // may already exist
      }
      await fs(full).writeFile(ab); // NO encoding — pure ArrayBuffer
    },
    // 2) overwrite existing with ArrayBuffer
    async () => {
      const exists = await fs(full).exists().catch(() => false);
      if (exists) {
        await fs(full).writeFile(ab);
      } else {
        await fs(dirUrl).createFile(fileName, ab);
      }
    },
    // 3) createFile with ArrayBuffer content directly
    async () => {
      await fs(dirUrl).createFile(fileName, ab);
    },
    // 4) fileOperations createFile helper
    async () => {
      const r = await createFile(dirUrl, fileName, ab, { overwrite: true });
      if (!r || !r.success) throw new Error(r && r.message ? r.message : 'createFile failed');
    },
  ];

  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      await attempts[i]();
      const ok = await verify();
      if (ok) {
        console.log('[writeBinary] OK', fileName, 'attempt', i + 1, 'bytes', u8.length);
        return { success: true, url: full, message: `Binary OK: ${fileName}` };
      }
      lastErr = new Error('verify failed after write attempt ' + (i + 1) + ': ' + fileName);
      console.warn(lastErr.message);
    } catch (e) {
      lastErr = e;
      console.warn('[writeBinary] attempt', i + 1, e && e.message ? e.message : e);
    }
  }

  return {
    success: false,
    url: full,
    message: (lastErr && lastErr.message) || 'binary write failed: ' + fileName,
  };
}





/**
 * Check if a file or folder exists
 * @param {string} url - Parent directory URL
 * @param {string} name - Name of file or folder to check
 * @returns {Promise<Object>} { exists: boolean, isFile: boolean, isDirectory: boolean, url: string|null }
 */
export async function isExists(url, name) {
  try {
    const siblings = await fs(url).lsDir();
    const item = siblings.find(entry => entry.name === name);
    
    if (item) {
      return {
        exists: true,
        isFile: item.isFile || false,
        isDirectory: item.isDirectory || false,
        url: item.url
      };
    }
    
    return {
      exists: false,
      isFile: false,
      isDirectory: false,
      url: null
    };
  } catch (error) {
    console.error('Error checking existence:', error);
    return {
      exists: false,
      isFile: false,
      isDirectory: false,
      url: null
    };
  }
}

/**
 * Read file contents
 * @param {string} fileUrl - File URL to read
 * @param {string} encoding - Encoding type (default: 'utf-8')
 * @returns {Promise<Object>} { success: boolean, content: string|ArrayBuffer|null, message: string }
 */
export async function readFile(fileUrl, encoding = 'utf-8') {
  try {
    const content = await fs(fileUrl).readFile(encoding);
    console.log('✅ File read:', fileUrl);
    return {
      success: true,
      content: content,
      message: 'File read successfully'
    };
  } catch (error) {
    console.error('Error reading file:', error);
    return {
      success: false,
      content: null,
      message: error.message
    };
  }
}

/**
 * Write content to file
 * @param {string} fileUrl - File URL to write to
 * @param {string|ArrayBuffer} content - Content to write
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export async function writeFile(fileUrl, content) {
  try {
    await fs(fileUrl).writeFile(content);
    console.log('✅ File written:', fileUrl);
    return {
      success: true,
      message: 'File written successfully'
    };
  } catch (error) {
    console.error('Error writing file:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * List directory contents
 * @param {string} dirUrl - Directory URL to list
 * @returns {Promise<Object>} { success: boolean, entries: Array, message: string }
 */
export async function listDir(dirUrl) {
  try {
    const entries = await fs(dirUrl).lsDir();
    console.log('✅ Directory listed:', dirUrl);
    return {
      success: true,
      entries: entries,
      message: `Found ${entries.length} item(s)`
    };
  } catch (error) {
    console.error('Error listing directory:', error);
    return {
      success: false,
      entries: [],
      message: error.message
    };
  }
}

/**
 * Create nested folder structure recursively
 * @param {string} url - Parent directory URL
 * @param {Array} nodes - Array of node objects with structure
 * @returns {Promise<Object>} { success: boolean, created: number, message: string }
 */
export async function createNodes(url, nodes) {
  let created = 0;
  
  for (const node of nodes) {
    if (node.name === null) continue;
    
    try {
      if (node.type === 'directory') {
        const folderResult = await createFolder(url, node.name);
        
        if (folderResult.success) {
          created++;
          
          // Create children if any
          if (node.children && node.children.length > 0 && folderResult.url) {
            const childResult = await createNodes(folderResult.url, node.children);
            created += childResult.created;
          }
        }
      } else if (node.type === 'file') {
        const fileResult = await createFile(url, node.name, node.content || '');
        if (fileResult.success) {
          created++;
        }
      }
    } catch (error) {
      console.error(`Error creating node ${node.name}:`, error);
    }
  }
  
  return {
    success: true,
    created: created,
    message: `Created ${created} item(s)`
  };
}

/**
 * Delete a file or folder
 * @param {string} url - URL of file or folder to delete
 * @returns {Promise<Object>} { success: boolean, message: string }
 */
export async function deleteItem(url) {
  try {
    await fs(url).delete();
    console.log('✅ Item deleted:', url);
    return {
      success: true,
      message: 'Item deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting item:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Rename a file or folder
 * @param {string} url - URL of file or folder to rename
 * @param {string} newName - New name
 * @returns {Promise<Object>} { success: boolean, newUrl: string|null, message: string }
 */
export async function renameItem(url, newName) {
  try {
    const newUrl = await fs(url).renameTo(newName);
    console.log('✅ Item renamed:', newName);
    return {
      success: true,
      newUrl: newUrl,
      message: `Renamed to "${newName}" successfully`
    };
  } catch (error) {
    console.error('Error renaming item:', error);
    return {
      success: false,
      newUrl: null,
      message: error.message
    };
  }
}

/**
 * Copy a file with auto-increment naming if file exists
 * @param {string} sourceUrl - Source file URL
 * @param {string} destUrl - Destination directory URL
 * @param {string} desiredName - The name you want (e.g., "Pokemon_App.apk")
 * @returns {Promise<Object>} { success: boolean, message: string }
 */

export async function copyFile(sourceUrl, destUrl, desiredName) {
  try {
    // 1. ইউনিক নাম তৈরি করা
    let fileName = desiredName || sourceUrl.split('/').pop();
    let namePart = fileName;
    let extPart = "";

    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex !== -1) {
        namePart = fileName.substring(0, lastDotIndex);
        extPart = fileName.substring(lastDotIndex);
    }

    const separator = destUrl.endsWith('/') ? '' : '/';
    let finalName = fileName;
    let counter = 1;
    
    
    // নাম চেক করা
    // while (await fs(destUrl + separator + finalName).exists()) {
    while (await isExists(destUrl , finalName)) {
        finalName = `${namePart}_${counter}${extPart}`; // (1) এর বদলে _1 ব্যবহার করছি সেফটির জন্য
        counter++;
    }

    console.log(`Copying to: ${finalName}`);
    
    // 2. Native Copy ব্যবহার করা
    // Acode এ copyTo(destinationParent, newName) কাজ করে
    const sourceEntry = await fs(sourceUrl);
    await sourceEntry.copyTo(destUrl, finalName);

    return {
      success: true,
      message: `Saved as ${finalName}`
    };

  } catch (error) {
    console.error('Copy Error:', error);
    return {
      success: false,
      message: error.message || 'Unknown error'
    };
  }
}

/**
 * Move a file or folder
 * @param {string} sourceUrl - Source URL
 * @param {string} destUrl - Destination directory URL
 * @returns {Promise<Object>} { success: boolean, url: string|null, message: string }
 */
export async function moveItem(sourceUrl, destUrl) {
  try {
    const movedUrl = await fs(sourceUrl).moveTo(destUrl);
    console.log('✅ Item moved');
    return {
      success: true,
      url: movedUrl,
      message: 'Item moved successfully'
    };
  } catch (error) {
    console.error('Error moving item:', error);
    return {
      success: false,
      url: null,
      message: error.message
    };
  }
}