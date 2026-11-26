import { _decorator, BlockInputEvents, Component, Label, Node, Sprite, tween, UIOpacity, UITransform, Vec3, Widget } from 'cc';
import { AudioClips, SkillType } from '../core/GameTypes';
import { DataManager } from '../core/DataManager';
import { AudioManager } from '../core/AudioManager';
import { ResManager } from '../core/ResManager';
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

    // In-game HUD (matches GbzMainLayer.prefab)
    private _hudNode: Node | null = null;
    private _levelLabel: Label | null = null;
    private _progressLabel: Label | null = null;
    private _collectBoxNode: Node | null = null;
    private _smashBanner: Node | null = null;

    public get collectBoxNode(): Node | null {
        return this._collectBoxNode;
    }

    // Home Menu (matches GbzMenuLayer.prefab)
    private _menuNode: Node | null = null;
    private _menuProgressFill: Node | null = null;
    private _menuProgressLbl: Label | null = null;

    // Popups (match GbzExitLayer / GbzWinLayer / GbzLoseFullLayer / GbzSettingLayer)
    private _pauseNode: Node | null = null;
    private _winNode: Node | null = null;
    private _loseNode: Node | null = null;
    private _settingsNode: Node | null = null;
    private _soundSprite: Sprite | null = null;

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

    /** Create a Sprite node scaled uniformly to fit within (maxW, maxH) without any aspect-ratio distortion. */
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

    /**
     * Original GbzMainLayer layout (matches Screenshot 2):
     * - Top-left: blue circular pause button (btn_pause)
     * - Top-center: dark capsule level pill (倒计时关数框) with "第N关"
     * - Upper-right below white bar: cardboard box (xzx) + "进度0%"
     * - Bottom: 3 blue 3D skill buttons (加孔位, 清空孔位, 融玻璃) with green "+" badge
     */
    private buildHUD(): void {
        this._hudNode = new Node('GbzMainLayer');
        this._hudNode.setParent(this.node);
        const hUi = this._hudNode.addComponent(UITransform);
        hUi.setContentSize(750, 1334);
        const hW = this._hudNode.addComponent(Widget);
        hW.isAlignTop = hW.isAlignBottom = hW.isAlignLeft = hW.isAlignRight = true;
        hW.top = hW.bottom = hW.left = hW.right = 0;

        // Top-left Pause button (pinned to top-left)
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

        // Top-center dark capsule "第N关" (pinned to top-center)
        const lvPill = this.makeSpriteFit('lv_pill', this._hudNode, '倒计时关数框', 228, 44);
        const lW = lvPill.addComponent(Widget);
        lW.isAlignTop = true;
        lW.isAlignHorizontalCenter = true;
        lW.top = 35;
        this._levelLabel = createLabel('lv_label', lvPill, '第1关', 26, '#ffffff', 200, 38);

        // Right-side cardboard box progress indicator (below white header)
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
        this._progressLabel = createLabel('prog_lbl', boxProg, '进度0%', 24, '#111827', 120, 34);
        this._progressLabel.node.setPosition(0, -34, 0);

        // Smash-board active banner (融玻璃)
        this._smashBanner = createPanel('SmashBanner', this._hudNode, 420, 52, '#ef4444', 235, 26);
        this._smashBanner.setPosition(0, 232, 0);
        createLabel('SmashTxt', this._smashBanner, '请选择你要融化的挡板', 24, '#ffffff', 400, 40);
        this._smashBanner.active = false;

        // Bottom 3 original blue 3D skill buttons — exact GbzMainLayer.prefab 1:1 proportions
        // Each button is 281x207 at x = -401, 0, +401 inside `skills` scaled uniformly by 0.58 (zero distortion!)
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
            txtSprite: string;
            iconSprite: string;
            iconScale: number;
            x: number;
        }[] = [
            { name: 'btn_skill_core', type: SkillType.UNLOCK_SLOT, txtSprite: 'skill_txt_add', iconSprite: 'gbz_screw_core', iconScale: 1.75, x: -401 },
            { name: 'btn_skill_screw', type: SkillType.CLEAR_TRAY, txtSprite: 'skill_txt_clear', iconSprite: 'UI_icon3', iconScale: 0.5, x: 0 },
            { name: 'btn_skill_board', type: SkillType.SMASH_BOARD, txtSprite: 'skill_txt_melt', iconSprite: 'UI_icon2', iconScale: 0.5, x: 401 },
        ];

        for (const cfg of skillConfigs) {
            const btn = this.makeSpriteNode(cfg.name, skillBar, 'skill_btn_bg', 281, 207);
            btn.setPosition(cfg.x, 0, 0);

            const iconSf = ResManager.ins.getUiSprite(cfg.iconSprite) || ResManager.ins.getGameSprite(cfg.iconSprite);
            const iw = iconSf ? iconSf.originalSize.width : 120;
            const ih = iconSf ? iconSf.originalSize.height : 120;
            const icon = this.makeSpriteNode('icon', btn, cfg.iconSprite, iw, ih);
            icon.setScale(cfg.iconScale, cfg.iconScale, 1);
            icon.setPosition(0, 26, 0);
            if (cfg.type === SkillType.UNLOCK_SLOT) {
                createLabel('plus1', icon, '+1', 26, '#ffffff', 54, 34);
            }

            const txtSf = ResManager.ins.getUiSprite(cfg.txtSprite);
            const tw = txtSf ? txtSf.originalSize.width : 170;
            const th = txtSf ? txtSf.originalSize.height : 68;
            const txt = this.makeSpriteNode('txt', btn, cfg.txtSprite, tw, th);
            txt.setPosition(0, -60, 0);

            const plusSf = ResManager.ins.getUiSprite('skill_plus');
            const pw = plusSf ? plusSf.originalSize.width : 88;
            const ph = plusSf ? plusSf.originalSize.height : 88;
            const plus = this.makeSpriteNode('plus', btn, 'skill_plus', pw, ph);
            plus.setPosition(125, 86, 0);

            this.bindTap(btn, () => {
                AudioManager.ins.play(AudioClips.GAME_CLICK);
                this._actions?.onUseSkill(cfg.type);
            });
        }
    }

    /**
     * Original GbzMenuLayer layout (matches Screenshot 1):
     * - Background: sky-blue hexagon/circle pattern (bg_menu_hex)
     * - Top-left: blue circular settings gear (UI_icon_setting)
     * - Upper-center: wooden picture frame (UI_db5_2) + yellow progress bar (UI_jdt_1 / UI_jdt_2)
     * - Bottom-center: yellow rounded "开始游戏" button (按键1)
     */
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

        // Top-left settings button
        const setBtn = this.makeSpriteNode('btn_setting', this._menuNode, 'UI_icon_setting', 86, 86);
        setBtn.setPosition(-310, 598, 0);
        this.bindTap(setBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this.openSettings();
        });

        // Wooden frame centerpiece (cropped directly from 1f1c8518d.png)
        const woodFrame = this.makeSpriteNode('wood_frame', this._menuNode, 'wood_frame', 520, 520);
        woodFrame.setPosition(0, 290, 0);

        // Show decorative screw pattern inside wooden frame
        const showcase = new Node('showcase');
        showcase.setParent(woodFrame);
        const demoCoords: [number, number, number][] = [
            [-95, 75, 1], [0, 115, 2], [95, 75, 3],
            [-125, -15, 4], [0, 10, 5], [125, -15, 6],
            [-80, -105, 7], [80, -105, 8],
        ];
        for (const [x, y, c] of demoCoords) {
            const s = this.makeSpriteNode(`s_${c}`, showcase, `gbz_screw${c}`, 64, 64);
            s.setPosition(x, y, 0);
        }

        // Original yellow progress bar below wood frame (UI_jdt_1 + UI_jdt_2)
        const barTrack = this.makeSpriteNode('jdt_track', this._menuNode, 'UI_jdt_1', 490, 40);
        barTrack.setPosition(0, -10, 0);
        this._menuProgressFill = this.makeSpriteNode('jdt_fill', barTrack, 'UI_jdt_2', 490, 40);
        this._menuProgressFill.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
        this._menuProgressFill.setPosition(-245, 0, 0);
        this._menuProgressLbl = createLabel('jdt_lbl', barTrack, '当前进度：第 1 关', 24, '#ffffff', 360, 36);

        // Bottom-center original yellow "开始游戏" button (按键1)
        const startBtn = this.makeSpriteNode('btn_start', this._menuNode, '按键1', 380, 126);
        startBtn.setPosition(0, -510, 0);
        createLabel('start_lbl', startBtn, '开始游戏', 44, '#ffffff', 320, 64);
        this.bindTap(startBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onStartGame(DataManager.ins.level);
        });
    }

    /** Original GbzExitLayer (Pause dialog) */
    private buildPausePopup(): void {
        this._pauseNode = createPanel('GbzExitLayer', this.node, 750, 1334, '#000000', 150, 0, true);
        const card = this.makeSpriteNode('panel', this._pauseNode, 'UI_db2', 500, 560);

        const closeBtn = this.makeSpriteNode('btn_close', card, 'btn_close', 58, 60);
        closeBtn.setPosition(215, 240, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
        });

        const title = createLabel('title', card, '暂停', 42, '#334155', 240, 54);
        title.node.setPosition(0, 190, 0);

        const contBtn = createButton('btn_continue', card, '继续游戏', 310, 76, '#22c55e', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
        }, 30, '#ffffff', 22);
        contBtn.setPosition(0, 60, 0);

        const restartBtn = createButton('btn_restart', card, '重新开始', 310, 76, '#f59e0b', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
            this._actions?.onRestart();
        }, 30, '#ffffff', 22);
        restartBtn.setPosition(0, -45, 0);

        const homeBtn = createButton('btn_home', card, '返回首页', 310, 76, '#0ea5e9', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._pauseNode) this._pauseNode.active = false;
            this._actions?.onBackMenu();
        }, 30, '#ffffff', 22);
        homeBtn.setPosition(0, -150, 0);

        this._pauseNode.active = false;
    }

    /** Original GbzWinLayer */
    private buildWinPopup(): void {
        this._winNode = createPanel('GbzWinLayer', this.node, 750, 1334, '#000000', 170, 0, true);

        const banner = this.makeSpriteNode('win_banner', this._winNode, '胜利', 620, 226);
        banner.setPosition(0, 240, 0);

        const nextBtn = this.makeSpriteNode('btn_next', this._winNode, '继续下一关', 380, 128);
        nextBtn.setPosition(0, -110, 0);
        this.bindTap(nextBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onNextLevel();
        });

        const homeBtn = createButton('btn_home', this._winNode, '返回首页', 240, 66, '#64748b', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            this._actions?.onBackMenu();
        }, 26, '#ffffff', 20);
        homeBtn.setPosition(0, -240, 0);

        this._winNode.active = false;
    }

    /** Original GbzLoseFullLayer */
    private buildLosePopup(): void {
        this._loseNode = createPanel('GbzLoseFullLayer', this.node, 750, 1334, '#000000', 170, 0, true);

        const banner = this.makeSpriteNode('lose_banner', this._loseNode, '失败', 620, 224);
        banner.setPosition(0, 310, 0);

        const art = this.makeSpriteNode('lose_art', this._loseNode, '复活图1', 360, 334);
        art.setPosition(0, 30, 0);

        const reviveBtn = this.makeSpriteNode('btn_revive', this._loseNode, '复活3', 380, 128);
        reviveBtn.setPosition(0, -210, 0);
        this.bindTap(reviveBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._loseNode) this._loseNode.active = false;
            this._actions?.onRevive();
        });

        const retryBtn = createButton('btn_retry', this._loseNode, '重新挑战', 260, 66, '#f59e0b', () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._loseNode) this._loseNode.active = false;
            this._actions?.onRestart();
        }, 26, '#ffffff', 20);
        retryBtn.setPosition(0, -330, 0);

        this._loseNode.active = false;
    }

    /** Original GbzSettingLayer */
    private buildSettingsPopup(): void {
        this._settingsNode = createPanel('GbzSettingLayer', this.node, 750, 1334, '#000000', 160, 0, true);
        const card = this.makeSpriteNode('panel', this._settingsNode, 'UI_db2', 500, 440);

        const closeBtn = this.makeSpriteNode('btn_close', card, 'btn_close', 58, 60);
        closeBtn.setPosition(215, 180, 0);
        this.bindTap(closeBtn, () => {
            AudioManager.ins.play(AudioClips.GAME_CLICK);
            if (this._settingsNode) this._settingsNode.active = false;
        });

        const title = this.makeSpriteNode('title', card, 'sz', 138, 71);
        title.setPosition(0, 145, 0);

        const sndLbl = createLabel('snd_lbl', card, '音效', 34, '#334155', 120, 48);
        sndLbl.node.setPosition(-90, 20, 0);

        const toggleNode = this.makeSpriteNode('btn_sound', card, '开', 160, 72);
        toggleNode.setPosition(70, 20, 0);
        this._soundSprite = toggleNode.getComponent(Sprite);
        this.bindTap(toggleNode, () => {
            DataManager.ins.soundEnabled = !DataManager.ins.soundEnabled;
            DataManager.ins.save();
            this.refreshSettingsLabels();
            if (DataManager.ins.soundEnabled) AudioManager.ins.play(AudioClips.GAME_CLICK);
        });

        this._settingsNode.active = false;
    }

    private buildToast(): void {
        this._toastNode = createPanel('Toast', this.node, 440, 62, '#1e293b', 230, 31);
        this._toastNode.setPosition(0, 130, 0);
        this._toastOp = this._toastNode.addComponent(UIOpacity);
        this._toastOp.opacity = 0;
        this._toastLabel = createLabel('ToastLbl', this._toastNode, '', 24, '#ffffff', 410, 44);
        this._toastNode.active = false;
    }

    // ==================== Public UI Controls ====================

    public showMenu(): void {
        this.hidePopups();
        if (this._hudNode) this._hudNode.active = false;
        if (this._menuNode) this._menuNode.active = true;
        this.refreshHeader();
    }

    public showGameHUD(): void {
        this.hidePopups();
        if (this._menuNode) this._menuNode.active = false;
        if (this._hudNode) this._hudNode.active = true;
        this.setSmashMode(false);
        this.refreshHeader();
        this.setProgress(0);
    }

    public showWin(): void {
        this.hidePopups();
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

    public hidePopups(): void {
        if (this._pauseNode) this._pauseNode.active = false;
        if (this._winNode) this._winNode.active = false;
        if (this._loseNode) this._loseNode.active = false;
        if (this._settingsNode) this._settingsNode.active = false;
    }

    public setSmashMode(active: boolean): void {
        if (this._smashBanner) this._smashBanner.active = active;
    }

    public refreshHeader(): void {
        const lv = DataManager.ins.level;
        if (this._levelLabel) this._levelLabel.string = `第${lv}关`;
        if (this._menuProgressLbl) {
            const pct = Math.min(100, Math.round((lv / 101) * 100));
            this._menuProgressLbl.string = `第 ${lv} 关 · 完成度: ${pct}%`;
        }
        if (this._menuProgressFill) {
            const ratio = Math.max(0.08, Math.min(1, lv / 101));
            this._menuProgressFill.setScale(ratio, 1, 1);
        }
    }

    public setProgress(ratio: number): void {
        const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
        if (this._progressLabel) {
            this._progressLabel.string = `进度${pct}%`;
        }
    }

    public showToast(msg: string): void {
        if (!this._toastNode || !this._toastLabel || !this._toastOp) return;
        this._toastLabel.string = msg;
        this._toastNode.active = true;
        this._toastOp.opacity = 255;
        tween(this._toastOp)
            .stop()
            .delay(1.1)
            .to(0.35, { opacity: 0 })
            .call(() => {
                if (this._toastNode) this._toastNode.active = false;
            })
            .start();
    }

    private refreshSettingsLabels(): void {
        if (this._soundSprite) {
            const sf = ResManager.ins.getUiSprite(DataManager.ins.soundEnabled ? '开' : '关');
            if (sf) this._soundSprite.spriteFrame = sf;
        }
    }
}
