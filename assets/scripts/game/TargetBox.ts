import { _decorator, Color, Component, Label, Node, Sprite, tween, UITransform, Vec3 } from 'cc';
import { ResManager } from '../core/ResManager';
import { SCREW_FALLBACK_COLORS } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('TargetBox')
export class TargetBox extends Component {
    public colorId = 0;
    public nextIndex = -1;
    public screwNum = 0;
    public readonly screwNumMax = 3;
    public dataAfterAni: [number, [number, number][]] | null = null;
    public screwList: Node[] = [];

    private _bodySprite: Sprite | null = null;
    private _coverNode: Node | null = null;
    private _coverSprite: Sprite | null = null;
    private _lockNode: Node | null = null;
    private _screwsRoot: Node | null = null;
    private _orgAngle = 0;
    private _onLockClick: ((box: TargetBox) => void) | null = null;

    public build(onLockClick: (box: TargetBox) => void): void {
        this._onLockClick = onLockClick;
        this._orgAngle = this.node.angle;

        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(156, 204);

        this._bodySprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        this._bodySprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 3 screw slots inside the box (triangle layout matching gbz_box1..10 holes)
        this._screwsRoot = new Node('screws');
        this._screwsRoot.setParent(this.node);
        this._screwsRoot.setPosition(0, 0, 0);
        this.screwList = [];
        const slotPositions: [number, number][] = [
            [0, 14],
            [-35, -34],
            [35, -34],
        ];
        for (let i = 0; i < this.screwNumMax; i++) {
            const sNode = new Node(`slot_${i}`);
            sNode.setParent(this._screwsRoot);
            sNode.setPosition(slotPositions[i][0], slotPositions[i][1], 0);
            const sUi = sNode.addComponent(UITransform);
            sUi.setContentSize(42, 42);
            const sSp = sNode.addComponent(Sprite);
            sSp.sizeMode = Sprite.SizeMode.CUSTOM;
            sNode.active = false;
            this.screwList.push(sNode);
        }

        // Cover lid (original gbz_cover is 260x282 -> 156x169 at box width 156)
        this._coverNode = new Node('cover');
        this._coverNode.setParent(this.node);
        this._coverNode.setPosition(0, 22, 0);
        const cUi = this._coverNode.addComponent(UITransform);
        cUi.setContentSize(156, 169);
        this._coverSprite = this._coverNode.addComponent(Sprite);
        this._coverSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._coverNode.active = false;

        // Lock overlay (for locked boxes)
        this._lockNode = new Node('lock');
        this._lockNode.setParent(this.node);
        this._lockNode.setPosition(0, 0, 0);
        const lUi = this._lockNode.addComponent(UITransform);
        lUi.setContentSize(156, 204);
        const lSp = this._lockNode.addComponent(Sprite);
        lSp.sizeMode = Sprite.SizeMode.CUSTOM;
        const lockedSf = ResManager.ins.getUiSprite('解锁盒子') || ResManager.ins.getGameSprite('gbz_box0');
        if (lockedSf) {
            lSp.spriteFrame = lockedSf;
            lSp.color = Color.WHITE.clone();
        } else {
            lSp.color = new Color(90, 96, 115, 220);
            const badge = new Node('lockLabel');
            badge.setParent(this._lockNode);
            badge.setPosition(0, 0, 0);
            const bUi = badge.addComponent(UITransform);
            bUi.setContentSize(130, 50);
            const lbl = badge.addComponent(Label);
            lbl.string = '解锁盒';
            lbl.fontSize = 26;
            lbl.lineHeight = 32;
            lbl.color = Color.WHITE.clone();
        }

        this._lockNode.on(Node.EventType.TOUCH_END, () => {
            if (this._onLockClick) {
                this._onLockClick(this);
            }
        }, this);
        this._lockNode.active = false;
    }

    public refresh(colorId: number): void {
        this.colorId = colorId;
        if (this._bodySprite) {
            const boxSf = ResManager.ins.getGameSprite(`gbz_box${colorId}`);
            if (boxSf) {
                this._bodySprite.spriteFrame = boxSf;
                this._bodySprite.color = Color.WHITE.clone();
            } else {
                this._bodySprite.color = new Color().fromHEX(SCREW_FALLBACK_COLORS[colorId] || '#cccccc');
            }
        }
        const screwSf = ResManager.ins.getGameSprite(`gbz_screw${colorId}`);
        for (let i = 0; i < this.screwList.length; i++) {
            const sNode = this.screwList[i];
            const sp = sNode.getComponent(Sprite);
            if (sp && screwSf) {
                sp.spriteFrame = screwSf;
                sp.color = Color.WHITE.clone();
            }
            sNode.active = i < this.screwNum;
        }
        if (this._coverSprite) {
            const covSf = ResManager.ins.getGameSprite(`gbz_cover${colorId}`);
            if (covSf) {
                this._coverSprite.spriteFrame = covSf;
                this._coverSprite.color = Color.WHITE.clone();
            }
        }
        if (this._coverNode) {
            this._coverNode.active = false;
        }
    }

    public setLock(locked: boolean): void {
        if (this._lockNode) {
            this._lockNode.active = locked;
        }
    }

    public isLock(): boolean {
        return Boolean(this._lockNode && this._lockNode.active);
    }

    public unlock(): void {
        if (this._lockNode) {
            this._lockNode.active = false;
        }
    }

    public isActive(): boolean {
        if (!this.node.active || this.isLock() || this.screwNum >= this.screwNumMax) {
            return false;
        }
        return true;
    }

    public addScrewNum(): void {
        this.screwNum += 1;
    }

    public setScrewNum(n: number): void {
        this.screwNum = n;
    }

    public checkFull(): boolean {
        if (this.screwNum < this.screwNumMax) return false;
        return this.screwList.every((n) => n.active);
    }

    public checkWillFull(): boolean {
        return this.screwNum >= this.screwNumMax;
    }

    public getScrewCurrent(): Node | null {
        if (this.screwNum < 0 || this.screwNum >= this.screwList.length) return null;
        return this.screwList[this.screwNum];
    }

    public playCoverAni(onComplete?: () => void): void {
        const cover = this._coverNode;
        if (!cover) {
            if (onComplete) onComplete();
            return;
        }
        cover.setPosition(0, 260, 0);
        cover.active = true;
        const sx = this.node.scale.x;
        const sy = this.node.scale.y;
        const startPos = this.node.position.clone();

        tween(cover)
            .to(0.15, { position: new Vec3(0, 22, 0) })
            .call(() => {
                tween(this.node)
                    .to(0.08, { scale: new Vec3(sx * 1.2, sy * 0.7, 1) })
                    .to(0.12, { scale: new Vec3(sx * 0.82, sy * 1.1, 1) })
                    .to(0.12, { scale: new Vec3(sx, sy, 1) })
                    .to(0.25, { position: new Vec3(startPos.x, startPos.y + 300, 0) }, { easing: 'cubicOut' })
                    .call(() => {
                        if (onComplete) onComplete();
                    })
                    .start();
            })
            .start();
    }

    public resetAngle(): void {
        this.node.angle = this._orgAngle;
    }
}
