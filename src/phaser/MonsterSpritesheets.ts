import Phaser from 'phaser';

export function generateSlimeSpritesheet(scene: Phaser.Scene, mode: 'normal' | 'text' | 'grayscale' | boolean = 'normal'): string {
  const resolvedMode = mode === true ? 'text' : (mode === false ? 'normal' : mode);
  const textureKey = resolvedMode === 'text' 
    ? 'slime_spritesheet_text' 
    : (resolvedMode === 'grayscale' ? 'slime_spritesheet_gray' : 'slime_spritesheet');

  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const frameWidth = 64;
  const frameHeight = 64;
  const frames = 4; // 0: 待機, 1: 縮む(ぷるぷる前), 2: 伸びる(ぷるぷる), 3: ジャンプ/移動

  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frames;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.imageSmoothingEnabled = false;

  if (resolvedMode === 'grayscale') {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 32;
    tempCanvas.height = 32;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.imageSmoothingEnabled = false;

    const gp = (x: number, y: number, w: number, h: number, color: string) => {
      tCtx.fillStyle = color;
      tCtx.fillRect(x, y, w, h);
    };

    for (let frame = 0; frame < frames; frame++) {
      const ox = frame * frameWidth;

      tCtx.clearRect(0, 0, 32, 32);

      tCtx.save();
      
      let scaleX = 1;
      let scaleY = 1;
      let offsetY = 0;

      if (frame === 1) { // 縮む
        scaleX = 1.2;
        scaleY = 0.8;
        offsetY = 3;
      } else if (frame === 2) { // 伸びる
        scaleX = 0.8;
        scaleY = 1.2;
        offsetY = -1;
      } else if (frame === 3) { // ジャンプ
        scaleX = 0.9;
        scaleY = 1.1;
        offsetY = -4;
      }

      tCtx.translate(16, 26); // Base of slime
      tCtx.scale(scaleX, scaleY);
      tCtx.translate(-16, -26 + offsetY);

      // Shadow on floor
      if (frame !== 3) {
        tCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        tCtx.beginPath();
        tCtx.ellipse(16, 27, 8, 2, 0, 0, Math.PI * 2);
        tCtx.fill();
      } else {
        tCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        tCtx.beginPath();
        tCtx.ellipse(16, 29, 5, 1, 0, 0, Math.PI * 2);
        tCtx.fill();
      }

      // Slime Body Outline
      gp(12, 14, 8, 12, '#444444');
      gp(10, 16, 12, 10, '#444444');
      gp(8, 19, 16, 7, '#444444');

      // Inner body
      gp(13, 15, 6, 10, '#888888');
      gp(11, 17, 10, 8, '#888888');
      gp(9, 20, 14, 5, '#888888');

      gp(14, 16, 4, 8, '#dddddd');
      gp(12, 18, 8, 6, '#dddddd');
      gp(10, 21, 12, 3, '#dddddd');

      // Eyes
      gp(12, 19, 1, 2, '#000000');
      gp(19, 19, 1, 2, '#000000');
      gp(12, 19, 1, 1, '#ffffff'); // sparkle
      gp(19, 19, 1, 1, '#ffffff');

      // Mouth
      gp(15, 22, 2, 1, '#000000');

      tCtx.restore();

      // Upscale 2x
      ctx.drawImage(tempCanvas, 0, 0, 32, 32, ox, 0, 64, 64);
    }
  } else if (resolvedMode === 'text') {
    ctx.fillStyle = '#ffffff'; // 白文字で「敵」
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px "Inter", sans-serif';

    for (let frame = 0; frame < frames; frame++) {
      const ox = frame * frameWidth + frameWidth / 2;
      const oy = frameHeight / 2;
      ctx.fillText('敵', ox, oy);
    }
  } else {

  const palette = {
    highlight: '#a5f3fc',
    bodyHi: '#38bdf8',
    body: '#0284c7',
    bodyDark: '#0369a1',
    shadow: '#0c4a6e',
    eye: '#ffffff',
    pupil: '#0f172a',
    mouth: '#0f172a'
  };

  const p = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  // 各フレームの描画
  for (let frame = 0; frame < frames; frame++) {
    const ox = frame * frameWidth;
    
    ctx.save();
    ctx.translate(ox, 0);

    // フレームごとの変形 (スケーリングとY軸オフセット)
    let scaleX = 1;
    let scaleY = 1;
    let offsetY = 0;

    if (frame === 1) { // 縮む
      scaleX = 1.2;
      scaleY = 0.8;
      offsetY = 10;
    } else if (frame === 2) { // 伸びる
      scaleX = 0.8;
      scaleY = 1.2;
      offsetY = -4;
    } else if (frame === 3) { // ジャンプ
      scaleX = 0.9;
      scaleY = 1.1;
      offsetY = -12;
    }

    ctx.translate(32, 50); // スライムの底辺中央を基準にする
    ctx.scale(scaleX, scaleY);
    ctx.translate(-32, -50 + offsetY);

    // 影
    if (frame !== 3) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.beginPath();
      ctx.ellipse(32, 52, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ジャンプ中の影は小さく薄く
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
      ctx.beginPath();
      ctx.ellipse(32, 60, 10, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // スライム本体 (玉ねぎ型)
    // ダークライン/アウトライン寄り
    p(24, 28, 16, 24, palette.shadow);
    p(20, 32, 24, 18, palette.shadow);
    p(16, 36, 32, 12, palette.shadow);
    
    // メインボディ
    p(25, 29, 14, 22, palette.bodyDark);
    p(21, 33, 22, 16, palette.bodyDark);
    p(17, 37, 30, 10, palette.bodyDark);

    p(26, 30, 12, 18, palette.body);
    p(22, 32, 18, 14, palette.body);
    p(19, 36, 26, 8, palette.body);

    p(27, 31, 8, 12, palette.bodyHi);
    p(24, 34, 12, 8, palette.bodyHi);
    
    // テカり (ハイライト)
    p(26, 33, 4, 4, palette.highlight);
    p(31, 32, 2, 2, palette.highlight);
    p(22, 38, 2, 4, palette.highlight);

    // 目 (左)
    p(22, 38, 4, 6, palette.eye);
    p(24, 40, 2, 4, palette.pupil);

    // 目 (右)
    p(38, 38, 4, 6, palette.eye);
    p(38, 40, 2, 4, palette.pupil);

    // 口
    p(30, 44, 4, 2, palette.mouth);

    ctx.restore();
  }
  } // <--- Added closing brace for else block

  scene.textures.addSpriteSheet(textureKey, canvas as unknown as HTMLImageElement, {
    frameWidth: frameWidth,
    frameHeight: frameHeight
  });

  return textureKey;
}
