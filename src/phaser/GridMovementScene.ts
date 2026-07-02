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
  public static readonly VIEWPORT_COLS = 7;
  public static readonly VIEWPORT_ROWS = 7;

  private hero!: Phaser.GameObjects.Sprite;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private targetMarker!: Phaser.GameObjects.Graphics;
  private hd2dLighting!: Phaser.GameObjects.Graphics;
  private vignetteOverlay!: Phaser.GameObjects.Graphics;
  private particleMotes!: Phaser.GameObjects.Arc[];
  private visitedTraceGraphics?: Phaser.GameObjects.Graphics;
  private grassBgImage?: Phaser.GameObjects.Image;
  private useGrassBg: boolean = true;
  private allow8Way: boolean = false;
  private isTextMode: boolean = true;
  private displayMode: 'normal' | 'text' | 'grayscale' = 'text';
  private slimes: SlimeData[] = [];
  private itemSprites: { gridX: number, gridY: number, sprite: Phaser.GameObjects.GameObject, itemId: string }[] = [];

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
  public movementBehavior: string = 'unvisited';
  public combatBehavior: string = 'closest_enemy';
  private showGridLines: boolean = true;
  private isHd2dEffectsEnabled: boolean = false;

  // ヒーローステータス
  private heroHp: number = 20;
  private heroMaxHp: number = 20;
  private heroAttack: number = 5;
  private heroLevel: number = 1;
  private heroExp: number = 0;
  private lastFireMagicTime: number = 0;
  private lastIceMagicTime: number = 0;

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
  public setOnStatsChange?: (expRate: number, searchRate: number, defeatRate: number | null) => void;
  public onTestPlayClear?: () => void;
  public onTeleport?: (targetMapId: string) => void;

  private visitedGrids: Set<string> = new Set();
  private viewedGrids: Set<string> = new Set();
  
  private totalEnemiesSpawned: number = 0;
  private enemiesDefeated: number = 0;
  
  public gridCols: number = 16;
  public gridRows: number = 16;
  public mapData: any = null;

  private totalGrids: number = 16 * 16;

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
    const { GRID_SIZE, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;

    // カメラ境界を設定
    this.cameras.main.setBounds(0, 0, this.gridCols * GRID_SIZE, this.gridRows * GRID_SIZE);
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
    const maxEnemies = this.mapData?.maxEnemies;
    const isInfinite = maxEnemies === undefined || maxEnemies === 'infinite';
    const initialSpawnCount = isInfinite ? 5 : Math.min(5, maxEnemies as number);

    for (let i = 0; i < initialSpawnCount; i++) {
      const sx = Phaser.Math.Between(2, this.gridCols - 3);
      const sy = Phaser.Math.Between(2, this.gridRows - 3);
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
      this.totalEnemiesSpawned++;
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
      if (targetGridX >= 0 && targetGridX < this.gridCols &&
          targetGridY >= 0 && targetGridY < this.gridRows) {
        this.pointerTargetGridX = targetGridX;
        this.pointerTargetGridY = targetGridY;
        this.sendLog(`(${targetGridX}, ${targetGridY}) へ移動中...`, 'system');
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

    // Initial stats trigger
    this.updateStats(this.currentGridX, this.currentGridY, this.currentCamGridX, this.currentCamGridY);
  }

  public update(time: number, delta: number) {
    // 通常モード (レベル8以上) のみ、火の魔法と氷の魔法をサポート
    if (this.heroLevel >= 8) {
      // 火の魔法 自動詠唱 (3秒に1回、敵がいる場合)
      if (time - this.lastFireMagicTime > 3000) {
        if (this.slimes.length > 0) {
          this.castFireMagic();
          this.lastFireMagicTime = time;
        }
      }

      // 氷の魔法 自動詠唱 (5秒に1回、敵がいる場合)
      if (time - this.lastIceMagicTime > 5000) {
        if (this.slimes.length > 0) {
          this.castIceMagic();
          this.lastIceMagicTime = time;
        }
      }

      // 手動詠唱 (Spaceキーが押された場合)
      if (this.cursors && Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
        this.castFireMagic();
      }
    }

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

    this.visitedTraceGraphics = this.add.graphics();
    this.visitedTraceGraphics.setDepth(1);
    this.drawVisitedTrace();
  }

  private drawGrid() {
    if (!this.gridGraphics) return;
    const { GRID_SIZE } = GridMovementScene;
    this.gridGraphics.clear();

    if (this.grassBgImage) {
      this.grassBgImage.setVisible(this.displayMode === 'normal' && this.useGrassBg);
    }

    if (this.displayMode === 'text') {
      if (this.showGridLines) {
        this.gridGraphics.lineStyle(1, 0xffffff, 0.3);
        for (let i = 0; i <= this.gridRows; i++) {
          this.gridGraphics.moveTo(0, i * GRID_SIZE);
          this.gridGraphics.lineTo(this.gridCols * GRID_SIZE, i * GRID_SIZE);
        }
        for (let i = 0; i <= this.gridCols; i++) {
          this.gridGraphics.moveTo(i * GRID_SIZE, 0);
          this.gridGraphics.lineTo(i * GRID_SIZE, this.gridRows * GRID_SIZE);
        }
        this.gridGraphics.strokePath();
      }
      return;
    }

    if (this.displayMode === 'grayscale') {
      // Background is white
      this.gridGraphics.fillStyle(0xffffff, 1);
      this.gridGraphics.fillRect(0, 0, this.gridCols * GRID_SIZE, this.gridRows * GRID_SIZE);

      // Draw occasional stones
      for (let row = 0; row < this.gridRows; row++) {
        for (let col = 0; col < this.gridCols; col++) {
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
        for (let i = 0; i <= this.gridRows; i++) {
          this.gridGraphics.moveTo(0, i * GRID_SIZE);
          this.gridGraphics.lineTo(this.gridCols * GRID_SIZE, i * GRID_SIZE);
        }
        for (let i = 0; i <= this.gridCols; i++) {
          this.gridGraphics.moveTo(i * GRID_SIZE, 0);
          this.gridGraphics.lineTo(i * GRID_SIZE, this.gridRows * GRID_SIZE);
        }
        this.gridGraphics.strokePath();
      }
      return;
    }

    if (this.useGrassBg) {
      if (this.showGridLines) {
        this.gridGraphics.lineStyle(1, 0xffffff, 0.15);
        for (let i = 0; i <= this.gridRows; i++) {
          this.gridGraphics.moveTo(0, i * GRID_SIZE);
          this.gridGraphics.lineTo(this.gridCols * GRID_SIZE, i * GRID_SIZE);
        }
        for (let i = 0; i <= this.gridCols; i++) {
          this.gridGraphics.moveTo(i * GRID_SIZE, 0);
          this.gridGraphics.lineTo(i * GRID_SIZE, this.gridRows * GRID_SIZE);
        }
        this.gridGraphics.strokePath();
      }
      return;
    }

    // HD-2D風 深みのある森の芝生タイル（微細な濃淡トーン）
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
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
    this.gridGraphics.strokeRect(1, 1, this.gridCols * GRID_SIZE - 2, this.gridRows * GRID_SIZE - 2);

    // グリッド線
    if (this.showGridLines) {
      this.gridGraphics.lineStyle(1, 0x10b981, 0.35);
      for (let i = 0; i <= this.gridCols; i++) {
        this.gridGraphics.lineBetween(i * GRID_SIZE, 0, i * GRID_SIZE, this.gridRows * GRID_SIZE);
      }
      for (let j = 0; j <= this.gridRows; j++) {
        this.gridGraphics.lineBetween(0, j * GRID_SIZE, this.gridCols * GRID_SIZE, j * GRID_SIZE);
      }
    }
  }

  private drawVisitedTrace() {
    if (!this.visitedTraceGraphics) return;
    this.visitedTraceGraphics.clear();

    const { GRID_SIZE } = GridMovementScene;

    // displayMode に応じて最適な色・スタイルを設定
    let traceColor = 0x10b981; // デフォルトは爽やかなエメラルドグリーン
    let traceAlpha = 0.22;      // 半透明

    if (this.displayMode === 'text') {
      traceColor = 0x34d399; // Textモードはよりネオン感のある薄緑
      traceAlpha = 0.28;
    } else if (this.displayMode === 'grayscale') {
      traceColor = 0x64748b; // モノクローム（石ころ世界）は馴染むブルーグレー
      traceAlpha = 0.22;
    }

    this.visitedGrids.forEach(key => {
      const [xs, ys] = key.split(',');
      const x = parseInt(xs, 10);
      const y = parseInt(ys, 10);

      const px = x * GRID_SIZE;
      const py = y * GRID_SIZE;

      // 1. 各タイルの四隅に上品な L 字型のコーナータグを描画
      this.visitedTraceGraphics!.lineStyle(1.5, traceColor, traceAlpha * 1.5);
      const tagSize = 8;
      
      // 左上角
      this.visitedTraceGraphics!.moveTo(px + tagSize, py);
      this.visitedTraceGraphics!.lineTo(px, py);
      this.visitedTraceGraphics!.lineTo(px, py + tagSize);

      // 右上角
      this.visitedTraceGraphics!.moveTo(px + GRID_SIZE - tagSize, py);
      this.visitedTraceGraphics!.lineTo(px + GRID_SIZE, py);
      this.visitedTraceGraphics!.lineTo(px + GRID_SIZE, py + tagSize);

      // 左下角
      this.visitedTraceGraphics!.moveTo(px, py + GRID_SIZE - tagSize);
      this.visitedTraceGraphics!.lineTo(px, py + GRID_SIZE);
      this.visitedTraceGraphics!.lineTo(px + tagSize, py + GRID_SIZE);

      // 右下角
      this.visitedTraceGraphics!.moveTo(px + GRID_SIZE, py + GRID_SIZE - tagSize);
      this.visitedTraceGraphics!.lineTo(px + GRID_SIZE, py + GRID_SIZE);
      this.visitedTraceGraphics!.lineTo(px + GRID_SIZE - tagSize, py + GRID_SIZE);
      this.visitedTraceGraphics!.strokePath();

      // 2. セル中央にドットを控えめに描く
      this.visitedTraceGraphics!.fillStyle(traceColor, traceAlpha);
      this.visitedTraceGraphics!.fillCircle(px + GRID_SIZE / 2, py + GRID_SIZE / 2, 4);
    });
  }

  private drawHd2dLighting() {
    if (!this.hd2dLighting) return;
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
    if (!this.vignetteOverlay) return;
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

  public applyMapSettings(bgMode: string, bgImage?: string) {
    if (bgMode === 'text-black') {
      this.setDisplayMode('text');
      this.setSpeed(1000);
      this.toggle8WayMode(false);
      this.toggleHd2dEffects(false);
      this.toggleGrassBg(false);
      this.cameras.main.setBackgroundColor('#000000');
    } else if (bgMode === 'stone-gray') {
      this.setDisplayMode('grayscale');
      this.setSpeed(800);
      this.toggle8WayMode(false);
      this.toggleHd2dEffects(false);
      this.toggleGrassBg(false);
      this.cameras.main.setBackgroundColor('#cbd5e1'); // Match map editor bg
    } else if (bgMode === 'grass-green') {
      this.setDisplayMode('normal');
      this.setSpeed(800);
      this.toggle8WayMode(false);
      this.toggleHd2dEffects(false);
      this.toggleGrassBg(false);
      this.cameras.main.setBackgroundColor('#4ade80');
    } else if (bgMode === 'image') {
      this.setDisplayMode('normal');
      this.setSpeed(800);
      this.toggle8WayMode(false);
      this.toggleHd2dEffects(true);
      this.toggleGrassBg(true);
      this.cameras.main.setBackgroundColor('#000000');
      if (bgImage && this.grassBgImage) {
         // TODO: support loading arbitrary bg image if not preloaded. For now, it defaults to grass_bg
      }
    }
  }

  public setDisplayMode(mode: 'normal' | 'text' | 'grayscale') {
    this.displayMode = mode;
    this.isTextMode = (mode === 'text');
    
    // 背景色の変更
    if (this.cameras && this.cameras.main) {
      if (this.displayMode === 'text') {
        this.cameras.main.setBackgroundColor('#000000');
      } else if (this.displayMode === 'grayscale') {
        this.cameras.main.setBackgroundColor('#ffffff');
      } else {
        this.cameras.main.setBackgroundColor('#ecfdf5'); // default background color
      }
    }

    // テクスチャの変更
    let heroTexture = 'hero_spritesheet';
    if (this.displayMode === 'text') heroTexture = 'hero_spritesheet_text';
    else if (this.displayMode === 'grayscale') heroTexture = 'hero_spritesheet_gray';
    if (this.hero) {
      this.hero.setTexture(heroTexture);
    }
    
    let slimeTexture = 'slime_spritesheet';
    if (this.displayMode === 'text') slimeTexture = 'slime_spritesheet_text';
    else if (this.displayMode === 'grayscale') slimeTexture = 'slime_spritesheet_gray';
    if (this.slimes) {
      this.slimes.forEach(slime => {
        if (slime && slime.sprite) {
          slime.sprite.setTexture(slimeTexture);
        }
      });
    }

    // アニメーションを即時更新
    if (this.hero && this.hero.anims) {
      const currentAnimKey = this.hero.anims.currentAnim?.key;
      if (currentAnimKey) {
        let baseKey = currentAnimKey;
        if (baseKey.endsWith('-text')) baseKey = baseKey.replace('-text', '');
        else if (baseKey.endsWith('-gray')) baseKey = baseKey.replace('-gray', '');
        this.hero.play(this.getAnimKey(baseKey), true);
      }
    }

    if (this.slimes) {
      this.slimes.forEach(slime => {
        if (slime && slime.sprite && slime.sprite.anims) {
          const sAnimKey = slime.sprite.anims.currentAnim?.key;
          if (sAnimKey) {
            let baseKey = sAnimKey;
            if (baseKey.endsWith('-text')) baseKey = baseKey.replace('-text', '');
            else if (baseKey.endsWith('-gray')) baseKey = baseKey.replace('-gray', '');
            slime.sprite.play(this.getAnimKey(baseKey), true);
          }
        }
      });
    }

    // 描画の更新
    this.drawGrid();
    this.drawVisitedTrace();
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
    if (this.particleMotes) {
      this.particleMotes.forEach(m => m.setVisible(this.isHd2dEffectsEnabled));
    }
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
    const maxEnemies = this.mapData?.maxEnemies;
    const isInfinite = maxEnemies === undefined || maxEnemies === 'infinite';

    if (this.slimes.length < 5 && Math.random() < 0.1) {
      if (isInfinite || this.totalEnemiesSpawned < (maxEnemies as number)) {
        const sx = Phaser.Math.Between(2, this.gridCols - 3);
        const sy = Phaser.Math.Between(2, this.gridRows - 3);
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
          
          this.totalEnemiesSpawned++;
          this.sendLog('野生のスライムが現れた！ 👾', 'system');
        }
      }
    }

    // 勇者の自動移動
    if (this.autoMode !== 'none' && !this.isMoving) {
      if (this.autoMode === 'seek') {
        // 索敵・戦闘モード (AIを使わないロジック)
        let targetSlime: SlimeData | null = null;
        
        if (this.slimes.length > 0 && this.combatBehavior === 'closest_enemy') {
          // 最も近いスライムを探す
          let minDistance = Infinity;

          this.slimes.forEach(slime => {
            const dist = Math.abs(slime.gridX - this.currentGridX) + Math.abs(slime.gridY - this.currentGridY);
            if (dist < minDistance) {
              minDistance = dist;
              targetSlime = slime;
            }
          });
        }

        if (targetSlime) {
          // 最も近いスライムに近づく方向を決定
          const possibleDirs: Direction[] = [];
          const sx = targetSlime.gridX;
          const sy = targetSlime.gridY;
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
        } else {
          // 敵がいない場合、または戦闘行動がない場合
          if (this.movementBehavior === 'unvisited') {
            this.performExploreWalk();
          } else {
            this.performRandomWalk();
          }
        }
      } else {
        // 通常のランダムウォーク (seek 以外)
        this.performRandomWalk();
      }
    }

    // スライムのランダム移動
    this.slimes.forEach(slime => {
      if (slime.isMoving) return;
      if (Math.random() > 0.3) return; // 30%の確率で動く

      const slimeDirs: Direction[] = [];
      if (slime.gridY > 0) slimeDirs.push('up');
      if (slime.gridY < this.gridRows - 1) slimeDirs.push('down');
      if (slime.gridX > 0) slimeDirs.push('left');
      if (slime.gridX < this.gridCols - 1) slimeDirs.push('right');

      if (slimeDirs.length > 0) {
        const nextDir = Phaser.Utils.Array.GetRandom(slimeDirs);
        this.moveSlime(slime, nextDir);
      }
    });
  }

  private performRandomWalk() {
    const possibleDirs: Direction[] = [];
    if (this.currentGridY > 0) possibleDirs.push('up');
    if (this.currentGridY < this.gridRows - 1) possibleDirs.push('down');
    if (this.currentGridX > 0) possibleDirs.push('left');
    if (this.currentGridX < this.gridCols - 1) possibleDirs.push('right');
    
    if (this.allow8Way) {
      if (this.currentGridY > 0 && this.currentGridX > 0) possibleDirs.push('up-left');
      if (this.currentGridY > 0 && this.currentGridX < this.gridCols - 1) possibleDirs.push('up-right');
      if (this.currentGridY < this.gridRows - 1 && this.currentGridX > 0) possibleDirs.push('down-left');
      if (this.currentGridY < this.gridRows - 1 && this.currentGridX < this.gridCols - 1) possibleDirs.push('down-right');
    }

    if (possibleDirs.length > 0) {
      const nextDir = Phaser.Utils.Array.GetRandom(possibleDirs);
      this.moveInDirection(nextDir);
    }
  }

  private performExploreWalk() {
    // 未踏破エリアを探す簡易的な探索
    // 周囲8マスまたは4マスの中で、未訪問のマスを優先する
    const neighbors = [
      { dir: 'up' as Direction, dx: 0, dy: -1 },
      { dir: 'down' as Direction, dx: 0, dy: 1 },
      { dir: 'left' as Direction, dx: -1, dy: 0 },
      { dir: 'right' as Direction, dx: 1, dy: 0 },
    ];
    if (this.allow8Way) {
      neighbors.push(
        { dir: 'up-left' as Direction, dx: -1, dy: -1 },
        { dir: 'up-right' as Direction, dx: 1, dy: -1 },
        { dir: 'down-left' as Direction, dx: -1, dy: 1 },
        { dir: 'down-right' as Direction, dx: 1, dy: 1 }
      );
    }

    const unvisitedDirs: Direction[] = [];
    const validDirs: Direction[] = [];

    for (const n of neighbors) {
      const nx = this.currentGridX + n.dx;
      const ny = this.currentGridY + n.dy;
      if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
        if (!this.isTileOccupied(nx, ny)) {
          validDirs.push(n.dir);
          const gridKey = `${nx},${ny}`;
          if (!this.visitedGrids.has(gridKey)) {
            unvisitedDirs.push(n.dir);
          }
        }
      }
    }

    if (unvisitedDirs.length > 0) {
      const nextDir = Phaser.Utils.Array.GetRandom(unvisitedDirs);
      this.moveInDirection(nextDir);
    } else if (validDirs.length > 0) {
      // 未訪問がない場合はランダムに移動
      const nextDir = Phaser.Utils.Array.GetRandom(validDirs);
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
    this.sendLog(`勇者の通常攻撃！ スライムに ${damage} ダメージを与えた！ ⚔️`, 'combat');

    // 攻撃エフェクト (本格的な円弧のダブルクロス・スラッシュ & スパーク)
    
    // 1. 1発目のスラッシュ (左上から右下への鋭い一閃)
    const slash1 = this.add.graphics();
    slash1.setDepth(15);
    const angle1 = -Math.PI / 6; // やや右肩下がり
    const radius1 = 28;
    const animState1 = { progress: 0 };
    
    this.tweens.add({
      targets: animState1,
      progress: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        slash1.clear();
        const p = animState1.progress;
        const start = angle1 - Math.PI / 2 + p * Math.PI * 0.4;
        const end = angle1 - Math.PI / 2 + p * Math.PI * 1.3;
        
        // 黄金の斬撃オーラ
        slash1.lineStyle(6, 0xffaa00, (1 - p) * 0.85);
        slash1.beginPath();
        slash1.arc(slime.sprite.x, slime.sprite.y, radius1, start, end, false);
        slash1.strokePath();

        // 鋭い刃光 (白)
        slash1.lineStyle(2, 0xffffff, (1 - p) * 1.0);
        slash1.beginPath();
        slash1.arc(slime.sprite.x, slime.sprite.y, radius1, start + 0.1, end - 0.1, false);
        slash1.strokePath();
      },
      onComplete: () => slash1.destroy()
    });

    // 2. 2発目のスラッシュ (少し遅れて右上から左下へ交差する一閃)
    this.time.delayedCall(80, () => {
      if (!slime.sprite || !slime.sprite.active) return;
      const slash2 = this.add.graphics();
      slash2.setDepth(15);
      const angle2 = (Math.PI * 5) / 6; // 反対方向への傾き
      const radius2 = 25;
      const animState2 = { progress: 0 };

      this.tweens.add({
        targets: animState2,
        progress: 1,
        duration: 180,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          slash2.clear();
          const p = animState2.progress;
          const start = angle2 - Math.PI / 2 + p * Math.PI * 0.4;
          const end = angle2 - Math.PI / 2 + p * Math.PI * 1.3;

          // シアン/スカイブルーの斬撃オーラ (2段目は美しい色合いの変化)
          slash2.lineStyle(5, 0x00f0ff, (1 - p) * 0.85);
          slash2.beginPath();
          slash2.arc(slime.sprite.x, slime.sprite.y, radius2, start, end, false);
          slash2.strokePath();

          // 鋭い刃光 (白)
          slash2.lineStyle(1.5, 0xffffff, (1 - p) * 1.0);
          slash2.beginPath();
          slash2.arc(slime.sprite.x, slime.sprite.y, radius2, start + 0.08, end - 0.08, false);
          slash2.strokePath();
        },
        onComplete: () => slash2.destroy()
      });
    });

    // 3. 火花・衝撃スパーク
    for (let i = 0; i < 12; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(150, 300);
      const size = Phaser.Math.Between(2, 5);
      const spark = this.add.graphics();
      spark.setDepth(16);
      spark.setPosition(slime.sprite.x, slime.sprite.y);
      
      // 火花のひし形
      spark.fillStyle(0xfff59d, 0.9);
      spark.fillTriangle(0, -size, -size * 0.5, 0, size * 0.5, 0);
      spark.fillTriangle(0, size, -size * 0.5, 0, size * 0.5, 0);

      this.tweens.add({
        targets: spark,
        x: slime.sprite.x + Math.cos(angle) * speed * 0.25,
        y: slime.sprite.y + Math.sin(angle) * speed * 0.25,
        scale: 0,
        alpha: 0,
        angle: Phaser.Math.Between(0, 360),
        duration: Phaser.Math.Between(300, 500),
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy()
      });
    }

    // 4. ヒット時のカメラ微揺れと、スライムの赤フラッシュ & ノックバック
    this.cameras.main.shake(80, 0.006);
    
    // スライムの赤色点滅 (ティント) と微小なノックバック
    if (slime.sprite && slime.sprite.active) {
      slime.sprite.setTint(0xff5555);
      
      // 被弾方向への小さな揺れ
      const knockX = (slime.sprite.x - this.hero.x) * 0.15;
      const knockY = (slime.sprite.y - this.hero.y) * 0.15;
      const origSlimeX = slime.sprite.x;
      const origSlimeY = slime.sprite.y;

      this.tweens.add({
        targets: slime.sprite,
        x: origSlimeX + knockX,
        y: origSlimeY + knockY,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          if (slime.sprite && slime.sprite.active) {
            slime.sprite.clearTint();
            slime.sprite.x = origSlimeX;
            slime.sprite.y = origSlimeY;
          }
        }
      });

      // 150ms後にティントを安全にクリア
      this.time.delayedCall(150, () => {
        if (slime.sprite && slime.sprite.active) {
          slime.sprite.clearTint();
        }
      });
    }

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
          this.enemiesDefeated++;
          this.updateStats(this.currentGridX, this.currentGridY, this.currentCamGridX, this.currentCamGridY);
          this.sendLog(`スライムを倒した！ 経験値を 2 獲得。 🌟`, 'info');
          this.heroExp += 2;
          if (this.heroExp >= 10) {
            this.heroLevel++;
            this.heroExp = 0;
            this.heroMaxHp += 5;
            this.heroHp = this.heroMaxHp;
            this.heroAttack += 2;
            this.sendLog(`レベルアップ！ レベル ${this.heroLevel} になりました！ 🎉`, 'system');
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
        this.sendLog(`スライムの体当たり！ 勇者は ${damage} ダメージを受けた！ 💥`, 'damage');
        
        // 画面フラッシュ
        this.cameras.main.flash(200, 255, 0, 0);
        
        this.notifyStateChange(false);

        if (this.heroHp <= 0) {
          this.sendLog(`勇者は力尽きてしまった... 💀`, 'system');
          // 本当はゲームオーバー処理を入れる
          this.time.delayedCall(1000, () => {
             this.heroHp = this.heroMaxHp;
             this.sendLog(`勇者は不思議な力で復活した！ ✨`, 'system');
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
      targetGridX < 0 || targetGridX >= this.gridCols ||
      targetGridY < 0 || targetGridY >= this.gridRows
    ) {
      return false;
    }

    const { VIEWPORT_COLS, VIEWPORT_ROWS, GRID_SIZE } = GridMovementScene;
    
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
    const maxCamGridX = this.gridCols - VIEWPORT_COLS; // 16 - 7 = 9
    const maxCamGridY = this.gridRows - VIEWPORT_ROWS; // 9

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
        this.checkMapEvents();
        this.checkMapItems();
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

  private checkMapItems() {
    const itemIndex = this.itemSprites.findIndex(i => i.gridX === this.currentGridX && i.gridY === this.currentGridY);
    if (itemIndex >= 0) {
      const item = this.itemSprites[itemIndex];
      if (item.itemId === 'treasure_text') {
        this.sendLog('宝を手に入れた！ ✨ (Exp +50)', 'info');
        this.heroExp += 50;
        if (this.heroExp >= 10) {
          while (this.heroExp >= 10) {
             this.heroExp -= 10;
             this.addLevel();
          }
        }
      } else {
        this.sendLog(`アイテムを手に入れた！ (${item.itemId})`, 'info');
      }
      if (item.sprite && item.sprite.active) {
        item.sprite.destroy();
      }
      this.itemSprites.splice(itemIndex, 1);
      this.notifyStateChange(false);
    }
  }

  private checkMapEvents() {
    if (!this.mapData || !this.mapData.events) return;
    const event = this.mapData.events.find((e: any) => e.x === this.currentGridX && e.y === this.currentGridY);
    if (event && event.type === 'teleport') {
      const eventData = event.data || {};
      let met = true;
      const expRate = (this.visitedGrids.size / this.totalGrids) * 100;
      const sRate = (this.viewedGrids.size / this.totalGrids) * 100;
      const maxEnemies = this.mapData?.maxEnemies;
      let dRate = 0;
      if (maxEnemies !== undefined && maxEnemies !== 'infinite' && (maxEnemies as number) > 0) {
        dRate = (this.enemiesDefeated / (maxEnemies as number)) * 100;
      }
      
      if (eventData.requiredExplorationRate && expRate < eventData.requiredExplorationRate) met = false;
      if (eventData.requiredSearchRate && sRate < eventData.requiredSearchRate) met = false;
      if (eventData.requiredDefeatRate && dRate < eventData.requiredDefeatRate) met = false;
      
      if (met) {
        if (this.onTestPlayClear) {
          this.onTestPlayClear();
        } else if (this.onTeleport && eventData.targetMap) {
          this.sendLog(`条件クリア！次のマップへ移動します。`, 'system');
          this.onTeleport(eventData.targetMap);
        } else {
          this.sendLog(`条件クリア！次のマップへ移動します。(※移動先未設定)`, 'system');
        }
      } else {
        const reqExp = eventData.requiredExplorationRate || 0;
        const reqSearch = eventData.requiredSearchRate || 0;
        const reqDefeat = eventData.requiredDefeatRate || 0;
        let reason = '';
        if (reqExp > 0 && expRate < reqExp) reason += ` 踏破率: ${Math.floor(expRate)}% / ${reqExp}%`;
        if (reqSearch > 0 && sRate < reqSearch) reason += ` 捜索率: ${Math.floor(sRate)}% / ${reqSearch}%`;
        if (reqDefeat > 0 && dRate < reqDefeat) reason += ` 撃破率: ${Math.floor(dRate)}% / ${reqDefeat}%`;
        this.sendLog(`イベント発生条件を満たしていません:${reason}`, 'info');
      }
    }
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

  private updateStats(currentX: number, currentY: number, camX: number, camY: number) {
    this.visitedGrids.add(`${currentX},${currentY}`);

    for (let x = 0; x < GridMovementScene.VIEWPORT_COLS; x++) {
      for (let y = 0; y < GridMovementScene.VIEWPORT_ROWS; y++) {
        const gridX = camX + x;
        const gridY = camY + y;
        if (gridX >= 0 && gridX < this.gridCols && gridY >= 0 && gridY < this.gridRows) {
          this.viewedGrids.add(`${gridX},${gridY}`);
        }
      }
    }

    if (this.setOnStatsChange) {
      const expRate = (this.visitedGrids.size / this.totalGrids) * 100;
      const searchRate = (this.viewedGrids.size / this.totalGrids) * 100;
      const maxEnemies = this.mapData?.maxEnemies;
      let dRate = null;
      if (maxEnemies !== undefined && maxEnemies !== 'infinite' && (maxEnemies as number) > 0) {
        dRate = (this.enemiesDefeated / (maxEnemies as number)) * 100;
      }
      this.setOnStatsChange(expRate, searchRate, dRate);
    }
    this.drawVisitedTrace();
  }

  private notifyStateChange(isScrolling: boolean = false) {
    this.updateStats(this.currentGridX, this.currentGridY, this.currentCamGridX, this.currentCamGridY);
    
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

    this.totalEnemiesSpawned = 0;
    this.enemiesDefeated = 0;
    
    // 踏破・視野情報をクリアし、表示もクリアする
    this.visitedGrids.clear();
    this.viewedGrids.clear();
    if (this.visitedTraceGraphics) {
      this.visitedTraceGraphics.clear();
    }
    
    // reset slimes array when loading map
    this.slimes.forEach(s => {
      if (s.sprite && s.sprite.active) s.sprite.destroy();
    });
    this.slimes = [];
    
    this.itemSprites.forEach(item => {
      if (item.sprite && item.sprite.active) item.sprite.destroy();
    });
    this.itemSprites = [];

    if (this.mapData) {
       // まず設定なし(fromMapがnullまたは空文字列)の初期値を探す
       const startEvent = this.mapData.events?.find(
         (e: any) => e.type === 'start_point' && (!e.data || e.data.fromMap === null || e.data.fromMap === '')
       );
       if (startEvent) {
          this.currentGridX = startEvent.x;
          this.currentGridY = startEvent.y;
       } else {
          // なければ、その他の初期値（どの初期値でも）を検索
          const anyStartEvent = this.mapData.events?.find((e: any) => e.type === 'start_point');
          if (anyStartEvent) {
             this.currentGridX = anyStartEvent.x;
             this.currentGridY = anyStartEvent.y;
          } else {
             this.currentGridX = 0;
             this.currentGridY = 0;
          }
       }
    } else {
       this.currentGridX = 7;
       this.currentGridY = 7;
    }
    this.currentCamGridX = Math.max(0, Math.min(this.currentGridX - Math.floor(GridMovementScene.VIEWPORT_COLS / 2), this.gridCols - GridMovementScene.VIEWPORT_COLS));
    this.currentCamGridY = Math.max(0, Math.min(this.currentGridY - Math.floor(GridMovementScene.VIEWPORT_ROWS / 2), this.gridRows - GridMovementScene.VIEWPORT_ROWS));
    
    const { GRID_SIZE } = GridMovementScene;
    if (this.hero) {
      this.hero.setPosition(this.currentGridX * GRID_SIZE + GRID_SIZE / 2, this.currentGridY * GRID_SIZE + GRID_SIZE / 2);
    }
    if (this.cameras && this.cameras.main) {
      this.cameras.main.scrollX = this.currentCamGridX * GRID_SIZE;
      this.cameras.main.scrollY = this.currentCamGridY * GRID_SIZE;
    }
    if (this.hero) {
      this.hero.play(this.getAnimKey('idle-down'));
    }
    this.currentDirection = 'idle';
    this.spawnMapItems();
    this.notifyStateChange(false);
  }

  private spawnMapItems() {
    if (!this.mapData || !this.mapData.items) return;
    const { GRID_SIZE } = GridMovementScene;
    
    this.mapData.items.forEach((item: any) => {
      if (item.itemId === 'treasure_text') {
        const text = this.add.text(
          item.x * GRID_SIZE + GRID_SIZE / 2, 
          item.y * GRID_SIZE + GRID_SIZE / 2, 
          '宝', 
          { fontFamily: 'serif', fontSize: '24px', color: '#fbbf24', fontStyle: 'bold' }
        );
        text.setOrigin(0.5, 0.5);
        text.setDepth(5);
        this.itemSprites.push({
          gridX: item.x,
          gridY: item.y,
          sprite: text,
          itemId: item.itemId
        });
      }
    });
  }

  public addLevel() {
    this.heroLevel++;
    this.heroMaxHp += 5;
    this.heroHp = this.heroMaxHp;
    this.heroAttack += 2;
    this.heroExp = 0;
    this.sendLog(`[デモ] レベルアップ！ レベル ${this.heroLevel} になりました！ 🎉`, 'system');
    this.notifyStateChange();
  }

  public castFireMagic() {
    if (this.heroLevel < 8) {
      this.sendLog("火の魔法は通常モード（Lv.8以上）でのみ使用可能です。", "system");
      return;
    }

    if (this.slimes.length === 0) {
      return;
    }

    // 最も近いスライムをターゲットにする
    let targetSlime: SlimeData | null = null;
    let minDistance = Infinity;

    this.slimes.forEach(slime => {
      const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, slime.sprite.x, slime.sprite.y);
      if (dist < minDistance) {
        minDistance = dist;
        targetSlime = slime;
      }
    });

    if (targetSlime) {
      this.shootFireball(targetSlime);
    }
  }

  private shootFireball(targetSlime: SlimeData) {
    const startX = this.hero.x;
    const startY = this.hero.y;
    const endX = targetSlime.sprite.x;
    const endY = targetSlime.sprite.y;

    const dx = endX - startX;
    const dy = endY - startY;

    // 4方向（十字方向）のみに飛ぶように軸を制限する
    let targetX = startX;
    let targetY = startY;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // 左右方向
      targetX = endX;
      targetY = startY;
    } else {
      // 上下方向
      targetX = startX;
      targetY = endY;
    }

    // 火の魔法（ファイアボール）のコンテナ作成
    const fireball = this.add.container(startX, startY);
    fireball.setDepth(15);

    // 重ね合わせによるリッチな光沢エフェクト (HD-2D風)
    const outerGlow = this.add.circle(0, 0, 14, 0xff3300, 0.4);
    const midGlow = this.add.circle(0, 0, 9, 0xff7700, 0.7);
    const innerCore = this.add.circle(0, 0, 4, 0xffdd00, 1.0);
    fireball.add([outerGlow, midGlow, innerCore]);

    const dist = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
    const speed = 400; // ピクセル/秒の飛行速度
    const duration = (dist / speed) * 1000;

    this.sendLog("火の魔法（ファイアボール）を直線に放った！ 🔥", "combat");

    this.tweens.add({
      targets: fireball,
      x: targetX,
      y: targetY,
      duration: duration,
      onUpdate: () => {
        // 飛行中、火の粉（トレイル）を発生させる
        if (Math.random() < 0.5) {
          const sparkX = fireball.x + Phaser.Math.Between(-6, 6);
          const sparkY = fireball.y + Phaser.Math.Between(-6, 6);
          const spark = this.add.circle(sparkX, sparkY, Phaser.Math.Between(3, 6), 0xff5500, 0.8);
          spark.setDepth(14);
          this.tweens.add({
            targets: spark,
            scale: 0,
            alpha: 0,
            duration: 250,
            onComplete: () => spark.destroy()
          });
        }
      },
      onComplete: () => {
        fireball.destroy();
        // 直撃ポイント近くにいるスライムすべてにダメージを与える
        this.triggerFireExplosionAt(targetX, targetY);
      }
    });
  }

  private triggerFireExplosionAt(x: number, y: number) {
    const fireDamage = 8;
    
    // 爆発の近く（48px以内）にいるスライムを探す
    const hitSlimes = this.slimes.filter(slime => {
      if (!slime.sprite || !slime.sprite.active) return false;
      const dist = Phaser.Math.Distance.Between(x, y, slime.sprite.x, slime.sprite.y);
      return dist <= 48;
    });

    if (hitSlimes.length > 0) {
      hitSlimes.forEach(targetSlime => {
        targetSlime.hp -= fireDamage;
        this.sendLog(`ファイアボールが直撃！ スライムに ${fireDamage} ダメージを与えた！ 🔥`, "combat");

        // スライムの撃破処理
        if (targetSlime.hp <= 0) {
          this.enemiesDefeated++;
          this.updateStats(this.currentGridX, this.currentGridY, this.currentCamGridX, this.currentCamGridY);
          this.sendLog(`スライムを焼き尽くした！ 経験値を 2 獲得。`, "info");
          this.heroExp += 2;
          if (this.heroExp >= 10) {
            this.heroLevel++;
            this.heroExp = 0;
            this.heroMaxHp += 5;
            this.heroHp = this.heroMaxHp;
            this.heroAttack += 2;
            this.sendLog(`レベルアップ！ レベル ${this.heroLevel} になりました！`, "system");
          }

          this.tweens.add({
            targets: targetSlime.sprite,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              if (targetSlime.sprite && targetSlime.sprite.active) targetSlime.sprite.destroy();
            }
          });

          const currentIdx = this.slimes.indexOf(targetSlime);
          if (currentIdx !== -1) {
            this.slimes.splice(currentIdx, 1);
          }
        }
      });
    } else {
      this.sendLog("ファイアボールは外れて爆発した。 🔥", "combat");
    }

    // 1. 火花の拡散エフェクト (10方向)
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI * 2) / 10;
      const speed = Phaser.Math.Between(100, 200);
      const spark = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0xff5500, 1);
      spark.setDepth(16);

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed * 0.3,
        y: y + Math.sin(angle) * speed * 0.3,
        scale: 0,
        alpha: 0,
        duration: Phaser.Math.Between(300, 500),
        onComplete: () => spark.destroy()
      });
    }

    // 2. 爆発波（衝撃波）のエフェクト
    const wave = this.add.circle(x, y, 5, 0xffaa00, 0.4);
    wave.setDepth(15);
    this.tweens.add({
      targets: wave,
      scale: 8,
      alpha: 0,
      duration: 300,
      onComplete: () => wave.destroy()
    });

    this.notifyStateChange(false);
  }

  public castIceMagic() {
    if (this.heroLevel < 8) {
      this.sendLog("氷の魔法は通常モード（Lv.8以上）でのみ使用可能です。", "system");
      return;
    }

    this.sendLog("氷の魔法（アイシクル・サークル）！ ❄️", "combat");

    const GRID_SIZE = GridMovementScene.GRID_SIZE;
    const hx = this.hero.x;
    const hy = this.hero.y;

    // 1. 周囲8マスの敵（スライム）を探す (ゲーム上の攻撃判定は8マスのまま)
    const hitSlimes = this.slimes.filter(slime => {
      if (!slime.sprite || !slime.sprite.active) return false;
      const dx = Math.abs(slime.gridX - this.currentGridX);
      const dy = Math.abs(slime.gridY - this.currentGridY);
      return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    });

    // 2. 精細な「氷の円（アイシクル・サークル）」演出用コンテナ
    const iceContainer = this.add.container(hx, hy);
    iceContainer.setDepth(15);

    // 2-1. 美しい氷結の魔法陣（同心円・多重幾何学構造）
    const magicCircle = this.add.graphics();
    iceContainer.add(magicCircle);

    // 円の半径
    const radius = GRID_SIZE * 1.1; // 約52〜53px

    // 魔法陣のベース描画 (半透明の極寒の青いオーラ)
    magicCircle.fillStyle(0x33ccff, 0.15);
    magicCircle.fillCircle(0, 0, radius);

    // 外側の精細な氷の装飾リング
    magicCircle.lineStyle(1.5, 0x00d8ff, 0.6);
    magicCircle.strokeCircle(0, 0, radius);
    magicCircle.lineStyle(1.0, 0xffffff, 0.8);
    magicCircle.strokeCircle(0, 0, radius - 4);
    
    // 内側のルーンリング
    magicCircle.lineStyle(1.0, 0x88f0ff, 0.4);
    magicCircle.strokeCircle(0, 0, radius * 0.5);

    // 八角形の氷の結界線を引く (8マス効果を象徴した幾何学デザイン)
    magicCircle.lineStyle(0.8, 0x00f0ff, 0.3);
    magicCircle.beginPath();
    for (let i = 0; i <= 8; i++) {
      const angle = (i * Math.PI) / 4;
      const tx = Math.cos(angle) * (radius - 2);
      const ty = Math.sin(angle) * (radius - 2);
      if (i === 0) magicCircle.moveTo(tx, ty);
      else magicCircle.lineTo(tx, ty);
    }
    magicCircle.closePath();
    magicCircle.strokePath();

    // 2-2. 円周上の16箇所に配置される、外向きの「氷の結晶（クリスタル）」
    const shardCount = 16;
    for (let i = 0; i < shardCount; i++) {
      const angle = (i * Math.PI * 2) / shardCount;
      const cx = Math.cos(angle) * radius;
      const cy = Math.sin(angle) * radius;

      const crystal = this.add.graphics();
      crystal.setPosition(cx, cy);
      // 外向きになるように回転
      crystal.setRotation(angle + Math.PI / 2);

      // 青から白の精細なグラデーション調のトゲ
      crystal.fillStyle(0x00bfff, 0.65);
      crystal.fillTriangle(-5, 0, 5, 0, 0, -16);
      crystal.fillStyle(0xffffff, 0.9);
      crystal.fillTriangle(-2.5, 0, 2.5, 0, 0, -12);
      crystal.lineStyle(0.8, 0xffffff, 0.85);
      crystal.strokeTriangle(-5, 0, 5, 0, 0, -16);

      iceContainer.add(crystal);
    }

    // アニメーション設定：サークルを回転させながらポップさせ、最後は砕け散るように拡大フェードアウト
    iceContainer.setScale(0);
    iceContainer.setAlpha(0);

    // 3. メインのアニメーション
    this.tweens.add({
      targets: iceContainer,
      scale: 1.0,
      alpha: 1.0,
      angle: 180, // ぐるりと回転
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 回転が最高潮に達したあと、一気にサークル全体が拡大＆フェードアウト
        this.tweens.add({
          targets: iceContainer,
          scale: 1.3,
          alpha: 0,
          angle: 240,
          duration: 400,
          ease: 'Sine.easeOut',
          onComplete: () => {
            iceContainer.destroy();
          }
        });

        // 美しいきらめき氷屑を24方向へ放射状に吹き飛ばす
        for (let i = 0; i < 24; i++) {
          const angle = (i * Math.PI * 2) / 24 + Phaser.Math.FloatBetween(-0.1, 0.1);
          const speed = Phaser.Math.Between(70, 150);
          const size = Phaser.Math.Between(2, 5);
          
          const shard = this.add.graphics();
          shard.setDepth(16);
          shard.setPosition(hx, hy);
          shard.fillStyle(0xe0faff, 0.9);
          // 綺麗なひし形の結晶
          shard.fillTriangle(0, -size, -size * 0.6, 0, size * 0.6, 0);
          shard.fillTriangle(0, size, -size * 0.6, 0, size * 0.6, 0);

          this.tweens.add({
            targets: shard,
            x: hx + Math.cos(angle) * speed * 0.5,
            y: hy + Math.sin(angle) * speed * 0.5,
            scale: 0,
            angle: Phaser.Math.Between(0, 360),
            alpha: 0,
            duration: Phaser.Math.Between(400, 750),
            ease: 'Cubic.easeOut',
            onComplete: () => shard.destroy()
          });
        }
      }
    });

    // 4. 冷気ダストの微細な舞い上がり
    for (let i = 0; i < 8; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const startDist = Phaser.Math.Between(10, radius);
      const px = hx + Math.cos(angle) * startDist;
      const py = hy + Math.sin(angle) * startDist;
      const iceMote = this.add.circle(px, py, Phaser.Math.Between(2, 4), 0xaae8ff, 0.7);
      iceMote.setDepth(16);

      this.tweens.add({
        targets: iceMote,
        y: py - Phaser.Math.Between(15, 35),
        x: px + Phaser.Math.Between(-10, 10),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(600, 900),
        ease: 'Quad.easeOut',
        onComplete: () => iceMote.destroy()
      });
    }

    // 5. ダメージ適用 (効果は周囲8マスのまま)
    const iceDamage = 12; // 氷の魔法は周囲のみのため強力
    hitSlimes.forEach(targetSlime => {
      targetSlime.hp -= iceDamage;
      this.sendLog(`サークル氷結がスライムに直撃！ ${iceDamage} ダメージ！ `, "combat");

      // 敵が力尽きたかチェック
      if (targetSlime.hp <= 0) {
        this.enemiesDefeated++;
        this.updateStats(this.currentGridX, this.currentGridY, this.currentCamGridX, this.currentCamGridY);
        this.sendLog(`スライムを完全に凍りつかせて砕いた！ 経験値を 2 獲得。`, "info");
        this.heroExp += 2;
        if (this.heroExp >= 10) {
          this.heroLevel++;
          this.heroExp = 0;
          this.heroMaxHp += 5;
          this.heroHp = this.heroMaxHp;
          this.heroAttack += 2;
          this.sendLog(`レベルアップ！ レベル ${this.heroLevel} になりました！`, "system");
        }

        this.tweens.add({
          targets: targetSlime.sprite,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            if (targetSlime.sprite && targetSlime.sprite.active) targetSlime.sprite.destroy();
          }
        });

        const currentIdx = this.slimes.indexOf(targetSlime);
        if (currentIdx !== -1) {
          this.slimes.splice(currentIdx, 1);
        }
      }
    });

    this.notifyStateChange(false);
  }

  public resetHero() {
    this.heroLevel = 1;
    this.heroMaxHp = 20;
    this.heroHp = 20;
    this.heroAttack = 5;
    this.heroExp = 0;
    this.sendLog(`[デモ] ステータスがレベル 1 にリセットされました。 🔄`, 'system');
    this.notifyStateChange();
  }
}
