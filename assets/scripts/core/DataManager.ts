import { sys } from 'cc';
import { GameStatus, SkillType, TOTAL_LEVELS } from './GameTypes';

export const ECONOMY = {
    STARTER_COINS: 220,
    STARTER_BOLTS: 15,
    STARTER_BOOSTERS: 2,
    BOXES_PER_COIN: 4,      // +1 Coin every 4 completed boxes (~10-18C mid-level drip)
    WIN_BASE_COINS: 30,
    DAILY_WIN_COINS: 90,
    WIN_BOLTS: 8,
    DAILY_WIN_BOLTS: 16,
    STREAK_BONUS_PER_WIN: 5,
    STREAK_BONUS_MAX: 15,
    COST_UNLOCK_BOX: 80,
    COST_BOOSTER: 60,
    COST_REVIVE: 100,
} as const;

export const ONBOARDING_MILESTONES: Record<number, { coins: number; bonusSkill?: 'slot' | 'clear' | 'melt' }> = {
    1: { coins: 40 },
    2: { coins: 50 },
    3: { coins: 50 },
    4: { coins: 60 },
};

export interface SkillInventory {
    slot: number;
    clear: number;
    melt: number;
}

export interface GalleryProgress {
    activeArtId: string;
    filledCounts: Record<string, number>;
    claimedRewards: string[];
}

interface SavePayload {
    level: number;
    maxLevel: number;
    coins: number;
    bolts: number;
    winStreak: number;
    bestStreak: number;
    totalScore: number;
    sound: boolean;
    vibrate: boolean;
    difficultyIndex: number;
    playerCountry: string;
    playerName: string;
    noAdsPurchased: boolean;
    skillCounts: SkillInventory;
    dailyCompletedDates: string[];
    claimedMilestones: number[];
    gallery: GalleryProgress;
}

const STORAGE_KEY = 'screw_out_overseas_v1';

export class DataManager {
    private static _ins: DataManager | null = null;
    public static get ins(): DataManager {
        if (!this._ins) {
            this._ins = new DataManager();
            this._ins.load();
        }
        return this._ins;
    }

    public level = 1;           // 1-based level number (maps to lv_0..lv_100)
    public maxLevel = 1;
    public coins: number = ECONOMY.STARTER_COINS;
    public bolts: number = ECONOMY.STARTER_BOLTS;  // Collected screws currency for Pixel Art Gallery
    public winStreak = 0;       // Consecutive wins (grants start-of-level buffs)
    public bestStreak = 0;
    public totalScore = 0;      // Used for Global & Country Leaderboard
    public soundEnabled = true;
    public vibrateEnabled = true;
    public difficultyIndex = 0;
    public playerCountry = 'US';
    public playerName = 'Player';
    public noAdsPurchased = false;

    public skillCounts: SkillInventory = {
        slot: ECONOMY.STARTER_BOOSTERS,
        clear: ECONOMY.STARTER_BOOSTERS,
        melt: ECONOMY.STARTER_BOOSTERS,
    };

    public dailyCompletedDates: string[] = [];
    public claimedMilestones: number[] = [];

    public gallery: GalleryProgress = {
        activeArtId: 'lucky_cat',
        filledCounts: {},
        claimedRewards: [],
    };

    // Runtime state (reset per level)
    public status: GameStatus = GameStatus.MENU;
    public isSkill = false;
    public skillIndex: SkillType | -1 = -1;
    public levelProgress = 0;
    public canReviveTime = 3;
    public isDailyMode = false;
    public activeDailyDateKey = '';
    public lastWinCoins = 30;
    public lastWinBolts = 12;
    public lastMilestoneCoins = 0;

