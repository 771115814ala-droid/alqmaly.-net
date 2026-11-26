import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'registrations.json');

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readRegistrations(): any[] {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRegistrations(records: any[]) {
  ensureDb();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(records, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseBase64Payload(imageDataUrl: string, fallbackMime = 'image/jpeg') {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    throw new Error('INVALID_IMAGE');
  }
  const trimmed = imageDataUrl.trim();
  const match = trimmed.match(/^data:([^;,]+)(?:;[^,]*)?;base64,([\s\S]+)$/);
  if (match) {
    return {
      mimeType: match[1].trim() || fallbackMime,
      data: match[2].replace(/\s+/g, ''),
    };
  }
  return { mimeType: fallbackMime, data: trimmed.replace(/\s+/g, '') };
}

function parseAiJson(rawText: string | undefined): Record<string, any> {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('EMPTY_AI_RESPONSE');
  }
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  if (!cleaned) {
    throw new Error('EMPTY_AI_RESPONSE');
  }
  return JSON.parse(cleaned);
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxAttempts = 2
) {
  const modelsToTry =
    params.model === 'gemini-4-hydrogen'
      ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
      : [params.model];

  let lastError: any;
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model: modelName });
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status ?? err?.code ?? 0);
        const msg = String(err?.message || '');
        const isDailyQuota = status === 429 && (msg.includes('PerDay') || msg.includes('GenerateRequestsPerDay'));
        if (isDailyQuota) {
          // Move immediately to fallback model if daily quota for this model is exhausted
          break;
        }
        const isTransient = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
        if (!isTransient || attempt === maxAttempts) {
          if (status === 429) break;
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }
  }
  throw lastError;
}

