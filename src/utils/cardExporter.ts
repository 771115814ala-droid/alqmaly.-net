import { jsPDF } from 'jspdf';
import type { RegistrationRecord } from '../types';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTopRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBottomRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, r);
  ctx.clip();
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let drawW = w;
  let drawH = h;
  let drawX = x;
  let drawY = y;
  if (imgRatio > boxRatio) {
    drawW = h * imgRatio;
    drawX = x - (drawW - w) / 2;
  } else {
    drawH = w / imgRatio;
    drawY = y - (drawH - h) / 2;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let drawW = w;
  let drawH = h;
  if (imgRatio > boxRatio) {
    drawH = w / imgRatio;
  } else {
    drawW = h * imgRatio;
  }
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function formatYmd(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export async function renderRegistrationCardToDataUrl(
  record: Partial<RegistrationRecord>
): Promise<string> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Exact 4x6 inches at 350 DPI => 1400 x 2100 px
  const W = 1400;
  const H = 2100;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const isTransport = record.category === 'transport';
  const outerRingColor = isTransport ? '#DC2626' : '#2563EB';
  const midRingColor = isTransport ? '#FECACA' : '#BFDBFE';
  const navyColor = isTransport ? '#7F1D1D' : '#132654';
  const sectionHeaderColor = isTransport ? '#991B1B' : '#132654';
  const boxBorderColor = isTransport ? '#FCA5A5' : '#93C5FD';
  const categoryLabel = isTransport ? 'نقل' : 'خصوصي';

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Triple Rounded Borders matching reference form
  ctx.strokeStyle = outerRingColor;
  ctx.lineWidth = 6;
  drawRoundedRect(ctx, 12, 12, W - 24, H - 24, 34);
  ctx.stroke();

  ctx.strokeStyle = midRingColor;
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 26, 26, W - 52, H - 52, 26);
  ctx.stroke();

  ctx.strokeStyle = navyColor;
  ctx.lineWidth = 3.5;
  drawRoundedRect(ctx, 40, 40, W - 80, H - 80, 20);
  ctx.stroke();

  const [emblemsImg, stampImg, watermarkImg, ownerImg, plateImg] = await Promise.all([
    loadImage('/assets/emblems_strip.png'),
    loadImage('/assets/committee_stamp.png'),
    loadImage('/assets/aistudio/Screenshot_________________Google_44390101.jpg'),
    loadImage(record.ownerPhoto || ''),
    loadImage(record.plateImage || ''),
  ]);

  // Full-form continuous watermark spanning across the registration sheet
  if (watermarkImg) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = 'contrast(1.1)';
    ctx.drawImage(watermarkImg, 54, 170, W - 108, H - 250);
    ctx.restore();
  }

  // 1. Official Top Header (y: 56..255)
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = navyColor;
  ctx.font = '700 22px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('الجمهورية اليمنية', W - 70, 88);
  ctx.font = '600 20px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('وزارة الداخلية', W - 70, 118);
  ctx.fillText('إدارة مرور محافظة تعز', W - 70, 148);
  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillText('لجنة ترقيم الجمارك', W - 70, 178);

  // Center Emblems
  if (emblemsImg) {
    drawContainImage(ctx, emblemsImg, 430, 56, 540, 130);
  }

  // Left Official Text
  ctx.textAlign = 'left';
  ctx.fillStyle = navyColor;
  ctx.font = '700 21px "Cairo", sans-serif';
  ctx.fillText('وزارة الداخلية', 70, 88);
  ctx.font = '600 20px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('إدارة مرور محافظة تعز', 70, 118);
  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillText('لجنة ترقيم الجمارك', 70, 148);
  ctx.fillStyle = '#64748B';
  ctx.font = '600 15px "JetBrains Mono", sans-serif';
  ctx.fillText('TAIZ TRAFFIC DEPARTMENT', 70, 174);

  // Main Centered Title
  ctx.textAlign = 'center';
  ctx.fillStyle = navyColor;
  ctx.font = '800 34px "Cairo", sans-serif';
  ctx.fillText('استمارة الفحص والترقيم', W / 2, 232);

  // 2. Sub-Header Band: Serial/Form | Plate Graphic | Plate Photo (y: 256..384)
  const combinedPlate = [record.plateRegion, record.plateNumber].filter(Boolean).join(' - ');

  // Right: Serial & Form Number
  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = '600 19px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('رقم تسلسلي :', W - 70, 294);

  ctx.fillStyle = '#F1F5F9';
  drawRoundedRect(ctx, W - 365, 266, 175, 38, 8);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 19px "JetBrains Mono", monospace';
  ctx.fillText(record.serialNumber || 'REG-DRAFT', W - 277, 292);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = '600 19px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('رقم الاستمارة:', W - 70, 346);
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 20px "JetBrains Mono", monospace';
  ctx.fillText(record.formNumber || '---', W - 210, 346);

  // Center: 3-Compartment Plate Box
  const pBoxX = 415;
  const pBoxY = 262;
  const pBoxW = 570;
  const pBoxH = 74;

  ctx.fillStyle = isTransport ? '#DC2626' : '#FFFFFF';
  drawRoundedRect(ctx, pBoxX, pBoxY, pBoxW, pBoxH, 12);
  ctx.fill();
  ctx.strokeStyle = isTransport ? '#991B1B' : '#132654';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Right compartment (category)
  ctx.save();
  drawRoundedRect(ctx, pBoxX + pBoxW - 155, pBoxY + 2, 153, pBoxH - 4, 10);
  ctx.clip();
  ctx.fillStyle = isTransport ? '#B91C1C' : '#F1F5F9';
  ctx.fillRect(pBoxX + pBoxW - 155, pBoxY + 2, 153, pBoxH - 4);
  ctx.restore();

  ctx.strokeStyle = isTransport ? '#991B1B' : '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pBoxX + pBoxW - 155, pBoxY);
  ctx.lineTo(pBoxX + pBoxW - 155, pBoxY + pBoxH);
  ctx.stroke();

  // Left compartment (YEM)
  ctx.save();
  drawRoundedRect(ctx, pBoxX + 2, pBoxY + 2, 110, pBoxH - 4, 10);
  ctx.clip();
  ctx.fillStyle = isTransport ? '#7F1D1D' : '#132654';
  ctx.fillRect(pBoxX + 2, pBoxY + 2, 110, pBoxH - 4);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 18px "JetBrains Mono", sans-serif';
  ctx.fillText('YEM', pBoxX + 57, pBoxY + 34);
  ctx.font = '700 17px "Cairo", sans-serif';
  ctx.fillText('اليمن', pBoxX + 57, pBoxY + 58);

  ctx.fillStyle = isTransport ? '#FFFFFF' : '#132654';
  ctx.font = '700 24px "Cairo", sans-serif';
  ctx.fillText(categoryLabel, pBoxX + pBoxW - 77, pBoxY + 46);

  ctx.fillStyle = isTransport ? '#FFFFFF' : '#0F172A';
  ctx.font = '800 32px "JetBrains Mono", "Cairo", sans-serif';
  ctx.fillText(combinedPlate || '---', pBoxX + 112 + (pBoxW - 267) / 2, pBoxY + 49);

  // Issue & Expiry dates below plate box
  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = '600 18px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`إصدار: ${formatYmd(record.createdAt || '')}`, pBoxX + pBoxW, pBoxY + 104);
  ctx.textAlign = 'left';
  ctx.fillText(`انتهاء: ${record.expiryDate || '---'}`, pBoxX, pBoxY + 104);

  // Left: Plate Photo Thumbnail
  const ptX = 70;
  const ptY = 258;
  const ptW = 320;
  const ptH = 114;
  ctx.fillStyle = '#F8FAFC';
  drawRoundedRect(ctx, ptX, ptY, ptW, ptH, 12);
  ctx.fill();
  ctx.strokeStyle = boxBorderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (plateImg) {
    if (record.plateImageFit === 'cover') {
      drawCoverImage(ctx, plateImg, ptX + 4, ptY + 4, ptW - 8, ptH - 8, 9);
    } else {
      ctx.save();
      drawRoundedRect(ctx, ptX + 4, ptY + 4, ptW - 8, ptH - 8, 9);
      ctx.clip();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(ptX + 4, ptY + 4, ptW - 8, ptH - 8);
      drawContainImage(ctx, plateImg, ptX + 4, ptY + 4, ptW - 8, ptH - 8);
      ctx.restore();
    }
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 18px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('صورة لوحة السيارة', ptX + ptW / 2, ptY + 62);
  }

  // Helper to draw dark section bar + bordered body + watermark
  const drawSectionShell = (
    rightTitle: string,
    leftTitle: string,
    y: number,
    bodyH: number
  ) => {
    const x = 66;
    const w = W - 132;
    const barH = 44;

    ctx.fillStyle = sectionHeaderColor;
    drawTopRoundedRect(ctx, x, y, w, barH, 12);
    ctx.fill();

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 20px "Cairo", sans-serif';
    ctx.fillText(rightTitle, x + w - 22, y + 29);

    ctx.textAlign = 'left';
    ctx.fillText(leftTitle, x + 22, y + 29);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    drawBottomRoundedRect(ctx, x, y + barH, w, bodyH, 12);
    ctx.fill();
    ctx.strokeStyle = boxBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawLabelValue = (
    label: string,
    value: string,
    rightX: number,
    y: number,
    maxChars = 28,
    mono = false
  ) => {
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(label, rightX, y);

    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#0F172A';
    ctx.font = mono
      ? '700 18px "JetBrains Mono", monospace'
      : '700 19px "IBM Plex Sans Arabic", sans-serif';
    const textVal = (value || '---').slice(0, maxChars);
    ctx.fillText(textVal, rightX - labelWidth - 14, y);
  };

  const drawWrappedLabelValue = (
    label: string,
    value: string,
    rightX: number,
    y: number,
    maxWidth: number,
    lineHeight = 25,
    maxLines = 2
  ) => {
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(label, rightX, y);

    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 18px "IBM Plex Sans Arabic", sans-serif';

    const text = (value || '---').trim();
    const words = text.split(/\s+/);
    const firstLineMaxW = Math.max(80, maxWidth - labelWidth - 16);
    const nextLineMaxW = maxWidth;

    const lines: string[] = [];
    let currentLine = '';
    let lineLimit = firstLineMaxW;

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= lineLimit) {
        currentLine = candidate;
      } else if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) break;
        currentLine = word;
        lineLimit = nextLineMaxW;
      } else {
        lines.push(candidate);
        if (lines.length >= maxLines) break;
        currentLine = '';
        lineLimit = nextLineMaxW;
      }
    }
    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    lines.forEach((line, idx) => {
      const lineX = idx === 0 ? rightX - labelWidth - 14 : rightX;
      ctx.fillText(line, lineX, y + idx * lineHeight);
    });
  };

  // 3. Section 1: Owner Data (y: 392, bar 44 + body 268 => ends 704)
  const s1Y = 392;
  drawSectionShell('البيانات الشخصية والعنوان', 'بيانات المالك', s1Y, 268);
  const o = record.owner;

  // Owner 4x6 Photo Box on Left
  const opX = 90;
  const opY = s1Y + 62;
  const opW = 154;
  const opH = 198;
  ctx.fillStyle = isTransport ? '#FEF2F2' : '#EFF6FF';
  drawRoundedRect(ctx, opX, opY, opW, opH, 10);
  ctx.fill();
  ctx.strokeStyle = boxBorderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (ownerImg) {
    if (record.ownerPhotoFit === 'cover') {
      drawCoverImage(ctx, ownerImg, opX + 4, opY + 4, opW - 8, opH - 8, 8);
    } else {
      ctx.save();
      drawRoundedRect(ctx, opX + 4, opY + 4, opW - 8, opH - 8, 8);
      ctx.clip();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(opX + 4, opY + 4, opW - 8, opH - 8);
      drawContainImage(ctx, ownerImg, opX + 4, opY + 4, opW - 8, opH - 8);
      ctx.restore();
    }
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E3A8A';
    ctx.font = '600 18px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('صورة 4×6', opX + opW / 2, opY + opH / 2 + 6);
  }

  // Owner fields (2 RTL columns right of photo)
  drawLabelValue('الاسم الرباعي:', o?.fullName || '', W - 88, s1Y + 80, 30);
  drawLabelValue('تاريخ الميلاد:', o?.birthDate || '', W - 88, s1Y + 120, 22, true);
  drawLabelValue('نوع الهوية:', o?.idType || 'بطاقة شخصية', W - 88, s1Y + 160, 22);
  drawLabelValue('مكان الإصدار:', o?.issuePlace || '', W - 88, s1Y + 200, 24);

  drawLabelValue('رقم الهاتف:', o?.mobile || '', 760, s1Y + 80, 20, true);
  drawLabelValue('فصيلة الدم:', o?.bloodType || '', 760, s1Y + 120, 10, true);
  drawLabelValue('رقم الهوية:', o?.nationalId || '', 760, s1Y + 160, 22, true);
  drawLabelValue('الجنسية:', o?.nationality || 'يمني', 760, s1Y + 200, 20);

  // Wrapped residence address row right of Owner photo
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(opX + opW + 20, s1Y + 224);
  ctx.lineTo(W - 88, s1Y + 224);
  ctx.stroke();
  drawWrappedLabelValue(
    'عنوان السكن الكامل:',
    o?.currentResidence || o?.cardAddress || '',
    W - 88,
    s1Y + 254,
    W - 88 - (opX + opW + 20),
    24,
    2
  );

  // 4. Section 2: Vehicle Technical Specs (y: 716, bar 44 + body 504 => ends 1264)
  const s2Y = 716;
  drawSectionShell('البيانات الفنية للمركبة', 'مواصفات المركبة المسجلة', s2Y, 504);
  const v = record.vehicle;

  // Row 1 inside section 2: plate badge + category badge
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('رقم اللوحة:', W - 88, s2Y + 84);

  ctx.fillStyle = isTransport ? '#DC2626' : '#F8FAFC';
  drawRoundedRect(ctx, W - 460, s2Y + 56, 265, 38, 8);
  ctx.fill();
  ctx.strokeStyle = isTransport ? '#991B1B' : navyColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = isTransport ? '#FFFFFF' : navyColor;
  ctx.font = '700 19px "JetBrains Mono", "Cairo", sans-serif';
  ctx.fillText(`${categoryLabel}  |  ${combinedPlate || '---'}`, W - 327, s2Y + 82);

  // Left side: نوع وفئة اللوحة
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('نوع وفئة اللوحة:', 720, s2Y + 84);

  ctx.fillStyle = isTransport ? '#DC2626' : '#132654';
  drawRoundedRect(ctx, 435, s2Y + 58, 125, 34, 8);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 18px "Cairo", sans-serif';
  ctx.fillText(categoryLabel, 497, s2Y + 81);

  ctx.textAlign = 'left';
  ctx.fillStyle = isTransport ? '#B91C1C' : '#64748B';
  ctx.font = '600 17px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(isTransport ? '(لوحة حمراء - نقل)' : '(لوحة زرقاء - خصوصي)', 88, s2Y + 84);

  // Specs top rows
  drawLabelValue('الماركة:', v?.make || '', W - 88, s2Y + 134, 24);
  drawLabelValue('سنة الصنع:', v?.year || '', W - 88, s2Y + 180, 10, true);
  drawLabelValue('الطراز:', v?.trim || '', W - 88, s2Y + 226, 20, true);

  drawLabelValue('نوع المركبة:', v?.model || '', 720, s2Y + 134, 24);
  drawLabelValue('اللون:', v?.color || '', 720, s2Y + 180, 28);

  // VIN Strip + 17 Character Boxes
  const vinUpper = (v?.vin || '').toUpperCase().replace(/\s+/g, '');
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('رقم القاعدة VIN:', W - 88, s2Y + 276);

  ctx.fillStyle = navyColor;
  ctx.font = '700 21px "JetBrains Mono", monospace';
  ctx.fillText(vinUpper || '-----------------', W - 260, s2Y + 276);

  const boxStartX = 90;
  const boxEndX = W - 90;
  const totalBoxesW = boxEndX - boxStartX;
  const gap = 8;
  const boxW = (totalBoxesW - gap * 16) / 17;
  const boxH = 44;
  const boxY = s2Y + 296;

  for (let i = 0; i < 17; i++) {
    const bx = boxStartX + i * (boxW + gap);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    drawRoundedRect(ctx, bx, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.strokeStyle = boxBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    const ch = vinUpper[i] || '';
    if (ch) {
      ctx.textAlign = 'center';
      ctx.fillStyle = navyColor;
      ctx.font = '700 22px "JetBrains Mono", monospace';
      ctx.fillText(ch, bx + boxW / 2, boxY + 30);
    }
  }

  // Bottom 3 rows inside Section 2
  drawLabelValue('رقم المحرك:', v?.engineNumber || '', W - 88, s2Y + 388, 24, true);
  drawLabelValue('عدد الأسطوانات:', v?.cylinders || '', W - 88, s2Y + 432, 18, true);
  drawLabelValue('جهة إصدار البيان:', v?.customsPort || '', W - 88, s2Y + 476, 26);

  drawLabelValue('نوع الوقود:', v?.fuelType || '', 720, s2Y + 388, 18);
  drawLabelValue('رقم البيان الجمركي:', v?.declarationNumber || '', 720, s2Y + 432, 22, true);
  drawLabelValue('تاريخ البيان الجمركي:', v?.declarationDate || '', 720, s2Y + 476, 20, true);

  // 5. Section 3: Guarantors / Witnesses (y: 1278, bar 44 + body 348 => ends 1670)
  const s3Y = 1278;
  drawSectionShell('بيانات المعرفين (الضامنين والشهود)', 'الضمانة القانونية', s3Y, 348);
  const witnesses = record.witnesses || [];

  const cardGap = 24;
  const cardW = (W - 132 - 36 - cardGap) / 2;
  const cardH = 318;
  const cardY = s3Y + 60;

  for (let i = 0; i < 2; i++) {
    const wItem = witnesses[i];
    const cx = i === 0 ? W - 84 - cardW : 84;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    drawRoundedRect(ctx, cx, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = boxBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = navyColor;
    ctx.font = '700 20px "Cairo", sans-serif';
    ctx.fillText(i === 0 ? 'المعرف الأول' : 'المعرف الثاني', cx + cardW - 18, cardY + 34);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 15px "JetBrains Mono", sans-serif';
    ctx.fillText(`GUARANTOR-0${i + 1}`, cx + 18, cardY + 32);

    drawLabelValue('الاسم:', wItem?.fullName || '', cx + cardW - 18, cardY + 78, 28);
    drawLabelValue('الرقم الوطني:', wItem?.nationalId || '', cx + cardW - 18, cardY + 120, 20, true);
    drawLabelValue('نوع القرابة:', wItem?.relation || '', cx + cardW - 18, cardY + 162, 20);
    drawLabelValue('رقم الهاتف:', wItem?.mobile || '', cx + cardW - 18, cardY + 204, 18, true);
    drawWrappedLabelValue(
      'عنوان السكن:',
      wItem?.currentResidence || wItem?.cardAddress || '',
      cx + cardW - 18,
      cardY + 248,
      cardW - 36,
      26,
      2
    );
  }

  // 6. Bottom Signatures & Official Stamp (y: 1682..2035)
  const sigY = 1700;
  const sigBoxW = 290;
  const sigBoxH = 132;
  const sigTitles = ['المختص الفني', 'رئيس القسم الفني', 'مدير الإصدار الآلي'];

  sigTitles.forEach((title, idx) => {
    const sx = W - 70 - sigBoxW - idx * (sigBoxW + 20);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.62)';
    drawRoundedRect(ctx, sx, sigY, sigBoxW, sigBoxH, 12);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = navyColor;
    ctx.font = '700 20px "Cairo", sans-serif';
    ctx.fillText(title, sx + sigBoxW / 2, sigY + 42);

    ctx.fillStyle = '#64748B';
    ctx.font = '500 17px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('التوقيع: .............................', sx + sigBoxW / 2, sigY + 96);
  });

  // Official Committee Stamp on Left
  if (stampImg) {
    drawContainImage(ctx, stampImg, 95, 1672, 205, 205);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = navyColor;
  ctx.font = '700 18px "Cairo", sans-serif';
  ctx.fillText('ختم لجنة الترقيم بالجمارك', 200, 1904);

  // Bottom Footer Line
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 1965);
  ctx.lineTo(W - 70, 1965);
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = '700 19px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('مصمم ومطور النظام المهندس / علاء القاضي', W / 2, 2005);

  return canvas.toDataURL('image/png', 1.0);
}

export async function downloadRegistrationImage(record: Partial<RegistrationRecord>) {
  const dataUrl = await renderRegistrationCardToDataUrl(record);
  const link = document.createElement('a');
  const safePlate = (record.plateNumber || record.serialNumber || 'vehicle').replace(/\s+/g, '-');
  link.href = dataUrl;
  link.download = `استمارة-ترقيم-4x6-${safePlate}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadRegistrationPdf(record: Partial<RegistrationRecord>) {
  const dataUrl = await renderRegistrationCardToDataUrl(record);
  // Exact 4x6 inches = 101.6mm x 152.4mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [101.6, 152.4],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, 101.6, 152.4, undefined, 'FAST');
  const safePlate = (record.plateNumber || record.serialNumber || 'vehicle').replace(/\s+/g, '-');
  pdf.save(`استمارة-ترقيم-4x6-${safePlate}.pdf`);
}
