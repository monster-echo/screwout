import { DataManager } from '../core/DataManager';
import { HDArtManifestItem, ResManager } from '../core/ResManager';

export interface PixelArtDef {
    id: string;
    title: string;
    gridSize: number;
    total: number;
    cells: [number, number, number][]; // [col, row, colorId] sorted top-to-bottom
}

const FALLBACK_ARTS: PixelArtDef[] = [
    { id: 'lucky_cat', title: 'Lucky Cat', gridSize: 28, total: 1, cells: [[14, 14, 1]] },
];

export class PixelGalleryService {
    public static getAllArts(): PixelArtDef[] {
        const list: HDArtManifestItem[] = ResManager.ins.artManifest;
        return list.length > 0 ? list : FALLBACK_ARTS;
    }

    public static getActiveArt(): PixelArtDef {
        const all = this.getAllArts();
        const id = DataManager.ins.gallery.activeArtId;
        return all.find((a) => a.id === id) || all[0];
    }

    public static setActiveArt(id: string): void {
        if (this.getAllArts().some((a) => a.id === id)) {
            DataManager.ins.gallery.activeArtId = id;
            DataManager.ins.save();
        }
    }

    public static getFilledCount(artId: string): number {
        const art = this.getAllArts().find((a) => a.id === artId);
        if (!art) return 0;
        return Math.min(art.cells.length, DataManager.ins.gallery.filledCounts[artId] || 0);
    }

    public static isCompleted(artId: string): boolean {
        const art = this.getAllArts().find((a) => a.id === artId);
        if (!art) return false;
        return this.getFilledCount(artId) >= art.cells.length;
    }

    public static getCompletedTotal(): number {
        return this.getAllArts().filter((a) => this.isCompleted(a.id)).length;
    }

    /** Compute the vertical fill fraction (0..1) corresponding to `filledCount` cells */
    public static getVerticalFillRatio(art: PixelArtDef, filledCount: number): number {
        if (filledCount <= 0 || art.cells.length === 0) return 0;
        if (filledCount >= art.cells.length) return 1;
        const lastCell = art.cells[Math.min(art.cells.length - 1, filledCount - 1)];
        const row = lastCell[1];
        return Math.max(0.02, Math.min(1, (row + 1) / art.gridSize));
    }
}
