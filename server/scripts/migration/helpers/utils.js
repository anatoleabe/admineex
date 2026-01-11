const path = require('path');
let nconf = null;
try {
    nconf = require('nconf');
} catch (e) {
    // Optional dependency; fall back to env only
}
const mongoose = require('mongoose');

function stripQuotes(val) {
    if (typeof val !== 'string') return val;
    const m = val.match(/^['"](.*)['"]$/);
    return m ? m[1] : val;
}

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '\\') continue; // ignore line-continuation backslashes passed literally
        if (!arg.startsWith('--')) continue;
        const eq = arg.indexOf('=');
        if (eq !== -1) {
            const key = arg.slice(2, eq);
            const val = stripQuotes(arg.slice(eq + 1));
            args[key] = val;
            continue;
        }
        const key = arg.replace(/^--/, '');
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
            args[key] = stripQuotes(next);
            i += 1;
        } else {
            args[key] = true;
        }
    }
    return args;
}

function parseNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const raw = String(value).trim();
    if (!raw) return null;
    // Handle both thousands separators and decimal commas.
    // - "1,109,105" -> 1109105
    // - "433,524" -> 433524
    // - "25,0" / "5,28" -> 25.0 / 5.28
    const compact = raw.replace(/\s+/g, '');
    const commaCount = (compact.match(/,/g) || []).length;
    const dotCount = (compact.match(/\./g) || []).length;
    let normalized = compact;
    if (commaCount === 1 && dotCount === 0) {
        const [left, right] = compact.split(',');
        if (right && right.length <= 2) {
            normalized = `${left}.${right}`;
        } else {
            normalized = compact.replace(/,/g, '');
        }
    } else {
        normalized = compact.replace(/,/g, '');
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

function ensureConfigLoaded() {
    if (!nconf) return;
    try {
        nconf.file(path.resolve(__dirname, '../../../server/config/server.json'));
    } catch (e) {
        // Ignore; will fallback to env
    }
}

async function connectMongo() {
    ensureConfigLoaded();
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || (nconf ? nconf.get('mongo') : null) || 'mongodb://127.0.0.1:27017/persabe01092026';
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    return mongoose.connection;
}

function mapInstanceStatus(statusInput) {
    const normalized = (statusInput || '').toLowerCase();
    if (normalized === 'paid') return 'paid';
    if (normalized === 'under_review') return 'under_review';
    if (normalized === 'approved') return 'approved';
    // "validated" maps to approved
    return 'approved';
}

function parseReferencePeriod(ref) {
    if (!ref) throw new Error('referencePeriod is required (YYYY-Qn or YYYY-MM)');
    const trimmed = ref.trim();
    if (/^\d{4}-Q[1-4]$/.test(trimmed)) return trimmed;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) return trimmed;
    throw new Error(`Invalid referencePeriod format: ${ref} (expected YYYY-Qn or YYYY-MM)`);
}

function getSnapshotDate(referencePeriod) {
    const ref = parseReferencePeriod(referencePeriod);
    if (ref.includes('Q')) {
        const [yearStr, quarterStr] = ref.split('-Q');
        const year = Number(yearStr);
        const quarter = Number(quarterStr);
        const month = (quarter - 1) * 3; // 0-indexed
        return new Date(Date.UTC(year, month, 1));
    }
    const [year, month] = ref.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
}

function buildComment(...inputs) {
    const parts = [];
    for (const input of inputs) {
        if (!input) continue;
        const s = String(input).trim();
        if (s) parts.push(s);
    }
    return parts.join(' | ');
}

module.exports = {
    parseArgs,
    parseNumber,
    connectMongo,
    parseReferencePeriod,
    getSnapshotDate,
    mapInstanceStatus,
    buildComment
};
