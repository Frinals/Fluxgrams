export default function CallsView({ onTestBanner }: any) {
  return (
    <div className="flex flex-col h-full p-4" style={{ background: 'var(--app-bg)' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>Звонки</h2>
      </div>

      <div className="p-4 rounded-3xl liquid-glass mb-6 text-center">
        <p className="mb-3 text-sm" style={{ color: 'var(--app-text-muted)' }}>Проверить входящий звонок?</p>
        <button onClick={onTestBanner} className="w-full py-3 rounded-xl font-bold text-white" style={{ background: 'var(--app-accent)' }}>
          📞 Протестировать баннер
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center opacity-50">
        <span className="text-6xl mb-4">📞</span>
        <h2 className="text-lg font-bold" style={{ color: 'var(--app-text)' }}>История звонков пуста</h2>
      </div>
    </div>
  );
}