    public load(): void {
        try {
            const raw = sys.localStorage.getItem(STORAGE_KEY) || sys.localStorage.getItem('screw_out_v3_save');
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<SavePayload>;
            if (typeof parsed.level === 'number' && parsed.level >= 1) {
                this.level = Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(parsed.level)));
            }
            if (typeof parsed.maxLevel === 'number' && parsed.maxLevel >= 1) {
                this.maxLevel = Math.min(TOTAL_LEVELS, Math.max(this.level, Math.floor(parsed.maxLevel)));
            }
            if (typeof parsed.coins === 'number') this.coins = Math.max(0, Math.floor(parsed.coins));
            if (typeof parsed.bolts === 'number') this.bolts = Math.max(0, Math.floor(parsed.bolts));
            if (typeof parsed.winStreak === 'number') this.winStreak = Math.max(0, Math.floor(parsed.winStreak));
            if (typeof parsed.bestStreak === 'number') this.bestStreak = Math.max(this.winStreak, Math.floor(parsed.bestStreak));
            if (typeof parsed.totalScore === 'number') this.totalScore = Math.max(0, Math.floor(parsed.totalScore));
            if (typeof parsed.sound === 'boolean') this.soundEnabled = parsed.sound;
            if (typeof parsed.vibrate === 'boolean') this.vibrateEnabled = parsed.vibrate;
            if (typeof parsed.difficultyIndex === 'number') this.difficultyIndex = parsed.difficultyIndex;
            if (typeof parsed.playerCountry === 'string' && parsed.playerCountry.length === 2) {
                this.playerCountry = parsed.playerCountry;
            }
            if (typeof parsed.playerName === 'string' && parsed.playerName.trim().length > 0) {
                this.playerName = parsed.playerName.trim().slice(0, 14);
            }
            if (typeof parsed.noAdsPurchased === 'boolean') this.noAdsPurchased = parsed.noAdsPurchased;
            if (parsed.skillCounts) {
                this.skillCounts = {
                    slot: Math.max(0, Math.floor(parsed.skillCounts.slot ?? 2)),
                    clear: Math.max(0, Math.floor(parsed.skillCounts.clear ?? 2)),
                    melt: Math.max(0, Math.floor(parsed.skillCounts.melt ?? 2)),
                };
            }
            if (Array.isArray(parsed.dailyCompletedDates)) {
                this.dailyCompletedDates = parsed.dailyCompletedDates.filter((d) => typeof d === 'string').slice(-60);
            }
            if (Array.isArray(parsed.claimedMilestones)) {
                this.claimedMilestones = parsed.claimedMilestones.filter((n) => typeof n === 'number');
            }
            if (parsed.gallery && typeof parsed.gallery === 'object') {
                this.gallery = {
                    activeArtId: parsed.gallery.activeArtId || 'lucky_cat',
                    filledCounts: parsed.gallery.filledCounts || {},
                    claimedRewards: Array.isArray(parsed.gallery.claimedRewards) ? parsed.gallery.claimedRewards : [],
                };
            }
        } catch {
            // Ignore malformed storage
        }
    }

    public save(): void {
        const payload: SavePayload = {
            level: this.level,
            maxLevel: this.maxLevel,
            coins: this.coins,
            bolts: this.bolts,
            winStreak: this.winStreak,
            bestStreak: this.bestStreak,
            totalScore: this.totalScore,
            sound: this.soundEnabled,
            vibrate: this.vibrateEnabled,
            difficultyIndex: this.difficultyIndex,
            playerCountry: this.playerCountry,
            playerName: this.playerName,
            noAdsPurchased: this.noAdsPurchased,
            skillCounts: this.skillCounts,
            dailyCompletedDates: this.dailyCompletedDates,
            claimedMilestones: this.claimedMilestones,
            gallery: this.gallery,
        };
        try {
            sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore storage quota errors
        }
    }

    public resetLevelRuntime(): void {
        this.status = GameStatus.RUNNING;
        this.isSkill = false;
        this.skillIndex = -1;
        this.levelProgress = 0;
        this.canReviveTime = 3;
    }

    public getLevelFileIndex(): number {
        return ((this.level - 1) % TOTAL_LEVELS + TOTAL_LEVELS) % TOTAL_LEVELS;
    }

    public advanceLevel(): void {
        this.level = this.level >= TOTAL_LEVELS ? 1 : this.level + 1;
        if (this.level > this.maxLevel) {
            this.maxLevel = this.level;
        }
        this.save();
    }

    public addCoins(amount: number): void {
        this.coins = Math.max(0, this.coins + Math.floor(amount));
        this.save();
    }

    public spendCoins(amount: number): boolean {
        if (this.coins < amount) return false;
        this.coins -= amount;
        this.save();
        return true;
    }

    public addBolts(amount: number): void {
        this.bolts = Math.max(0, this.bolts + Math.floor(amount));
        this.save();
    }

    public spendBolts(amount: number): boolean {
        if (this.bolts < amount) return false;
        this.bolts -= amount;
        this.save();
        return true;
    }

    public recordWin(isDaily: boolean): { coins: number; bolts: number; score: number; milestoneCoins: number } {
        this.winStreak += 1;
        if (this.winStreak > this.bestStreak) {
            this.bestStreak = this.winStreak;
        }
        const streakBonusCoins = Math.min(ECONOMY.STREAK_BONUS_MAX, this.winStreak * ECONOMY.STREAK_BONUS_PER_WIN);
        let milestoneCoins = 0;
        if (!isDaily && !this.claimedMilestones.includes(this.level)) {
            const ms = ONBOARDING_MILESTONES[this.level];
            if (ms) {
                this.claimedMilestones.push(this.level);
                milestoneCoins = ms.coins;
                if (ms.bonusSkill) {
                    this.skillCounts[ms.bonusSkill] += 1;
                }
            }
        }
        const coins = (isDaily ? ECONOMY.DAILY_WIN_COINS : ECONOMY.WIN_BASE_COINS) + streakBonusCoins + milestoneCoins;
        const bolts = isDaily ? ECONOMY.DAILY_WIN_BOLTS : ECONOMY.WIN_BOLTS;
        const score = (isDaily ? 250 : 100) + this.winStreak * 20;

        this.coins += coins;
        this.bolts += bolts;
        this.totalScore += score;
        this.lastWinCoins = coins;
        this.lastWinBolts = bolts;
        this.lastMilestoneCoins = milestoneCoins;

        if (isDaily && this.activeDailyDateKey && !this.dailyCompletedDates.includes(this.activeDailyDateKey)) {
            this.dailyCompletedDates.push(this.activeDailyDateKey);
        }
        this.save();
        return { coins, bolts, score, milestoneCoins };
    }

    public resetWinStreak(): void {
        if (this.winStreak > 0) {
            this.winStreak = 0;
            this.save();
        }
    }

    /**
     * Win Streak Tier Buffs (applied automatically at level start):
     * - Tier 1 (streak >= 1): +1 Extra Holding Slot unlocked at start
     * - Tier 2 (streak >= 2): +1 Extra Holding Slot + 1 Free Clear Tray charge
     * - Tier 3 (streak >= 3): +1 Extra Holding Slot + 3rd Target Box unlocked at start!
     */
    public getWinStreakTier(): number {
        if (this.winStreak >= 5) return 3;
        if (this.winStreak >= 2) return 2;
        if (this.winStreak >= 1) return 1;
        return 0;
    }

    public getSkillKey(skill: SkillType): keyof SkillInventory | null {
        if (skill === SkillType.UNLOCK_SLOT) return 'slot';
        if (skill === SkillType.CLEAR_TRAY) return 'clear';
        if (skill === SkillType.SMASH_BOARD) return 'melt';
        return null;
    }

    public getSkillCount(skill: SkillType): number {
        const key = this.getSkillKey(skill);
        return key ? this.skillCounts[key] : 0;
    }

    public consumeSkill(skill: SkillType): boolean {
        const key = this.getSkillKey(skill);
        if (!key || this.skillCounts[key] <= 0) return false;
        this.skillCounts[key] -= 1;
        this.save();
        return true;
    }

    public addSkill(skill: SkillType, amount: number): void {
        const key = this.getSkillKey(skill);
        if (!key) return;
        this.skillCounts[key] = Math.max(0, this.skillCounts[key] + amount);
        this.save();
    }

    public isDailyCompleted(dateKey: string): boolean {
        return this.dailyCompletedDates.includes(dateKey);
    }

    public resetProgress(): void {
        this.level = 1;
        this.maxLevel = 1;
        this.coins = 120;
        this.bolts = 20;
        this.winStreak = 0;
        this.bestStreak = 0;
        this.totalScore = 0;
        this.difficultyIndex = 0;
        this.dailyCompletedDates = [];
        this.skillCounts = { slot: 2, clear: 2, melt: 2 };
        this.gallery = { activeArtId: 'lucky_cat', filledCounts: {}, claimedRewards: [] };
        this.save();
    }
}
