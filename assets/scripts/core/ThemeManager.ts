import { Color, SpriteFrame } from 'cc';
import {
    BOARD_PALETTE,
    DESSERT_BOARD_PALETTE,
    NORDIC_BOARD_PALETTE,
    ThemeConfig,
    ThemeId,
} from './GameTypes';
import { DataManager } from './DataManager';
import { ResManager } from './ResManager';

export const THEME_LIST: ThemeConfig[] = [
    {
        id: 'dessert',
        name: 'Sweet Dessert',
        subtitle: 'Glazed macaron boards & 3D candy screws',
        unlockLevel: 1,
        boardPalette: DESSERT_BOARD_PALETTE,
        frameTintHex: '#fffdf9', // Crisp royal-icing white rim for clean 3D layer separation!
        swatchColors: ['#ff8fb8', '#ffe066', '#7ce8b8'],
        useGummyBounce: true,
        useCrumbParticles: true,
    },
    {
        id: 'acrylic',
        name: 'Wood & Acrylic',
        subtitle: 'Crystal clarity for high-level mastery',
        unlockLevel: 10,
        boardPalette: BOARD_PALETTE,
        frameTintHex: '#ffffff',
        swatchColors: ['#8de8fc', '#91f99e', '#b189ff'],
        useGummyBounce: false,
        useCrumbParticles: false,
    },
    {
        id: 'nordic',
        name: 'Minimalist Nordic',
        subtitle: 'Calm Scandinavian matte palette',
        unlockLevel: 20,
        boardPalette: NORDIC_BOARD_PALETTE,
        frameTintHex: '#f1f5f9',
        swatchColors: ['#a3c4bc', '#d8c3a5', '#9fb8d4'],
        useGummyBounce: false,
        useCrumbParticles: false,
    },
];

export type ThemeChangeListener = (theme: ThemeConfig) => void;

export class ThemeManager {
    private static _ins: ThemeManager | null = null;
    public static get ins(): ThemeManager {
        if (!this._ins) {
            this._ins = new ThemeManager();
        }
        return this._ins;
    }

    private _listeners: ThemeChangeListener[] = [];

    public get activeId(): ThemeId {
        return DataManager.ins.activeTheme;
    }

    public get activeConfig(): ThemeConfig {
        return THEME_LIST.find((t) => t.id === DataManager.ins.activeTheme) || THEME_LIST[0];
    }

    public getAllThemes(): ThemeConfig[] {
        return THEME_LIST;
    }

    public isUnlocked(id: ThemeId): boolean {
        const cfg = THEME_LIST.find((t) => t.id === id);
        if (!cfg) return false;
        if (cfg.unlockLevel <= 1) return true;
        if (DataManager.ins.maxLevel >= cfg.unlockLevel) return true;
        return DataManager.ins.unlockedThemes.includes(id);
    }

    public unlockTheme(id: ThemeId): void {
        if (!DataManager.ins.unlockedThemes.includes(id)) {
            DataManager.ins.unlockedThemes.push(id);
            DataManager.ins.save();
        }
    }

    public setTheme(id: ThemeId): boolean {
        if (!this.isUnlocked(id)) return false;
        DataManager.ins.activeTheme = id;
        DataManager.ins.save();
        const cfg = this.activeConfig;
        for (const fn of this._listeners) {
            try {
                fn(cfg);
            } catch {
                // Ignore listener errors
            }
        }
        return true;
    }

    public onThemeChanged(fn: ThemeChangeListener): void {
        if (!this._listeners.includes(fn)) {
            this._listeners.push(fn);
        }
    }

    public getScrewSprite(colorId: number): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            const sf = ResManager.ins.getThemeSprite(`dessert_screw${colorId}`);
            if (sf) return sf;
        }
        return ResManager.ins.getGameSprite(`gbz_screw${colorId}`);
    }

    public getBoxSprite(colorId: number): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            const sf = ResManager.ins.getThemeSprite(`dessert_box${colorId}`);
            if (sf) return sf;
        }
        return ResManager.ins.getGameSprite(`gbz_box${colorId}`);
    }

    public getCoverSprite(colorId: number): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            const sf = ResManager.ins.getThemeSprite(`dessert_cover${colorId}`);
            if (sf) return sf;
        }
        return ResManager.ins.getGameSprite(`gbz_cover${colorId}`);
    }

    public getLockedBoxSprite(): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            const sf = ResManager.ins.getThemeSprite('dessert_box_locked');
            if (sf) return sf;
        }
        return ResManager.ins.getUiSprite('box_locked') || ResManager.ins.getGameSprite('gbz_box0');
    }

    public getHoleSprite(): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            const sf = ResManager.ins.getThemeSprite('dessert_hole');
            if (sf) return sf;
        }
        return ResManager.ins.getUiSprite('gbz_screw_core') || ResManager.ins.getGameSprite('hole');
    }

    public getGameBgSprite(): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            return ResManager.ins.getThemeSprite('bg_dessert_game') || ResManager.ins.getUiSprite('bg_game_poly');
        }
        if (this.activeId === 'nordic') {
            return ResManager.ins.getThemeSprite('bg_nordic_game') || ResManager.ins.getUiSprite('bg_game_poly');
        }
        return ResManager.ins.getUiSprite('bg_game_poly');
    }

    public getMenuBgSprite(): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            return ResManager.ins.getThemeSprite('bg_dessert_menu') || ResManager.ins.getUiSprite('bg_menu_hex');
        }
        if (this.activeId === 'nordic') {
            return ResManager.ins.getThemeSprite('bg_nordic_menu') || ResManager.ins.getUiSprite('bg_menu_hex');
        }
        return ResManager.ins.getUiSprite('bg_menu_hex');
    }

    public getTopFrameSprite(): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            return ResManager.ins.getThemeSprite('dessert_frame') || ResManager.ins.getGameSprite('frame');
        }
        if (this.activeId === 'nordic') {
            return ResManager.ins.getThemeSprite('nordic_frame') || ResManager.ins.getGameSprite('frame');
        }
        return ResManager.ins.getGameSprite('frame');
    }

    public getLogoSprite(): SpriteFrame | null {
        if (this.activeId === 'dessert') {
            return ResManager.ins.getThemeSprite('logo_sweet_jam') || ResManager.ins.getUiSprite('logo_screw_jam');
        }
        return ResManager.ins.getUiSprite('logo_screw_jam');
    }

    public getBoardPalette(): string[] {
        return this.activeConfig.boardPalette;
    }

    public getBoardFrameColor(): Color {
        return new Color().fromHEX(this.activeConfig.frameTintHex);
    }
}
