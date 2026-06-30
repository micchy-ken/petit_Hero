import Phaser from 'phaser';
import { generateHeroSpritesheet } from './HeroSpritesheet';
import { generateSlimeSpritesheet } from './MonsterSpritesheets';
// @ts-ignore
import grassBgUrl from '../../public/grass_bg_1782776475818.jpg';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | 'idle';

export interface HeroState {
  gridX: number;
  gridY: number;
  camGridX: number;
  camGridY: number;
  direction: Direction;
  isMoving: boolean;
  isScrolling: boolean;
  speedMs: number;
  hp: number;
  maxHp: number;
  attack: number;
  level: number;
  exp: number;
}

interface SlimeData {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  targetGridX?: number;
  targetGridY?: number;
  isMoving: boolean;
  hp: number;
  maxHp: number;
}

export interface ActionLog {
  id: string;
  message: string;
  type: 'info' | 'combat' | 'system' | 'damage';
}

export class GridMovementScene extends Phaser.Scene {
  public static readonly GRID_SIZE = 64;
  public static readonly GRID_COLS = 16;
  public static readonly GRID_ROWS = 16;
  public static readonly VIEWPORT_COLS = 7;
  public static readonly VIEWPORT_ROWS = 7;

  private hero!: Phaser.GameObjects.Sprite;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private targetMarker!: Phaser.GameObjects.Graphics;
  private hd2dLighting!: Phaser.GameObjects.Graphics;
  private vignetteOverlay!: Phaser.GameObjects.Graphics;
  private particleMotes!: Phaser.GameObjects.Arc[];
  private grassBgImage?: Phaser.GameObjects.Image;
  private useGrassBg: boolean = true;
  private allow8Way: boolean = false;
  private isTextMode: boolean = true;
  private displayMode: 'normal' | 'text' | 'grayscale' = 'text';
  private slimes: SlimeData[] = [];

  // 状態管理
  private currentGridX: number = 7; // 16x16の中央付近(7,7)
  private currentGridY: number = 7;
  private heroTargetGridX: number | null = null;
  private heroTargetGridY: number | null = null;
  private currentCamGridX: number = 4; // 7x7画面の中央に(7,7)が来るようカメラ左上を(4,4)に設定
  private currentCamGridY: number = 4;
  private isMoving: boolean = false;
  private currentDirection: Direction = 'idle';
  
  // 設定
  private moveSpeedMs: number = 1000; // 1グリッド移動にかかる時間(ms)
  private autoMode: 'none' | 'random' | 'seek' = 'seek';
  private showGridLines: boolean = true;
  private isHd2dEffectsEnabled: boolean = false;

  // ヒーローステータス
  private heroHp: number = 20;
  private heroMaxHp: number = 20;
  private heroAttack: number = 5;
  private heroLevel: number = 1;
  private heroExp: number = 0;

  // Pointer Movement
  private pointerTargetGridX: number | null = null;
  private pointerTargetGridY: number | null = null;

  // Keyboard Movement
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: any;

  // Virtual Pad Movement
  private virtualInput = { up: false, down: false, left: false, right: false };

  public setVirtualInput(dir: 'up'|'down'|'left'|'right', isDown: boolean) {
    this.virtualInput[dir] = isDown;
  }

  // Reactコールバック用
  private onStateChangeCallback?: (state: HeroState) => void;
  private onLogCallback?: (log: ActionLog) => void;

  constructor() {
    super({ key: 'GridMovementScene' });
  }

  public setOnStateChange(callback: (state: HeroState) => void) {
    this.onStateChangeCallback = callback;
    this.notifyStateChange();
  }

  public setOnLog(callback: (log: ActionLog) => void) {
    this.onLogCallback = callback;
  }

  public sendLog(message: string, type: ActionLog['type'] = 'info') {
    if (this.onLogCallback) {
      this.onLogCallback({
        id: Math.random().toString(36).substring(2, 9),
        message,
        type
      });
    }
  }

  preload() {
    this.load.image('grass_bg', grassBgUrl);
    generateHeroSpritesheet(this, 'normal');
    generateHeroSpritesheet(this, 'text');
    generateHeroSpritesheet(this, 'grayscale');
    generateSlimeSpritesheet(this, 'normal');
    generateSlimeSpritesheet(this, 'text');
    generateSlimeSpritesheet(this, 'grayscale');
  }

  create() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;

    // カメラ境界を設定
    this.cameras.main.setBounds(0, 0, GRID_COLS * GRID_SIZE, GRID_ROWS * GRID_SIZE);
    this.cameras.main.scrollX = this.currentCamGridX * GRID_SIZE;
    this.cameras.main.scrollY = this.currentCamGridY * GRID_SIZE;

    // 1. 背景画像とグリッドの作成
    this.grassBgImage = this.add.image(0, 0, 'grass_bg').setOrigin(0, 0);
    this.grassBgImage.setDepth(-1);
    this.createGridBackground();

    // 2. HD-2D 環境光＆ゴッドレイ風オーバーレイ (カメラ固定)
    this.hd2dLighting = this.add.graphics();
    this.hd2dLighting.setDepth(2);
    this.hd2dLighting.setScrollFactor(0, 0);
    this.drawHd2dLighting();

    // 3. 移動先ターゲットのマーカー
    this.targetMarker = this.add.graphics();
    this.targetMarker.setDepth(3);

    // 4. アニメーション定義 (4方向 × 4フレーム)
    const dirs: { key: Direction; row: number }[] = [
      { key: 'down', row: 0 },
      { key: 'up', row: 1 },
      { key: 'left', row: 2 },
      { key: 'right', row: 3 }
    ];

