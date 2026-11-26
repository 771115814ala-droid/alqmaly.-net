import React, { useRef, useState } from 'react';
import {
  Camera,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import type { ImageFitMode } from '../types';
import { fileToCompressedDataUrl, rotateImageDataUrl } from '../utils/imageHelpers';

interface ImageUploadFieldProps {
  label: string;
  helperText?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  fitMode?: ImageFitMode;
  onFitModeChange?: (mode: ImageFitMode) => void;
  onAiExtract?: (dataUrl: string) => Promise<void>;
  aiButtonLabel?: string;
  aiLoading?: boolean;
  aiSuccessMessage?: string;
  aiError?: string;
  maxDimension?: number;
  aspectClass?: string;
  required?: boolean;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  helperText,
  value,
  onChange,
  fitMode,
  onFitModeChange,
  onAiExtract,
  aiButtonLabel = 'استخراج البيانات بالذكاء الاصطناعي',
  aiLoading = false,
  aiSuccessMessage,
  aiError,
  maxDimension = 1800,
  aspectClass = 'h-40',
  required = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localFit, setLocalFit] = useState<ImageFitMode>('contain');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [rotating, setRotating] = useState(false);

  const activeFit: ImageFitMode = fitMode ?? localFit;
  const isFill = activeFit === 'cover';

  const toggleFit = () => {
    const next: ImageFitMode = isFill ? 'contain' : 'cover';
    if (onFitModeChange) {
      onFitModeChange(next);
    } else {
      setLocalFit(next);
    }
  };

  const handleRotate = async (degrees: 90 | -90) => {
    if (!value || rotating) return;
    setRotating(true);
    setLocalError('');
    try {
      const rotated = await rotateImageDataUrl(value, degrees);
      onChange(rotated);
    } catch (err: any) {
      setLocalError(err?.message || 'تعذر تدوير الصورة.');
    } finally {
      setRotating(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setLocalError('يرجى اختيار ملف صورة صالح (JPG أو PNG).');
      return;
    }
    setLocalError('');
    try {
      const compressed = await fileToCompressedDataUrl(file, maxDimension, 0.92);
      onChange(compressed);
      if (onAiExtract) {
        await onAiExtract(compressed);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'تعذر معالجة الصورة.');
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-sm font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-600 mr-1">*</span>}
        </label>
        <div className="flex items-center gap-1.5">
          {value && (
            <>
              <button
                type="button"
                onClick={toggleFit}
                title={isFill ? 'عرض الصورة كاملة داخل الإطار' : 'توسيع الصورة لملء الإطار'}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isFill
                    ? 'bg-[#132654] text-white border-[#132654] hover:bg-[#0d1c40]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isFill ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                <span>{isFill ? 'احتواء كامل' : 'توسيع لملء الإطار'}</span>
              </button>

              <button
                type="button"
                disabled={rotating}
                onClick={() => handleRotate(90)}
                title="تدوير الصورة 90 درجة"
                aria-label={`تدوير ${label}`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
                <span>تدوير</span>
              </button>

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                title="معاينة الصورة بالحجم الكامل"
                className="p-1.5 rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {value && onAiExtract && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => onAiExtract(value)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{aiLoading ? 'جاري النسخ...' : aiButtonLabel}</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {!value ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`${aspectClass} flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-[#1D4ED8] bg-blue-50/70'
              : 'border-slate-300 bg-slate-50/60 hover:border-[#1D4ED8]/60 hover:bg-blue-50/30'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
            {onAiExtract ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-700">
              اضغط لاختيار صورة من المعرض أو اسحبها هنا
            </p>
            {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
          </div>
        </div>
      ) : (
        <div
          className={`relative ${aspectClass} rounded-lg border border-slate-200 bg-slate-100 overflow-hidden group`}
        >
          <img
            src={value}
            alt={label}
            referrerPolicy="no-referrer"
            className={`w-full h-full transition-all duration-200 ${
              isFill ? 'object-cover' : 'object-contain bg-slate-900/5'
            }`}
          />
          {aiLoading && (
            <div className="absolute inset-0 bg-slate-900/65 flex flex-col items-center justify-center gap-2 text-white px-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-medium">
                جاري قراءة ونسخ البيانات بالذكاء الاصطناعي...
              </span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <button
              type="button"
              disabled={rotating}
              onClick={() => handleRotate(-90)}
              aria-label="تدوير لليسار 90 درجة"
              title="تدوير لليسار 90°"
              className="p-1.5 rounded-md bg-white/95 text-slate-800 border border-slate-200 hover:bg-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={rotating}
              onClick={() => handleRotate(90)}
              aria-label="تدوير لليمين 90 درجة"
              title="تدوير لليمين 90°"
              className="p-1.5 rounded-md bg-white/95 text-slate-800 border border-slate-200 hover:bg-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleFit}
              aria-label={isFill ? 'احتواء كامل' : 'توسيع لملء الإطار'}
              title={isFill ? 'احتواء كامل' : 'توسيع لملء الإطار'}
              className={`p-1.5 rounded-md border shadow-sm transition-colors cursor-pointer ${
                isFill
                  ? 'bg-[#132654] text-white border-[#132654] hover:bg-[#0d1c40]'
                  : 'bg-white/95 text-slate-800 border-slate-200 hover:bg-white'
              }`}
            >
              {isFill ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/95 text-slate-800 border border-slate-200 hover:bg-white shadow-sm transition-colors cursor-pointer"
            >
              تغيير
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label={`حذف ${label}`}
              className="p-1.5 rounded-md bg-white/95 text-red-600 border border-slate-200 hover:bg-red-50 shadow-sm transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {aiSuccessMessage && !aiLoading && !aiError && (
        <p className="text-xs font-medium text-emerald-700">{aiSuccessMessage}</p>
      )}
      {(aiError || localError) && (
        <p className="text-xs font-medium text-red-600">{aiError || localError}</p>
      )}

      {/* Full-screen Lightbox Preview */}
      {lightboxOpen && value && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
              <span className="text-sm font-bold text-slate-900">{label}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={rotating}
                  onClick={() => handleRotate(-90)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تدوير يسار</span>
                </button>
                <button
                  type="button"
                  disabled={rotating}
                  onClick={() => handleRotate(90)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#132654] text-white hover:bg-[#0d1c40] disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>تدوير يمين</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="إغلاق المعاينة"
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-3 bg-slate-900/5 max-h-[80vh] flex items-center justify-center">
              <img
                src={value}
                alt={label}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
