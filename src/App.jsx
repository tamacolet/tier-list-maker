import React, { useState, useEffect, useRef } from 'react';
import { Settings, Plus, Image as ImageIcon, Download, Trash2, ArrowUp, ArrowDown, X, RefreshCw, AlertCircle, Palette } from 'lucide-react';
import { toJpeg } from 'html-to-image';

const defaultTiers = [
    { id: 't1', label: 'S', color: '#ff7f7f', items: [] },
    { id: 't2', label: 'A', color: '#ffbf7f', items: [] },
    { id: 't3', label: 'B', color: '#ffff7f', items: [] },
    { id: 't4', label: 'C', color: '#7fff7f', items: [] },
    { id: 't5', label: 'D', color: '#7fbfff', items: [] },
];

const generateDummyImage = (text, color) => {
    const fontSize = text.length > 4 ? 20 : 36;
    const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" fill="${color}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="sans-serif">${safeText}</text></svg>`;
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
};

const sampleItems = [
    { id: 'i1', url: generateDummyImage('りんご', '#ef4444'), text: 'りんご' },
    { id: 'i2', url: generateDummyImage('バナナ', '#f59e0b'), text: 'バナナ' },
];

export default function App() {
    const [tiers, setTiers] = useState(defaultTiers);
    const [pool, setPool] = useState(sampleItems);
    const [draggedItem, setDraggedItem] = useState(null);
    const [settingsModal, setSettingsModal] = useState({ isOpen: false, tierId: null });
    const [isExporting, setIsExporting] = useState(false);

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    const [alertModal, setAlertModal] = useState({ isOpen: false, message: '' });

    // --- 背景設定用ステート ---
    const [bgModalOpen, setBgModalOpen] = useState(false);
    const [boardBg, setBoardBg] = useState({
        color: '#111827',
        imageUrl: '',
        opacity: 50
    });
    const bgFileInputRef = useRef(null);

    const fileInputRef = useRef(null);

    useEffect(() => {

        // モバイル端末でのドラッグ＆ドロップ対応（ポリフィル）
        if (!window.MobileDragDrop) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/default.css';
            document.head.appendChild(css);

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/index.min.js';
            script.async = true;
            script.onload = () => {
                // 300msの長押しでドラッグ開始にする設定
                window.MobileDragDrop.polyfill({ holdToDrag: 300 });
                window.addEventListener('touchmove', function () { }, { passive: false });
            };
            document.body.appendChild(script);
        }
    }, []);

    // --- ドラッグ＆ドロップ制御 ---
    const handleDragStart = (e, item, sourceId) => {
        setDraggedItem({ item, sourceId });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        } else {
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleDrop = async (e, targetId) => {
        e.preventDefault();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            if (files.length > 0) {
                const newItems = await Promise.all(files.map(async file => {
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(file);
                    });
                    return {
                        id: crypto.randomUUID(),
                        url: dataUrl,
                        text: file.name.split('.')[0]
                    };
                }));

                if (targetId === 'pool') {
                    setPool(prev => [...prev, ...newItems]);
                } else {
                    setTiers(prev => prev.map(t =>
                        t.id === targetId ? { ...t, items: [...t.items, ...newItems] } : t
                    ));
                }
            }
            return;
        }

        if (!draggedItem) return;

        const { item, sourceId } = draggedItem;
        if (sourceId === targetId) {
            setDraggedItem(null);
            return;
        }

        if (sourceId === 'pool') {
            setPool(prev => prev.filter(i => i.id !== item.id));
        } else {
            setTiers(prev => prev.map(t =>
                t.id === sourceId ? { ...t, items: t.items.filter(i => i.id !== item.id) } : t
            ));
        }

        if (targetId === 'pool') {
            setPool(prev => [...prev, item]);
        } else {
            setTiers(prev => prev.map(t =>
                t.id === targetId ? { ...t, items: [...t.items, item] } : t
            ));
        }

        setDraggedItem(null);
    };

    // --- 画像アップロード制御 ---
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        const newItems = await Promise.all(files.map(async file => {
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            return {
                id: crypto.randomUUID(),
                url: dataUrl,
                text: file.name.split('.')[0]
            };
        }));
        setPool(prev => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- 行（Tier）の操作 ---
    const addTier = () => {
        const newTier = { id: crypto.randomUUID(), label: 'New', color: '#d1d5db', items: [] };
        setTiers([...tiers, newTier]);
    };

    const openSettings = (tierId) => setSettingsModal({ isOpen: true, tierId });
    const closeSettings = () => setSettingsModal({ isOpen: false, tierId: null });

    const updateTier = (id, updates) => setTiers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    const moveTier = (index, direction) => {
        if (direction === -1 && index === 0) return;
        if (direction === 1 && index === tiers.length - 1) return;
        const newTiers = [...tiers];
        const temp = newTiers[index];
        newTiers[index] = newTiers[index + direction];
        newTiers[index + direction] = temp;
        setTiers(newTiers);
    };

    const deleteTier = (id) => {
        const tierToDelete = tiers.find(t => t.id === id);
        if (tierToDelete && tierToDelete.items.length > 0) {
            setPool(prev => [...prev, ...tierToDelete.items]);
        }
        setTiers(prev => prev.filter(t => t.id !== id));
        closeSettings();
    };

    const clearTier = (id) => {
        const tierToClear = tiers.find(t => t.id === id);
        if (tierToClear && tierToClear.items.length > 0) {
            setPool(prev => [...prev, ...tierToClear.items]);
            updateTier(id, { items: [] });
        }
    };

    const resetBoard = () => {
        setConfirmModal({
            isOpen: true,
            message: 'すべてのアイテムをプールに戻しますか？',
            onConfirm: () => {
                const allItems = tiers.flatMap(t => t.items);
                setPool(prev => [...prev, ...allItems]);
                setTiers(prev => prev.map(t => ({ ...t, items: [] })));
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
            }
        });
    };

    const handleDownload = () => {
        setIsExporting(true);
        setTimeout(async () => {
            const element = document.getElementById('tier-list-board');
            if (!element) {
                setIsExporting(false);
                return;
            }
            try {
                const rect = element.getBoundingClientRect();
                const w = Math.max(element.scrollWidth, Math.ceil(rect.width));
                const h = Math.max(element.scrollHeight, Math.ceil(rect.height));

                const clone = element.cloneNode(true);
                Object.assign(clone.style, {
                    position: 'fixed', top: '0', left: '0',
                    width: w + 'px', height: h + 'px',
                    overflow: 'visible', zIndex: '-9999',
                    opacity: '1', pointerEvents: 'none',
                    backgroundColor: boardBg.color
                });
                clone.querySelectorAll('button').forEach(btn => btn.remove());
                document.body.appendChild(clone);
                await new Promise(r => setTimeout(r, 300));

                const options = {
                    backgroundColor: boardBg.color, pixelRatio: 2,
                    width: w, height: h, canvasWidth: w, canvasHeight: h,
                    style: { overflow: 'visible' }
                };
                await toJpeg(clone, { ...options, quality: 0.1 }).catch(() => { });
                const dataUrl = await toJpeg(clone, { ...options, quality: 0.92 });
                document.body.removeChild(clone);

                const byteString = atob(dataUrl.split(',')[1]);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                const file = new File([new Blob([ab], { type: 'image/jpeg' })], 'my-tier-list.jpg', { type: 'image/jpeg' });

                if (window.showSaveFilePicker) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: 'my-tier-list.jpg',
                            types: [{ description: 'JPEG Image', accept: { 'image/jpeg': ['.jpg'] } }]
                        });
                        const writable = await handle.createWritable();
                        await writable.write(file);
                        await writable.close();
                    } catch (pickerErr) {
                        if (pickerErr.name !== 'AbortError') throw pickerErr;
                    }
                } else {
                    const blobUrl = URL.createObjectURL(file);
                    const link = document.createElement('a');
                    link.download = 'my-tier-list.jpg';
                    link.href = blobUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                }
            } catch (err) {
                console.error("画像生成エラー:", err);
                setAlertModal({ isOpen: true, message: "画像の作成に失敗しました。特殊な画像フォーマットが含まれている可能性があります。" });
            } finally {
                setIsExporting(false);
            }
        }, 300);
    };

    const activeTier = settingsModal.isOpen ? tiers.find(t => t.id === settingsModal.tierId) : null;
    const activeTierIndex = activeTier ? tiers.findIndex(t => t.id === activeTier.id) : -1;

    return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-10">
        <header className="bg-gray-900 border-b border-gray-800 p-3 sm:p-4 shadow-md">
            <div className="max-w-6xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-3 lg:gap-4">
                <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                    <span className="text-blue-500">🏆</span> Tier表メーカー
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                    <button onClick={() => setBgModalOpen(true)} className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs sm:text-sm font-medium transition-colors">
                        <Palette size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">背景設定</span><span className="sm:hidden">背景</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs sm:text-sm font-medium transition-colors">
                        <ImageIcon size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">画像追加</span><span className="sm:hidden">画像追加</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
                    <button onClick={resetBoard} className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs sm:text-sm font-medium transition-colors">
                        <RefreshCw size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">リセット</span><span className="sm:hidden">クリア</span>
                    </button>
                    <button onClick={handleDownload} className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs sm:text-sm font-bold text-white transition-colors">
                        <Download size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">画像保存</span><span className="sm:hidden">保存</span>
                    </button>
                </div>
            </div>
        </header>

        <main className="max-w-6xl mx-auto p-2 sm:p-4 flex flex-col gap-4 sm:gap-6">
            <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-xl">
                <div id="tier-list-board" className="relative flex flex-col" style={{ backgroundColor: boardBg.color }}>
                    {boardBg.imageUrl && (
                        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${boardBg.imageUrl})`, opacity: boardBg.opacity / 100 }} />
                    )}
                    <div className="relative z-10 flex flex-col">
                        {tiers.map((tier) => (
                            <div key={tier.id} className={`flex border-b border-gray-800/80 min-h-[80px] sm:min-h-[120px] ${draggedItem && draggedItem.sourceId !== tier.id ? 'bg-white/5' : 'bg-black/40 backdrop-blur-sm'}`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, tier.id)}>
                                <div className="w-14 sm:w-24 md:w-32 flex-shrink-0 border-r border-gray-800/80 relative group" style={{ backgroundColor: tier.color }}>
                                    <div className="absolute inset-0 flex items-center justify-center p-1 sm:p-2">
                                        <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 text-center break-words w-full outline-none">
                                            {tier.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 p-1 sm:p-2 flex flex-wrap items-center content-center gap-1 sm:gap-2 relative min-w-0">
                                    {tier.items.map((item) => (
                                        <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, item, tier.id)} className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-gray-800 rounded shadow border border-gray-700 cursor-move overflow-hidden hover:opacity-80 transition-opacity active:scale-95 touch-none" title={item.text}>
                                            <img src={item.url} alt={item.text} className="w-full h-full object-cover pointer-events-none" />
                                        </div>
                                    ))}
                                    {!isExporting && (
                                        <button onClick={() => openSettings(tier.id)} className="absolute right-1 sm:right-2 top-1 sm:top-2 p-1.5 bg-black/40 hover:bg-black/70 text-white rounded opacity-0 lg:opacity-100 group-hover:opacity-100 transition-opacity" aria-label="設定">
                                            <Settings size={18} />
                                        </button>
                                    )}
                                </div>
                                {!isExporting && (
                                    <div className="flex items-center px-1 sm:px-2 border-l border-gray-800/80 lg:hidden">
                                        <button onClick={() => openSettings(tier.id)} className="p-1 sm:p-2 text-gray-400 hover:text-white">
                                            <Settings size={18} className="sm:w-5 sm:h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-2 bg-gray-900 border-t border-gray-800">
                    <button onClick={addTier} className="w-full py-2 flex items-center justify-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors text-sm sm:text-base">
                        <Plus size={18} /> 行を追加
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-300 px-1">アイテムプール</h2>
                <div className={`min-h-[100px] sm:min-h-[150px] bg-gray-900 border-2 border-dashed border-gray-700 rounded-lg p-2 sm:p-4 flex flex-wrap content-start gap-1 sm:gap-2 transition-colors ${draggedItem ? 'bg-gray-800/50 border-gray-500' : ''}`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'pool')}>
                    {pool.length === 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 py-6 sm:py-8 pointer-events-none text-center px-4">
                            <ImageIcon size={40} className="mb-2 opacity-50 sm:w-12 sm:h-12" />
                            <p className="text-xs sm:text-base">画像をここに追加、または上から戻します</p>
                        </div>
                    ) : (
                        pool.map((item) => (
                            <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, item, 'pool')} className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-gray-800 rounded shadow border border-gray-700 cursor-move overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all active:scale-95 touch-none" title={item.text}>
                                <img src={item.url} alt={item.text} className="w-full h-full object-cover pointer-events-none" />
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-2 sm:mt-4 bg-gray-900/60 border border-gray-800 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <span className="text-blue-400">📖</span> 簡単な使い方
                </h3>
                <ul className="list-disc list-inside space-y-1.5 sm:space-y-2 text-gray-300 text-xs sm:text-sm leading-relaxed">
                    <li><strong>画像を追加:</strong> 上部の「画像追加」ボタンから選ぶか、点線枠に画像をドラッグ＆ドロップします。</li>
                    <li><strong>スマホで操作:</strong> 画像を<strong>少し長押し</strong>してから移動したい場所にドラッグしてください。</li>
                    <li><strong>配置する:</strong> 画像をドラッグして、上の各ランク（S, A, B...）の枠にドロップします。</li>
                    <li><strong>ランクを編集:</strong> 各行の右端にある歯車アイコンから、名前や色、上下の順番を変更できます。</li>
                    <li><strong>画像を保存:</strong> 完成したら「保存」ボタンを押してダウンロードできます。</li>
                </ul>
            </div>
        </main>

        {/* --- 以降、モーダルコンポーネント群 --- */}
        {bgModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setBgModalOpen(false)}>
                <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b border-gray-800">
                        <h3 className="font-bold text-base sm:text-lg">背景の設定</h3>
                        <button onClick={() => setBgModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                    </div>
                    <div className="p-4 space-y-4 text-sm">
                        <div>
                            <label className="block text-gray-400 mb-1">背景色</label>
                            <div className="flex gap-2 items-center">
                                <input type="color" value={boardBg.color} onChange={(e) => setBoardBg({ ...boardBg, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
                                <input type="text" value={boardBg.color} onChange={(e) => setBoardBg({ ...boardBg, color: e.target.value })} className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 uppercase" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">背景画像</label>
                            <div className="flex gap-2">
                                <button onClick={() => bgFileInputRef.current?.click()} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-white text-center">ファイルを選択</button>
                                <input type="file" ref={bgFileInputRef} onChange={(e) => { if (e.target.files[0]) setBoardBg({ ...boardBg, imageUrl: URL.createObjectURL(e.target.files[0]) }); if (bgFileInputRef.current) bgFileInputRef.current.value = ''; }} accept="image/*" className="hidden" />
                                {boardBg.imageUrl && <button onClick={() => setBoardBg({ ...boardBg, imageUrl: '' })} className="px-3 py-2 bg-red-900/30 text-red-400 border border-red-800/50 rounded"><Trash2 size={16} /></button>}
                            </div>
                        </div>
                        {boardBg.imageUrl && (
                            <div>
                                <label className="block text-gray-400 mb-2 flex justify-between"><span>画像の不透明度</span><span>{boardBg.opacity}%</span></label>
                                <input type="range" min="0" max="100" value={boardBg.opacity} onChange={(e) => setBoardBg({ ...boardBg, opacity: parseInt(e.target.value) })} className="w-full accent-blue-500" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {settingsModal.isOpen && activeTier && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeSettings}>
                <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b border-gray-800">
                        <h3 className="font-bold text-base sm:text-lg">Tier 行の設定</h3>
                        <button onClick={closeSettings} className="text-gray-400 hover:text-white"><X size={20} /></button>
                    </div>
                    <div className="p-4 space-y-4 text-sm">
                        <div>
                            <label className="block text-gray-400 mb-1">ラベルテキスト</label>
                            <input type="text" value={activeTier.label} onChange={(e) => updateTier(activeTier.id, { label: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">背景色</label>
                            <div className="flex gap-2 items-center">
                                <input type="color" value={activeTier.color} onChange={(e) => updateTier(activeTier.id, { color: e.target.value })} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
                                <input type="text" value={activeTier.color} onChange={(e) => updateTier(activeTier.id, { color: e.target.value })} className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 uppercase" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">位置の移動</label>
                            <div className="flex gap-2">
                                <button onClick={() => moveTier(activeTierIndex, -1)} disabled={activeTierIndex === 0} className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 rounded"><ArrowUp size={16} /> 上へ</button>
                                <button onClick={() => moveTier(activeTierIndex, 1)} disabled={activeTierIndex === tiers.length - 1} className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 rounded"><ArrowDown size={16} /> 下へ</button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-950/50 border-t border-gray-800 flex gap-2">
                        <button onClick={() => clearTier(activeTier.id)} className="flex-1 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded text-sm">画像を空にする</button>
                        <button onClick={() => deleteTier(activeTier.id)} className="flex-1 py-2 flex items-center justify-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded text-sm font-medium"><Trash2 size={16} /> 行を削除</button>
                    </div>
                </div>
            </div>
        )}

        {confirmModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 sm:p-6 max-w-sm w-full">
                    <h3 className="text-base sm:text-lg font-bold mb-4">{confirmModal.message}</h3>
                    <div className="flex gap-2 sm:gap-3 justify-end mt-4 sm:mt-6">
                        <button onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })} className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-400 hover:text-white">キャンセル</button>
                        <button onClick={confirmModal.onConfirm} className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 hover:bg-blue-500 text-white rounded font-medium">実行する</button>
                    </div>
                </div>
            </div>
        )}

        {alertModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 sm:p-6 max-w-sm w-full">
                    <div className="flex items-center gap-2 sm:gap-3 mb-4 text-blue-400">
                        <AlertCircle size={20} className="sm:w-6 sm:h-6" />
                        <h3 className="text-base sm:text-lg font-bold text-white">お知らせ</h3>
                    </div>
                    <p className="text-sm sm:text-base text-gray-300 mb-5 sm:mb-6">{alertModal.message}</p>
                    <div className="flex justify-end">
                        <button onClick={() => setAlertModal({ isOpen: false, message: '' })} className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded font-medium">閉じる</button>
                    </div>
                </div>
            </div>
        )}

    </div>
);
}