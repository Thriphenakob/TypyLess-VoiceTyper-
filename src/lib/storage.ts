/**
 * Local Storage Data Layer for VoiceTyper
 * All data is stored in localStorage - no backend needed.
 */

// --- Types ---

export interface HistoryItem {
    id: string;
    time: string;      // ISO timestamp
    text: string;
    wordCount: number;
    isInfo?: boolean;   // e.g. "音频无声"
    duration?: number;  // seconds
}

export interface AppConfig {
    hotkey: string;
    soundFeedback: boolean;
    holdToRecord: boolean;
    blockInput: boolean;
    interfaceLang: string;
    translateTarget: string;
    langVariant: string;
    microphone: string;
    muteOnRecord: boolean;
    startOnBoot: boolean;
    voiceInputHotkey: string;
    handsfreeHotkey: string;
    translateHotkey: string;
    // AI Engine
    asrBackend: 'local' | 'api';
    asrLocalModel: string;
    asrLocalModelPath: string;
    asrApiUrl: string;
    asrApiKey: string;
    asrApiModel: string;
    llmBackend: 'local' | 'api';
    llmLocalModel: string;
    llmApiUrl: string;
    llmApiKey: string;
    llmApiModel: string;
    polishEnabled: boolean;
}

export interface UserProfile {
    nickname: string;
    avatarUrl: string;
    registeredAt: string; // ISO date
}

export interface DailyStats {
    date: string;        // YYYY-MM-DD
    wordCount: number;
    sessionCount: number;
    durationMinutes: number;
}

// --- Keys ---
const KEYS = {
    HISTORY: 'voicetyper_history',
    CONFIG: 'voicetyper_config',
    PROFILE: 'voicetyper_profile',
    DAILY_STATS: 'voicetyper_daily_stats',
};

// --- Defaults ---

const DEFAULT_CONFIG: AppConfig = {
    hotkey: 'F2',
    soundFeedback: true,
    holdToRecord: false,
    blockInput: true,
    interfaceLang: 'zh-CN',
    translateTarget: 'en',
    langVariant: 'en-US',
    microphone: 'default',
    muteOnRecord: false,
    startOnBoot: false,
    voiceInputHotkey: 'F2',
    handsfreeHotkey: 'Space',
    translateHotkey: 'Alt+T',
    // AI Engine defaults
    asrBackend: 'local',
    asrLocalModel: 'whisper-base',
    asrLocalModelPath: '',
    asrApiUrl: '',
    asrApiKey: '',
    asrApiModel: 'whisper-1',
    llmBackend: 'local',
    llmLocalModel: 'qwen2.5:3b',
    llmApiUrl: '',
    llmApiKey: '',
    llmApiModel: '',
    polishEnabled: true,
};

const DEFAULT_PROFILE: UserProfile = {
    nickname: '用户',
    avatarUrl: '',
    registeredAt: new Date().toISOString(),
};

// --- Helpers ---

function read<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function write(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
}

// --- History ---

export function getHistory(): HistoryItem[] {
    return read<HistoryItem[]>(KEYS.HISTORY, []);
}

export function addHistoryItem(item: Omit<HistoryItem, 'id'>): HistoryItem {
    const history = getHistory();
    const newItem: HistoryItem = {
        ...item,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };
    history.unshift(newItem); // newest first
    write(KEYS.HISTORY, history);
    // Also update daily stats
    updateDailyStats(item.wordCount, item.duration || 0);
    return newItem;
}

export function clearHistory(): void {
    write(KEYS.HISTORY, []);
}

// --- Config ---

export function getConfig(): AppConfig {
    const config = { ...DEFAULT_CONFIG, ...read<Partial<AppConfig>>(KEYS.CONFIG, {}) };

    // Migrate modifier-only shortcuts that Electron cannot register globally.
    if (config.translateHotkey === 'RightAlt' || config.translateHotkey === 'Alt') {
        config.translateHotkey = DEFAULT_CONFIG.translateHotkey;
    }

    return config;
}

export function updateConfig(patch: Partial<AppConfig>): AppConfig {
    const config = { ...getConfig(), ...patch };
    write(KEYS.CONFIG, config);
    return config;
}

// --- Profile ---

export function getProfile(): UserProfile {
    return { ...DEFAULT_PROFILE, ...read<Partial<UserProfile>>(KEYS.PROFILE, {}) };
}

