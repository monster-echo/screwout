export enum GameStatus {
    MENU = 'MENU',
    RUNNING = 'RUNNING',
    PAUSED = 'PAUSED',
    WIN = 'WIN',
    LOSE = 'LOSE',
}

export enum SkillType {
    UNLOCK_SLOT = 0,   // 加孔位 (额外暂存槽)
    CLEAR_TRAY = 1,    // 清空暂存槽
    SMASH_BOARD = 2,   // 砸碎/融化一块挡板
    UNLOCK_BOX = 3,    // 解锁一个目标盒
}

export const AudioClips = {
    GAME_CLICK: 'game_click',
    GAME_LOSE: 'game_lose',
    GAME_TIMER: 'game_timer',
    GAME_WIN: 'game_win',
    SKILL_CLEAR: 'skill_clear',
    SKILL_REMOVE: 'skill_remove',
    SKILL_UNLOCK: 'skill_unlock',
    SCREW_IN: 'screw_in',
    SCREW_OUT: 'screw_out',
    SCREW_EMPTY: 'screw_empty',
    BLOCK_REMOVE: 'block_remove',
    BOX_FULL: 'box_full',
    GET_GOLD: 'get_gold',
    CLICK_ERROR: 'clickerror2',
    RELOADING: 'reloading',
} as const;

export type AudioClipKey = typeof AudioClips[keyof typeof AudioClips];

export type ThemeId = 'dessert';

export interface ThemeConfig {
    id: ThemeId;
    name: string;
    subtitle: string;
    boardPalette: string[];
    frameTintHex: string;
    useGummyBounce: boolean;
    useCrumbParticles: boolean;
}

/** Frosted sugar-cookie royal icing palette (creamy pastel tones that make 10 vivid gummy screws pop!) */
export const DESSERT_BOARD_PALETTE: string[] = [
    '#fff3e6', // Vanilla cream glaze (hero cookie color!)
    '#ffb8da', // Strawberry pink frosting
    '#d9b8ff', // Lavender taro icing
    '#b8f2e0', // Pistachio mint icing
    '#ffe99e', // Honey lemon cream
    '#ffc9a8', // Apricot peach icing
    '#bde6ff', // Cotton candy sky icing
    '#ffa8c8', // Berry rose glaze
    '#d6f2a8', // Matcha cream icing
];

/** Exact candy colors matching dessert_screw1..10 (used for colored gummy screw shafts & fallback tints) */
export const SCREW_FALLBACK_COLORS: string[] = [
    '#ffffff',
    '#f42b3d', // 1: Cherry Gummy Red
    '#ffd21f', // 2: Lemon-Honey Yellow
    '#28c754', // 3: Apple-Mint Green
    '#3486ff', // 4: Blueberry Soda Blue
    '#a64dff', // 5: Grape Gummy Purple
    '#ff8418', // 6: Tangerine Orange
    '#ff6bb5', // 7: Strawberry Pink
    '#14d9c8', // 8: Mint-Teal Cyan
    '#fff4e4', // 9: Vanilla Pearl
    '#7c4527', // 10: Glossy Cocoa Chocolate
];

export interface BoardData {
    name: string;
    pos: [number, number];
    angle: number;
    scale: [number, number];
    size: [number, number];
    frameSprite: string;
    boardSprite: string;
    boardSize: [number, number];
    boardPos: [number, number];
    boardAngle?: number;
    polygon: [number, number][];
    holes: [number, number][];
}

export interface LayerData {
    name: string;
    boards: BoardData[];
}

export interface LevelData {
    name: string;
    totalHoles: number;
    layers: LayerData[];
}

export interface DifficultyConfig {
    difficulty: string;
    color_count: number[];
    progress: number[];
}

export const TOTAL_LEVELS = 101;
