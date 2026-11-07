// src/layoutRenderer.js
import { getSharedTerminal, writeShared } from './services/terminalManager.js';
import plugin from '../plugin.json';
const fs = acode.require('fs');

// Path Constants
const PLUGIN_HOME = `/data/user/0/${ACODE_ID}/files/alpine/home/${plugin.id}`;
const RENDERER_JAR = `${PLUGIN_HOME}/tools/LayoutPreviewer.jar`;
const ANDROID_SDK_DATA = `${PLUGIN_HOME}/platforms/android-34/data`; // Fonts & Res
const JAVA_CMD = `java`; // Or specific path like /usr/lib/jvm/.../bin/java

export async function renderLayout(file) {     
    const fileName = file.filename;
    // bnjj
    // 1. Output Path (Cache)
    const tempDir = '/sdcard/Android/data/com.foxdebug.acode/cache';
    const outputImage = `${tempDir}/preview_${Date.now()}.png`;
    
    // 2. Project Resources Path (Need to find /res folder)
    let resPath = "";
    if (file.uri.includes("/src/main/res/")) {
        resPath = file.uri.split("/src/main/res/")[0] + "/src/main/res";
    } else {
        // Fallback or error handling
        throw new Error("File must be inside a valid 'res/layout' folder.");
    }

    console.log(`[Renderer] XML: ${fileName}`);

    // 3. Construct Java Command
    // Usage: java -jar Previewer.jar <xmlPath> <resPath> <outputPath> <sdkDataPath>
    const cmd = `${JAVA_CMD} -jar "${RENDERER_JAR}" "${file.uri}" "${resPath}" "${outputImage}" "${ANDROID_SDK_DATA}"`;
    
    // 4. Wrap in Shell Script for Terminal Execution
    const scriptPath = `/tmp/render_layout_${Date.now()}.sh`;
    const scriptContent = `
#!/bin/sh
echo "Rendering ${fileName}..."
${cmd} > /tmp/render_log.txt 2>&1
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "RENDER_SUCCESS"
else
    echo "RENDER_FAILED"
    cat /tmp/render_log.txt
fi
rm -f "${scriptPath}"
    `;

    // 5. Execute via Terminal
    const escapedScript = scriptContent.replace(/'/g, "'\"'\"'");
    const fullCmd = `printf '%s' '${escapedScript}' > '${scriptPath}' && chmod +x '${scriptPath}' && sh '${scriptPath}'`;

    const term = await getSharedTerminal('Android Builder Terminal');
    writeShared(fullCmd + '\r');

    // 6. Wait for Output Image
    let attempts = 0;
    while (attempts < 40) { // Max 8 seconds (Java takes time to boot)
        if (await fs(outputImage).exists()) {
             // Success!
             return "file://" + outputImage;
        }
        await new Promise(r => setTimeout(r, 200));
        attempts++;
    }

    throw new Error("Timeout: Renderer did not produce an image. Check terminal logs.");
}