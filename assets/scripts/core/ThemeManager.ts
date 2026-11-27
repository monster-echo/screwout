import { Color, SpriteFrame } from 'cc';
import {
    DESSERT_BOARD_PALETTE,
    ThemeConfig,
    ThemeId,
} from './GameTypes';
import { ResManager } from './ResManager';

export const SWEET_CANDY_THEME: ThemeConfig = {
    id: 'dessert',
    name: 'Sweet Candy',
    subtitle: 'Frosted sugar cookies, macaron pastry boxes & gummy candy bolts',
    boardPalette: DESSERT_BOARD_PALETTE,
    frameTintHex: '#ffffff', // Preserve baked golden butter-cookie crust colors natively
    useGummyBounce: true,
    useCrumbParticles: true,
};

export class ThemeManager {
    private static _ins: ThemeManager | null = null;
    public static get ins(): ThemeManager {
        if (!this._ins) {
            this._ins = new ThemeManager();
        }
        return this._ins;
    }

    public get activeId(): ThemeId {
        return 'dessert';
    }

    public get activeConfig(): ThemeConfig {
        return SWEET_CANDY_THEME;
    }

    public getScrewSprite(colorId: number): SpriteFrame | null {
        return ResManager.ins.getThemeSprite(`dessert_screw${colorId}`)
            || ResManager.ins.getGameSprite(`gbz_screw${colorId}`);
    }

    public getBoxSprite(colorId: number): SpriteFrame | null {
        return ResManager.ins.getThemeSprite(`dessert_box${colorId}`)
            || ResManager.ins.getGameSprite(`gbz_box${colorId}`);
    }

    public getCoverSprite(colorId: number): SpriteFrame | null {
        return ResManager.ins.getThemeSprite(`dessert_cover${colorId}`)
            || ResManager.ins.getGameSprite(`gbz_cover${colorId}`);
    }

    public getLockedBoxSprite(): SpriteFrame | null {
        return ResManager.ins.getThemeSprite('dessert_box_locked')
            || ResManager.ins.getUiSprite('box_locked')
            || ResManager.ins.getGameSprite('gbz_box0');
    }

    public getHoleSprite(): SpriteFrame | null {
        return ResManager.ins.getThemeSprite('dessert_hole')
            || ResManager.ins.getUiSprite('gbz_screw_core')
            || ResManager.ins.getGameSprite('hole');
    }

    public getGameBgSprite(): SpriteFrame | null {
        return ResManager.ins.getThemeSprite('bg_dessert_game')
            || ResManager.ins.getUiSprite('bg_game_poly');
    }

    public getMenuBgSprite(): SpriteFrame | null {
        return ResManager.ins.getThemeSprite('bg_dessert_menu')
            || ResManager.ins.getUiSprite('bg_menu_hex');
    }

    public getTopFrameSprite(): SpriteFrame | null {
        return ResManager.ins.getThemeSprite('dessert_frame')
            || ResManager.ins.getGameSprite('frame');
    }

    public getLogoSprite(): SpriteFrame | null {
        return ResManager.ins.getThemeSprite('logo_sweet_jam')
            || ResManager.ins.getUiSprite('logo_screw_jam');
    }

    public getBoardPalette(): string[] {
        return SWEET_CANDY_THEME.boardPalette;
    }

    public getBoardFrameColor(): Color {
        return new Color().fromHEX(SWEET_CANDY_THEME.frameTintHex);
    }
}
