import React, { useState } from "react";
import { 
  Network, 
  Palette, 
  Download, 
  Upload, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Type, 
  Sliders, 
  Layout, 
  SlidersHorizontal,
  Printer,
  FileJson,
  FileText,
  FileCode,
  Image as ImageIcon
} from "lucide-react";
import { 
  AppConfig, 
  LayoutType, 
  ThemeType, 
  SearchState 
} from "../types";

interface ToolbarProps {
  config: AppConfig;
  onUpdateConfig: (updates: Partial<AppConfig>) => void;
  layout: LayoutType;
  onChangeLayout: (newLayout: LayoutType) => void;
  searchState: SearchState;
  onUpdateSearch: (updates: Partial<SearchState>) => void;
  onExport: (format: "pdf" | "png" | "svg" | "json" | "txt" | "html", pdfSettings?: any) => void;
  onImportJSON: (file: File) => void;
  onClearAll: () => void;
}

export default function Toolbar({
  config,
  onUpdateConfig,
  layout,
  onChangeLayout,
  searchState,
  onUpdateSearch,
  onExport,
  onImportJSON,
  onClearAll,
}: ToolbarProps) {
  const [showConfigDropdown, setShowConfigDropdown] = useState<boolean>(false);
  const [showExportDropdown, setShowExportDropdown] = useState<boolean>(false);
  
  // Custom PDF print settings popup state
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [pdfSize, setPdfSize] = useState<"a4" | "a3">("a4");
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">("landscape");
  const [pdfMargins, setPdfMargins] = useState<number>(10);
  const [pdfScale, setPdfScale] = useState<number>(100);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSearch({ query: e.target.value, currentIndex: 0 });
  };

  const handlePrevResult = () => {
    if (searchState.results.length === 0) return;
    const nextIdx = (searchState.currentIndex - 1 + searchState.results.length) % searchState.results.length;
    onUpdateSearch({ currentIndex: nextIdx });
  };

  const handleNextResult = () => {
    if (searchState.results.length === 0) return;
    const nextIdx = (searchState.currentIndex + 1) % searchState.results.length;
    onUpdateSearch({ currentIndex: nextIdx });
  };

  const triggerFileInput = () => {
    const input = document.getElementById("import-mmap-file-input") as HTMLInputElement;
    if (input) input.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportJSON(e.target.files[0]);
    }
  };

  return (
    <div className="border-b-2 border-charcoal dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 z-20 shadow-none" id="toolbar-root">
      
      {/* Brand & File Operations */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-charcoal dark:bg-white rounded-none flex items-center justify-center text-white dark:text-charcoal font-bold text-xs select-none">
            M
          </div>
          <div className="leading-none">
            <h1 className="text-sm font-bold text-charcoal dark:text-slate-100 tracking-tighter uppercase font-serif">MAPPA.LAB</h1>
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 select-none font-bold">
              <span className="w-1 h-1 bg-emerald-500 rounded-full inline-block" />
              OFFLINE PWA
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-charcoal-muted dark:bg-slate-800 mx-2 hidden md:block" />

        {/* Import/Export Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={triggerFileInput}
            className="px-2.5 py-1.5 text-charcoal dark:text-slate-300 bg-white dark:bg-slate-900 border border-charcoal dark:border-slate-700 rounded-none text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 shadow-[2px_2px_0px_rgba(26,26,26,1)] dark:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(26,26,26,1)] transition-all cursor-pointer"
            title="Importar Arquivo (.mmap ou .json)"
            id="import-map-btn"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden lg:inline">Abrir (.mmap)</span>
          </button>
          <input
            type="file"
            id="import-mmap-file-input"
            accept=".mmap,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="px-2.5 py-1.5 text-charcoal dark:text-slate-300 bg-white dark:bg-slate-900 border border-charcoal dark:border-slate-700 rounded-none text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 shadow-[2px_2px_0px_rgba(26,26,26,1)] dark:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(26,26,26,1)] transition-all cursor-pointer"
              title="Exportar Mapa"
              id="export-map-btn"
            >
              <Download className="w-3 h-3" />
              <span>Exportar</span>
            </button>

            {showExportDropdown && (
              <div className="absolute left-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border-2 border-charcoal dark:border-slate-700 rounded-none shadow-[4px_4px_0px_rgba(26,26,26,0.15)] p-1 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1" id="export-dropdown-menu">
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    onExport("json");
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-[10px] font-mono font-bold uppercase tracking-wide text-charcoal dark:text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-600" />
                  <span>Salvar mmap (JSON)</span>
                </button>
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    onExport("png");
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-[10px] font-mono font-bold uppercase tracking-wide text-charcoal dark:text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Imagem (PNG)</span>
                </button>
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    onExport("svg");
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-[10px] font-mono font-bold uppercase tracking-wide text-charcoal dark:text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-orange-600" />
                  <span>Vetor (SVG)</span>
                </button>
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    onExport("txt");
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-[10px] font-mono font-bold uppercase tracking-wide text-charcoal dark:text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Texto Plano (TXT)</span>
                </button>
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    onExport("html");
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-[10px] font-mono font-bold uppercase tracking-wide text-charcoal dark:text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pagina Web (HTML)</span>
                </button>
                <div className="h-px bg-charcoal-muted dark:bg-slate-800 my-1" />
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    setShowPdfModal(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-[10px] font-mono font-bold uppercase tracking-wide text-charcoal dark:text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-red-600" />
                  <span>Imprimir PDF...</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Interactive Search */}
      <div className="flex items-center gap-1 w-full sm:w-auto max-w-sm flex-1 sm:justify-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchState.query}
            onChange={handleSearchChange}
            placeholder="PESQUISAR NÓ..."
            className="w-full text-[10px] font-mono uppercase tracking-wide pl-8 pr-20 py-2 bg-white dark:bg-slate-900 border border-charcoal dark:border-slate-700 rounded-none focus:outline-none focus:ring-0 dark:text-slate-100 placeholder:text-charcoal/40"
            id="toolbar-search-input"
          />
          <Search className="w-3 h-3 text-charcoal/60 dark:text-slate-400 absolute left-2.5 top-3" />
          
          {searchState.query && (
            <span className="text-[10px] text-charcoal font-mono absolute right-2.5 top-2.5 select-none bg-paper-dark dark:bg-slate-800 px-1.5 py-0.5 rounded-none border border-charcoal dark:border-slate-700 font-bold">
              {searchState.results.length > 0 ? `${searchState.currentIndex + 1}/${searchState.results.length}` : "0"}
            </span>
          )}
        </div>

        {searchState.results.length > 0 && (
          <div className="flex gap-0.5">
            <button
              onClick={handlePrevResult}
              className="p-1.5 bg-white dark:bg-slate-900 border border-charcoal dark:border-slate-700 rounded-none hover:bg-paper-dark dark:hover:bg-slate-800 text-charcoal dark:text-slate-300 transition shadow-[2px_2px_0px_rgba(26,26,26,1)] dark:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(26,26,26,1)]"
              title="Anterior"
              id="search-prev-btn"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextResult}
              className="p-1.5 bg-white dark:bg-slate-900 border border-charcoal dark:border-slate-700 rounded-none hover:bg-paper-dark dark:hover:bg-slate-800 text-charcoal dark:text-slate-300 transition shadow-[2px_2px_0px_rgba(26,26,26,1)] dark:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(26,26,26,1)]"
              title="Próximo"
              id="search-next-btn"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Map Layout & Config Controls */}
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        {/* Layout Select */}
        <div className="flex items-center gap-1 bg-paper-dark dark:bg-slate-900 p-1 border border-charcoal dark:border-slate-700 rounded-none">
          {[
            { id: "horizontal", label: "Horizontal", title: "Árvore Horizontal" },
            { id: "vertical", label: "Vertical", title: "Árvore Vertical" },
            { id: "radial", label: "Radial", title: "Mapa Radial" },
            { id: "organogram", label: "Org", title: "Organograma" },
            { id: "organic", label: "Orgânico", title: "Estrutura Orgânica" },
            { id: "flowchart", label: "Fluxo", title: "Fluxograma" }
          ].map(lay => (
            <button
              key={lay.id}
              onClick={() => onChangeLayout(lay.id as LayoutType)}
              className={`px-2 py-1 text-[9px] font-bold font-mono uppercase tracking-wider rounded-none transition cursor-pointer ${layout === lay.id ? "bg-charcoal text-white dark:bg-white dark:text-charcoal" : "text-charcoal/60 dark:text-slate-400 hover:text-charcoal dark:hover:text-white"}`}
              title={lay.title}
            >
              {lay.label}
            </button>
          ))}
        </div>

        {/* Configurations Toggle Drawer */}
        <div className="relative">
          <button
            onClick={() => setShowConfigDropdown(!showConfigDropdown)}
            className={`px-2.5 py-1.5 border border-charcoal dark:border-slate-700 rounded-none flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-wider transition cursor-pointer ${showConfigDropdown ? "bg-charcoal text-white dark:bg-white dark:text-charcoal" : "bg-white dark:bg-slate-900 text-charcoal dark:text-slate-300 hover:bg-paper-dark shadow-[2px_2px_0px_rgba(26,26,26,1)] dark:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(26,26,26,1)]"}`}
            title="Ajustar Temas e Estilo Visual"
            id="styling-config-toggle-btn"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden xl:inline">Estilo</span>
          </button>

          {showConfigDropdown && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border-2 border-charcoal dark:border-slate-700 rounded-none shadow-[6px_6px_0px_rgba(0,0,0,0.15)] p-4 z-50 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1" id="styling-dropdown-panel">
              <h2 className="text-[11px] font-bold border-b border-charcoal dark:border-slate-800 pb-1.5 text-charcoal dark:text-slate-200 font-mono uppercase tracking-wider">Preferências do Mapa</h2>
              
              {/* Theme selection */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Tema Visual</span>
                <div className="grid grid-cols-3 gap-1 bg-[#EFECE6] dark:bg-slate-800 p-0.5 rounded-full border border-[#D1D1CF] dark:border-slate-700">
                  {[
                    { id: "light", label: "Claro" },
                    { id: "dark", label: "Escuro" },
                    { id: "high-contrast", label: "Contraste" }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => onUpdateConfig({ theme: t.id as ThemeType })}
                      className={`px-2 py-1 text-[9px] font-bold uppercase rounded-full transition cursor-pointer ${config.theme === t.id ? "bg-white dark:bg-slate-900 text-charcoal dark:text-white shadow-sm" : "text-charcoal/50 dark:text-slate-400 hover:text-charcoal"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Selection */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Fonte do Texto</span>
                <select
                  value={config.fontFamily}
                  onChange={e => onUpdateConfig({ fontFamily: e.target.value })}
                  className="text-[10px] font-mono bg-white dark:bg-slate-850 border border-charcoal dark:border-slate-700 rounded-none p-1.5 text-charcoal dark:text-slate-200 outline-none"
                  id="font-select-input"
                >
                  <option value="Inter, sans-serif">Sans (Inter)</option>
                  <option value="'Space Grotesk', sans-serif">Tech (Space Grotesk)</option>
                  <option value="'JetBrains Mono', monospace">Mono (JetBrains Mono)</option>
                  <option value="Georgia, serif">Editorial (Georgia Serif)</option>
                </select>
              </div>

              {/* Font Size slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Tamanho da Fonte</span>
                  <span className="text-[10px] text-charcoal dark:text-slate-300 font-mono font-bold">{config.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="20"
                  step="1"
                  value={config.fontSize}
                  onChange={e => onUpdateConfig({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-1 bg-charcoal-muted dark:bg-slate-800 rounded-none appearance-none cursor-pointer accent-charcoal dark:accent-white"
                />
              </div>

              {/* Balloon shape */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Formato do Balão</span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "rounded", label: "Arred." },
                    { id: "capsule", label: "Cáps." },
                    { id: "ellipse", label: "Elip." },
                    { id: "rectangle", label: "Retân." }
                  ].map(sh => (
                    <button
                      key={sh.id}
                      onClick={() => onUpdateConfig({ nodeShape: sh.id as any })}
                      className={`px-1 py-1 text-[9px] border font-bold font-mono uppercase tracking-wide rounded-none transition cursor-pointer ${config.nodeShape === sh.id ? "bg-charcoal border-charcoal text-white dark:bg-white dark:border-white dark:text-charcoal" : "bg-white dark:bg-slate-900 border-charcoal-muted dark:border-slate-800 text-charcoal dark:text-slate-300 hover:bg-paper-dark"}`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-charcoal-muted dark:bg-slate-850 my-0.5" />

              {/* Level & sibling spacings */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Espaço Níveis</span>
                  <span className="text-[10px] text-charcoal dark:text-slate-300 font-mono font-bold">{config.levelSpacing}px</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="180"
                  value={config.levelSpacing}
                  onChange={e => onUpdateConfig({ levelSpacing: parseInt(e.target.value) })}
                  className="w-full h-1 bg-charcoal-muted dark:bg-slate-800 rounded-none appearance-none cursor-pointer accent-charcoal dark:accent-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Espaço Irmãos</span>
                  <span className="text-[10px] text-charcoal dark:text-slate-300 font-mono font-bold">{config.siblingSpacing}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={config.siblingSpacing}
                  onChange={e => onUpdateConfig({ siblingSpacing: parseInt(e.target.value) })}
                  className="w-full h-1 bg-charcoal-muted dark:bg-slate-800 rounded-none appearance-none cursor-pointer accent-charcoal dark:accent-white"
                />
              </div>

              {/* Line Thickness */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Espessura Linhas</span>
                  <span className="text-[10px] text-charcoal dark:text-slate-300 font-mono font-bold">{config.lineThickness}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={config.lineThickness}
                  onChange={e => onUpdateConfig({ lineThickness: parseInt(e.target.value) })}
                  className="w-full h-1 bg-charcoal-muted dark:bg-slate-800 rounded-none appearance-none cursor-pointer accent-charcoal dark:accent-white"
                />
              </div>

              <div className="h-px bg-charcoal-muted dark:bg-slate-850 my-1" />

              {/* Reset Map Action */}
              <button
                onClick={() => {
                  if (confirm("Deseja apagar todo o trabalho atual para iniciar um mapa em branco?")) {
                    onClearAll();
                    setShowConfigDropdown(false);
                  }
                }}
                className="w-full py-2 bg-white hover:bg-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-900/40 border border-red-600 rounded-none text-center text-red-600 text-[10px] font-bold font-mono uppercase tracking-wider transition cursor-pointer"
              >
                Limpar Tudo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PDF ADVANCED PRINT OPTIONS MODAL */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="pdf-settings-modal">
          <div className="bg-white dark:bg-slate-900 rounded-none shadow-[8px_8px_0px_rgba(26,26,26,0.15)] border-2 border-charcoal dark:border-slate-700 p-6 max-w-sm w-full animate-in zoom-in-95 duration-150">
            <h3 className="text-xs font-bold text-charcoal dark:text-slate-100 mb-4 flex items-center gap-2 font-mono uppercase tracking-wider border-b border-charcoal-muted dark:border-slate-800 pb-2">
              <Printer className="w-4 h-4 text-charcoal dark:text-white" /> Opções de Impressão (PDF)
            </h3>
            
            <div className="flex flex-col gap-4">
              {/* Size Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-charcoal/50 dark:text-slate-400 font-mono uppercase tracking-wide">Tamanho da Folha</label>
                <div className="grid grid-cols-2 gap-2">
                  {["A4", "A3"].map(sz => (
                    <button
                      key={sz}
                      onClick={() => setPdfSize(sz.toLowerCase() as any)}
                      className={`py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-none border transition cursor-pointer ${pdfSize === sz.toLowerCase() ? "bg-charcoal border-charcoal text-white dark:bg-white dark:border-white dark:text-charcoal" : "bg-white hover:bg-paper-dark dark:bg-slate-850 border-charcoal-muted dark:border-slate-800 text-charcoal dark:text-slate-300"}`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-charcoal/50 dark:text-slate-400 font-mono uppercase tracking-wide">Orientação</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Retrato", "Paisagem"].map((o, idx) => {
                    const id = idx === 0 ? "portrait" : "landscape";
                    return (
                      <button
                        key={id}
                        onClick={() => setPdfOrientation(id as any)}
                        className={`py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-none border transition cursor-pointer ${pdfOrientation === id ? "bg-charcoal border-charcoal text-white dark:bg-white dark:border-white dark:text-charcoal" : "bg-white hover:bg-paper-dark dark:bg-slate-850 border-charcoal-muted dark:border-slate-800 text-charcoal dark:text-slate-300"}`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scale Percentage */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-bold text-charcoal/50 dark:text-slate-400 font-mono uppercase tracking-wide">Escala do Mapa</label>
                  <span className="text-[10px] font-mono font-bold text-charcoal dark:text-slate-300">{pdfScale}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="150"
                  step="10"
                  value={pdfScale}
                  onChange={e => setPdfScale(parseInt(e.target.value))}
                  className="w-full h-1 bg-charcoal-muted dark:bg-slate-800 rounded-none appearance-none cursor-pointer accent-charcoal dark:accent-white"
                />
              </div>

              {/* Margins */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-bold text-charcoal/50 dark:text-slate-400 font-mono uppercase tracking-wide">Margens</label>
                  <span className="text-[10px] font-mono font-bold text-charcoal dark:text-slate-300">{pdfMargins}mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="5"
                  value={pdfMargins}
                  onChange={e => setPdfMargins(parseInt(e.target.value))}
                  className="w-full h-1 bg-charcoal-muted dark:bg-slate-800 rounded-none appearance-none cursor-pointer accent-charcoal dark:accent-white"
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 pt-4 border-t border-charcoal-muted dark:border-slate-800">
              <button
                onClick={() => setShowPdfModal(false)}
                className="flex-1 py-2 bg-white hover:bg-paper-dark dark:bg-slate-800 dark:hover:bg-slate-700 text-charcoal dark:text-slate-300 text-[10px] font-bold font-mono uppercase tracking-wider border border-charcoal dark:border-slate-700 rounded-none transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowPdfModal(false);
                  onExport("pdf", {
                    size: pdfSize,
                    orientation: pdfOrientation,
                    margins: pdfMargins,
                    scale: pdfScale
                  });
                }}
                className="flex-1 py-2 bg-charcoal hover:bg-charcoal/80 text-white dark:bg-white dark:text-charcoal text-[10px] font-bold font-mono uppercase tracking-wider rounded-none shadow-[3px_3px_0px_rgba(26,26,26,0.15)] transition cursor-pointer"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
