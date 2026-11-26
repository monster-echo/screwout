import { AudioClip, AudioSource, Node, resources } from 'cc';
import { DataManager } from './DataManager';

export class AudioManager {
    private static _ins: AudioManager | null = null;
    public static get ins(): AudioManager {
        if (!this._ins) {
            this._ins = new AudioManager();
        }
        return this._ins;
    }

    private _source: AudioSource | null = null;
    private _clips: Map<string, AudioClip> = new Map();
    private _loaded = false;

    public init(hostNode: Node): void {
        if (!this._source) {
            this._source = hostNode.getComponent(AudioSource) || hostNode.addComponent(AudioSource);
        }
    }

    public loadAll(): Promise<void> {
        if (this._loaded) return Promise.resolve();
        return new Promise((resolve) => {
            const infos = resources.getDirWithPath('audio', AudioClip);
            const uuidToName = new Map<string, string>();
            for (const info of infos) {
                const segs = info.path.split('/');
                const fname = segs[segs.length - 1];
                if (fname) {
                    uuidToName.set(info.uuid, fname);
                }
            }
            resources.loadDir('audio', AudioClip, (err, clips) => {
                if (!err && clips) {
                    for (const clip of clips) {
                        const name = uuidToName.get(clip.uuid) || clip.name;
                        if (name) {
                            this._clips.set(name, clip);
                        }
                    }
                }
                console.log(`[AudioManager] loaded clips=${this._clips.size}`);
                this._loaded = true;
                resolve();
            });
        });
    }

    public play(clipName: string, volume = 1.0): void {
        if (!DataManager.ins.soundEnabled) return;
        if (!this._source) return;
        const clip = this._clips.get(clipName);
        if (clip) {
            this._source.playOneShot(clip, volume);
        }
    }
}
