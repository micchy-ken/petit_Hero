import Phaser from 'phaser';

/**
 * 64x64pxのPetit_Hero風（精細ピクセルアート＋リッチシェーディング）勇者スプライトシートを動的生成。
 * 
 * 行の順番:
 * 0: Down (正面)
 * 1: Up (背面)
 * 2: Left (左向き)
 * 3: Right (右向き)
 */
export function generateHeroSpritesheet(scene: Phaser.Scene, mode: 'normal' | 'text' | 'grayscale' | boolean = 'normal'): string {
  const resolvedMode = mode === true ? 'text' : (mode === false ? 'normal' : mode);
  const textureKey = resolvedMode === 'text' 
    ? 'hero_spritesheet_text' 
    : (resolvedMode === 'grayscale' ? 'hero_spritesheet_gray' : 'hero_spritesheet');

  if (scene.textures.exists(textureKey)) {
    // If it exists, just return the key
    return textureKey;
  }

  const frameWidth = 64;
  const frameHeight = 64;
  const cols = 4;
  const rows = 4;

  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * cols;
  canvas.height = frameHeight * rows;
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

    for (let dir = 0; dir < rows; dir++) {
      for (let frame = 0; frame < cols; frame++) {
        const ox = frame * frameWidth;
        const oy = dir * frameHeight;

        tCtx.clearRect(0, 0, 32, 32);

        const isStep1 = frame === 1;
        const isStep2 = frame === 3;
        const bobY = (isStep1 || isStep2) ? -1 : 0;
        const legOffset = isStep1 ? 1 : (isStep2 ? -1 : 0);

        tCtx.save();
        tCtx.translate(0, bobY);

        // Floor shadow
        tCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        tCtx.beginPath();
        tCtx.ellipse(16, 29, 7, 2, 0, 0, Math.PI * 2);
        tCtx.fill();

        if (dir === 0) { // DOWN (Front)
          gp(10, 14, 12, 10, '#444444');
          gp(12, 24 + (legOffset > 0 ? -1 : 0), 3, 5, '#444444');
          gp(17, 24 + (legOffset < 0 ? -1 : 0), 3, 5, '#444444');
          gp(11, 14, 10, 10, '#888888');
          gp(13, 15, 6, 8, '#dddddd');
          gp(14, 23, 4, 2, '#444444');
          gp(12, 6, 8, 8, '#888888');
          gp(13, 7, 6, 6, '#dddddd');
          gp(11, 5, 10, 2, '#dddddd');
          gp(14, 9, 1, 1, '#000000');
          gp(17, 9, 1, 1, '#000000');
          gp(15, 3, 2, 2, '#ffffff');
          const shY = 15 + (isStep1 ? -1 : 0);
          gp(7, shY, 4, 6, '#dddddd');
          gp(8, shY + 1, 2, 4, '#444444');
          gp(7, shY + 2, 4, 1, '#ffffff');
          gp(8, shY, 1, 6, '#ffffff');
          const swY = 12 + (isStep2 ? -2 : 0);
          gp(21, swY + 6, 1, 4, '#dddddd');
          gp(21, swY + 5, 1, 1, '#ffffff');
          gp(20, swY + 9, 3, 1, '#444444');
          gp(21, swY + 10, 1, 2, '#000000');
        } else if (dir === 1) { // UP (Back)
          gp(9, 13, 14, 14, '#444444');
          gp(11, 15, 10, 12, '#888888');
          gp(12, 24 + (legOffset < 0 ? -1 : 0), 3, 5, '#444444');
          gp(17, 24 + (legOffset > 0 ? -1 : 0), 3, 5, '#444444');
          gp(12, 6, 8, 8, '#444444');
          gp(11, 5, 10, 2, '#888888');
          gp(14, 3, 4, 3, '#dddddd');
        } else if (dir === 2) { // LEFT
          gp(18, 14, 6, 11, '#444444');
          gp(13, 24, 3, 5, '#444444');
          gp(16, 24, 3, 5, '#888888');
          gp(12, 14, 7, 10, '#888888');
          gp(13, 15, 4, 8, '#dddddd');
          gp(13, 6, 7, 8, '#888888');
          gp(12, 8, 2, 2, '#dddddd');
          gp(14, 9, 1, 1, '#000000');
          const shY = 14 + (isStep1 ? -1 : 0);
          gp(9, shY, 4, 7, '#dddddd');
          gp(10, shY + 1, 2, 5, '#444444');
          gp(9, shY + 3, 4, 1, '#ffffff');
        } else if (dir === 3) { // RIGHT
          gp(8, 14, 6, 11, '#444444');
          gp(13, 24, 3, 5, '#888888');
          gp(16, 24, 3, 5, '#444444');
          gp(13, 14, 7, 10, '#888888');
          gp(15, 15, 4, 8, '#dddddd');
          gp(12, 6, 7, 8, '#888888');
          gp(18, 8, 2, 2, '#dddddd');
          gp(17, 9, 1, 1, '#000000');
          const swY = 12 + (isStep2 ? -1 : 0);
          gp(19, swY + 5, 6, 2, '#ffffff');
          gp(18, swY + 4, 1, 4, '#444444');
          gp(16, swY + 5, 2, 1, '#000000');
        }

        tCtx.restore();

        // Upscale 2x
        ctx.drawImage(tempCanvas, 0, 0, 32, 32, ox, oy, 64, 64);
      }
    }
  } else if (resolvedMode === 'text') {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px "Inter", sans-serif';

    for (let dir = 0; dir < rows; dir++) {
      for (let frame = 0; frame < cols; frame++) {
        const ox = frame * frameWidth + frameWidth / 2;
        const oy = dir * frameHeight + frameHeight / 2;
        ctx.fillText('勇', ox, oy);
      }
    }
  } else {

  // HD-2D用リッチカラーパレット（ハイライト・コア・シャドウの多層シェーディング）
  const palette = {
    skinHi: '#fff1e6',
    skin: '#ffe0b2',
    skinMid: '#f6b983',
    skinShadow: '#c88051',

    hairHi: '#ffe875',
    hair: '#e6a817',
    hairMid: '#ad7408',
    hairDark: '#6b4402',

    armorHi: '#8cd2ff',
    armor: '#309bff',
    armorMid: '#1468cc',
    armorDark: '#083c85',
    armorRim: '#b8e3ff',

    goldHi: '#ffffff',
    gold: '#ffd700',
    goldMid: '#e69500',
    goldDark: '#8c5200',

    capeHi: '#ff7a7a',
    cape: '#e62e2e',
    capeMid: '#ab1111',
    capeDark: '#660505',

    swordHi: '#ffffff',
    sword: '#e0f7ff',
    swordMid: '#8fb8cc',
    swordDark: '#385566',
    swordGlow: 'rgba(140, 210, 255, 0.6)',

    shieldBorderHi: '#e2e8f0',
    shieldBorder: '#94a3b8',
    shieldBorderDark: '#475569',
    shieldBase: '#1e293b',
    shieldEmblem: '#ffd700',

    leatherHi: '#a87954',
    leather: '#734d31',
    leatherDark: '#3d2514',

    shadowSoft: 'rgba(15, 23, 42, 0.45)',
    glowCyan: 'rgba(56, 189, 248, 0.4)',
    black: '#0f172a',
    white: '#ffffff'
  };

  /**
   * ピクセル単位の矩形を描画するヘルパー
   */
  const p = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  for (let dir = 0; dir < rows; dir++) {
    for (let frame = 0; frame < cols; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;

      ctx.save();
      ctx.translate(ox, oy);

      // 歩行アニメーションの上下バウンス＆体の傾き計算
      const isStep1 = frame === 1;
      const isStep2 = frame === 3;
      const bobY = (isStep1 || isStep2) ? -3 : 0;
      const swayX = isStep1 ? 1 : (isStep2 ? -1 : 0);
      const legOffset = isStep1 ? 4 : (isStep2 ? -4 : 0);

      // 1. HD-2D風リッチソフトシャドウ（グラデーション楕円）
      ctx.save();
      const shadowGrad = ctx.createRadialGradient(32, 57, 2, 32, 57, 18);
      shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
      shadowGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.2)');
      shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(32, 57, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // キャラクター全体をバウンスに合わせて移動
      ctx.save();
      ctx.translate(swayX, bobY);

      if (dir === 0) {
        // ==========================================
        // 【DOWN: 正面】 Petit_Hero 聖騎士勇者
        // ==========================================
        
        // --- なびくマント（後ろ側） ---
        p(18, 26, 28, 26, palette.capeDark);
        p(20, 26, 24, 24, palette.capeMid);
        p(22, 28, 20, 20, palette.cape);

        // --- 脚・ブーツ ---
        // 左足
        const leftLegY = 46 + (legOffset > 0 ? -2 : 0);
        p(23, leftLegY, 7, 12, palette.armorDark);
        p(24, leftLegY + 4, 6, 8, palette.leather);
        p(24, leftLegY + 6, 5, 6, palette.leatherHi);
        p(23, leftLegY + 10, 8, 3, palette.leatherDark); // ブーツつま先

        // 右足
        const rightLegY = 46 + (legOffset < 0 ? -2 : 0);
        p(34, rightLegY, 7, 12, palette.armorDark);
        p(34, rightLegY + 4, 6, 8, palette.leather);
        p(35, rightLegY + 6, 5, 6, palette.leatherHi);
        p(33, rightLegY + 10, 8, 3, palette.leatherDark);

        // --- 胴体（聖騎士の鎧） ---
        p(21, 28, 22, 18, palette.armorDark);
        p(22, 29, 20, 16, palette.armor);
        // 鎧のグラデーション・ハイライト（HD-2D光沢）
        p(24, 30, 8, 12, palette.armorHi);
        p(25, 31, 4, 10, palette.armorRim);
        p(32, 30, 8, 14, palette.armorMid);
        
        // 金の胸装飾（ロイヤルエンブレム）
        p(27, 31, 10, 4, palette.goldMid);
        p(28, 32, 8, 2, palette.gold);
        p(30, 32, 4, 6, palette.goldHi);

        // 腰のベルトとバックル
        p(21, 43, 22, 4, palette.leatherDark);
        p(22, 44, 20, 2, palette.leather);
        p(28, 42, 8, 6, palette.goldDark);
        p(29, 43, 6, 4, palette.gold);
        p(30, 44, 4, 2, palette.goldHi);

        // --- 頭部 ---
        // 首・顔ベース
        p(25, 24, 14, 6, palette.skinShadow);
        p(23, 14, 18, 14, palette.skin);
        p(24, 15, 10, 10, palette.skinHi);
        p(33, 16, 8, 12, palette.skinMid);

        // 瞳（碧眼アニメ調ハイライト）
        p(26, 20, 4, 4, palette.black);
        p(34, 20, 4, 4, palette.black);
        p(27, 21, 2, 3, palette.armorMid);
        p(35, 21, 2, 3, palette.armorMid);
        p(26, 20, 2, 2, palette.white);
        p(34, 20, 2, 2, palette.white);

        // 黄金のサークレット（額の王冠飾り）
        p(22, 16, 20, 4, palette.goldDark);
        p(22, 17, 20, 2, palette.gold);
        p(24, 17, 6, 1, palette.goldHi);
        // 中央の赤い宝珠
        p(30, 15, 4, 5, palette.capeDark);
        p(31, 16, 2, 3, palette.capeHi);

        // なびく金髪（精細レイヤー）
        p(21, 9, 22, 7, palette.hairDark);
        p(22, 10, 20, 6, palette.hair);
        p(23, 11, 14, 3, palette.hairHi);
        // 両サイドのハーフロングヘア
        p(20, 14, 4, 12, palette.hairDark);
        p(21, 14, 3, 10, palette.hair);
        p(40, 14, 4, 12, palette.hairDark);
        p(40, 14, 3, 10, palette.hairMid);

        // --- 左手と盾（タワーシールド） ---
        p(16, 30, 6, 10, palette.armor);
        const shY = 30 + (isStep1 ? -2 : 0);
        // 盾の縁取り
        p(11, shY, 12, 18, palette.shieldBorderDark);
        p(12, shY + 1, 10, 16, palette.shieldBorder);
        p(12, shY + 1, 3, 14, palette.shieldBorderHi);
        // 盾本体（重厚な濃紺鉄板）
        p(13, shY + 2, 8, 14, palette.shieldBase);
        // 黄金の十字架紋章
        p(16, shY + 3, 2, 12, palette.gold);
        p(14, shY + 6, 6, 2, palette.gold);
        p(16, shY + 4, 1, 10, palette.goldHi);

        // --- 右手と伝説の剣 ---
        p(42, 30, 6, 10, palette.armorMid);
        p(42, 38, 5, 5, palette.skin); // 手
        const swY = isStep2 ? -4 : 0;
        // 柄とツバ
        p(41, 35 + swY, 10, 4, palette.goldDark);
        p(42, 36 + swY, 8, 2, palette.gold);
        p(44, 38 + swY, 4, 6, palette.leather); // グリップ
        p(43, 44 + swY, 6, 4, palette.gold); // 柄頭宝珠
        // 刀身（オーラを纏う聖剣）
        ctx.fillStyle = palette.swordGlow;
        ctx.fillRect(44, 8 + swY, 8, 28);
        p(46, 10 + swY, 4, 26, palette.swordDark);
        p(46, 10 + swY, 3, 25, palette.swordMid);
        p(47, 10 + swY, 2, 24, palette.sword);
        p(47, 10 + swY, 1, 22, palette.swordHi);

      } else if (dir === 1) {
        // ==========================================
        // 【UP: 背面】 Petit_Hero なびくマント姿
        // ==========================================
        
        // 背中に背負った剣の先端
        p(42, 10, 4, 20, palette.swordDark);
        p(43, 10, 2, 18, palette.sword);
        p(43, 10, 1, 16, palette.swordHi);

        // 脚・ブーツ（後ろ姿）
        const leftLegY = 46 + (legOffset < 0 ? -2 : 0);
        const rightLegY = 46 + (legOffset > 0 ? -2 : 0);
        p(24, leftLegY, 6, 12, palette.leatherDark);
        p(25, leftLegY + 2, 5, 10, palette.leather);
        p(34, rightLegY, 6, 12, palette.leatherDark);
        p(34, rightLegY + 2, 5, 10, palette.leather);

        // 大マント（背面全体をリッチに覆う）
        p(17, 24, 30, 26, palette.capeDark);
        p(18, 25, 28, 24, palette.cape);
        // マントのグラデーションと劇的なシワ（シェーディング）
        p(20, 26, 8, 22, palette.capeHi);
        p(28, 26, 6, 22, palette.capeMid);
        p(34, 26, 10, 22, palette.capeDark);
        p(22, 34, 4, 14, palette.capeDark); // 深いひだ

        // 頭部後ろ姿
        p(21, 10, 22, 18, palette.hairDark);
        p(22, 11, 20, 16, palette.hair);
        p(24, 12, 12, 6, palette.hairHi);
        p(22, 18, 8, 8, palette.hairMid); // 後頭部の髪の流れ

        // サークレットの後ろ紐
        p(21, 20, 22, 3, palette.goldDark);
        p(22, 21, 20, 1, palette.gold);

        // 左側に少しののぞく盾の縁
        p(13, 32, 4, 14, palette.shieldBorderDark);
        p(14, 33, 2, 12, palette.shieldBorder);

      } else if (dir === 2) {
        // ==========================================
        // 【LEFT: 左向き】 Petit_Hero 躍動する横姿
        // ==========================================

        // --- なびくマント（右後ろへ劇的に広がる） ---
        p(32, 26, 16, 22, palette.capeDark);
        p(34, 28, 14, 18, palette.cape);
        p(36, 30, 12, 14, palette.capeHi);
        p(44, 34, 6, 10, palette.capeMid); // マント先端

        // --- 脚（前後のストライド） ---
        const fLegX = 27 + (isStep1 ? -6 : (isStep2 ? 6 : 0));
        const bLegX = 29 + (isStep1 ? 6 : (isStep2 ? -6 : 0));
        // 奥の脚（右脚：暗め）
        p(bLegX, 46, 6, 12, palette.leatherDark);
        p(bLegX + 1, 48, 4, 10, palette.leather);
        // 手前の脚（左脚：明るめ）
        p(fLegX, 45, 6, 13, palette.armorDark);
        p(fLegX + 1, 47, 5, 11, palette.leather);
        p(fLegX + 1, 49, 3, 8, palette.leatherHi);
        p(fLegX - 2, 55, 8, 3, palette.leatherDark); // ブーツ

        // --- 胴体 ---
        p(24, 28, 12, 18, palette.armorDark);
        p(25, 29, 10, 16, palette.armor);
        p(25, 30, 4, 14, palette.armorHi);
        p(29, 30, 6, 14, palette.armorMid);
        // 腰ベルト
        p(23, 43, 14, 4, palette.leatherDark);
        p(24, 44, 12, 2, palette.gold);

        // --- 頭部（精悍な横顔） ---
        p(23, 14, 14, 14, palette.skin);
        p(23, 15, 8, 10, palette.skinHi);
        p(30, 16, 7, 12, palette.skinShadow);
        // 鼻筋・顎の立体感
        p(21, 19, 3, 4, palette.skinHi);
        p(22, 23, 3, 2, palette.skin);

        // 目
        p(23, 19, 3, 4, palette.black);
        p(23, 20, 2, 2, palette.armorRim);
        p(23, 19, 1, 1, palette.white);

        // 金髪（後ろに流れる）
        p(24, 10, 16, 16, palette.hairDark);
        p(25, 11, 14, 14, palette.hair);
        p(26, 11, 8, 4, palette.hairHi);
        p(34, 14, 8, 12, palette.hairMid); // 後ろになびく髪

        // サークレット
        p(22, 16, 14, 3, palette.goldDark);
        p(22, 17, 12, 1, palette.goldHi);

        // --- 盾（左側面に堂々と構える） ---
        const shY = 29 + (isStep1 ? -2 : 0);
        p(14, shY, 10, 20, palette.shieldBorderDark);
        p(15, shY + 1, 8, 18, palette.shieldBorder);
        p(15, shY + 1, 2, 16, palette.shieldBorderHi);
        p(16, shY + 2, 6, 16, palette.shieldBase);
        // 盾のエンブレム（側面から見た十字）
        p(17, shY + 4, 2, 12, palette.gold);
        p(16, shY + 8, 5, 2, palette.goldHi);

      } else if (dir === 3) {
        // ==========================================
        // 【RIGHT: 右向き】 Petit_Hero 聖剣を構える姿
        // ==========================================

        // --- なびくマント（左後ろへなびく） ---
        p(16, 26, 16, 22, palette.capeDark);
        p(16, 28, 14, 18, palette.cape);
        p(16, 30, 10, 14, palette.capeMid);

        // --- 脚 ---
        const fLegX = 31 + (isStep1 ? 6 : (isStep2 ? -6 : 0));
        const bLegX = 29 + (isStep1 ? -6 : (isStep2 ? 6 : 0));
        p(bLegX, 46, 6, 12, palette.leatherDark);
        p(bLegX + 1, 48, 4, 10, palette.leather);
        p(fLegX, 45, 6, 13, palette.armorDark);
        p(fLegX + 1, 47, 5, 11, palette.leather);
        p(fLegX + 2, 49, 3, 8, palette.leatherHi);
        p(fLegX, 55, 8, 3, palette.leatherDark);

        // --- 胴体 ---
        p(28, 28, 12, 18, palette.armorDark);
        p(29, 29, 10, 16, palette.armor);
        p(34, 30, 5, 14, palette.armorHi);
        p(29, 30, 5, 14, palette.armorMid);
        p(27, 43, 14, 4, palette.leatherDark);
        p(28, 44, 12, 2, palette.gold);

        // --- 頭部 ---
        p(27, 14, 14, 14, palette.skin);
        p(31, 15, 8, 10, palette.skinHi);
        p(27, 16, 5, 12, palette.skinShadow);
        p(40, 19, 3, 4, palette.skinHi); // 鼻
        p(39, 23, 3, 2, palette.skin);

        // 目
        p(38, 19, 3, 4, palette.black);
        p(39, 20, 2, 2, palette.armorRim);
        p(39, 19, 1, 1, palette.white);

        // 髪
        p(24, 10, 16, 16, palette.hairDark);
        p(25, 11, 14, 14, palette.hair);
        p(30, 11, 8, 4, palette.hairHi);
        p(22, 14, 8, 12, palette.hairDark); // 後ろ髪

        p(28, 16, 14, 3, palette.goldDark);
        p(30, 17, 12, 1, palette.goldHi);

        // --- 聖剣（右側に力強く構える） ---
        const swY = isStep2 ? -3 : 0;
        p(36, 32, 8, 8, palette.armor); // 右腕
        p(40, 36, 5, 5, palette.skin);
        // ツバ
        p(41, 33 + swY, 4, 10, palette.goldDark);
        p(42, 34 + swY, 2, 8, palette.goldHi);
        // 刀身（前方に光を放つ）
        ctx.fillStyle = palette.swordGlow;
        ctx.fillRect(44, 14 + swY, 16, 24);
        p(44, 18 + swY, 14, 6, palette.swordDark);
        p(45, 19 + swY, 13, 4, palette.sword);
        p(46, 20 + swY, 12, 2, palette.swordHi);
      }

      ctx.restore(); // 揺れ restore
      ctx.restore(); // 座標 restore
    }
  }
  } // <--- Added closing brace for else block

  // Phaserテクスチャへ登録
  scene.textures.addSpriteSheet(textureKey, canvas as unknown as HTMLImageElement, {
    frameWidth: frameWidth,
    frameHeight: frameHeight
  });

  return textureKey;
}
