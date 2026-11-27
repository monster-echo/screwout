import {
    _decorator,
    Color,
    Component,
    ERigidBody2DType,
    EventTouch,
    Graphics,
    HingeJoint2D,
    Intersection2D,
    Node,
    PhysicsSystem2D,
    PolygonCollider2D,
    RigidBody2D,
    Sprite,
    tween,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
    Widget,
} from 'cc';
import {
    AudioClips,
    BoardData,
    DifficultyConfig,
    GameStatus,
    LevelData,
    SCREW_FALLBACK_COLORS,
    SkillType,
} from '../core/GameTypes';
import { DataManager } from '../core/DataManager';
import { AudioManager } from '../core/AudioManager';
import { ResManager } from '../core/ResManager';
import { MonetizationManager } from '../core/MonetizationManager';
import { ThemeManager } from '../core/ThemeManager';
import { ScrewNode } from './ScrewNode';
import { BoardNode } from './BoardNode';
import { TargetBox } from './TargetBox';
import { HoldingTray } from './HoldingTray';

const { ccclass } = _decorator;

export interface LevelEvents {
    onProgressChanged: (progress: number) => void;
    onWin: (totalScrews: number) => void;
    onLoseFull: () => void;
    onToast: (msg: string) => void;
    onCoinsChanged: () => void;
    onSmashModeChanged: (active: boolean) => void;
    getCollectBoxNode?: () => Node | null;
}

@ccclass('LevelController')
export class LevelController extends Component {
    private _events: LevelEvents | null = null;
    private _rootBoxes: Node | null = null;
    private _boxInLayer: Node | null = null;
    private _trayNode: Node | null = null;
    private _trayComp: HoldingTray | null = null;
    private _boardsContainer: Node | null = null;
    private _rootBoards: Node | null = null;
    private _fxLayer: Node | null = null;

    private _screws: Node[] = [];
    private _boards: Node[] = [];
    private _boxDataArr: number[] = [];
    private _screwColorTypeArr: number[] = [];
    private _screwRefreshArr: [number, number][] = [];
    private _screwArr: [number, number][] = [];
    private _screwArrCopy: [number, number][] = [];
    private _screwColorMap: Map<number, number> = new Map();
    private _partScrewColor: number[][] = [];
    private _allColors: string[] = [];

    private _totalScrewCount = 0;
    private _shengYuBoxCount = 0;
    private _boxNum = 0;
    private _compNum = 0;
    private _boxRandomColorNum = 6;
    private _isOver = false;
    private _inputBlocked = false;
    private _smashGrantedByAd = false;

    private readonly _maxLayerNum = 6;
    private readonly _maxScrewNum = 4;
    private readonly _maxBoxNum = 4;
    private readonly _initBoxNum = 4;
    private readonly _initUnlockNum = 2;
    private readonly _boxRootMaxWidth = 680;
    private readonly _initBoxWidth = 156;

    private _curShowLayerIndex = 0;
    private _curShowGroupSlot = 0;
    private _showByScrewCountNum = 0;
    private _nowShowBoxNum = 4;

    private readonly _colorsWeight = [100, 100, 100, 100];
    private readonly _colorsRatio = [1, 2, 3, 5];

    public setupContainers(events: LevelEvents): void {
        this._events = events;
        this.node.removeAllChildren();

        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(750, 1334);
        const stageW = this.node.getComponent(Widget) || this.node.addComponent(Widget);
        stageW.isAlignTop = stageW.isAlignBottom = stageW.isAlignLeft = stageW.isAlignRight = true;
        stageW.top = stageW.bottom = stageW.left = stageW.right = 0;
        stageW.updateAlignment();

        // 1. Boards container (aligned to original lower playfield)
        this._boardsContainer = new Node('root_boards');
        this._boardsContainer.setParent(this.node);
        this._boardsContainer.setPosition(0, -45, 0);
        const bcUi = this._boardsContainer.addComponent(UITransform);
        bcUi.setContentSize(750, 900);

        // 2. Top target boxes row (pinned to top white panel via Widget)
        this._rootBoxes = new Node('root_boxes');
        this._rootBoxes.setParent(this.node);
        const rbUi = this._rootBoxes.addComponent(UITransform);
        rbUi.setContentSize(700, 220);
        const rbW = this._rootBoxes.addComponent(Widget);
        rbW.isAlignTop = true;
        rbW.isAlignHorizontalCenter = true;
        rbW.top = 98;

        // Slide-in preview boxes layer
        this._boxInLayer = new Node('boxin');
        this._boxInLayer.setParent(this.node);
        const biUi = this._boxInLayer.addComponent(UITransform);
        biUi.setContentSize(700, 220);
        const biW = this._boxInLayer.addComponent(Widget);
        biW.isAlignTop = true;
        biW.isAlignHorizontalCenter = true;
        biW.top = 98;

        for (let i = 0; i < this._maxBoxNum; i++) {
            const boxNode = new Node(`box_${i}`);
            boxNode.setParent(this._rootBoxes);
            const boxComp = boxNode.addComponent(TargetBox);
            boxComp.build((b) => this.onBoxLockClick(b));

            const slideNode = new Node(`boxin_${i}`);
            slideNode.setParent(this._boxInLayer);
            const sUi = slideNode.addComponent(UITransform);
            sUi.setContentSize(156, 204);
            const sSp = slideNode.addComponent(Sprite);
            sSp.sizeMode = Sprite.SizeMode.CUSTOM;
            slideNode.active = false;
        }

        // 3. Holding tray row (pinned below boxes on white panel via Widget)
        this._trayNode = new Node('targets');
        this._trayNode.setParent(this.node);
        const trUi = this._trayNode.addComponent(UITransform);
        trUi.setContentSize(650, 76);
        const trW = this._trayNode.addComponent(Widget);
        trW.isAlignTop = true;
        trW.isAlignHorizontalCenter = true;
        trW.top = 304;
        this._trayComp = this._trayNode.addComponent(HoldingTray);

        // 4. Effects & flying screws layer
        this._fxLayer = new Node('fx_layer');
        this._fxLayer.setParent(this.node);
        this._fxLayer.setPosition(0, 0, 0);
        const fxUi = this._fxLayer.addComponent(UITransform);
        fxUi.setContentSize(750, 1334);

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    public async startLevel(levelNumber: number): Promise<void> {
        this.unscheduleAllCallbacks();
        PhysicsSystem2D.instance.enable = false;
        this.configureCollisionMatrix();

        DataManager.ins.resetLevelRuntime();
        MonetizationManager.ins.trackEvent('level_start', { levelNumber });

        this._isOver = false;
        this._inputBlocked = false;
        this._screws = [];
        this._boards = [];
        this._boxDataArr = [];
        this._screwRefreshArr = [];
        this._screwArr = [];
        this._screwArrCopy = [];
        this._partScrewColor = [];
        this._showByScrewCountNum = 0;

        if (this._fxLayer) this._fxLayer.removeAllChildren();
        if (this._boardsContainer) this._boardsContainer.removeAllChildren();
        if (this._trayComp) {
            this._trayComp.build(() => this.useSkill(SkillType.UNLOCK_SLOT));
        }

        // Prepare randomized board layer color cycle from active theme
        const palette = this.shuffleArray([...ThemeManager.ins.getBoardPalette()]);
        this._allColors = [...palette, ...palette, ...palette];

        const fileIdx = ((levelNumber - 1) % 101 + 101) % 101;
        const lvData = await ResManager.ins.loadLevel(fileIdx);
        if (!lvData) {
            this._events?.onToast(`Failed to load Level ${levelNumber}`);
            return;
        }

        this._totalScrewCount = lvData.totalHoles;
        if (levelNumber === 1) {
            this.initLevelOneColors(this._totalScrewCount);
        } else {
            const cfg = ResManager.ins.getDifficultyConfig(levelNumber);
            this.initLevelConfigNew(cfg, this._totalScrewCount);
        }

        this.buildBoards(lvData);
        this.initBoxes();
        this._events?.onProgressChanged(0);
    }

    private configureCollisionMatrix(): void {
        // Group bits 1..10 (LAYER_0..LAYER_9) only collide with themselves; bit 11 (SCREW) collides with nothing.
        const matrix = PhysicsSystem2D.instance.collisionMatrix;
        for (let i = 1; i <= 10; i++) {
            matrix[i] = 1 << i;
        }
        matrix[11] = 0;
    }

    private getLayerGroupBit(slot: number): number {
        // slot in 0..9 -> physics group 1 << (1 + slot)
        const idx = 1 + ((slot % 10) + 10) % 10;
        return 1 << idx;
    }

    private initLevelOneColors(totalHoles: number): void {
        this._screwColorTypeArr = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        this._screwArr = [];
        this._screwColorMap = new Map();
        this._boxDataArr = [];
        const numGroups = Math.floor(totalHoles / 3);
        for (let i = 0; i < numGroups; i++) {
            const c = this._screwColorTypeArr[i % this._screwColorTypeArr.length];
            this._screwArr.push([c, 0], [c, 0], [c, 0]);
            this._screwColorMap.set(c, (this._screwColorMap.get(c) || 0) + 3);
            this._boxDataArr.push(c);
        }
        this._shengYuBoxCount = numGroups;
        this._screwArrCopy = this._screwArr.map((x) => [x[0], x[1]]);
        this._boxRandomColorNum = Math.max(4, Math.round(this._screwArr.length * 0.1));
    }

    private initLevelConfigNew(cfg: DifficultyConfig, totalHoles: number): void {
        this._screwColorTypeArr = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        this._screwArr = [];
        this._partScrewColor = [];
        const colorMap = new Map<number, number>();
        let remaining = totalHoles;

        for (let seg = 0; seg < cfg.progress.length; seg++) {
            const segList: [number, number][] = [];
            const segColors: number[] = [];
            const colorCount = cfg.color_count[seg] || 10;
            const availColors = this._screwColorTypeArr.slice(0, colorCount);
            const segMap = new Map<number, number>();

            // Top-up any previous color not divisible by 3
            colorMap.forEach((cnt, col) => {
                const rem = cnt % 3;
                if (rem > 0) {
                    const need = 3 - rem;
                    for (let k = 0; k < need; k++) {
                        segList.push([col, seg]);
                        segColors.push(col);
                    }
                    colorMap.set(col, cnt + need);
                }
            });

            let targetCount: number;
            if (seg < cfg.progress.length - 1) {
                const prevP = seg > 0 ? cfg.progress[seg - 1] : 0;
                const delta = cfg.progress[seg] - prevP;
                targetCount = Math.floor((totalHoles * delta) / 100);
            } else {
                targetCount = remaining;
            }

            const weights = availColors.map((_, idx) => (idx < cfg.color_count[0] ? 100 : 100));
            for (let guard = 0; guard < 300 && segList.length < targetCount && availColors.length > 0; guard++) {
                const pickIdx = this.randomWeight(weights);
                const col = availColors[pickIdx];
                const curTotal = colorMap.get(col) || 0;
                if (curTotal + 1 > totalHoles * 0.25 && availColors.length > 1) {
                    availColors.splice(pickIdx, 1);
                    weights.splice(pickIdx, 1);
                    const rem = curTotal % 3;
                    if (rem > 0) {
                        const need = 3 - rem;
                        for (let k = 0; k < need; k++) {
                            segList.push([col, seg]);
                            segColors.push(col);
                        }
                        colorMap.set(col, curTotal + need);
                    }
                    continue;
                }
                const curSeg = segMap.get(col) || 0;
                if (curSeg + 1 > targetCount * 0.5 && availColors.length > 1) {
                    availColors.splice(pickIdx, 1);
                    weights.splice(pickIdx, 1);
                    continue;
                }
                if (seg < cfg.progress.length - 1) {
                    segList.push([col, seg]);
                    segColors.push(col);
                    colorMap.set(col, curTotal + 1);
                    segMap.set(col, curSeg + 1);
                } else {
                    segList.push([col, seg], [col, seg], [col, seg]);
                    segColors.push(col, col, col);
                    colorMap.set(col, curTotal + 3);
                    segMap.set(col, curSeg + 3);
                }
            }

            remaining -= segList.length;
            this.shuffleArray(segList);
            this._screwArr.push(...segList);
            this._partScrewColor.push(segColors);

            if (seg === 0) {
                // Pick top-2 most frequent colors in first segment as initial boxes
                const sorted = Array.from(segMap.entries()).sort((a, b) => b[1] - a[1]);
                this._boxDataArr = sorted.slice(0, 2).map((e) => e[0]);
            }
        }

        // Guarantee exact length == totalHoles and every color count % 3 == 0
        while (this._screwArr.length > totalHoles) {
            const popped = this._screwArr.pop()!;
            colorMap.set(popped[0], Math.max(0, (colorMap.get(popped[0]) || 1) - 1));
        }
        // Fix any mod-3 remainder cleanly
        const nonDiv: number[] = [];
        colorMap.forEach((cnt, col) => {
            if (cnt % 3 !== 0) nonDiv.push(col);
        });
        if (nonDiv.length > 0 || this._screwArr.length !== totalHoles) {
            // Fallback clean balanced triple fill
            this._screwArr = [];
            colorMap.clear();
            const groups = Math.floor(totalHoles / 3);
            const paletteSize = Math.min(8, Math.max(4, Math.floor(groups / 2)));
            for (let g = 0; g < groups; g++) {
                const col = this._screwColorTypeArr[g % paletteSize];
                this._screwArr.push([col, 0], [col, 0], [col, 0]);
                colorMap.set(col, (colorMap.get(col) || 0) + 3);
            }
            this.shuffleArray(this._screwArr);
        }

        if (this._boxDataArr.length < 2) {
            const keys = Array.from(colorMap.keys()).filter((c) => (colorMap.get(c) || 0) >= 3);
            this._boxDataArr = keys.slice(0, 2);
        }

        this._shengYuBoxCount = Math.floor(this._screwArr.length / 3);
        this._screwArrCopy = this._screwArr.map((x) => [x[0], x[1]]);
        this._screwColorMap = colorMap;
        this._boxRandomColorNum = Math.max(5, Math.round(this._screwArr.length * 0.1));
    }

    /**
     * Auto-fits & centers any level whose holes exceed the safe clickable playfield
     * (fixes off-screen screws on Levels 6, 43, 44, 75, 90 and edge-hugging screws on 20 more levels).
     * Pre-transforms coordinates before creating Box2D colliders/joints so physics stays 100% exact.
     */
    private fitLevelToSafeBounds(lvData: LevelData): LevelData {
        const SAFE_MIN_X = -315;
        const SAFE_MAX_X = 315;
        const SAFE_MIN_Y = -405;
        const SAFE_MAX_Y = 235;
        const SAFE_W = SAFE_MAX_X - SAFE_MIN_X;
        const SAFE_H = SAFE_MAX_Y - SAFE_MIN_Y;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const layer of lvData.layers) {
            for (const b of layer.boards) {
                const rad = (b.angle || 0) * Math.PI / 180;
                const ca = Math.cos(rad);
                const sa = Math.sin(rad);
                const sx = b.scale[0];
                const sy = b.scale[1];
                for (const h of b.holes) {
                    const hx = h[0] * sx;
                    const hy = h[1] * sy;
                    const wx = b.pos[0] + hx * ca - hy * sa;
                    const wy = b.pos[1] + hx * sa + hy * ca;
                    if (wx < minX) minX = wx;
                    if (wx > maxX) maxX = wx;
                    if (wy < minY) minY = wy;
                    if (wy > maxY) maxY = wy;
                }
            }
        }

        if (!Number.isFinite(minX)) return lvData;
        if (minX >= SAFE_MIN_X && maxX <= SAFE_MAX_X && minY >= SAFE_MIN_Y && maxY <= SAFE_MAX_Y) {
            return lvData;
        }

        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const s = Math.min(1, SAFE_W / spanX, SAFE_H / spanY);

        const sMinX = minX * s;
        const sMaxX = maxX * s;
        const sMinY = minY * s;
        const sMaxY = maxY * s;

        let shiftX = 0;
        if (sMinX < SAFE_MIN_X || sMaxX > SAFE_MAX_X) {
            shiftX = ((SAFE_MIN_X + SAFE_MAX_X) * 0.5) - ((sMinX + sMaxX) * 0.5);
        }
        let shiftY = 0;
        if (sMinY < SAFE_MIN_Y || sMaxY > SAFE_MAX_Y) {
            shiftY = ((SAFE_MIN_Y + SAFE_MAX_Y) * 0.5) - ((sMinY + sMaxY) * 0.5);
        }

        return {
            name: lvData.name,
            totalHoles: lvData.totalHoles,
            layers: lvData.layers.map((layer) => ({
                name: layer.name,
                boards: layer.boards.map((b) => ({
                    ...b,
                    pos: [b.pos[0] * s + shiftX, b.pos[1] * s + shiftY],
                    size: [b.size[0] * s, b.size[1] * s],
                    boardSize: [b.boardSize[0] * s, b.boardSize[1] * s],
                    boardPos: [b.boardPos[0] * s, b.boardPos[1] * s],
                    polygon: b.polygon.map((p) => [p[0] * s, p[1] * s] as [number, number]),
                    holes: b.holes.map((h) => [h[0] * s, h[1] * s] as [number, number]),
                })),
            })),
        };
    }

