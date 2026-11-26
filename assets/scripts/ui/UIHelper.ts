import { BlockInputEvents, Color, Graphics, Label, Node, UITransform, Vec3 } from 'cc';

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
    const g = node.addComponent(Graphics);
    const col = new Color().fromHEX(bgHex);
    col.a = alpha;
    g.fillColor = col;
    if (radius > 0) {
        g.roundRect(-w / 2, -h / 2, w, h, radius);
    } else {
        g.rect(-w / 2, -h / 2, w, h);
    }
    g.fill();
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
    radius = 16,
): Node {
    const btn = createPanel(name, parent, w, h, bgHex, 255, radius, false);
    createLabel('label', btn, text, fontSize, textHex, w - 12, h - 8);
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
