import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    Graphics,
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
import { PIXEL_GALLERY, PixelArtDef, PixelGalleryService } from '../meta/PixelGalleryData';
import { createButton, createLabel, createPanel } from './UIHelper';

const { ccclass } = _decorator;

export interface UIActions {
    onStartGame: (level: number) => void;
    onRestart: () => void;
    onBackMenu: () => void;
    onNextLevel: () => void;
    onRevive: () => void;
    onUseSkill: (skill: SkillType) => void;
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
    private _pixelCanvasNode: Node | null = null;
    private _menuProgressFill: Node | null = null;
    private _menuProgressLbl: Label | null = null;
    private _playBtnLbl: Label | null = null;

    // Popups
    private _pauseNode: Node | null = null;
    private _winNode: Node | null = null;
    private _winCountLbl: Label | null = null;

    // Full-screen Paint Layer (matches original GbzPaintLayer)
    private _paintNode: Node | null = null;
    private _paintArtCanvas: Node | null = null;
    private _paintFlyLayer: Node | null = null;
    private _paintBoxPile: Node | null = null;
    private _paintProgFill: Node | null = null;
    private _paintProgLbl: Label | null = null;
    private _paintTipLbl: Label | null = null;
    private _paintShotBtn: Node | null = null;
    private _paintShotLbl: Label | null = null;
    private _paintNextBtn: Node | null = null;
    private _paintScrewsLeft = 0;
    private _paintArt: PixelArtDef | null = null;
    private _paintCurIndex = 0;
    private _isShooting = false;