    private buildBoards(rawLvData: LevelData): void {
        if (!this._boardsContainer) return;
        const lvData = this.fitLevelToSafeBounds(rawLvData);

        const root = new Node(lvData.name);
        root.setParent(this._boardsContainer);
        root.setPosition(0, 0, 0);
        const rootOp = root.addComponent(UIOpacity);
        rootOp.opacity = 0;
        this._rootBoards = root;

        const totalLayers = lvData.layers.length;
        this._curShowLayerIndex = totalLayers - this._maxLayerNum;
        this._curShowGroupSlot = 0;

        for (let L = 0; L < totalLayers; L++) {
            const layerData = lvData.layers[L];
            const layerNode = new Node(layerData.name);
            layerNode.setParent(root);
            layerNode.setPosition(0, 0, 0);

            const sortedBoards = [...layerData.boards].sort((a, b) => b.pos[1] - a.pos[1]);
            const isActiveLayer = L > totalLayers - 1 - this._maxLayerNum;
            const isTopVisible = L > totalLayers - 1 - this._maxScrewNum;
            const groupBit = this.getLayerGroupBit(this._curShowGroupSlot);
            if (isActiveLayer) {
                this._curShowGroupSlot++;
            }

            for (const bData of sortedBoards) {
                const bNode = this.createBoardNode(bData, L, groupBit, isActiveLayer, isTopVisible);
                bNode.setParent(layerNode);
                this._boards.push(bNode);
            }
        }

        // Reverse so top-most screws are hit-tested first
        this._screws.reverse();

        this.scheduleOnce(() => {
            PhysicsSystem2D.instance.enable = true;
            tween(rootOp).to(0.45, { opacity: 255 }).start();
        }, 0.08);
    }

