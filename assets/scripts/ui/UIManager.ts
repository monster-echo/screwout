import {
    _decorator,
    BlockInputEvents,
    Component,
    Label,
    Node,
    Sprite,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
    Widget,
} from 'cc';
import { AudioClips, SkillType } from '../core/GameTypes';
import { DataManager } from '../core/DataManager';
import { AudioManager } from '../core/AudioManager';
import { ResManager } from '../core/ResManager';
import { MonetizationManager } from '../core/MonetizationManager';
import { ThemeManager } from '../core/ThemeManager';
import { PixelArtDef, PixelGalleryService } from '../meta/PixelGalleryData';
import { createButton, createLabel, createPanel, setPanelColor } from './UIHelper';

const { ccclass } = _decorator;

export interface UIActions {
    onStartGame: (level: number) => void;
    onRestart: () => void;
    onBackMenu: () => void;
    onNextLevel: () => void;
    onRevive: () => void;
    onUseSkill: (skill: SkillType) => void;
    onCancelSmash?: () => void;
}

@ccclass('UIManager')
export class UIManager extends Component {
    private _actions: UIActions | null = null;

    // In-game HUD (original GbzMainLayer)
    private _hudNode: Node | null = null;
    private _levelLabel: Label | null = null;
    private _progressLabel: Label | null = null;
    private _collectBoxNode: Node | null = null;
    private _smashBanner: Node | null = null;
    private _skillBadgeLabels: Map<SkillType, Label> = new Map();
    private _skillBadgeSprites: Map<SkillType, Sprite> = new Map();

    public get collectBoxNode(): Node | null {
        return this._collectBoxNode;
    }

    // Home Menu (faithful to original GbzMenuLayer)
    private _menuNode: Node | null = null;
    private _menuBgSprite: Sprite | null = null;
    private _menuLogoNode: Node | null = null;
    private _pixelCanvasNode: Node | null = null;
    private _menuProgressFill: Node | null = null;
    private _menuProgressLbl: Label | null = null;
    private _playBtnLbl: Label | null = null;
    private _pauseBtnNode: Node | null = null;
    private _lvPillNode: Node | null = null;
    private _boxProgNode: Node | null = null;
    private _skillBarNode: Node | null = null;
    private _menuSetBtn: Node | null = null;
    private _menuBottomRow: Node | null = null;

    // Popups
    private _pauseNode: Node | null = null;
    private _pauseLevelLbl: Label | null = null;
    private _pauseSoundNode: Node | null = null;
    private _pauseSoundLbl: Label | null = null;
    private _pauseVibeNode: Node | null = null;
    private _pauseVibeLbl: Label | null = null;
    private _winNode: Node | null = null;
    private _winCountLbl: Label | null = null;

    // Full-screen Paint Layer (matches original GbzPaintLayer)
    private _paintNode: Node | null = null;
    private _paintBgSprite: Sprite | null = null;
    private _paintArtCanvas: Node | null = null;
    private _paintFinishSprite: Sprite | null = null;
    private _paintFlyLayer: Node | null = null;
    private _paintBoxPile: Node | null = null;
    private _paintProgFill: Node | null = null;
    private _paintProgLbl: Label | null = null;
    private _paintTipLbl: Label | null = null;
    private _paintShotBtn: Node | null = null;
    private _paintShotLbl: Label | null = null;
    private _paintNextBtn: Node | null = null;
    private _paintScrewsLeft = 0;
    private _lastWonTotalScrews = 90;
    private _paintArt: PixelArtDef | null = null;
    private _paintCurIndex = 0;
    private _isShooting = false;

    private _loseNode: Node | null = null;
    private _settingsNode: Node | null = null;
    private _soundBtnNode: Node | null = null;
    private _soundBtnLbl: Label | null = null;
    private _vibeBtnNode: Node | null = null;
    private _vibeBtnLbl: Label | null = null;
    private _galleryNode: Node | null = null;
    private _galleryCountLbl: Label | null = null;
    private _galleryListRoot: Node | null = null;

    // Toast
    private _toastNode: Node | null = null;
    private _toastLabel: Label | null = null;
    private _toastOp: UIOpacity | null = null;

    public build(actions: UIActions): void {
        this._actions = actions;
        this.node.removeAllChildren();

        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(750, 1334);
        const w = this.node.getComponent(Widget) || this.node.addComponent(Widget);
        w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
        w.top = w.bottom = w.left = w.right = 0;
        w.updateAlignment();

        this.buildHUD();
        this.buildMenu();
        this.buildPausePopup();
        this.buildWinPopup();
        this.buildPaintLayer();
        this.buildLosePopup();
        this.buildSettingsPopup();
        this.buildGalleryModal();
        this.buildToast();

        this.showMenu();
    }

    private makeSpriteNode(name: string, parent: Node, spriteName: string, w: number, h: number): Node {
        const node = new Node(name);
        node.setParent(parent);
        const ui = node.addComponent(UITransform);
        ui.setContentSize(w, h);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        const sf = ResManager.ins.getUiSprite(spriteName) || ResManager.ins.getGameSprite(spriteName);
        if (sf) sp.spriteFrame = sf;
        return node;
    }

    private makeSpriteFit(name: string, parent: Node, spriteName: string, maxW: number, maxH: number): Node {
        const sf = ResManager.ins.getUiSprite(spriteName) || ResManager.ins.getGameSprite(spriteName);
        let w = maxW;
        let h = maxH;
        if (sf && sf.originalSize.width > 0 && sf.originalSize.height > 0) {
            const sc = Math.min(maxW / sf.originalSize.width, maxH / sf.originalSize.height);
            w = Math.round(sf.originalSize.width * sc);
            h = Math.round(sf.originalSize.height * sc);
        }
        return this.makeSpriteNode(name, parent, spriteName, w, h);
    }

