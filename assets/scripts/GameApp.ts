import { _decorator, Color, Component, Graphics, Node, PhysicsSystem2D, Sprite, UITransform, Widget } from 'cc';
import { GameStatus, SkillType } from './core/GameTypes';
import { DataManager } from './core/DataManager';
import { AudioManager } from './core/AudioManager';
import { ResManager } from './core/ResManager';
import { MonetizationManager } from './core/MonetizationManager';
import { LevelController } from './game/LevelController';
import { UIManager } from './ui/UIManager';

const { ccclass } = _decorator;

@ccclass('GameApp')
export class GameApp extends Component {
    private _levelCtrl: LevelController | null = null;
    private _uiMgr: UIManager | null = null;

    protected async start(): Promise<void> {
        AudioManager.ins.init(this.node);
        await Promise.all([
            ResManager.ins.loadCoreAssets(),
            AudioManager.ins.loadAll(),
        ]);

        const rootUi = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootUi.setContentSize(750, 1334);
        const rootW = this.node.getComponent(Widget) || this.node.addComponent(Widget);
        rootW.isAlignTop = rootW.isAlignBottom = rootW.isAlignLeft = rootW.isAlignRight = true;
        rootW.top = rootW.bottom = rootW.left = rootW.right = 0;
        rootW.updateAlignment();

        // 1. Studio playfield background
        const bgNode = new Node('Backdrop');
        bgNode.setParent(this.node);
        const bgUi = bgNode.addComponent(UITransform);
        bgUi.setContentSize(750, 1334);
        const bgW = bgNode.addComponent(Widget);
        bgW.isAlignTop = bgW.isAlignBottom = bgW.isAlignLeft = bgW.isAlignRight = true;
        bgW.top = bgW.bottom = bgW.left = bgW.right = 0;
        const bgSf = ResManager.ins.getUiSprite('bg_game_poly');
        if (bgSf) {
            const bgSp = bgNode.addComponent(Sprite);
            bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
            bgSp.spriteFrame = bgSf;
        } else {
            const g = bgNode.addComponent(Graphics);
            g.fillColor = new Color().fromHEX('#9bd0f5');
            g.rect(-375, -667, 750, 1334);
            g.fill();
        }

        // 2. Top white header deck
        const topPanel = new Node('root_bg');
        topPanel.setParent(this.node);
        const tpUi = topPanel.addComponent(UITransform);
        tpUi.setContentSize(750, 420);
        const tpW = topPanel.addComponent(Widget);
        tpW.isAlignTop = true;
        tpW.isAlignLeft = true;
        tpW.isAlignRight = true;
        tpW.top = -30;
        tpW.left = 0;
        tpW.right = 0;
        const frameSf = ResManager.ins.getGameSprite('frame');
        if (frameSf) {
            const sp = topPanel.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = frameSf;
        } else {
            const g = topPanel.addComponent(Graphics);
            g.fillColor = Color.WHITE.clone();
            g.rect(-375, -210, 750, 420);
            g.fill();
        }

        // 3. Stage / LevelController
        const stageNode = new Node('Stage');
        stageNode.setParent(this.node);
        this._levelCtrl = stageNode.addComponent(LevelController);
        this._levelCtrl.setupContainers({
            onProgressChanged: (p) => this._uiMgr?.setProgress(p),
            onWin: () => this._uiMgr?.showWin(),
            onLoseFull: () => this._uiMgr?.showLose(),
            onToast: (m) => this._uiMgr?.showToast(m),
            onCoinsChanged: () => this._uiMgr?.refreshHeader(),
            onSmashModeChanged: (active) => this._uiMgr?.setSmashMode(active),
            getCollectBoxNode: () => this._uiMgr?.collectBoxNode || null,
        });

        // 4. Clean Original UI + Rewarded Ads
        const uiNode = new Node('UI');
        uiNode.setParent(this.node);
        this._uiMgr = uiNode.addComponent(UIManager);
        MonetizationManager.ins.setToastCallback((m) => this._uiMgr?.showToast(m));

        this._uiMgr.build({
            onStartGame: (lv) => this.startLevel(lv),
            onRestart: () => {
                MonetizationManager.ins.maybeShowInterstitial('level_retry');
                this.startLevel(DataManager.ins.level);
            },
            onBackMenu: () => this.backToMenu(),
            onNextLevel: () => {
                MonetizationManager.ins.maybeShowInterstitial('level_win');
                DataManager.ins.advanceLevel();
                this.startLevel(DataManager.ins.level);
            },
            onRevive: () => {
                this._levelCtrl?.revive();
            },
            onUseSkill: (skill: SkillType) => {
                this._levelCtrl?.useSkill(skill);
            },
        });

        (globalThis as any).__SCREW_OUT__ = {
            ready: true,
            startLevel: (lv: number) => this.startLevel(lv),
            getBestMove: () => this._levelCtrl?.getBestLegalScrewNormalized() || null,
            getState: () => this._levelCtrl?.getDebugState() || { status: DataManager.ins.status },
        };
    }

    private async startLevel(levelNumber: number): Promise<void> {
        DataManager.ins.level = levelNumber;
        DataManager.ins.save();
        this._uiMgr?.showGameHUD(levelNumber);
        await this._levelCtrl?.startLevel(levelNumber);
    }

    private backToMenu(): void {
        PhysicsSystem2D.instance.enable = false;
        DataManager.ins.status = GameStatus.MENU;
        this._uiMgr?.showMenu();
    }
}
