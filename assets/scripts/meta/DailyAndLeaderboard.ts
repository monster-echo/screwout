import { DataManager } from '../core/DataManager';

export interface CountryRankEntry {
    code: string;
    name: string;
    score: number;
    isPlayerCountry: boolean;
}

export interface PlayerRankEntry {
    rank: number;
    name: string;
    country: string;
    score: number;
    streak: number;
    isSelf: boolean;
}

export const SUPPORTED_COUNTRIES: { code: string; name: string; baseScore: number }[] = [
    { code: 'US', name: 'United States', baseScore: 148200 },
    { code: 'JP', name: 'Japan', baseScore: 139600 },
    { code: 'KR', name: 'South Korea', baseScore: 132400 },
    { code: 'GB', name: 'United Kingdom', baseScore: 118900 },
    { code: 'DE', name: 'Germany', baseScore: 112500 },
    { code: 'FR', name: 'France', baseScore: 104300 },
    { code: 'CA', name: 'Canada', baseScore: 98700 },
    { code: 'BR', name: 'Brazil', baseScore: 94200 },
    { code: 'AU', name: 'Australia', baseScore: 87400 },
    { code: 'SG', name: 'Singapore', baseScore: 81900 },
];

const GLOBAL_BOTS: { name: string; country: string; score: number; streak: number }[] = [
    { name: 'BoltKing_US', country: 'US', score: 2450, streak: 14 },
    { name: 'SoraPuzzle', country: 'JP', score: 2180, streak: 11 },
    { name: 'Minji_KR', country: 'KR', score: 1920, streak: 9 },
    { name: 'OliverFix', country: 'GB', score: 1640, streak: 7 },
    { name: 'LucasDE', country: 'DE', score: 1390, streak: 6 },
    { name: 'ChloeParis', country: 'FR', score: 1120, streak: 5 },
    { name: 'MapleJam', country: 'CA', score: 860, streak: 4 },
    { name: 'MateoBR', country: 'BR', score: 620, streak: 3 },
    { name: 'AussieScrew', country: 'AU', score: 380, streak: 2 },
    { name: 'KaiSG', country: 'SG', score: 160, streak: 1 },
];

export class DailyAndLeaderboardService {
    public static getTodayDateKey(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /** Deterministic daily level number (between Lv 6 and Lv 95) from YYYY-MM-DD */
    public static getDailyLevelNumber(dateKey = this.getTodayDateKey()): number {
        let hash = 2166136261;
        for (let i = 0; i < dateKey.length; i++) {
            hash ^= dateKey.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return 6 + (Math.abs(hash) % 90);
    }

    public static getCountryLeaderboard(): CountryRankEntry[] {
        const dm = DataManager.ins;
        const daySeed = new Date().getDate();
        const entries: CountryRankEntry[] = SUPPORTED_COUNTRIES.map((c, idx) => {
            const dailyDrift = ((daySeed * (idx + 7)) % 19) * 120;
            const playerContrib = c.code === dm.playerCountry ? dm.totalScore : 0;
            return {
                code: c.code,
                name: c.name,
                score: c.baseScore + dailyDrift + playerContrib,
                isPlayerCountry: c.code === dm.playerCountry,
            };
        });
        entries.sort((a, b) => b.score - a.score);
        return entries;
    }

    public static getGlobalPlayerLeaderboard(): PlayerRankEntry[] {
        const dm = DataManager.ins;
        const all: Omit<PlayerRankEntry, 'rank'>[] = GLOBAL_BOTS.map((b) => ({
            ...b,
            isSelf: false,
        }));
        all.push({
            name: `${dm.playerName} (You)`,
            country: dm.playerCountry,
            score: dm.totalScore,
            streak: dm.winStreak,
            isSelf: true,
        });
        all.sort((a, b) => b.score - a.score);
        return all.map((item, idx) => ({ ...item, rank: idx + 1 }));
    }

    public static cyclePlayerCountry(): string {
        const cur = DataManager.ins.playerCountry;
        const idx = SUPPORTED_COUNTRIES.findIndex((c) => c.code === cur);
        const next = SUPPORTED_COUNTRIES[(idx + 1) % SUPPORTED_COUNTRIES.length];
        DataManager.ins.playerCountry = next.code;
        DataManager.ins.save();
        return next.code;
    }

    public static buildShareText(): string {
        const dm = DataManager.ins;
        return `I reached Level ${dm.level} with a ${dm.winStreak}x Win Streak (${dm.totalScore} pts for ${dm.playerCountry}) in Screw Jam! Can you beat my score?`;
    }
}