function handleAiRouteError(res: express.Response, error: any, fallbackMessage: string, context: string) {
  const msg = String(error?.message || '');
  const status = Number(error?.status ?? error?.code ?? 0);

  if (msg === 'GEMINI_API_KEY_MISSING') {
    res.status(503).json({
      success: false,
      error: 'مفتاح Gemini API غير مهيأ على الخادم. يرجى التأكد من إضافته في Settings > Secrets.',
    });
    return;
  }
  if (msg === 'INVALID_IMAGE') {
    res.status(400).json({ success: false, error: 'الصورة المرفوعة غير صالحة أو فارغة.' });
    return;
  }
  if (
    status === 403 ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key')
  ) {
    console.error(`${context} auth/key error:`, msg);
    res.status(status === 400 ? 400 : 403).json({
      success: false,
      error: 'مفتاح Gemini API غير صالح أو لا يملك الصلاحية المطلوبة. يرجى التحقق منه في Settings > Secrets.',
      detail: msg,
    });
    return;
  }
  if (status === 404 || msg.includes('NOT_FOUND')) {
    console.error(`${context} model not found:`, msg);
    res.status(404).json({
      success: false,
      error: 'نموذج الذكاء الاصطناعي المطلوب غير متاح حالياً.',
      detail: msg,
    });
    return;
  }
  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    console.error(`${context} quota exceeded:`, msg);
    res.status(429).json({
      success: false,
      error:
        'تم استنفاد الحصة اليومية المجانية للذكاء الاصطناعي. يمكنك الترقية أو اختيار مفتاح API مفعّل للفوترة من Settings > Secrets لزيادة الحد المسموح.',
      detail: msg,
    });
    return;
  }
  if (msg === 'EMPTY_AI_RESPONSE' || error instanceof SyntaxError) {
    console.error(`${context} JSON parse error:`, msg);
    res.status(502).json({
      success: false,
      error: 'أعاد الذكاء الاصطناعي استجابة غير مكتملة. يرجى المحاولة مرة أخرى بصورة أوضح.',
      detail: msg,
    });
    return;
  }

  console.error(`${context} error:`, error);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    error: fallbackMessage,
    detail: msg,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Extract vehicle & customs data from Customs Declaration image (البيان الجمركي)
  app.post('/api/extract/customs', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body ?? {};
      const parsed = parseBase64Payload(imageBase64, mimeType || 'image/jpeg');
      const ai = getAiClient();

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.data,
              },
            },
            {
              text:
                'اقرأ هذه الصورة الخاصة بالبيان الجمركي للمركبة بدقة متناهية خانةً بخانة. ' +
                'استخرج القيمة المكتوبة فعلياً داخل كل خانة مطابقة في المستند دون أي تخمين أو افتراض مسبق:\n' +
                '- declarationNumber: رقم البيان الجمركي بالأرقام كما هو مكتوب تماماً.\n' +
                '- declarationDate: تاريخ البيان الجمركي.\n' +
                '- customsPort: اسم المنفذ أو الدائرة الجمركية.\n' +
                '- make: الماركة / الصانع كما هو في البيان.\n' +
                '- model: نوع المركبة / الموديل كما هو في البيان.\n' +
                '- trim: الرقم أو الرمز المدون في خانة (الطراز) على البيان الجمركي فقط.\n' +
                '- year: سنة الصنع / الموديل (أربعة أرقام).\n' +
                '- vin: رقم القاعدة / الهيكل / الشاصي (17 حرفاً ورقماً لاتينياً بدقة تامة).\n' +
                '- engineNumber: رقم المحرك كما هو مدون بالضبط.\n' +
                '- color: اقرأ خانة (اللون / Color) في البيان الجمركي بدقة فائقة وانقل اللون الحقيقي المكتوب في الصورة حرفياً بالعربية (مثل أزرق إذا كان مكتوباً ازرق أو Blue، ولا تفترض لوناً شائعاً).\n' +
                '- cylinders: عدد الأسطوانات / السلندر أو السعة.\n' +
                '- fuelType: نوع الوقود كما هو مدون في البيان.\n' +
                'إذا كانت الخانة فارغة أو غير مقروءة تماماً اتركها "".',
            },
          ],
        },
        config: {
          systemInstruction:
            'أنت نظام تدقيق ومطابقة بصرية (OCR) للمستندات الجمركية. مهمتك نسخ النصوص والأرقام والألوان الظاهرة فعلياً في الصورة بنسبة تطابق 100% دون استنتاج من الذاكرة أو تعبئة قيم افتراضية.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              declarationNumber: { type: Type.STRING, description: 'رقم البيان الجمركي من خانة رقم البيان' },
              declarationDate: { type: Type.STRING, description: 'تاريخ البيان الجمركي' },
              customsPort: { type: Type.STRING, description: 'اسم المنفذ أو الدائرة الجمركية' },
              make: { type: Type.STRING, description: 'ماركة المركبة الظاهرة في الصورة' },
              model: { type: Type.STRING, description: 'نوع أو موديل المركبة الظاهر في الصورة' },
              trim: { type: Type.STRING, description: 'الرقم أو الرمز المدون في خانة الطراز على البيان الجمركي' },
              year: { type: Type.STRING, description: 'سنة الصنع المكونة من أربعة أرقام' },
              vin: { type: Type.STRING, description: 'رقم الهيكل أو الشاصي VIN بدقة كاملة' },
              engineNumber: { type: Type.STRING, description: 'رقم المحرك كما هو في المستند' },
              color: { type: Type.STRING, description: 'اللون الفعلي المكتوب في خانة اللون بالبيان الجمركي بالعربية' },
              cylinders: { type: Type.STRING, description: 'عدد الأسطوانات أو السعة اللترية' },
              fuelType: { type: Type.STRING, description: 'نوع الوقود المدون في المستند' },
            },
            required: [
              'declarationNumber',
              'declarationDate',
              'customsPort',
              'make',
              'model',
              'trim',
              'year',
              'vin',
              'engineNumber',
              'color',
              'cylinders',
              'fuelType',
            ],
          },
        },
      });

      const data = parseAiJson(response.text);
      res.json({ success: true, data });
    } catch (error: any) {
      handleAiRouteError(
        res,
        error,
        'تعذر تحليل صورة البيان الجمركي، يرجى التأكد من وضوح الصورة والمحاولة مجدداً.',
        'Customs extraction'
      );
    }
  });

  // Extract owner or witness identity card data (صورة البطاقة الشخصية)
  app.post('/api/extract/id-card', async (req, res) => {
    try {
      const { imageBase64, mimeType, role } = req.body ?? {};
      const parsed = parseBase64Payload(imageBase64, mimeType || 'image/jpeg');
      const ai = getAiClient();

      const roleLabel = role === 'witness' ? 'الشاهد أو المعرّف' : 'المالك';
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.data,
              },
            },
            {
              text:
                `اقرأ صورة بطاقة الهوية الخاصة بـ (${roleLabel}) بدقة متناهية حرفاً بحرف ورقماً برقم. ` +
                'استخرج فقط البيانات الظاهرة فعلياً في البطاقة: الاسم الكامل كما هو مدون، الرقم الوطني/رقم الهوية بدقة، نوع الهوية، فصيلة الدم إن ظهرت، تاريخ الميلاد، مكان الميلاد، جهة/مكان الإصدار، الجنسية، والعنوان المدون في البطاقة إن وجد. ' +
                'حافظ على الأرقام كما هي دون تغيير أو تخمين، وإذا لم يكن الحقل موجوداً أو واضحاً اتركه "".',
            },
          ],
        },
        config: {
          systemInstruction:
            'أنت نظام تدقيق بصرية (OCR) للبطاقات الشخصية والهويات الوطنية. انسخ الحروف والأرقام العربية واللاتينية كما هي ظاهرة في الصورة تماماً دون أي تخمين.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING, description: 'الاسم الكامل كما هو مدون في البطاقة' },
              nationalId: { type: Type.STRING, description: 'الرقم الوطني أو رقم البطاقة الشخصية بدقة' },
              idType: { type: Type.STRING, description: 'نوع الهوية الظاهر في المستند' },
              bloodType: { type: Type.STRING, description: 'فصيلة الدم إن وجدت في البطاقة' },
              birthDate: { type: Type.STRING, description: 'تاريخ الميلاد كما هو مدون' },
              birthPlace: { type: Type.STRING, description: 'مكان الميلاد كما هو مدون' },
              issuePlace: { type: Type.STRING, description: 'مكان أو جهة إصدار البطاقة' },
              nationality: { type: Type.STRING, description: 'الجنسية' },
              cardAddress: { type: Type.STRING, description: 'العنوان المذكور في البطاقة إن وجد' },
            },
            required: [
              'fullName',
              'nationalId',
              'idType',
              'bloodType',
              'birthDate',
              'birthPlace',
              'issuePlace',
              'nationality',
              'cardAddress',
            ],
          },
        },
      });

      const data = parseAiJson(response.text);
      res.json({ success: true, data });
    } catch (error: any) {
      handleAiRouteError(
        res,
        error,
        'تعذر استخراج بيانات البطاقة، يرجى التأكد من وضوح الصورة.',
        'ID card extraction'
      );
    }
  });

  // Extract license plate number and type from plate photo (صورة لوحة السيارة)
  app.post('/api/extract/plate', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body ?? {};
      const parsed = parseBase64Payload(imageBase64, mimeType || 'image/jpeg');
      const ai = getAiClient();

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.data,
              },
            },
            {
              text:
                'اقرأ رقم لوحة السيارة والمنطقة/المحافظة من الصورة بدقة تامة، وحدد لون وفئة اللوحة بدقة (private للخصوصي ذات اللون الأزرق/الأبيض، وtransport للنقل ذات اللون الأحمر، أو unknown إذا لم يظهر). ' +
                'إذا لم يظهر نص واضح اتركه فارغاً "".',
            },
          ],
        },
        config: {
          systemInstruction:
            'أنت نظام تدقيق بصرية (OCR) للوحات المركبات. استخرج الأرقام والحروف ولون فئة اللوحة بدقة تامة دون تخمين.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plateNumber: { type: Type.STRING, description: 'رقم وحروف لوحة السيارة بدقة' },
              plateRegion: { type: Type.STRING, description: 'المحافظة أو الرمز الموجود على اللوحة' },
              detectedCategory: {
                type: Type.STRING,
                description: 'private إذا كانت لوحة خصوصي، transport إذا كانت لوحة نقل حمراء، أو unknown',
              },
            },
            required: ['plateNumber', 'plateRegion', 'detectedCategory'],
          },
        },
      });

      const data = parseAiJson(response.text);
      res.json({ success: true, data });
    } catch (error: any) {
      handleAiRouteError(
        res,
        error,
        'تعذر قراءة رقم اللوحة من الصورة.',
        'Plate extraction'
      );
    }
  });

  const MIN_RETENTION_MS = 48 * 60 * 60 * 1000;
  const computeRetainUntil = (baseIso?: string) => {
    const baseMs = baseIso ? Date.parse(baseIso) : Date.now();
    const safeBase = Number.isNaN(baseMs) ? Date.now() : baseMs;
    return new Date(safeBase + MIN_RETENTION_MS).toISOString();
  };
  const withRetention = (rec: any) => ({
    ...rec,
    retainUntil: rec.retainUntil || computeRetainUntil(rec.updatedAt || rec.createdAt),
  });

  // List all saved vehicle registrations
  app.get('/api/registrations', (_req, res) => {
    const records = readRegistrations().map(withRetention);
    res.json({ success: true, records });
  });

  // Sync missing archived records from browser IndexedDB backup (preserves 48h+ retention across server restarts)
  app.post('/api/registrations/sync', (req, res) => {
    const incoming = Array.isArray(req.body?.records) ? req.body.records : [];
    const existing = readRegistrations().map(withRetention);
    const byId = new Map<string, any>();

    for (const rec of existing) {
      if (rec?.id) byId.set(rec.id, rec);
    }

    let addedOrUpdated = false;
    for (const rec of incoming) {
      if (!rec?.id || !rec?.plateNumber || !rec?.owner?.fullName) continue;
      const cur = byId.get(rec.id);
      if (!cur) {
        byId.set(rec.id, withRetention(rec));
        addedOrUpdated = true;
      } else {
        const curUpdated = Date.parse(cur.updatedAt || cur.createdAt || '') || 0;
        const incUpdated = Date.parse(rec.updatedAt || rec.createdAt || '') || 0;
        if (incUpdated > curUpdated) {
          byId.set(rec.id, withRetention({ ...cur, ...rec }));
          addedOrUpdated = true;
        }
      }
    }

    const merged = Array.from(byId.values()).sort(
      (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
    );
    if (addedOrUpdated) {
      writeRegistrations(merged);
    }
    res.json({ success: true, records: merged });
  });

  // Create & save a new registration (retained for at least 48 hours)
  app.post('/api/registrations', (req, res) => {
    const body = req.body ?? {};
    if (!body.plateNumber || !body.owner?.fullName) {
      res.status(400).json({
        success: false,
        error: 'يرجى إدخال رقم السيارة والاسم الكامل للمالك على الأقل قبل الحفظ.',
      });
      return;
    }

    const records = readRegistrations();
    const now = new Date().toISOString();
    const nextNum = records.length + 1;
    const yearStr = new Date().getFullYear();
    const serialNumber = `REG-${yearStr}-${String(nextNum).padStart(4, '0')}`;

    const newRecord = {
      ...body,
      id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      serialNumber,
      createdAt: now,
      updatedAt: now,
      retainUntil: computeRetainUntil(now),
    };

    const updated = [newRecord, ...records];
    writeRegistrations(updated);
    res.status(201).json({ success: true, record: newRecord });
  });

  // Update existing registration (extends retention to at least 48h from update)
  app.put('/api/registrations/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body ?? {};
    const records = readRegistrations();
    const idx = records.findIndex((r) => r.id === id);
    const now = new Date().toISOString();

    if (idx === -1) {
      if (body.plateNumber && body.owner?.fullName) {
        const restoredRecord = {
          ...body,
          id,
          serialNumber: body.serialNumber || `REG-${new Date().getFullYear()}-${String(records.length + 1).padStart(4, '0')}`,
          createdAt: body.createdAt || now,
          updatedAt: now,
          retainUntil: computeRetainUntil(now),
        };
        writeRegistrations([restoredRecord, ...records]);
        res.json({ success: true, record: restoredRecord });
        return;
      }
      res.status(404).json({ success: false, error: 'السجل غير موجود.' });
      return;
    }

    const existingRetainMs = Date.parse(records[idx].retainUntil || '') || 0;
    const nextRetainMs = Math.max(existingRetainMs, Date.parse(now) + MIN_RETENTION_MS);

    const updatedRecord = {
      ...records[idx],
      ...body,
      id: records[idx].id,
      serialNumber: records[idx].serialNumber,
      createdAt: records[idx].createdAt,
      updatedAt: now,
      retainUntil: new Date(nextRetainMs).toISOString(),
    };
    records[idx] = updatedRecord;
    writeRegistrations(records);
    res.json({ success: true, record: updatedRecord });
  });

  // Delete registration (enforces minimum 48-hour retention lock)
  app.delete('/api/registrations/:id', (req, res) => {
    const { id } = req.params;
    const records = readRegistrations();
    const target = records.find((r) => r.id === id);
    if (!target) {
      res.status(404).json({ success: false, error: 'السجل غير موجود.' });
      return;
    }

    const retainMs = target.retainUntil
      ? Date.parse(target.retainUntil)
      : (Date.parse(target.updatedAt || target.createdAt || '') || Date.now()) + MIN_RETENTION_MS;
    const remainingMs = retainMs - Date.now();
    if (remainingMs > 0) {
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      res.status(403).json({
        success: false,
        error: `لا يمكن حذف الاستمارة قبل مرور 48 ساعة على حفظها (متبقي حوالي ${remainingHours} ساعة).`,
      });
      return;
    }

    const filtered = records.filter((r) => r.id !== id);
    writeRegistrations(filtered);
    res.json({ success: true });
  });

  // Vite dev middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
