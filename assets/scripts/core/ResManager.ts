import { ImageAsset, JsonAsset, resources, sp, SpriteFrame } from 'cc';
import { DifficultyConfig, LevelData } from './GameTypes';

export interface HDArtManifestItem {
    id: string;
    title: string;
    gridSize: number;
    total: number;
    cells: [number, number, number][]; // [col, row, colorId]
}

export class ResManager {
    private static _ins: ResManager | null = null;
    public static get ins(): ResManager {
        if (!this._ins) {
            this._ins = new ResManager();
        }
        return this._ins;
    }

    private _gameSprites: Map<string, SpriteFrame> = new Map();
    private _boardSprites: Map<string, SpriteFrame> = new Map();
    private _uiSprites: Map<string, SpriteFrame> = new Map();
    private _paintSprites: Map<string, SpriteFrame> = new Map();
    private _difficultyConfigs: DifficultyConfig[] = [];
    private _artManifest: HDArtManifestItem[] = [];
    private _touchSpine: sp.SkeletonData | null = null;
    private _coreLoaded = false;

    public async loadCoreAssets(): Promise<void> {
        if (this._coreLoaded) return;
        await Promise.all([
            this.loadImageDirAsSprites('sprites/games', this._gameSprites),
            this.loadImageDirAsSprites('sprites/boards', this._boardSprites),
            this.loadImageDirAsSprites('sprites/ui_orig', this._uiSprites),
            this.loadImageDirAsSprites('paint', this._paintSprites),
            this.loadDifficultyConfig(),
            this.loadArtManifest(),
            this.loadSpineAsset('spine/touch/touch').then((d) => { this._touchSpine = d; }),
        ]);
        console.log(
            `[ResManager] loaded games=${this._gameSprites.size}, boards=${this._boardSprites.size}, ui=${this._uiSprites.size}, paint=${this._paintSprites.size}, arts=${this._artManifest.length}, touchSpine=${!!this._touchSpine}`,
        );
        this._coreLoaded = true;
    }

    private loadImageDirAsSprites(dir: string, target: Map<string, SpriteFrame>): Promise<void> {
        return new Promise((resolve) => {
            const infos = resources.getDirWithPath(dir, ImageAsset);
            const uuidToName = new Map<string, string>();
            for (const info of infos) {
                const segs = info.path.split('/');
                const fname = segs[segs.length - 1];
                if (fname) {
                    uuidToName.set(info.uuid, fname);
                }
            }
            resources.loadDir(dir, ImageAsset, (err, images) => {
                if (!err && images && images.length > 0) {
                    for (const img of images) {
                        const name = uuidToName.get(img.uuid) || img.name;
                        if (!name) continue;
                        const sf = SpriteFrame.createWithImage(img);
                        sf.name = name;
                        target.set(name, sf);
                    }
                    resolve();
                    return;
                }
                // Fallback: try SpriteFrame directly if images were imported as sprite-frame
                resources.loadDir(dir, SpriteFrame, (err2, frames) => {
                    if (!err2 && frames) {
                        for (const sf of frames) {
                            target.set(sf.name, sf);
                        }
                    }
                    resolve();
                });
            });
        });
    }

    private loadDifficultyConfig(): Promise<void> {
        return new Promise((resolve) => {
            resources.load('config/difficulty', JsonAsset, (err, asset) => {
                if (!err && asset && Array.isArray(asset.json)) {
                    this._difficultyConfigs = asset.json as DifficultyConfig[];
                } else {
                    this._difficultyConfigs = [
                        { difficulty: '简单', color_count: [4, 5, 6, 7, 8, 9, 10], progress: [15, 20, 30, 40, 50, 60, 100] },
                        { difficulty: '正常', color_count: [4, 5, 6, 7, 8, 9, 10], progress: [10, 20, 25, 30, 40, 55, 100] },
                        { difficulty: '困难', color_count: [4, 5, 6, 7, 8, 9, 10], progress: [10, 15, 25, 30, 35, 40, 100] },
                        { difficulty: '极难', color_count: [5, 6, 7, 8, 9, 9, 10], progress: [10, 15, 25, 30, 35, 40, 100] },
                    ];
                }
                resolve();
            });
        });
    }

    private loadArtManifest(): Promise<void> {
        return new Promise((resolve) => {
            resources.load('config/art_manifest', JsonAsset, (err, asset) => {
                if (!err && asset && Array.isArray(asset.json)) {
                    this._artManifest = asset.json as HDArtManifestItem[];
                }
                resolve();
            });
        });
    }

    private loadSpineAsset(path: string): Promise<sp.SkeletonData | null> {
        return new Promise((resolve) => {
            resources.load(path, sp.SkeletonData, (err, data) => {
                resolve(!err && data ? data : null);
            });
        });
    }

    public loadLevel(levelIndex: number): Promise<LevelData | null> {
        return new Promise((resolve) => {
            resources.load(`levels/lv_${levelIndex}`, JsonAsset, (err, asset) => {
                if (!err && asset && asset.json) {
                    resolve(asset.json as LevelData);
                } else {
                    resolve(null);
                }
            });
        });
    }

    public getGameSprite(name: string): SpriteFrame | null {
        return this._gameSprites.get(name) || this._uiSprites.get(name) || null;
    }

    public getBoardSprite(name: string): SpriteFrame | null {
        return this._boardSprites.get(name) || null;
    }

    public getUiSprite(name: string): SpriteFrame | null {
        return this._uiSprites.get(name) || this._gameSprites.get(name) || null;
    }

    public getPaintSprite(name: string): SpriteFrame | null {
        return this._paintSprites.get(name) || null;
    }

    public get artManifest(): HDArtManifestItem[] {
        return this._artManifest;
    }

    public getDifficultyConfig(level: number): DifficultyConfig {
        const list = this._difficultyConfigs;
        if (list.length === 0) {
            return { difficulty: '简单', color_count: [4, 5, 6, 7, 8, 9, 10], progress: [15, 20, 30, 40, 50, 60, 100] };
        }
        const idx = level <= 6 ? 0 : (Math.random() <= 0.6 ? 1 : Math.min(2, list.length - 1));
        return list[idx] || list[0];
    }

    public get touchSpine(): sp.SkeletonData | null {
        return this._touchSpine;
    }
}