    private createBoardNode(
        bData: BoardData,
        layerIndex: number,
        groupBit: number,
        isActiveLayer: boolean,
        isTopVisible: boolean,
    ): Node {
        const bNode = new Node(bData.name);
        bNode.setPosition(bData.pos[0], bData.pos[1], 0);
        bNode.angle = bData.angle;
        bNode.setScale(bData.scale[0], bData.scale[1], 1);

        const bUi = bNode.addComponent(UITransform);
        bUi.setContentSize(bData.size[0], bData.size[1]);
        const bOp = bNode.addComponent(UIOpacity);
        bOp.opacity = isActiveLayer ? 255 : 0;

        // Outer frame sprite
        const frameSp = bNode.addComponent(Sprite);
        frameSp.sizeMode = Sprite.SizeMode.CUSTOM;
        const frameSf = bData.frameSprite ? ResManager.ins.getBoardSprite(bData.frameSprite) : null;
        if (frameSf) {
            frameSp.spriteFrame = frameSf;
        }

        // Inner frosted sugar icing child
        const innerNode = new Node('board');
        innerNode.setParent(bNode);
        innerNode.setPosition(bData.boardPos[0], bData.boardPos[1], 0);
        innerNode.angle = bData.boardAngle || 0;
        const inUi = innerNode.addComponent(UITransform);
        inUi.setContentSize(bData.boardSize[0], bData.boardSize[1]);
        const inOp = innerNode.addComponent(UIOpacity);
        inOp.opacity = isTopVisible ? 250 : 120;

        const innerSp = innerNode.addComponent(Sprite);
        innerSp.sizeMode = Sprite.SizeMode.CUSTOM;
        const innerSf = bData.boardSprite ? ResManager.ins.getBoardSprite(bData.boardSprite) : null;
        if (innerSf) {
            innerSp.spriteFrame = innerSf;
        } else if (bData.polygon.length >= 3) {
            // Fallback vector polygon if sprite missing
            const g = innerNode.addComponent(Graphics);
            g.fillColor = new Color().fromHEX(this._allColors[layerIndex % this._allColors.length]);
            g.moveTo(bData.polygon[0][0], bData.polygon[0][1]);
            for (let i = 1; i < bData.polygon.length; i++) {
                g.lineTo(bData.polygon[i][0], bData.polygon[i][1]);
            }
            g.close();
            g.fill();
        }

        // Colorful rainbow candy sprinkles scattered strictly inside the cookie frosting (avoiding edges & holes!)
        if (bData.polygon.length >= 3) {
            this.addCookieSprinkles(bNode, innerNode, bData, layerIndex);
        }

        // Holes container
        const holesNode = new Node('hoesNode');
        holesNode.setParent(bNode);
        const holesOp = holesNode.addComponent(UIOpacity);
        holesOp.opacity = isTopVisible ? 255 : 0;
        const holeSf = ResManager.ins.getGameSprite('hole');

        for (let i = 0; i < bData.holes.length; i++) {
            const h = bData.holes[i];
            const hNode = new Node(`hole_${i}`);
            hNode.setParent(holesNode);
            hNode.setPosition(h[0], h[1], 0);
            const hUi = hNode.addComponent(UITransform);
            hUi.setContentSize(36, 36);
            const hSp = hNode.addComponent(Sprite);
            hSp.sizeMode = Sprite.SizeMode.CUSTOM;
            if (holeSf) hSp.spriteFrame = holeSf;
        }

        // Screws container
        const objectsNode = new Node('objectsNode');
        objectsNode.setParent(bNode);
        const objOp = objectsNode.addComponent(UIOpacity);
        objOp.opacity = isTopVisible ? 255 : 0;

        // Board component & polygon
        const boardComp = bNode.addComponent(BoardNode);
        boardComp.rootBoardsIndex = layerIndex;
        boardComp.onFallDestroy = (n) => this.onBoardDestroy(n);
        const polyVecs = bData.polygon.map((p) => new Vec2(p[0], p[1]));
        boardComp.polygonPoints = polyVecs;

        // Assign screw colors from screwArr
        for (let i = 0; i < bData.holes.length; i++) {
            const cInfo = this._screwArr.pop() || [1, 0];
            cInfo[1] = this._screwArr.length;
            boardComp.saveScrewColor(cInfo);
        }

        // Physics RigidBody2D + PolygonCollider2D
        const rb = bNode.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Dynamic;
        rb.enabledContactListener = false;
        rb.angularDamping = 2;
        rb.gravityScale = 5;
        rb.group = groupBit;

        const poly = bNode.addComponent(PolygonCollider2D);
        poly.friction = 0;
        poly.group = groupBit;
        if (polyVecs.length >= 3) {
            poly.points = polyVecs;
        }

        if (isActiveLayer) {
            poly.apply();
            this.addBoardScrews(bNode, holesNode, objectsNode, groupBit, boardComp);
        } else {
            bNode.active = false;
        }

        if (isTopVisible) {
            innerSp.color = new Color().fromHEX(this._allColors[layerIndex % this._allColors.length]);
            frameSp.color = ThemeManager.ins.getBoardFrameColor();
            frameSp.grayscale = false;
            innerSp.grayscale = false;
            boardComp.notActive = false;
        } else {
            // Soft warm toasted-cream veil for deeper stacked cookies (clean depth separation!)
            frameSp.grayscale = false;
            innerSp.grayscale = false;
            frameSp.color = new Color(218, 186, 174, 200);
            innerSp.color = new Color(236, 218, 214, 175);
            boardComp.notActive = true;
        }

        return bNode;
    }

    /**
     * Scatters crisp, un-tinted glossy rainbow candy sprinkles inside each cookie's icing polygon,
     * staying well clear of outer biscuit rims and all screw holes.
     */
    private addCookieSprinkles(bNode: Node, innerNode: Node, bData: BoardData, layerIndex: number): void {
        const poly = bData.polygon.map((p) => new Vec2(p[0], p[1]));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of poly) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        if (spanX < 40 || spanY < 40) return;

        // Deterministic PRNG seeded by board name + layerIndex so sprinkles never jitter across reloads
        let seed = 1337 + layerIndex * 97;
        for (let i = 0; i < bData.name.length; i++) {
            seed = (seed * 31 + bData.name.charCodeAt(i)) | 0;
        }
        const rand = (): number => {
            seed = (seed * 1664525 + 1013904223) | 0;
            return ((seed >>> 0) % 10000) / 10000;
        };

        const spNode = new Node('sprinkles');
        spNode.setParent(innerNode);
        spNode.setPosition(-bData.boardPos[0], -bData.boardPos[1], 0);
        spNode.angle = -(bData.boardAngle || 0);
        const g = spNode.addComponent(Graphics);

        const sprinklePalette = [
            '#ff5c8a', // Strawberry pink
            '#ffd43b', // Sunny lemon
            '#2dd4bf', // Mint teal
            '#60a5fa', // Sky blue
            '#c084fc', // Lavender
            '#fb923c', // Peach orange
            '#ffffff', // Sugar white
        ];

        const areaApprox = spanX * spanY;
        const targetCount = Math.max(5, Math.min(14, Math.round(areaApprox / 5200)));
        const placed: [number, number][] = [];
        const margin = 20;

        for (let attempt = 0; attempt < targetCount * 8 && placed.length < targetCount; attempt++) {
            const x = minX + margin + rand() * Math.max(1, spanX - margin * 2);
            const y = minY + margin + rand() * Math.max(1, spanY - margin * 2);
            // Must be safely inside polygon (check center + 4 inset neighbors)
            if (
                !Intersection2D.pointInPolygon(new Vec2(x, y), poly) ||
                !Intersection2D.pointInPolygon(new Vec2(x + 15, y), poly) ||
                !Intersection2D.pointInPolygon(new Vec2(x - 15, y), poly) ||
                !Intersection2D.pointInPolygon(new Vec2(x, y + 15), poly) ||
                !Intersection2D.pointInPolygon(new Vec2(x, y - 15), poly)
            ) {
                continue;
            }
            // Keep clear of every screw hole
            let nearHole = false;
            for (const h of bData.holes) {
                const dx = x - h[0];
                const dy = y - h[1];
                if (dx * dx + dy * dy < 40 * 40) {
                    nearHole = true;
                    break;
                }
            }
            if (nearHole) continue;
            // Keep sprinkles evenly spaced
            let tooClose = false;
            for (const pl of placed) {
                const dx = x - pl[0];
                const dy = y - pl[1];
                if (dx * dx + dy * dy < 32 * 32) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            placed.push([x, y]);
            const ang = rand() * Math.PI;
            const halfLen = 5.5 + rand() * 3.0;
            const dx = Math.cos(ang) * halfLen;
            const dy = Math.sin(ang) * halfLen;
            const colHex = sprinklePalette[placed.length % sprinklePalette.length];

            // Soft drop shadow under each sprinkle
            g.lineCap = Graphics.LineCap.ROUND;
            g.lineWidth = 6.2;
            g.strokeColor = new Color(150, 92, 108, 65);
            g.moveTo(x - dx, y - dy - 1.8);
            g.lineTo(x + dx, y + dy - 1.8);
            g.stroke();

            // Plump glossy colored sugar sprinkle capsule
            g.lineWidth = 5.6;
            g.strokeColor = new Color().fromHEX(colHex);
            g.moveTo(x - dx, y - dy);
            g.lineTo(x + dx, y + dy);
            g.stroke();

            // Crisp glossy white specular dot along upper edge
            g.lineWidth = 2.0;
            g.strokeColor = new Color(255, 255, 255, 165);
            g.moveTo(x - dx * 0.45, y - dy * 0.45 + 1.0);
            g.lineTo(x + dx * 0.35, y + dy * 0.35 + 1.0);
            g.stroke();
        }
    }

    private addBoardScrews(
        boardNode: Node,
        holesNode: Node,
        objectsNode: Node,
        groupBit: number,
        boardComp: BoardNode,
    ): void {
        const screwGroupBit = 1 << 11;
        for (let i = 0; i < holesNode.children.length; i++) {
            const hNode = holesNode.children[i];
            const sNode = new Node('screw');
            sNode.setParent(objectsNode);
            sNode.setPosition(hNode.position);

            const sRb = sNode.addComponent(RigidBody2D);
            sRb.type = ERigidBody2DType.Static;
            sRb.group = screwGroupBit;

            const joint = boardNode.addComponent(HingeJoint2D);
            joint.connectedBody = sRb;
            joint.anchor = new Vec2(hNode.position.x, hNode.position.y);
            joint.connectedAnchor = new Vec2(0, 0);
            joint.collideConnected = false;
            joint.apply();

            const screwComp = sNode.addComponent(ScrewNode);
            const colorInfo = boardComp.screwsColor[i] || [1, 0];
            screwComp.init(colorInfo, groupBit, joint);

            this._screws.push(sNode);
            boardComp.pushScrew(screwComp);
        }
    }

    private initBoxes(): void {
        if (!this._rootBoxes) return;
        this._boxNum = this._shengYuBoxCount;
        this._compNum = 0;
        this._nowShowBoxNum = 0;

        for (let i = 0; i < this._rootBoxes.children.length; i++) {
            const bNode = this._rootBoxes.children[i];
            const boxComp = bNode.getComponent(TargetBox)!;
            boxComp.setScrewNum(0);
            boxComp.nextIndex = -1;
            boxComp.dataAfterAni = null;
            bNode.setPosition(0, 0, 0);
            bNode.setScale(Vec3.ONE);

            if (i >= this._maxBoxNum) {
                bNode.active = false;
                continue;
            }

            bNode.active = i < this._initBoxNum;
            if (bNode.active) this._nowShowBoxNum++;

            if (i < this._initUnlockNum) {
                boxComp.setLock(false);
                const col = this._boxDataArr.shift() || this.getNextBoxColor();
                boxComp.refresh(col);
                this._shengYuBoxCount--;
                this.refreshScrewColorMap(col);
            } else {
                boxComp.setLock(true);
            }
        }
        this.layoutBoxes();
    }