export function updateProfile(patch: Partial<UserProfile>): UserProfile {
    const profile = { ...getProfile(), ...patch };
    write(KEYS.PROFILE, profile);
    return profile;
}

// --- Daily Stats ---

function todayKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function getDailyStats(): DailyStats[] {
    return read<DailyStats[]>(KEYS.DAILY_STATS, []);
}

function updateDailyStats(words: number, durationSec: number): void {
    const stats = getDailyStats();
    const today = todayKey();
    const idx = stats.findIndex(s => s.date === today);
    if (idx >= 0) {
        stats[idx].wordCount += words;
        stats[idx].sessionCount += 1;
        stats[idx].durationMinutes += Math.round(durationSec / 60);
    } else {
        stats.push({
            date: today,
            wordCount: words,
            sessionCount: 1,
            durationMinutes: Math.round(durationSec / 60),
        });
    }
    write(KEYS.DAILY_STATS, stats);
}

// --- Aggregated Stats ---

export function getTotalStats() {
    const stats = getDailyStats();
    const history = getHistory();
    const totalWords = stats.reduce((s, d) => s + d.wordCount, 0);
    const totalSessions = stats.reduce((s, d) => s + d.sessionCount, 0);
    const totalMinutes = stats.reduce((s, d) => s + d.durationMinutes, 0);
    const totalDays = stats.length;

    // Streak calculation
    let streak = 0;
    const sortedDates = stats.map(s => s.date).sort().reverse();
    const today = todayKey();
    for (let i = 0; i < sortedDates.length; i++) {
        const expected = new Date();
        expected.setDate(expected.getDate() - i);
        const expectedStr = expected.toISOString().slice(0, 10);
        if (sortedDates[i] === expectedStr) {
            streak++;
        } else {
            break;
        }
    }

    // Last 7 days
    const last7Days: DailyStats[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const found = stats.find(s => s.date === dateStr);
        last7Days.push(found || { date: dateStr, wordCount: 0, sessionCount: 0, durationMinutes: 0 });
    }

    // Today stats
    const todayStats = stats.find(s => s.date === today) || { wordCount: 0, sessionCount: 0, durationMinutes: 0 };

    return {
        totalWords,
        totalSessions,
        totalMinutes,
        totalDays,
        streak,
        last7Days,
        todayWords: todayStats.wordCount,
        todayMinutes: todayStats.durationMinutes,
        todaySessions: todayStats.sessionCount,
        historyCount: history.length,
    };
}

// --- Achievements ---

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
}

export function getAchievements(): Achievement[] {
    const stats = getTotalStats();
    const history = getHistory();

    // Check late night usage
    const hasLateNight = history.some(h => {
        const hour = new Date(h.time).getHours();
        return hour >= 23 || hour < 3;
    });

    return [
        {
            id: 'streak_7',
            title: '连击王',
            description: '连续使用 7 天',
            icon: '🔥',
            unlocked: stats.streak >= 7,
        },
        {
            id: 'words_100k',
            title: '话痨',
            description: '累计输入超过 10 万字',
            icon: '💬',
            unlocked: stats.totalWords >= 100000,
        },
        {
            id: 'night_owl',
            title: '深夜话者',
            description: '在 23 点后使用',
            icon: '🌙',
            unlocked: hasLateNight,
        },
        {
            id: 'days_30',
            title: '月度常客',
            description: '累计使用超过 30 天',
            icon: '📅',
            unlocked: stats.totalDays >= 30,
        },
        {
            id: 'sessions_500',
            title: '效率达人',
            description: '累计录音超过 500 次',
            icon: '⚡',
            unlocked: stats.totalSessions >= 500,
        },
    ];
}

// --- First Launch Initialization ---

export function initFirstLaunch(): void {
    const INIT_KEY = 'voicetyper_initialized';
    if (localStorage.getItem(INIT_KEY)) return; // Already initialized

    // Set registration date = today (day 1)
    const profile: UserProfile = {
        nickname: '用户',
        avatarUrl: '',
        registeredAt: new Date().toISOString(),
    };
    write(KEYS.PROFILE, profile);

    // Empty history and stats
    write(KEYS.HISTORY, []);
    write(KEYS.DAILY_STATS, []);

    localStorage.setItem(INIT_KEY, 'true');
}
