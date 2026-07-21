import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
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
  AlertTriangle
} from 'lucide-react';

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
    </motion.div>
  );
}
