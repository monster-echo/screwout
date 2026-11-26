import { _decorator, Color, Component, HingeJoint2D, Node, Sprite, UITransform } from 'cc';
import { ThemeManager } from '../core/ThemeManager';
import { SCREW_FALLBACK_COLORS } from '../core/GameTypes';

const { ccclass } = _decorator;

@ccclass('ScrewNode')
export class ScrewNode extends Component {
    public colorId = -1;
    public partIndex = -1;
    public layerGroup = 0;
    public joint: HingeJoint2D | null = null;
    public mainBoard: Node | null = null;

    public init(colorInfo: [number, number], layerGroup: number, joint: HingeJoint2D | null): void {
        this.colorId = colorInfo[0];
        this.partIndex = colorInfo[1];
        this.layerGroup = layerGroup;
        this.joint = joint;

        this.applyThemeSprite();
        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(56, 56);
        this.node.name = this.colorId.toString();
    }

    public applyThemeSprite(): void {
        if (this.colorId < 0) return;
        const sp = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        const sf = ThemeManager.ins.getScrewSprite(this.colorId);
        if (sf) {
            sp.spriteFrame = sf;
            sp.color = Color.WHITE.clone();
        } else {
            sp.color = new Color().fromHEX(SCREW_FALLBACK_COLORS[this.colorId] || '#ffffff');
        }
    }

    public setBoard(board: Node | null): void {
        this.mainBoard = board;
    }
}
