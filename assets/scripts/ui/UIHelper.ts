import { BlockInputEvents, Color, Label, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { ResManager } from '../core/ResManager';

const _slicedCache = new Map<string, SpriteFrame>();

function getUiBaseFrame(name: string, insetLR = 0, insetTB = 0): SpriteFrame | null {
    const key = `${name}_${insetLR}_${insetTB}`;
    const cached = _slicedCache.get(key);
    if (cached && cached.isValid) return cached;

    const src = ResManager.ins.getUiSprite(name);
    if (!src) return null;

    if (insetLR > 0 || insetTB > 0) {
        const sf = src.clone();
        sf.insetLeft = insetLR;
        sf.insetRight = insetLR;
        sf.insetTop = insetTB;
        sf.insetBottom = insetTB;
        _slicedCache.set(key, sf);
        return sf;
    }
    _slicedCache.set(key, src);
    return src;
}

export function setPanelColor(node: Node | null, bgHex: string, alpha = 255): void {
    if (!node || !node.isValid) return;
    const sp = node.getComponent(Sprite);
    if (!sp) return;
    const col = new Color().fromHEX(bgHex);
    col.a = alpha;
    sp.color = col;
}

export function createPanel(
    name: string,
    parent: Node,
    w: number,
    h: number,
    bgHex: string,
    alpha = 255,
    radius = 18,
    blockInput = false,
): Node {
    const node = new Node(name);
    node.setParent(parent);
    const ui = node.addComponent(UITransform);
    ui.setContentSize(w, h);

    // When alpha < 255 (e.g. modal backdrop dimmer), place Sprite on a dedicated child node
    // so Cocos 3.8 Sprite.color.a never cascades translucency onto popup cards & buttons!
    let targetNode = node;
    if (alpha < 255) {
        const bgNode = new Node('panel_bg');
        bgNode.setParent(node);
        const bgUi = bgNode.addComponent(UITransform);
        bgUi.setContentSize(w, h);
        targetNode = bgNode;
    }

    const sp = targetNode.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;

    const isCircle = radius > 0 && Math.abs(w - h) <= 4 && radius >= Math.min(w, h) * 0.45;
    if (radius <= 0) {
        const sf = getUiBaseFrame('ui_white_rect');
        if (sf) sp.spriteFrame = sf;
        sp.type = Sprite.Type.SIMPLE;
    } else if (isCircle) {
        const sf = getUiBaseFrame('ui_white_circle');
        if (sf) sp.spriteFrame = sf;
        sp.type = Sprite.Type.SIMPLE;
    } else {
        const inset = Math.min(24, Math.max(8, Math.floor(Math.min(w, h) * 0.42)));
        const sf = getUiBaseFrame('ui_white_panel', inset, inset);
        if (sf) sp.spriteFrame = sf;
        sp.type = Sprite.Type.SLICED;
    }

    const col = new Color().fromHEX(bgHex);
    col.a = alpha;
    sp.color = col;

    if (blockInput) {
        node.addComponent(BlockInputEvents);
    }
    return node;
}

export function createLabel(
    name: string,
    parent: Node,
    text: string,
    fontSize = 28,
    colorHex = '#ffffff',
    w = 300,
    h = 44,
): Label {
    const node = new Node(name);
    node.setParent(parent);
    const ui = node.addComponent(UITransform);
    ui.setContentSize(w, h);
    const lbl = node.addComponent(Label);
    lbl.string = text;
    lbl.fontSize = fontSize;
    lbl.lineHeight = fontSize + 8;
    lbl.color = new Color().fromHEX(colorHex);
    lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
    lbl.verticalAlign = Label.VerticalAlign.CENTER;
    return lbl;
}

export function createButton(
    name: string,
    parent: Node,
    text: string,
    w: number,
    h: number,
    bgHex: string,
    onClick: () => void,
    fontSize = 26,
    textHex = '#ffffff',
    _radius = 16,
): Node {
    const btn = new Node(name);
    btn.setParent(parent);
    const ui = btn.addComponent(UITransform);
    ui.setContentSize(w, h);

    const sp = btn.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    const insetLR = Math.min(34, Math.max(10, Math.floor(w * 0.35)));
    const insetTB = Math.min(22, Math.max(8, Math.floor(h * 0.40)));
    const sf = getUiBaseFrame('ui_white_pill_btn', insetLR, insetTB);
    if (sf) {
        sp.spriteFrame = sf;
        sp.type = Sprite.Type.SLICED;
    } else {
        const fallback = getUiBaseFrame('ui_white_panel', 26, 26);
        if (fallback) {
            sp.spriteFrame = fallback;
            sp.type = Sprite.Type.SLICED;
        }
    }
    sp.color = new Color().fromHEX(bgHex);

    const lbl = createLabel('label', btn, text, fontSize, textHex, w - 16, h - 10);
    lbl.isBold = true;
    lbl.node.setPosition(0, 2, 0);

    btn.on(Node.EventType.TOUCH_START, () => {
        btn.setScale(0.95, 0.95, 1);
    });
    btn.on(Node.EventType.TOUCH_CANCEL, () => {
        btn.setScale(Vec3.ONE);
    });
    btn.on(Node.EventType.TOUCH_END, () => {
        btn.setScale(Vec3.ONE);
        onClick();
    });
    return btn;
}