    private bindTap(node: Node, onClick: () => void): void {
        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.94, 0.94, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(Vec3.ONE));
        node.on(Node.EventType.TOUCH_END, () => {
            node.setScale(Vec3.ONE);
            onClick();
        });
    }

    // ==================== In-Game HUD ====================

    private buildHUD(): void {
        this._hudNode = new Node('GbzMainLayer');
        this._hudNode.setParent(this.node);
        const hUi = this._hudNode.addComponent(UITransform);
        hUi.setContentSize(750, 1334);
        const hW = this._hudNode.addComponent(Widget);
        hW.isAlignTop = hW.isAlignBottom = hW.isAlignLeft = hW.isAlignRight = true;
        hW.top = hW.bottom = hW.left = hW.right = 0;

        // Top-left Pause button
        const pauseBtn = this.makeSpriteFit('btn_pause', this._hudNode, 'btn_pause', 74, 74);
        this._pauseBtnNode = pauseBtn;
        const pW = pauseBtn.addComponent(Widget);
        pW.isAlignTop = true;
        pW.isAlignLeft = true;
        pW.top = 22;
        pW.left = 20;
        this.bindTap(pauseBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openPause();
        });

        // Top-center capsule "LEVEL N"
        const lvPill = this.makeSpriteFit('lv_pill', this._hudNode, 'level_pill', 256, 60);
        this._lvPillNode = lvPill;
        const lW = lvPill.addComponent(Widget);
        lW.isAlignTop = true;
        lW.isAlignHorizontalCenter = true;
        lW.top = 28;
        this._levelLabel = createLabel('lv_label', lvPill, 'LEVEL 1', 25, '#ffffff', 220, 38);
        this._levelLabel.isBold = true;
        this._levelLabel.node.setPosition(0, 3, 0);

        // Right-side 3D shipping crate progress
        const boxProg = new Node('c_item');
        this._boxProgNode = boxProg;
        boxProg.setParent(this._hudNode);
        const bpUi = boxProg.addComponent(UITransform);
        bpUi.setContentSize(120, 110);
        const bpW = boxProg.addComponent(Widget);
        bpW.isAlignTop = true;
        bpW.isAlignRight = true;
        bpW.top = 365;
        bpW.right = 14;
        const xzx = this.makeSpriteFit('xzx', boxProg, 'xzx', 110, 80);
        xzx.setPosition(0, 12, 0);
        this._collectBoxNode = xzx;
        this._progressLabel = createLabel('prog_lbl', boxProg, '0%', 24, '#701a45', 120, 34);
        this._progressLabel.isBold = true;
        this._progressLabel.node.setPosition(0, -34, 0);

        // Smash-board active banner with one-tap CANCEL button (zero charge lost on cancel)
        this._smashBanner = createPanel('SmashBanner', this._hudNode, 520, 56, '#ec4899', 248, 28);
        this._smashBanner.setPosition(0, 232, 0);
        const smTxt = createLabel('SmashTxt', this._smashBanner, 'Tap any cookie to melt!', 23, '#ffffff', 340, 38);
        smTxt.isBold = true;
        smTxt.node.setPosition(-54, 0, 0);
        createButton('btn_cancel_smash', this._smashBanner, 'CANCEL', 112, 38, '#9d174d', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onCancelSmash?.();
        }, 18, '#ffffff', 19).setPosition(186, 0, 0);
        this._smashBanner.active = false;

        // Bottom 3 pearl-ivory 3D ceramic skill buttons (+1 SLOT / CLEAR / MELT)
        const skillBar = new Node('skills');
        this._skillBarNode = skillBar;
        skillBar.setParent(this._hudNode);
        const sbUi = skillBar.addComponent(UITransform);
        sbUi.setContentSize(960, 216);
        skillBar.setScale(0.62, 0.62, 1);
        const sbW = skillBar.addComponent(Widget);
        sbW.isAlignBottom = true;
        sbW.isAlignHorizontalCenter = true;
        sbW.bottom = 26;

        const skillConfigs: {
            name: string;
            type: SkillType;
            label: string;
            iconSprite: string;
            iconScale: number;
            x: number;
        }[] = [
            { name: 'btn_skill_core', type: SkillType.UNLOCK_SLOT, label: '+1 SLOT', iconSprite: 'icon_skill_slot', iconScale: 0.98, x: -320 },
            { name: 'btn_skill_screw', type: SkillType.CLEAR_TRAY, label: 'CLEAR', iconSprite: 'UI_icon3', iconScale: 0.96, x: 0 },
            { name: 'btn_skill_board', type: SkillType.SMASH_BOARD, label: 'MELT', iconSprite: 'UI_icon2', iconScale: 0.96, x: 320 },
        ];

        for (const cfg of skillConfigs) {
            const btn = this.makeSpriteNode(cfg.name, skillBar, 'skill_btn_bg', 224, 216);
            btn.setPosition(cfg.x, 0, 0);

            const icon = this.makeSpriteFit('icon', btn, cfg.iconSprite, 108, 108);
            icon.setScale(cfg.iconScale, cfg.iconScale, 1);
            icon.setPosition(0, 32, 0);

            const txtLbl = createLabel('txt', btn, cfg.label, 29, '#ffffff', 180, 38);
            txtLbl.isBold = true;
            txtLbl.node.setPosition(0, -56, 0);

            const badge = this.makeSpriteNode('plus', btn, 'badge_count', 72, 72);
            badge.setPosition(94, 88, 0);
            const badgeSp = badge.getComponent(Sprite);
            if (badgeSp) this._skillBadgeSprites.set(cfg.type, badgeSp);
            const countLbl = createLabel('cnt', badge, '1', 30, '#ffffff', 68, 38);
            countLbl.isBold = true;
            countLbl.node.setPosition(0, 2, 0);
            this._skillBadgeLabels.set(cfg.type, countLbl);

            this.bindTap(btn, () => {
                AudioManager.ins.play(AudioClips.GAME_CLICK);
                this._actions?.onUseSkill(cfg.type);
            });
        }
    }

    // ==================== Faithful Clean Original Home Menu ====================

    private buildMenu(): void {
        this._menuNode = new Node('GbzMenuLayer');
        this._menuNode.setParent(this.node);
        const mUi = this._menuNode.addComponent(UITransform);
        mUi.setContentSize(750, 1334);
        const mW = this._menuNode.addComponent(Widget);
        mW.isAlignTop = mW.isAlignBottom = mW.isAlignLeft = mW.isAlignRight = true;
        mW.top = mW.bottom = mW.left = mW.right = 0;
        this._menuNode.addComponent(BlockInputEvents);

        const bg = this.makeSpriteNode('bg', this._menuNode, 'bg_menu_hex', 750, 1334);
        const bgSp = bg.getComponent(Sprite);
        const menuBgSf = ThemeManager.ins.getMenuBgSprite();
        if (bgSp && menuBgSf) bgSp.spriteFrame = menuBgSf;
        this._menuBgSprite = bgSp;
        const bgW = bg.addComponent(Widget);
        bgW.isAlignTop = bgW.isAlignBottom = bgW.isAlignLeft = bgW.isAlignRight = true;
        bgW.top = bgW.bottom = bgW.left = bgW.right = 0;

        // Top-left Settings gear (Sweet Candy style)
        const setBtn = this.makeSpriteFit('btn_setting', this._menuNode, 'UI_icon_setting', 82, 82);
        this._menuSetBtn = setBtn;
        const setW = setBtn.addComponent(Widget);
        setW.isAlignTop = true;
        setW.isAlignLeft = true;
        setW.top = 26;
        setW.left = 24;
        this.bindTap(setBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openSettings();
        });

        // Sweet Candy 3D Logo
        const logo = new Node('game_logo');
        logo.setParent(this._menuNode);
        logo.addComponent(UITransform).setContentSize(540, 216);
        const logoSp = logo.addComponent(Sprite);
        logoSp.sizeMode = Sprite.SizeMode.CUSTOM;
        this._menuLogoNode = logo;
        logo.setPosition(0, 492, 0);
        this.refreshMenuLogo();

        // Hero Centerpiece: Large 3D Oak Wooden Frame showing live Pixel Art progress
        const woodFrame = this.makeSpriteNode('wood_frame', this._menuNode, 'wood_frame', 524, 524);
        woodFrame.setPosition(0, 128, 0);

        this._pixelCanvasNode = new Node('pixel_canvas');
        this._pixelCanvasNode.setParent(woodFrame);
        this._pixelCanvasNode.setPosition(0, 0, 0);

        // Clean original yellow progress bar right below wooden frame (FILLED horizontal, hidden at 0%)
        const barTrack = this.makeSpriteNode('jdt_track', this._menuNode, 'UI_jdt_1', 490, 44);
        barTrack.setPosition(0, -174, 0);
        this._menuProgressFill = this.makeSpriteNode('jdt_fill', barTrack, 'UI_jdt_2', 490, 44);
        const fillSp = this._menuProgressFill.getComponent(Sprite);
        if (fillSp) {
            fillSp.type = Sprite.Type.FILLED;
            fillSp.fillType = Sprite.FillType.HORIZONTAL;
            fillSp.fillStart = 0;
            fillSp.fillRange = 0;
        }
        this._menuProgressFill.setPosition(0, 0, 0);
        this._menuProgressLbl = createLabel('jdt_lbl', barTrack, 'Completion: 0%', 24, '#ffffff', 380, 36);
        this._menuProgressLbl.isBold = true;

        // Bottom Row (matching original clean layout: My Artworks on left + big PLAY CTA center-right)
        const bottomRow = new Node('bottom_row');
        this._menuBottomRow = bottomRow;
        bottomRow.setParent(this._menuNode);
        const brUi = bottomRow.addComponent(UITransform);
        brUi.setContentSize(690, 146);
        const brW = bottomRow.addComponent(Widget);
        brW.isAlignBottom = true;
        brW.isAlignHorizontalCenter = true;
        brW.bottom = 96;

        // Left: My Artworks Gallery button
        const galBtn = this.makeSpriteNode('btn_gallery', bottomRow, 'icon_menu_gallery', 132, 124);
        galBtn.setPosition(-256, 4, 0);
        const galLbl = createLabel('g_lbl', galBtn, 'MY ART', 20, '#ffffff', 120, 26);
        galLbl.isBold = true;
        galLbl.node.setPosition(0, -40, 0);
        this.bindTap(galBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openGallery();
        });

        // Center-Right: Big glossy PLAY button
        const startBtn = this.makeSpriteNode('btn_start', bottomRow, 'btn_play', 420, 126);
        startBtn.setPosition(62, 0, 0);
        this._playBtnLbl = createLabel('start_lbl', startBtn, 'PLAY · LEVEL 1', 38, '#ffffff', 380, 56);
        this._playBtnLbl.isBold = true;
        this._playBtnLbl.node.setPosition(0, 6, 0);
        this.bindTap(startBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onStartGame(DataManager.ins.level);
        });
        tween(startBtn)
            .repeatForever(
                tween()
                    .to(0.85, { scale: new Vec3(1.03, 1.03, 1) }, { easing: 'sineInOut' })
                    .to(0.85, { scale: Vec3.ONE }, { easing: 'sineInOut' }),
            )
            .start();
    }

    /**
     * Render HD 28x28 3D-screw pixel artwork using exact original architecture:
     * 1. Clean warm-cream pegboard backdrop
     * 2. Dashed outer contour sprite (`art_<id>_outline`)
     * 3. Pre-rendered 3D-screw finish sprite (`art_<id>_finish`) with Sprite.Type.FILLED vertical reveal (60fps!)
     * Returns the finish Sprite so GbzPaintLayer can animate fillRange smoothly during shooting.
     */
    private drawHDArtInFrame(canvasNode: Node, art: PixelArtDef, filledCount: number, sizePx: number): Sprite | null {
        canvasNode.removeAllChildren();
        createPanel('peg_bg', canvasNode, sizePx, sizePx, '#f8f6f0', 255, 18);

        const artSize = Math.round(sizePx * 0.90);

        // 1. Dashed outer contour (xiankuang)
        const outlineSf = ResManager.ins.getPaintSprite(`art_${art.id}_outline`);
        if (outlineSf) {
            const oNode = new Node('outline');
            oNode.setParent(canvasNode);
            oNode.addComponent(UITransform).setContentSize(artSize, artSize);
            const oSp = oNode.addComponent(Sprite);
            oSp.sizeMode = Sprite.SizeMode.CUSTOM;
            oSp.spriteFrame = outlineSf;
        }

        // 2. Pre-rendered 28x28 3D-screw finish image with top-to-bottom FILLED vertical reveal!
        const finishSf = ResManager.ins.getPaintSprite(`art_${art.id}_finish`);
        if (!finishSf) return null;

        const fNode = new Node('finish');
        fNode.setParent(canvasNode);
        fNode.addComponent(UITransform).setContentSize(artSize, artSize);
        const fSp = fNode.addComponent(Sprite);
        fSp.sizeMode = Sprite.SizeMode.CUSTOM;
        fSp.spriteFrame = finishSf;
        fSp.type = Sprite.Type.FILLED;
        fSp.fillType = Sprite.FillType.VERTICAL;
        fSp.fillStart = 1;
        fSp.fillRange = -PixelGalleryService.getVerticalFillRatio(art, filledCount);
        return fSp;
    }

    private renderHomePixelArt(): void {
        if (!this._pixelCanvasNode) return;
        const art = PixelGalleryService.getActiveArt();
        const filled = PixelGalleryService.getFilledCount(art.id);
        const total = art.cells.length;
        const pct = Math.round((filled / Math.max(1, total)) * 100);

        this.drawHDArtInFrame(this._pixelCanvasNode, art, filled, 388);

        if (this._menuProgressLbl) {
            this._menuProgressLbl.string = `${art.title} · ${pct}%`;
        }
        if (this._menuProgressFill) {
            const ratio = Math.max(0, Math.min(1, filled / Math.max(1, total)));
            this._menuProgressFill.active = ratio > 0.001;
            const sp = this._menuProgressFill.getComponent(Sprite);
            if (sp) sp.fillRange = Math.max(0.06, ratio);
        }
    }

    // ==================== Step 1: Challenge Complete Popup (Original GbzWinLayer) ====================

    private buildWinPopup(): void {
        this._winNode = createPanel('GbzWinLayer', this.node, 750, 1334, '#000000', 175, 0, true);
        const card = this.makeSpriteNode('card', this._winNode, 'UI_db2', 580, 740);

        // Top strawberry-pink header ribbon ("LEVEL COMPLETE!")
        const ribbon = createPanel('ribbon', card, 380, 80, '#ec4899', 255, 26);
        ribbon.setPosition(0, 355, 0);
        const rLbl = createLabel('win_title', ribbon, 'LEVEL COMPLETE!', 36, '#ffffff', 360, 48);
        rLbl.isBold = true;

        // Center showcase panel with 3D bakery box overflowing with colorful gummy screws
        const boxStage = createPanel('box_stage', card, 480, 290, '#fff1f6', 255, 24);
        boxStage.setPosition(0, 130, 0);

        // 3-layer true 3D crate: back cavity -> colorful screws INSIDE box -> front flaps overlay!
        const crateBack = this.makeSpriteFit('win_crate_back', boxStage, 'xzx', 240, 202);
        crateBack.setPosition(0, -28, 0);

        const pile = new Node('win_pile');
        pile.setParent(boxStage);
        pile.setPosition(0, 6, 0);
        const pileSpecs: [number, number, number][] = [
            [-42, 22, 1], [-12, 28, 2], [18, 26, 3], [44, 18, 4],
            [-32, 4, 5], [0, 10, 6], [30, 6, 7],
            [-18, -10, 8], [14, -8, 10],
        ];
        for (const [px, py, cId] of pileSpecs) {
            const s = this.makeSpriteNode(`wp_${cId}`, pile, `gbz_screw${cId}`, 42, 42);
            const tSf = ThemeManager.ins.getScrewSprite(cId);
            const sSp = s.getComponent(Sprite);
            if (sSp && tSf) sSp.spriteFrame = tSf;
            s.setPosition(px, py, 0);
        }

        const crateFront = this.makeSpriteFit('win_crate_front', boxStage, 'xzx_front', 240, 202);
        crateFront.setPosition(0, -28, 0);

        // "Awesome! Collected N Screws!"
        this._winCountLbl = createLabel('win_cnt', card, 'Awesome! Collected 15 Screws!', 28, '#db2777', 500, 42);
        this._winCountLbl.isBold = true;
        this._winCountLbl.node.setPosition(0, -68, 0);

        // Full honey-gold 100% progress bar
        const gBar = createPanel('green_bar', card, 460, 48, '#f59e0b', 255, 20);
        gBar.setPosition(0, -142, 0);
        const gLbl = createLabel('g_lbl', gBar, '100%', 26, '#ffffff', 160, 34);
        gLbl.isBold = true;

        // Primary CTA: START CRAFTING (opens full-screen GbzPaintLayer!)
        createButton('btn_go_paint', card, 'START CRAFTING', 360, 88, '#ff7a1a', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._winNode) this._winNode.active = false;
            this.openPaintLayer();
        }, 32, '#ffffff', 34).setPosition(0, -256, 0);

        this._winNode.active = false;
    }

    // ==================== Step 2: Full-Screen Press-and-Hold Paint Layer (Original GbzPaintLayer) ====================

    private buildPaintLayer(): void {
        this._paintNode = new Node('GbzPaintLayer');
        this._paintNode.setParent(this.node);
        const pUi = this._paintNode.addComponent(UITransform);
        pUi.setContentSize(750, 1334);
        const pW = this._paintNode.addComponent(Widget);
        pW.isAlignTop = pW.isAlignBottom = pW.isAlignLeft = pW.isAlignRight = true;
        pW.top = pW.bottom = pW.left = pW.right = 0;
        this._paintNode.addComponent(BlockInputEvents);

        // Full-bleed theme-aware background
        const bg = this.makeSpriteNode('bg', this._paintNode, 'bg_menu_hex', 750, 1334);
        const bgSp = bg.getComponent(Sprite);
        const themeBg = ThemeManager.ins.getMenuBgSprite();
        if (bgSp && themeBg) bgSp.spriteFrame = themeBg;
        this._paintBgSprite = bgSp;
        const bgW = bg.addComponent(Widget);
        bgW.isAlignTop = bgW.isAlignBottom = bgW.isAlignLeft = bgW.isAlignRight = true;
        bgW.top = bgW.bottom = bgW.left = bgW.right = 0;

        // Upper-center: Large 3D Oak Wooden Frame (exact match to original!)
        const wf = this.makeSpriteNode('paint_wood_frame', this._paintNode, 'wood_frame', 524, 524);
        wf.setPosition(0, 260, 0);
        this._paintArtCanvas = new Node('paint_art_canvas');
        this._paintArtCanvas.setParent(wf);
        this._paintArtCanvas.setPosition(0, 0, 0);

        this._paintFlyLayer = new Node('paint_fly_layer');
        this._paintFlyLayer.setParent(wf);
        this._paintFlyLayer.setPosition(0, 0, 0);

        // Yellow Completion Progress Bar directly under wooden frame (FILLED horizontal, hidden at 0%)
        const barTrack = this.makeSpriteNode('paint_jdt_track', this._paintNode, 'UI_jdt_1', 490, 44);
        barTrack.setPosition(0, -40, 0);
        this._paintProgFill = this.makeSpriteNode('paint_jdt_fill', barTrack, 'UI_jdt_2', 490, 44);
        const pfSp = this._paintProgFill.getComponent(Sprite);
        if (pfSp) {
            pfSp.type = Sprite.Type.FILLED;
            pfSp.fillType = Sprite.FillType.HORIZONTAL;
            pfSp.fillStart = 0;
            pfSp.fillRange = 0;
        }
        this._paintProgFill.setPosition(0, 0, 0);
        this._paintProgLbl = createLabel('paint_jdt_lbl', barTrack, 'Completion: 0%', 24, '#ffffff', 380, 34);
        this._paintProgLbl.isBold = true;

        // Lower-center: 3-layer 3D Shipping Crate (back cavity -> screws INSIDE -> front flaps on top!)
        const crateRoot = new Node('crate_root');
        crateRoot.setParent(this._paintNode);
        crateRoot.setPosition(0, -252, 0);

        const crateSp = this.makeSpriteFit('paint_crate', crateRoot, 'xzx', 260, 220);
        crateSp.setPosition(0, -14, 0);

        this._paintBoxPile = new Node('crate_pile');
        this._paintBoxPile.setParent(crateRoot);
        this._paintBoxPile.setPosition(0, 24, 0);

        const crateFrontSp = this.makeSpriteFit('paint_crate_front', crateRoot, 'xzx_front', 260, 220);
        crateFrontSp.setPosition(0, -14, 0);

        // Hint text above shoot button ("Hold to shoot continuously")
        this._paintTipLbl = createLabel('tip_lbl', this._paintNode, 'Hold to shoot continuously', 24, '#e11d48', 420, 34);
        this._paintTipLbl.isBold = true;
        this._paintTipLbl.node.setPosition(0, -408, 0);

        // Bottom-left: MY ART Gallery button (matches original!)
        const galBtn = this.makeSpriteNode('paint_gallery', this._paintNode, 'icon_menu_gallery', 124, 116);
        const gW = galBtn.addComponent(Widget);
        gW.isAlignBottom = true;
        gW.isAlignLeft = true;
        gW.bottom = 128;
        gW.left = 34;
        const gLbl = createLabel('gl', galBtn, 'MY ART', 19, '#ffffff', 110, 24);
        gLbl.isBold = true;
        gLbl.node.setPosition(0, -38, 0);
        this.bindTap(galBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openGallery();
        });

        // Bottom-center: Press-and-Hold SHOOT SCREWS glossy 3D candy pill button!
        this._paintShotBtn = createButton('btn_shot', this._paintNode, 'SHOOT SCREWS', 360, 90, '#ec4899', () => {}, 30, '#ffffff', 45);
        const shW = this._paintShotBtn.addComponent(Widget);
        shW.isAlignBottom = true;
        shW.isAlignHorizontalCenter = true;
        shW.bottom = 110;
        this._paintShotLbl = this._paintShotBtn.getComponentInChildren(Label);
        this._paintShotBtn.off(Node.EventType.TOUCH_START);
        this._paintShotBtn.off(Node.EventType.TOUCH_END);
        this._paintShotBtn.off(Node.EventType.TOUCH_CANCEL);

        this._paintShotBtn.on(Node.EventType.TOUCH_START, () => {
            if (this._paintScrewsLeft <= 0) return;
            this._isShooting = true;
            this._paintShotBtn?.setScale(0.94, 0.94, 1);
            this.fireOnePaintScrew();
            this.unschedule(this.fireOnePaintScrew);
            // Rapid machine-gun ASMR cadence (~31 screws/sec) matching original high-density feel!
            this.schedule(this.fireOnePaintScrew, 0.032);
        });
        const stopShoot = () => {
            this._isShooting = false;
            this._paintShotBtn?.setScale(Vec3.ONE);
            this.unschedule(this.fireOnePaintScrew);
        };
        this._paintShotBtn.on(Node.EventType.TOUCH_END, stopShoot);
        this._paintShotBtn.on(Node.EventType.TOUCH_CANCEL, stopShoot);

        // Bottom-center: NEXT LEVEL button (replaces SHOOT button once crate is empty!)
        this._paintNextBtn = createButton('btn_next', this._paintNode, 'NEXT LEVEL', 350, 90, '#ff8c1a', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.stopPaintShooting();
            if (this._paintNode) this._paintNode.active = false;
            this._actions?.onNextLevel();
        }, 32, '#ffffff', 45);
        const nxW = this._paintNextBtn.addComponent(Widget);
        nxW.isAlignBottom = true;
        nxW.isAlignHorizontalCenter = true;
        nxW.bottom = 110;
        this._paintNextBtn.active = false;

        this._paintNode.active = false;
    }

    private stopPaintShooting(): void {
        this._isShooting = false;
        this.unschedule(this.fireOnePaintScrew);
    }

    private openPaintLayer(): void {
        if (!this._paintNode || !this._paintArtCanvas || !this._paintFlyLayer || !this._paintBoxPile) return;
        this.stopPaintShooting();
        this._paintFlyLayer.removeAllChildren();
        this._paintBoxPile.removeAllChildren();
        this._paintNode.active = true;

        // Pick active unfinished artwork
        const allArts = PixelGalleryService.getAllArts();
        let art = PixelGalleryService.getActiveArt();
        if (PixelGalleryService.isCompleted(art.id)) {
            const nextArt = allArts.find((a) => !PixelGalleryService.isCompleted(a.id));
            if (nextArt) {
                art = nextArt;
                PixelGalleryService.setActiveArt(art.id);
            }
        }
        this._paintArt = art;
        this._paintCurIndex = PixelGalleryService.getFilledCount(art.id);
        // Shoot real screws collected from this level (min ~110 so even Lv 1 advances ~33% of a 334-screw HD artwork!)
        this._paintScrewsLeft = Math.max(Math.ceil(art.cells.length / 3), Math.min(180, this._lastWonTotalScrews));

        // Populate visual cluster of colorful theme screws nestled INSIDE the diamond crate cavity!
        const visualPileCount = Math.min(26, this._paintScrewsLeft);
        for (let i = 0; i < visualPileCount; i++) {
            const cId = 1 + (i % 10);
            const s = this.makeSpriteNode(`pile_${i}`, this._paintBoxPile, `gbz_screw${cId}`, 38, 38);
            const tSf = ThemeManager.ins.getScrewSprite(cId);
            const sSp = s.getComponent(Sprite);
            if (sSp && tSf) sSp.spriteFrame = tSf;
            // Diamond-shaped distribution fitting inside the open box mouth (between back & front flaps)
            const u = (Math.random() - 0.5) * 2; // -1..1
            const v = (Math.random() - 0.5) * 2;
            const px = (u - v) * 44;
            const py = (u + v) * 18 + 6;
            s.setPosition(px, py, 0);
            s.angle = Math.random() * 360;
        }
        const pBg = ThemeManager.ins.getMenuBgSprite();
        if (this._paintBgSprite && pBg) this._paintBgSprite.spriteFrame = pBg;

        this._paintFinishSprite = this.drawHDArtInFrame(this._paintArtCanvas, art, this._paintCurIndex, 388);
        this.updatePaintUI();

        if (this._paintTipLbl) this._paintTipLbl.node.active = true;
        if (this._paintShotBtn) this._paintShotBtn.active = true;
        if (this._paintNextBtn) this._paintNextBtn.active = false;
    }

    private updatePaintUI(): void {
        if (!this._paintArt) return;
        const total = this._paintArt.cells.length;
        const ratio = Math.max(0, Math.min(1, this._paintCurIndex / Math.max(1, total)));
        const pct = Math.round(ratio * 100);
        if (this._paintProgLbl) this._paintProgLbl.string = `Completion: ${pct}%`;
        if (this._paintProgFill) {
            this._paintProgFill.active = ratio > 0.001;
            const sp = this._paintProgFill.getComponent(Sprite);
            if (sp) sp.fillRange = Math.max(0.06, ratio);
        }
        if (this._paintShotLbl) {
            this._paintShotLbl.string = `SHOOT SCREWS (${this._paintScrewsLeft})`;
        }
        if (this._paintFinishSprite) {
            this._paintFinishSprite.fillRange = -PixelGalleryService.getVerticalFillRatio(this._paintArt, this._paintCurIndex);
        }
    }

    /** Fires 1 screw out of the cardboard crate into the next 28x28 pixel cell (original GbzPaintLayer.shot) */
    private fireOnePaintScrew = (): void => {
        if (!this._paintArt || !this._paintArtCanvas || !this._paintFlyLayer) {
            this.stopPaintShooting();
            return;
        }
        if (this._paintScrewsLeft <= 0) {
            this.finishPaintShooting();
            return;
        }

        if (this._paintCurIndex >= this._paintArt.cells.length) {
            const nextArt = PixelGalleryService.getAllArts().find((a) => !PixelGalleryService.isCompleted(a.id));
            if (!nextArt) {
                this._paintScrewsLeft = 0;
                this.finishPaintShooting();
                return;
            }
            this._paintArt = nextArt;
            PixelGalleryService.setActiveArt(nextArt.id);
            this._paintCurIndex = PixelGalleryService.getFilledCount(nextArt.id);
            this._paintFinishSprite = this.drawHDArtInFrame(this._paintArtCanvas, nextArt, this._paintCurIndex, 388);
        }

        // Gradually empty visual screws from crate mouth as remaining count drops
        if (this._paintBoxPile && this._paintBoxPile.children.length > Math.ceil(this._paintScrewsLeft / 4)) {
            this._paintBoxPile.children[this._paintBoxPile.children.length - 1].destroy();
        }

        const art = this._paintArt;
        const idx = this._paintCurIndex;
        const [col, row, colorId] = art.cells[idx];
        const artSize = Math.round(388 * 0.90);
        const cellStep = artSize / art.gridSize;
        const half = artSize / 2;
        const tx = -half + (col + 0.5) * cellStep;
        const ty = half - (row + 0.5) * cellStep;

        // Shoot miniature 3D gummy screw from bakery box mouth into (tx, ty)
        const fly = this.makeSpriteNode(`shot_${idx}`, this._paintFlyLayer, `gbz_screw${colorId}`, 38, 38);
        const flySf = ThemeManager.ins.getScrewSprite(colorId);
        const flySp = fly.getComponent(Sprite);
        if (flySp && flySf) flySp.spriteFrame = flySf;
        fly.setPosition((Math.random() - 0.5) * 120, -455, 0);
        fly.angle = Math.random() * 360;

        if (idx % 2 === 0) AudioManager.ins.play(AudioClips.SCREW_OUT, 0.7);

        tween(fly)
            .to(0.18, {
                position: new Vec3(tx, ty, 0),
                scale: new Vec3(cellStep / 38, cellStep / 38, 1),
                angle: 0,
            }, { easing: 'quadOut' })
            .call(() => {
                if (fly.isValid) fly.destroy();
            })
            .start();

        this._paintCurIndex += 1;
        this._paintScrewsLeft -= 1;
        DataManager.ins.gallery.filledCounts[art.id] = this._paintCurIndex;

        if (this._paintCurIndex >= art.cells.length && !DataManager.ins.gallery.claimedRewards.includes(art.id)) {
            DataManager.ins.gallery.claimedRewards.push(art.id);
            DataManager.ins.skillCounts.slot += 1;
            DataManager.ins.skillCounts.clear += 1;
            DataManager.ins.skillCounts.melt += 1;
            AudioManager.ins.play(AudioClips.BOX_FULL);
            this.showToast(`${art.title} Complete! Saved to My Art!`);
        }

        DataManager.ins.save();
        this.updatePaintUI();

        if (this._paintScrewsLeft <= 0) {
            this.finishPaintShooting();
        }
    };

    private finishPaintShooting(): void {
        this.stopPaintShooting();
        if (this._paintBoxPile) this._paintBoxPile.removeAllChildren();
        if (this._paintTipLbl) this._paintTipLbl.node.active = false;
        if (this._paintShotBtn) this._paintShotBtn.active = false;
        if (this._paintNextBtn) {
            this._paintNextBtn.active = true;
            this._paintNextBtn.setScale(Vec3.ZERO);
            tween(this._paintNextBtn).to(0.24, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        }
    }

    // ==================== Pause / Lose / Settings / Gallery ====================

    private buildPausePopup(): void {
        this._pauseNode = createPanel('GbzExitLayer', this.node, 750, 1334, '#3b0a24', 155, 0, true);
        const card = this.makeSpriteNode('panel', this._pauseNode, 'UI_db2', 540, 640);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(230, 274, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
        });

        const pauseTitle = createLabel('title', card, 'PAUSED', 42, '#701a45', 280, 52);
        pauseTitle.isBold = true;
        pauseTitle.node.setPosition(0, 236, 0);
        this._pauseLevelLbl = createLabel('lv_sub', card, 'LEVEL 1', 22, '#be185d', 240, 30);
        this._pauseLevelLbl.isBold = true;
        this._pauseLevelLbl.node.setPosition(0, 194, 0);

        // Quick inline Sound & Haptics toggle row (players can mute mid-level without quitting!)
        const pSound = createButton('p_sound', card, 'SFX: ON', 180, 56, '#ec4899', () => {
            DataManager.ins.soundEnabled = !DataManager.ins.soundEnabled;
            DataManager.ins.save();
            this.refreshSettingsLabels();
            if (DataManager.ins.soundEnabled) AudioManager.ins.play(AudioClips.GAME_CLICK);
        }, 22, '#ffffff', 22);
        pSound.setPosition(-98, 128, 0);
        this._pauseSoundNode = pSound;
        this._pauseSoundLbl = pSound.getComponentInChildren(Label);

        const pVibe = createButton('p_vibe', card, 'HAPTIC: ON', 180, 56, '#14b8a6', () => {
            DataManager.ins.vibrateEnabled = !DataManager.ins.vibrateEnabled;
            DataManager.ins.save();
            this.refreshSettingsLabels();
            if (DataManager.ins.vibrateEnabled) MonetizationManager.ins.triggerHaptic('medium');
        }, 21, '#ffffff', 22);
        pVibe.setPosition(98, 128, 0);
        this._pauseVibeNode = pVibe;
        this._pauseVibeLbl = pVibe.getComponentInChildren(Label);

        createButton('btn_continue', card, 'RESUME', 360, 78, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
        }, 30, '#ffffff', 28).setPosition(0, 30, 0);

        createButton('btn_restart', card, 'RESTART', 360, 78, '#ff8c1a', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
            this._actions?.onRestart();
        }, 30, '#ffffff', 28).setPosition(0, -72, 0);

        createButton('btn_home', card, 'HOME', 360, 78, '#ec4899', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
            this._actions?.onBackMenu();
        }, 30, '#ffffff', 28).setPosition(0, -174, 0);

        this._pauseNode.active = false;
    }

    private buildLosePopup(): void {
        this._loseNode = createPanel('GbzLoseFullLayer', this.node, 750, 1334, '#3b0a24', 165, 0, true);
        const card = this.makeSpriteNode('card', this._loseNode, 'UI_db2', 560, 520);

        const loseTitle = createLabel('lose_title', card, 'TRAY FULL!', 46, '#e11d48', 440, 58);
        loseTitle.isBold = true;
        loseTitle.node.setPosition(0, 170, 0);
        createLabel('lose_sub', card, 'Watch a short ad to clear the tray & continue!', 22, '#831843', 480, 44).node.setPosition(0, 96, 0);

        createButton('btn_revive_ad', card, 'FREE REVIVE (AD)', 400, 90, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            MonetizationManager.ins.showRewardedAd('revive', () => {
                if (this._loseNode) this._loseNode.active = false;
                this._actions?.onRevive();
            });
        }, 30, '#ffffff', 30).setPosition(0, -24, 0);

        createButton('btn_retry', card, 'TRY AGAIN', 320, 68, '#ff8c1a', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._loseNode) this._loseNode.active = false;
            this._actions?.onRestart();
        }, 26, '#ffffff', 26).setPosition(0, -138, 0);

        this._loseNode.active = false;
    }

    private buildSettingsPopup(): void {
        this._settingsNode = createPanel('GbzSettingLayer', this.node, 750, 1334, '#3b0a24', 155, 0, true);
        const card = this.makeSpriteNode('panel', this._settingsNode, 'UI_db2', 540, 560);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(226, 236, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._settingsNode) this._settingsNode.active = false;
        });

        const setTitle = createLabel('title', card, 'SETTINGS', 40, '#701a45', 300, 52);
        setTitle.isBold = true;
        setTitle.node.setPosition(0, 206, 0);

        const soundBtn = createButton('btn_sound', card, 'SOUND FX: ON', 380, 74, '#ec4899', () => {
            DataManager.ins.soundEnabled = !DataManager.ins.soundEnabled;
            DataManager.ins.save();
            this.refreshSettingsLabels();
            if (DataManager.ins.soundEnabled) AudioManager.ins.play(AudioClips.GAME_CLICK);
        }, 26, '#ffffff', 26);
        soundBtn.setPosition(0, 96, 0);
        this._soundBtnNode = soundBtn;
        this._soundBtnLbl = soundBtn.getComponentInChildren(Label);

        const vibeBtn = createButton('btn_vibe', card, 'HAPTICS: ON', 380, 74, '#14b8a6', () => {
            DataManager.ins.vibrateEnabled = !DataManager.ins.vibrateEnabled;
            DataManager.ins.save();
            this.refreshSettingsLabels();
            if (DataManager.ins.vibrateEnabled) MonetizationManager.ins.triggerHaptic('medium');
        }, 26, '#ffffff', 26);
        vibeBtn.setPosition(0, 0, 0);
        this._vibeBtnNode = vibeBtn;
        this._vibeBtnLbl = vibeBtn.getComponentInChildren(Label);

        createButton('btn_privacy', card, 'AD PRIVACY & POLICY', 380, 68, '#a855f7', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            MonetizationManager.ins.showPrivacyOptions();
        }, 23, '#ffffff', 24).setPosition(0, -96, 0);

        createLabel(
            'ver_lbl',
            card,
            `Screw Out: Sweet Candy Jam  v${MonetizationManager.APP_VERSION}`,
            20,
            '#9d5c78',
            440,
            30,
        ).node.setPosition(0, -196, 0);

        this._settingsNode.active = false;
    }

    private buildGalleryModal(): void {
        this._galleryNode = createPanel('XiangCeLayer', this.node, 750, 1334, '#3b0a24', 165, 0, true);
        const card = this.makeSpriteNode('panel', this._galleryNode, 'UI_db2', 660, 960);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(288, 434, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._galleryNode) this._galleryNode.active = false;
        });

        const galTitle = createLabel('title', card, 'MY ARTWORKS', 38, '#701a45', 420, 48);
        galTitle.isBold = true;
        galTitle.node.setPosition(0, 416, 0);
        this._galleryCountLbl = createLabel('sub', card, 'Collected: 0 / 6', 24, '#db2777', 420, 34);
        this._galleryCountLbl.isBold = true;
        this._galleryCountLbl.node.setPosition(0, 366, 0);

        this._galleryListRoot = new Node('gallery_grid');
        this._galleryListRoot.setParent(card);
        this._galleryListRoot.setPosition(0, -24, 0);

        this._galleryNode.active = false;
    }

    /**
     * Mirrors original GbzPaintListLayer + GbzPaintListItem:
     * - Strictly sequential collection (index 0..N-1)
     * - idx < curIndex: Completed (full 3D screw art, no progress bar)
     * - idx === curIndex: In Progress (partial 3D screw art + yellow progress bar)
     * - idx > curIndex: Locked Mystery "?" (hidden until previous artwork is completed!)
     */
    private refreshGalleryModal(): void {
        if (!this._galleryListRoot) return;
        this._galleryListRoot.removeAllChildren();

        const allArts = PixelGalleryService.getAllArts();
        let curIndex = allArts.findIndex((a) => !PixelGalleryService.isCompleted(a.id));
        const completedCount = curIndex === -1 ? allArts.length : curIndex;
        if (curIndex === -1) curIndex = allArts.length;

        if (this._galleryCountLbl) {
            this._galleryCountLbl.string = `Collected: ${completedCount} / ${allArts.length}`;
        }

        // Clean 3x4 grid showcasing all 12 HD artworks (Completed / In-Progress + Bar / Locked ?)
        allArts.forEach((art, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const x = (col - 1) * 196;
            const y = 276 - row * 192;

            const filled = PixelGalleryService.getFilledCount(art.id);
            const total = art.cells.length;
            const pct = Math.round((filled / Math.max(1, total)) * 100);

            if (idx < curIndex) {
                // State 1: COMPLETED — crisp pre-rendered HD 28x28 3D-screw artwork
                const tile = createPanel(`art_${art.id}`, this._galleryListRoot!, 182, 178, '#fef9c3', 255, 18);
                tile.setPosition(x, y, 0);
                const wf = this.makeSpriteNode('wf', tile, 'wood_frame', 124, 124);
                wf.setPosition(0, 16, 0);
                const cNode = new Node('c');
                cNode.setParent(wf);
                this.drawHDArtInFrame(cNode, art, total, 94);
                const tLbl = createLabel('t', tile, art.title, 16, '#0f172a', 170, 22);
                tLbl.isBold = true;
                tLbl.node.setPosition(0, -64, 0);
            } else if (idx === curIndex) {
                // State 2: IN PROGRESS — HD outline + FILLED vertical reveal + candy progress bar
                const tile = createPanel(`art_${art.id}`, this._galleryListRoot!, 182, 178, '#fce7f3', 255, 18);
                tile.setPosition(x, y, 0);
                const wf = this.makeSpriteNode('wf', tile, 'wood_frame', 116, 116);
                wf.setPosition(0, 22, 0);
                const cNode = new Node('c');
                cNode.setParent(wf);
                this.drawHDArtInFrame(cNode, art, filled, 88);

                const barTrack = this.makeSpriteNode('p_track', tile, 'UI_jdt_1', 152, 22);
                barTrack.setPosition(0, -58, 0);
                const barFill = this.makeSpriteNode('p_fill', barTrack, 'UI_jdt_2', 152, 22);
                const bfSp = barFill.getComponent(Sprite);
                const ratio = Math.max(0, Math.min(1, filled / Math.max(1, total)));
                barFill.active = ratio > 0.001;
                if (bfSp) {
                    bfSp.type = Sprite.Type.FILLED;
                    bfSp.fillType = Sprite.FillType.HORIZONTAL;
                    bfSp.fillStart = 0;
                    bfSp.fillRange = Math.max(0.08, ratio);
                }
                const pLbl = createLabel('p_lbl', barTrack, `${pct}%`, 15, '#ffffff', 120, 20);
                pLbl.isBold = true;
            } else {
                // State 3: LOCKED MYSTERY "?"
                const tile = createPanel(`art_${art.id}`, this._galleryListRoot!, 182, 178, '#f5e6ee', 255, 18);
                tile.setPosition(x, y, 0);
                const qCircle = createPanel('q_bg', tile, 82, 82, '#e2a8c4', 255, 41);
                qCircle.setPosition(0, 14, 0);
                const qLbl = createLabel('q_txt', qCircle, '?', 48, '#ffffff', 72, 60);
                qLbl.isBold = true;
                createLabel('lock_lbl', tile, 'LOCKED', 16, '#9d5c78', 140, 22).node.setPosition(0, -58, 0);
                this.bindTap(tile, () => {
                    AudioManager.ins.play(AudioClips.CLICK_ERROR);
                    this.showToast('Complete current artwork to unlock!');
                });
            }
        });
    }

    // ==================== Toast ====================

    private buildToast(): void {
        this._toastNode = createPanel('Toast', this.node, 480, 62, '#701a45', 240, 31);
        this._toastNode.setPosition(0, 140, 0);
        this._toastOp = this._toastNode.addComponent(UIOpacity);
        this._toastOp.opacity = 0;
        this._toastLabel = createLabel('ToastLbl', this._toastNode, '', 22, '#ffffff', 450, 44);
        this._toastNode.active = false;
    }

    // ==================== Public UI Controls ====================

    public showMenu(): void {
        this.hidePopups();
        if (this._hudNode) this._hudNode.active = false;
        if (this._menuNode) this._menuNode.active = true;
        this.refreshHeader();
    }

    public showGameHUD(levelNumber = DataManager.ins.level): void {
        this.hidePopups();
        if (this._menuNode) this._menuNode.active = false;
        if (this._hudNode) this._hudNode.active = true;
        this.setSmashMode(false);
        if (this._levelLabel) this._levelLabel.string = `LEVEL ${levelNumber}`;
        this.refreshHeader();
        this.setProgress(0);
    }

    public showWin(totalScrews = 15): void {
        this.hidePopups();
        this._lastWonTotalScrews = totalScrews;
        if (this._winCountLbl) {
            this._winCountLbl.string = `Awesome! Collected ${totalScrews} Screws!`;
        }
        if (this._winNode) this._winNode.active = true;
    }

    public showLose(): void {
        this.hidePopups();
        if (this._loseNode) this._loseNode.active = true;
    }

    public openSettings(): void {
        this.refreshSettingsLabels();
        if (this._settingsNode) this._settingsNode.active = true;
    }

    public openPause(): void {
        if (this._pauseLevelLbl) {
            this._pauseLevelLbl.string = `LEVEL ${DataManager.ins.level}`;
        }
        this.refreshSettingsLabels();
        if (this._pauseNode) this._pauseNode.active = true;
    }

    public openGallery(): void {
        this.refreshGalleryModal();
        if (this._galleryNode) this._galleryNode.active = true;
    }

    private refreshMenuLogo(): void {
        if (!this._menuLogoNode) return;
        const sp = this._menuLogoNode.getComponent(Sprite);
        const ui = this._menuLogoNode.getComponent(UITransform);
        const sf = ThemeManager.ins.getLogoSprite();
        if (sp && sf) {
            sp.spriteFrame = sf;
            if (ui && sf.originalSize.width > 0 && sf.originalSize.height > 0) {
                const maxW = 540;
                const maxH = 216;
                const sc = Math.min(maxW / sf.originalSize.width, maxH / sf.originalSize.height);
                ui.setContentSize(Math.round(sf.originalSize.width * sc), Math.round(sf.originalSize.height * sc));
            }
        }
    }

    public applySafeArea(topInset: number, bottomInset: number): void {
        const top = Math.max(0, Math.min(72, Math.round(topInset)));
        const bot = Math.max(0, Math.min(54, Math.round(bottomInset)));

        const bumpTop = (node: Node | null, base: number) => {
            const w = node?.getComponent(Widget);
            if (w) {
                w.top = base + top;
                w.updateAlignment();
            }
        };
        const bumpBot = (node: Node | null, base: number) => {
            const w = node?.getComponent(Widget);
            if (w) {
                w.bottom = base + bot;
                w.updateAlignment();
            }
        };

        bumpTop(this._pauseBtnNode, 22);
        bumpTop(this._lvPillNode, 28);
        bumpTop(this._boxProgNode, 365);
        bumpTop(this._menuSetBtn, 26);
        bumpBot(this._skillBarNode, 26);
        bumpBot(this._menuBottomRow, 96);
    }

    public hidePopups(): void {
        this.stopPaintShooting();
        if (this._pauseNode) this._pauseNode.active = false;
        if (this._winNode) this._winNode.active = false;
        if (this._paintNode) this._paintNode.active = false;
        if (this._loseNode) this._loseNode.active = false;
        if (this._settingsNode) this._settingsNode.active = false;
        if (this._galleryNode) this._galleryNode.active = false;
    }

    public setSmashMode(active: boolean): void {
        if (this._smashBanner) this._smashBanner.active = active;
    }

    public refreshHeader(): void {
        const dm = DataManager.ins;
        if (this._playBtnLbl) this._playBtnLbl.string = `PLAY · LEVEL ${dm.level}`;

        // Bottom skill count / AD badges
        const types: SkillType[] = [SkillType.UNLOCK_SLOT, SkillType.CLEAR_TRAY, SkillType.SMASH_BOARD];
        for (const t of types) {
            const lbl = this._skillBadgeLabels.get(t);
            const sp = this._skillBadgeSprites.get(t);
            if (!lbl) continue;
            const cnt = dm.getSkillCount(t);
            lbl.string = cnt > 0 ? String(cnt) : 'AD';
            if (sp) {
                const sf = ResManager.ins.getUiSprite(cnt > 0 ? 'badge_count' : 'badge_ad');
                if (sf) sp.spriteFrame = sf;
                const ui = sp.node.getComponent(UITransform);
                if (ui) ui.setContentSize(cnt > 0 ? 72 : 88, cnt > 0 ? 72 : 62);
            }
        }

        this.renderHomePixelArt();
    }

    public setProgress(ratio: number): void {
        const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
        if (this._progressLabel) this._progressLabel.string = `${pct}%`;
    }

    public showToast(msg: string): void {
        if (!this._toastNode || !this._toastLabel || !this._toastOp) return;
        this._toastLabel.string = msg;
        this._toastNode.active = true;
        this._toastOp.opacity = 255;
        tween(this._toastOp)
            .stop()
            .delay(1.2)
            .to(0.35, { opacity: 0 })
            .call(() => {
                if (this._toastNode) this._toastNode.active = false;
            })
            .start();
    }

    private refreshSettingsLabels(): void {
        const on = DataManager.ins.soundEnabled;
        if (this._soundBtnLbl) {
            this._soundBtnLbl.string = `SOUND FX: ${on ? 'ON' : 'OFF'}`;
        }
        setPanelColor(this._soundBtnNode, on ? '#ec4899' : '#c09bb0');

        const vibeOn = DataManager.ins.vibrateEnabled;
        if (this._vibeBtnLbl) {
            this._vibeBtnLbl.string = `HAPTICS: ${vibeOn ? 'ON' : 'OFF'}`;
        }
        setPanelColor(this._vibeBtnNode, vibeOn ? '#14b8a6' : '#c09bb0');

        if (this._pauseSoundLbl) this._pauseSoundLbl.string = `SFX: ${on ? 'ON' : 'OFF'}`;
        setPanelColor(this._pauseSoundNode, on ? '#ec4899' : '#c09bb0');

        if (this._pauseVibeLbl) this._pauseVibeLbl.string = `HAPTIC: ${vibeOn ? 'ON' : 'OFF'}`;
        setPanelColor(this._pauseVibeNode, vibeOn ? '#14b8a6' : '#c09bb0');
    }
}
