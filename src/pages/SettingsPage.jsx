import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Loader2, Smartphone, Trash2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { fmtDate, fmtTime } from '@/lib/formatters';
import { Field } from '@/components/shop/Field';
import { Badge } from '@/components/shop/Badge';
import { Empty } from '@/components/shop/Empty';
import { Confirm } from '@/components/shop/Confirm';
import * as settingsApi from '@/services/api/settings';
import { inp, btn } from '@/components/shop/styles';

export function SettingsPage() {
  const { listDevices, revokeDevice, changePassword } = useAuth();
  const { settings, loading: loadingSettings, reload: reloadSettings } = useSettings();

  const [info, setInfo] = useState({ shopName: '', ownerName: '', phone: '', address: '' });
  const [invoice, setInvoice] = useState({ invoiceFooter: '' });
  const [threshold, setThreshold] = useState(5);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState(null);

  useEffect(() => {
    if (!settings) return;
    setInfo({ shopName: settings.shopName || '', ownerName: settings.ownerName || '', phone: settings.phone || '', address: settings.address || '' });
    setInvoice({ invoiceFooter: settings.invoiceFooter || '' });
    setThreshold(settings.lowStockThreshold ?? 5);
  }, [settings]);

  const loadDevices = useCallback(() => {
    setLoadingDevices(true);
    listDevices()
      .then(setDevices)
      .catch((err) => toast.error(err.message || 'تعذر تحميل الأجهزة المسجلة'))
      .finally(() => setLoadingDevices(false));
  }, [listDevices]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      await settingsApi.updateSettings(info);
      await reloadSettings();
      toast.success('تم حفظ معلومات المحل بنجاح');
    } catch (err) {
      toast.error(err.message || 'تعذر حفظ معلومات المحل');
    } finally {
      setSavingInfo(false);
    }
  };

  const saveInvoice = async () => {
    setSavingInvoice(true);
    try {
      await settingsApi.updateSettings(invoice);
      await reloadSettings();
      toast.success('تم حفظ إعدادات الفاتورة بنجاح');
    } catch (err) {
      toast.error(err.message || 'تعذر حفظ إعدادات الفاتورة');
    } finally {
      setSavingInvoice(false);
    }
  };

  const saveThreshold = async () => {
    setSavingThreshold(true);
    try {
      await settingsApi.updateSettings({ lowStockThreshold: Number(threshold) || 0 });
      await reloadSettings();
      toast.success('تم حفظ إعدادات المخزون بنجاح');
    } catch (err) {
      toast.error(err.message || 'تعذر حفظ إعدادات المخزون');
    } finally {
      setSavingThreshold(false);
    }
  };

  const savePassword = async () => {
    if (!pwForm.currentPassword) { toast.error('أدخل كلمة المرور الحالية'); return; }
    if (!pwForm.newPassword || pwForm.newPassword.length < 4) { toast.error('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل'); return; }
    if (pwForm.newPassword !== pwForm.confirm) { toast.error('كلمتا المرور غير متطابقتين'); return; }

    setChangingPw(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      toast.success('تم تغيير كلمة المرور بنجاح، وتم تسجيل خروج باقي الأجهزة تلقائياً');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.message || 'تعذر تغيير كلمة المرور');
    } finally {
      setChangingPw(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeDevice(revokeTarget.id);
      toast.success('تم إلغاء تسجيل الجهاز بنجاح');
      setRevokeTarget(null);
      loadDevices();
    } catch (err) {
      toast.error(err.message || 'تعذر إلغاء تسجيل الجهاز');
    }
  };

  return (
    <div className="grid max-w-3xl gap-4">
      <Helmet><title>الإعدادات — نظام إدارة المحل</title><meta name="description" content="إعدادات المحل والنظام" /></Helmet>

      <div className="grid gap-3 rounded-xl border bg-card p-5">
        <h3 className="font-bold">معلومات المحل</h3>
        {loadingSettings ? (
          <div className="py-6 text-center text-muted-foreground"><Loader2 size={18} className="mx-auto animate-spin" /></div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="اسم المحل"><input className={inp} value={info.shopName} onChange={(e) => setInfo({ ...info, shopName: e.target.value })} /></Field>
              <Field label="اسم صاحب المحل"><input className={inp} value={info.ownerName} onChange={(e) => setInfo({ ...info, ownerName: e.target.value })} /></Field>
              <Field label="الهاتف"><input className={inp} value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></Field>
              <Field label="العنوان"><input className={inp} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></Field>
            </div>
            <div>
              <button className={btn} onClick={saveInfo} disabled={savingInfo}>
                {savingInfo && <Loader2 size={15} className="animate-spin" />} حفظ معلومات المحل
              </button>
            </div>
          </>
        )}
      </div>

      {!loadingSettings && (
        <>
          <div className="grid gap-3 rounded-xl border bg-card p-5">
            <h3 className="font-bold">إعدادات الفاتورة</h3>
            <p className="text-xs text-muted-foreground">تظهر بيانات المحل (الاسم، الهاتف، العنوان) تلقائياً في رأس الفاتورة.</p>
            <Field label="رسالة أسفل الفاتورة"><input className={inp} value={invoice.invoiceFooter} onChange={(e) => setInvoice({ invoiceFooter: e.target.value })} /></Field>
            <div>
              <button className={btn} onClick={saveInvoice} disabled={savingInvoice}>
                {savingInvoice && <Loader2 size={15} className="animate-spin" />} حفظ إعدادات الفاتورة
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border bg-card p-5">
            <h3 className="font-bold">إعدادات المخزون</h3>
            <Field label="حد التنبيه الافتراضي للمخزون المنخفض"><input type="number" min="0" className={inp} value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
            <div>
              <button className={btn} onClick={saveThreshold} disabled={savingThreshold}>
                {savingThreshold && <Loader2 size={15} className="animate-spin" />} حفظ
              </button>
            </div>
          </div>
        </>
      )}

      {/* تغيير كلمة المرور — تستخدم الآن نظام المصادقة الحقيقي (كلمة مرور واحدة للمحل)،
          وتتطلب كلمة المرور الحالية، وتسجّل خروج باقي الأجهزة المسجلة تلقائياً عند النجاح. */}
      <div className="grid gap-3 rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={16} className="text-primary" /> تغيير كلمة المرور</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="كلمة المرور الحالية">
            <input type="password" className={inp} value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
          </Field>
          <Field label="كلمة المرور الجديدة">
            <input type="password" className={inp} value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} />
          </Field>
          <Field label="تأكيد كلمة المرور الجديدة">
            <input type="password" className={inp} value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
          </Field>
        </div>
        <div>
          <button className={btn} onClick={savePassword} disabled={changingPw}>
            {changingPw && <Loader2 size={15} className="animate-spin" />} تغيير كلمة المرور
          </button>
        </div>
      </div>

      {/* إدارة الأجهزة المسجلة — الحد الأقصى جهازان في نفس الوقت. */}
      <div className="grid gap-3 rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-bold"><Smartphone size={16} className="text-primary" /> الأجهزة المسجلة</h3>
        <p className="text-xs text-muted-foreground">
          يمكن استخدام حساب الدخول من جهازين كحد أقصى في نفس الوقت. لإضافة جهاز جديد بعد الوصول للحد الأقصى، يجب إلغاء تسجيل جهاز قديم أولاً.
        </p>
        {loadingDevices ? (
          <div className="py-6 text-center text-muted-foreground"><Loader2 size={18} className="mx-auto animate-spin" /></div>
        ) : devices.length === 0 ? <Empty text="لا توجد أجهزة مسجلة" /> : (
          <div className="grid gap-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{d.label || 'جهاز غير مسمى'}</span>
                    {d.isCurrent && <Badge tone="green">هذا الجهاز</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    آخر نشاط: {d.lastActiveAt ? `${fmtDate(d.lastActiveAt)} — ${fmtTime(d.lastActiveAt)}` : '—'}
                  </div>
                </div>
                <button
                  onClick={() => setRevokeTarget(d)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="إلغاء تسجيل الجهاز"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirm
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="إلغاء تسجيل جهاز"
        description={
          revokeTarget?.isCurrent
            ? 'سيتم تسجيل خروجك من هذا الجهاز فوراً بعد الإلغاء. هل أنت متأكد؟'
            : `سيتم إلغاء تسجيل الجهاز "${revokeTarget?.label || 'غير مسمى'}"، ويمكن استخدام مكانه لجهاز جديد. هل أنت متأكد؟`
        }
        onConfirm={handleRevoke}
      />
    </div>
  );
}

export default SettingsPage;
