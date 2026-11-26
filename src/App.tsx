import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Edit3, Plus, X } from 'lucide-react';
import {
  createEmptyPerson,
  createEmptyVehicle,
  createEmptyWitness,
  type RegistrationRecord,
} from './types';
import {
  RegistrationForm,
  type RegistrationDraft,
} from './components/RegistrationForm';
import { RegistrationCardPreview } from './components/RegistrationCardPreview';
import { RegistrationsArchive } from './components/RegistrationsArchive';
import { rotateImageDataUrl } from './utils/imageHelpers';
import {
  deleteLocalRegistration,
  formatRemainingRetention,
  getAllLocalRegistrations,
  getRemainingRetentionMs,
  saveAllLocalRegistrations,
  saveLocalRegistration,
} from './utils/archiveStorage';

type ActiveTab = 'register' | 'archive';

function makeEmptyDraft(): RegistrationDraft {
  return {
    formNumber: '',
    expiryDate: '',
    category: 'private',
    plateNumber: '',
    plateRegion: '',
    plateImage: '',
    plateImageFit: 'contain',
    ownerPhoto: '',
    ownerPhotoFit: 'contain',
    customsImage: '',
    vehicle: createEmptyVehicle(),
    owner: createEmptyPerson(),
    witnesses: [createEmptyWitness(0), createEmptyWitness(1)],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('register');
  const [draft, setDraft] = useState<RegistrationDraft>(makeEmptyDraft);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [records, setRecords] = useState<RegistrationRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [modalRecord, setModalRecord] = useState<RegistrationRecord | null>(null);
  const [justSavedState, setJustSavedState] = useState<{
    id: string;
    wasEdit: boolean;
  } | null>(null);

  const handleDraftChange: React.Dispatch<React.SetStateAction<RegistrationDraft>> = (
    updater
  ) => {
    setDraft(updater);
    setHasUnsavedChanges(true);
  };

  const fetchRecords = useCallback(async () => {
    setLoadingRecords(true);
    const localRecords = await getAllLocalRegistrations();
    if (localRecords.length > 0) {
      setRecords(localRecords);
    }

    try {
      const res = await fetch('/api/registrations');
      const json = await res.json();
      if (json.success && Array.isArray(json.records)) {
        const serverRecords: RegistrationRecord[] = json.records;
        const serverIds = new Set(serverRecords.map((r) => r.id));
        const missingOnServer = localRecords.filter((r) => !serverIds.has(r.id));

        if (missingOnServer.length > 0) {
          const syncRes = await fetch('/api/registrations/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: localRecords }),
          });
          const syncJson = await syncRes.json();
          if (syncRes.ok && syncJson.success && Array.isArray(syncJson.records)) {
            setRecords(syncJson.records);
            await saveAllLocalRegistrations(syncJson.records);
            return;
          }
        }

        const byId = new Map<string, RegistrationRecord>();
        for (const r of localRecords) byId.set(r.id, r);
        for (const r of serverRecords) byId.set(r.id, r);
        const merged = Array.from(byId.values()).sort(
          (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
        );
        setRecords(merged);
        await saveAllLocalRegistrations(merged);
      }
    } catch {
      // Keep locally persisted IndexedDB records on network error
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSaveSuccess = (saved: RegistrationRecord, wasEdit: boolean) => {
    void saveLocalRegistration(saved);
    setRecords((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      if (exists) {
        return prev.map((item) => (item.id === saved.id ? saved : item));
      }
      return [saved, ...prev];
    });
    setDraft((prev) => ({
      ...prev,
      id: saved.id,
      serialNumber: saved.serialNumber,
      createdAt: saved.createdAt,
    }));
    setHasUnsavedChanges(false);
    setJustSavedState({ id: saved.id, wasEdit });
    setModalRecord(saved);
  };

  const handleStartNew = () => {
    setDraft(makeEmptyDraft());
    setHasUnsavedChanges(false);
    setJustSavedState(null);
    setModalRecord(null);
    setActiveTab('register');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setDraft(makeEmptyDraft());
    setHasUnsavedChanges(false);
    setJustSavedState(null);
    setActiveTab('archive');
  };

  const handleEditRecord = (record: RegistrationRecord) => {
    setDraft({
      id: record.id,
      serialNumber: record.serialNumber,
      formNumber: record.formNumber || '',
      expiryDate: record.expiryDate || '',
      createdAt: record.createdAt,
      category: record.category,
      plateNumber: record.plateNumber,
      plateRegion: record.plateRegion,
      plateImage: record.plateImage,
      plateImageFit: record.plateImageFit || 'contain',
      ownerPhoto: record.ownerPhoto,
      ownerPhotoFit: record.ownerPhotoFit || 'contain',
      customsImage: record.customsImage,
      vehicle: { ...createEmptyVehicle(), ...record.vehicle },
      owner: { ...createEmptyPerson(), ...record.owner },
      witnesses:
        record.witnesses?.length > 0
          ? record.witnesses.map((w, idx) => ({ ...createEmptyWitness(idx), ...w }))
          : [createEmptyWitness(0), createEmptyWitness(1)],
    });
    setHasUnsavedChanges(false);
    setModalRecord(null);
    setJustSavedState(null);
    setActiveTab('register');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRotateDraftPhoto = async (field: 'plateImage' | 'ownerPhoto') => {
    const current = draft[field];
    if (!current) return;
    try {
      const rotated = await rotateImageDataUrl(current, 90);
      setDraft((prev) => ({ ...prev, [field]: rotated }));
      setHasUnsavedChanges(true);
    } catch {
      // Ignore rotation failure on invalid image
    }
  };

  const ensureSavedBeforeExport = async (): Promise<RegistrationRecord> => {
    if (draft.id && !hasUnsavedChanges) {
      const existing = records.find((item) => item.id === draft.id);
      if (existing) {
        return existing;
      }
    }

    if (!draft.plateNumber.trim()) {
      throw new Error('يجب حفظ المعاملة في الأرشيف قبل التنزيل: يرجى إدخال رقم السيارة (اللوحة).');
    }
    if (!draft.owner.fullName.trim()) {
      throw new Error('يجب حفظ المعاملة في الأرشيف قبل التنزيل: يرجى إدخال الاسم الكامل للمالك.');
    }
    if (!draft.owner.mobile.trim()) {
      throw new Error('يجب حفظ المعاملة في الأرشيف قبل التنزيل: يرجى إدخال رقم جوال المالك يدوياً.');
    }
    if (!draft.owner.currentResidence.trim()) {
      throw new Error('يجب حفظ المعاملة في الأرشيف قبل التنزيل: يرجى إدخال السكن الحالي للمالك يدوياً.');
    }

    const isEditing = Boolean(draft.id);
    const endpoint = isEditing ? `/api/registrations/${draft.id}` : '/api/registrations';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const json = await res.json();
    if (!res.ok || !json.success || !json.record) {
      throw new Error(json.error || 'تعذر حفظ المعاملة في الأرشيف قبل التنزيل.');
    }

    const saved: RegistrationRecord = json.record;
    void saveLocalRegistration(saved);
    setRecords((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      if (exists) {
        return prev.map((item) => (item.id === saved.id ? saved : item));
      }
      return [saved, ...prev];
    });
    setDraft((prev) => ({
      ...prev,
      id: saved.id,
      serialNumber: saved.serialNumber,
      createdAt: saved.createdAt,
    }));
    setHasUnsavedChanges(false);
    return saved;
  };

  const handleDeleteRecord = async (id: string) => {
    const target = records.find((item) => item.id === id);
    if (target && getRemainingRetentionMs(target) > 0) {
      const remaining = formatRemainingRetention(target);
      throw new Error(
        `يتم الاحتفاظ بالاستمارة لمدة 48 ساعة على الأقل بعد الحفظ، ولا يمكن حذفها قبل انتهاء المدة (متبقي ${remaining}).`
      );
    }

    const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'تعذر حذف الاستمارة.');
    }
    await deleteLocalRegistration(id);
    setRecords((prev) => prev.filter((item) => item.id !== id));
    if (modalRecord?.id === id) {
      setModalRecord(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#E2EBF8] p-1.5 sm:p-2.5 text-slate-900 flex flex-col">
      {/* Official Traffic Department Outer Blue Frame */}
      <div className="flex-1 flex flex-col rounded-2xl border-2 border-[#1D4ED8] p-1 bg-white/60 shadow-sm">
        {/* Middle Sky Frame */}
        <div className="flex-1 flex flex-col rounded-xl border border-[#93C5FD] p-1 bg-white">
          {/* Inner Traffic Navy Frame */}
          <div className="flex-1 flex flex-col rounded-lg border-2 border-[#132654] bg-[#F4F7FC]">
            {/* Three-Zone Top Bar */}
            <header className="bg-[#132654] text-white border-b-2 border-[#1D4ED8] sticky top-0 z-30 rounded-t-[6px]">
              <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
                {/* Zone 1: Brand Wordmark */}
                <a
                  href="#top"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('register');
                  }}
                  className="text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
                >
                  نظام ترقيم جمارك ورقابة تعز
                </a>

                {/* Zone 2: Concise Nav Links */}
                <nav className="flex items-center gap-6 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === 'register'
                        ? 'border-amber-400 text-white'
                        : 'border-transparent text-blue-100/80 hover:text-white'
                    }`}
                  >
                    تسجيل مركبة
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('archive')}
                    className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === 'archive'
                        ? 'border-amber-400 text-white'
                        : 'border-transparent text-blue-100/80 hover:text-white'
                    }`}
                  >
                    أرشيف الاستمارات ({records.length})
                  </button>
                </nav>

                {/* Zone 3: Single Primary Action */}
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={handleStartNew}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#132654] bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ترقيم جديد</span>
                  </button>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
              {activeTab === 'register' ? (
                <div className="space-y-6">
                  <div className="bg-white border border-blue-200/80 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-[#132654]">
                        الجمهورية اليمنية · إدارة مرور محافظة تعز — لجنة ترقيم الجمارك
                      </h1>
                      <p className="text-sm text-slate-600 mt-1">
                        ارفع صور البيان الجمركي وبطاقات الهوية واللوحة لنسخ البيانات بالذكاء الاصطناعي، مع إدخال الجوال والسكن الحالي يدوياً وإصدار استمارة ٤×٦.
                      </p>
                    </div>
                    <img
                      src="/assets/emblems_strip.png"
                      alt="شعارات الجمهورية اليمنية ووزارة الداخلية والإدارة العامة للمرور"
                      referrerPolicy="no-referrer"
                      className="h-12 w-auto object-contain shrink-0"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Form Column (7/12) */}
                    <div className="lg:col-span-7">
                      <RegistrationForm
                        draft={draft}
                        onChange={handleDraftChange}
                        onSaveSuccess={handleSaveSuccess}
                        onReset={handleStartNew}
                        onCancelEdit={handleCancelEdit}
                      />
                    </div>

                    {/* Sticky Live 4x6 Preview Column (5/12) */}
                    <aside className="lg:col-span-5 lg:sticky lg:top-20 bg-white border border-blue-200/80 rounded-xl p-5">
                      <RegistrationCardPreview
                        record={draft}
                        isSaved={Boolean(draft.id)}
                        hasUnsavedChanges={hasUnsavedChanges}
                        onBeforeExport={ensureSavedBeforeExport}
                        onTogglePlateFit={() => {
                          setDraft((prev) => ({
                            ...prev,
                            plateImageFit:
                              prev.plateImageFit === 'cover' ? 'contain' : 'cover',
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        onToggleOwnerFit={() => {
                          setDraft((prev) => ({
                            ...prev,
                            ownerPhotoFit:
                              prev.ownerPhotoFit === 'cover' ? 'contain' : 'cover',
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        onRotatePlate={() => handleRotateDraftPhoto('plateImage')}
                        onRotateOwner={() => handleRotateDraftPhoto('ownerPhoto')}
                      />
                    </aside>
                  </div>

                  {/* Always-Visible Form Archive Register Section */}
                  <section
                    id="archive-register-section"
                    className="pt-6 border-t-2 border-blue-200/80 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg sm:text-xl font-extrabold text-[#132654]">
                          سجل أرشيف الاستمارات ({records.length})
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                          تظهر جميع الاستمارات المحفوظة هنا مباشرة للمعاينة أو التعديل أو التنزيل، ويتم الاحتفاظ بها لمدة ٤٨ ساعة على الأقل تلقائياً.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('archive')}
                        className="px-3.5 py-2 text-xs font-bold text-[#132654] bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        عرض الأرشيف بصفحة مستقلة
                      </button>
                    </div>

                    <RegistrationsArchive
                      records={records}
                      loading={loadingRecords}
                      onCreateNew={handleStartNew}
                      onViewCard={(rec) => {
                        setJustSavedState(null);
                        setModalRecord(rec);
                      }}
                      onEdit={handleEditRecord}
                      onDelete={handleDeleteRecord}
                    />
                  </section>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white border border-blue-200/80 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-[#132654]">
                        سجل أرشيف الاستمارات — إدارة مرور محافظة تعز
                      </h1>
                      <p className="text-sm text-slate-600 mt-1">
                        عرض وتعديل جميع الاستمارات المسجلة وتنزيل استمارات 4×6 بصيغة PDF أو صورة.
                      </p>
                    </div>
                    <img
                      src="/assets/emblems_strip.png"
                      alt="شعارات الجمهورية اليمنية ووزارة الداخلية والإدارة العامة للمرور"
                      referrerPolicy="no-referrer"
                      className="h-12 w-auto object-contain shrink-0"
                    />
                  </div>

                  <RegistrationsArchive
                    records={records}
                    loading={loadingRecords}
                    onCreateNew={handleStartNew}
                    onViewCard={(rec) => {
                      setJustSavedState(null);
                      setModalRecord(rec);
                    }}
                    onEdit={handleEditRecord}
                    onDelete={handleDeleteRecord}
                  />
                </div>
              )}
            </main>

            {/* Traffic Footer Credit */}
            <footer className="border-t border-blue-200/80 bg-white/80 py-3 px-4 text-center text-xs font-semibold text-[#132654] rounded-b-[6px]">
              إدارة مرور محافظة تعز · لجنة ترقيم الجمارك · مصمم ومطور النظام المهندس / علاء القاضي
            </footer>
          </div>
        </div>
      </div>

      {/* Post-Save / Inspection 4x6 Modal */}
      {modalRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border-2 border-[#132654] rounded-xl max-w-lg w-full p-5 sm:p-6 space-y-4 my-auto shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                {justSavedState?.id === modalRecord.id && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {justSavedState.wasEdit
                        ? 'تم حفظ التعديلات وتحديث الاستمارة في الأرشيف بنجاح'
                        : 'تم حفظ البيانات وإصدار الاستمارة بنجاح'}
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-[#132654]">
                  استمارة الترقيم المعتمدة (٤×٦) — جمارك ورقابة تعز
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalRecord(null)}
                aria-label="إغلاق النافذة"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <RegistrationCardPreview record={modalRecord} isSaved />

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEditRecord(modalRecord)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل الاستمارة</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  تسجيل مركبة جديدة
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalRecord(null);
                  setActiveTab('archive');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-[#132654] hover:text-[#1D4ED8] cursor-pointer"
              >
                عرض أرشيف الاستمارات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
