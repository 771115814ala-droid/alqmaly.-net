import React, { useMemo, useState } from 'react';
import {
  Edit3,
  Eye,
  FileText,
  Image as ImageIcon,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { RegistrationRecord, VehicleCategory } from '../types';
import { downloadRegistrationImage, downloadRegistrationPdf } from '../utils/cardExporter';
import {
  formatRemainingRetention,
  getRemainingRetentionMs,
} from '../utils/archiveStorage';
import { LongPressInput } from './LongPressInput';

interface RegistrationsArchiveProps {
  records: RegistrationRecord[];
  loading: boolean;
  onCreateNew: () => void;
  onViewCard: (record: RegistrationRecord) => void;
  onEdit: (record: RegistrationRecord) => void;
  onDelete: (id: string) => Promise<void>;
}

export const RegistrationsArchive: React.FC<RegistrationsArchiveProps> = ({
  records,
  loading,
  onCreateNew,
  onViewCard,
  onEdit,
  onDelete,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | VehicleCategory>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        r.serialNumber,
        r.plateNumber,
        r.plateRegion,
        r.owner?.fullName,
        r.owner?.nationalId,
        r.owner?.mobile,
        r.vehicle?.make,
        r.vehicle?.model,
        r.vehicle?.color,
        r.vehicle?.vin,
        r.vehicle?.declarationNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [records, query, categoryFilter]);

  const counts = useMemo(() => {
    const transport = records.filter((r) => r.category === 'transport').length;
    const priv = records.length - transport;
    return { total: records.length, priv, transport };
  }, [records]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setDeleteNotice('');
    try {
      await onDelete(id);
    } catch (err: any) {
      setDeleteNotice(
        err?.message || 'يتم الاحتفاظ بالاستمارة لمدة 48 ساعة على الأقل ولا يمكن حذفها قبل ذلك.'
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-blue-200/80 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">إجمالي المركبات المسجلة</div>
          <div className="text-2xl font-bold font-mono-num text-[#132654] mt-1">
            {counts.total}
          </div>
        </div>
        <div className="bg-white border border-blue-200/80 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">مركبات خصوصي</div>
          <div className="text-2xl font-bold font-mono-num text-[#1D4ED8] mt-1">
            {counts.priv}
          </div>
        </div>
        <div className="bg-white border border-red-200/80 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">مركبات نقل (أحمر)</div>
          <div className="text-2xl font-bold font-mono-num text-red-600 mt-1">
            {counts.transport}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-blue-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none" />
          <LongPressInput
            value={query}
            onValueChange={setQuery}
            placeholder="بحث برقم اللوحة، اسم المالك، رقم الشاصي، أو البيان الجمركي..."
            className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('private')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'private'
                ? 'bg-[#132654] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            خصوصي ({counts.priv})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('transport')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'transport'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            نقل ({counts.transport})
          </button>
        </div>
      </div>

      {deleteNotice && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-xs sm:text-sm font-semibold text-amber-950 flex items-center justify-between gap-3"
        >
          <span>{deleteNotice}</span>
          <button
            type="button"
            onClick={() => setDeleteNotice('')}
            className="text-xs font-bold text-amber-900 hover:underline cursor-pointer shrink-0"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Empty State or Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-blue-200/80 rounded-xl p-10 text-center space-y-3">
          <p className="text-base font-bold text-slate-900">
            {records.length === 0
              ? 'لا توجد مركبات مسجلة حتى الآن'
              : 'لم يتم العثور على نتائج مطابقة لبحثك'}
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {records.length === 0
              ? 'ابدأ بتعبئة بيانات الترقيم ورفع صورة البيان الجمركي وبطاقة المالك لإصدار أول استمارة 4×6.'
              : 'جرّب البحث برقم لوحة أو اسم مالك آخر أو قم بتغيير التصفية.'}
          </p>
          {records.length === 0 && (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#132654] hover:bg-[#0d1c40] rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل أول مركبة</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-blue-200/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#132654] text-xs font-semibold text-white">
                  <th className="py-3 px-4">الرقم التسلسلي</th>
                  <th className="py-3 px-4">اللوحة والتصنيف</th>
                  <th className="py-3 px-4">المالك</th>
                  <th className="py-3 px-4">المركبة والبيان</th>
                  <th className="py-3 px-4">الجوال والسكن</th>
                  <th className="py-3 px-4 text-left">استمارة 4×6 والإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((r) => {
                  const isTransport = r.category === 'transport';
                  const isProtected = getRemainingRetentionMs(r) > 0;
                  const remainingText = isProtected ? formatRemainingRetention(r) : '';
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono-num text-xs font-semibold text-slate-700 whitespace-nowrap">
                        <div>{r.serialNumber}</div>
                        <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString('ar-YE-u-nu-latn')}
                        </div>
                        {isProtected && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 mt-1">
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            <span>حفظ 48س (متبقي {remainingText})</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border font-mono-num font-bold text-sm ${
                            isTransport
                              ? 'bg-red-600 text-white border-red-800'
                              : 'bg-white text-[#132654] border-[#132654]/40'
                          }`}
                        >
                          <span>{r.plateNumber}</span>
                        </div>
                        <div className="text-xs mt-1 font-semibold">
                          <span className={isTransport ? 'text-red-700' : 'text-[#132654]'}>
                            {isTransport ? 'نقل (أحمر)' : 'خصوصي'}
                          </span>
                          {r.plateRegion ? ` · ${r.plateRegion}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {r.ownerPhoto ? (
                            <img
                              src={r.ownerPhoto}
                              alt={r.owner?.fullName}
                              referrerPolicy="no-referrer"
                              className={`w-9 h-9 rounded-md border border-slate-200 shrink-0 ${
                                r.ownerPhotoFit === 'cover'
                                  ? 'object-cover'
                                  : 'object-contain bg-white'
                              }`}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                              صورة
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                              {r.owner?.fullName}
                            </div>
                            <div className="text-xs font-mono-num text-slate-500">
                              {r.owner?.nationalId || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {[r.vehicle?.make, r.vehicle?.model, r.vehicle?.year]
                            .filter(Boolean)
                            .join(' ') || '—'}
                        </div>
                        <div className="text-xs text-slate-500 font-mono-num">
                          بيان: {r.vehicle?.declarationNumber || '—'}
                          {r.vehicle?.color ? ` · اللون: ${r.vehicle.color}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono-num text-xs font-semibold text-slate-800">
                          {r.owner?.mobile || '—'}
                        </div>
                        <div className="text-xs text-slate-600 max-w-[240px] whitespace-normal leading-snug">
                          {r.owner?.currentResidence || r.owner?.cardAddress || '—'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewCard(r)}
                            title="عرض استمارة 4×6"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#132654] text-white hover:bg-[#0d1c40] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>الاستمارة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadRegistrationPdf(r)}
                            title="تنزيل PDF (4×6)"
                            className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
                              isTransport
                                ? 'border-red-200 text-red-700 hover:bg-red-50'
                                : 'border-blue-200 text-[#132654] hover:bg-blue-50'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadRegistrationImage(r)}
                            title="تنزيل صورة PNG (4×6)"
                            className="p-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            title="تعديل بيانات الاستمارة"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => handleDelete(r.id)}
                            title={
                              isProtected
                                ? `محفوظة لمدة 48 ساعة على الأقل (متبقي ${remainingText})`
                                : 'حذف السجل'
                            }
                            className={`p-1.5 rounded-md border border-slate-200 transition-colors cursor-pointer disabled:opacity-50 ${
                              isProtected
                                ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-700'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            {isProtected ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
