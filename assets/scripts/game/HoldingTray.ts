import { _decorator, Color, Component, Graphics, Node, Sprite, UITransform, Vec3 } from 'cc';
import { SCREW_FALLBACK_COLORS } from '../core/GameTypes';
import { ThemeManager } from '../core/ThemeManager';

const { ccclass } = _decorator;

@ccclass('HoldingTray')
export class HoldingTray extends Component {
    public readonly totalSlots = 7;
    public screwNumMax = 5;
    public screwArr: number[] = [0, 0, 0, 0, 0, 0, 0];

    private _slotNodes: Node[] = [];
    private _screwNodes: Node[] = [];

    public build(_onLockClick?: () => void): void {
        this.node.removeAllChildren();
        this._slotNodes = [];
        this._screwNodes = [];
        this.screwNumMax = 5;
        this.screwArr = [0, 0, 0, 0, 0, 0, 0];

        const holeSf = ThemeManager.ins.getHoleSprite();

        for (let i = 0; i < this.totalSlots; i++) {
            const slot = new Node(`hole_${i}`);
            slot.setParent(this.node);
            const sUi = slot.addComponent(UITransform);
            sUi.setContentSize(58, 58);

            if (holeSf) {
                const bg = slot.addComponent(Sprite);
                bg.sizeMode = Sprite.SizeMode.CUSTOM;
                bg.spriteFrame = holeSf;
            } else {
                const g = slot.addComponent(Graphics);
                g.fillColor = new Color(185, 190, 196, 255);
                g.circle(0, 0, 24);
                g.fill();
            }

            // Screw sprite child (stored directly in _screwNodes so renaming to color_part never breaks lookup)
            const screwChild = new Node('screw');
            screwChild.setParent(slot);
            screwChild.setPosition(0, 0, 0);
            const scUi = screwChild.addComponent(UITransform);
            scUi.setContentSize(54, 54);
            const scSp = screwChild.addComponent(Sprite);
            scSp.sizeMode = Sprite.SizeMode.CUSTOM;
            screwChild.active = false;

            slot.active = i < this.screwNumMax;
            this._slotNodes.push(slot);
            this._screwNodes.push(screwChild);
        }

        this.layoutSlots();
    }

    private layoutSlots(): void {
        const visible = this.screwNumMax;
        const spacing = visible <= 5 ? 74 : (visible === 6 ? 68 : 64);
        const startX = -((visible - 1) * spacing) / 2;
        for (let i = 0; i < this._slotNodes.length; i++) {
            const slot = this._slotNodes[i];
            slot.active = i < visible;
            if (slot.active) {
                slot.setPosition(startX + i * spacing, 0, 0);
            }
        }
    }

    public isActive(): boolean {
        for (let i = 0; i < this.screwNumMax; i++) {
            if (this.screwArr[i] === 0) return true;
        }
        return false;
    }

    public pushScrew(colorId: number): number {
        for (let i = 0; i < this.screwNumMax; i++) {
            if (this.screwArr[i] === 0) {
                this.screwArr[i] = colorId;
                return i;
            }
        }
        return -1;
    }

    public addScrew(colorId: number, screwNode: Node, partIndex: number): void {
        screwNode.setScale(Vec3.ONE);
        const sp = screwNode.getComponent(Sprite);
        if (sp) {
            const sf = ThemeManager.ins.getScrewSprite(colorId);
            if (sf) {
                sp.spriteFrame = sf;
                sp.color = Color.WHITE.clone();
            } else {
                sp.color = new Color().fromHEX(SCREW_FALLBACK_COLORS[colorId] || '#ffffff');
            }
        }
        screwNode.name = `${colorId}_${partIndex}`;
        screwNode.active = true;
    }

    public refreshTheme(): void {
        const holeSf = ThemeManager.ins.getHoleSprite();
        for (let i = 0; i < this._slotNodes.length; i++) {
            const bgSp = this._slotNodes[i].getComponent(Sprite);
            if (bgSp && holeSf) {
                bgSp.spriteFrame = holeSf;
            }
            const colId = this.screwArr[i];
            const sNode = this._screwNodes[i];
            if (colId > 0 && sNode && sNode.active) {
                const sp = sNode.getComponent(Sprite);
                const sf = ThemeManager.ins.getScrewSprite(colId);
                if (sp && sf) {
                    sp.spriteFrame = sf;
                    sp.color = Color.WHITE.clone();
                }
            }
        }
    }

    public clearAllPending(): void {
        for (let i = 0; i < this.screwNumMax; i++) {
            if (this.screwArr[i] > 0) {
                this.screwArr[i] = -1;
            }
        }
    }

    public resetSingleTarget(screwNode: Node): void {
        screwNode.active = false;
        const slotIdx = this._screwNodes.indexOf(screwNode);
        if (slotIdx >= 0) {
            this.screwArr[slotIdx] = 0;
        }
    }

    public clearOne(screwNode: Node): void {
        const idx = this._screwNodes.indexOf(screwNode);
        if (idx >= 0) {
            this.screwArr[idx] = 0;
        }
        screwNode.active = false;
    }

    public getScrewCurrent(): Node | null {
        const idx = this.screwArr.findIndex((v, i) => i < this.screwNumMax && v === 0);
        if (idx >= 0 && this._screwNodes[idx]) {
            return this._screwNodes[idx];
        }
        return null;
    }

    public canUnlockSlot(): boolean {
        return this.screwNumMax < this.totalSlots;
    }

    public unlockOneSlot(): Node | null {
        if (this.screwNumMax >= this.totalSlots) return null;
        const newSlot = this._slotNodes[this.screwNumMax];
        this.screwNumMax += 1;
        this.layoutSlots();
        return newSlot;
    }

    public getScrews(): Node[] {
        const res: Node[] = [];
        for (let i = 0; i < this.screwNumMax; i++) {
            const s = this._screwNodes[i];
            if (s && s.active && s.scale.x >= 0.99) {
                res.push(s);
            }
        }
        return res;
    }

    public getScrewColors(): number[] {
        const res: number[] = [];
        for (let i = 0; i < this.screwNumMax; i++) {
            const s = this._screwNodes[i];
            if (s && s.active && this.screwArr[i] > 0) {
                res.push(this.screwArr[i]);
            }
        }
        return res;
    }

    public getScrewColorsAndParts(): [number, number][] {
        const res: [number, number][] = [];
        for (let i = 0; i < this.screwNumMax; i++) {
            const s = this._screwNodes[i];
            if (s && s.active && this.screwArr[i] > 0) {
                const part = Number(s.name.split('_')[1] || 0);
                res.push([this.screwArr[i], part]);
            }
        }
        return res;
    }

    public checkNearFull(): number {
        let empty = 0;
        for (let i = 0; i < this.screwNumMax; i++) {
            if (this.screwArr[i] <= 0) empty++;
        }
        return empty;
    }

    public checkFull(): boolean {
        for (let i = 0; i < this.screwNumMax; i++) {
            if (this.screwArr[i] <= 0) return false;
            const s = this._screwNodes[i];
            if (!s || !s.active) return false;
        }
        return true;
    }
}
