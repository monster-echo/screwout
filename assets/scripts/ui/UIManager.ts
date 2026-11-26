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
import { IAP_CATALOG, MonetizationManager } from '../core/MonetizationManager';
import { PIXEL_GALLERY, PixelArtDef, PixelGalleryService } from '../meta/PixelGalleryData';
import { DailyAndLeaderboardService } from '../meta/DailyAndLeaderboard';
import { createButton, createLabel, createPanel } from './UIHelper';

const { ccclass } = _decorator;

export interface UIActions {
    onStartGame: (level: number) => void;
    onStartDaily: () => void;
    onRestart: () => void;
    onGiveUp: () => void;
    onBackMenu: () => void;
    onNextLevel: () => void;
    onRevive: () => void;
    onUseSkill: (skill: SkillType) => void;
}

@ccclass('UIManager')
export class UIManager extends Component {
    private _actions: UIActions | null = null;

    // In-game HUD
    private _hudNode: Node | null = null;
    private _levelLabel: Label | null = null;
    private _hudStreakNode: Node | null = null;
    private _hudStreakLbl: Label | null = null;
    private _progressLabel: Label | null = null;
    private _collectBoxNode: Node | null = null;
    private _smashBanner: Node | null = null;
    private _skillBadgeLabels: Map<SkillType, Label> = new Map();

    public get collectBoxNode(): Node | null {
        return this._collectBoxNode;
    }

    // Home Menu
    private _menuNode: Node | null = null;
    private _coinsLbl: Label | null = null;
    private _boltsLbl: Label | null = null;
    private _menuStreakLbl: Label | null = null;
    private _pixelCanvasNode: Node | null = null;
    private _menuArtTitleLbl: Label | null = null;
    private _menuProgressFill: Node | null = null;
    private _menuProgressLbl: Label | null = null;
    private _buildBtnLbl: Label | null = null;
    private _playBtnLbl: Label | null = null;
    private _playSubLbl: Label | null = null;
    private _dailyBadgeLbl: Label | null = null;
    private _rankBadgeLbl: Label | null = null;
    private _galleryBadgeLbl: Label | null = null;

    // Popups
    private _pauseNode: Node | null = null;
    private _winNode: Node | null = null;
    private _winTitleLbl: Label | null = null;
    private _winRewardLbl: Label | null = null;
    private _winStreakLbl: Label | null = null;
    private _winDoubleBtn: Node | null = null;
    private _winNextLbl: Label | null = null;
    private _winDoubled = false;

    private _loseNode: Node | null = null;
    private _loseStreakBanner: Node | null = null;
    private _loseStreakLbl: Label | null = null;
    private _loseReviveAdLbl: Label | null = null;
    private _loseGiveUpLbl: Label | null = null;

    private _settingsNode: Node | null = null;
    private _soundBtnLbl: Label | null = null;
    private _countryBtnLbl: Label | null = null;
    private _noAdsStatusLbl: Label | null = null;

    private _galleryNode: Node | null = null;
    private _galleryListRoot: Node | null = null;

    private _leaderboardNode: Node | null = null;
    private _lbTab: 'countries' | 'global' = 'countries';
    private _lbListRoot: Node | null = null;
    private _lbCountryTabBtn: Node | null = null;
    private _lbGlobalTabBtn: Node | null = null;
    private _lbMyCountryLbl: Label | null = null;

    private _shopNode: Node | null = null;
    private _shopListRoot: Node | null = null;

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
        this.buildLosePopup();
        this.buildSettingsPopup();
        this.buildGalleryModal();
        this.buildLeaderboardModal();
        this.buildShopModal();
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
        if (sf) {
            sp.spriteFrame = sf;
        }
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

        // Top-right Win Streak pill
        this._hudStreakNode = createPanel('hud_streak', this._hudNode, 146, 44, '#f97316', 245, 22);
        const hsW = this._hudStreakNode.addComponent(Widget);
        hsW.isAlignTop = true;
        hsW.isAlignRight = true;
        hsW.top = 35;
        hsW.right = 20;
        this._hudStreakLbl = createLabel('hs_lbl', this._hudStreakNode, 'STREAK x0', 20, '#ffffff', 136, 32);

        // Right-side craft crate progress indicator
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