    dirs.forEach(({ key, row }) => {
      const startFrame = row * 4;
      
      // normal textures
      this.anims.create({
        key: `walk-${key}`,
        frames: this.anims.generateFrameNumbers('hero_spritesheet', {
          start: startFrame,
          end: startFrame + 3
        }),
        frameRate: 8,
        repeat: -1
      });

      this.anims.create({
        key: `idle-${key}`,
        frames: [{ key: 'hero_spritesheet', frame: startFrame }],
        frameRate: 1
      });

      // text mode textures
      this.anims.create({
        key: `walk-${key}-text`,
        frames: this.anims.generateFrameNumbers('hero_spritesheet_text', {
          start: startFrame,
          end: startFrame + 3
        }),
        frameRate: 8,
        repeat: -1
      });

      this.anims.create({
        key: `idle-${key}-text`,
        frames: [{ key: 'hero_spritesheet_text', frame: startFrame }],
        frameRate: 1
      });

      // grayscale mode textures
      this.anims.create({
        key: `walk-${key}-gray`,
        frames: this.anims.generateFrameNumbers('hero_spritesheet_gray', {
          start: startFrame,
          end: startFrame + 3
        }),
        frameRate: 8,
        repeat: -1
      });

      this.anims.create({
        key: `idle-${key}-gray`,
        frames: [{ key: 'hero_spritesheet_gray', frame: startFrame }],
        frameRate: 1
      });
    });

