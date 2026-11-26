import { sys } from 'cc';
import { GameStatus, SkillType, ThemeId, TOTAL_LEVELS } from './GameTypes';

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
    bolts: number;
    sound: boolean;
    vibrate: boolean;
    skillCounts: SkillInventory;
    gallery: GalleryProgress;
    activeTheme: ThemeId;
    unlockedThemes: ThemeId[];
}

const STORAGE_KEY = 'screw_out_clean_v1';

export class DataManager {
    private static _ins: DataManager | null = null;
    public static get ins(): DataManager {
        if (!this._ins) {
            this._ins = new DataManager();
            this._ins.load();
        }
        return this._ins;
    }

    public level = 1;
    public maxLevel = 1;
    public bolts = 15;          // Earned by clearing levels to build 3D screw pixel artworks
    public soundEnabled = true;
    public vibrateEnabled = true;

    // 1 free starter charge of each booster; when 0, players watch a Rewarded Ad to use
    public skillCounts: SkillInventory = {
        slot: 1,
        clear: 1,
        melt: 1,
    };

    public gallery: GalleryProgress = {
        activeArtId: 'lucky_cat',
        filledCounts: {},
        claimedRewards: [],
    };

    // Dual-theme strategy: Sweet Dessert is the default starter skin for high CTR & ASMR onboarding;
    // Wood & Acrylic (Lv 10) and Minimalist Nordic (Lv 20) unlock progressively or via Rewarded Ad.
    public activeTheme: ThemeId = 'dessert';
    public unlockedThemes: ThemeId[] = ['dessert'];

    // Runtime state (reset per level)
    public status: GameStatus = GameStatus.MENU;
    public isSkill = false;
    public skillIndex: SkillType | -1 = -1;
    public levelProgress = 0;
    public lastWinBolts = 15;

    public load(): void {
        try {
            const raw = sys.localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<SavePayload>;
            if (typeof parsed.level === 'number' && parsed.level >= 1) {
                this.level = Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(parsed.level)));
            }
            if (typeof parsed.maxLevel === 'number' && parsed.maxLevel >= 1) {
                this.maxLevel = Math.min(TOTAL_LEVELS, Math.max(this.level, Math.floor(parsed.maxLevel)));
            }
            if (typeof parsed.bolts === 'number') this.bolts = Math.max(0, Math.floor(parsed.bolts));
            if (typeof parsed.sound === 'boolean') this.soundEnabled = parsed.sound;
            if (typeof parsed.vibrate === 'boolean') this.vibrateEnabled = parsed.vibrate;
            if (parsed.skillCounts) {
                this.skillCounts = {
                    slot: Math.max(0, Math.floor(parsed.skillCounts.slot ?? 1)),
                    clear: Math.max(0, Math.floor(parsed.skillCounts.clear ?? 1)),
                    melt: Math.max(0, Math.floor(parsed.skillCounts.melt ?? 1)),
                };
            }
            if (parsed.gallery && typeof parsed.gallery === 'object') {
                this.gallery = {
                    activeArtId: parsed.gallery.activeArtId || 'lucky_cat',
                    filledCounts: parsed.gallery.filledCounts || {},
                    claimedRewards: Array.isArray(parsed.gallery.claimedRewards) ? parsed.gallery.claimedRewards : [],
                };
            }
            if (parsed.activeTheme === 'dessert' || parsed.activeTheme === 'acrylic' || parsed.activeTheme === 'nordic') {
                this.activeTheme = parsed.activeTheme;
            }
            if (Array.isArray(parsed.unlockedThemes)) {
                const valid = parsed.unlockedThemes.filter(
                    (t): t is ThemeId => t === 'dessert' || t === 'acrylic' || t === 'nordic',
                );
                this.unlockedThemes = valid.includes('dessert') ? valid : ['dessert', ...valid];
            }
        } catch {
            // Ignore malformed storage
        }
    }

    public save(): void {
        const payload: SavePayload = {
            level: this.level,
            maxLevel: this.maxLevel,
            bolts: this.bolts,
            sound: this.soundEnabled,
            vibrate: this.vibrateEnabled,
            skillCounts: this.skillCounts,
            gallery: this.gallery,
            activeTheme: this.activeTheme,
            unlockedThemes: this.unlockedThemes,
        };
        try {
            sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore quota errors
        }
    }

    public resetLevelRuntime(): void {
        this.status = GameStatus.RUNNING;
        this.isSkill = false;
        this.skillIndex = -1;
        this.levelProgress = 0;
    }

    public advanceLevel(): void {
        this.level = this.level >= TOTAL_LEVELS ? 1 : this.level + 1;
        if (this.level > this.maxLevel) {
            this.maxLevel = this.level;
        }
        this.save();
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

    public recordWin(): { bolts: number } {
        const bolts = 15;
        this.bolts += bolts;
        this.lastWinBolts = bolts;
        this.save();
        return { bolts };
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

    public resetProgress(): void {
        this.level = 1;
        this.maxLevel = 1;
        this.bolts = 15;
        this.skillCounts = { slot: 1, clear: 1, melt: 1 };
        this.gallery = { activeArtId: 'lucky_cat', filledCounts: {}, claimedRewards: [] };
        this.save();
    }
}
