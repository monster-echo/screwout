import { sys } from 'cc';
import { GameStatus, SkillType, TOTAL_LEVELS } from './GameTypes';

interface SavePayload {
    level: number;
    maxLevel: number;
    coins: number;
    sound: boolean;
    vibrate: boolean;
    difficultyIndex: number;
}

const STORAGE_KEY = 'screw_out_v3_save';

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
    public coins = 100;
    public soundEnabled = true;
    public vibrateEnabled = true;
    public difficultyIndex = 0;

    // Runtime state (reset per level)
    public status: GameStatus = GameStatus.MENU;
    public isSkill = false;
    public skillIndex: SkillType | -1 = -1;
    public levelProgress = 0;
    public canReviveTime = 3;

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
            if (typeof parsed.coins === 'number') this.coins = Math.max(0, Math.floor(parsed.coins));
            if (typeof parsed.sound === 'boolean') this.soundEnabled = parsed.sound;
            if (typeof parsed.vibrate === 'boolean') this.vibrateEnabled = parsed.vibrate;
            if (typeof parsed.difficultyIndex === 'number') this.difficultyIndex = parsed.difficultyIndex;
        } catch {
            // Ignore malformed storage
        }
    }

    public save(): void {
        const payload: SavePayload = {
            level: this.level,
            maxLevel: this.maxLevel,
            coins: this.coins,
            sound: this.soundEnabled,
            vibrate: this.vibrateEnabled,
            difficultyIndex: this.difficultyIndex,
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
        this.coins = Math.max(0, this.coins + amount);
        this.save();
    }

    public resetProgress(): void {
        this.level = 1;
        this.maxLevel = 1;
        this.coins = 100;
        this.difficultyIndex = 0;
        this.save();
    }
}
