import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  FileText, 
  Check, 
  GitBranch, 
  GitCommit, 
  History, 
  Terminal, 
  ArrowRight, 
  Shield, 
  Globe, 
  RefreshCw, 
  FileCode, 
  X, 
  ChevronRight, 
  Info, 
  Copy,
  User,
  ShieldAlert,
  AlertTriangle,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Filter,
  Layers,
  FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface BlacklistFile {
  name: string;
  size: number;
  lines: number;
  totalLines: number;
  updatedAt: string;
}

interface RepositoryTabProps {
  instansiList: string[];
}

// Custom mock commits to make it feel extremely realistic
const MOCK_COMMITS: Record<string, { author: string; hash: string; msg: string; date: string }> = {
  "List-IP-Blacklist.txt": {
    author: "Fadil (SOC Analyst)",
    hash: "6e2a89c",
    msg: "Update List-IP-Blacklist.txt with malicious IPs from ticket SOC-20260721-0094",
    date: "2026-07-21 07:39 WIB"
  },
  "List-IP-Whitelist.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "a4f10dd",
    msg: "Add new local subnets and internal gateway ranges",
    date: "2026-07-20 14:15 WIB"
  },
  "List-Domain-Blacklist.txt": {
    author: "Bayu (SOC Lead)",
    hash: "ff901b5",
    msg: "Block malicious domains identified from threat feed",
    date: "2026-07-21 08:12 WIB"
  },
  "List-Domain-Ads-Blacklist.txt": {
    author: "System Bot",
    hash: "401ad89",
    msg: "Cron Update: Sync telemetry and ad blocker listings",
    date: "2026-07-19 03:00 WIB"
  },
  "List-Domain-Whitelist-General.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "dc7721a",
    msg: "Approve trusted government domains for whitelist",
    date: "2026-07-18 11:24 WIB"
  },
  "List-Domain-Whitelist-Wifi.txt": {
    author: "Bayu (SOC Lead)",
    hash: "88ea9b3",
    msg: "Allow high-bandwidth music and video streaming on Wi-Fi",
    date: "2026-07-17 16:45 WIB"
  },
  "List-URL-Filtering.txt": {
    author: "Fadil (SOC Analyst)",
    hash: "c299e5a",
    msg: "Block known path exploits and phpinfo exposure endpoints",
    date: "2026-07-21 07:49 WIB"
  },
  "List-URL-Whitelist-General.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "3e102f4",
    msg: "Add standard application health and landing paths",
    date: "2026-07-15 09:12 WIB"
  },
  "List-URL-Whitelist-Wifi.txt": {
    author: "Bayu (SOC Lead)",
    hash: "740adff",
    msg: "Allow local captive portal and asset pathings",
    date: "2026-07-15 10:00 WIB"
  },
  "AutomationBlacklistSOC.txt": {
    author: "SOC Automator",
    hash: "da99281",
    msg: "Auto-Block: Detect active brute-force attacker IP",
    date: "2026-07-21 06:15 WIB"
  },
  "WebHook-Test.txt": {
    author: "Wisnu (Senior Analyst)",
    hash: "b0193cf",
    msg: "Configure Discord alerting integration",
    date: "2026-07-20 18:22 WIB"
  }
};

