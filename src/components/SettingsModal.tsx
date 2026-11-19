import React, { useState, useEffect } from 'react';
import { X, Key, Download, Upload, AlertTriangle, Check, Shield } from 'lucide-react';
import { getAISettings, saveAISettings, DEFAULT_GEMINI_KEY } from '../services/ai';
import { exportCardsToJson, importCardsFromJson } from '../services/db';
import { getErrorMessage } from '../types/card';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDataChanged }) => {
  const [provider, setProvider] = useState<'gemini' | 'claude'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getAISettings();
      setProvider(current.provider);
      // If current key equals the system default, show empty in the input so user can enter custom if desired
      setApiKey(current.apiKey === DEFAULT_GEMINI_KEY ? '' : current.apiKey);
      setSavedSuccess(false);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAISettings = (e: React.FormEvent) => {
    e.preventDefault();
    const finalKey = apiKey.trim() || (provider === 'gemini' ? DEFAULT_GEMINI_KEY : '');
    saveAISettings({ provider, apiKey: finalKey });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExport = async () => {
    try {
      const json = await exportCardsToJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `so-tu-vung-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'Đã xuất file sao lưu thành công!' });
    } catch (error: unknown) {
      setStatusMessage({ type: 'error', text: 'Lỗi xuất dữ liệu: ' + getErrorMessage(error) });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = typeof event.target?.result === 'string' ? event.target.result : '';
        const count = await importCardsFromJson(text);
        setStatusMessage({ type: 'success', text: `Đã nhập thành công ${count} thẻ từ vựng vào sổ!` });
        onDataChanged();
      } catch (error: unknown) {
        setStatusMessage({ type: 'error', text: 'Lỗi nạp file: ' + getErrorMessage(error) });
      }
    };

    reader.onerror = () => {
      setStatusMessage({ type: 'error', text: 'Không thể đọc nội dung file sao lưu.' });
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-slate-900 dark:text-white text-base">Cài Đặt Ứng Dụng</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* AI Settings Section */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Cấu hình AI (Tự điền & Chấm bài viết)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ứng dụng đã có sẵn Google Gemini Key mặc định. Bạn có thể tự do nhập key riêng của mình (Gemini hoặc Claude).
              </p>
            </div>

            <form onSubmit={handleSaveAISettings} className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="gemini"
                    checked={provider === 'gemini'}
                    onChange={() => setProvider('gemini')}
                    className="accent-indigo-600"
                  />
                  Google Gemini (Có key mặc định sẵn)
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="claude"
                    checked={provider === 'claude'}
                    onChange={() => setProvider('claude')}
                    className="accent-indigo-600"
                  />
                  Anthropic Claude
                </label>
              </div>

              <div>
                <input
                  type="password"
                  placeholder={
                    provider === 'gemini'
                      ? 'Dán mã Google Gemini API Key riêng (hoặc để trống để dùng key mặc định)'
                      : 'Dán mã Anthropic Claude API Key (sk-ant...)'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {provider === 'gemini' && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    {apiKey.trim()
                      ? 'Đang dùng Gemini API Key riêng của bạn.'
                      : 'Đang kích hoạt sẵn key Gemini mặc định của hệ thống.'}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
                >
                  {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : null}
                  {savedSuccess ? 'Đã lưu thành công' : 'Lưu cấu hình AI'}
                </button>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Lưu an toàn tại Client
                </span>
              </div>
            </form>
          </section>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Backup & Restore */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Sao lưu & Phục hồi Sổ từ vựng
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Xuất toàn bộ thẻ từ và tiến độ học thành file JSON để lưu về máy tính hoặc chuyển sang thiết bị khác.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-indigo-500" />
                Xuất file sao lưu (JSON)
              </button>

              <label className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center gap-2 cursor-pointer transition">
                <Upload className="w-4 h-4 text-emerald-500" />
                Nhập file sao lưu
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                {statusMessage.text}
              </div>
            )}
          </section>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Privacy Note */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Dữ liệu của bạn được lưu trong bộ nhớ máy (IndexedDB). Khi dùng trình duyệt ẩn danh hoặc xóa cookie, dữ liệu có thể bị xóa. Hãy định kỳ xuất file sao lưu để bảo vệ tiến độ học!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