        // Bottom 3 original 3D skill buttons (1:1 aspect ratio, zero distortion)
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
            { name: 'btn_skill_core', type: SkillType.UNLOCK_SLOT, label: '+1 SLOT', iconSprite: 'gbz_screw_core', iconScale: 0.88, x: -401 },
            { name: 'btn_skill_screw', type: SkillType.CLEAR_TRAY, label: 'CLEAR', iconSprite: 'UI_icon3', iconScale: 0.95, x: 0 },
            { name: 'btn_skill_board', type: SkillType.SMASH_BOARD, label: 'MELT', iconSprite: 'UI_icon2', iconScale: 0.95, x: 401 },
        ];

        for (const cfg of skillConfigs) {
            const btn = this.makeSpriteNode(cfg.name, skillBar, 'skill_btn_bg', 281, 207);
            btn.setPosition(cfg.x, 0, 0);

            const icon = this.makeSpriteFit('icon', btn, cfg.iconSprite, 108, 108);
            icon.setScale(cfg.iconScale, cfg.iconScale, 1);
            icon.setPosition(0, 28, 0);

            const txtLbl = createLabel('txt', btn, cfg.label, 38, '#ffffff', 240, 52);
            txtLbl.node.setPosition(0, -60, 0);

            const badge = createPanel('plus', btn, 86, 60, '#22c55e', 255, 30);
            badge.setPosition(114, 84, 0);
            const countLbl = createLabel('cnt', badge, '2', 34, '#ffffff', 78, 44);
            this._skillBadgeLabels.set(cfg.type, countLbl);

            this.bindTap(btn, () => {
                AudioManager.ins.play(AudioClips.GAME_CLICK);
                this._actions?.onUseSkill(cfg.type);
            });
        }
    }

    // ==================== Overseas Commercial Home Menu ====================

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

        // Top Bar Container (pinned to top)
        const topBar = new Node('top_bar');
        topBar.setParent(this._menuNode);
        const tbUi = topBar.addComponent(UITransform);
        tbUi.setContentSize(710, 90);
        const tbW = topBar.addComponent(Widget);
        tbW.isAlignTop = true;
        tbW.isAlignHorizontalCenter = true;
        tbW.top = 24;

        // Settings gear (left)
        const setBtn = this.makeSpriteFit('btn_setting', topBar, 'UI_icon_setting', 76, 76);
        setBtn.setPosition(-310, 0, 0);
        this.bindTap(setBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openSettings();
        });

        // Coins Pill
        const coinPill = createPanel('coin_pill', topBar, 152, 52, '#0f172a', 210, 26);
        coinPill.setPosition(-175, 0, 0);
        this._coinsLbl = createLabel('coins_lbl', coinPill, '120 C', 24, '#fde047', 136, 36);
        this.bindTap(coinPill, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openShop();
        });

        // Bolts Pill
        const boltPill = createPanel('bolt_pill', topBar, 146, 52, '#0f172a', 210, 26);
        boltPill.setPosition(-12, 0, 0);
        this._boltsLbl = createLabel('bolts_lbl', boltPill, '20 B', 24, '#38bdf8', 130, 36);

        // Win Streak Pill
        const streakPill = createPanel('streak_pill', topBar, 140, 52, '#ea580c', 235, 26);
        streakPill.setPosition(145, 0, 0);
        this._menuStreakLbl = createLabel('streak_lbl', streakPill, 'x0 WIN', 22, '#ffffff', 128, 34);

        // Shop Button (right)
        const shopBtn = createButton('btn_shop', topBar, 'SHOP', 110, 54, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openShop();
        }, 22, '#ffffff', 22);
        shopBtn.setPosition(286, 0, 0);

        // Game Title Banner
        const titleLbl = createLabel('game_title', this._menuNode, 'SCREW JAM', 54, '#0f172a', 520, 68);
        titleLbl.node.setPosition(0, 488, 0);

        // Centerpiece Wooden Frame showing live Pixel Art Mosaic
        const woodFrame = this.makeSpriteNode('wood_frame', this._menuNode, 'wood_frame', 468, 468);
        woodFrame.setPosition(0, 206, 0);

        this._pixelCanvasNode = new Node('pixel_canvas');
        this._pixelCanvasNode.setParent(woodFrame);
        this._pixelCanvasNode.setPosition(0, 0, 0);

        // Artwork Title & Progress Bar below wooden frame
        this._menuArtTitleLbl = createLabel('art_title', this._menuNode, 'Lucky Cat', 26, '#0f172a', 420, 36);
        this._menuArtTitleLbl.node.setPosition(0, -56, 0);

        const barTrack = this.makeSpriteNode('jdt_track', this._menuNode, 'UI_jdt_1', 468, 38);
        barTrack.setPosition(0, -96, 0);
        this._menuProgressFill = this.makeSpriteNode('jdt_fill', barTrack, 'UI_jdt_2', 468, 38);
        this._menuProgressFill.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
        this._menuProgressFill.setPosition(-234, 0, 0);
        this._menuProgressLbl = createLabel('jdt_lbl', barTrack, '0 / 45 Bolts', 22, '#ffffff', 360, 34);

        // Interactive BUILD button for Pixel Art Meta Loop
        const buildBtn = createButton('btn_build', this._menuNode, 'BUILD (+5 BOLTS)', 340, 66, '#f59e0b', () => {
            this.onBuildActiveArt();
        }, 26, '#ffffff', 26);
        buildBtn.setPosition(0, -162, 0);
        this._buildBtnLbl = buildBtn.getChildByName('Label')?.getComponent(Label) || null;

        // 3-Card Meta Feature Dock: Gallery | Daily Challenge | Leaderboard
        const dock = new Node('meta_dock');
        dock.setParent(this._menuNode);
        dock.setPosition(0, -286, 0);

        // Card 1: Pixel Gallery
        const galCard = createPanel('card_gallery', dock, 204, 128, '#ffffff', 240, 24);
        galCard.setPosition(-224, 0, 0);
        createLabel('g_t', galCard, 'GALLERY', 24, '#0f172a', 180, 34).node.setPosition(0, 26, 0);
        this._galleryBadgeLbl = createLabel('g_b', galCard, '0 / 6 Done', 20, '#0284c7', 180, 30);
        this._galleryBadgeLbl.node.setPosition(0, -16, 0);
        this.bindTap(galCard, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openGallery();
        });

        // Card 2: Daily Challenge
        const dailyCard = createPanel('card_daily', dock, 204, 128, '#ffffff', 240, 24);
        dailyCard.setPosition(0, 0, 0);
        createLabel('d_t', dailyCard, 'DAILY', 24, '#0f172a', 180, 34).node.setPosition(0, 26, 0);
        this._dailyBadgeLbl = createLabel('d_b', dailyCard, '+100C +20B', 20, '#ea580c', 180, 30);
        this._dailyBadgeLbl.node.setPosition(0, -16, 0);
        this.bindTap(dailyCard, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onStartDaily();
        });

        // Card 3: Country & Global Leaderboard
        const rankCard = createPanel('card_rank', dock, 204, 128, '#ffffff', 240, 24);
        rankCard.setPosition(224, 0, 0);
        createLabel('r_t', rankCard, 'RANKING', 24, '#0f172a', 180, 34).node.setPosition(0, 26, 0);
        this._rankBadgeLbl = createLabel('r_b', rankCard, 'US · 0 pts', 20, '#16a34a', 180, 30);
        this._rankBadgeLbl.node.setPosition(0, -16, 0);
        this.bindTap(rankCard, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openLeaderboard();
        });

        // Bottom Primary PLAY CTA Button
        const startBtn = this.makeSpriteNode('btn_start', this._menuNode, '按键1', 420, 124);
        startBtn.setPosition(0, -470, 0);
        this._playBtnLbl = createLabel('start_lbl', startBtn, 'PLAY · LEVEL 1', 38, '#ffffff', 380, 56);
        this._playBtnLbl.node.setPosition(0, 6, 0);
        this.bindTap(startBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onStartGame(DataManager.ins.level);
        });

        this._playSubLbl = createLabel('play_sub', this._menuNode, 'Win Streak x1+: Start with Bonus Slot!', 21, '#334155', 600, 34);
        this._playSubLbl.node.setPosition(0, -560, 0);
    }

    private renderActivePixelArt(): void {
        if (!this._pixelCanvasNode) return;
        this._pixelCanvasNode.removeAllChildren();

        const art: PixelArtDef = PixelGalleryService.getActiveArt();
        const filled = PixelGalleryService.getFilledCount(art.id);
        const total = art.cells.length;
        const grid = art.gridSize;
        const cellStep = 38;
        const half = ((grid - 1) * cellStep) / 2;

        // Subtle wooden pegboard backdrop grid
        const bgG = this._pixelCanvasNode.addComponent(Graphics) || this._pixelCanvasNode.getComponent(Graphics);
        if (bgG) {
            bgG.clear();
            bgG.fillColor = new Color(241, 245, 249, 255);
            bgG.roundRect(-186, -186, 372, 372, 22);
            bgG.fill();
        }

        const holeSf = ResManager.ins.getGameSprite('hole');
        for (let i = 0; i < total; i++) {
            const cell = art.cells[i];
            const x = cell.col * cellStep - half;
            const y = half - cell.row * cellStep;

            if (i < filled) {
                const s = this.makeSpriteNode(`px_${i}`, this._pixelCanvasNode, `gbz_screw${cell.colorId}`, 34, 34);
                s.setPosition(x, y, 0);
            } else {
                const h = new Node(`empty_${i}`);
                h.setParent(this._pixelCanvasNode);
                h.setPosition(x, y, 0);
                const ui = h.addComponent(UITransform);
                ui.setContentSize(24, 24);
                const sp = h.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                if (holeSf) sp.spriteFrame = holeSf;
                const op = h.addComponent(UIOpacity);
                op.opacity = 110;
            }
        }

        if (this._menuArtTitleLbl) {
            this._menuArtTitleLbl.string = `${art.title}  (${art.theme})`;
        }
        if (this._menuProgressLbl) {
            this._menuProgressLbl.string = filled >= total ? 'COMPLETED!' : `${filled} / ${total} Bolts`;
        }
        if (this._menuProgressFill) {
            const ratio = Math.max(0.06, Math.min(1, total > 0 ? filled / total : 1));
            this._menuProgressFill.setScale(ratio, 1, 1);
        }
        if (this._buildBtnLbl) {
            if (filled >= total) {
                this._buildBtnLbl.string = 'CHOOSE NEXT ART';
            } else if (DataManager.ins.bolts > 0) {
                const step = Math.min(5, total - filled, DataManager.ins.bolts);
                this._buildBtnLbl.string = `BUILD (+${step} BOLTS)`;
            } else {
                this._buildBtnLbl.string = 'PLAY TO EARN BOLTS';
            }
        }
    }

    private onBuildActiveArt(): void {
        const art = PixelGalleryService.getActiveArt();
        if (PixelGalleryService.isCompleted(art.id)) {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openGallery();
            return;
        }
        if (DataManager.ins.bolts <= 0) {
            AudioManager.ins.play(AudioClips.CLICK_ERROR);
            this.showToast('Clear levels to earn more Bolts!');
            return;
        }
        const res = PixelGalleryService.buildArt(art.id, 5);
        if (res.placed > 0) {
            AudioManager.ins.play(res.justCompleted ? AudioClips.GAME_WIN : AudioClips.SCREW_IN);
            MonetizationManager.ins.trackEvent('gallery_build', {
                artId: art.id,
                placed: res.placed,
                completed: res.justCompleted,
            });
            this.refreshHeader();
            if (res.justCompleted) {
                this.showToast(`${art.title} Complete! +${res.rewardCoins} Coins & +1 All Boosters!`);
            } else {
                this.showToast(`Placed ${res.placed} Bolts!`);
            }
        }
    }

    // ==================== Pause Popup ====================

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

    // ==================== Win Popup (2x Reward AD + Win Streak) ====================

    private buildWinPopup(): void {
        this._winNode = createPanel('GbzWinLayer', this.node, 750, 1334, '#000000', 180, 0, true);
        const card = this.makeSpriteNode('card', this._winNode, 'UI_db2', 580, 680);

        this._winTitleLbl = createLabel('win_title', card, 'LEVEL COMPLETE!', 42, '#16a34a', 520, 58);
        this._winTitleLbl.node.setPosition(0, 245, 0);

        this._winStreakLbl = createLabel('win_streak', card, 'WIN STREAK x1!', 30, '#ea580c', 480, 44);
        this._winStreakLbl.node.setPosition(0, 172, 0);

        const rewardBox = createPanel('reward_box', card, 460, 124, '#f1f5f9', 255, 24);
        rewardBox.setPosition(0, 64, 0);
        this._winRewardLbl = createLabel('win_reward', rewardBox, '+35 Coins   +12 Bolts', 30, '#0f172a', 430, 46);

        this._winDoubleBtn = createButton('btn_2x', card, '2x REWARD (AD)', 380, 82, '#f59e0b', () => {
            if (this._winDoubled) return;
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            MonetizationManager.ins.showRewardedAd('double_win_reward', () => {
                this._winDoubled = true;
                DataManager.ins.addCoins(DataManager.ins.lastWinCoins);
                DataManager.ins.addBolts(DataManager.ins.lastWinBolts);
                if (this._winDoubleBtn) this._winDoubleBtn.active = false;
                if (this._winRewardLbl) {
                    this._winRewardLbl.string = `+${DataManager.ins.lastWinCoins * 2} Coins   +${DataManager.ins.lastWinBolts * 2} Bolts (2x!)`;
                }
                this.refreshHeader();
            });
        }, 28, '#ffffff', 24);
        this._winDoubleBtn.setPosition(0, -64, 0);

        const nextBtn = createButton('btn_next', card, 'NEXT LEVEL', 380, 86, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onNextLevel();
        }, 32, '#ffffff', 26);
        nextBtn.setPosition(0, -170, 0);
        this._winNextLbl = nextBtn.getChildByName('Label')?.getComponent(Label) || null;

        createButton('btn_home', card, 'HOME', 220, 58, '#64748b', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onBackMenu();
        }, 24, '#ffffff', 18).setPosition(0, -264, 0);

        this._winNode.active = false;
    }

    // ==================== Lose Popup (High-Conversion Streak Protection) ====================

    private buildLosePopup(): void {
        this._loseNode = createPanel('GbzLoseFullLayer', this.node, 750, 1334, '#000000', 180, 0, true);
        const card = this.makeSpriteNode('card', this._loseNode, 'UI_db2', 580, 720);

        createLabel('lose_title', card, 'TRAY FULL!', 46, '#ef4444', 460, 58).node.setPosition(0, 265, 0);
        createLabel('lose_sub', card, 'Clear all screws in the tray & keep playing!', 22, '#475569', 500, 34).node.setPosition(0, 212, 0);

        // Win Streak Danger Callout
        this._loseStreakBanner = createPanel('streak_warn', card, 480, 92, '#fff7ed', 255, 20);
        this._loseStreakBanner.setPosition(0, 114, 0);
        this._loseStreakLbl = createLabel('sw_lbl', this._loseStreakBanner, 'DON\'T LOSE YOUR x3 STREAK!', 25, '#c2410c', 450, 44);

        // Option 1: Rewarded Ad Revive
        const revAdBtn = createButton('btn_revive_ad', card, 'REVIVE & SAVE STREAK (AD)', 440, 86, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            MonetizationManager.ins.showRewardedAd('revive_streak', () => {
                if (this._loseNode) this._loseNode.active = false;
                this._actions?.onRevive();
            });
        }, 25, '#ffffff', 24);
        revAdBtn.setPosition(0, -18, 0);
        this._loseReviveAdLbl = revAdBtn.getChildByName('Label')?.getComponent(Label) || null;

        // Option 2: Coin Revive (50 Coins)
        createButton('btn_revive_coin', card, 'REVIVE  (50 COINS)', 440, 78, '#f59e0b', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (DataManager.ins.spendCoins(50)) {
                if (this._loseNode) this._loseNode.active = false;
                this.refreshHeader();
                this._actions?.onRevive();
            } else {
                this.showToast('Not enough coins! Watch an Ad or visit Shop.');
            }
        }, 26, '#ffffff', 24).setPosition(0, -124, 0);

        // Option 3: Give Up (Resets Streak)
        const giveUpBtn = createButton('btn_giveup', card, 'Give Up (Reset Streak)', 340, 62, '#94a3b8', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._loseNode) this._loseNode.active = false;
            this._actions?.onGiveUp();
        }, 22, '#ffffff', 18);
        giveUpBtn.setPosition(0, -238, 0);
        this._loseGiveUpLbl = giveUpBtn.getChildByName('Label')?.getComponent(Label) || null;

        this._loseNode.active = false;
    }

    // ==================== Settings Popup ====================

    private buildSettingsPopup(): void {
        this._settingsNode = createPanel('GbzSettingLayer', this.node, 750, 1334, '#000000', 170, 0, true);
        const card = this.makeSpriteNode('panel', this._settingsNode, 'UI_db2', 540, 520);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(230, 218, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._settingsNode) this._settingsNode.active = false;
        });

        createLabel('title', card, 'SETTINGS', 40, '#1e293b', 300, 52).node.setPosition(0, 185, 0);

        const soundBtn = createButton('btn_sound', card, 'SOUND FX: ON', 360, 72, '#0ea5e9', () => {
            DataManager.ins.soundEnabled = !DataManager.ins.soundEnabled;
            DataManager.ins.save();
            this.refreshSettingsLabels();
            if (DataManager.ins.soundEnabled) AudioManager.ins.play(AudioClips.GAME_CLICK);
        }, 26, '#ffffff', 20);
        soundBtn.setPosition(0, 70, 0);
        this._soundBtnLbl = soundBtn.getChildByName('Label')?.getComponent(Label) || null;

        const countryBtn = createButton('btn_country', card, 'COUNTRY: US', 360, 72, '#6366f1', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            DailyAndLeaderboardService.cyclePlayerCountry();
            this.refreshSettingsLabels();
            this.refreshHeader();
        }, 26, '#ffffff', 20);
        countryBtn.setPosition(0, -32, 0);
        this._countryBtnLbl = countryBtn.getChildByName('Label')?.getComponent(Label) || null;

        this._noAdsStatusLbl = createLabel('noads_lbl', card, 'Interstitial Ads: Active', 22, '#64748b', 420, 36);
        this._noAdsStatusLbl.node.setPosition(0, -135, 0);

        this._settingsNode.active = false;
    }

    // ==================== Pixel Art Gallery Modal ====================

    private buildGalleryModal(): void {
        this._galleryNode = createPanel('GalleryModal', this.node, 750, 1334, '#000000', 180, 0, true);
        const card = this.makeSpriteNode('panel', this._galleryNode, 'UI_db2', 660, 940);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(288, 424, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._galleryNode) this._galleryNode.active = false;
        });

        createLabel('title', card, 'PIXEL ART GALLERY', 36, '#0f172a', 460, 48).node.setPosition(0, 405, 0);
        createLabel('sub', card, 'Spend Bolts from cleared levels to complete artworks!', 21, '#475569', 560, 32).node.setPosition(0, 355, 0);

        this._galleryListRoot = new Node('gallery_grid');
        this._galleryListRoot.setParent(card);
        this._galleryListRoot.setPosition(0, -25, 0);

        this._galleryNode.active = false;
    }

    private refreshGalleryModal(): void {
        if (!this._galleryListRoot) return;
        this._galleryListRoot.removeAllChildren();

        const activeId = DataManager.ins.gallery.activeArtId;
        PIXEL_GALLERY.forEach((art, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const x = col === 0 ? -148 : 148;
            const y = 230 - row * 238;

            const filled = PixelGalleryService.getFilledCount(art.id);
            const total = art.cells.length;
            const done = filled >= total;
            const isSelected = art.id === activeId;

            const bgHex = isSelected ? '#e0f2fe' : '#f8fafc';
            const tile = createPanel(`art_${art.id}`, this._galleryListRoot!, 274, 214, bgHex, 255, 22);
            tile.setPosition(x, y, 0);

            createLabel('t', tile, art.title, 24, '#0f172a', 240, 32).node.setPosition(0, 74, 0);
            createLabel('p', tile, done ? 'COMPLETED' : `${filled} / ${total} Bolts`, 20, done ? '#16a34a' : '#0284c7', 240, 28).node.setPosition(0, 36, 0);
            createLabel('r', tile, `Reward: +${art.rewardCoins} Coins`, 18, '#b45309', 240, 26).node.setPosition(0, 4, 0);

            const btnText = isSelected ? 'ACTIVE' : 'SELECT';
            const btnColor = isSelected ? '#22c55e' : '#3b82f6';
            createButton('sel', tile, btnText, 190, 52, btnColor, () => {
                AudioManager.ins.play(AudioClips.GAME_CLICK);
                PixelGalleryService.setActiveArt(art.id);
                this.refreshHeader();
                this.refreshGalleryModal();
                this.showToast(`Selected ${art.title}!`);
            }, 22, '#ffffff', 16).setPosition(0, -56, 0);
        });
    }

    // ==================== Leaderboard Modal (Country + Global) ====================

    private buildLeaderboardModal(): void {
        this._leaderboardNode = createPanel('LeaderboardModal', this.node, 750, 1334, '#000000', 180, 0, true);
        const card = this.makeSpriteNode('panel', this._leaderboardNode, 'UI_db2', 660, 980);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(288, 444, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._leaderboardNode) this._leaderboardNode.active = false;
        });

        createLabel('title', card, 'LEADERBOARD', 38, '#0f172a', 420, 48).node.setPosition(0, 424, 0);

        // Tabs: Countries vs Global
        this._lbCountryTabBtn = createButton('tab_c', card, 'COUNTRIES', 240, 58, '#0ea5e9', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._lbTab = 'countries';
            this.refreshLeaderboardModal();
        }, 22, '#ffffff', 18);
        this._lbCountryTabBtn.setPosition(-134, 354, 0);

        this._lbGlobalTabBtn = createButton('tab_g', card, 'GLOBAL', 240, 58, '#94a3b8', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._lbTab = 'global';
            this.refreshLeaderboardModal();
        }, 22, '#ffffff', 18);
        this._lbGlobalTabBtn.setPosition(134, 354, 0);

        this._lbListRoot = new Node('lb_list');
        this._lbListRoot.setParent(card);
        this._lbListRoot.setPosition(0, 16, 0);

        // Footer: Country Switcher + Share Button
        const switchBtn = createButton('btn_sw_c', card, 'MY REGION: US', 250, 62, '#6366f1', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            DailyAndLeaderboardService.cyclePlayerCountry();
            this.refreshHeader();
            this.refreshLeaderboardModal();
        }, 20, '#ffffff', 18);
        switchBtn.setPosition(-140, -408, 0);
        this._lbMyCountryLbl = switchBtn.getChildByName('Label')?.getComponent(Label) || null;

        createButton('btn_share', card, 'SHARE SCORE', 250, 62, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            MonetizationManager.ins.shareResult(DailyAndLeaderboardService.buildShareText());
        }, 20, '#ffffff', 18).setPosition(140, -408, 0);

        this._leaderboardNode.active = false;
    }

    private refreshLeaderboardModal(): void {
        if (!this._lbListRoot) return;
        this._lbListRoot.removeAllChildren();
        if (this._lbMyCountryLbl) {
            this._lbMyCountryLbl.string = `REGION: ${DataManager.ins.playerCountry}`;
        }

        const startY = 266;
        const rowH = 66;

        if (this._lbTab === 'countries') {
            const list = DailyAndLeaderboardService.getCountryLeaderboard().slice(0, 9);
            list.forEach((entry, idx) => {
                const bg = entry.isPlayerCountry ? '#dcfce7' : '#f8fafc';
                const row = createPanel(`c_row_${idx}`, this._lbListRoot!, 580, 58, bg, 255, 16);
                row.setPosition(0, startY - idx * rowH, 0);

                createLabel('rk', row, `#${idx + 1}`, 24, idx < 3 ? '#ea580c' : '#475569', 70, 36).node.setPosition(-242, 0, 0);
                createLabel('nm', row, `[${entry.code}] ${entry.name}${entry.isPlayerCountry ? ' (You)' : ''}`, 22, '#0f172a', 320, 36).node.setPosition(-30, 0, 0);
                createLabel('sc', row, `${entry.score.toLocaleString()}`, 22, '#0284c7', 140, 36).node.setPosition(206, 0, 0);
            });
        } else {
            const list = DailyAndLeaderboardService.getGlobalPlayerLeaderboard().slice(0, 9);
            list.forEach((entry, idx) => {
                const bg = entry.isSelf ? '#fef9c3' : '#f8fafc';
                const row = createPanel(`p_row_${idx}`, this._lbListRoot!, 580, 58, bg, 255, 16);
                row.setPosition(0, startY - idx * rowH, 0);

                createLabel('rk', row, `#${entry.rank}`, 24, entry.rank <= 3 ? '#ea580c' : '#475569', 70, 36).node.setPosition(-242, 0, 0);
                createLabel('nm', row, `[${entry.country}] ${entry.name}`, 22, '#0f172a', 310, 36).node.setPosition(-34, 0, 0);
                createLabel('sc', row, `${entry.score} pts`, 22, '#16a34a', 150, 36).node.setPosition(204, 0, 0);
            });
        }
    }

    // ==================== Overseas IAP Shop Modal ====================

    private buildShopModal(): void {
        this._shopNode = createPanel('ShopModal', this.node, 750, 1334, '#000000', 180, 0, true);
        const card = this.makeSpriteNode('panel', this._shopNode, 'UI_db2', 640, 820);

        const closeBtn = this.makeSpriteFit('btn_close', card, 'btn_close', 58, 58);
        closeBtn.setPosition(276, 364, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._shopNode) this._shopNode.active = false;
        });

        createLabel('title', card, 'STORE', 40, '#0f172a', 320, 50).node.setPosition(0, 344, 0);
        createLabel('sub', card, 'Support the game & power up your puzzles!', 21, '#475569', 540, 32).node.setPosition(0, 294, 0);

        this._shopListRoot = new Node('shop_list');
        this._shopListRoot.setParent(card);
        this._shopListRoot.setPosition(0, -10, 0);

        this._shopNode.active = false;
    }

    private refreshShopModal(): void {
        if (!this._shopListRoot) return;
        this._shopListRoot.removeAllChildren();

        IAP_CATALOG.forEach((prod, idx) => {
            const y = 178 - idx * 194;
            const ownedNoAds = !!prod.removeAds && DataManager.ins.noAdsPurchased;
            const row = createPanel(`iap_${idx}`, this._shopListRoot!, 560, 168, '#f8fafc', 255, 22);
            row.setPosition(0, y, 0);

            createLabel('t', row, prod.title, 26, '#0f172a', 360, 36).node.setPosition(-74, 34, 0);
            createLabel('s', row, prod.subtitle, 19, '#475569', 360, 44).node.setPosition(-74, -22, 0);

            const buyText = ownedNoAds ? 'OWNED' : prod.priceDisplay;
            const buyColor = ownedNoAds ? '#94a3b8' : '#22c55e';
            createButton('buy', row, buyText, 146, 68, buyColor, () => {
                if (ownedNoAds) return;
                AudioManager.ins.play(AudioClips.GET_GOLD);
                MonetizationManager.ins.purchase(prod.sku, (p) => {
                    this.showToast(`Purchased ${p.title}!`);
                    this.refreshHeader();
                    this.refreshShopModal();
                });
            }, 24, '#ffffff', 18).setPosition(188, 0, 0);
        });
    }

    // ==================== Toast ====================

    private buildToast(): void {
        this._toastNode = createPanel('Toast', this.node, 520, 64, '#0f172a', 235, 32);
        this._toastNode.setPosition(0, 140, 0);
        this._toastOp = this._toastNode.addComponent(UIOpacity);
        this._toastOp.opacity = 0;
        this._toastLabel = createLabel('ToastLbl', this._toastNode, '', 22, '#ffffff', 490, 44);
        this._toastNode.active = false;
    }

    // ==================== Public UI Controls ====================

    public showMenu(): void {
        this.hidePopups();
        if (this._hudNode) this._hudNode.active = false;
        if (this._menuNode) this._menuNode.active = true;
        this.refreshHeader();
    }

    public showGameHUD(isDaily = false, levelNumber = DataManager.ins.level): void {
        this.hidePopups();
        if (this._menuNode) this._menuNode.active = false;
        if (this._hudNode) this._hudNode.active = true;
        this.setSmashMode(false);
        if (this._levelLabel) {
            this._levelLabel.string = isDaily ? `DAILY · LV.${levelNumber}` : `LEVEL ${levelNumber}`;
        }
        this.refreshHeader();
        this.setProgress(0);
    }

    public showWin(): void {
        this.hidePopups();
        this._winDoubled = false;
        const dm = DataManager.ins;
        if (this._winTitleLbl) {
            this._winTitleLbl.string = dm.isDailyMode ? 'DAILY COMPLETE!' : 'LEVEL COMPLETE!';
        }
        if (this._winStreakLbl) {
            this._winStreakLbl.string = `WIN STREAK x${dm.winStreak}!`;
        }
        if (this._winRewardLbl) {
            this._winRewardLbl.string = `+${dm.lastWinCoins} Coins   +${dm.lastWinBolts} Bolts`;
        }
        if (this._winDoubleBtn) this._winDoubleBtn.active = true;
        if (this._winNextLbl) {
            this._winNextLbl.string = dm.isDailyMode ? 'BACK HOME' : 'NEXT LEVEL';
        }
        if (this._winNode) this._winNode.active = true;
    }

    public showLose(): void {
        this.hidePopups();
        const streak = DataManager.ins.winStreak;
        if (this._loseStreakBanner) this._loseStreakBanner.active = streak > 0;
        if (this._loseStreakLbl) {
            this._loseStreakLbl.string = `DON'T LOSE YOUR x${streak} STREAK!`;
        }
        if (this._loseReviveAdLbl) {
            this._loseReviveAdLbl.string = streak > 0 ? 'REVIVE & SAVE STREAK (AD)' : 'FREE REVIVE (AD)';
        }
        if (this._loseGiveUpLbl) {
            this._loseGiveUpLbl.string = streak > 0 ? 'Give Up (Reset Streak)' : 'Try Again';
        }
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

    public openLeaderboard(): void {
        this.refreshLeaderboardModal();
        if (this._leaderboardNode) this._leaderboardNode.active = true;
    }

    public openShop(): void {
        this.refreshShopModal();
        if (this._shopNode) this._shopNode.active = true;
    }

    public hidePopups(): void {
        if (this._pauseNode) this._pauseNode.active = false;
        if (this._winNode) this._winNode.active = false;
        if (this._loseNode) this._loseNode.active = false;
        if (this._settingsNode) this._settingsNode.active = false;
        if (this._galleryNode) this._galleryNode.active = false;
        if (this._leaderboardNode) this._leaderboardNode.active = false;
        if (this._shopNode) this._shopNode.active = false;
    }

    public setSmashMode(active: boolean): void {
        if (this._smashBanner) this._smashBanner.active = active;
    }

    public refreshHeader(): void {
        const dm = DataManager.ins;
        if (this._coinsLbl) this._coinsLbl.string = `${dm.coins} C`;
        if (this._boltsLbl) this._boltsLbl.string = `${dm.bolts} B`;
        if (this._menuStreakLbl) this._menuStreakLbl.string = `x${dm.winStreak} WIN`;

        if (this._hudStreakNode && this._hudStreakLbl) {
            this._hudStreakNode.active = dm.winStreak > 0;
            this._hudStreakLbl.string = `STREAK x${dm.winStreak}`;
        }

        if (this._playBtnLbl) this._playBtnLbl.string = `PLAY · LEVEL ${dm.level}`;
        if (this._playSubLbl) {
            const tier = dm.getWinStreakTier();
            if (tier >= 3) this._playSubLbl.string = `Win Streak x${dm.winStreak} Active: +1 Slot & +1 Box at Start!`;
            else if (tier >= 1) this._playSubLbl.string = `Win Streak x${dm.winStreak} Active: +1 Extra Slot at Start!`;
            else this._playSubLbl.string = 'Build a Win Streak for Free Start-of-Level Boosts!';
        }

        const todayKey = DailyAndLeaderboardService.getTodayDateKey();
        const dailyDone = dm.isDailyCompleted(todayKey);
        if (this._dailyBadgeLbl) {
            this._dailyBadgeLbl.string = dailyDone ? 'COMPLETED' : '+100C +20B';
        }
        if (this._rankBadgeLbl) {
            this._rankBadgeLbl.string = `${dm.playerCountry} · ${dm.totalScore} pts`;
        }
        if (this._galleryBadgeLbl) {
            this._galleryBadgeLbl.string = `${PixelGalleryService.getCompletedTotal()} / ${PIXEL_GALLERY.length} Done`;
        }

        // Update bottom skill count / AD badges
        const types: SkillType[] = [SkillType.UNLOCK_SLOT, SkillType.CLEAR_TRAY, SkillType.SMASH_BOARD];
        for (const t of types) {
            const lbl = this._skillBadgeLabels.get(t);
            if (!lbl) continue;
            const cnt = dm.getSkillCount(t);
            lbl.string = cnt > 0 ? String(cnt) : 'AD';
        }

        this.renderActivePixelArt();
    }

    public setProgress(ratio: number): void {
        const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
        if (this._progressLabel) {
            this._progressLabel.string = `${pct}%`;
        }
    }

    public showToast(msg: string): void {
        if (!this._toastNode || !this._toastLabel || !this._toastOp) return;
        this._toastLabel.string = msg;
        this._toastNode.active = true;
        this._toastOp.opacity = 255;
        tween(this._toastOp)
            .stop()
            .delay(1.3)
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
        if (this._countryBtnLbl) {
            this._countryBtnLbl.string = `COUNTRY: ${DataManager.ins.playerCountry}`;
        }
        if (this._noAdsStatusLbl) {
            this._noAdsStatusLbl.string = DataManager.ins.noAdsPurchased
                ? 'Interstitial Ads: Removed (VIP)'
                : 'Interstitial Ads: Active';
        }
    }
}