    private _loseNode: Node | null = null;
    private _settingsNode: Node | null = null;
    private _soundBtnLbl: Label | null = null;
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
        const pW = pauseBtn.addComponent(Widget);
        pW.isAlignTop = true;
        pW.isAlignLeft = true;
        pW.top = 22;
        pW.left = 20;
        this.bindTap(pauseBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = true;
        });

        // Top-center capsule "LEVEL N"
        const lvPill = this.makeSpriteFit('lv_pill', this._hudNode, '倒计时关数框', 240, 46);
        const lW = lvPill.addComponent(Widget);
        lW.isAlignTop = true;
        lW.isAlignHorizontalCenter = true;
        lW.top = 34;
        this._levelLabel = createLabel('lv_label', lvPill, 'LEVEL 1', 25, '#ffffff', 220, 38);

        // Right-side 3D shipping crate progress
        const boxProg = new Node('c_item');
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
        this._progressLabel = createLabel('prog_lbl', boxProg, '0%', 24, '#0f172a', 120, 34);
        this._progressLabel.node.setPosition(0, -34, 0);

        // Smash-board active banner
        this._smashBanner = createPanel('SmashBanner', this._hudNode, 440, 52, '#ef4444', 240, 26);
        this._smashBanner.setPosition(0, 232, 0);
        createLabel('SmashTxt', this._smashBanner, 'Tap any board to melt it!', 24, '#ffffff', 420, 40);
        this._smashBanner.active = false;

        // Bottom 3 pearl-ivory 3D ceramic skill buttons (+1 SLOT / CLEAR / MELT)
        const skillBar = new Node('skills');
        skillBar.setParent(this._hudNode);
        const sbUi = skillBar.addComponent(UITransform);
        sbUi.setContentSize(1083, 207);
        skillBar.setScale(0.58, 0.58, 1);
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
            { name: 'btn_skill_core', type: SkillType.UNLOCK_SLOT, label: '+1 SLOT', iconSprite: 'icon_skill_slot', iconScale: 0.96, x: -401 },
            { name: 'btn_skill_screw', type: SkillType.CLEAR_TRAY, label: 'CLEAR', iconSprite: 'UI_icon3', iconScale: 0.95, x: 0 },
            { name: 'btn_skill_board', type: SkillType.SMASH_BOARD, label: 'MELT', iconSprite: 'UI_icon2', iconScale: 0.95, x: 401 },
        ];

        for (const cfg of skillConfigs) {
            const btn = this.makeSpriteNode(cfg.name, skillBar, 'skill_btn_bg', 281, 207);
            btn.setPosition(cfg.x, 0, 0);

            const icon = this.makeSpriteFit('icon', btn, cfg.iconSprite, 106, 106);
            icon.setScale(cfg.iconScale, cfg.iconScale, 1);
            icon.setPosition(0, 30, 0);

            const txtLbl = createLabel('txt', btn, cfg.label, 31, '#ffffff', 220, 42);
            txtLbl.isBold = true;
            txtLbl.node.setPosition(0, -48, 0);

            const badge = this.makeSpriteNode('plus', btn, 'badge_count', 76, 76);
            badge.setPosition(116, 84, 0);
            const badgeSp = badge.getComponent(Sprite);
            if (badgeSp) this._skillBadgeSprites.set(cfg.type, badgeSp);
            const countLbl = createLabel('cnt', badge, '1', 32, '#ffffff', 72, 42);
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
        const bgW = bg.addComponent(Widget);
        bgW.isAlignTop = bgW.isAlignBottom = bgW.isAlignLeft = bgW.isAlignRight = true;
        bgW.top = bgW.bottom = bgW.left = bgW.right = 0;

        // Top-left Settings gear (just like original!)
        const setBtn = this.makeSpriteFit('btn_setting', this._menuNode, 'UI_icon_setting', 82, 82);
        const setW = setBtn.addComponent(Widget);
        setW.isAlignTop = true;
        setW.isAlignLeft = true;
        setW.top = 26;
        setW.left = 24;
        this.bindTap(setBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openSettings();
        });

        // 3D Logo
        const logo = this.makeSpriteFit('game_logo', this._menuNode, 'logo_screw_jam', 460, 108);
        logo.setPosition(0, 476, 0);

        // Hero Centerpiece: Large 3D Oak Wooden Frame showing live Pixel Art progress
        const woodFrame = this.makeSpriteNode('wood_frame', this._menuNode, 'wood_frame', 524, 524);
        woodFrame.setPosition(0, 140, 0);

        this._pixelCanvasNode = new Node('pixel_canvas');
        this._pixelCanvasNode.setParent(woodFrame);
        this._pixelCanvasNode.setPosition(0, 0, 0);

        // Clean original yellow progress bar right below wooden frame ("Completion: 33%")
        const barTrack = this.makeSpriteNode('jdt_track', this._menuNode, 'UI_jdt_1', 490, 44);
        barTrack.setPosition(0, -162, 0);
        this._menuProgressFill = this.makeSpriteNode('jdt_fill', barTrack, 'UI_jdt_2', 490, 44);
        this._menuProgressFill.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
        this._menuProgressFill.setPosition(-245, 0, 0);
        this._menuProgressLbl = createLabel('jdt_lbl', barTrack, 'Completion: 0%', 24, '#ffffff', 380, 36);
        this._menuProgressLbl.isBold = true;

        // Bottom Row (matching original clean layout: My Artworks on left + big PLAY CTA center-right)
        const bottomRow = new Node('bottom_row');
        bottomRow.setParent(this._menuNode);
        const brUi = bottomRow.addComponent(UITransform);
        brUi.setContentSize(690, 146);
        const brW = bottomRow.addComponent(Widget);
        brW.isAlignBottom = true;
        brW.isAlignHorizontalCenter = true;
        brW.bottom = 96;

        // Left: My Artworks Gallery button (original 我的作品)
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
        const startBtn = this.makeSpriteNode('btn_start', bottomRow, '按键1', 420, 126);
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

    /** Render a pixel art mosaic into any canvas node at given cellStep & screwSize */
    private drawPixelArtStatic(canvasNode: Node, art: PixelArtDef, filledCount: number, cellStep: number, screwSize: number): void {
        canvasNode.removeAllChildren();
        const half = ((art.gridSize - 1) * cellStep) / 2;
        const pad = Math.round(half + cellStep * 0.85);
        const bgG = canvasNode.getComponent(Graphics) || canvasNode.addComponent(Graphics);
        bgG.clear();
        bgG.fillColor = new Color(241, 245, 249, 255);
        bgG.roundRect(-pad, -pad, pad * 2, pad * 2, 20);
        bgG.fill();

        const holeSf = ResManager.ins.getGameSprite('hole');
        for (let i = 0; i < art.cells.length; i++) {
            const cell = art.cells[i];
            const x = cell.col * cellStep - half;
            const y = half - cell.row * cellStep;
            if (i < filledCount) {
                const s = this.makeSpriteNode(`px_${i}`, canvasNode, `gbz_screw${cell.colorId}`, screwSize, screwSize);
                s.setPosition(x, y, 0);
            } else {
                const h = new Node(`empty_${i}`);
                h.setParent(canvasNode);
                h.setPosition(x, y, 0);
                const ui = h.addComponent(UITransform);
                ui.setContentSize(Math.round(screwSize * 0.65), Math.round(screwSize * 0.65));
                const sp = h.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                if (holeSf) sp.spriteFrame = holeSf;
                const op = h.addComponent(UIOpacity);
                op.opacity = 110;
            }
        }
    }

    private renderHomePixelArt(): void {
        if (!this._pixelCanvasNode) return;
        const art = PixelGalleryService.getActiveArt();
        const filled = PixelGalleryService.getFilledCount(art.id);
        const total = art.cells.length;
        const pct = Math.round((filled / Math.max(1, total)) * 100);

        this.drawPixelArtStatic(this._pixelCanvasNode, art, filled, 40, 37);

        if (this._menuProgressLbl) {
            this._menuProgressLbl.string = `${art.title} · ${pct}%`;
        }
        if (this._menuProgressFill) {
            const ratio = Math.max(0.05, Math.min(1, filled / Math.max(1, total)));
            this._menuProgressFill.setScale(ratio, 1, 1);
        }
    }

    // ==================== Step 1: Challenge Complete Popup (Original GbzWinLayer) ====================

    private buildWinPopup(): void {
        this._winNode = createPanel('GbzWinLayer', this.node, 750, 1334, '#000000', 175, 0, true);
        const card = this.makeSpriteNode('card', this._winNode, 'UI_db2', 580, 740);

        // Top royal-blue header ribbon ("LEVEL COMPLETE!")
        const ribbon = createPanel('ribbon', card, 380, 80, '#1d4ed8', 255, 22);
        ribbon.setPosition(0, 355, 0);
        const rLbl = createLabel('win_title', ribbon, 'LEVEL COMPLETE!', 36, '#ffffff', 360, 48);
        rLbl.isBold = true;

        // Center showcase panel with 3D crate overflowing with colorful 3D screws
        const boxStage = createPanel('box_stage', card, 480, 290, '#eff6ff', 255, 24);
        boxStage.setPosition(0, 130, 0);

        // Pile of colorful 3D screws peeking out of the top of the shipping crate
        const pile = new Node('win_pile');
        pile.setParent(boxStage);
        pile.setPosition(0, 18, 0);
        const pileSpecs: [number, number, number][] = [
            [-62, 34, 1], [-24, 48, 2], [18, 52, 3], [56, 36, 4],
            [-48, 14, 5], [-8, 24, 6], [34, 22, 7], [68, 12, 8],
            [-30, -4, 9], [12, 4, 10], [46, -2, 2],
        ];
        for (const [px, py, cId] of pileSpecs) {
            const s = this.makeSpriteNode(`wp_${cId}`, pile, `gbz_screw${cId}`, 44, 44);
            s.setPosition(px, py, 0);
        }
        const crate = this.makeSpriteFit('win_crate', boxStage, 'xzx', 240, 196);
        crate.setPosition(0, -34, 0);

        // "Awesome! Collected N Screws!"
        this._winCountLbl = createLabel('win_cnt', card, 'Awesome! Collected 15 Screws!', 28, '#0284c7', 500, 42);
        this._winCountLbl.isBold = true;
        this._winCountLbl.node.setPosition(0, -68, 0);

        // Full green 100% progress bar
        const gBar = createPanel('green_bar', card, 460, 48, '#65a30d', 255, 16);
        gBar.setPosition(0, -142, 0);
        const gLbl = createLabel('g_lbl', gBar, '100%', 26, '#ffffff', 160, 34);
        gLbl.isBold = true;

        // Primary CTA: START CRAFTING (opens full-screen GbzPaintLayer!)
        createButton('btn_go_paint', card, 'START CRAFTING', 360, 88, '#f97316', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._winNode) this._winNode.active = false;
            this.openPaintLayer();
        }, 32, '#ffffff', 30).setPosition(0, -256, 0);

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

        // Full-bleed sky background matching original GbzPaintLayer
        const bg = this.makeSpriteNode('bg', this._paintNode, 'bg_menu_hex', 750, 1334);
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

        // Yellow Completion Progress Bar directly under wooden frame
        const barTrack = this.makeSpriteNode('paint_jdt_track', this._paintNode, 'UI_jdt_1', 490, 44);
        barTrack.setPosition(0, -40, 0);
        this._paintProgFill = this.makeSpriteNode('paint_jdt_fill', barTrack, 'UI_jdt_2', 490, 44);
        this._paintProgFill.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
        this._paintProgFill.setPosition(-245, 0, 0);
        this._paintProgLbl = createLabel('paint_jdt_lbl', barTrack, 'Completion: 0%', 24, '#ffffff', 380, 34);
        this._paintProgLbl.isBold = true;

        // Lower-center: 3D Shipping Crate filled with screws that empty out as you shoot!
        const crateRoot = new Node('crate_root');
        crateRoot.setParent(this._paintNode);
        crateRoot.setPosition(0, -252, 0);

        this._paintBoxPile = new Node('crate_pile');
        this._paintBoxPile.setParent(crateRoot);
        this._paintBoxPile.setPosition(0, 56, 0);

        const crateSp = this.makeSpriteFit('paint_crate', crateRoot, 'xzx', 260, 212);
        crateSp.setPosition(0, -14, 0);

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

        // Bottom-center: Press-and-Hold SHOOT SCREWS button (magenta-pink like original!)
        this._paintShotBtn = createPanel('btn_shot', this._paintNode, 340, 88, '#ec4899', 255, 44);
        const shW = this._paintShotBtn.addComponent(Widget);
        shW.isAlignBottom = true;
        shW.isAlignHorizontalCenter = true;
        shW.bottom = 110;
        this._paintShotLbl = createLabel('shot_lbl', this._paintShotBtn, 'SHOOT SCREWS', 30, '#ffffff', 320, 44);
        this._paintShotLbl.isBold = true;

        this._paintShotBtn.on(Node.EventType.TOUCH_START, () => {
            if (this._paintScrewsLeft <= 0) return;
            this._isShooting = true;
            this._paintShotBtn?.setScale(0.94, 0.94, 1);
            this.fireOnePaintScrew();
            this.unschedule(this.fireOnePaintScrew);
            this.schedule(this.fireOnePaintScrew, 0.065);
        });
        const stopShoot = () => {
            this._isShooting = false;
            this._paintShotBtn?.setScale(Vec3.ONE);
            this.unschedule(this.fireOnePaintScrew);
        };
        this._paintShotBtn.on(Node.EventType.TOUCH_END, stopShoot);
        this._paintShotBtn.on(Node.EventType.TOUCH_CANCEL, stopShoot);

        // Bottom-center: NEXT LEVEL button (replaces SHOOT button once crate is empty!)
        this._paintNextBtn = createButton('btn_next', this._paintNode, 'NEXT LEVEL', 350, 90, '#0ea5e9', () => {
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
        let art = PixelGalleryService.getActiveArt();
        if (PixelGalleryService.isCompleted(art.id)) {
            const nextArt = PIXEL_GALLERY.find((a) => !PixelGalleryService.isCompleted(a.id));
            if (nextArt) {
                art = nextArt;
                PixelGalleryService.setActiveArt(art.id);
            }
        }
        this._paintArt = art;
        this._paintCurIndex = PixelGalleryService.getFilledCount(art.id);
        this._paintScrewsLeft = Math.ceil(art.cells.length / 3);

        // Populate colorful 3D screws inside the shipping crate mouth
        for (let i = 0; i < this._paintScrewsLeft; i++) {
            const cId = 1 + (i % 10);
            const s = this.makeSpriteNode(`pile_${i}`, this._paintBoxPile, `gbz_screw${cId}`, 40, 40);
            s.setPosition((Math.random() - 0.5) * 145, (Math.random() - 0.5) * 44, 0);
            s.angle = Math.random() * 360;
        }

        this.drawPixelArtStatic(this._paintArtCanvas, art, this._paintCurIndex, 40, 37);
        this.updatePaintUI();

        if (this._paintTipLbl) this._paintTipLbl.node.active = true;
        if (this._paintShotBtn) this._paintShotBtn.active = true;
        if (this._paintNextBtn) this._paintNextBtn.active = false;
    }

    private updatePaintUI(): void {
        if (!this._paintArt) return;
        const total = this._paintArt.cells.length;
        const pct = Math.round((this._paintCurIndex / Math.max(1, total)) * 100);
        if (this._paintProgLbl) this._paintProgLbl.string = `Completion: ${pct}%`;
        if (this._paintProgFill) {
            this._paintProgFill.setScale(Math.max(0.05, Math.min(1, this._paintCurIndex / Math.max(1, total))), 1, 1);
        }
        if (this._paintShotLbl) {
            this._paintShotLbl.string = `SHOOT SCREWS (${this._paintScrewsLeft})`;
        }
    }

    /** Fires 1 screw out of the cardboard crate into the next pixel cell (original GbzPaintLayer.shot) */
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
            const nextArt = PIXEL_GALLERY.find((a) => !PixelGalleryService.isCompleted(a.id));
            if (!nextArt) {
                this._paintScrewsLeft = 0;
                this.finishPaintShooting();
                return;
            }
            this._paintArt = nextArt;
            PixelGalleryService.setActiveArt(nextArt.id);
            this._paintCurIndex = PixelGalleryService.getFilledCount(nextArt.id);
            this.drawPixelArtStatic(this._paintArtCanvas, nextArt, this._paintCurIndex, 40, 37);
        }

        // Remove 1 screw from the visible pile inside the crate so the crate empties out!
        if (this._paintBoxPile && this._paintBoxPile.children.length > 0) {
            this._paintBoxPile.children[this._paintBoxPile.children.length - 1].destroy();
        }

        const art = this._paintArt;
        const idx = this._paintCurIndex;
        const cell = art.cells[idx];
        const cellStep = 40;
        const screwSize = 37;
        const half = ((art.gridSize - 1) * cellStep) / 2;
        const tx = cell.col * cellStep - half;
        const ty = half - cell.row * cellStep;

        // Shoot from cardboard crate mouth (y = -450 relative to wood frame center) -> (tx, ty)
        const fly = this.makeSpriteNode(`shot_${idx}`, this._paintFlyLayer, `gbz_screw${cell.colorId}`, 46, 46);
        fly.setPosition((Math.random() - 0.5) * 120, -455, 0);
        fly.angle = Math.random() * 360;

        AudioManager.ins.play(AudioClips.SCREW_OUT);

        const targetCanvas = this._paintArtCanvas;
        tween(fly)
            .to(0.20, {
                position: new Vec3(tx, ty, 0),
                scale: new Vec3(screwSize / 46, screwSize / 46, 1),
                angle: 0,
            }, { easing: 'quadOut' })
            .call(() => {
                if (fly.isValid) fly.destroy();
                if (targetCanvas && targetCanvas.isValid && this._paintArt?.id === art.id) {
                    const landed = this.makeSpriteNode(`px_${idx}`, targetCanvas, `gbz_screw${cell.colorId}`, screwSize, screwSize);
                    landed.setPosition(tx, ty, 0);
                }
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
        this._pauseNode = createPanel('GbzExitLayer', this.node, 750, 1334, '#000000', 165, 0, true);
        const card = this.makeSpriteNode('panel', this._pauseNode, 'UI_db2', 520, 560);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(222, 238, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
        });

        createLabel('title', card, 'PAUSED', 42, '#1e293b', 280, 54).node.setPosition(0, 190, 0);

        createButton('btn_continue', card, 'RESUME', 330, 76, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
        }, 30, '#ffffff', 22).setPosition(0, 62, 0);

        createButton('btn_restart', card, 'RESTART', 330, 76, '#f59e0b', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
            this._actions?.onRestart();
        }, 30, '#ffffff', 22).setPosition(0, -44, 0);

        createButton('btn_home', card, 'HOME', 330, 76, '#0ea5e9', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
            this._actions?.onBackMenu();
        }, 30, '#ffffff', 22).setPosition(0, -150, 0);

        this._pauseNode.active = false;
    }

    private buildLosePopup(): void {
        this._loseNode = createPanel('GbzLoseFullLayer', this.node, 750, 1334, '#000000', 180, 0, true);
        const card = this.makeSpriteNode('card', this._loseNode, 'UI_db2', 560, 520);

        createLabel('lose_title', card, 'TRAY FULL!', 46, '#ef4444', 440, 58).node.setPosition(0, 170, 0);
        createLabel('lose_sub', card, 'Watch a short ad to clear the tray & continue!', 22, '#475569', 480, 44).node.setPosition(0, 96, 0);

        createButton('btn_revive_ad', card, 'FREE REVIVE (AD)', 400, 90, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            MonetizationManager.ins.showRewardedAd('revive', () => {
                if (this._loseNode) this._loseNode.active = false;
                this._actions?.onRevive();
            });
        }, 30, '#ffffff', 26).setPosition(0, -24, 0);

        createButton('btn_retry', card, 'TRY AGAIN', 320, 68, '#f59e0b', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._loseNode) this._loseNode.active = false;
            this._actions?.onRestart();
        }, 26, '#ffffff', 22).setPosition(0, -138, 0);

        this._loseNode.active = false;
    }

    private buildSettingsPopup(): void {
        this._settingsNode = createPanel('GbzSettingLayer', this.node, 750, 1334, '#000000', 170, 0, true);
        const card = this.makeSpriteNode('panel', this._settingsNode, 'UI_db2', 520, 380);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(220, 150, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._settingsNode) this._settingsNode.active = false;
        });

        createLabel('title', card, 'SETTINGS', 40, '#1e293b', 300, 52).node.setPosition(0, 118, 0);

        const soundBtn = createButton('btn_sound', card, 'SOUND FX: ON', 360, 76, '#0ea5e9', () => {
            DataManager.ins.soundEnabled = !DataManager.ins.soundEnabled;
            DataManager.ins.save();
            this.refreshSettingsLabels();
            if (DataManager.ins.soundEnabled) AudioManager.ins.play(AudioClips.GAME_CLICK);
        }, 28, '#ffffff', 22);
        soundBtn.setPosition(0, -16, 0);
        this._soundBtnLbl = soundBtn.getChildByName('Label')?.getComponent(Label) || null;

        this._settingsNode.active = false;
    }

    private buildGalleryModal(): void {
        this._galleryNode = createPanel('XiangCeLayer', this.node, 750, 1334, '#000000', 180, 0, true);
        const card = this.makeSpriteNode('panel', this._galleryNode, 'UI_db2', 660, 960);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(288, 434, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._galleryNode) this._galleryNode.active = false;
        });

        createLabel('title', card, 'MY ARTWORKS', 38, '#0f172a', 420, 48).node.setPosition(0, 416, 0);
        this._galleryCountLbl = createLabel('sub', card, 'Collected: 0 / 6', 24, '#0284c7', 420, 34);
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

        // Determine current sequential artwork index (first unfinished artwork)
        let curIndex = PIXEL_GALLERY.findIndex((a) => !PixelGalleryService.isCompleted(a.id));
        const completedCount = curIndex === -1 ? PIXEL_GALLERY.length : curIndex;
        if (curIndex === -1) curIndex = PIXEL_GALLERY.length;

        if (this._galleryCountLbl) {
            this._galleryCountLbl.string = `Collected: ${completedCount} / ${PIXEL_GALLERY.length}`;
        }

        const holeSf = ResManager.ins.getGameSprite('hole');

        PIXEL_GALLERY.forEach((art, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const x = col === 0 ? -148 : 148;
            const y = 246 - row * 252;

            const filled = PixelGalleryService.getFilledCount(art.id);
            const total = art.cells.length;
            const pct = Math.round((filled / Math.max(1, total)) * 100);

            if (idx < curIndex) {
                // State 1: COMPLETED — clean full 3D screw art in wooden frame, no progress bar
                const tile = createPanel(`art_${art.id}`, this._galleryListRoot!, 274, 232, '#fef9c3', 255, 22);
                tile.setPosition(x, y, 0);
                const wf = this.makeSpriteNode('wf', tile, 'wood_frame', 164, 164);
                wf.setPosition(0, 18, 0);
                const thumb = new Node('thumb');
                thumb.setParent(wf);
                const step = 12;
                const half = ((art.gridSize - 1) * step) / 2;
                for (let i = 0; i < total; i++) {
                    const cell = art.cells[i];
                    const s = this.makeSpriteNode(`m_${i}`, thumb, `gbz_screw${cell.colorId}`, 11, 11);
                    s.setPosition(cell.col * step - half, half - cell.row * step, 0);
                }
                const titleLbl = createLabel('t', tile, art.title, 22, '#0f172a', 240, 28);
                titleLbl.isBold = true;
                titleLbl.node.setPosition(0, -86, 0);
            } else if (idx === curIndex) {
                // State 2: IN PROGRESS — partial 3D screw art + yellow progress bar below
                const tile = createPanel(`art_${art.id}`, this._galleryListRoot!, 274, 232, '#e0f2fe', 255, 22);
                tile.setPosition(x, y, 0);
                const wf = this.makeSpriteNode('wf', tile, 'wood_frame', 150, 150);
                wf.setPosition(0, 30, 0);
                const thumb = new Node('thumb');
                thumb.setParent(wf);
                const step = 11;
                const half = ((art.gridSize - 1) * step) / 2;
                for (let i = 0; i < total; i++) {
                    const cell = art.cells[i];
                    const px = cell.col * step - half;
                    const py = half - cell.row * step;
                    if (i < filled) {
                        const s = this.makeSpriteNode(`m_${i}`, thumb, `gbz_screw${cell.colorId}`, 10, 10);
                        s.setPosition(px, py, 0);
                    } else {
                        const h = new Node(`e_${i}`);
                        h.setParent(thumb);
                        h.setPosition(px, py, 0);
                        const ui = h.addComponent(UITransform);
                        ui.setContentSize(7, 7);
                        const sp = h.addComponent(Sprite);
                        sp.sizeMode = Sprite.SizeMode.CUSTOM;
                        if (holeSf) sp.spriteFrame = holeSf;
                        const op = h.addComponent(UIOpacity);
                        op.opacity = 90;
                    }
                }
                const barTrack = this.makeSpriteNode('p_track', tile, 'UI_jdt_1', 220, 28);
                barTrack.setPosition(0, -76, 0);
                const barFill = this.makeSpriteNode('p_fill', barTrack, 'UI_jdt_2', 220, 28);
                barFill.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
                barFill.setPosition(-110, 0, 0);
                barFill.setScale(Math.max(0.06, Math.min(1, filled / Math.max(1, total))), 1, 1);
                const pLbl = createLabel('p_lbl', barTrack, `${pct}%`, 18, '#ffffff', 160, 24);
                pLbl.isBold = true;
            } else {
                // State 3: LOCKED MYSTERY "?" (matches original wenhao.active = true)
                const tile = createPanel(`art_${art.id}`, this._galleryListRoot!, 274, 232, '#e2e8f0', 255, 22);
                tile.setPosition(x, y, 0);
                const qCircle = createPanel('q_bg', tile, 112, 112, '#94a3b8', 255, 56);
                qCircle.setPosition(0, 14, 0);
                const qLbl = createLabel('q_txt', qCircle, '?', 64, '#ffffff', 96, 80);
                qLbl.isBold = true;
                createLabel('lock_lbl', tile, 'LOCKED', 20, '#64748b', 180, 26).node.setPosition(0, -78, 0);
                this.bindTap(tile, () => {
                    AudioManager.ins.play(AudioClips.CLICK_ERROR);
                    this.showToast('Complete current artwork to unlock!');
                });
            }
        });
    }

    // ==================== Toast ====================

    private buildToast(): void {
        this._toastNode = createPanel('Toast', this.node, 480, 62, '#0f172a', 235, 31);
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

    public openGallery(): void {
        this.refreshGalleryModal();
        if (this._galleryNode) this._galleryNode.active = true;
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
                if (ui) ui.setContentSize(cnt > 0 ? 76 : 94, cnt > 0 ? 76 : 68);
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
        if (this._soundBtnLbl) {
            this._soundBtnLbl.string = `SOUND FX: ${DataManager.ins.soundEnabled ? 'ON' : 'OFF'}`;
        }
    }
}
