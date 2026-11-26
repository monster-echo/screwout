import { _decorator, Component, HingeJoint2D, Node, UITransform, Vec2, view } from 'cc';
import { ScrewNode } from './ScrewNode';

const { ccclass } = _decorator;

export type BoardDestroyCallback = (boardNode: Node) => void;

@ccclass('BoardNode')
export class BoardNode extends Component {
    public screws: ScrewNode[] = [];
    public screwsColor: [number, number][] = [];
    public rootBoardsIndex = 0;
    public isReady = true;
    public notActive = true;
    public polygonPoints: Vec2[] = [];
    public onFallDestroy: BoardDestroyCallback | null = null;

    public getJoints(): HingeJoint2D[] {
        return this.node.getComponents(HingeJoint2D);
    }

    public pushScrew(screw: ScrewNode): void {
        this.screws.push(screw);
        screw.setBoard(this.node);
    }

    public getScrews(): ScrewNode[] {
        return this.screws;
    }

    public spliceScrew(screwNode: Node): void {
        const idx = this.screws.findIndex((s) => s.node === screwNode);
        if (idx >= 0) {
            this.screws.splice(idx, 1);
        }
        const comp = screwNode.getComponent(ScrewNode);
        if (comp) {
            comp.setBoard(null);
        }
    }

    public saveScrewColor(colorInfo: [number, number]): void {
        this.screwsColor.push(colorInfo);
    }

    protected update(): void {
        if (!this.isReady) return;
        const ui = this.node.getComponent(UITransform);
        const maxDim = ui ? Math.max(ui.width, ui.height) : 200;
        const visH = view.getVisibleSize().height;
        if (this.node.position.y <= -(visH / 2 + maxDim / 2 + 120)) {
            this.isReady = false;
            if (this.onFallDestroy) {
                this.onFallDestroy(this.node);
            }
        }
    }
}
