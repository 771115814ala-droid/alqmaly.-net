import React, { useEffect, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Printer,
  RotateCw,
} from 'lucide-react';
import type { ImageFitMode, RegistrationRecord } from '../types';
import { downloadRegistrationImage, downloadRegistrationPdf } from '../utils/cardExporter';

interface RegistrationCardPreviewProps {
  record: Partial<RegistrationRecord>;
  isSaved?: boolean;
  hasUnsavedChanges?: boolean;
  onBeforeExport?: () => Promise<RegistrationRecord>;
  onTogglePlateFit?: () => void;
  onToggleOwnerFit?: () => void;
  onRotatePlate?: () => void;
  onRotateOwner?: () => void;
}

export const RegistrationCardPreview: React.FC<RegistrationCardPreviewProps> = ({
  record,
  isSaved = false,
  hasUnsavedChanges = false,
  onBeforeExport,
  onTogglePlateFit,
  onToggleOwnerFit,
  onRotatePlate,
  onRotateOwner,
}) => {
  const [exporting, setExporting] = useState<'pdf' | 'png' | 'print' | null>(null);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [localPlateFit, setLocalPlateFit] = useState<ImageFitMode>(
    record.plateImageFit || 'contain'
  );
  const [localOwnerFit, setLocalOwnerFit] = useState<ImageFitMode>(
    record.ownerPhotoFit || 'contain'
  );

  useEffect(() => {
    setLocalPlateFit(record.plateImageFit || 'contain');
  }, [record.plateImageFit, record.id]);

  useEffect(() => {
    setLocalOwnerFit(record.ownerPhotoFit || 'contain');
  }, [record.ownerPhotoFit, record.id]);

  useEffect(() => {
    setExportSuccess('');
    setExportError('');
  }, [record.id]);

  const effectivePlateFit: ImageFitMode = onTogglePlateFit
    ? record.plateImageFit || 'contain'
    : localPlateFit;
  const effectiveOwnerFit: ImageFitMode = onToggleOwnerFit
    ? record.ownerPhotoFit || 'contain'
    : localOwnerFit;

  const handleTogglePlateFit = () => {
    if (onTogglePlateFit) {
      onTogglePlateFit();
    } else {
      setLocalPlateFit((prev) => (prev === 'cover' ? 'contain' : 'cover'));
    }
  };

  const handleToggleOwnerFit = () => {
    if (onToggleOwnerFit) {
      onToggleOwnerFit();
    } else {
      setLocalOwnerFit((prev) => (prev === 'cover' ? 'contain' : 'cover'));
    }
  };

  const isTransport = record.category === 'transport';
  const categoryLabel = isTransport ? 'نقل' : 'خصوصي';
  const needsArchivalSave = !isSaved || hasUnsavedChanges;

  const resolveRecordForExport = async (): Promise<{
    payload: Partial<RegistrationRecord>;
    archivedSerial?: string;
  }> => {
    if (onBeforeExport) {
      const saved = await onBeforeExport();
      return {
        payload: {
          ...saved,
          plateImageFit: effectivePlateFit,
          ownerPhotoFit: effectiveOwnerFit,
        },
        archivedSerial: saved.serialNumber,
      };
    }
    return {
      payload: {
        ...record,
        plateImageFit: effectivePlateFit,
        ownerPhotoFit: effectiveOwnerFit,
      },
    };
  };

  const handleDownloadPdf = async () => {
    setExportError('');
    setExportSuccess('');
    setExporting('pdf');
    try {
      const { payload, archivedSerial } = await resolveRecordForExport();
      await downloadRegistrationPdf(payload);
      if (needsArchivalSave && archivedSerial) {
        setExportSuccess(`تم حفظ المعاملة في الأرشيف برقم ${archivedSerial} وتنزيل PDF.`);
      }
    } catch (err: any) {
      setExportError(err?.message || 'تعذر إنشاء ملف PDF، يرجى المحاولة مرة أخرى.');
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadImage = async () => {
    setExportError('');
    setExportSuccess('');
    setExporting('png');
    try {
      const { payload, archivedSerial } = await resolveRecordForExport();
      await downloadRegistrationImage(payload);
      if (needsArchivalSave && archivedSerial) {
        setExportSuccess(`تم حفظ المعاملة في الأرشيف برقم ${archivedSerial} وتنزيل الصورة.`);
      }
    } catch (err: any) {
      setExportError(err?.message || 'تعذر إنشاء الصورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = async () => {
    setExportError('');
    setExportSuccess('');
    setExporting('print');
    try {
      const { archivedSerial } = await resolveRecordForExport();
      if (needsArchivalSave && archivedSerial) {
        setExportSuccess(`تم حفظ المعاملة في الأرشيف برقم ${archivedSerial} قبل الطباعة.`);
        await new Promise((resolve) => setTimeout(resolve, 90));
      }
      window.print();
    } catch (err: any) {
      setExportError(err?.message || 'يرجى حفظ المعاملة في الأرشيف قبل الطباعة.');
    } finally {
      setExporting(null);
    }
  };

  const issueDate = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });

  const formattedIssueYmd = issueDate.split('/').reverse().join('/');
  const v = record.vehicle;
  const o = record.owner;
  const witnesses = record.witnesses || [];
  const vinUpper = (v?.vin || '').toUpperCase().replace(/\s+/g, '');
  const vinChars = Array.from({ length: 17 }, (_, i) => vinUpper[i] || '');
  const combinedPlate = [record.plateRegion, record.plateNumber]
    .filter(Boolean)
    .join(' - ');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            معاينة استمارة الفحص والترقيم (٤×٦)
          </h2>
          <p className="text-xs text-slate-500">
            {isTransport
              ? 'فئة نقل — تظهر اللوحة والحدود والشارات باللون الأحمر'
              : 'فئة خصوصي — لوحة زرقاء/بيضاء حسب النموذج المعتمد'}
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
            !isSaved
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : hasUnsavedChanges
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : isTransport
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {!isSaved
            ? 'معاينة حية (غير محفوظة)'
            : hasUnsavedChanges
            ? 'تعديلات غير محفوظة'
            : 'محفوظة في الأرشيف'}
        </span>
      </div>

      {/* Exact Form Template Layout (4x6 / 2:3 Portrait) */}
      <div
        id="printable-card-area"
        className={`relative w-full aspect-[2/3] bg-white rounded-2xl p-1 border-2 shadow-sm flex flex-col transition-colors ${
          isTransport ? 'border-red-600' : 'border-blue-600'
        }`}
      >
        <div
          className={`flex-1 rounded-xl p-1 border flex flex-col ${
            isTransport ? 'border-red-200' : 'border-blue-200'
          }`}
        >
          <div
            className={`flex-1 rounded-lg border-2 px-2.5 py-2 flex flex-col justify-between bg-white relative overflow-hidden ${
              isTransport ? 'border-red-900' : 'border-[#132654]'
            }`}
          >
            {/* Full-form Watermark */}
            <img
              src="/assets/aistudio/Screenshot_________________Google_44390101.jpg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-x-[2%] top-[7%] bottom-[4%] m-auto w-[96%] h-[89%] object-fill opacity-[0.16] contrast-110 mix-blend-multiply z-0"
            />

            {/* 1. Official Top Header */}
            <div className="space-y-1 relative z-10">
              <div className="grid grid-cols-12 items-center gap-1">
                {/* Right Official Text */}
                <div className="col-span-4 text-right text-[8px] sm:text-[9px] leading-snug text-[#132654] font-semibold">
                  <div className="font-bold">الجمهورية اليمنية</div>
                  <div>وزارة الداخلية</div>
                  <div>إدارة مرور محافظة تعز</div>
                  <div className="font-bold">لجنة ترقيم الجمارك</div>
                </div>

                {/* Center 3 Official Emblems */}
                <div className="col-span-4 flex items-center justify-center">
                  <img
                    src="/assets/emblems_strip.png"
                    alt="شعارات الجمهورية اليمنية ووزارة الداخلية والإدارة العامة للمرور"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-10 object-contain"
                  />
                </div>

                {/* Left Official Text */}
                <div className="col-span-4 text-left text-[8px] sm:text-[9px] leading-snug text-[#132654] font-semibold">
                  <div className="font-bold">وزارة الداخلية</div>
                  <div>إدارة مرور محافظة تعز</div>
                  <div className="font-bold">لجنة ترقيم الجمارك</div>
                  <div className="text-[6.5px] sm:text-[7.5px] text-slate-500 font-medium tracking-tight">
                    TAIZ TRAFFIC DEPARTMENT
                  </div>
                </div>
              </div>

              <div
                className={`text-center text-xs sm:text-sm font-extrabold tracking-tight ${
                  isTransport ? 'text-red-900' : 'text-[#132654]'
                }`}
              >
                استمارة الفحص والترقيم
              </div>

              {/* Sub-Header Band: Serial/Form No | Plate Box | Plate Photo */}
              <div className="grid grid-cols-12 gap-1.5 items-center pt-0.5">
                {/* Right: Serial & Form Number */}
                <div className="col-span-4 space-y-1 text-[8.5px] sm:text-[9.5px]">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 whitespace-nowrap">رقم تسلسلي :</span>
                    <span className="font-mono-num font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900 truncate">
                      {record.serialNumber || 'REG-DRAFT'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 whitespace-nowrap">رقم الاستمارة:</span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {record.formNumber || '---'}
                    </span>
                  </div>
                </div>

                {/* Center: 3-Compartment Plate Box + Issue/Expiry */}
                <div className="col-span-5 flex flex-col items-center">
                  <div
                    className={`w-full rounded-lg border-2 overflow-hidden grid grid-cols-12 items-stretch text-[9px] font-bold ${
                      isTransport
                        ? 'border-red-700 bg-red-600 text-white'
                        : 'border-[#132654] bg-white text-[#132654]'
                    }`}
                  >
                    <div
                      className={`col-span-4 flex items-center justify-center py-1 px-1 border-l ${
                        isTransport
                          ? 'bg-red-700 border-red-800 text-white'
                          : 'bg-slate-100 border-slate-300 text-[#132654]'
                      }`}
                    >
                      {categoryLabel}
                    </div>
                    <div className="col-span-5 flex items-center justify-center py-1 px-1 font-mono-num text-[10px] sm:text-[11px] font-extrabold truncate">
                      {combinedPlate || '---'}
                    </div>
                    <div
                      className={`col-span-3 flex flex-col items-center justify-center py-0.5 text-[6.5px] leading-tight text-white ${
                        isTransport ? 'bg-red-900' : 'bg-[#132654]'
                      }`}
                    >
                      <span>YEM</span>
                      <span>اليمن</span>
                    </div>
                  </div>
                  <div className="w-full flex items-center justify-between text-[7.5px] text-slate-600 mt-0.5 px-0.5">
                    <span>إصدار: {formattedIssueYmd}</span>
                    <span>انتهاء: {record.expiryDate || '---'}</span>
                  </div>
                </div>

                {/* Left: Plate Photo Thumbnail */}
                <div className="col-span-3 flex items-center justify-end">
                  <div
                    className={`relative w-full h-14 rounded-md border overflow-hidden flex items-center justify-center bg-slate-50 ${
                      isTransport ? 'border-red-300' : 'border-blue-300'
                    }`}
                  >
                    {record.plateImage && (
                      <div className="print:hidden absolute top-0.5 left-0.5 z-20 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={handleTogglePlateFit}
                          title={
                            effectivePlateFit === 'cover'
                              ? 'احتواء كامل داخل الإطار'
                              : 'توسيع الصورة لملء الإطار'
                          }
                          aria-label={
                            effectivePlateFit === 'cover'
                              ? 'احتواء كامل لصورة اللوحة'
                              : 'توسيع صورة اللوحة لملء الإطار'
                          }
                          className={`w-4 h-4 rounded border flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
                            effectivePlateFit === 'cover'
                              ? 'bg-[#132654] text-white border-[#132654]'
                              : 'bg-white/90 text-slate-700 border-slate-300 hover:bg-white'
                          }`}
                        >
                          {effectivePlateFit === 'cover' ? (
                            <Minimize2 className="w-2.5 h-2.5" />
                          ) : (
                            <Maximize2 className="w-2.5 h-2.5" />
                          )}
                        </button>
                        {onRotatePlate && (
                          <button
                            type="button"
                            onClick={onRotatePlate}
                            title="تدوير صورة اللوحة 90°"
                            aria-label="تدوير صورة اللوحة 90 درجة"
                            className="w-4 h-4 rounded border bg-white/90 text-slate-700 border-slate-300 hover:bg-white shadow-sm flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <RotateCw className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                    {record.plateImage ? (
                      <img
                        src={record.plateImage}
                        alt="صورة لوحة المركبة"
                        referrerPolicy="no-referrer"
                        className={`w-full h-full ${
                          effectivePlateFit === 'cover'
                            ? 'object-cover'
                            : 'object-contain bg-white'
                        }`}
                      />
                    ) : (
                      <span className="text-[7.5px] text-slate-400 text-center px-0.5">
                        صورة اللوحة
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Section 1: Owner Data */}
            <div className="space-y-0 relative z-10">
              <div
                className={`rounded-t-lg px-2.5 py-1 flex items-center justify-between text-white text-[9px] sm:text-[10px] font-bold ${
                  isTransport ? 'bg-red-800' : 'bg-[#132654]'
                }`}
              >
                <span>البيانات الشخصية والعنوان</span>
                <span>بيانات المالك</span>
              </div>
              <div
                className={`relative border border-t-0 rounded-b-lg p-2 overflow-hidden bg-white/55 ${
                  isTransport ? 'border-red-300' : 'border-blue-300'
                }`}
              >
                <div className="grid grid-cols-12 gap-2 items-stretch relative z-10">
                  <div className="col-span-9 space-y-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-1 text-[8.5px]">
                        <Row label="الاسم الرباعي:" value={o?.fullName} />
                        <Row label="تاريخ الميلاد:" value={o?.birthDate} mono />
                        <Row label="نوع الهوية:" value={o?.idType || 'بطاقة شخصية'} />
                        <Row label="مكان الإصدار:" value={o?.issuePlace} />
                      </div>
                      <div className="space-y-1 text-[8.5px]">
                        <Row label="رقم الهاتف:" value={o?.mobile} mono />
                        <Row label="فصيلة الدم:" value={o?.bloodType} mono />
                        <Row label="رقم الهوية:" value={o?.nationalId} mono />
                        <Row label="الجنسية:" value={o?.nationality || 'يمني'} />
                      </div>
                    </div>
                    <div className="pt-1 border-t border-slate-200/70 text-[8.5px]">
                      <Row
                        label="عنوان السكن الكامل:"
                        value={o?.currentResidence || o?.cardAddress}
                        wrap
                      />
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center justify-end relative z-10">
                    <div
                      className={`relative w-4/5 aspect-[3/4] rounded-md border overflow-hidden flex items-center justify-center ${
                        isTransport
                          ? 'bg-red-50/60 border-red-200'
                          : 'bg-blue-50/70 border-blue-200'
                      }`}
                    >
                      {record.ownerPhoto && (
                        <div className="print:hidden absolute top-1 left-1 z-20 flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={handleToggleOwnerFit}
                            title={
                              effectiveOwnerFit === 'cover'
                                ? 'احتواء كامل داخل الإطار'
                                : 'توسيع الصورة لملء الإطار'
                            }
                            aria-label={
                              effectiveOwnerFit === 'cover'
                                ? 'احتواء كامل لصورة المالك'
                                : 'توسيع صورة المالك لملء الإطار'
                            }
                            className={`w-4 h-4 rounded border flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
                              effectiveOwnerFit === 'cover'
                                ? 'bg-[#132654] text-white border-[#132654]'
                                : 'bg-white/90 text-slate-700 border-slate-300 hover:bg-white'
                            }`}
                          >
                            {effectiveOwnerFit === 'cover' ? (
                              <Minimize2 className="w-2.5 h-2.5" />
                            ) : (
                              <Maximize2 className="w-2.5 h-2.5" />
                            )}
                          </button>
                          {onRotateOwner && (
                            <button
                              type="button"
                              onClick={onRotateOwner}
                              title="تدوير صورة المالك 90°"
                              aria-label="تدوير صورة المالك 90 درجة"
                              className="w-4 h-4 rounded border bg-white/90 text-slate-700 border-slate-300 hover:bg-white shadow-sm flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <RotateCw className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                      {record.ownerPhoto ? (
                        <img
                          src={record.ownerPhoto}
                          alt="صورة 4x6"
                          referrerPolicy="no-referrer"
                          className={`w-full h-full ${
                            effectiveOwnerFit === 'cover'
                              ? 'object-cover'
                              : 'object-contain bg-white'
                          }`}
                        />
                      ) : (
                        <span className="text-[8px] font-semibold text-blue-900/60 text-center px-1">
                          صورة 4×6
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Section 2: Vehicle Technical Specs */}
            <div className="space-y-0 relative z-10">
              <div
                className={`rounded-t-lg px-2.5 py-1 flex items-center justify-between text-white text-[9px] sm:text-[10px] font-bold ${
                  isTransport ? 'bg-red-800' : 'bg-[#132654]'
                }`}
              >
                <span>البيانات الفنية للمركبة</span>
                <span>مواصفات المركبة المسجلة</span>
              </div>
              <div
                className={`relative border border-t-0 rounded-b-lg p-2 space-y-1.5 overflow-hidden bg-white/55 ${
                  isTransport ? 'border-red-300' : 'border-blue-300'
                }`}
              >
                {/* Top plate & type row */}
                <div className="grid grid-cols-12 gap-2 items-center text-[8.5px] relative z-10">
                  <div className="col-span-6 flex items-center gap-1.5">
                    <span className="text-slate-600 shrink-0">رقم اللوحة:</span>
                    <span
                      className={`px-2 py-0.5 rounded border font-mono-num font-bold text-[9px] ${
                        isTransport
                          ? 'bg-red-600 text-white border-red-800'
                          : 'bg-slate-50 text-[#132654] border-[#132654]/40'
                      }`}
                    >
                      {categoryLabel} | {combinedPlate || '---'}
                    </span>
                  </div>
                  <div className="col-span-6 flex items-center gap-1.5">
                    <span className="text-slate-600 shrink-0">نوع وفئة اللوحة:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-white font-bold text-[8px] ${
                        isTransport ? 'bg-red-700' : 'bg-[#132654]'
                      }`}
                    >
                      {categoryLabel}
                    </span>
                    <span className="text-[7.5px] text-slate-500 truncate">
                      {isTransport ? '(لوحة حمراء - نقل)' : '(لوحة زرقاء - خصوصي)'}
                    </span>
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-12 gap-2 text-[8.5px] relative z-10">
                  <div className="col-span-6 space-y-0.5">
                    <Row label="الماركة:" value={v?.make} />
                    <Row label="سنة الصنع:" value={v?.year} mono />
                    <Row label="الطراز:" value={v?.trim} mono />
                  </div>
                  <div className="col-span-6 space-y-0.5">
                    <Row label="نوع المركبة:" value={v?.model} />
                    <Row label="اللون:" value={v?.color} />
                  </div>
                </div>

                {/* 17-Box VIN Strip */}
                <div className="space-y-1 relative z-10">
                  <div className="flex items-center gap-2 text-[8.5px]">
                    <span className="text-slate-600 shrink-0">رقم القاعدة VIN:</span>
                    <span className="font-mono-num font-bold text-[#132654] tracking-wider">
                      {vinUpper || '-----------------'}
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    className="grid grid-cols-17 gap-0.5"
                  >
                    {vinChars.map((ch, idx) => (
                      <div
                        key={idx}
                        className={`h-4 sm:h-5 rounded-[2px] border flex items-center justify-center font-mono-num text-[7.5px] sm:text-[8.5px] font-bold bg-white/75 ${
                          isTransport
                            ? 'border-red-300 text-red-900'
                            : 'border-blue-300 text-[#132654]'
                        }`}
                      >
                        {ch}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Engine & Customs Specs */}
                <div className="grid grid-cols-12 gap-2 text-[8.5px] relative z-10">
                  <div className="col-span-6 space-y-0.5">
                    <Row label="رقم المحرك:" value={v?.engineNumber} mono />
                    <Row label="عدد الأسطوانات:" value={v?.cylinders} mono />
                    <Row label="جهة إصدار البيان:" value={v?.customsPort} />
                  </div>
                  <div className="col-span-6 space-y-0.5">
                    <Row label="نوع الوقود:" value={v?.fuelType} />
                    <Row label="رقم البيان الجمركي:" value={v?.declarationNumber} mono />
                    <Row label="تاريخ البيان الجمركي:" value={v?.declarationDate} mono />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Section 3: Guarantors / Witnesses */}
            <div className="space-y-0 relative z-10">
              <div
                className={`rounded-t-lg px-2.5 py-1 flex items-center justify-between text-white text-[9px] sm:text-[10px] font-bold ${
                  isTransport ? 'bg-red-800' : 'bg-[#132654]'
                }`}
              >
                <span>بيانات المعرفين (الضامنين والشهود)</span>
                <span>الضمانة القانونية</span>
              </div>
              <div
                className={`relative border border-t-0 rounded-b-lg p-1.5 grid grid-cols-2 gap-1.5 overflow-hidden bg-white/55 ${
                  isTransport ? 'border-red-300' : 'border-blue-300'
                }`}
              >
                {[0, 1].map((idx) => {
                  const w = witnesses[idx];
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border p-1.5 space-y-0.5 bg-white/58 text-[8px] ${
                        isTransport ? 'border-red-200' : 'border-blue-200'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-0.5 mb-0.5">
                        <span
                          className={`font-bold ${
                            isTransport ? 'text-red-800' : 'text-[#132654]'
                          }`}
                        >
                          {idx === 0 ? 'المعرف الأول' : 'المعرف الثاني'}
                        </span>
                        <span className="font-mono-num text-[7px] text-slate-400">
                          GUARANTOR-0{idx + 1}
                        </span>
                      </div>
                      <Row label="الاسم:" value={w?.fullName} />
                      <Row label="الرقم الوطني:" value={w?.nationalId} mono />
                      <Row label="نوع القرابة:" value={w?.relation} />
                      <Row label="رقم الهاتف:" value={w?.mobile} mono />
                      <Row label="عنوان السكن:" value={w?.currentResidence || w?.cardAddress} wrap />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Bottom Signatures & Official Stamp */}
            <div className="space-y-1 pt-0.5 relative z-10">
              <div className="grid grid-cols-12 gap-1.5 items-center">
                <div className="col-span-9 grid grid-cols-3 gap-1.5">
                  {['المختص الفني', 'رئيس القسم الفني', 'مدير الإصدار الآلي'].map((title) => (
                    <div
                      key={title}
                      className="rounded border border-slate-200 bg-slate-50/58 px-1.5 py-1.5 text-center space-y-2"
                    >
                      <div className="text-[8px] font-bold text-[#132654]">{title}</div>
                      <div className="text-[7px] text-slate-400 border-b border-dotted border-slate-300 pb-0.5">
                        التوقيع: ...................
                      </div>
                    </div>
                  ))}
                </div>

                <div className="col-span-3 flex flex-col items-center justify-center">
                  <img
                    src="/assets/committee_stamp.png"
                    alt="ختم لجنة الترقيم بالجمارك"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 object-contain"
                  />
                  <span className="text-[6.5px] font-bold text-[#132654] text-center leading-tight">
                    ختم لجنة الترقيم بالجمارك
                  </span>
                </div>
              </div>

              <div className="text-center text-[7.5px] font-semibold text-slate-600 border-t border-slate-200 pt-1">
                مصمم ومطور النظام المهندس / علاء القاضي
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Archive Save Notice before Export */}
      {needsArchivalSave && onBeforeExport && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900">
          يتم حفظ المعاملة في الأرشيف وتوثيق الرقم التسلسلي تلقائياً قبل تنزيل أو طباعة الاستمارة.
        </div>
      )}

      {/* Export Controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={exporting !== null}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
            isTransport
              ? 'bg-red-700 hover:bg-red-800'
              : 'bg-[#132654] hover:bg-[#0e1d42]'
          }`}
        >
          {exporting === 'pdf' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          <span>{needsArchivalSave && onBeforeExport ? 'حفظ وتنزيل PDF' : 'تنزيل PDF (٤×٦)'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadImage}
          disabled={exporting !== null}
          className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          {exporting === 'png' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          <span>{needsArchivalSave && onBeforeExport ? 'حفظ وتنزيل صورة' : 'تنزيل صورة (٤×٦)'}</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          disabled={exporting !== null}
          className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold rounded-lg bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          {exporting === 'print' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          <span>{needsArchivalSave && onBeforeExport ? 'حفظ وطباعة' : 'طباعة'}</span>
        </button>
      </div>

      {exportSuccess && (
        <p className="text-xs font-semibold text-emerald-700">{exportSuccess}</p>
      )}
      {exportError && (
        <p role="alert" className="text-xs font-semibold text-red-600">
          {exportError}
        </p>
      )}
    </div>
  );
};

function Row({
  label,
  value,
  mono = false,
  wrap = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className={`flex ${wrap ? 'items-start' : 'items-baseline'} gap-1 min-w-0`}>
      <span className="text-slate-500 shrink-0">{label}</span>
      <span
        className={`font-semibold text-slate-900 ${
          wrap ? 'whitespace-normal break-words leading-snug' : 'truncate'
        } ${mono ? 'font-mono-num' : ''}`}
      >
        {value || '---'}
      </span>
    </div>
  );
}