export default function RepositoryTab({ instansiList }: RepositoryTabProps) {
  const [selectedInstansi, setSelectedInstansi] = useState<string>('medika');
  const [files, setFiles] = useState<BlacklistFile[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('List-IP-Blacklist.txt');
  const [loading, setLoading] = useState<boolean>(false);
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  
  // File Content State
  const [fileContent, setFileContent] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [isEditingRaw, setIsEditingRaw] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'code' | 'blame'>('code');

  // Interactive Table States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newEntry, setNewEntry] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [copiedLine, setCopiedLine] = useState<number | null>(null);

  // Excel / CSV / Text Importer States
  interface ParsedIPItem {
    ip: string;
    originalRow: number;
    status: 'new' | 'duplicate_in_file' | 'already_in_repo';
    rawRowData?: Record<string, any>;
  }

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importSourceType, setImportSourceType] = useState<'file' | 'paste'>('file');
  const [importFileName, setImportFileName] = useState<string>('');
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [parsedColumns, setParsedColumns] = useState<string[]>([]);
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<string>('source.ip');
  const [parsedRawRows, setParsedRawRows] = useState<Record<string, any>[]>([]);
  const [parsedIPList, setParsedIPList] = useState<ParsedIPItem[]>([]);
  const [importFilterMode, setImportFilterMode] = useState<'all' | 'new_only' | 'duplicates_only'>('all');
  const [copiedFormattedOutput, setCopiedFormattedOutput] = useState<boolean>(false);
  const [showFormattedOutputPreview, setShowFormattedOutputPreview] = useState<boolean>(false);

  // Fetch file list for selected instansi
  const fetchFiles = async (instansi: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blacklists/${instansi}`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
        // Ensure selected file is still valid or select first
        if (!data.files.some((f: BlacklistFile) => f.name === selectedFilename)) {
          if (data.files.length > 0) {
            setSelectedFilename(data.files[0].name);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch blacklists files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch content for a specific file
  const fetchFileContent = async (instansi: string, filename: string) => {
    setFileLoading(true);
    setIsEditingRaw(false);
    setSearchTerm('');
    setNewEntry('');
    setSaveStatus({ type: null, message: '' });
    try {
      const res = await fetch(`/api/blacklists/${instansi}/${filename}`);
      const data = await res.json();
      if (data.success) {
        setFileContent(data.content);
        setInitialContent(data.content);
      }
    } catch (error) {
      console.error(`Failed to fetch file content for ${filename}:`, error);
    } finally {
      setFileLoading(false);
    }
  };

  // Save/Commit file content to the server
  const saveFileContent = async (contentToSave: string, actionMsg: string = "Updated file") => {
    try {
      const res = await fetch(`/api/blacklists/${selectedInstansi}/${selectedFilename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentToSave })
      });
      const data = await res.json();
      if (data.success) {
        setFileContent(contentToSave);
        setInitialContent(contentToSave);
        setSaveStatus({ type: 'success', message: `${selectedFilename} successfully updated on server!` });
        // Refresh metadata list
        fetchFiles(selectedInstansi);
        setTimeout(() => setSaveStatus({ type: null, message: '' }), 5000);
      } else {
        setSaveStatus({ type: 'error', message: `Failed to save: ${data.error}` });
      }
    } catch (error: any) {
      setSaveStatus({ type: 'error', message: `Server error: ${error.message}` });
    }
  };

  // Trigger loading files on mount and instansi change
  useEffect(() => {
    fetchFiles(selectedInstansi);
  }, [selectedInstansi]);

  // Trigger loading file content when file selection changes
  useEffect(() => {
    if (selectedFilename) {
      fetchFileContent(selectedInstansi, selectedFilename);
    }
  }, [selectedFilename, selectedInstansi]);

  // Parsing individual lines of the file for the interactive view
  const fileLines = useMemo(() => {
    if (!fileContent) return [];
    return fileContent.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      const isComment = trimmed.startsWith('#') || trimmed.startsWith('//');
      const isEmpty = trimmed.length === 0;
      return {
        id: idx + 1,
        text: line,
        trimmed,
        isComment,
        isEmpty
      };
    });
  }, [fileContent]);

  // Clean elements (excluding comments and empty lines) for search and count
  const structuredEntries = useMemo(() => {
    return fileLines.filter(line => !line.isComment && !line.isEmpty);
  }, [fileLines]);

  // Filtered entries for search
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return structuredEntries;
    const lower = searchTerm.toLowerCase();
    return structuredEntries.filter(entry => entry.trimmed.toLowerCase().includes(lower));
  }, [structuredEntries, searchTerm]);

  // Extraction & Auto-Filtering Helper for Excel / CSV / Text
  const extractAndFilterIPs = (rows: Record<string, any>[], columnKey: string) => {
    const items: ParsedIPItem[] = [];
    const seenInFile = new Set<string>();
    const existingInRepo = new Set(structuredEntries.map(e => e.trimmed.toLowerCase()));
    const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/;

    rows.forEach((row, idx) => {
      let rawVal = row[columnKey];
      if (rawVal === undefined || rawVal === null || rawVal === '') {
        const keyMatch = Object.keys(row).find(k => k.trim().toLowerCase() === columnKey.trim().toLowerCase());
        if (keyMatch) rawVal = row[keyMatch];
      }

      if (rawVal !== undefined && rawVal !== null) {
        const valStr = String(rawVal).replace(/["']/g, '').trim();
        const match = valStr.match(ipRegex);
        if (match) {
          const cleanIp = match[0];
          const lowerIp = cleanIp.toLowerCase();

          let status: 'new' | 'duplicate_in_file' | 'already_in_repo' = 'new';
          if (existingInRepo.has(lowerIp)) {
            status = 'already_in_repo';
          } else if (seenInFile.has(lowerIp)) {
            status = 'duplicate_in_file';
          } else {
            seenInFile.add(lowerIp);
          }

          items.push({
            ip: cleanIp,
            originalRow: idx + 2,
            status,
            rawRowData: row
          });
        }
      }
    });

    setParsedIPList(items);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setImportFileName(uploadedFile.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        let cols: string[] = [];
        if (jsonRows.length > 0) {
          cols = Object.keys(jsonRows[0]);
        } else {
          cols = ['source.ip'];
        }

        setParsedColumns(cols);
        setParsedRawRows(jsonRows);

        const preferredCols = ['source.ip', 'source_ip', 'src_ip', 'source ip', 'src ip', 'ip', 'source', 'sourceip'];
        const autoCol = cols.find(c => preferredCols.includes(c.trim().toLowerCase())) || cols[0] || 'source.ip';

        setSelectedTargetColumn(autoCol);
        extractAndFilterIPs(jsonRows, autoCol);
      } catch (err: any) {
        console.error("Failed to parse file:", err);
        setSaveStatus({ type: 'error', message: `Failed to parse file: ${err.message}` });
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleTargetColumnChange = (newCol: string) => {
    setSelectedTargetColumn(newCol);
    if (parsedRawRows.length > 0) {
      extractAndFilterIPs(parsedRawRows, newCol);
    }
  };

  const handlePasteTextChange = (text: string) => {
    setRawPasteText(text);
    if (!text.trim()) {
      setParsedIPList([]);
      setParsedRawRows([]);
      setParsedColumns([]);
      return;
    }

    if (text.includes(',') || text.includes('source.ip') || text.includes('\t')) {
      try {
        const workbook = XLSX.read(text, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonRows.length > 0) {
          const cols = Object.keys(jsonRows[0]);
          setParsedColumns(cols);
          setParsedRawRows(jsonRows);

          const preferredCols = ['source.ip', 'source_ip', 'src_ip', 'source ip', 'src ip', 'ip', 'source', 'sourceip'];
          const autoCol = cols.find(c => preferredCols.includes(c.trim().toLowerCase())) || cols[0] || 'source.ip';

          setSelectedTargetColumn(autoCol);
          extractAndFilterIPs(jsonRows, autoCol);
          return;
        }
      } catch (e) {
        // ignore
      }
    }

    const lines = text.split('\n');
    const items: ParsedIPItem[] = [];
    const seenInFile = new Set<string>();
    const existingInRepo = new Set(structuredEntries.map(e => e.trimmed.toLowerCase()));
    const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;

    lines.forEach((line, idx) => {
      const matches = line.match(ipRegex);
      if (matches) {
        matches.forEach(ipMatch => {
          const cleanIp = ipMatch.trim();
          const lowerIp = cleanIp.toLowerCase();

          let status: 'new' | 'duplicate_in_file' | 'already_in_repo' = 'new';
          if (existingInRepo.has(lowerIp)) {
            status = 'already_in_repo';
          } else if (seenInFile.has(lowerIp)) {
            status = 'duplicate_in_file';
          } else {
            seenInFile.add(lowerIp);
          }

          items.push({
            ip: cleanIp,
            originalRow: idx + 1,
            status
          });
        });
      }
    });

    setParsedIPList(items);
  };

  const handleConfirmImport = () => {
    const newIPs = parsedIPList.filter(i => i.status === 'new').map(i => i.ip);
    if (newIPs.length === 0) return;

    const currentLines = fileContent.split('\n');
    if (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() !== '') {
      currentLines.push('');
    }

    const updatedContent = [...currentLines, ...newIPs].join('\n');
    const duplicatesFiltered = parsedIPList.length - newIPs.length;

    saveFileContent(
      updatedContent,
      `Imported ${newIPs.length} unique IPs from ${importFileName || 'Excel/CSV input'} (${duplicatesFiltered} duplicates auto-filtered)`
    );

    setShowImportModal(false);
    setParsedIPList([]);
    setParsedRawRows([]);
    setRawPasteText('');
    setImportFileName('');
  };

  // Formatted Output computation for New Unique IPs (Source IP, Source Geo Country Name, Destination IP, Destination Port)
  const formattedNewUniqueOutput = useMemo(() => {
    const newItems = parsedIPList.filter(i => i.status === 'new');
    if (newItems.length === 0) return '';

    const getRowVal = (row: Record<string, any> | undefined, candidates: string[], fallback: string = '-') => {
      if (!row) return fallback;
      const keys = Object.keys(row);
      for (const cand of candidates) {
        const candLower = cand.toLowerCase().trim();
        const foundKey = keys.find(k => k.toLowerCase().trim() === candLower);
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
          return String(row[foundKey]).replace(/["']/g, '').trim();
        }
      }
      return fallback;
    };

    const sourceIPs = newItems.map(item => getRowVal(item.rawRowData, ['source.ip', 'source_ip', 'src_ip', 'source ip', 'source', 'ip'], item.ip));
    const sourceCountries = newItems.map(item => getRowVal(item.rawRowData, ['source.geo.country_name', 'source.geo.country_iso_code', 'source_geo_country_name', 'source_country', 'source country', 'country_name', 'country', 'geo', 'source.country'], '-'));
    const destIPs = newItems.map(item => getRowVal(item.rawRowData, ['destination.ip', 'destination_ip', 'dst_ip', 'destination ip', 'destination', 'dest_ip', 'dest ip'], '-'));
    const destPorts = newItems.map(item => getRowVal(item.rawRowData, ['destination.port', 'destination_port', 'dst_port', 'destination port', 'dest_port', 'dest port', 'port'], '-'));

    return `Source IP :\n${sourceIPs.join('\n')}\n\nSoure IP Country : \n${sourceCountries.join('\n')}\n\nDestination IP :\n${destIPs.join('\n')}\n\nDestination Port :\n${destPorts.join('\n')}`;
  }, [parsedIPList]);

  const handleCopyFormattedOutput = () => {
    if (!formattedNewUniqueOutput) return;
    navigator.clipboard.writeText(formattedNewUniqueOutput);
    setCopiedFormattedOutput(true);
    setTimeout(() => setCopiedFormattedOutput(false), 3000);
  };

  // Handle adding an individual entry
  const handleAddEntry = () => {
    const trimmedEntry = newEntry.trim();
    if (!trimmedEntry) return;

    // Check for duplicates
    const isDuplicate = structuredEntries.some(entry => entry.trimmed.toLowerCase() === trimmedEntry.toLowerCase());
    if (isDuplicate) {
      setSaveStatus({ type: 'error', message: `"${trimmedEntry}" already exists in the list!` });
      return;
    }

    const currentLines = fileContent.split('\n');
    // If the last line isn't empty, add a newline
    if (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() !== '') {
      currentLines.push('');
    }
    currentLines.push(trimmedEntry);
    const updatedContent = currentLines.join('\n');

    saveFileContent(updatedContent, `Added entry ${trimmedEntry}`);
    setNewEntry('');
  };

  // Handle deleting an entry
  const handleDeleteEntry = (entryText: string) => {
    const lines = fileContent.split('\n');
    const filteredLines = lines.filter(line => line.trim() !== entryText.trim());
    const updatedContent = filteredLines.join('\n');

    saveFileContent(updatedContent, `Deleted entry ${entryText}`);
  };

  // Copy line to clipboard helper
  const handleCopyLine = (text: string, id: number) => {
    navigator.clipboard.writeText(text.trim());
    setCopiedLine(id);
    setTimeout(() => setCopiedLine(null), 1500);
  };

  // Selected file details
  const currentFileMeta = files.find(f => f.name === selectedFilename);
  const activeCommit = MOCK_COMMITS[selectedFilename] || {
    author: "System Admin",
    hash: "a1b2c3d",
    msg: "Update configuration file",
    date: "2026-07-21 00:00 WIB"
  };

  // Determine file type category to render correct styling
  const isIPFile = selectedFilename.toLowerCase().includes('ip');
  const isDomainFile = selectedFilename.toLowerCase().includes('domain');
  const isURLFile = selectedFilename.toLowerCase().includes('url');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      id="repository-container"
      className="flex flex-col gap-6"
    >
      {/* Top Controller Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            Threat Intelligence & Whitelist Repository
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage cybersecurity blacklists, whitelists, and webhook logs in a fully featured GitHub-like collaborative repo structure.
          </p>
        </div>

        {/* Instansi Selection Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <label htmlFor="instansi-select" className="text-xs font-semibold text-slate-300">Active Instansi:</label>
          <div className="relative">
            <select
              id="instansi-select"
              value={selectedInstansi}
              onChange={(e) => setSelectedInstansi(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold uppercase cursor-pointer"
            >
              {instansiList.map((ins) => (
                <option key={ins} value={ins}>{ins}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
          
          <button 
            onClick={() => fetchFiles(selectedInstansi)}
            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Refresh Repository"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SIDEBAR: File Tree View */}
        <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">Repository Explorer</span>
            </div>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full font-mono font-bold">
              {files.length} Files
            </span>
          </div>

          {/* Repository Branch/Tag indicator */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-900 text-[11px] text-slate-400 font-mono">
            <GitBranch className="h-3 w-3 text-indigo-400 shrink-0" />
            <span className="text-slate-200 font-bold shrink-0">main</span>
            <span className="text-slate-600">|</span>
            <span className="truncate">SOC-{selectedInstansi.toUpperCase()}</span>
          </div>

          {/* Files List tree */}
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[500px] pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                <span className="text-xs text-slate-400">Loading files...</span>
              </div>
            ) : (
              files.map((file) => {
                const isSelected = file.name === selectedFilename;
                const fileIconColor = file.name.includes('Blacklist') 
                  ? 'text-red-400' 
                  : file.name.includes('Whitelist') 
                  ? 'text-emerald-400' 
                  : 'text-indigo-400';

                return (
                  <button
                    key={file.name}
                    id={`file-tree-item-${file.name.replace(/\./g, '-')}`}
                    onClick={() => setSelectedFilename(file.name)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-150 text-left ${
                      isSelected 
                        ? 'bg-indigo-600/15 border border-indigo-500/30 text-white' 
                        : 'hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCode className={`h-4 w-4 shrink-0 ${fileIconColor}`} />
                      <span className="text-xs font-medium truncate font-mono">{file.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                      {file.lines} entries
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* MAIN BODY: GitHub-like Code Viewer & Editor */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Repository Header Details */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
            
            {/* File Path and Header info */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-slate-400">
                <span className="text-slate-300 font-bold hover:underline cursor-pointer">SOC-{selectedInstansi.toUpperCase()}</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400 hover:underline cursor-pointer">database</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400 hover:underline cursor-pointer">blacklists</span>
                <span className="text-slate-600">/</span>
                <span className="text-indigo-400 font-bold font-mono">{selectedFilename}</span>
              </div>

              {/* Action Buttons: RAW download, etc */}
              <div className="flex items-center gap-2">
                {currentFileMeta && (
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3 mr-2">
                    <span>{(currentFileMeta.size / 1024).toFixed(2)} KB</span>
                    <span>•</span>
                    <span>{currentFileMeta.totalLines} lines ({currentFileMeta.lines} active entries)</span>
                  </div>
                )}
                
                {/* Save Alert Messages */}
                {saveStatus.type && (
                  <div className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 animate-fade-in ${
                    saveStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {saveStatus.type === 'success' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {saveStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* Commit bar details (Simulates GitHub Commit info header) */}
            <div className="px-5 py-3.5 bg-slate-900/30 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold font-mono text-[10px] uppercase shrink-0">
                  {activeCommit.author.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-200">{activeCommit.author}</span>
                    <span className="text-slate-400 truncate max-w-md">{activeCommit.msg}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Commit <span className="font-mono text-slate-400">{activeCommit.hash}</span> on {activeCommit.date}</p>
                </div>
              </div>
              <div className="text-[10px] font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-400 shrink-0 self-start sm:self-center">
                Latest Commit: <span className="text-indigo-400">{activeCommit.hash}</span>
              </div>
            </div>

            {/* View Mode Toolbar: Code vs Blame */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/60 border-b border-slate-800">
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  id="tab-view-code"
                  onClick={() => { setViewMode('code'); setIsEditingRaw(false); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'code' 
                      ? 'bg-slate-950 text-white border border-slate-800' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Code
                </button>
                <button
                  id="tab-view-blame"
                  onClick={() => { setViewMode('blame'); setIsEditingRaw(false); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'blame' 
                      ? 'bg-slate-950 text-white border border-slate-800' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Blame
                </button>
              </div>

              {viewMode === 'code' && (
                <button
                  id="toggle-raw-editor"
                  onClick={() => setIsEditingRaw(!isEditingRaw)}
                  className={`text-xs px-3 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors ${
                    isEditingRaw 
                      ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white' 
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <Edit3 className="h-3 w-3" />
                  {isEditingRaw ? "Interactive View" : "Edit Raw File"}
                </button>
              )}
            </div>

            {/* CORE CONTENT VIEWER OR EDITOR */}
            <div className="p-0 font-mono text-xs min-h-[400px] flex flex-col bg-slate-950">
              
              {fileLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className="text-xs text-slate-400">Loading file content...</span>
                </div>
              ) : isEditingRaw ? (
                
                /* 1. RAW TEXT AREA EDITOR */
                <div className="flex flex-col flex-1 p-4 gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 rounded-lg font-sans">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>You are editing the raw file content. Please write one entry per line. Lines starting with # are comments. Duplicate values are ignored in standard parsing.</span>
                  </div>
                  
                  <textarea
                    id="raw-blacklist-textarea"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    className="flex-1 w-full min-h-[400px] bg-slate-950 border border-slate-800 text-slate-200 p-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs leading-relaxed"
                    placeholder="# Comments go here\n45.205.1.222"
                  />

                  <div className="flex items-center justify-end gap-3 pt-2 font-sans">
                    <button
                      id="cancel-raw-edit"
                      onClick={() => { setFileContent(initialContent); setIsEditingRaw(false); }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-all font-semibold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      id="save-raw-edit"
                      onClick={() => { saveFileContent(fileContent, "Updated raw file contents"); setIsEditingRaw(false); }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-bold text-xs flex items-center gap-2 shadow"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Commit Changes
                    </button>
                  </div>
                </div>

              ) : viewMode === 'blame' ? (
                
                /* 2. GIT BLAME VIEW */
                <div className="flex flex-col flex-1 divide-y divide-slate-900 overflow-x-auto">
                  {fileLines.length === 0 ? (
                    <div className="text-slate-500 italic p-10 text-center">Empty File</div>
                  ) : (
                    fileLines.map((line) => {
                      // Dynamically associate line content to mock users for extreme realism
                      let blameUser = "System Admin";
                      let blameHash = "0000000";
                      let blameDate = "2026-07-15";
                      
                      if (line.isComment) {
                        blameUser = "System Admin";
                        blameHash = "1a08cb3";
                        blameDate = "2026-07-15";
                      } else {
                        // Spread lines among Wisnu, Fadil, and Bayu
                        const seed = (line.id * 7) % 3;
                        if (seed === 0) {
                          blameUser = "Fadil";
                          blameHash = activeCommit.hash;
                          blameDate = "2026-07-21";
                        } else if (seed === 1) {
                          blameUser = "Wisnu";
                          blameHash = "a4f10dd";
                          blameDate = "2026-07-20";
                        } else {
                          blameUser = "Bayu";
                          blameHash = "ff901b5";
                          blameDate = "2026-07-21";
                        }
                      }

                      return (
                        <div key={line.id} className="flex items-stretch text-left hover:bg-slate-900/20 font-mono text-[11px] leading-6 min-w-[700px]">
                          {/* Blame Metadata pane */}
                          <div className="w-56 bg-slate-950 border-r border-slate-900 px-3 py-0.5 select-none text-slate-500 flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-600 font-mono tracking-tight">{blameHash}</span>
                            <span className="text-slate-700 shrink-0">•</span>
                            <span className="truncate max-w-[80px] font-bold text-slate-400">{blameUser}</span>
                            <span className="text-slate-700 shrink-0">•</span>
                            <span className="text-[10px] tracking-tight">{blameDate}</span>
                          </div>

                          {/* Line number */}
                          <div className="w-12 border-r border-slate-900 text-right pr-3 select-none text-slate-600 shrink-0 bg-slate-950/20">
                            {line.id}
                          </div>

                          {/* Line content */}
                          <div className={`pl-4 flex-1 whitespace-pre pr-4 ${line.isComment ? 'text-slate-500 italic' : 'text-slate-300'}`}>
                            {line.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              ) : (
                
                /* 3. INTERACTIVE STRUCTURED TABLE (Quick View & Add/Delete) */
                <div className="flex flex-col flex-1 p-5 gap-5 font-sans animate-fade-in">
                  
                  {/* Quick-add and Filter controllers */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/30 p-3.5 rounded-xl border border-slate-800/80">
                    
                    {/* Add form */}
                    <div className="flex-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          id="add-entry-input"
                          type="text"
                          value={newEntry}
                          onChange={(e) => setNewEntry(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
                          placeholder={
                            isIPFile 
                              ? "Add IP address (e.g., 185.120.45.10)..." 
                              : isDomainFile 
                              ? "Add Domain name (e.g., badserver.com)..."
                              : isURLFile
                              ? "Add URL pattern (e.g., /config/db_test.php)..."
                              : "Add new blacklist entry..."
                          }
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3.5 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                        {newEntry && (
                          <button 
                            onClick={() => setNewEntry('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <button
                        id="add-entry-button"
                        onClick={handleAddEntry}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Entry
                      </button>

                      <button
                        id="open-import-excel-modal"
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 font-bold text-xs rounded-lg transition-all flex items-center gap-2 shrink-0 shadow"
                        title="Import IPs from Excel or CSV file"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                        Import Excel / CSV
                      </button>
                    </div>

                    {/* Filter bar */}
                    <div className="md:w-64 relative shrink-0">
                      <input
                        id="search-entry-input"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search entries inside file..."
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  {/* Clean List Table */}
                  <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    
                    {/* Header line count */}
                    <div className="bg-slate-900/40 px-4 py-2.5 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                      <span>Showing <strong className="text-white font-mono">{filteredEntries.length}</strong> of <strong className="text-white font-mono">{structuredEntries.length}</strong> active entries</span>
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-slate-900 max-h-[400px] overflow-y-auto">
                      {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 bg-slate-950 text-slate-500">
                          <Search className="h-8 w-8 text-slate-600 animate-pulse" />
                          <p className="text-xs">No matching entries found inside the file.</p>
                        </div>
                      ) : (
                        filteredEntries.map((line, idx) => {
                          const iconColor = isIPFile 
                            ? 'text-red-400/80 bg-red-500/5' 
                            : isDomainFile 
                            ? 'text-amber-400/80 bg-amber-500/5' 
                            : 'text-indigo-400/80 bg-indigo-500/5';

                          return (
                            <div 
                              key={line.id} 
                              className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[10px] text-slate-600 font-mono w-8 text-right shrink-0">
                                  {idx + 1}
                                </span>
                                
                                {isIPFile && (
                                  <div className={`h-6 w-6 rounded flex items-center justify-center font-mono text-[9px] shrink-0 font-bold ${iconColor}`}>
                                    IP
                                  </div>
                                )}
                                {isDomainFile && (
                                  <div className={`h-6 w-6 rounded flex items-center justify-center font-mono text-[9px] shrink-0 font-bold ${iconColor}`}>
                                    DOM
                                  </div>
                                )}
                                {isURLFile && (
                                  <div className={`h-6 w-6 rounded flex items-center justify-center font-mono text-[9px] shrink-0 font-bold ${iconColor}`}>
                                    URL
                                  </div>
                                )}
                                
                                <span className="text-xs font-mono font-semibold text-slate-200 select-all truncate">
                                  {line.trimmed}
                                </span>
                              </div>

                              {/* Action tools */}
                              <div className="flex items-center gap-2">
                                <button
                                  id={`btn-copy-entry-${line.id}`}
                                  onClick={() => handleCopyLine(line.trimmed, line.id)}
                                  className={`p-1.5 rounded border border-transparent transition-colors ${
                                    copiedLine === line.id 
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                                  }`}
                                  title="Copy to clipboard"
                                >
                                  {copiedLine === line.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </button>
                                
                                <button
                                  id={`btn-delete-entry-${line.id}`}
                                  onClick={() => handleDeleteEntry(line.trimmed)}
                                  className="p-1.5 bg-slate-950 hover:bg-red-950/40 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded transition-all"
                                  title="Delete Entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Excel / CSV Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      Import IP Repository
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Auto Deduplication
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Import Excel (.xlsx), CSV, or text files and auto-filter duplicate IP entries
                    </p>
                  </div>
                </div>
                <button
                  id="close-import-modal"
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                {/* Source Selection Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <button
                    id="tab-import-file"
                    onClick={() => setImportSourceType('file')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      importSourceType === 'file'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <UploadCloud className="h-4 w-4" />
                    Upload Excel / CSV File
                  </button>
                  <button
                    id="tab-import-paste"
                    onClick={() => setImportSourceType('paste')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      importSourceType === 'paste'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    Paste Text / Copy-Paste Data
                  </button>
                </div>

                {/* Source Input Area */}
                {importSourceType === 'file' ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 text-center bg-slate-950/40 transition-colors cursor-pointer relative group">
                      <input
                        id="excel-file-input"
                        type="file"
                        accept=".xlsx, .xls, .csv, .txt"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <UploadCloud className="h-10 w-10 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                        <div>
                          <p className="text-sm font-semibold text-slate-200">
                            {importFileName ? importFileName : 'Click or Drag & Drop Excel / CSV file here'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Supports .xlsx, .xls, .csv, or plain text (.txt)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Target Column Selector if file loaded */}
                    {parsedColumns.length > 0 && (
                      <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/60 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-medium text-slate-300">Target IP Column:</span>
                        </div>
                        <select
                          id="select-target-column"
                          value={selectedTargetColumn}
                          onChange={(e) => handleTargetColumnChange(e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                        >
                          {parsedColumns.map((col, i) => (
                            <option key={i} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Paste CSV content or line-separated IP addresses:
                    </label>
                    <textarea
                      id="input-paste-ip-text"
                      rows={5}
                      value={rawPasteText}
                      onChange={(e) => handlePasteTextChange(e.target.value)}
                      placeholder={`source.ip, destination.ip, description\n192.168.1.1, 10.0.0.1, Gateway\n10.0.0.15, 10.0.0.2, Host A`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                  </div>
                )}

                {/* Parsing Summary & Statistics */}
                {parsedIPList.length > 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Detected</span>
                        <div className="text-lg font-bold text-slate-100 mt-0.5">{parsedIPList.length}</div>
                      </div>
                      <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl text-center flex flex-col items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">New Unique</span>
                          <div className="text-lg font-bold text-emerald-300 mt-0.5">
                            {parsedIPList.filter(i => i.status === 'new').length}
                          </div>
                        </div>
                        {parsedIPList.filter(i => i.status === 'new').length > 0 && (
                          <button
                            id="btn-copy-card-formatted-output"
                            onClick={handleCopyFormattedOutput}
                            className="mt-1 px-2 py-0.5 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/30 rounded-md font-semibold transition-all inline-flex items-center gap-1 shadow"
                            title="Copy formatted Source IP, Country, Dest IP, and Port text"
                          >
                            {copiedFormattedOutput ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy Output
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">File Duplicates</span>
                        <div className="text-lg font-bold text-amber-300 mt-0.5">
                          {parsedIPList.filter(i => i.status === 'duplicate_in_file').length}
                        </div>
                      </div>
                      <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">In Repository</span>
                        <div className="text-lg font-bold text-purple-300 mt-0.5">
                          {parsedIPList.filter(i => i.status === 'already_in_repo').length}
                        </div>
                      </div>
                    </div>

                    {/* Formatted Output Action / Toggle Bar */}
                    <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Copy className="h-4 w-4 text-emerald-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-200">Copy New Unique Formatted Metadata</p>
                          <p className="text-[11px] text-slate-400">Extracts Source IP, Source Country, Destination IP, and Destination Port from Excel</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          id="btn-toggle-formatted-preview"
                          onClick={() => setShowFormattedOutputPreview(!showFormattedOutputPreview)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all"
                        >
                          {showFormattedOutputPreview ? 'Hide Preview' : 'Preview Format'}
                        </button>
                        <button
                          id="btn-copy-formatted-banner"
                          onClick={handleCopyFormattedOutput}
                          disabled={parsedIPList.filter(i => i.status === 'new').length === 0}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow"
                        >
                          {copiedFormattedOutput ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              Copied Format!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy Formatted Output
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Formatted Textarea Preview */}
                    {showFormattedOutputPreview && (
                      <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <Copy className="h-3.5 w-3.5" /> Formatted Text Output (Extracted from Excel)
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {parsedIPList.filter(i => i.status === 'new').length} New Unique Entries
                          </span>
                        </div>
                        <textarea
                          readOnly
                          rows={10}
                          value={formattedNewUniqueOutput}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-emerald-300 font-mono focus:outline-none resize-none custom-scrollbar"
                        />
                      </div>
                    )}

                    {/* Filter Mode Filter Tabs */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          id="btn-filter-import-all"
                          onClick={() => setImportFilterMode('all')}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                            importFilterMode === 'all'
                              ? 'bg-slate-800 text-slate-100 shadow'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          All ({parsedIPList.length})
                        </button>
                        <button
                          id="btn-filter-import-new"
                          onClick={() => setImportFilterMode('new_only')}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                            importFilterMode === 'new_only'
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow'
                              : 'text-slate-400 hover:text-emerald-300'
                          }`}
                        >
                          New Only ({parsedIPList.filter(i => i.status === 'new').length})
                        </button>
                        <button
                          id="btn-filter-import-duplicates"
                          onClick={() => setImportFilterMode('duplicates_only')}
                          className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                            importFilterMode === 'duplicates_only'
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow'
                              : 'text-slate-400 hover:text-amber-300'
                          }`}
                        >
                          Duplicates ({parsedIPList.filter(i => i.status !== 'new').length})
                        </button>
                      </div>

                      <span className="text-[11px] text-slate-400">
                        Showing preview of extracted IPs
                      </span>
                    </div>

                    {/* Preview Table */}
                    <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase text-slate-400 font-bold sticky top-0">
                            <th className="py-2 px-3 w-16">Row</th>
                            <th className="py-2 px-3">IP Address</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                          {parsedIPList
                            .filter(item => {
                              if (importFilterMode === 'new_only') return item.status === 'new';
                              if (importFilterMode === 'duplicates_only') return item.status !== 'new';
                              return true;
                            })
                            .slice(0, 100)
                            .map((item, index) => (
                              <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-2 px-3 text-slate-400">{item.originalRow}</td>
                                <td className="py-2 px-3 font-semibold text-slate-200">{item.ip}</td>
                                <td className="py-2 px-3 font-sans">
                                  {item.status === 'new' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <CheckCircle2 className="h-3 w-3" /> New
                                    </span>
                                  )}
                                  {item.status === 'duplicate_in_file' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Duplicate in File
                                    </span>
                                  )}
                                  {item.status === 'already_in_repo' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                      Already in Repository
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-sans text-[11px] text-slate-400">
                                  {item.status === 'new' ? (
                                    <span className="text-emerald-400 font-medium">Will Import</span>
                                  ) : (
                                    <span className="text-slate-400 line-through">Filtered Out</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-400">
                  {parsedIPList.filter(i => i.status === 'new').length > 0 ? (
                    <span className="text-emerald-400 font-medium">
                      {parsedIPList.filter(i => i.status === 'new').length} unique IPs ready to append to repository
                    </span>
                  ) : (
                    'Select or paste data containing IP addresses'
                  )}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    id="btn-cancel-import"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-confirm-import-ips"
                    onClick={handleConfirmImport}
                    disabled={parsedIPList.filter(i => i.status === 'new').length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2"
                  >
                    <FileCheck className="h-4 w-4" />
                    Import {parsedIPList.filter(i => i.status === 'new').length} New IPs
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