    private layoutBoxes(): void {
        if (!this._rootBoxes || !this._boxInLayer) return;
        const gap = 20;
        const totalGap = gap * Math.max(0, this._nowShowBoxNum - 1);
        const maxPerBox = (this._boxRootMaxWidth - totalGap) / Math.max(1, this._nowShowBoxNum);
        const sc = maxPerBox > this._initBoxWidth ? 1 : maxPerBox / this._initBoxWidth;
        const boxW = this._initBoxWidth * sc;
        const startX = -((this._nowShowBoxNum * boxW + totalGap) / 2 - boxW / 2);

        for (let i = 0; i < this._nowShowBoxNum; i++) {
            const bNode = this._rootBoxes.children[i];
            if (bNode) {
                bNode.setScale(sc, sc, 1);
                bNode.setPosition(startX + i * (boxW + gap), 0, 0);
            }
        }
        for (let i = 0; i < this._boxInLayer.children.length; i++) {
            this._boxInLayer.children[i].setScale(sc, sc, 1);
        }
    }

    private onTouchStart(event: EventTouch): void {
        if (DataManager.ins.status !== GameStatus.RUNNING || this._isOver || this._inputBlocked) return;
        const uiLoc = event.getUILocation();
        this.handleTap(uiLoc);
    }

    private handleTap(uiPos: Vec2): void {
        const worldPt = new Vec3(uiPos.x, uiPos.y, 0);

        // Smash-board skill mode
        if (DataManager.ins.isSkill && DataManager.ins.skillIndex === SkillType.SMASH_BOARD) {
            let hitBoard: Node | null = null;
            for (let i = this._boards.length - 1; i >= 0; i--) {
                const b = this._boards[i];
                const bComp = b.getComponent(BoardNode);
                if (!b.active || !bComp || !bComp.isReady || bComp.notActive) continue;
                const ui = b.getComponent(UITransform);
                if (!ui) continue;
                const local = ui.convertToNodeSpaceAR(worldPt);
                if (bComp.polygonPoints.length >= 3 && Intersection2D.pointInPolygon(new Vec2(local.x, local.y), bComp.polygonPoints)) {
                    hitBoard = b;
                    break;
                }
            }
            if (hitBoard) {
                this.smashBoard(hitBoard);
            }
            return;
        }

        // Normal screw click
        let hitScrew: Node | null = null;
        for (let i = 0; i < this._screws.length; i++) {
            const sNode = this._screws[i];
            const parentOp = sNode.parent?.getComponent(UIOpacity);
            if (parentOp && parentOp.opacity <= 0) continue;
            const sComp = sNode.getComponent(ScrewNode);
            if (!sComp || !sComp.mainBoard) continue;
            const ui = sNode.getComponent(UITransform);
            if (!ui) continue;
            const local = ui.convertToNodeSpaceAR(worldPt);
            const hitR = ui.width / 2 + 12;
            if (local.x * local.x + local.y * local.y <= hitR * hitR) {
                hitScrew = sNode;
                break;
            }
        }

        if (!hitScrew) return;

        if (this.canScrewMove(hitScrew)) {
            const moved = this.moveScrewToDestination(hitScrew, false);
            if (moved) {
                AudioManager.ins.play(AudioClips.SCREW_OUT);
            } else {
                AudioManager.ins.play(AudioClips.SCREW_EMPTY);
            }
        } else {
            AudioManager.ins.play(AudioClips.CLICK_ERROR);
            // Shake blocked screw slightly
            const orig = hitScrew.position.clone();
            tween(hitScrew)
                .to(0.04, { position: new Vec3(orig.x - 5, orig.y, 0) })
                .to(0.04, { position: new Vec3(orig.x + 5, orig.y, 0) })
                .to(0.04, { position: orig })
                .start();
        }
    }

    private smashBoard(boardNode: Node): void {
        AudioManager.ins.play(AudioClips.SKILL_REMOVE);
        const bComp = boardNode.getComponent(BoardNode)!;
        bComp.isReady = false;
        DataManager.ins.isSkill = false;
        DataManager.ins.skillIndex = -1;
        // Consume charge only when a board is actually melted (never lost on cancel/restart!)
        if (!this._smashGrantedByAd) {
            DataManager.ins.consumeSkill(SkillType.SMASH_BOARD);
        }
        this._smashGrantedByAd = false;
        this._events?.onSmashModeChanged(false);
        this._events?.onCoinsChanged();

        const screwsCopy = [...bComp.getScrews()];
        for (const sComp of screwsCopy) {
            if (!this.moveScrewToDestination(sComp.node, true)) {
                this._screwRefreshArr.push([sComp.colorId, sComp.partIndex]);
                bComp.spliceScrew(sComp.node);
                this.destroyScrew(sComp.node);
            }
        }
        this.checkShowScrewCount();
        tween(boardNode)
            .to(0.22, { scale: Vec3.ZERO })
            .call(() => {
                this.onBoardDestroy(boardNode);
            })
            .start();
    }

    private canScrewMove(screwNode: Node): boolean {
        const sComp = screwNode.getComponent(ScrewNode);
        if (!sComp || !sComp.mainBoard || !sComp.mainBoard.parent) return false;

        const screwLayerIdx = sComp.mainBoard.parent.getSiblingIndex();
        const sUi = screwNode.getComponent(UITransform);
        const screwRadius = (sUi ? sUi.width / 2 : 28) - 6;
        const screwWorld = sUi ? sUi.convertToWorldSpaceAR(Vec3.ZERO) : screwNode.worldPosition;

        for (let i = 0; i < this._boards.length; i++) {
            const otherBoard = this._boards[i];
            if (!otherBoard.active || !otherBoard.parent) continue;
            const otherLayerIdx = otherBoard.parent.getSiblingIndex();
            if (otherLayerIdx <= screwLayerIdx) continue;
            const otherComp = otherBoard.getComponent(BoardNode);
            if (!otherComp || !otherComp.isReady || otherComp.polygonPoints.length < 3) continue;

            const bUi = otherBoard.getComponent(UITransform);
            if (!bUi) continue;
            const localPos3 = bUi.convertToNodeSpaceAR(screwWorld);
            const localPos = new Vec2(localPos3.x, localPos3.y);
            if (Intersection2D.polygonCircle(otherComp.polygonPoints, localPos, screwRadius)) {
                return false;
            }
        }
        return true;
    }

    private moveScrewToDestination(screwNode: Node, onlyBox: boolean): boolean {
        const sComp = screwNode.getComponent(ScrewNode)!;
        if (!this._rootBoxes || !this._trayComp) return false;

        // 1. Find matching active unlocked box (prefer the one with most screws already)
        let bestBox: TargetBox | null = null;
        for (const bNode of this._rootBoxes.children) {
            const box = bNode.getComponent(TargetBox);
            if (box && box.isActive() && box.colorId === sComp.colorId) {
                if (!bestBox || box.screwNum > bestBox.screwNum) {
                    bestBox = box;
                }
            }
        }

        if (bestBox) {
            const targetSlot = bestBox.getScrewCurrent();
            if (!targetSlot) return false;

            const startWorld = screwNode.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO);
            sComp.mainBoard?.getComponent(BoardNode)?.spliceScrew(screwNode);
            this.destroyScrew(screwNode);
            this.checkShowScrewCount();

            bestBox.addScrewNum();
            this.markPartRemoved(bestBox.colorId, sComp.partIndex);
            this.showTouchEffect(startWorld);

            const willFull = bestBox.checkWillFull();
            let preNextColor = -1;
            if (willFull && this._shengYuBoxCount > 0) {
                const savedColor = bestBox.colorId;
                bestBox.colorId = -1;
                preNextColor = this.getNextBoxColor();
                bestBox.colorId = savedColor;
                bestBox.nextIndex = preNextColor;
                if (preNextColor > 0) {
                    this._shengYuBoxCount--;
                    this.refreshScrewColorMap(preNextColor);
                }
            }

            const boxRef = bestBox;
            const colorId = sComp.colorId;
            this.playScrewFly(colorId, startWorld, targetSlot, () => {
                AudioManager.ins.play(AudioClips.SCREW_IN);
                targetSlot.active = true;
                if (willFull || (boxRef.checkFull() && boxRef.dataAfterAni === null)) {
                    boxRef.nextIndex = -1;
                    this._compNum++;
                    this._events?.onCoinsChanged();
                    this.showFlyGold(boxRef.node);
                    AudioManager.ins.play(AudioClips.BOX_FULL);
                    this.updateProgress();
                    if (preNextColor > 0) {
                        this._shengYuBoxCount++;
                    }
                    this.onBoxRefresh(boxRef, preNextColor, false);
                }
            });
            return true;
        }

        if (onlyBox) return false;

        // 2. Otherwise send to HoldingTray
        if (!this._trayComp.isActive()) {
            AudioManager.ins.play(AudioClips.SCREW_EMPTY);
            return false;
        }
        const traySlot = this._trayComp.getScrewCurrent();
        if (!traySlot) return false;