    // スライムのアニメーション
    this.anims.create({
      key: 'slime-idle',
      frames: [{ key: 'slime_spritesheet', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'slime-shake',
      frames: this.anims.generateFrameNumbers('slime_spritesheet', { start: 1, end: 2 }),
      frameRate: 12,
      repeat: -1
    });
    this.anims.create({
      key: 'slime-jump',
      frames: [{ key: 'slime_spritesheet', frame: 3 }],
      frameRate: 1
    });

    // スライムのアニメーション (text mode)
    this.anims.create({
      key: 'slime-idle-text',
      frames: [{ key: 'slime_spritesheet_text', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'slime-shake-text',
      frames: this.anims.generateFrameNumbers('slime_spritesheet_text', { start: 1, end: 2 }),
      frameRate: 12,
      repeat: -1
    });
    this.anims.create({
      key: 'slime-jump-text',
      frames: [{ key: 'slime_spritesheet_text', frame: 3 }],
      frameRate: 1
    });

    // スライムのアニメーション (grayscale mode)
    this.anims.create({
      key: 'slime-idle-gray',
      frames: [{ key: 'slime_spritesheet_gray', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'slime-shake-gray',
      frames: this.anims.generateFrameNumbers('slime_spritesheet_gray', { start: 1, end: 2 }),
      frameRate: 12,
      repeat: -1
    });
    this.anims.create({
      key: 'slime-jump-gray',
      frames: [{ key: 'slime_spritesheet_gray', frame: 3 }],
      frameRate: 1
    });

    // 5. 勇者スプライト配置
    const startX = this.currentGridX * GRID_SIZE + GRID_SIZE / 2;
    const startY = this.currentGridY * GRID_SIZE + GRID_SIZE / 2;

    this.hero = this.add.sprite(startX, startY, 'hero_spritesheet', 0);
    this.hero.setDepth(10);
    this.hero.play(this.getAnimKey('idle-down'));

    // 5.5. スライムの配置
    this.slimes = [];
    for (let i = 0; i < 5; i++) {
      const sx = Phaser.Math.Between(2, GRID_COLS - 3);
      const sy = Phaser.Math.Between(2, GRID_ROWS - 3);
      const slimeSprite = this.add.sprite(sx * GRID_SIZE + GRID_SIZE / 2, sy * GRID_SIZE + GRID_SIZE / 2, 'slime_spritesheet', 0);
      slimeSprite.setDepth(9); // 勇者より少し奥
      slimeSprite.play(this.getAnimKey('slime-idle'));
      
      this.slimes.push({
        id: `slime-${Math.random().toString(36).substring(2, 9)}`,
        sprite: slimeSprite,
        gridX: sx,
        gridY: sy,
        isMoving: false,
        hp: 10,
        maxHp: 10
      });
    }

    // 6. HD-2D マナ粒子（ホタル風パーティクル）の生成（カメラ固定領域内で生成）
    this.particleMotes = [];
    for (let i = 0; i < 20; i++) {
      const px = Phaser.Math.Between(0, VIEWPORT_COLS * GRID_SIZE);
      const py = Phaser.Math.Between(0, VIEWPORT_ROWS * GRID_SIZE);
      const radius = Phaser.Math.FloatBetween(1, 2.8);
      const color = Phaser.Math.RND.pick([0xfef08a, 0xa5f3fc, 0xffffff, 0xbbf7d0]);
      
      const mote = this.add.circle(px, py, radius, color, Phaser.Math.FloatBetween(0.3, 0.85));
      mote.setDepth(15);
      mote.setScrollFactor(0, 0); // 常に画面内に表示
      this.particleMotes.push(mote);

      // ふわふわ漂うトゥイーン
      this.startMoteAnimation(mote);
    }

    // 7. HD-2D ヴィネット（シネマティック枠）(カメラ固定)
    this.vignetteOverlay = this.add.graphics();
    this.vignetteOverlay.setDepth(20);
    this.vignetteOverlay.setScrollFactor(0, 0);
    this.drawVignette();

    // 8. 初回ステータス通知
    this.notifyStateChange();

    // 9. キーボード入力の初期化
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = this.input.keyboard.addKeys('W,S,A,D');
    }

    // 10. ポインター入力による移動処理
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.autoMode !== 'none') {
        this.pointerTargetGridX = null;
        this.pointerTargetGridY = null;
        return;
      }
      
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const targetGridX = Math.floor(worldPoint.x / GridMovementScene.GRID_SIZE);
      const targetGridY = Math.floor(worldPoint.y / GridMovementScene.GRID_SIZE);
      
      // フィールド範囲内か確認
      if (targetGridX >= 0 && targetGridX < GridMovementScene.GRID_COLS &&
          targetGridY >= 0 && targetGridY < GridMovementScene.GRID_ROWS) {
        this.pointerTargetGridX = targetGridX;
        this.pointerTargetGridY = targetGridY;
        this.sendLog(`Moving to (${targetGridX}, ${targetGridY})`, 'system');
      }
    });

    // 10. AI/自動移動タイマー
    this.time.addEvent({
      delay: 100,
      callback: this.checkAndMoveRandomly,
      callbackScope: this,
      loop: true
    });

    // 初期表示設定の適用
    this.setDisplayMode(this.displayMode);
    this.toggleHd2dEffects(this.isHd2dEffectsEnabled);
  }

  public update(time: number, delta: number) {
    if (this.autoMode === 'none' && !this.isMoving) {
      let moved = false;
      
      const up = this.cursors?.up.isDown || this.wasdKeys?.W.isDown || this.virtualInput.up;
      const down = this.cursors?.down.isDown || this.wasdKeys?.S.isDown || this.virtualInput.down;
      const left = this.cursors?.left.isDown || this.wasdKeys?.A.isDown || this.virtualInput.left;
      const right = this.cursors?.right.isDown || this.wasdKeys?.D.isDown || this.virtualInput.right;

      if (this.allow8Way) {
        if (up && left) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('up-left');
          moved = true;
        } else if (up && right) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('up-right');
          moved = true;
        } else if (down && left) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('down-left');
          moved = true;
        } else if (down && right) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('down-right');
          moved = true;
        }
      }

      if (!moved) {
        if (up) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('up');
        } else if (down) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('down');
        } else if (left) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('left');
        } else if (right) {
          this.pointerTargetGridX = null;
          this.pointerTargetGridY = null;
          this.moveInDirection('right');
        }
      }
    }
  }

  private startMoteAnimation(mote: Phaser.GameObjects.Arc) {
    const targetX = mote.x + Phaser.Math.Between(-40, 40);
    const targetY = mote.y - Phaser.Math.Between(20, 60);
    const duration = Phaser.Math.Between(3000, 7000);

    this.tweens.add({
      targets: mote,
      x: targetX,
      y: targetY,
      alpha: { from: mote.alpha, to: 0.1 },
      duration: duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        const { GRID_SIZE, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;
        mote.setPosition(Phaser.Math.Between(0, VIEWPORT_COLS * GRID_SIZE), VIEWPORT_ROWS * GRID_SIZE + 10);
        mote.setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
        this.startMoteAnimation(mote);
      }
    });
  }

  private createGridBackground() {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(0);
    this.drawGrid();
  }

  private drawGrid() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;
    this.gridGraphics.clear();

    if (this.grassBgImage) {
      this.grassBgImage.setVisible(this.displayMode === 'normal' && this.useGrassBg);
    }

    if (this.displayMode === 'text') {
      if (this.showGridLines) {
        this.gridGraphics.lineStyle(1, 0xffffff, 0.3);
        for (let i = 0; i <= GRID_ROWS; i++) {
          this.gridGraphics.moveTo(0, i * GRID_SIZE);
          this.gridGraphics.lineTo(GRID_COLS * GRID_SIZE, i * GRID_SIZE);
        }
        for (let i = 0; i <= GRID_COLS; i++) {
          this.gridGraphics.moveTo(i * GRID_SIZE, 0);
          this.gridGraphics.lineTo(i * GRID_SIZE, GRID_ROWS * GRID_SIZE);
        }
        this.gridGraphics.strokePath();
      }
      return;
    }

    if (this.displayMode === 'grayscale') {
      // Background is white
      this.gridGraphics.fillStyle(0xffffff, 1);
      this.gridGraphics.fillRect(0, 0, GRID_COLS * GRID_SIZE, GRID_ROWS * GRID_SIZE);

      // Draw occasional stones
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const landmarkHash = (row * 37 + col * 17) % 13;
          if (landmarkHash === 4 || landmarkHash === 8) {
            const ox = col * GRID_SIZE + 24;
            const oy = row * GRID_SIZE + 24;
            // Stone Outline
            this.gridGraphics.fillStyle(0x444444, 1);
            this.gridGraphics.fillRect(ox, oy, 12, 8);
            this.gridGraphics.fillRect(ox + 2, oy - 2, 8, 12);
            // Stone Body
            this.gridGraphics.fillStyle(0x888888, 1);
            this.gridGraphics.fillRect(ox + 2, oy, 8, 6);
            this.gridGraphics.fillRect(ox + 4, oy - 1, 4, 8);
            // Highlight
            this.gridGraphics.fillStyle(0xdddddd, 1);
            this.gridGraphics.fillRect(ox + 4, oy, 2, 2);
          }
        }
      }

      if (this.showGridLines) {
        this.gridGraphics.lineStyle(1, 0xcccccc, 0.7);
        for (let i = 0; i <= GRID_ROWS; i++) {
          this.gridGraphics.moveTo(0, i * GRID_SIZE);
          this.gridGraphics.lineTo(GRID_COLS * GRID_SIZE, i * GRID_SIZE);
        }
        for (let i = 0; i <= GRID_COLS; i++) {
          this.gridGraphics.moveTo(i * GRID_SIZE, 0);
          this.gridGraphics.lineTo(i * GRID_SIZE, GRID_ROWS * GRID_SIZE);
        }
        this.gridGraphics.strokePath();
      }
      return;
    }

    if (this.useGrassBg) {
      if (this.showGridLines) {
        this.gridGraphics.lineStyle(1, 0xffffff, 0.15);
        for (let i = 0; i <= GRID_ROWS; i++) {
          this.gridGraphics.moveTo(0, i * GRID_SIZE);
          this.gridGraphics.lineTo(GRID_COLS * GRID_SIZE, i * GRID_SIZE);
        }
        for (let i = 0; i <= GRID_COLS; i++) {
          this.gridGraphics.moveTo(i * GRID_SIZE, 0);
          this.gridGraphics.lineTo(i * GRID_SIZE, GRID_ROWS * GRID_SIZE);
        }
        this.gridGraphics.strokePath();
      }
      return;
    }

    // HD-2D風 深みのある森の芝生タイル（微細な濃淡トーン）
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isEven = (row + col) % 2 === 0;
        const color = isEven ? 0x064e3b : 0x065f46; // ダークエメラルド
        this.gridGraphics.fillStyle(color, 1);
        this.gridGraphics.fillRect(col * GRID_SIZE, row * GRID_SIZE, GRID_SIZE, GRID_SIZE);

        // タイル内側のハイライト（立体感）
        if (this.isHd2dEffectsEnabled) {
          this.gridGraphics.fillStyle(0x34d399, isEven ? 0.08 : 0.04);
          this.gridGraphics.fillRect(col * GRID_SIZE + 2, row * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
        }

        // スクロール時の現在地把握に役立つ自然のランドマーク配置
        const landmarkHash = (row * 37 + col * 17) % 13;
        if (landmarkHash === 1) {
          // 小さな黄・白の花
          this.gridGraphics.fillStyle(0xfef08a, 0.75);
          this.gridGraphics.fillCircle(col * GRID_SIZE + 20, row * GRID_SIZE + 24, 3.5);
          this.gridGraphics.fillStyle(0xffffff, 0.85);
          this.gridGraphics.fillCircle(col * GRID_SIZE + 16, row * GRID_SIZE + 21, 2);
          this.gridGraphics.fillCircle(col * GRID_SIZE + 24, row * GRID_SIZE + 21, 2);
        } else if (landmarkHash === 4) {
          // 森の小石
          this.gridGraphics.fillStyle(0x334155, 0.8);
          this.gridGraphics.fillRoundedRect(col * GRID_SIZE + 40, row * GRID_SIZE + 42, 10, 6, 2);
          this.gridGraphics.fillStyle(0x475569, 0.5);
          this.gridGraphics.fillRoundedRect(col * GRID_SIZE + 41, row * GRID_SIZE + 43, 8, 3, 1);
        } else if (landmarkHash === 7) {
          // 小さなシダ植物
          this.gridGraphics.fillStyle(0x10b981, 0.55);
          this.gridGraphics.fillRect(col * GRID_SIZE + 14, row * GRID_SIZE + 46, 4, 10);
          this.gridGraphics.fillRect(col * GRID_SIZE + 20, row * GRID_SIZE + 44, 4, 12);
        }
      }
    }

    // 16x16フィールド全体の外枠ボーダー
    this.gridGraphics.lineStyle(4, 0x047857, 0.9);
    this.gridGraphics.strokeRect(1, 1, GRID_COLS * GRID_SIZE - 2, GRID_ROWS * GRID_SIZE - 2);

    // グリッド線
    if (this.showGridLines) {
      this.gridGraphics.lineStyle(1, 0x10b981, 0.35);
      for (let i = 0; i <= GRID_COLS; i++) {
        this.gridGraphics.lineBetween(i * GRID_SIZE, 0, i * GRID_SIZE, GRID_ROWS * GRID_SIZE);
      }
      for (let j = 0; j <= GRID_ROWS; j++) {
        this.gridGraphics.lineBetween(0, j * GRID_SIZE, GRID_COLS * GRID_SIZE, j * GRID_SIZE);
      }
    }
  }

  private drawHd2dLighting() {
    const { GRID_SIZE, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;
    const totalW = VIEWPORT_COLS * GRID_SIZE; // 448
    const totalH = VIEWPORT_ROWS * GRID_SIZE; // 448
    this.hd2dLighting.clear();

    if (!this.isHd2dEffectsEnabled) return;

    // 左上からの陽光（サンライト・ゴッドレイ）
    this.hd2dLighting.fillStyle(0xfef08a, 0.12);
    this.hd2dLighting.fillTriangle(0, 0, totalW * 0.7, 0, 0, totalH * 0.7);

    this.hd2dLighting.fillStyle(0x38bdf8, 0.08);
    this.hd2dLighting.fillTriangle(totalW, 0, totalW, totalH, 0, totalH);
  }

  private drawVignette() {
    const { GRID_SIZE, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;
    const totalW = VIEWPORT_COLS * GRID_SIZE;
    const totalH = VIEWPORT_ROWS * GRID_SIZE;

    this.vignetteOverlay.clear();
    if (!this.isHd2dEffectsEnabled) return;

    // 周辺減光（ヴィネットフレーム）
    const frameSize = 38;
    this.vignetteOverlay.fillStyle(0x022c22, 0.45);
    this.vignetteOverlay.fillRect(0, 0, totalW, frameSize);
    this.vignetteOverlay.fillRect(0, totalH - frameSize, totalW, frameSize);
    this.vignetteOverlay.fillRect(0, frameSize, frameSize, totalH - frameSize * 2);
    this.vignetteOverlay.fillRect(totalW - frameSize, frameSize, frameSize, totalH - frameSize * 2);
  }

  private getAnimKey(baseKey: string): string {
    if (this.displayMode === 'text') {
      return `${baseKey}-text`;
    } else if (this.displayMode === 'grayscale') {
      return `${baseKey}-gray`;
    }
    return baseKey;
  }

  public toggleTextMode(enabled?: boolean) {
    const nextMode = (enabled !== undefined ? enabled : !this.isTextMode) ? 'text' : 'normal';
    this.setDisplayMode(nextMode);
  }

  public setDisplayMode(mode: 'normal' | 'text' | 'grayscale') {
    this.displayMode = mode;
    this.isTextMode = (mode === 'text');
    
    // 背景色の変更
    if (this.displayMode === 'text') {
      this.cameras.main.setBackgroundColor('#000000');
    } else if (this.displayMode === 'grayscale') {
      this.cameras.main.setBackgroundColor('#ffffff');
    } else {
      this.cameras.main.setBackgroundColor('#ecfdf5'); // default background color
    }

    // テクスチャの変更
    let heroTexture = 'hero_spritesheet';
    if (this.displayMode === 'text') heroTexture = 'hero_spritesheet_text';
    else if (this.displayMode === 'grayscale') heroTexture = 'hero_spritesheet_gray';
    this.hero.setTexture(heroTexture);
    
    let slimeTexture = 'slime_spritesheet';
    if (this.displayMode === 'text') slimeTexture = 'slime_spritesheet_text';
    else if (this.displayMode === 'grayscale') slimeTexture = 'slime_spritesheet_gray';
    this.slimes.forEach(slime => {
      slime.sprite.setTexture(slimeTexture);
    });

    // アニメーションを即時更新
    const currentAnimKey = this.hero.anims.currentAnim?.key;
    if (currentAnimKey) {
      let baseKey = currentAnimKey;
      if (baseKey.endsWith('-text')) baseKey = baseKey.replace('-text', '');
      else if (baseKey.endsWith('-gray')) baseKey = baseKey.replace('-gray', '');
      this.hero.play(this.getAnimKey(baseKey), true);
    }

    this.slimes.forEach(slime => {
      const sAnimKey = slime.sprite.anims.currentAnim?.key;
      if (sAnimKey) {
        let baseKey = sAnimKey;
        if (baseKey.endsWith('-text')) baseKey = baseKey.replace('-text', '');
        else if (baseKey.endsWith('-gray')) baseKey = baseKey.replace('-gray', '');
        slime.sprite.play(this.getAnimKey(baseKey), true);
      }
    });

    // 描画の更新
    this.drawGrid();
  }

  public toggleGridLines(show?: boolean) {
    this.showGridLines = show !== undefined ? show : !this.showGridLines;
    this.drawGrid();
  }

  public toggleHd2dEffects(enabled?: boolean) {
    this.isHd2dEffectsEnabled = enabled !== undefined ? enabled : !this.isHd2dEffectsEnabled;
    this.drawGrid();
    this.drawHd2dLighting();
    this.drawVignette();
    this.particleMotes.forEach(m => m.setVisible(this.isHd2dEffectsEnabled));
  }

  public toggleGrassBg(enabled?: boolean) {
    this.useGrassBg = enabled !== undefined ? enabled : !this.useGrassBg;
    this.drawGrid();
  }

  public toggle8WayMode(enabled?: boolean) {
    this.allow8Way = enabled !== undefined ? enabled : !this.allow8Way;
  }

  public setAutoMode(mode: 'none' | 'random' | 'seek') {
    this.autoMode = mode;
  }

  public setSpeed(speedMs: number) {
    this.moveSpeedMs = speedMs;
    const frameRate = Math.max(4, Math.round(3600 / speedMs));
    ['up', 'down', 'left', 'right'].forEach(dir => {
      ['', '-text', '-gray'].forEach(suffix => {
        const anim = this.anims.get(`walk-${dir}${suffix}`);
        if (anim) {
          anim.frameRate = frameRate;
        }
      });
    });
  }

  private checkAndMoveRandomly() {
    if (this.autoMode === 'none') {
      if (this.pointerTargetGridX !== null && this.pointerTargetGridY !== null) {
        if (!this.isMoving) {
          const dx = this.pointerTargetGridX - this.currentGridX;
          const dy = this.pointerTargetGridY - this.currentGridY;
          if (dx === 0 && dy === 0) {
            this.pointerTargetGridX = null;
            this.pointerTargetGridY = null;
          } else {
            const possibleDirs: Direction[] = [];
            if (this.allow8Way) {
              if (dx > 0 && dy > 0) possibleDirs.push('down-right');
              else if (dx > 0 && dy < 0) possibleDirs.push('up-right');
              else if (dx < 0 && dy > 0) possibleDirs.push('down-left');
              else if (dx < 0 && dy < 0) possibleDirs.push('up-left');
              else if (dx > 0) possibleDirs.push('right');
              else if (dx < 0) possibleDirs.push('left');
              else if (dy > 0) possibleDirs.push('down');
              else if (dy < 0) possibleDirs.push('up');
            } else {
              if (dx > 0) possibleDirs.push('right');
              else if (dx < 0) possibleDirs.push('left');
              if (dy > 0) possibleDirs.push('down');
              else if (dy < 0) possibleDirs.push('up');
            }
            
            if (possibleDirs.length > 0) {
              const nextDir = Phaser.Utils.Array.GetRandom(possibleDirs);
              this.moveInDirection(nextDir);
            }
          }
        }
      }
    }

    // スライムの補充
    if (this.slimes.length < 5 && Math.random() < 0.1) {
      const sx = Phaser.Math.Between(2, GridMovementScene.GRID_COLS - 3);
      const sy = Phaser.Math.Between(2, GridMovementScene.GRID_ROWS - 3);
      // 空いているマスに湧く
      if (!this.isTileOccupied(sx, sy)) {
        const { GRID_SIZE } = GridMovementScene;
        const slimeSprite = this.add.sprite(sx * GRID_SIZE + GRID_SIZE / 2, sy * GRID_SIZE + GRID_SIZE / 2, 'slime_spritesheet', 0);
        slimeSprite.setDepth(9);
        slimeSprite.play(this.getAnimKey('slime-idle'));
        
        this.slimes.push({
          id: `slime-${Math.random().toString(36).substring(2, 9)}`,
          sprite: slimeSprite,
          gridX: sx,
          gridY: sy,
          isMoving: false,
          hp: 10,
          maxHp: 10
        });
        this.sendLog('A wild slime appeared!', 'system');
      }
    }

    // 勇者の自動移動
    if (this.autoMode !== 'none' && !this.isMoving) {
      if (this.autoMode === 'seek') {
        // 索敵・戦闘モード (AIを使わないロジック)
        if (this.slimes.length > 0) {
          // 最も近いスライムを探す
          let closestSlime: SlimeData | null = null;
          let minDistance = Infinity;

          this.slimes.forEach(slime => {
            const dist = Math.abs(slime.gridX - this.currentGridX) + Math.abs(slime.gridY - this.currentGridY);
            if (dist < minDistance) {
              minDistance = dist;
              closestSlime = slime;
            }
          });

          if (closestSlime) {
            // 最も近いスライムに近づく方向を決定
            const possibleDirs: Direction[] = [];
            const sx = closestSlime.gridX;
            const sy = closestSlime.gridY;
            const dx = sx - this.currentGridX;
            const dy = sy - this.currentGridY;

            if (this.allow8Way) {
              if (dx > 0 && dy > 0) possibleDirs.push('down-right');
              else if (dx > 0 && dy < 0) possibleDirs.push('up-right');
              else if (dx < 0 && dy > 0) possibleDirs.push('down-left');
              else if (dx < 0 && dy < 0) possibleDirs.push('up-left');
              else if (dx > 0) possibleDirs.push('right');
              else if (dx < 0) possibleDirs.push('left');
              else if (dy > 0) possibleDirs.push('down');
              else if (dy < 0) possibleDirs.push('up');
            } else {
              if (dx > 0) possibleDirs.push('right');
              else if (dx < 0) possibleDirs.push('left');
              if (dy > 0) possibleDirs.push('down');
              else if (dy < 0) possibleDirs.push('up');
            }

            if (possibleDirs.length > 0) {
              // 複数ある場合はランダムに一つ選ぶ
              const nextDir = Phaser.Utils.Array.GetRandom(possibleDirs);
              this.moveInDirection(nextDir);
            }
          }
        } else {
          // 敵がいない場合はランダム散策
          this.performRandomWalk();
        }
      } else {
        // 通常のランダムウォーク
        this.performRandomWalk();
      }
    }

    // スライムのランダム移動
    this.slimes.forEach(slime => {
      if (slime.isMoving) return;
      if (Math.random() > 0.3) return; // 30%の確率で動く

      const slimeDirs: Direction[] = [];
      if (slime.gridY > 0) slimeDirs.push('up');
      if (slime.gridY < GridMovementScene.GRID_ROWS - 1) slimeDirs.push('down');
      if (slime.gridX > 0) slimeDirs.push('left');
      if (slime.gridX < GridMovementScene.GRID_COLS - 1) slimeDirs.push('right');

      if (slimeDirs.length > 0) {
        const nextDir = Phaser.Utils.Array.GetRandom(slimeDirs);
        this.moveSlime(slime, nextDir);
      }
    });
  }

  private performRandomWalk() {
    const possibleDirs: Direction[] = [];
    if (this.currentGridY > 0) possibleDirs.push('up');
    if (this.currentGridY < GridMovementScene.GRID_ROWS - 1) possibleDirs.push('down');
    if (this.currentGridX > 0) possibleDirs.push('left');
    if (this.currentGridX < GridMovementScene.GRID_COLS - 1) possibleDirs.push('right');
    
    if (this.allow8Way) {
      if (this.currentGridY > 0 && this.currentGridX > 0) possibleDirs.push('up-left');
      if (this.currentGridY > 0 && this.currentGridX < GridMovementScene.GRID_COLS - 1) possibleDirs.push('up-right');
      if (this.currentGridY < GridMovementScene.GRID_ROWS - 1 && this.currentGridX > 0) possibleDirs.push('down-left');
      if (this.currentGridY < GridMovementScene.GRID_ROWS - 1 && this.currentGridX < GridMovementScene.GRID_COLS - 1) possibleDirs.push('down-right');
    }

    if (possibleDirs.length > 0) {
      const nextDir = Phaser.Utils.Array.GetRandom(possibleDirs);
      this.moveInDirection(nextDir);
    }
  }

  private performAttack(slimeIndex: number) {
    const slime = this.slimes[slimeIndex];
    if (!slime) {
      this.isMoving = false;
      return;
    }

    const damage = Math.max(1, this.heroAttack - 1); // Simple damage calc
    slime.hp -= damage;
    this.sendLog(`Hero hit Slime for ${damage} damage!`, 'combat');

    // 攻撃エフェクト
    const slash = this.add.graphics();
    slash.setDepth(15);
    slash.lineStyle(4, 0xfacc15, 1);
    const sx = slime.sprite.x - 20;
    const sy = slime.sprite.y - 20;
    const ex = slime.sprite.x + 20;
    const ey = slime.sprite.y + 20;
    slash.beginPath();
    slash.moveTo(sx, sy);
    slash.lineTo(ex, ey);
    slash.strokePath();
    
    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 300,
      onComplete: () => slash.destroy()
    });

    // ちょっとだけ前進して戻る（バンプ）
    const origX = this.hero.x;
    const origY = this.hero.y;
    const dx = (slime.sprite.x - origX) * 0.3;
    const dy = (slime.sprite.y - origY) * 0.3;

    this.tweens.add({
      targets: this.hero,
      x: origX + dx,
      y: origY + dy,
      duration: 100,
      yoyo: true,
      onComplete: () => {
        this.hero.play(this.getAnimKey(`idle-${this.currentDirection}`), true);
        this.isMoving = false;

        if (slime.hp <= 0) {
          this.sendLog(`Slime was defeated! Gained 2 EXP.`, 'info');
          this.heroExp += 2;
          if (this.heroExp >= 10) {
            this.heroLevel++;
            this.heroExp = 0;
            this.heroMaxHp += 5;
            this.heroHp = this.heroMaxHp;
            this.heroAttack += 2;
            this.sendLog(`Level Up! You are now level ${this.heroLevel}.`, 'system');
          }
          
          this.tweens.add({
            targets: slime.sprite,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              if (slime.sprite && slime.sprite.active) slime.sprite.destroy();
            }
          });
          const currentIdx = this.slimes.indexOf(slime);
          if (currentIdx !== -1) {
            this.slimes.splice(currentIdx, 1);
          }
        }
        this.notifyStateChange(false);
      }
    });
  }

  private performSlimeAttack(slime: SlimeData) {
    slime.isMoving = true;
    slime.sprite.play(this.getAnimKey('slime-jump'));

    const origX = slime.sprite.x;
    const origY = slime.sprite.y;
    const dx = (this.hero.x - origX) * 0.3;
    const dy = (this.hero.y - origY) * 0.3;

    this.tweens.add({
      targets: slime.sprite,
      x: origX + dx,
      y: origY + dy,
      duration: 150,
      yoyo: true,
      onComplete: () => {
        if (slime.sprite && slime.sprite.active) {
          slime.sprite.play(this.getAnimKey('slime-idle'));
        }
        slime.isMoving = false;
        
        const damage = 2; // Fixed damage for now
        this.heroHp = Math.max(0, this.heroHp - damage);
        this.sendLog(`Slime attacked Hero for ${damage} damage!`, 'damage');
        
        // 画面フラッシュ
        this.cameras.main.flash(200, 255, 0, 0);
        
        this.notifyStateChange(false);

        if (this.heroHp <= 0) {
          this.sendLog(`Hero was defeated...`, 'system');
          // 本当はゲームオーバー処理を入れる
          this.time.delayedCall(1000, () => {
             this.heroHp = this.heroMaxHp;
             this.sendLog(`Hero was revived!`, 'system');
             this.notifyStateChange(false);
          });
        }
      }
    });
  }

  private isTileOccupied(x: number, y: number): boolean {
    if (this.currentGridX === x && this.currentGridY === y) return true;
    if (this.heroTargetGridX === x && this.heroTargetGridY === y) return true;
    for (const s of this.slimes) {
      if (s.gridX === x && s.gridY === y) return true;
      if (s.targetGridX === x && s.targetGridY === y) return true;
    }
    return false;
  }

  private moveSlime(slime: SlimeData, dir: Direction) {
    if (slime.isMoving) return;

    let targetGridX = slime.gridX;
    let targetGridY = slime.gridY;

    switch (dir) {
      case 'up': targetGridY -= 1; break;
      case 'down': targetGridY += 1; break;
      case 'left': targetGridX -= 1; break;
      case 'right': targetGridX += 1; break;
      case 'up-left': targetGridY -= 1; targetGridX -= 1; break;
      case 'up-right': targetGridY -= 1; targetGridX += 1; break;
      case 'down-left': targetGridY += 1; targetGridX -= 1; break;
      case 'down-right': targetGridY += 1; targetGridX += 1; break;
    }

    // 勇者への攻撃判定
    if ((targetGridX === this.currentGridX && targetGridY === this.currentGridY) || 
        (targetGridX === this.heroTargetGridX && targetGridY === this.heroTargetGridY)) {
      this.performSlimeAttack(slime);
      return;
    }
    // 全てのキャラクターとの重なり防止
    if (this.isTileOccupied(targetGridX, targetGridY)) return;

    slime.isMoving = true;
    slime.targetGridX = targetGridX;
    slime.targetGridY = targetGridY;
    slime.sprite.play(this.getAnimKey('slime-shake')); // プルプル震える

    const { GRID_SIZE } = GridMovementScene;
    const targetX = targetGridX * GRID_SIZE + GRID_SIZE / 2;
    const targetY = targetGridY * GRID_SIZE + GRID_SIZE / 2;

    // プルプルする時間 (移動速度の30%程度、最大150ms)
    const shakeDuration = Math.min(150, this.moveSpeedMs * 0.3);
    const moveDuration = this.moveSpeedMs - shakeDuration;

    this.time.delayedCall(shakeDuration, () => {
      if (!slime.sprite || !slime.sprite.active) return;
      slime.sprite.play(this.getAnimKey('slime-jump')); // 移動中のフレーム
      this.tweens.add({
        targets: slime.sprite,
        x: targetX,
        y: targetY,
        duration: moveDuration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          slime.gridX = targetGridX;
          slime.gridY = targetGridY;
          slime.targetGridX = undefined;
          slime.targetGridY = undefined;
          slime.isMoving = false;
          if (slime.sprite && slime.sprite.active) {
            slime.sprite.play(this.getAnimKey('slime-idle'));
          }
        }
      });
    });
  }

  public moveInDirection(dir: Direction): boolean {
    if (this.isMoving || dir === 'idle') return false;

    let targetGridX = this.currentGridX;
    let targetGridY = this.currentGridY;

    switch (dir) {
      case 'up': targetGridY -= 1; break;
      case 'down': targetGridY += 1; break;
      case 'left': targetGridX -= 1; break;
      case 'right': targetGridX += 1; break;
      case 'up-left': targetGridY -= 1; targetGridX -= 1; break;
      case 'up-right': targetGridY -= 1; targetGridX += 1; break;
      case 'down-left': targetGridY += 1; targetGridX -= 1; break;
      case 'down-right': targetGridY += 1; targetGridX += 1; break;
    }

    if (
      targetGridX < 0 || targetGridX >= GridMovementScene.GRID_COLS ||
      targetGridY < 0 || targetGridY >= GridMovementScene.GRID_ROWS
    ) {
      return false;
    }

    const { VIEWPORT_COLS, VIEWPORT_ROWS, GRID_COLS, GRID_ROWS, GRID_SIZE } = GridMovementScene;
    
    // スライムとの戦闘判定
    const targetSlimeIndex = this.slimes.findIndex(s => 
      (s.gridX === targetGridX && s.gridY === targetGridY) || 
      (s.targetGridX === targetGridX && s.targetGridY === targetGridY)
    );
    
    if (targetSlimeIndex !== -1) {
      this.isMoving = true;
      this.currentDirection = dir;
      
      let animDir = 'down';
      if (dir.includes('left')) animDir = 'left';
      else if (dir.includes('right')) animDir = 'right';
      else if (dir.includes('up')) animDir = 'up';
      else if (dir.includes('down')) animDir = 'down';
      
      this.hero.play(this.getAnimKey(`walk-${animDir}`), true);
      this.performAttack(targetSlimeIndex);
      return true;
    }

    // 全てのキャラクターとの重なり防止
    if (this.isTileOccupied(targetGridX, targetGridY)) return false;

    // カメラのデッドゾーン（中心5x5グリッド内はカメラ固定、それ以外はスクロール）計算
    const maxCamGridX = GRID_COLS - VIEWPORT_COLS; // 16 - 7 = 9
    const maxCamGridY = GRID_ROWS - VIEWPORT_ROWS; // 9

    let targetCamGridX = this.currentCamGridX;
    let targetCamGridY = this.currentCamGridY;

    const nextViewX = targetGridX - this.currentCamGridX;
    const nextViewY = targetGridY - this.currentCamGridY;

    // 7x7画面インデックス(0~6)。中心は3。中心±2(インデックス1~5)は固定、0または6に進む場合にスクロール
    if (nextViewX > 5) {
      if (this.currentCamGridX < maxCamGridX) {
        targetCamGridX = this.currentCamGridX + 1;
      }
    } else if (nextViewX < 1) {
      if (this.currentCamGridX > 0) {
        targetCamGridX = this.currentCamGridX - 1;
      }
    }

    if (nextViewY > 5) {
      if (this.currentCamGridY < maxCamGridY) {
        targetCamGridY = this.currentCamGridY + 1;
      }
    } else if (nextViewY < 1) {
      if (this.currentCamGridY > 0) {
        targetCamGridY = this.currentCamGridY - 1;
      }
    }

    const isScrolling = targetCamGridX !== this.currentCamGridX || targetCamGridY !== this.currentCamGridY;

    this.isMoving = true;
    this.heroTargetGridX = targetGridX;
    this.heroTargetGridY = targetGridY;
    this.currentDirection = dir;
    
    // アニメーション用の方向を決定
    let animDir = 'down';
    if (dir.includes('left')) animDir = 'left';
    else if (dir.includes('right')) animDir = 'right';
    else if (dir.includes('up')) animDir = 'up';
    else if (dir.includes('down')) animDir = 'down';
    
    this.hero.play(this.getAnimKey(`walk-${animDir}`), true);

    const targetX = targetGridX * GRID_SIZE + GRID_SIZE / 2;
    const targetY = targetGridY * GRID_SIZE + GRID_SIZE / 2;

    // 目的地パルス
    this.targetMarker.clear();
    this.targetMarker.lineStyle(2, 0xfacc15, 0.9);
    this.targetMarker.strokeRect(targetGridX * GRID_SIZE + 4, targetGridY * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);

    // HD-2D ダストトレイル
    if (this.isHd2dEffectsEnabled) {
      this.spawnStepTrail(this.hero.x, this.hero.y + 24);
    }

    this.notifyStateChange(isScrolling);

    // キャラクターの移動トゥイーン
    this.tweens.add({
      targets: this.hero,
      x: targetX,
      y: targetY,
      duration: this.moveSpeedMs,
      ease: 'Linear',
      onComplete: () => {
        this.currentGridX = targetGridX;
        this.currentGridY = targetGridY;
        this.heroTargetGridX = null;
        this.heroTargetGridY = null;
        this.isMoving = false;
        this.targetMarker.clear();

        this.hero.play(this.getAnimKey(`idle-${animDir}`), true);
        this.notifyStateChange(false);
      }
    });

    // スクロールが必要な場合、カメラも並行してトゥイーン
    if (isScrolling) {
      this.tweens.add({
        targets: this.cameras.main,
        scrollX: targetCamGridX * GRID_SIZE,
        scrollY: targetCamGridY * GRID_SIZE,
        duration: this.moveSpeedMs,
        ease: 'Linear',
        onComplete: () => {
          this.currentCamGridX = targetCamGridX;
          this.currentCamGridY = targetCamGridY;
        }
      });
    }

    return true;
  }

  private spawnStepTrail(px: number, py: number) {
    const puff = this.add.circle(px, py, 6, 0xffffff, 0.5);
    puff.setDepth(5);
    this.tweens.add({
      targets: puff,
      scale: { from: 0.8, to: 2.2 },
      alpha: { from: 0.5, to: 0 },
      y: py - 6,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => puff.destroy()
    });
  }

  private notifyStateChange(isScrolling: boolean = false) {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        gridX: this.currentGridX,
        gridY: this.currentGridY,
        camGridX: this.currentCamGridX,
        camGridY: this.currentCamGridY,
        direction: this.currentDirection,
        isMoving: this.isMoving,
        isScrolling: isScrolling,
        speedMs: this.moveSpeedMs,
        hp: this.heroHp,
        maxHp: this.heroMaxHp,
        attack: this.heroAttack,
        level: this.heroLevel,
        exp: this.heroExp
      });
    }
  }

  public resetPosition() {
    if (this.isMoving) return;

    this.currentGridX = 7;
    this.currentGridY = 7;
    this.currentCamGridX = 4;
    this.currentCamGridY = 4;
    const { GRID_SIZE } = GridMovementScene;
    this.hero.setPosition(this.currentGridX * GRID_SIZE + GRID_SIZE / 2, this.currentGridY * GRID_SIZE + GRID_SIZE / 2);
    this.cameras.main.scrollX = this.currentCamGridX * GRID_SIZE;
    this.cameras.main.scrollY = this.currentCamGridY * GRID_SIZE;
    this.hero.play(this.getAnimKey('idle-down'));
    this.currentDirection = 'idle';
    this.notifyStateChange(false);
  }

  public addLevel() {
    this.heroLevel++;
    this.heroMaxHp += 5;
    this.heroHp = this.heroMaxHp;
    this.heroAttack += 2;
    this.heroExp = 0;
    this.sendLog(`[Demo] Leveled up! You are now level ${this.heroLevel}.`, 'system');
    this.notifyStateChange();
  }

  public resetHero() {
    this.heroLevel = 1;
    this.heroMaxHp = 20;
    this.heroHp = 20;
    this.heroAttack = 5;
    this.heroExp = 0;
    this.sendLog(`[Demo] Status reset to Level 1.`, 'system');
    this.notifyStateChange();
  }
}
