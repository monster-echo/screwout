import { DataManager } from '../core/DataManager';

export interface PixelCell {
    row: number;
    col: number;
    colorId: number; // 1..10 matching gbz_screw1..gbz_screw10
}

export interface PixelArtDef {
    id: string;
    title: string;
    theme: string;
    gridSize: number;
    rewardCoins: number;
    cells: PixelCell[];
}

/**
 * Compact ASCII-to-screw-color parser:
 * '.' = empty, '1'..'9' = screw 1..9, 'A' = screw 10
 * Color map reminder:
 * 1: Coral Red, 2: Lemon Yellow, 3: Emerald Green, 4: Cobalt Blue,
 * 5: Royal Purple, 6: Sunset Orange, 7: Hot Pink, 8: Cyan, 9: Teal/Lime, 10: Slate
 */
function parsePattern(rows: string[]): PixelCell[] {
    const cells: PixelCell[] = [];
    for (let r = 0; r < rows.length; r++) {
        const line = rows[r];
        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (ch === '.' || ch === ' ') continue;
            const colorId = ch === 'A' ? 10 : Number(ch);
            if (colorId >= 1 && colorId <= 10) {
                cells.push({ row: r, col: c, colorId });
            }
        }
    }
    return cells;
}

export const PIXEL_GALLERY: PixelArtDef[] = [
    {
        id: 'lucky_cat',
        title: 'Lucky Cat',
        theme: 'Classic Charm',
        gridSize: 9,
        rewardCoins: 150,
        cells: parsePattern([
            '.2.....2.',
            '272...272',
            '222222222',
            '2A22222A2',
            '222272222',
            '.1112111.',
            '.2222222.',
            '.2266622.',
            '..22.22..',
        ]),
    },
    {
        id: 'space_rocket',
        title: 'Star Rocket',
        theme: 'Sci-Fi Adventure',
        gridSize: 9,
        rewardCoins: 180,
        cells: parsePattern([
            '....1....',
            '...111...',
            '...484...',
            '..48884..',
            '..44444..',
            '.1444441.',
            '11.444.11',
            '...626...',
            '....2....',
        ]),
    },
    {
        id: 'sweet_cupcake',
        title: 'Berry Cupcake',
        theme: 'Cozy Bakery',
        gridSize: 9,
        rewardCoins: 200,
        cells: parsePattern([
            '....1....',
            '...777...',
            '..77277..',
            '.7777777.',
            '.7277727.',
            '..66666..',
            '..62626..',
            '...666...',
            '.........',
        ]),
    },
    {
        id: 'royal_crown',
        title: 'Gem Crown',
        theme: 'Royal Treasure',
        gridSize: 9,
        rewardCoins: 220,
        cells: parsePattern([
            '.........',
            '2...2...2',
            '22.212.22',
            '222222222',
            '282252282',
            '222222222',
            '.1111111.',
            '.2222222.',
            '.........',
        ]),
    },
    {
        id: 'emerald_cactus',
        title: 'Desert Bloom',
        theme: 'Botanical',
        gridSize: 9,
        rewardCoins: 240,
        cells: parsePattern([
            '....7....',
            '...333...',
            '.3.333.3.',
            '33.333.33',
            '333333333',
            '...333...',
            '..66666..',
            '...666...',
            '...666...',
        ]),
    },
    {
        id: 'cozy_cottage',
        title: 'Cozy Cottage',
        theme: 'Dream Home',
        gridSize: 9,
        rewardCoins: 300,
        cells: parsePattern([
            '....1....',
            '...111...',
            '..11111..',
            '.1111111.',
            '.2288822.',
            '.2288822.',
            '.2226222.',
            '.2226222.',
            '333333333',
        ]),
    },
];

export class PixelGalleryService {
    public static getActiveArt(): PixelArtDef {
        const id = DataManager.ins.gallery.activeArtId;
        return PIXEL_GALLERY.find((a) => a.id === id) || PIXEL_GALLERY[0];
    }

    public static setActiveArt(id: string): void {
        if (PIXEL_GALLERY.some((a) => a.id === id)) {
            DataManager.ins.gallery.activeArtId = id;
            DataManager.ins.save();
        }
    }

    public static getFilledCount(artId: string): number {
        const art = PIXEL_GALLERY.find((a) => a.id === artId);
        if (!art) return 0;
        return Math.min(art.cells.length, DataManager.ins.gallery.filledCounts[artId] || 0);
    }

    public static isCompleted(artId: string): boolean {
        const art = PIXEL_GALLERY.find((a) => a.id === artId);
        if (!art) return false;
        return this.getFilledCount(artId) >= art.cells.length;
    }

    public static getCompletedTotal(): number {
        return PIXEL_GALLERY.filter((a) => this.isCompleted(a.id)).length;
    }

    /**
     * Spend up to `maxBolts` (default 5) from DataManager.ins.bolts to build the artwork.
     * Automatically grants completion reward once finished!
     */
    public static buildArt(artId: string, maxBolts = 5): {
        placed: number;
        justCompleted: boolean;
        rewardCoins: number;
    } {
        const art = PIXEL_GALLERY.find((a) => a.id === artId);
        if (!art) return { placed: 0, justCompleted: false, rewardCoins: 0 };

        const cur = this.getFilledCount(artId);
        const remain = art.cells.length - cur;
        if (remain <= 0) return { placed: 0, justCompleted: false, rewardCoins: 0 };

        const avail = DataManager.ins.bolts;
        if (avail <= 0) return { placed: 0, justCompleted: false, rewardCoins: 0 };

        const toPlace = Math.min(maxBolts, remain, avail);
        DataManager.ins.spendBolts(toPlace);
        const nextCount = cur + toPlace;
        DataManager.ins.gallery.filledCounts[artId] = nextCount;

        let justCompleted = false;
        let rewardCoins = 0;
        if (nextCount >= art.cells.length && !DataManager.ins.gallery.claimedRewards.includes(artId)) {
            DataManager.ins.gallery.claimedRewards.push(artId);
            DataManager.ins.addCoins(art.rewardCoins);
            DataManager.ins.skillCounts.clear += 1;
            justCompleted = true;
            rewardCoins = art.rewardCoins;
        }
        DataManager.ins.save();
        return { placed: toPlace, justCompleted, rewardCoins };
    }
}