        const startWorld = screwNode.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO);
        sComp.mainBoard?.getComponent(BoardNode)?.spliceScrew(screwNode);
        this.destroyScrew(screwNode);
        this.checkShowScrewCount();

        this._trayComp.pushScrew(sComp.colorId);
        this.showTouchEffect(startWorld);

        const colorId = sComp.colorId;
        const partIdx = sComp.partIndex;
        if (this._trayComp.checkNearFull() === 0) {
            this._inputBlocked = true;
        }

        this.playScrewFly(colorId, startWorld, traySlot, () => {
            this._trayComp!.addScrew(colorId, traySlot, partIdx);
            AudioManager.ins.play(AudioClips.SCREW_OUT);

            let matchedAny = false;
            let pendingBoxMatch = false;
            const trayColors = this._trayComp!.getScrewColors();

            for (const bNode of this._rootBoxes!.children) {
                const box = bNode.getComponent(TargetBox);
                if (!box || box.isLock() || !box.node.active) continue;
                if (box.dataAfterAni) {
                    if (box.dataAfterAni[1].length < 3 && trayColors.includes(box.dataAfterAni[0])) {
                        pendingBoxMatch = true;
                    }
                } else if (box.screwNum < 3 && box.colorId === colorId) {
                    matchedAny = true;
                    this.onTargetToBox(box);
                }
            }

            this._inputBlocked = false;
            if (!matchedAny && !pendingBoxMatch && this._trayComp!.checkFull()) {
                this.triggerLoseFull();
            }
        });

        return true;
    }

    private onTargetToBox(box: TargetBox): void {
        if (!this._trayComp) return;
        const trayScrews = this._trayComp.getScrews();
        for (const sNode of trayScrews) {
            const parts = sNode.name.split('_');
            const cId = Number(parts[0]);
            const pIdx = Number(parts[1] || 0);
            if (box.colorId === cId && box.screwNum < box.screwNumMax) {
                const slot = box.getScrewCurrent();
                if (!slot) break;

                this._inputBlocked = false;
                const startWorld = sNode.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO);
                this._trayComp.clearOne(sNode);
                box.addScrewNum();
                this.markPartRemoved(box.colorId, pIdx);

                this.playScrewFly(cId, startWorld, slot, () => {
                    AudioManager.ins.play(AudioClips.SCREW_IN);
                    slot.active = true;
                    if (box.checkFull()) {
                        this._compNum++;
                        this._events?.onCoinsChanged();
                        this.showFlyGold(box.node);
                        AudioManager.ins.play(AudioClips.BOX_FULL);
                        this.updateProgress();
                        this.onBoxRefresh(box, -1, false);
                    }
                });
            }
        }
    }

    private onBoxRefresh(box: TargetBox, preColor: number, isUnlockAction: boolean): void {
        if (this._shengYuBoxCount > 0) {
            this._shengYuBoxCount--;
            let nextColor = preColor;
            if (nextColor <= 0) {
                nextColor = this.getNextBoxColor();
                if (nextColor > 0) {
                    this.refreshScrewColorMap(nextColor);
                }
            }
            box.colorId = nextColor;
            const buffered = this.takeFromRefreshArr(nextColor, 3);
            box.dataAfterAni = [nextColor, buffered];

            const applyNewBox = () => {
                box.unlock();
                box.setScrewNum(buffered.length);
                for (const item of buffered) {
                    this.markPartRemoved(item[0], item[1]);
                }
                box.refresh(nextColor);
                box.dataAfterAni = null;
                this.layoutBoxes();
                this.onTargetToBox(box);

                if (box.screwNum < box.screwNumMax) {
                    const extra = this.takeFromRefreshArr(box.colorId, box.screwNumMax - box.screwNum);
                    for (const item of extra) {
                        const slot = box.getScrewCurrent();
                        if (slot) slot.active = true;
                        box.addScrewNum();
                        this.markPartRemoved(item[0], item[1]);
                    }
                }
                if (box.checkFull()) {
                    this._compNum++;
                    this._events?.onCoinsChanged();
                    this.showFlyGold(box.node);
                    AudioManager.ins.play(AudioClips.BOX_FULL);
                    this.updateProgress();
                    this.onBoxRefresh(box, -1, false);
                } else {
                    this.checkFailAfterBox();
                }
            };

            if (isUnlockAction) {
                applyNewBox();
                return;
            }

            const origPos = box.node.position.clone();
            const siblingIdx = box.node.getSiblingIndex();
            const slideNode = this._boxInLayer?.children[siblingIdx] || null;

            box.playCoverAni();

            if (slideNode) {
                const slideSp = slideNode.getComponent(Sprite);
                const nextSf = ThemeManager.ins.getBoxSprite(nextColor);
                if (slideSp && nextSf) {
                    slideSp.spriteFrame = nextSf;
                    slideSp.color = Color.WHITE.clone();
                }
                slideNode.setPosition(-750, origPos.y, 0);
                slideNode.active = true;
                const slideDur = Math.max(0.5, (origPos.x - -750) / 800);
                tween(slideNode)
                    .stop()
                    .delay(0.45)
                    .to(slideDur, { position: new Vec3(origPos.x, origPos.y, 0) }, { easing: 'cubicOut' })
                    .call(() => {
                        slideNode.active = false;
                        box.node.setPosition(origPos);
                        box.node.setScale(slideNode.scale);
                        box.node.active = true;
                        applyNewBox();
                    })
                    .start();
            } else {
                this.scheduleOnce(() => {
                    box.node.setPosition(origPos);
                    box.node.active = true;
                    applyNewBox();
                }, 0.7);
            }
        } else {
            box.colorId = -1;
            box.playCoverAni(() => {
                box.resetAngle();
                box.unlock();
                box.node.active = false;
                if (!this._isOver && this.checkAllBoxesClear()) {
                    this._isOver = true;
                    DataManager.ins.status = GameStatus.WIN;
                    AudioManager.ins.play(AudioClips.GAME_WIN);
                    const reward = DataManager.ins.recordWin();
                    MonetizationManager.ins.trackEvent('level_win', { bolts: reward.bolts });
                    this._events?.onCoinsChanged();
                    this._events?.onWin(this._totalScrewCount);
                }
            });
        }
    }

    private checkFailAfterBox(): void {
        if (!this._trayComp || !this._rootBoxes) return;
        const trayColors = this._trayComp.getScrewColors();
        let canAccept = false;
        for (const bNode of this._rootBoxes.children) {
            const box = bNode.getComponent(TargetBox);
            if (!box || box.isLock() || !box.node.active) continue;
            if (box.dataAfterAni && box.dataAfterAni[1].length < 3 && trayColors.includes(box.dataAfterAni[0])) {
                canAccept = true;
            }
            if (!box.dataAfterAni && box.screwNum < 3 && trayColors.includes(box.colorId)) {
                canAccept = true;
            }
        }
        if (!canAccept && this._trayComp.checkFull()) {
            this.triggerLoseFull();
        }
    }

    private triggerLoseFull(): void {
        if (this._isOver) return;
        DataManager.ins.status = GameStatus.LOSE;
        AudioManager.ins.play(AudioClips.GAME_LOSE);
        this._events?.onLoseFull();
    }

    private checkAllBoxesClear(): boolean {
        if (!this._rootBoxes) return false;
        let activeCount = 0;
        for (const bNode of this._rootBoxes.children) {
            const box = bNode.getComponent(TargetBox);
            if (box && box.isActive()) activeCount++;
        }
        return activeCount <= 0 && this._compNum >= this._boxNum;
    }

    private destroyScrew(screwNode: Node): void {
        const sComp = screwNode.getComponent(ScrewNode);
        if (sComp && sComp.joint && sComp.joint.isValid) {
            sComp.joint.destroy();
            sComp.joint = null;
        }
        const idx = this._screws.indexOf(screwNode);
        if (idx >= 0) {
            this._screws.splice(idx, 1);
        }
        screwNode.destroy();
    }

    private onBoardDestroy(boardNode: Node): void {
        if (ThemeManager.ins.activeConfig.useCrumbParticles) {
            const bUi = boardNode.getComponent(UITransform);
            if (bUi) {
                this.spawnCookieCrumbs(bUi.convertToWorldSpaceAR(Vec3.ZERO));
            }
        }
        MonetizationManager.ins.triggerHaptic('medium');
        const idx = this._boards.indexOf(boardNode);
        if (idx >= 0) {
            this._boards.splice(idx, 1);
        }
        const layerNode = boardNode.parent;
        boardNode.removeFromParent();
        boardNode.destroy();

        if (layerNode && layerNode.children.length === 0) {
            if (this._showByScrewCountNum > 0) {
                this._showByScrewCountNum--;
            } else {
                this.showNextLayer();
            }
        }
    }

    private checkShowScrewCount(): void {
        let visibleCount = 0;
        for (const sNode of this._screws) {
            const op = sNode.parent?.getComponent(UIOpacity);
            if (!op || op.opacity > 0) visibleCount++;
        }
        if (visibleCount < this._totalScrewCount * 0.1 && this._curShowLayerIndex > 0) {
            this.showNextLayer();
            this._showByScrewCountNum++;
        }
    }

    private showNextLayer(): void {
        if (!this._rootBoards) return;
        this._curShowLayerIndex--;

        // Activate physics for newly entered layer
        if (this._curShowLayerIndex >= 0) {
            const layerNode = this._rootBoards.children[this._curShowLayerIndex];
            const groupBit = this.getLayerGroupBit(this._curShowGroupSlot++);
            for (const bNode of layerNode.children) {
                bNode.active = true;
                const rb = bNode.getComponent(RigidBody2D);
                const poly = bNode.getComponent(PolygonCollider2D);
                const bComp = bNode.getComponent(BoardNode);
                if (rb) rb.group = groupBit;
                if (poly) {
                    poly.group = groupBit;
                    poly.apply();
                }
                const holesNode = bNode.getChildByName('hoesNode');
                const objectsNode = bNode.getChildByName('objectsNode');
                if (holesNode && objectsNode && bComp) {
                    this.addBoardScrews(bNode, holesNode, objectsNode, groupBit, bComp);
                }
                const op = bNode.getComponent(UIOpacity);
                if (op) tween(op).to(0.6, { opacity: 255 }).start();
            }
        }

        // Light up the layer entering top-4 visible window
        const revealIdx = this._curShowLayerIndex + this._maxLayerNum - this._maxScrewNum;
        if (revealIdx >= 0 && revealIdx < this._rootBoards.children.length) {
            const layerNode = this._rootBoards.children[revealIdx];
            for (const bNode of layerNode.children) {
                const bComp = bNode.getComponent(BoardNode);
                if (!bComp) continue;
                bComp.notActive = false;

                const frameSp = bNode.getComponent(Sprite);
                const innerNode = bNode.getChildByName('board');
                const innerSp = innerNode?.getComponent(Sprite);
                const innerOp = innerNode?.getComponent(UIOpacity);
                const holesOp = bNode.getChildByName('hoesNode')?.getComponent(UIOpacity);
                const objOp = bNode.getChildByName('objectsNode')?.getComponent(UIOpacity);

                if (frameSp) {
                    frameSp.grayscale = false;
                    frameSp.color = ThemeManager.ins.getBoardFrameColor();
                }
                if (innerSp) {
                    innerSp.grayscale = false;
                    innerSp.color = new Color().fromHEX(this._allColors[bComp.rootBoardsIndex % this._allColors.length]);
                }
                if (innerOp) tween(innerOp).to(0.4, { opacity: 250 }).start();
                if (holesOp) tween(holesOp).to(0.4, { opacity: 255 }).start();
                if (objOp) tween(objOp).to(0.4, { opacity: 255 }).start();
            }
        }
    }

    /**
     * Upgraded 3-phase 3D Unscrew -> Bezier Arc Flight -> Screw-In animation:
     * 1. Counter-clockwise unscrew lifting out of the hole while extending a 3D metallic threaded shaft
     * 2. Graceful quadratic Bezier flight with 3D perspective elevation & spin
     * 3. Clockwise screw-down into target socket with shaft retract + lock-in sparkle ring
     */
    private playScrewFly(colorId: number, startWorld: Vec3, targetNode: Node, onDone: () => void): void {
        if (!this._fxLayer) {
            onDone();
            return;
        }
        const fxUi = this._fxLayer.getComponent(UITransform)!;
        const startLocal = fxUi.convertToNodeSpaceAR(startWorld);
        const endWorld = targetNode.getComponent(UITransform)!.convertToWorldSpaceAR(Vec3.ZERO);
        const endLocal = fxUi.convertToNodeSpaceAR(endWorld);

        const mover = new Node('screw_fly_3d');
        mover.setParent(this._fxLayer);
        mover.setPosition(startLocal);

        // 1. 3D glossy gummy-candy threaded shaft tinted to match this screw's candy color!
        const shaftNode = new Node('shaft');
        shaftNode.setParent(mover);
        const shUi = shaftNode.addComponent(UITransform);
        shUi.setContentSize(26, 54);
        shUi.setAnchorPoint(0.5, 1.0);
        shaftNode.setPosition(0, 4, 0);
        shaftNode.setScale(1, 0.05, 1);
        const shSp = shaftNode.addComponent(Sprite);
        shSp.sizeMode = Sprite.SizeMode.CUSTOM;
        const shaftSf = ResManager.ins.getGameSprite('screw_shaft');
        if (shaftSf) shSp.spriteFrame = shaftSf;
        shSp.color = new Color().fromHEX(SCREW_FALLBACK_COLORS[colorId] || '#ffffff');

        // 2. 3D glossy gummy-candy screw head cap on top of shaft
        const headNode = new Node('head');
        headNode.setParent(mover);
        const hUi = headNode.addComponent(UITransform);
        hUi.setContentSize(60, 60);
        const hSp = headNode.addComponent(Sprite);
        hSp.sizeMode = Sprite.SizeMode.CUSTOM;
        const sf = ThemeManager.ins.getScrewSprite(colorId);
        if (sf) hSp.spriteFrame = sf;
        else hSp.color = new Color().fromHEX(SCREW_FALLBACK_COLORS[colorId] || '#ffffff');

        // Spawn golden 4-point sparkles popping around the unscrewed cookie hole!
        this.spawnCandySparkles(startLocal);

        MonetizationManager.ins.triggerHaptic('light');
        if (ThemeManager.ins.activeConfig.useGummyBounce) {
            // Squishy gummy-candy pop feedback when pulling a candy screw!
            tween(headNode)
                .to(0.06, { scale: new Vec3(1.28, 0.78, 1) }, { easing: 'quadOut' })
                .to(0.08, { scale: new Vec3(0.88, 1.22, 1) }, { easing: 'quadOut' })
                .to(0.07, { scale: Vec3.ONE }, { easing: 'sineOut' })
                .start();
        }

        const liftPos = new Vec3(startLocal.x, startLocal.y + 38, 0);
        const hoverEnd = new Vec3(endLocal.x, endLocal.y + 34, 0);
        const dist = Vec3.distance(liftPos, hoverEnd);
        const flyDur = Math.max(0.18, Math.min(0.32, dist / 2200));
        const ctrlX = (liftPos.x + hoverEnd.x) * 0.5 + (liftPos.x < hoverEnd.x ? -40 : 40);
        const ctrlY = Math.max(liftPos.y, hoverEnd.y) + 68;

        // Phase 1: Unscrew counter-clockwise while pulling threaded shaft out (snappy 0.15s)
        tween(shaftNode)
            .to(0.15, { scale: new Vec3(1, 1.0, 1) }, { easing: 'quadOut' })
            .start();
        tween(headNode)
            .to(0.15, { angle: 360 }, { easing: 'quadOut' })
            .start();
        tween(mover)
            .to(0.15, { position: liftPos, scale: new Vec3(1.24, 1.24, 1) }, { easing: 'quadOut' })
            .call(() => {
                // Phase 2: Quadratic Bezier arc flight to above target socket
                const arc = { t: 0 };
                const fDur = Math.max(0.15, Math.min(0.24, flyDur));
                tween(headNode).to(fDur, { angle: 540 }).start();
                tween(arc)
                    .to(fDur, { t: 1 }, {
                        easing: 'sineInOut',
                        onUpdate: () => {
                            if (!mover.isValid) return;
                            const t = arc.t;
                            const inv = 1 - t;
                            const bx = inv * inv * liftPos.x + 2 * inv * t * ctrlX + t * t * hoverEnd.x;
                            const by = inv * inv * liftPos.y + 2 * inv * t * ctrlY + t * t * hoverEnd.y;
                            mover.setPosition(bx, by, 0);
                            const sc = 1.24 - 0.14 * t + 0.12 * Math.sin(t * Math.PI);
                            mover.setScale(sc, sc, 1);
                        },
                    })
                    .call(() => {
                        if (!mover.isValid) {
                            onDone();
                            return;
                        }
                        // Phase 3: Screw clockwise down into target hole, retracting shaft
                        tween(shaftNode)
                            .to(0.12, { scale: new Vec3(1, 0.04, 1) }, { easing: 'quadIn' })
                            .start();
                        tween(headNode)
                            .to(0.12, { angle: 180 }, { easing: 'quadIn' })
                            .start();
                        tween(mover)
                            .to(0.12, { position: endLocal, scale: new Vec3(0.96, 0.96, 1) }, { easing: 'quadIn' })
                            .call(() => {
                                if (mover.isValid) mover.destroy();
                                onDone();
                            })
                            .start();
                    })
                    .start();
            })
            .start();
    }

    /** Original GbzLvNew.showFlyGold: 3 items fly along a Bezier arc with ±360° spin to c_item (cardboard box) */
    private showFlyGold(fromBoxNode: Node): void {
        if (!this._fxLayer) return;
        const collectNode = this._events?.getCollectBoxNode ? this._events.getCollectBoxNode() : null;
        if (!collectNode) return;
        const fxUi = this._fxLayer.getComponent(UITransform);
        const fromUi = fromBoxNode.getComponent(UITransform);
        const toUi = collectNode.getComponent(UITransform);
        if (!fxUi || !fromUi || !toUi) return;

        const startLocal = fxUi.convertToNodeSpaceAR(fromUi.convertToWorldSpaceAR(Vec3.ZERO));
        const endLocal = fxUi.convertToNodeSpaceAR(toUi.convertToWorldSpaceAR(Vec3.ZERO));
        const goldSf = ResManager.ins.getUiSprite('flyGold') || ResManager.ins.getGameSprite('gbz_screw1');

        for (let i = 0; i < 3; i++) {
            const item = new Node(`flyGold_${i}`);
            item.setParent(this._fxLayer);
            item.setPosition(startLocal);
            const iUi = item.addComponent(UITransform);
            iUi.setContentSize(41, 50);
            const sp = item.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            if (goldSf) sp.spriteFrame = goldSf;

            const ctrlX = (startLocal.x + endLocal.x) * 0.5 + (Math.random() * 80 - 40);
            const ctrlY = (startLocal.y + endLocal.y) * 0.5 - (100 + Math.random() * 50);
            const spinDir = i % 2 === 0 ? 360 : -360;
            const isFirst = i === 0;
            const state = { t: 0 };

            tween(state)
                .delay(i * 0.1)
                .to(0.65, { t: 1 }, {
                    onUpdate: () => {
                        if (!item.isValid) return;
                        const t = state.t;
                        const inv = 1 - t;
                        const x = inv * inv * startLocal.x + 2 * inv * t * ctrlX + t * t * endLocal.x;
                        const y = inv * inv * startLocal.y + 2 * inv * t * ctrlY + t * t * endLocal.y;
                        item.setPosition(x, y, 0);
                        item.angle = spinDir * t;
                    },
                })
                .call(() => {
                    if (isFirst) {
                        AudioManager.ins.play(AudioClips.GET_GOLD);
                        tween(collectNode)
                            .to(0.08, { scale: new Vec3(1.16, 0.88, 1) })
                            .to(0.1, { scale: new Vec3(0.95, 1.06, 1) })
                            .to(0.08, { scale: Vec3.ONE })
                            .start();
                    }
                    if (item.isValid) item.destroy();
                })
                .start();
        }
    }

    private showTouchEffect(worldPos: Vec3): void {
        if (!this._fxLayer) return;
        const fxUi = this._fxLayer.getComponent(UITransform);
        if (!fxUi) return;
        const local = fxUi.convertToNodeSpaceAR(worldPos);

        // Native-safe Sweet Candy sparkle ring + burst (avoids Cocos 3.8.6 native Spine RenderEntity nullptr crash)
        const ring = new Node('touch_ring');
        ring.setParent(this._fxLayer);
        ring.setPosition(local);
        ring.setScale(0.35, 0.35, 1);
        const rg = ring.addComponent(Graphics);
        rg.strokeColor = new Color(255, 224, 102, 240);
        rg.lineWidth = 6;
        rg.circle(0, 0, 34);
        rg.stroke();
        rg.strokeColor = new Color(255, 140, 196, 200);
        rg.lineWidth = 3;
        rg.circle(0, 0, 26);
        rg.stroke();
        const rop = ring.addComponent(UIOpacity);
        rop.opacity = 245;

        tween(ring)
            .to(0.26, { scale: new Vec3(1.55, 1.55, 1) }, { easing: 'quadOut' })
            .call(() => {
                if (ring.isValid) ring.destroy();
            })
            .start();
        tween(rop).to(0.26, { opacity: 0 }, { easing: 'quadIn' }).start();
    }

    // ==================== Skills & Revive ====================

    public useSkill(skill: SkillType): void {
        if (DataManager.ins.status !== GameStatus.RUNNING || this._isOver) return;

        if (skill === SkillType.UNLOCK_BOX) {
            this.unlockNextBox();
            return;
        }

        // Toggle off Smash-board mode without consuming a charge
        if (skill === SkillType.SMASH_BOARD && DataManager.ins.isSkill && DataManager.ins.skillIndex === SkillType.SMASH_BOARD) {
            this.cancelSmashMode();
            return;
        }

        // Validate preconditions before consuming charge or showing Rewarded Ad
        if (skill === SkillType.UNLOCK_SLOT && !this._trayComp?.canUnlockSlot()) {
            this._events?.onToast('All holding slots are unlocked!');
            return;
        }
        if (skill === SkillType.CLEAR_TRAY && (!this._trayComp || this._trayComp.getScrews().length === 0)) {
            this._events?.onToast('Holding tray is empty');
            return;
        }

        if (skill === SkillType.SMASH_BOARD) {
            if (DataManager.ins.getSkillCount(skill) > 0) {
                this._smashGrantedByAd = false;
                DataManager.ins.isSkill = true;
                DataManager.ins.skillIndex = SkillType.SMASH_BOARD;
                this._events?.onSmashModeChanged(true);
            } else {
                MonetizationManager.ins.showRewardedAd('skill_refill', () => {
                    this._smashGrantedByAd = true;
                    DataManager.ins.isSkill = true;
                    DataManager.ins.skillIndex = SkillType.SMASH_BOARD;
                    this._events?.onSmashModeChanged(true);
                });
            }
            return;
        }

        const execute = () => {
            if (skill === SkillType.UNLOCK_SLOT) {
                const newSlot = this._trayComp?.unlockOneSlot();
                if (!newSlot) return;
                AudioManager.ins.play(AudioClips.SKILL_UNLOCK);
                newSlot.setScale(Vec3.ZERO);
                tween(newSlot).to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
                this._events?.onToast('+1 Holding Slot unlocked!');
            } else if (skill === SkillType.CLEAR_TRAY) {
                if (!this._trayComp) return;
                const screws = this._trayComp.getScrews();
                if (screws.length === 0) return;
                AudioManager.ins.play(AudioClips.SKILL_CLEAR);
                this._trayComp.clearAllPending();
                for (const sNode of screws) {
                    const parts = sNode.name.split('_');
                    this._screwRefreshArr.push([Number(parts[0]), Number(parts[1] || 0)]);
                    tween(sNode)
                        .to(0.2, { scale: Vec3.ZERO })
                        .call(() => this._trayComp!.resetSingleTarget(sNode))
                        .start();
                }
                this._events?.onToast('Holding tray cleared!');
            }
            this._events?.onCoinsChanged();
        };

        if (DataManager.ins.getSkillCount(skill) > 0) {
            DataManager.ins.consumeSkill(skill);
            execute();
        } else {
            MonetizationManager.ins.showRewardedAd('skill_refill', execute);
        }
    }

    public cancelSmashMode(): void {
        if (!DataManager.ins.isSkill) return;
        DataManager.ins.isSkill = false;
        DataManager.ins.skillIndex = -1;
        this._smashGrantedByAd = false;
        this._events?.onSmashModeChanged(false);
    }

    public onBoxLockClick(box: TargetBox): void {
        if (DataManager.ins.status !== GameStatus.RUNNING || this._isOver) return;
        if (!box.isLock()) return;
        MonetizationManager.ins.showRewardedAd('unlock_box', () => {
            if (!box.isLock()) return;
            AudioManager.ins.play(AudioClips.SKILL_UNLOCK);
            this.onBoxRefresh(box, -1, true);
            this._events?.onCoinsChanged();
            this._events?.onToast('Extra box unlocked!');
        });
    }

    public unlockNextBox(): void {
        if (!this._rootBoxes) return;
        for (const bNode of this._rootBoxes.children) {
            const box = bNode.getComponent(TargetBox);
            if (box && box.node.active && box.isLock()) {
                this.onBoxLockClick(box);
                return;
            }
        }
        this._events?.onToast('All boxes are unlocked!');
    }

    public revive(): void {
        if (!this._trayComp) return;
        DataManager.ins.status = GameStatus.RUNNING;
        this._isOver = false;
        this._inputBlocked = false;
        // Clear holding tray on revive so player can continue immediately
        const screws = this._trayComp.getScrews();
        if (screws.length > 0) {
            AudioManager.ins.play(AudioClips.SKILL_CLEAR);
            this._trayComp.clearAllPending();
            for (const sNode of screws) {
                const parts = sNode.name.split('_');
                this._screwRefreshArr.push([Number(parts[0]), Number(parts[1] || 0)]);
                this._trayComp.resetSingleTarget(sNode);
            }
        }
    }

    /**
     * Auto-play single step (ports original GbzLvNew.autoGame priority):
     * 1. Pick an unblocked visible screw matching an active non-full TargetBox (preferring boxes with more screws).
     * 2. Otherwise pick an unblocked visible screw if HoldingTray has room.
     * Returns action taken: 'box' | 'tray' | 'wait' | 'none'.
     */
    public autoStep(): string {
        if (DataManager.ins.status !== GameStatus.RUNNING || this._isOver || this._inputBlocked) {
            return 'wait';
        }
        if (!this._rootBoxes || !this._trayComp) return 'wait';

        const activeBoxes: TargetBox[] = [];
        for (const bNode of this._rootBoxes.children) {
            const box = bNode.getComponent(TargetBox);
            if (box && box.isActive() && !box.checkWillFull()) {
                activeBoxes.push(box);
            }
        }
        // Sort active boxes so boxes closest to 3/3 fill first
        activeBoxes.sort((a, b) => b.screwNum - a.screwNum);

        // Collect all unblocked visible screws
        const movable: { node: Node; color: number; worldPos: Vec2; boardScrews: number }[] = [];
        for (let i = 0; i < this._screws.length; i++) {
            const sNode = this._screws[i];
            if (!sNode || !sNode.isValid) continue;
            const parentOp = sNode.parent?.getComponent(UIOpacity);
            if (parentOp && parentOp.opacity <= 0) continue;
            const sComp = sNode.getComponent(ScrewNode);
            if (!sComp || !sComp.mainBoard) continue;
            const bComp = sComp.mainBoard.getComponent(BoardNode);
            if (!bComp || !bComp.isReady || bComp.notActive) continue;
            if (!this.canScrewMove(sNode)) continue;
            const ui = sNode.getComponent(UITransform);
            if (!ui) continue;
            const w3 = ui.convertToWorldSpaceAR(Vec3.ZERO);
            movable.push({
                node: sNode,
                color: sComp.colorId,
                worldPos: new Vec2(w3.x, w3.y),
                boardScrews: bComp.getScrews().length,
            });
        }

        if (movable.length === 0) return 'none';

        // 1. Prefer screw matching an active box (preferring boards with fewest screws so they drop faster)
        for (const box of activeBoxes) {
            const matches = movable.filter((m) => m.color === box.colorId);
            if (matches.length > 0) {
                matches.sort((a, b) => a.boardScrews - b.boardScrews);
                this.handleTap(matches[0].worldPos);
                return 'box';
            }
        }

        // 2. Otherwise put into HoldingTray if available (preferring boards with fewest screws to uncover lower layers)
        if (this._trayComp.isActive()) {
            movable.sort((a, b) => a.boardScrews - b.boardScrews);
            this.handleTap(movable[0].worldPos);
            return 'tray';
        }

        return 'none';
    }

    /**
     * Read-only human-like move selector: returns normalized screen coordinates [0..1, 0..1]
     * (from bottom-left of Canvas) of the best legal unblocked visible screw, without mutating state.
     * The external autoplay script performs a real mouse click on <canvas> at that coordinate.
     */
    public getBestLegalScrewNormalized(): { nx: number; ny: number; reason: 'box' | 'tray' } | null {
        if (DataManager.ins.status !== GameStatus.RUNNING || this._isOver || this._inputBlocked) {
            return null;
        }
        if (!this._rootBoxes || !this._trayComp) return null;

        const rootUi = this.node.getComponent(UITransform);
        if (!rootUi || rootUi.width <= 0 || rootUi.height <= 0) return null;

        const activeBoxes: TargetBox[] = [];
        for (const bNode of this._rootBoxes.children) {
            const box = bNode.getComponent(TargetBox);
            if (box && box.isActive() && !box.checkWillFull()) {
                activeBoxes.push(box);
            }
        }
        activeBoxes.sort((a, b) => b.screwNum - a.screwNum);

        const movable: { node: Node; color: number; nx: number; ny: number; boardScrews: number }[] = [];
        for (let i = 0; i < this._screws.length; i++) {
            const sNode = this._screws[i];
            if (!sNode || !sNode.isValid) continue;
            const parentOp = sNode.parent?.getComponent(UIOpacity);
            if (parentOp && parentOp.opacity <= 0) continue;
            const sComp = sNode.getComponent(ScrewNode);
            if (!sComp || !sComp.mainBoard) continue;
            const bComp = sComp.mainBoard.getComponent(BoardNode);
            if (!bComp || !bComp.isReady || bComp.notActive) continue;
            if (!this.canScrewMove(sNode)) continue;
            const sUi = sNode.getComponent(UITransform);
            if (!sUi) continue;
            const worldPos = sUi.convertToWorldSpaceAR(Vec3.ZERO);
            const localInRoot = rootUi.convertToNodeSpaceAR(worldPos);
            const nx = (localInRoot.x + rootUi.width * rootUi.anchorX) / rootUi.width;
            const ny = (localInRoot.y + rootUi.height * rootUi.anchorY) / rootUi.height;
            if (nx < 0.02 || nx > 0.98 || ny < 0.05 || ny > 0.95) continue;
            movable.push({
                node: sNode,
                color: sComp.colorId,
                nx,
                ny,
                boardScrews: bComp.getScrews().length,
            });
        }

        if (movable.length === 0) return null;

        // 1. Prefer unblocked screw matching an active box (boxes closest to full first, boards with fewest screws first)
        for (const box of activeBoxes) {
            const matches = movable.filter((m) => m.color === box.colorId);
            if (matches.length > 0) {
                matches.sort((a, b) => a.boardScrews - b.boardScrews);
                return { nx: matches[0].nx, ny: matches[0].ny, reason: 'box' };
            }
        }

        // 2. Otherwise pick unblocked screw for holding tray if available (prefer boards with fewest screws to drop & uncover)
        if (this._trayComp.isActive()) {
            movable.sort((a, b) => a.boardScrews - b.boardScrews);
            return { nx: movable[0].nx, ny: movable[0].ny, reason: 'tray' };
        }

        return null;
    }

    public getDebugState(): Record<string, unknown> {
        return {
            level: DataManager.ins.level,
            status: DataManager.ins.status,
            progress: Math.round(DataManager.ins.levelProgress * 100),
            compBoxes: this._compNum,
            totalBoxes: this._boxNum,
            remainingScrews: this._screws.length,
            remainingBoards: this._boards.length,
            trayEmpty: this._trayComp ? this._trayComp.checkNearFull() : 0,
            trayFull: this._trayComp ? this._trayComp.checkFull() : false,
            canUnlockSlot: this._trayComp ? this._trayComp.canUnlockSlot() : false,
            isOver: this._isOver,
        };
    }

    // ==================== Helpers ====================

    private updateProgress(): void {
        const p = this._boxNum > 0 ? Math.min(1, this._compNum / this._boxNum) : 1;
        DataManager.ins.levelProgress = p;
        this._events?.onProgressChanged(p);
    }

    private markPartRemoved(colorId: number, partIndex: number): void {
        if (partIndex >= 0 && partIndex < this._screwArrCopy.length && this._screwArrCopy[partIndex][0] === colorId) {
            this._screwArrCopy[partIndex][0] = -1;
        }
    }

    private refreshScrewColorMap(colorId: number): void {
        if (this._screwColorMap.has(colorId)) {
            this._screwColorMap.set(colorId, Math.max(0, (this._screwColorMap.get(colorId) || 0) - 3));
        }
    }

    private takeFromRefreshArr(colorId: number, maxCount: number): [number, number][] {
        const res: [number, number][] = [];
        for (let i = this._screwRefreshArr.length - 1; i >= 0 && res.length < maxCount; i--) {
            if (this._screwRefreshArr[i][0] === colorId) {
                res.push(this._screwRefreshArr.splice(i, 1)[0]);
            }
        }
        return res;
    }

    private getActiveBoxColors(): number[] {
        const res: number[] = [];
        if (!this._rootBoxes) return res;
        for (const bNode of this._rootBoxes.children) {
            const box = bNode.getComponent(TargetBox);
            if (box && box.node.active && !box.isLock()) {
                if (box.nextIndex > 0) res.push(box.nextIndex);
                else if (box.colorId > 0) res.push(box.colorId);
            }
        }
        return res;
    }

    private getNextBoxColor(): number {
        const boxColors = this.getActiveBoxColors();
        const trayPairs = this._trayComp ? this._trayComp.getScrewColorsAndParts() : [];

        // Gather candidate screws from tray + earliest remaining screws
        const candidates: [number, number][] = trayPairs.filter((p) => !boxColors.includes(p[0]));
        for (let i = 0; i < this._screwArrCopy.length && candidates.length < this._boxRandomColorNum; i++) {
            const item = this._screwArrCopy[i];
            if (item[0] !== -1 && !boxColors.includes(item[0]) && !candidates.some((c) => c[1] === item[1])) {
                candidates.push(item);
            }
        }
        if (candidates.length === 0) {
            for (let i = 0; i < this._screwArrCopy.length && candidates.length < this._boxRandomColorNum; i++) {
                const item = this._screwArrCopy[i];
                if (item[0] !== -1) candidates.push(item);
            }
        }

        const counts = new Map<number, number>();
        for (const item of candidates) {
            const col = item[0];
            if ((this._screwColorMap.get(col) || 0) >= 3) {
                counts.set(col, (counts.get(col) || 0) + 1);
            }
        }
        if (counts.size === 0) {
            this._screwColorMap.forEach((cnt, col) => {
                if (cnt >= 3) counts.set(col, 1);
            });
        }
        const keys = Array.from(counts.keys());
        if (keys.length === 0) return 1;
        if (keys.length === 1) return keys[0];

        const weights = keys.map((k) => {
            const c = counts.get(k) || 1;
            const idx = Math.min(this._colorsWeight.length - 1, c - 1);
            return this._colorsWeight[idx] * c * this._colorsRatio[idx];
        });
        return keys[this.randomWeight(weights)];
    }

    private randomWeight(weights: number[]): number {
        let total = 0;
        for (const w of weights) total += w;
        if (total <= 0) return 0;
        let r = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
        return weights.length - 1;
    }

    private shuffleArray<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    /** Adjust top target boxes & holding tray for iPhone Dynamic Island / Android notch Safe Area. */
    public applySafeArea(topInset: number): void {
        const extra = Math.max(0, Math.min(72, Math.round(topInset)));
        const rbW = this._rootBoxes?.getComponent(Widget);
        if (rbW) {
            rbW.top = 98 + extra;
            rbW.updateAlignment();
        }
        const biW = this._boxInLayer?.getComponent(Widget);
        if (biW) {
            biW.top = 98 + extra;
            biW.updateAlignment();
        }
        const trW = this._trayNode?.getComponent(Widget);
        if (trW) {
            trW.top = 304 + extra;
            trW.updateAlignment();
        }
        if (this._boardsContainer) {
            this._boardsContainer.setPosition(0, -45 - Math.round(extra * 0.45), 0);
        }
    }

    /** Live-refresh all active boards, screws, boxes, and holding tray when player switches themes. */
    public refreshThemeVisuals(): void {
        const palette = ThemeManager.ins.getBoardPalette();
        this._allColors = [...palette, ...palette, ...palette];
        const frameCol = ThemeManager.ins.getBoardFrameColor();

        for (const bNode of this._boards) {
            if (!bNode || !bNode.isValid) continue;
            const bComp = bNode.getComponent(BoardNode);
            if (!bComp || bComp.notActive) continue;
            const frameSp = bNode.getComponent(Sprite);
            const innerSp = bNode.getChildByName('board')?.getComponent(Sprite);
            if (frameSp) frameSp.color = frameCol.clone();
            if (innerSp) {
                innerSp.color = new Color().fromHEX(this._allColors[bComp.rootBoardsIndex % this._allColors.length]);
            }
        }
        for (const sNode of this._screws) {
            if (!sNode || !sNode.isValid) continue;
            sNode.getComponent(ScrewNode)?.applyThemeSprite();
        }
        if (this._rootBoxes) {
            for (const bNode of this._rootBoxes.children) {
                bNode.getComponent(TargetBox)?.refreshTheme();
            }
        }
        this._trayComp?.refreshTheme();
    }

    /** Golden 4-point candy star sparkles popping from the cookie hole on unscrew! */
    private spawnCandySparkles(localPos: Vec3): void {
        if (!this._fxLayer) return;
        const offsets: [number, number, number][] = [
            [-28, 22, 13], [30, 26, 11], [-18, 44, 9], [22, -16, 10],
        ];
        for (let i = 0; i < offsets.length; i++) {
            const [ox, oy, r] = offsets[i];
            const sp = new Node(`sparkle_${i}`);
            sp.setParent(this._fxLayer);
            sp.setPosition(localPos.x + ox * 0.4, localPos.y + oy * 0.4, 0);
            sp.setScale(0.2, 0.2, 1);
            const g = sp.addComponent(Graphics);
            g.fillColor = i % 2 === 0 ? new Color(255, 246, 168, 255) : new Color(255, 255, 255, 255);
            g.moveTo(0, r);
            g.lineTo(r * 0.28, r * 0.28);
            g.lineTo(r, 0);
            g.lineTo(r * 0.28, -r * 0.28);
            g.lineTo(0, -r);
            g.lineTo(-r * 0.28, -r * 0.28);
            g.lineTo(-r, 0);
            g.lineTo(-r * 0.28, r * 0.28);
            g.close();
            g.fill();
            const op = sp.addComponent(UIOpacity);
            op.opacity = 255;

            tween(sp)
                .to(0.16, {
                    position: new Vec3(localPos.x + ox, localPos.y + oy + 18, 0),
                    scale: new Vec3(1.15, 1.15, 1),
                    angle: 45,
                }, { easing: 'quadOut' })
                .to(0.22, { scale: new Vec3(0.1, 0.1, 1), angle: 90 }, { easing: 'quadIn' })
                .call(() => {
                    if (sp.isValid) sp.destroy();
                })
                .start();
            tween(op).delay(0.16).to(0.22, { opacity: 0 }).start();
        }
    }

    /** Sweet Dessert ASMR burst: golden biscuit crumbs & pastel sugar sprinkles when a cookie board drops. */
    private spawnCookieCrumbs(worldPos: Vec3): void {
        if (!this._fxLayer) return;
        const fxUi = this._fxLayer.getComponent(UITransform);
        if (!fxUi) return;
        const local = fxUi.convertToNodeSpaceAR(worldPos);
        const startX = Math.max(-280, Math.min(280, local.x));
        const startY = Math.max(-460, Math.min(180, local.y + 120));
        const crumbColors = ['#e6a15c', '#f5c78e', '#ff9ec4', '#ffe28a', '#95ecc7', '#ffffff'];

        for (let i = 0; i < 12; i++) {
            const p = new Node(`crumb_${i}`);
            p.setParent(this._fxLayer);
            p.setPosition(startX + (Math.random() - 0.5) * 90, startY + (Math.random() - 0.5) * 40, 0);
            const sz = 8 + Math.random() * 10;
            const g = p.addComponent(Graphics);
            g.fillColor = new Color().fromHEX(crumbColors[i % crumbColors.length]);
            if (i % 3 === 0) {
                g.roundRect(-sz * 0.8, -sz * 0.35, sz * 1.6, sz * 0.7, sz * 0.3);
            } else {
                g.circle(0, 0, sz * 0.55);
            }
            g.fill();
            const op = p.addComponent(UIOpacity);
            op.opacity = 240;

            const dx = (Math.random() - 0.5) * 210;
            const dy = 70 + Math.random() * 130;
            const dur = 0.42 + Math.random() * 0.25;
            tween(p)
                .to(dur, {
                    position: new Vec3(p.position.x + dx, p.position.y + dy - 160, 0),
                    angle: (Math.random() - 0.5) * 420,
                    scale: new Vec3(0.3, 0.3, 1),
                }, { easing: 'quadOut' })
                .call(() => {
                    if (p.isValid) p.destroy();
                })
                .start();
            tween(op).delay(dur * 0.45).to(dur * 0.55, { opacity: 0 }).start();
        }
    }
}
