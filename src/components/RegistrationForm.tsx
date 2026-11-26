import React, { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  createEmptyWitness,
  type ImageFitMode,
  type PersonInfo,
  type RegistrationRecord,
  type VehicleCategory,
  type VehicleInfo,
  type WitnessInfo,
} from '../types';
import { ImageUploadField } from './ImageUploadField';
import { LongPressInput } from './LongPressInput';

export interface RegistrationDraft {
  id?: string;
  serialNumber?: string;
  formNumber: string;
  expiryDate: string;
  createdAt?: string;
  category: VehicleCategory;
  plateNumber: string;
  plateRegion: string;
  plateImage: string;
  plateImageFit: ImageFitMode;
  ownerPhoto: string;
  ownerPhotoFit: ImageFitMode;
  customsImage: string;
  vehicle: VehicleInfo;
  owner: PersonInfo;
  witnesses: WitnessInfo[];
}

interface RegistrationFormProps {
  draft: RegistrationDraft;
  onChange: React.Dispatch<React.SetStateAction<RegistrationDraft>>;
  onSaveSuccess: (saved: RegistrationRecord, wasEdit: boolean) => void;
  onReset: () => void;
  onCancelEdit?: () => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  draft,
  onChange,
  onSaveSuccess,
  onReset,
  onCancelEdit,
}) => {
  const [customsAi, setCustomsAi] = useState({ loading: false, success: '', error: '' });
  const [ownerAi, setOwnerAi] = useState({ loading: false, success: '', error: '' });
  const [plateAi, setPlateAi] = useState({ loading: false, success: '', error: '' });
  const [witnessAi, setWitnessAi] = useState<
    Record<string, { loading: boolean; success: string; error: string }>
  >({});

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isTransport = draft.category === 'transport';

  const extractCustoms = async (imageBase64: string) => {
    setCustomsAi({ loading: true, success: '', error: '' });
    try {
      const res = await fetch('/api/extract/customs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'تعذر نسخ بيانات البيان الجمركي.');
      }
      const d = json.data || {};
      onChange((prev) => ({
        ...prev,
        vehicle: {
          declarationNumber: d.declarationNumber || prev.vehicle.declarationNumber,
          declarationDate: d.declarationDate || prev.vehicle.declarationDate,
          customsPort: d.customsPort || prev.vehicle.customsPort,
          make: d.make || prev.vehicle.make,
          model: d.model || prev.vehicle.model,
          bodyStyle: d.bodyStyle || prev.vehicle.bodyStyle,
          trim: d.trim || prev.vehicle.trim,
          year: d.year || prev.vehicle.year,
          vin: d.vin || prev.vehicle.vin,
          engineNumber: d.engineNumber || prev.vehicle.engineNumber,
          color: d.color || prev.vehicle.color,
          cylinders: d.cylinders || prev.vehicle.cylinders,
          fuelType: d.fuelType || prev.vehicle.fuelType,
        },
      }));
      setCustomsAi({
        loading: false,
        success: 'تم نسخ بيانات المركبة من البيان الجمركي بنجاح. يرجى مراجعة الحقول.',
        error: '',
      });
    } catch (err: any) {
      setCustomsAi({
        loading: false,
        success: '',
        error: err?.message || 'حدث خطأ أثناء قراءة البيان الجمركي.',
      });
    }
  };

  const extractOwnerId = async (imageBase64: string) => {
    setOwnerAi({ loading: true, success: '', error: '' });
    try {
      const res = await fetch('/api/extract/id-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', role: 'owner' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'تعذر قراءة بطاقة المالك.');
      }
      const d = json.data || {};
      onChange((prev) => ({
        ...prev,
        owner: {
          ...prev.owner,
          fullName: d.fullName || prev.owner.fullName,
          nationalId: d.nationalId || prev.owner.nationalId,
          idType: d.idType || prev.owner.idType,
          bloodType: d.bloodType || prev.owner.bloodType,
          birthDate: d.birthDate || prev.owner.birthDate,
          birthPlace: d.birthPlace || prev.owner.birthPlace,
          issuePlace: d.issuePlace || prev.owner.issuePlace,
          nationality: d.nationality || prev.owner.nationality,
          cardAddress: d.cardAddress || prev.owner.cardAddress,
        },
      }));
      setOwnerAi({
        loading: false,
        success: 'تم نسخ بيانات البطاقة بنجاح. يرجى إدخال رقم الجوال والسكن الحالي يدوياً.',
        error: '',
      });
    } catch (err: any) {
      setOwnerAi({
        loading: false,
        success: '',
        error: err?.message || 'حدث خطأ أثناء قراءة بطاقة المالك.',
      });
    }
  };

  const extractWitnessId = async (witnessId: string, imageBase64: string) => {
    setWitnessAi((prev) => ({
      ...prev,
      [witnessId]: { loading: true, success: '', error: '' },
    }));
    try {
      const res = await fetch('/api/extract/id-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', role: 'witness' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'تعذر قراءة بطاقة الشاهد.');
      }
      const d = json.data || {};
      onChange((prev) => ({
        ...prev,
        witnesses: prev.witnesses.map((w) =>
          w.id === witnessId
            ? {
                ...w,
                fullName: d.fullName || w.fullName,
                nationalId: d.nationalId || w.nationalId,
                birthDate: d.birthDate || w.birthDate,
                birthPlace: d.birthPlace || w.birthPlace,
                issuePlace: d.issuePlace || w.issuePlace,
                nationality: d.nationality || w.nationality,
                cardAddress: d.cardAddress || w.cardAddress,
              }
            : w
        ),
      }));
      setWitnessAi((prev) => ({
        ...prev,
        [witnessId]: {
          loading: false,
          success: 'تم نسخ بيانات البطاقة. أضف رقم الجوال والسكن الحالي يدوياً.',
          error: '',
        },
      }));
    } catch (err: any) {
      setWitnessAi((prev) => ({
        ...prev,
        [witnessId]: {
          loading: false,
          success: '',
          error: err?.message || 'تعذر قراءة بطاقة الشاهد.',
        },
      }));
    }
  };

  const extractPlate = async (imageBase64: string) => {
    setPlateAi({ loading: true, success: '', error: '' });
    try {
      const res = await fetch('/api/extract/plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'تعذر قراءة رقم اللوحة.');
      }
      const d = json.data || {};
      onChange((prev) => ({
        ...prev,
        plateNumber: d.plateNumber || prev.plateNumber,
        plateRegion: d.plateRegion || prev.plateRegion,
        category:
          d.detectedCategory === 'transport' || d.detectedCategory === 'private'
            ? d.detectedCategory
            : prev.category,
      }));
      setPlateAi({
        loading: false,
        success: 'تمت قراءة رقم اللوحة من الصورة.',
        error: '',
      });
    } catch (err: any) {
      setPlateAi({
        loading: false,
        success: '',
        error: err?.message || 'تعذر قراءة اللوحة.',
      });
    }
  };

  const updateVehicle = (field: keyof VehicleInfo, val: string) => {
    onChange((prev) => ({
      ...prev,
      vehicle: { ...prev.vehicle, [field]: val },
    }));
  };

  const updateOwner = (field: keyof PersonInfo, val: string) => {
    onChange((prev) => ({
      ...prev,
      owner: { ...prev.owner, [field]: val },
    }));
  };

  const updateWitness = (id: string, field: keyof WitnessInfo, val: string) => {
    onChange((prev) => ({
      ...prev,
      witnesses: prev.witnesses.map((w) => (w.id === id ? { ...w, [field]: val } : w)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!draft.plateNumber.trim()) {
      setFormError('يرجى إدخال رقم السيارة (اللوحة).');
      return;
    }
    if (!draft.owner.fullName.trim()) {
      setFormError('يرجى إدخال الاسم الكامل للمالك أو نسخه من صورة البطاقة.');
      return;
    }
    if (!draft.owner.mobile.trim()) {
      setFormError('يرجى إدخال رقم جوال المالك يدوياً.');
      return;
    }
    if (!draft.owner.currentResidence.trim()) {
      setFormError('يرجى إدخال السكن الحالي للمالك يدوياً.');
      return;
    }

    setSaving(true);
    try {
      const isEditing = Boolean(draft.id);
      const endpoint = isEditing ? `/api/registrations/${draft.id}` : '/api/registrations';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'تعذر حفظ بيانات الترقيم.');
      }
      onSaveSuccess(json.record, isEditing);
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء حفظ البيانات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {draft.id && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-amber-950">
              تعديل استمارة مؤرشفة — الرقم التسلسلي:{' '}
              <span className="font-mono-num">{draft.serialNumber}</span>
            </div>
            <p className="text-xs text-amber-800">
              يمكنك تعديل أي بيانات أو صور أو نوع اللوحة، ثم الضغط على «حفظ التعديلات» لتحديث الاستمارة في الأرشيف.
            </p>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              إلغاء والعودة للأرشيف
            </button>
          )}
        </div>
      )}

      {/* Section 1: Category, Plate Number, Plate Photo, Owner Photo */}
      <section className="bg-white border border-blue-200/80 rounded-xl overflow-hidden">
        <div className="bg-[#132654] text-white px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              1. نوع الترقيم ولوحة المركبة وصورة المالك
            </h2>
            <p className="text-xs text-blue-100/85 mt-0.5">
              اختر فئة المركبة (خصوصي أو نقل باللون الأحمر)، وأدخل رقم اللوحة مع إرفاق الصور المطلوبة.
            </p>
          </div>
          {draft.id && (
            <span className="text-xs font-semibold text-[#132654] bg-amber-300 px-2.5 py-1 rounded-md">
              وضع تعديل السجل: {draft.serialNumber}
            </span>
          )}
        </div>
        <div className="p-5 sm:p-6 space-y-6">

        {/* Category Segmented Switch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">
              نوع المركبة / الترقيم <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, category: 'private' }))}
                className={`py-2.5 px-3 rounded-md text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  !isTransport
                    ? 'bg-[#132654] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                خصوصي (أزرق)
              </button>
              <button
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, category: 'transport' }))}
                className={`py-2.5 px-3 rounded-md text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  isTransport
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                نقل (باللون الأحمر)
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {isTransport
                ? 'سيتم تلوين رقم اللوحة والاستمارة 4×6 باللون الأحمر تلقائياً.'
                : 'ستصدر الاستمارة 4×6 بتصميم الخصوصي الرسمي.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="plateNumber" className="block text-sm font-semibold text-slate-800">
                رقم السيارة / اللوحة <span className="text-red-600">*</span>
              </label>
              <LongPressInput
                id="plateNumber"
                value={draft.plateNumber}
                onValueChange={(val) =>
                  onChange((prev) => ({ ...prev, plateNumber: val }))
                }
                placeholder="مثال: 12345 / أ"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-bold font-mono-num focus:outline-none focus:ring-2 transition-colors ${
                  isTransport
                    ? 'border-red-300 bg-red-50/40 text-red-700 focus:ring-red-600/25 focus:border-red-600'
                    : 'border-slate-300 bg-white text-slate-900 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="plateRegion" className="block text-sm font-semibold text-slate-800">
                رمز اللوحة / المحافظة
              </label>
              <LongPressInput
                id="plateRegion"
                value={draft.plateRegion}
                onValueChange={(val) =>
                  onChange((prev) => ({ ...prev, plateRegion: val }))
                }
                placeholder="مثال: 4 / تعز"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="formNumber" className="block text-sm font-semibold text-slate-800">
                رقم الاستمارة
              </label>
              <LongPressInput
                id="formNumber"
                value={draft.formNumber}
                onValueChange={(val) =>
                  onChange((prev) => ({ ...prev, formNumber: val }))
                }
                placeholder="مثال: C2006"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="expiryDate" className="block text-sm font-semibold text-slate-800">
                تاريخ الانتهاء (اختياري)
              </label>
              <LongPressInput
                id="expiryDate"
                value={draft.expiryDate}
                onValueChange={(val) =>
                  onChange((prev) => ({ ...prev, expiryDate: val }))
                }
                placeholder="---"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
            </div>
          </div>
        </div>

        {/* Plate Photo + Owner Personal Photo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          <ImageUploadField
            label="صورة لوحة السيارة"
            helperText="ارفع صورة اللوحة ليتم قراءة الرقم تلقائياً وتوثيقها في الاستمارة"
            value={draft.plateImage}
            onChange={(val) => onChange((prev) => ({ ...prev, plateImage: val }))}
            fitMode={draft.plateImageFit}
            onFitModeChange={(mode) =>
              onChange((prev) => ({ ...prev, plateImageFit: mode }))
            }
            onAiExtract={extractPlate}
            aiButtonLabel="قراءة اللوحة بالذكاء"
            aiLoading={plateAi.loading}
            aiSuccessMessage={plateAi.success}
            aiError={plateAi.error}
            maxDimension={1400}
          />

          <ImageUploadField
            label="صورة المالك الشخصية"
            helperText="تُدرج مباشرة داخل استمارة الترقيم 4×6"
            value={draft.ownerPhoto}
            onChange={(val) => onChange((prev) => ({ ...prev, ownerPhoto: val }))}
            fitMode={draft.ownerPhotoFit}
            onFitModeChange={(mode) =>
              onChange((prev) => ({ ...prev, ownerPhotoFit: mode }))
            }
            maxDimension={700}
          />
        </div>
        </div>
      </section>

      {/* Section 2: Vehicle Data from Customs Declaration */}
      <section className="bg-white border border-blue-200/80 rounded-xl overflow-hidden">
        <div className="bg-[#132654] text-white px-5 sm:px-6 py-3.5">
          <h2 className="text-base sm:text-lg font-bold">
            2. بيانات المركبة والبيان الجمركي
          </h2>
          <p className="text-xs text-blue-100/85 mt-0.5">
            ارفع صورة البيان الجمركي ليقوم المساعد الذكي بنسخ بيانات المركبة تلقائياً مع إمكانية التعديل.
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-6">

        <ImageUploadField
          label="صورة البيان الجمركي"
          helperText="يدعم الصور الواضحة للبيان الجمركي (يستخرج الماركة، الموديل، رقم الشاصي، المحرك، رقم البيان)"
          value={draft.customsImage}
          onChange={(val) => onChange((prev) => ({ ...prev, customsImage: val }))}
          onAiExtract={extractCustoms}
          aiButtonLabel="نسخ بيانات المركبة بالذكاء"
          aiLoading={customsAi.loading}
          aiSuccessMessage={customsAi.success}
          aiError={customsAi.error}
          maxDimension={2200}
          aspectClass="h-44"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label="رقم البيان الجمركي"
            value={draft.vehicle.declarationNumber}
            onChange={(v) => updateVehicle('declarationNumber', v)}
            placeholder="مثال: 408219"
            mono
          />
          <InputField
            label="تاريخ البيان الجمركي"
            value={draft.vehicle.declarationDate}
            onChange={(v) => updateVehicle('declarationDate', v)}
            placeholder="YYYY-MM-DD"
            mono
          />
          <InputField
            label="المنفذ الجمركي"
            value={draft.vehicle.customsPort}
            onChange={(v) => updateVehicle('customsPort', v)}
            placeholder="مثال: جمرك شحن / الوديعة"
          />
          <InputField
            label="الطراز (رقم على البيان الجمركي)"
            value={draft.vehicle.trim}
            onChange={(v) => updateVehicle('trim', v)}
            placeholder="رقم الطراز المدون على البيان"
            mono
          />
          <InputField
            label="الماركة"
            value={draft.vehicle.make}
            onChange={(v) => updateVehicle('make', v)}
            placeholder="مثال: هيونداي / تويوتا"
          />
          <InputField
            label="نوع المركبة"
            value={draft.vehicle.model}
            onChange={(v) => updateVehicle('model', v)}
            placeholder="مثال: ايلانتر / هايلوكس"
          />
          <InputField
            label="سنة الصنع"
            value={draft.vehicle.year}
            onChange={(v) => updateVehicle('year', v)}
            placeholder="2024"
            mono
          />
          <InputField
            label="رقم الهيكل / الشاصي (VIN)"
            value={draft.vehicle.vin}
            onChange={(v) => updateVehicle('vin', v)}
            placeholder="17 خانة"
            mono
          />
          <InputField
            label="رقم المحرك"
            value={draft.vehicle.engineNumber}
            onChange={(v) => updateVehicle('engineNumber', v)}
            placeholder="رقم المحرك"
            mono
          />
          <InputField
            label="اللون"
            value={draft.vehicle.color}
            onChange={(v) => updateVehicle('color', v)}
            placeholder="مثال: أبيض لؤلؤي"
          />
          <InputField
            label="عدد الأسطوانات / السعة"
            value={draft.vehicle.cylinders}
            onChange={(v) => updateVehicle('cylinders', v)}
            placeholder="مثال: 4 سلندر / 2700cc"
          />
          <InputField
            label="نوع الوقود"
            value={draft.vehicle.fuelType}
            onChange={(v) => updateVehicle('fuelType', v)}
            placeholder="بنزين / ديزل"
          />
        </div>
        </div>
      </section>

      {/* Section 3: Owner Data from ID Card + Manual Mobile & Current Residence */}
      <section className="bg-white border border-blue-200/80 rounded-xl overflow-hidden">
        <div className="bg-[#132654] text-white px-5 sm:px-6 py-3.5">
          <h2 className="text-base sm:text-lg font-bold">
            3. بيانات المالك (من صورة البطاقة + الإدخال اليدوي)
          </h2>
          <p className="text-xs text-blue-100/85 mt-0.5">
            تُنسخ بيانات الهوية من صورة بطاقة المالك بالذكاء الاصطناعي، بينما يتم إدخال رقم الجوال والسكن الحالي يدوياً.
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-6">

        <ImageUploadField
          label="صورة بطاقة المالك الشخصية"
          helperText="يرفع صورة البطاقة لاستخراج الاسم والرقم الوطني وتاريخ ومكان الميلاد والإصدار"
          value={draft.owner.idCardImage}
          onChange={(val) => updateOwner('idCardImage', val)}
          onAiExtract={extractOwnerId}
          aiButtonLabel="نسخ بيانات المالك بالذكاء"
          aiLoading={ownerAi.loading}
          aiSuccessMessage={ownerAi.success}
          aiError={ownerAi.error}
          aspectClass="h-44"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label="الاسم الكامل للمالك"
            required
            value={draft.owner.fullName}
            onChange={(v) => updateOwner('fullName', v)}
            placeholder="الاسم الرباعي كما في البطاقة"
          />
          <InputField
            label="رقم الهوية / الرقم الوطني"
            value={draft.owner.nationalId}
            onChange={(v) => updateOwner('nationalId', v)}
            placeholder="رقم البطاقة"
            mono
          />
          <InputField
            label="تاريخ الميلاد"
            value={draft.owner.birthDate}
            onChange={(v) => updateOwner('birthDate', v)}
            placeholder="YYYY-MM-DD"
            mono
          />
          <InputField
            label="نوع الهوية"
            value={draft.owner.idType}
            onChange={(v) => updateOwner('idType', v)}
            placeholder="بطاقة شخصية / جواز سفر"
          />
          <InputField
            label="فصيلة الدم"
            value={draft.owner.bloodType}
            onChange={(v) => updateOwner('bloodType', v)}
            placeholder="مثال: +A"
            mono
          />
          <InputField
            label="جهة / مكان الإصدار"
            value={draft.owner.issuePlace}
            onChange={(v) => updateOwner('issuePlace', v)}
            placeholder="مكان إصدار البطاقة"
          />
        </div>

        {/* Manual Fields Highlighted */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="text-xs font-bold text-slate-700">
            حقول الإدخال اليدوي الإلزامية (غير مستخرجة من البطاقة):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="رقم الجوال (إدخال يدوي)"
              required
              value={draft.owner.mobile}
              onChange={(v) => updateOwner('mobile', v)}
              placeholder="مثال: 77XXXXXXX"
              mono
              highlightManual
            />
            <InputField
              label="السكن الحالي (إدخال يدوي)"
              required
              value={draft.owner.currentResidence}
              onChange={(v) => updateOwner('currentResidence', v)}
              placeholder="المدينة / الحي / أقرب معلم"
              highlightManual
            />
          </div>
        </div>
        </div>
      </section>

      {/* Section 4: Witnesses / Identifiers (Same workflow as Owner) */}
      <section className="bg-white border border-blue-200/80 rounded-xl overflow-hidden">
        <div className="bg-[#132654] text-white px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              4. بيانات الشهود أو المعرّفين
            </h2>
            <p className="text-xs text-blue-100/85 mt-0.5">
              نفس آلية بيانات المالك: نسخ بيانات البطاقة بالذكاء الاصطناعي وإضافة رقم الجوال والسكن الحالي يدوياً.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                witnesses: [...prev.witnesses, createEmptyWitness(prev.witnesses.length)],
              }))
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-amber-400 text-[#132654] hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة شاهد / معرّف</span>
          </button>
        </div>
        <div className="p-5 sm:p-6 space-y-6">

        <div className="space-y-8 divide-y divide-slate-200">
          {draft.witnesses.map((w, idx) => {
            const wAi = witnessAi[w.id] || { loading: false, success: '', error: '' };
            return (
              <div key={w.id} className={idx > 0 ? 'pt-7 space-y-5' : 'space-y-5'}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    الشاهد / المعرّف {idx === 0 ? 'الأول' : idx === 1 ? 'الثاني' : `#${idx + 1}`}
                  </h3>
                  {draft.witnesses.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange((prev) => ({
                          ...prev,
                          witnesses: prev.witnesses.filter((item) => item.id !== w.id),
                        }))
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة</span>
                    </button>
                  )}
                </div>

                <ImageUploadField
                  label={`صورة بطاقة الشاهد ${idx === 0 ? 'الأول' : idx === 1 ? 'الثاني' : idx + 1}`}
                  helperText="يتم نسخ الاسم والهوية وبيانات البطاقة تلقائياً"
                  value={w.idCardImage}
                  onChange={(val) => updateWitness(w.id, 'idCardImage', val)}
                  onAiExtract={(img) => extractWitnessId(w.id, img)}
                  aiButtonLabel="نسخ بيانات الشاهد بالذكاء"
                  aiLoading={wAi.loading}
                  aiSuccessMessage={wAi.success}
                  aiError={wAi.error}
                  aspectClass="h-36"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InputField
                    label="الاسم الكامل للشاهد / المعرّف"
                    value={w.fullName}
                    onChange={(v) => updateWitness(w.id, 'fullName', v)}
                    placeholder="الاسم الكامل"
                  />
                  <InputField
                    label="رقم الهوية / البطاقة"
                    value={w.nationalId}
                    onChange={(v) => updateWitness(w.id, 'nationalId', v)}
                    placeholder="رقم البطاقة"
                    mono
                  />
                  <InputField
                    label="جهة الإصدار / الميلاد"
                    value={w.issuePlace}
                    onChange={(v) => updateWitness(w.id, 'issuePlace', v)}
                    placeholder="جهة الإصدار"
                  />
                  <InputField
                    label="رقم الجوال (إدخال يدوي)"
                    value={w.mobile}
                    onChange={(v) => updateWitness(w.id, 'mobile', v)}
                    placeholder="رقم جوال الشاهد"
                    mono
                    highlightManual
                  />
                  <InputField
                    label="السكن الحالي (إدخال يدوي)"
                    value={w.currentResidence}
                    onChange={(v) => updateWitness(w.id, 'currentResidence', v)}
                    placeholder="عنوان السكن الحالي"
                    highlightManual
                  />
                  <InputField
                    label="صفة المعرفة / القرابة"
                    value={w.relation}
                    onChange={(v) => updateWitness(w.id, 'relation', v)}
                    placeholder="شاهد / معرّف"
                  />
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </section>

      {formError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-700"
        >
          {formError}
        </div>
      )}

      {/* Submit Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-blue-200/80 rounded-xl p-4 sm:p-5">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4" />
          <span>إفراغ الحقول</span>
        </button>

        <button
          type="submit"
          disabled={saving}
          className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
            isTransport
              ? 'bg-red-700 hover:bg-red-800'
              : 'bg-[#132654] hover:bg-[#0d1c40]'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : draft.id ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>
            {saving
              ? 'جاري الحفظ...'
              : draft.id
              ? 'حفظ التعديلات وإصدار الاستمارة 4×6'
              : 'حفظ البيانات وإصدار الاستمارة 4×6'}
          </span>
        </button>
      </div>
    </form>
  );
};

function InputField({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  required = false,
  highlightManual = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  mono?: boolean;
  required?: boolean;
  highlightManual?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-600 mr-1">*</span>}
      </label>
      <LongPressInput
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-900 focus:outline-none focus:ring-2 transition-colors ${
          mono ? 'font-mono-num' : ''
        } ${
          highlightManual
            ? 'border-amber-300 bg-amber-50/40 focus:ring-amber-500/20 focus:border-amber-500'
            : 'border-slate-300 bg-white focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]'
        }`}
      />
    </div>
  );
}
