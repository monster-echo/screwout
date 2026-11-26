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

/** Original 9-color pastel palette for stacked glass/acrylic boards */
export const BOARD_PALETTE: string[] = [
    '#91f99e',
    '#dbff86',
    '#8de8fc',
    '#8ec0ff',
    '#b189ff',
    '#fca2e3',
    '#ff8080',
    '#ffb777',
    '#ffe775',
];

/** Fallback tint colors for screw/box color IDs 1..10 */
export const SCREW_FALLBACK_COLORS: string[] = [
    '#ffffff',
    '#ff4d4f', // 1 red
    '#ffa940', // 2 orange
    '#ffec3d', // 3 yellow
    '#73d13d', // 4 green
    '#36cfc9', // 5 cyan
    '#40a9ff', // 6 blue
    '#9254de', // 7 purple
    '#f759ab', // 8 pink
    '#8c6239', // 9 brown
    '#d9d9d9', // 10 silver
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
