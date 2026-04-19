import React, { useState, useEffect, useRef, useMemo } from 'react';
import { loadInitialData, saveEntries, saveDarkMode } from './db';
import { normalizeFormData, validateInvoiceEntry } from './validation';

const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, '').replace(/\/api$/, '');
const EXTRACT_ENDPOINT = API_BASE_URL ? `${API_BASE_URL}/api/extract` : '/api/extract';

export default function App() {
  // 1. Data Management: Load initial state from IndexedDB
  const [entries, setEntries] = useState([]);
  
  const [formData, setFormData] = useState({
    tpinOfSupplier: '',
    nameOfSupplier: '',
    invoiceNumber: '',
    invoiceDate: '',
    descriptionOfSupply: '',
    amountBeforeVat: '',
    vatCharged: ''
  });
  
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMsg, setScanStatusMsg] = useState('');
  const [scanError, setScanError] = useState('');
  const [qrLink, setQrLink] = useState('');
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null); 

  // Search & Preview State
  const [searchTerm, setSearchTerm] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false); 

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);

  // Sorting & Bulk Selection State
  const [sortConfig, setSortConfig] = useState({ key: 'invoiceDate', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Camera Refs and State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraMode, setCameraMode] = useState(null);
  const cameraModeRef = useRef(null);
  
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Load jsQR dynamically for QR Code reading
  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
    return () => stopCamera();
  }, []);

  // Load from DB (and migrate legacy localStorage once)
  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const initialData = await loadInitialData();
        if (!mounted) return;
        setEntries(initialData.entries);
        setIsDarkMode(initialData.isDarkMode);
      } finally {
        if (mounted) setIsDbReady(true);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-Save Data & Dark Mode Settings to DB
  useEffect(() => {
    if (!isDbReady) return;
    saveEntries(entries).catch(() => {});
  }, [entries, isDbReady]);

  useEffect(() => {
    if (!isDbReady) return;
    saveDarkMode(isDarkMode).catch(() => {});
  }, [isDarkMode, isDbReady]);

  // Apply Dark Mode Class to HTML/Body equivalent
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // POWER USER: Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Enter or Cmd+Enter to Save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('save-entry-btn')?.click();
      }
      // Escape to Clear Form
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClearForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      if (torchOn) tracks.forEach(track => track.applyConstraints({ advanced: [{ torch: false }] }).catch(()=>{}));
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraMode(null);
    cameraModeRef.current = null;
    setTorchSupported(false);
    setTorchOn(false);
  };

  const startCamera = async (mode) => {
    setCameraMode(mode);
    cameraModeRef.current = mode; 
    setScanError('');
    setQrLink('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", focusMode: "continuous" } });
      streamRef.current = stream;
      
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.torch) setTorchSupported(true);
      } catch (e) { /* Ignored */ }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        videoRef.current.play();
        if (mode === 'qr') requestAnimationFrame(tick);
      }
    } catch (err) {
      setScanError("Camera access denied or unavailable.");
      setCameraMode(null);
      cameraModeRef.current = null;
    }
  };

  const toggleTorch = async () => {
    if (streamRef.current && torchSupported) {
      const track = streamRef.current.getVideoTracks()[0];
      try {
        await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
        setTorchOn(!torchOn);
      } catch (err) { console.warn("Torch toggle failed", err); }
    }
  };

  const tick = () => {
    if (cameraModeRef.current !== 'qr') return;
    
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      if (window.jsQR) {
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code && code.data) { handleQRResult(code.data); return; }
      }
    }
    if (streamRef.current) requestAnimationFrame(tick);
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Data = canvas.toDataURL("image/jpeg").split(',')[1];
    setPreviewImage(`data:image/jpeg;base64,${base64Data}`);
    stopCamera();
    analyzeDocument(base64Data, "image/jpeg");
  };

  const handleQRResult = (qrText) => {
    stopCamera();
    if (qrText.startsWith('http')) {
      setQrLink(qrText);
      try { window.open(qrText, '_blank'); } catch (err) { /* Blocked */ }
    } else {
      setScanError(`QR code did not contain a valid web link. Data: ${qrText}`);
    }
  };

  const getSupplierNameFromMemory = (tpin) => {
    const pastEntry = entries.find(e => e.tpinOfSupplier === tpin);
    return pastEntry ? pastEntry.nameOfSupplier : '';
  };

  const analyzeDocument = async (base64Data, mimeType) => {
    setIsScanning(true);
    setScanError('');
    setQrLink('');

    // WORLD CLASS FEATURE: Dynamic Progress Messages
    const loadingMsgs = [
      "Optimizing image quality...", 
      "Running AI text extraction...", 
      "Identifying ZRA standard layout...", 
      "Validating TPIN and Amounts..."
    ];
    let msgIndex = 0;
    setScanStatusMsg(loadingMsgs[0]);
    const progressInterval = setInterval(() => {
      msgIndex++;
      if(msgIndex < loadingMsgs.length) setScanStatusMsg(loadingMsgs[msgIndex]);
    }, 1800);

    try {
      const response = await fetch(EXTRACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error('Extraction endpoint not found. Ensure backend is deployed and reachable at /api/extract.');
        }
        throw new Error(payload?.error || `Extraction failed (${response.status})`);
      }

      const result = await response.json();
      const data = result?.data;

      if (data) {
        
        let finalSupplierName = data.nameOfSupplier ? String(data.nameOfSupplier) : formData.nameOfSupplier;
        if (!finalSupplierName && data.tpinOfSupplier) {
           finalSupplierName = getSupplierNameFromMemory(String(data.tpinOfSupplier)) || finalSupplierName;
        }

        const newFormData = normalizeFormData({
          tpinOfSupplier: data.tpinOfSupplier ? String(data.tpinOfSupplier).replace(/\D/g,'') : formData.tpinOfSupplier,
          nameOfSupplier: finalSupplierName,
          invoiceNumber: data.invoiceNumber ? String(data.invoiceNumber) : formData.invoiceNumber,
          invoiceDate: data.invoiceDate ? String(data.invoiceDate) : formData.invoiceDate,
          descriptionOfSupply: data.descriptionOfSupply ? String(data.descriptionOfSupply) : formData.descriptionOfSupply,
          amountBeforeVat: data.amountBeforeVat ? String(data.amountBeforeVat).replace(/[^0-9.]/g, '') : formData.amountBeforeVat,
          vatCharged: data.vatCharged ? String(data.vatCharged).replace(/[^0-9.]/g, '') : formData.vatCharged
        });
        
        setFormData(newFormData);
        
        if (!newFormData.tpinOfSupplier || !newFormData.amountBeforeVat || !newFormData.invoiceDate) {
          showToast('Please manually enter any missing fields.', 'error');
        } else {
          showToast('AI successfully extracted data!', 'success');
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to extract data. Please ensure the document is clear and try again.");
    } finally {
      clearInterval(progressInterval);
      setIsScanning(false);
      setScanStatusMsg('');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'tpinOfSupplier' ? value.replace(/\D/g, '').slice(0, 10) : value;
    setFormData({ ...formData, [name]: nextValue });
    
    if (name === 'tpinOfSupplier') {
      setError('');
      if (nextValue.length === 10 && !formData.nameOfSupplier) {
        const memoryName = getSupplierNameFromMemory(nextValue);
        if (memoryName) {
           setFormData(prev => ({ ...prev, nameOfSupplier: memoryName, tpinOfSupplier: nextValue }));
           showToast('Supplier Auto-filled from Memory', 'success');
        }
      }
    }
  };

  const autoCalculateVat = () => {
    if (formData.amountBeforeVat) {
      const calcVat = (parseFloat(formData.amountBeforeVat) * 0.16).toFixed(2);
      setFormData(prev => ({ ...prev, vatCharged: calcVat }));
      showToast('Calculated 16% VAT', 'success');
    } else {
      showToast('Enter Amount Before VAT first!', 'error');
    }
  };

  const handleAddEntry = (e) => {
    e.preventDefault();
    const validation = validateInvoiceEntry(formData, entries, editId);

    if (!validation.valid) {
      setError(validation.message);
      showToast(validation.message, 'error');
      return;
    }

    const entryPayload = {
      ...validation.data,
      id: editId ?? crypto.randomUUID()
    };

    if (editId !== null) {
      setEntries(prev => prev.map(entry => (entry.id === editId ? entryPayload : entry)));
      showToast('Entry updated successfully', 'success');
    } else {
      setEntries([...entries, entryPayload]);
      showToast('Entry added successfully', 'success');
    }

    handleClearForm();
  };

  const handleClearForm = () => {
    setFormData({ tpinOfSupplier: '', nameOfSupplier: '', invoiceNumber: '', invoiceDate: '', descriptionOfSupply: '', amountBeforeVat: '', vatCharged: '' });
    setError('');
    setEditId(null);
    setPreviewImage(null); 
  };

  const handleEdit = (id) => {
    const target = entries.find((entry) => entry.id === id);
    if (!target) return;
    const { id: _id, ...editable } = target;
    setFormData(editable);
    setEditId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    const updatedEntries = entries.filter((entry) => entry.id !== id);
    setEntries(updatedEntries);
    
    const newSelected = new Set(selectedIds);
    newSelected.delete(id);
    setSelectedIds(newSelected);
    
    showToast('Entry deleted', 'success');
    if (editId === id) handleClearForm();
  };

  const handleScanInvoice = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        if (file.type.startsWith('image/')) setPreviewImage(reader.result);
        else setPreviewImage(null);
        analyzeDocument(base64, file.type);
      };
    } catch (err) {
      setScanError("Failed to read file.");
    } finally {
      e.target.value = ''; 
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedEntries.length && processedEntries.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedEntries.map(e => e.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.size} selected entries?`)) {
      const updatedEntries = entries.filter((entry) => !selectedIds.has(entry.id));
      setEntries(updatedEntries);
      setSelectedIds(new Set());
      showToast(`Deleted ${selectedIds.size} entries`, 'success');
    }
  };

  const downloadCSV = (onlySelected = false) => {
    const listToExport = onlySelected ? entries.filter((entry) => selectedIds.has(entry.id)) : entries;

    if (listToExport.length === 0) {
      showToast("No data to export!", 'error');
      return;
    }
    const headers = ['tpinOfSupplier', 'nameOfSupplier', 'invoiceNumber', 'invoiceDate', 'descriptionOfSupply', 'amountBeforeVat', 'vatCharged'];
    const csvRows = [headers.join(',')];

    listToExport.forEach(entry => {
      const row = [
        entry.tpinOfSupplier, `"${entry.nameOfSupplier}"`, `"${entry.invoiceNumber}"`,
        entry.invoiceDate, `"${entry.descriptionOfSupply}"`, entry.amountBeforeVat, entry.vatCharged
      ];
      csvRows.push(row.join(','));
    });

    const csvData = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const csvUrl = URL.createObjectURL(csvData);
    const link = document.createElement('a');
    link.href = csvUrl;
    link.download = `ZRA_Upload_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${listToExport.length} entries successfully!`, 'success');
  };

  // Process data for table
  const processedEntries = useMemo(() => {
    let result = [...entries];
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.nameOfSupplier.toLowerCase().includes(lowerSearch) ||
        e.tpinOfSupplier.includes(lowerSearch) ||
        e.invoiceNumber.toLowerCase().includes(lowerSearch)
      );
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'amountBeforeVat' || sortConfig.key === 'vatCharged') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [entries, searchTerm, sortConfig]);

  // Analytics & Dashboard Calculations
  const dashboardStats = useMemo(() => {
    const totalAmt = entries.reduce((sum, e) => sum + (parseFloat(e.amountBeforeVat) || 0), 0);
    const totalVat = entries.reduce((sum, e) => sum + (parseFloat(e.vatCharged) || 0), 0);
    
    // Calculate Top Supplier and their share
    const counts = entries.reduce((acc, e) => {
       acc[e.nameOfSupplier] = (acc[e.nameOfSupplier] || 0) + (parseFloat(e.amountBeforeVat) || 0);
       return acc;
    }, {});
    
    let topSupplier = "None Yet";
    let maxVolume = 0;
    for (const [name, vol] of Object.entries(counts)) {
       if (vol > maxVolume) { maxVolume = vol; topSupplier = name; }
    }
    const topSupplierShare = totalAmt > 0 ? ((maxVolume / totalAmt) * 100).toFixed(0) : 0;

    return { totalAmt, totalVat, topSupplier, topSupplierShare, count: entries.length };
  }, [entries]);

  const viewTotalAmount = processedEntries.reduce((sum, e) => sum + (parseFloat(e.amountBeforeVat) || 0), 0);
  const viewTotalVat = processedEntries.reduce((sum, e) => sum + (parseFloat(e.vatCharged) || 0), 0);

  // WORLD CLASS FEATURE: Dynamic Real-time Calculations
  const totalInclVat = ((parseFloat(formData.amountBeforeVat) || 0) + (parseFloat(formData.vatCharged) || 0)).toFixed(2);
  const isVatDiscrepant = formData.amountBeforeVat && formData.vatCharged && 
                          Math.abs(parseFloat(formData.vatCharged) - (parseFloat(formData.amountBeforeVat) * 0.16)) > 0.05;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
      <div className="p-4 md:p-8 relative">
        
        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-2xl text-white font-medium transition-all transform duration-300 translate-y-0 opacity-100 ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            <div className="flex items-center gap-2">
              <span>{toast.type === 'error' ? '⚠️' : '✨'}</span>
              {toast.message}
            </div>
          </div>
        )}

        {/* Fullscreen Image Modal */}
        {isImageExpanded && previewImage && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md transition-all">
            <button onClick={() => setIsImageExpanded(false)} className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2 font-bold transition-colors">✕ Close</button>
            <img src={previewImage} alt="Fullscreen Preview" className="max-w-full max-h-[90vh] object-contain rounded-xl border border-gray-700 shadow-2xl" />
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Main Header & Dark Mode Toggle */}
          <div className={`p-6 md:p-8 rounded-2xl shadow-sm border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div>
              <h2 className={`text-2xl md:text-3xl font-extrabold flex items-center gap-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                🇿🇲 ZRA Smart Data Collector
              </h2>
              <p className={`text-sm mt-1.5 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>AI-powered invoice extraction and formatting for ZRA uploads.</p>
            </div>
            
            <div className="flex items-center gap-4">
              {entries.length > 0 && <span className={`text-xs py-1.5 px-3 rounded-full font-bold shadow-sm flex items-center gap-1.5 ${isDarkMode ? 'bg-blue-900/50 text-blue-300 border border-blue-800' : 'bg-blue-100 text-blue-800'}`}>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div> Auto-Saving
              </span>}
              <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-xl transition-all border shadow-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-yellow-400 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`} title="Toggle Dark Mode">
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* DASHBOARD CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { label: "Total Invoices", value: dashboardStats.count, icon: "🧾", accent: "blue" },
               { label: "Total Claimable VAT", value: `ZMW ${dashboardStats.totalVat.toLocaleString('en-US', {minimumFractionDigits: 2})}`, icon: "💰", accent: "green" },
               { label: "Total Amount (Excl)", value: `ZMW ${dashboardStats.totalAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}`, icon: "📊", accent: "purple" },
               { label: "Top Supplier", value: dashboardStats.topSupplier, icon: "🏢", accent: "orange", 
                 subValue: dashboardStats.count > 0 ? `${dashboardStats.topSupplierShare}% of Volume` : 'No data yet' }
             ].map((stat, i) => (
                <div key={i} className={`p-5 rounded-2xl shadow-sm border transition-colors relative overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  {/* Subtle accent line */}
                  <div className={`absolute top-0 left-0 w-full h-1 bg-${stat.accent}-500 opacity-70`}></div>
                  <div className="flex items-center gap-3 mb-2 opacity-80">
                     <span className="text-xl">{stat.icon}</span>
                     <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</h4>
                  </div>
                  <p className={`text-xl sm:text-2xl font-black truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>{stat.value}</p>
                  
                  {/* WORLD CLASS FEATURE: Mini Progress Visual for Top Supplier */}
                  {stat.subValue && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1 font-medium text-gray-400">
                        <span>Share of Spend</span>
                        <span>{stat.subValue}</span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div className={`h-1.5 rounded-full bg-${stat.accent}-500 transition-all duration-1000`} style={{ width: `${dashboardStats.topSupplierShare}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
             ))}
          </div>
            
          {/* Scanner Panel */}
          <div className={`p-6 md:p-8 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3">
              <button type="button" onClick={() => startCamera('photo')} disabled={isScanning || cameraMode} className={`px-5 py-2.5 border rounded-xl shadow-sm text-sm font-bold transition-all transform active:scale-95 ${isScanning || cameraMode ? 'opacity-50 cursor-not-allowed' : isDarkMode ? 'border-blue-700 bg-blue-900/40 text-blue-300 hover:bg-blue-900/60' : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'}`}>
                📸 Take Photo
              </button>

              <label className={`relative cursor-pointer px-5 py-2.5 border rounded-xl shadow-sm text-sm font-bold transition-all transform active:scale-95 ${isScanning || cameraMode ? 'opacity-50 cursor-not-allowed' : isDarkMode ? 'border-purple-700 bg-purple-900/40 text-purple-300 hover:bg-purple-900/60' : 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100'}`}>
                <span>{isScanning ? 'Processing...' : '📁 Upload PDF/Image'}</span>
                <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={handleScanInvoice} disabled={isScanning || cameraMode} />
              </label>

              <button type="button" onClick={() => startCamera('qr')} disabled={isScanning || cameraMode} className={`px-5 py-2.5 border rounded-xl shadow-sm text-sm font-bold transition-all transform active:scale-95 ${isScanning || cameraMode ? 'opacity-50 cursor-not-allowed' : isDarkMode ? 'border-green-700 bg-green-900/40 text-green-300 hover:bg-green-900/60' : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'}`}>
                📷 Scan ZRA QR
              </button>
              
              {isScanning && (
                <div className={`flex items-center gap-3 text-sm font-bold ml-2 py-1 px-4 rounded-full ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {scanStatusMsg}
                </div>
              )}
            </div>
            
            {cameraMode && (
              <div className={`mt-6 relative rounded-2xl overflow-hidden flex flex-col items-center justify-center p-4 shadow-inner aspect-[4/3] w-full max-w-xl mx-auto transition-all ${isDarkMode ? 'bg-black border-2 border-gray-700' : 'bg-black border-2 border-blue-400'}`}>
                <button type="button" onClick={stopCamera} className="absolute top-4 right-4 bg-red-600/90 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-red-700 z-20 shadow-xl text-lg backdrop-blur-md">✕</button>
                {torchSupported && <button type="button" onClick={toggleTorch} className={`absolute top-4 left-4 ${torchOn ? 'bg-yellow-400 text-black' : 'bg-gray-700/80 text-white'} rounded-full w-10 h-10 flex items-center justify-center hover:scale-105 z-20 transition-all shadow-xl text-xl backdrop-blur-md`}>🔦</button>}
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted></video>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <div className="absolute inset-8 border-2 border-dashed border-white/40 rounded-xl pointer-events-none z-10 flex items-center justify-center">
                  {cameraMode === 'qr' && <div className="w-64 h-64 border-4 border-green-500 rounded-xl shadow-[0_0_0_4000px_rgba(0,0,0,0.6)] transition-all"></div>}
                </div>
                <div className="absolute bottom-6 z-20 w-full flex justify-center">
                  {cameraMode === 'qr' ? (
                    <p className="bg-black/70 text-white text-sm px-6 py-3 rounded-full animate-pulse tracking-widest shadow-2xl font-bold backdrop-blur-md">ALIGN QR CODE IN BOX</p>
                  ) : (
                    <button type="button" onClick={takePhoto} className="bg-white text-black px-10 py-4 rounded-full font-black shadow-2xl hover:bg-gray-100 active:scale-95 border-4 border-gray-300 text-lg transition-transform">📸 SNAP PHOTO</button>
                  )}
                </div>
              </div>
            )}
            
            {qrLink && (
              <div className={`mt-6 p-5 border rounded-xl shadow-sm ${isDarkMode ? 'bg-emerald-900/20 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">✅</span>
                  <p className="font-bold text-lg">QR Scanned Successfully!</p>
                </div>
                <p className="text-sm mb-4 opacity-90">If the digital receipt didn't open automatically, click the button below:</p>
                <a href={qrLink} target="_blank" rel="noopener noreferrer" className={`inline-block px-6 py-2.5 rounded-lg font-bold shadow-sm transition-transform active:scale-95 ${isDarkMode ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>🔗 Open ZRA Digital Receipt</a>
              </div>
            )}
            {scanError && <p className={`text-sm mt-4 p-4 rounded-xl border font-bold flex items-center gap-2 ${isDarkMode ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}><span>⚠️</span> {scanError}</p>}
          </div>

          {/* Form & Preview Layout */}
          <div className={`grid grid-cols-1 ${previewImage ? 'lg:grid-cols-12' : ''} gap-6`}>
            
            {/* Expanded Image Preview */}
            {previewImage && (
              <div className={`lg:col-span-5 p-5 rounded-2xl shadow-sm border flex flex-col transition-colors ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}><span>📄</span> Document Preview</h3>
                  <div className="flex gap-3">
                    <button onClick={() => setIsImageExpanded(true)} className={`text-sm font-bold transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>🔍 Expand</button>
                    <button onClick={() => setPreviewImage(null)} className={`text-sm font-bold transition-colors ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}>✕ Dismiss</button>
                  </div>
                </div>
                <div className={`rounded-xl flex-1 overflow-hidden flex justify-center border cursor-zoom-in min-h-[400px] lg:max-h-[600px] transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-200'}`} onClick={() => setIsImageExpanded(true)}>
                  <img src={previewImage} alt="Scanned Document" className="object-contain w-full h-full hover:scale-105 transition-transform duration-300" />
                </div>
              </div>
            )}

            {/* Main Form */}
            <div className={`${previewImage ? 'lg:col-span-7' : 'w-full'} p-6 md:p-8 rounded-2xl shadow-sm border h-fit transition-colors ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-200 dark:border-gray-700">
                <h3 className={`text-xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <span>✍️</span> Invoice Entry Details
                </h3>
                <div className="flex gap-2">
                  <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600" title="Keyboard Shortcut">Esc to Clear</span>
                  <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600" title="Keyboard Shortcut">Ctrl+Enter to Save</span>
                </div>
              </div>
              
              <form onSubmit={handleAddEntry} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="col-span-1">
                    <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>TPIN of Supplier (10 digits)*</label>
                    <input type="text" name="tpinOfSupplier" value={formData.tpinOfSupplier} onChange={handleChange} required className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors font-mono ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="e.g. 1000000000" />
                    {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
                  </div>

                  <div className="col-span-1">
                    <label className={`block text-sm font-bold mb-1.5 flex justify-between ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Name of Supplier* <span className="text-xs text-blue-500 opacity-80">(Auto-fills if known)</span>
                    </label>
                    <input type="text" name="nameOfSupplier" value={formData.nameOfSupplier} onChange={handleChange} required className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Acme Corp" />
                  </div>

                  <div className="col-span-1">
                    <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Invoice Number*</label>
                    <input type="text" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} required className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="INV-2023-001" />
                  </div>

                  <div className="col-span-1">
                    <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Invoice Date*</label>
                    <input type="date" name="invoiceDate" max={new Date().toISOString().split('T')[0]} value={formData.invoiceDate} onChange={handleChange} required className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Description of Supply*</label>
                    <input type="text" name="descriptionOfSupply" value={formData.descriptionOfSupply} onChange={handleChange} required className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="e.g. Office Supplies" />
                  </div>

                  <div className="col-span-1">
                    <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Amount Before VAT (ZMW)*</label>
                    <input type="number" step="0.01" name="amountBeforeVat" value={formData.amountBeforeVat} onChange={handleChange} required className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-lg transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="0.00" />
                  </div>

                  <div className="col-span-1 relative">
                    <div className="flex justify-between items-end mb-1.5">
                      <label className={`block text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>VAT Charged (ZMW)*</label>
                      <button type="button" onClick={autoCalculateVat} className={`text-xs font-bold flex items-center px-2 py-1 rounded transition-colors ${isDarkMode ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-900/80' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>🪄 Calc 16%</button>
                    </div>
                    <input type="number" step="0.01" name="vatCharged" value={formData.vatCharged} onChange={handleChange} required className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-lg transition-colors ${isVatDiscrepant ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="0.00" />
                    
                    {/* WORLD CLASS FEATURE: Live VAT Auditor */}
                    {isVatDiscrepant && (
                      <p className="text-yellow-600 dark:text-yellow-500 text-xs mt-1.5 font-bold flex items-center gap-1">
                        <span>⚠️</span> Warning: VAT is not exactly 16%
                      </p>
                    )}
                  </div>

                  {/* WORLD CLASS FEATURE: Total Auto-Calculation Readonly Field */}
                  <div className="col-span-1 sm:col-span-2">
                    <div className={`w-full px-4 py-3 border rounded-xl flex justify-between items-center ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                       <span className={`text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Amount (Incl. VAT)</span>
                       <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>ZMW {totalInclVat}</span>
                    </div>
                  </div>

                </div>

                <div className={`pt-6 flex flex-wrap gap-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                  {/* ID added for keyboard shortcut targeting */}
                  <button id="save-entry-btn" type="submit" className={`px-8 py-3 text-white font-bold rounded-xl shadow-md focus:ring-4 focus:ring-blue-200 transition-all transform active:scale-95 ${editId !== null ? (isDarkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-500 hover:bg-orange-600') : (isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700')}`}>
                    {editId !== null ? '💾 Save Update' : '+ Add to List'}
                  </button>
                  <button type="button" onClick={handleClearForm} className={`px-6 py-3 font-bold rounded-xl transition-all ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    Clear Form
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* TABLE SECTION */}
          <div className={`p-6 md:p-8 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h3 className={`text-xl font-bold flex items-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Collected Invoices 
                  <span className={`ml-3 py-0.5 px-3 rounded-full text-sm border shadow-inner font-black ${isDarkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{entries.length}</span>
                </h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {selectedIds.size > 0 && (
                  <div className="flex gap-2 animate-fade-in">
                     <button onClick={() => downloadCSV(true)} className={`px-4 py-2 text-sm font-bold rounded-lg shadow-sm transition-transform active:scale-95 ${isDarkMode ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                       Export Selected ({selectedIds.size})
                     </button>
                     <button onClick={handleBulkDelete} className={`px-4 py-2 text-sm font-bold rounded-lg shadow-sm transition-transform active:scale-95 ${isDarkMode ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                       Delete Selected
                     </button>
                  </div>
                )}
                
                <div className="relative w-full md:w-56 lg:w-72">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">🔍</span>
                  <input type="text" placeholder="Search invoices..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900 focus:bg-white'}`} />
                </div>

                <button onClick={() => downloadCSV(false)} disabled={entries.length === 0} className={`px-5 py-2.5 text-sm font-bold rounded-xl shadow-sm transition-transform active:scale-95 w-full md:w-auto ${entries.length === 0 ? 'opacity-50 cursor-not-allowed' : isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}>
                  ⬇ Export All CSV
                </button>
              </div>
            </div>

            {entries.length > 0 ? (
              <div className={`overflow-x-auto rounded-xl border shadow-sm ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`text-xs uppercase tracking-wider border-b cursor-pointer select-none ${isDarkMode ? 'bg-gray-900 text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      <th className="px-4 py-4 w-10 text-center">
                        <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === processedEntries.length && processedEntries.length > 0} className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      </th>
                      <th className="px-4 py-4 font-bold hover:text-blue-500 transition-colors" onClick={() => handleSort('tpinOfSupplier')}>TPIN {sortConfig.key === 'tpinOfSupplier' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}</th>
                      <th className="px-4 py-4 font-bold hover:text-blue-500 transition-colors" onClick={() => handleSort('nameOfSupplier')}>Supplier {sortConfig.key === 'nameOfSupplier' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}</th>
                      <th className="px-4 py-4 font-bold hover:text-blue-500 transition-colors" onClick={() => handleSort('invoiceNumber')}>Invoice # {sortConfig.key === 'invoiceNumber' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}</th>
                      <th className="px-4 py-4 font-bold hover:text-blue-500 transition-colors" onClick={() => handleSort('invoiceDate')}>Date {sortConfig.key === 'invoiceDate' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}</th>
                      <th className="px-4 py-4 font-bold text-right hover:text-blue-500 transition-colors" onClick={() => handleSort('amountBeforeVat')}>Amount {sortConfig.key === 'amountBeforeVat' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}</th>
                      <th className="px-4 py-4 font-bold text-right hover:text-blue-500 transition-colors" onClick={() => handleSort('vatCharged')}>VAT {sortConfig.key === 'vatCharged' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}</th>
                      <th className="px-4 py-4 font-bold text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    {processedEntries.length > 0 ? (
                      processedEntries.map((entry) => {
                        const isSelected = selectedIds.has(entry.id);
                        const isEditing = editId === entry.id;
                        return (
                          <tr key={entry.id} className={`transition-colors ${isEditing ? (isDarkMode ? 'bg-orange-900/30' : 'bg-orange-50') : isSelected ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50') : (isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')}`}>
                            <td className="px-4 py-3 text-center">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelectOne(entry.id)} className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            </td>
                            <td className={`px-4 py-3 text-sm whitespace-nowrap font-mono font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{entry.tpinOfSupplier}</td>
                            <td className={`px-4 py-3 text-sm font-bold truncate max-w-[150px] ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{entry.nameOfSupplier}</td>
                            <td className={`px-4 py-3 text-sm whitespace-nowrap font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{entry.invoiceNumber}</td>
                            <td className={`px-4 py-3 text-sm whitespace-nowrap font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{entry.invoiceDate}</td>
                            <td className={`px-4 py-3 text-sm font-mono text-right whitespace-nowrap ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{parseFloat(entry.amountBeforeVat).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className={`px-4 py-3 text-sm font-mono text-right whitespace-nowrap ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{parseFloat(entry.vatCharged).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                              <button onClick={() => handleEdit(entry.id)} className={`mx-1 p-1.5 rounded-lg transition-transform active:scale-90 ${isDarkMode ? 'text-blue-400 hover:bg-blue-900/50' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`} title="Edit">✏️</button>
                              <button onClick={() => handleDelete(entry.id)} className={`mx-1 p-1.5 rounded-lg transition-transform active:scale-90 ${isDarkMode ? 'text-red-400 hover:bg-red-900/50' : 'text-red-600 bg-red-50 hover:bg-red-100'}`} title="Delete">🗑️</button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan="8" className={`text-center py-8 text-sm font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No entries match your search.</td></tr>
                    )}
                  </tbody>
                  <tfoot className={`font-black border-t-2 text-sm ${isDarkMode ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800'}`}>
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-right">GRAND TOTAL (Filtered):</td>
                      <td className="px-4 py-4 text-right font-mono text-base">{viewTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className={`px-4 py-4 text-right font-mono text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{viewTotalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className={`text-center py-20 rounded-2xl border-2 border-dashed ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-5xl mb-4 opacity-50 filter drop-shadow-sm">🧾</div>
                <p className={`font-bold text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No invoices collected yet.</p>
                <p className={`text-sm mt-1 font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Scan a QR code or upload an image to start extracting data magically.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
