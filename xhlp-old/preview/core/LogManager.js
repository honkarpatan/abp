export class LogManager {
    static listeners = [];
    static logs = [];
    static maxLogs = 500; // Maximum logs to keep in memory

    // Log Levels
    static VERBOSE = 'V';
    static DEBUG = 'D';
    static INFO = 'I';
    static WARN = 'W';
    static ERROR = 'E';
    static ASSERT = 'A';

    // UI-তে আপডেট পাঠানোর জন্য Listener
    static subscribe(callback) {
        this.listeners.push(callback);
        // Send existing logs to new subscriber
        this.logs.forEach(log => callback(log));
    }

    static unsubscribe(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    // লগ অ্যাড করা (Android Style)
    static v(tag, msg) { this._add(this.VERBOSE, tag, msg); }
    static d(tag, msg) { this._add(this.DEBUG, tag, msg); }
    static i(tag, msg) { this._add(this.INFO, tag, msg); }
    static w(tag, msg) { this._add(this.WARN, tag, msg); }
    static e(tag, msg) { this._add(this.ERROR, tag, msg); }
    static a(tag, msg) { this._add(this.ASSERT, tag, msg); }

    // With object support (like console.log)
    static log(level, tag, ...args) {
        const msg = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        this._add(level, tag, msg);
    }

    static _add(level, tag, msg) {
        // Check if logcat is enabled (default true if not set)
        const isLogcatEnabled = typeof localStorage !== 'undefined' 
            ? localStorage.getItem('aid_preview_logcat') !== 'false'
            : true;
        
        // If logcat is disabled, don't generate logs
        if (!isLogcatEnabled) {
            return;
        }
        
        const time = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: "2-digit", 
            minute: "2-digit", 
            second: "2-digit", 
            fractionalSecondDigits: 3 
        });
        
        // Generate realistic PID (persistent per tag for session)
        const pid = this._getPidForTag(tag);

        const logEntry = { 
            time, 
            pid, 
            level, 
            tag, 
            msg,
            timestamp: Date.now() 
        };
        
        this.logs.push(logEntry);

        // Keep only last N logs (memory management)
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // UI আপডেট করা
        this.listeners.forEach(cb => cb(logEntry));
    }

    // Generate consistent PID for each tag
    static _pidMap = new Map();
    static _getPidForTag(tag) {
        if (!this._pidMap.has(tag)) {
            this._pidMap.set(tag, Math.floor(Math.random() * 5000) + 1000);
        }
        return this._pidMap.get(tag);
    }

    static clear() {
        this.logs = [];
        this._pidMap.clear();
        this.listeners.forEach(cb => cb(null, true)); // true means cleared
    }

    // Export logs as text
    static export() {
        return this.logs.map(log => 
            `${log.time} ${log.pid} ${log.level}/${log.tag}: ${log.msg}`
        ).join('\n');
    }

    // Export logs as JSON
    static exportJSON() {
        return JSON.stringify(this.logs, null, 2);
    }

    // Filter logs
    static filter(options = {}) {
        let filtered = [...this.logs];

        if (options.level) {
            filtered = filtered.filter(log => log.level === options.level);
        }

        if (options.tag) {
            filtered = filtered.filter(log => 
                log.tag.toLowerCase().includes(options.tag.toLowerCase())
            );
        }

        if (options.search) {
            filtered = filtered.filter(log => 
                log.msg.toLowerCase().includes(options.search.toLowerCase()) ||
                log.tag.toLowerCase().includes(options.search.toLowerCase())
            );
        }

        if (options.since) {
            filtered = filtered.filter(log => log.timestamp >= options.since);
        }

        if (options.until) {
            filtered = filtered.filter(log => log.timestamp <= options.until);
        }

        return filtered;
    }

    // Get log statistics
    static getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byTag: {},
            timeRange: {
                start: this.logs[0]?.time || 'N/A',
                end: this.logs[this.logs.length - 1]?.time || 'N/A'
            }
        };

        this.logs.forEach(log => {
            // Count by level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            
            // Count by tag
            stats.byTag[log.tag] = (stats.byTag[log.tag] || 0) + 1;
        });

        return stats;
    }

    // Save logs to file (download)
    static download(filename = 'logcat.txt') {
        const content = this.export();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Global access for easy debugging in console
if (typeof window !== 'undefined') {
    window.Log = LogManager;
}