import React, { useRef, useState, useEffect } from "react";
import { 
  Search, 
  Replace, 
  ChevronDown, 
  ZoomIn, 
  ZoomOut, 
  Undo2, 
  Redo2, 
  Sparkles,
  Smile,
  CheckSquare,
  FileText
} from "lucide-react";

interface EditorPanelProps {
  text: string;
  onChange: (newText: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  activeLineNumber: number | null;
  onSelectLine: (lineNum: number) => void;
}

export default function EditorPanel({
  text,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  activeLineNumber,
  onSelectLine,
}: EditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  
  const [editorZoom, setEditorZoom] = useState<number>(14); // Font size in px
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [replaceQuery, setReplaceQuery] = useState<string>("");
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [currentLine, setCurrentLine] = useState<number>(0);

  const lines = text.split("\n");

  // Sync scrolling between line numbers column and textarea
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Track cursor line number for current line highlight
  const updateCurrentLine = (textarea: HTMLTextAreaElement) => {
    const selStart = textarea.selectionStart;
    const beforeText = textarea.value.substring(0, selStart);
    const lineNum = beforeText.split("\n").length - 1;
    setCurrentLine(lineNum);
    onSelectLine(lineNum);
  };

  const handleKeyUpAndClick = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    updateCurrentLine(e.currentTarget);
  };

  // Scroll to active line when selected from the canvas
  useEffect(() => {
    if (activeLineNumber !== null && textareaRef.current && activeLineNumber !== currentLine) {
      const textarea = textareaRef.current;
      const linesArray = textarea.value.split("\n");
      if (activeLineNumber >= 0 && activeLineNumber < linesArray.length) {
        // Calculate character index
        let charIndex = 0;
        for (let i = 0; i < activeLineNumber; i++) {
          charIndex += linesArray[i].length + 1; // +1 for \n
        }
        textarea.focus();
        textarea.setSelectionRange(charIndex, charIndex + linesArray[activeLineNumber].length);
        setCurrentLine(activeLineNumber);
        
        // Simple scroll helper
        const lineHeight = editorZoom * 1.5; // approximated
        textarea.scrollTop = activeLineNumber * lineHeight - textarea.clientHeight / 2;
      }
    }
  }, [activeLineNumber]);

  // Handle Tab, Shift+Tab, Enter (smart indent), and other outlines operations
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // Handle Tab (Indent) and Shift+Tab (Outdent)
    if (e.key === "Tab") {
      e.preventDefault();

      // Find start and end line boundaries
      const startLinePos = value.lastIndexOf("\n", start - 1) + 1;
      let endLinePos = value.indexOf("\n", end);
      if (endLinePos === -1) endLinePos = value.length;

      const selectedText = value.substring(startLinePos, endLinePos);
      const linesArray = selectedText.split("\n");

      if (e.shiftKey) {
        // Unindent: remove up to 4 spaces or 1 tab
        const updatedLines = linesArray.map(line => {
          if (line.startsWith("\t")) {
            return line.substring(1);
          } else if (line.startsWith("    ")) {
            return line.substring(4);
          } else if (line.startsWith("   ")) {
            return line.substring(3);
          } else if (line.startsWith("  ")) {
            return line.substring(2);
          } else if (line.startsWith(" ")) {
            return line.substring(1);
          }
          return line;
        });

        const newText = value.substring(0, startLinePos) + updatedLines.join("\n") + value.substring(endLinePos);
        onChange(newText);
        
        // Restore cursor selection safely
        const lengthDiff = selectedText.length - updatedLines.join("\n").length;
        setTimeout(() => {
          textarea.setSelectionRange(
            Math.max(startLinePos, start - (linesArray[0].startsWith("\t") || linesArray[0].startsWith(" ") ? 4 : 0)),
            Math.max(startLinePos, end - lengthDiff)
          );
        }, 0);
      } else {
        // Indent: Add 4 spaces
        const updatedLines = linesArray.map(line => "    " + line);
        const newText = value.substring(0, startLinePos) + updatedLines.join("\n") + value.substring(endLinePos);
        onChange(newText);

        setTimeout(() => {
          textarea.setSelectionRange(
            start + 4,
            end + (linesArray.length * 4)
          );
        }, 0);
      }
    }

    // Handle Enter (Auto-preserve indentation of previous line)
    if (e.key === "Enter" && !e.shiftKey) {
      // Ctrl+Enter creates a child node directly (extra tab indent)
      const isCtrlEnter = e.ctrlKey;
      e.preventDefault();

      const lastNewLine = value.lastIndexOf("\n", start - 1);
      const currentLineText = value.substring(lastNewLine + 1, start);
      
      // Match leading spaces or tabs
      const leadingWhitespaceMatch = currentLineText.match(/^([ \t]*)/);
      let indent = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : "";

      if (isCtrlEnter) {
        indent += "    "; // Add extra nesting for child
      }

      const insertion = "\n" + indent;
      const newText = value.substring(0, start) + insertion + value.substring(end);
      onChange(newText);

      const nextCursorPos = start + insertion.length;
      setTimeout(() => {
        textarea.setSelectionRange(nextCursorPos, nextCursorPos);
        setCurrentLine(lines.length);
      }, 0);
    }
  };

  // Find & Replace actions
  const handleFindNext = () => {
    if (!searchQuery) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const val = textarea.value.toLowerCase();
    const query = searchQuery.toLowerCase();
    const start = textarea.selectionEnd;
    
    let index = val.indexOf(query, start);
    if (index === -1) {
      // wrap around
      index = val.indexOf(query);
    }

    if (index !== -1) {
      textarea.focus();
      textarea.setSelectionRange(index, index + query.length);
      
      // Scroll to selection
      const linesBefore = val.substring(0, index).split("\n").length - 1;
      const lineHeight = editorZoom * 1.5;
      textarea.scrollTop = linesBefore * lineHeight - textarea.clientHeight / 2;
      setCurrentLine(linesBefore);
    }
  };

  const handleReplace = () => {
    const textarea = textareaRef.current;
    if (!textarea || !searchQuery) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = textarea.value.substring(start, end);

    if (selection.toLowerCase() === searchQuery.toLowerCase()) {
      const newText = textarea.value.substring(0, start) + replaceQuery + textarea.value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replaceQuery.length);
      }, 0);
    } else {
      // Find one first
      handleFindNext();
    }
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const newText = text.replace(regex, replaceQuery);
    onChange(newText);
  };

  // Convenience quick syntax triggers
  const addSyntax = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selection = value.substring(start, end);
    const newText = value.substring(0, start) + prefix + selection + suffix + value.substring(end);
    onChange(newText);
    textarea.focus();
    setTimeout(() => {
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  return (
    <div className="flex flex-col h-full border-r border-charcoal dark:border-slate-800 bg-paper dark:bg-slate-950" id="editor-panel-root">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-charcoal dark:border-slate-900 bg-paper-dark dark:bg-slate-900/50">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-charcoal/70 dark:text-slate-400" />
          <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-charcoal dark:text-slate-300">Editor de Estrutura</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button 
            onClick={() => setEditorZoom(prev => Math.max(10, prev - 1))}
            className="p-1 text-charcoal/60 hover:text-charcoal dark:text-slate-400 dark:hover:text-slate-100 rounded-none transition cursor-pointer"
            title="Diminuir Zoom do Texto"
            id="editor-zoom-out-btn"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono font-bold px-1 text-charcoal/60 dark:text-slate-400">{editorZoom}px</span>
          <button 
            onClick={() => setEditorZoom(prev => Math.min(24, prev + 1))}
            className="p-1 text-charcoal/60 hover:text-charcoal dark:text-slate-400 dark:hover:text-slate-100 rounded-none transition cursor-pointer"
            title="Aumentar Zoom do Texto"
            id="editor-zoom-in-btn"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
 
          <div className="h-4 w-px bg-charcoal-muted dark:bg-slate-800 mx-1.5" />
 
          {/* Undo/Redo */}
          <button 
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1 rounded-none transition cursor-pointer ${canUndo ? "text-charcoal hover:text-black dark:text-slate-400 dark:hover:text-slate-100" : "text-charcoal/30 dark:text-slate-700 cursor-not-allowed"}`}
            title="Desfazer (Ctrl+Z)"
            id="editor-undo-btn"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1 rounded-none transition cursor-pointer ${canRedo ? "text-charcoal hover:text-black dark:text-slate-400 dark:hover:text-slate-100" : "text-charcoal/30 dark:text-slate-700 cursor-not-allowed"}`}
            title="Refazer (Ctrl+Y)"
            id="editor-redo-btn"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
 
          <div className="h-4 w-px bg-charcoal-muted dark:bg-slate-800 mx-1.5" />
 
          {/* Search Toggle */}
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded-none transition cursor-pointer ${showSearch ? "bg-charcoal text-white dark:bg-white dark:text-charcoal" : "text-charcoal/60 hover:text-charcoal dark:text-slate-400 dark:hover:text-slate-100"}`}
            title="Localizar e Substituir (Ctrl+F)"
            id="editor-search-toggle-btn"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
 
      {/* Find and Replace Bar */}
      {showSearch && (
        <div className="p-3 border-b border-charcoal dark:border-slate-900 bg-paper-dark dark:bg-slate-900/30 flex flex-col gap-2" id="search-replace-bar">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="LOCALIZAR TEXTO..."
                className="w-full text-[10px] font-mono pl-7 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-charcoal dark:border-slate-700 rounded-none focus:outline-none focus:ring-0 dark:text-slate-100 uppercase tracking-wide placeholder:text-charcoal/40"
                onKeyDown={e => e.key === "Enter" && handleFindNext()}
                id="search-input-field"
              />
              <Search className="w-3 h-3 text-charcoal/50 dark:text-slate-400 absolute left-2 top-2.5" />
            </div>
            <button
              onClick={handleFindNext}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-charcoal dark:border-slate-700 text-[9px] font-bold font-mono uppercase tracking-wider rounded-none hover:bg-paper-dark dark:hover:bg-slate-700 text-charcoal dark:text-slate-300 transition cursor-pointer"
              id="find-next-btn"
            >
              Próximo
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={replaceQuery}
                onChange={e => setReplaceQuery(e.target.value)}
                placeholder="SUBSTITUIR POR..."
                className="w-full text-[10px] font-mono pl-7 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-charcoal dark:border-slate-700 rounded-none focus:outline-none focus:ring-0 dark:text-slate-100 uppercase tracking-wide placeholder:text-charcoal/40"
                id="replace-input-field"
              />
              <Replace className="w-3 h-3 text-charcoal/50 dark:text-slate-400 absolute left-2 top-2.5" />
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleReplace}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-charcoal dark:border-slate-700 text-[9px] font-bold font-mono uppercase tracking-wider rounded-none hover:bg-paper-dark dark:hover:bg-slate-700 text-charcoal dark:text-slate-300 transition cursor-pointer"
                id="replace-btn"
              >
                Subst.
              </button>
              <button
                onClick={handleReplaceAll}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-charcoal dark:border-slate-700 text-[9px] font-bold font-mono uppercase tracking-wider rounded-none hover:bg-paper-dark dark:hover:bg-slate-700 text-charcoal dark:text-slate-300 transition cursor-pointer"
                id="replace-all-btn"
              >
                Todos
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Editor Main Canvas with Custom Line-Gutter Columns */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers Column */}
        <div 
          ref={lineNumbersRef}
          className="w-10 bg-paper-dark dark:bg-slate-950/40 text-charcoal/40 dark:text-slate-700 font-mono text-right select-none pr-2 py-4 border-r border-charcoal-muted dark:border-slate-900/60 overflow-hidden text-xs"
          style={{ 
            fontSize: `${editorZoom}px`, 
            lineHeight: "1.5" 
          }}
          id="editor-line-numbers-col"
        >
          {lines.map((_, i) => (
            <div 
              key={i} 
              className={`h-[1.5em] pr-0.5 ${i === currentLine ? "text-charcoal dark:text-slate-400 font-bold" : ""}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
 
        {/* Highlight row background layout */}
        <div 
          className="absolute left-10 right-0 pointer-events-none select-none bg-charcoal/[0.04] dark:bg-white/[0.06] border-y border-charcoal/10 dark:border-white/10"
          style={{
            top: `${currentLine * editorZoom * 1.5 + 16}px`, // 16px padding inside text container
            height: `${editorZoom * 1.5}px`,
          }}
        />
 
        {/* Actual Textarea Editor */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUpAndClick}
          onClick={handleKeyUpAndClick}
          className="flex-1 resize-none bg-transparent outline-none py-4 px-4 font-mono overflow-auto text-charcoal dark:text-slate-100"
          style={{ 
            fontSize: `${editorZoom}px`, 
            lineHeight: "1.5",
            tabSize: 4,
            MozTabSize: 4
          }}
          placeholder={`Digite para criar seu mapa mental!\n\nProjeto\n    Objetivos\n        Comprar terreno\n        Construção\n    Custos\n        Material\n        Mão de obra`}
          id="editor-textarea-field"
        />
      </div>
 
      {/* Toolbar - Helpers for fast markdown outline tags addition */}
      <div className="px-3 py-2.5 border-t border-charcoal dark:border-slate-900 bg-paper-dark dark:bg-slate-950/20 flex flex-wrap gap-1.5 items-center">
        <span className="text-[9px] text-charcoal/50 dark:text-slate-500 font-bold font-mono uppercase tracking-wider mr-1 select-none">Inserir Rápido:</span>
        <button
          onClick={() => addSyntax("🎯 ")}
          className="px-2 py-1 bg-white hover:bg-paper-dark dark:bg-slate-900 dark:hover:bg-slate-800 border border-charcoal dark:border-slate-850 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 text-charcoal dark:text-slate-300 shadow-[1px_1px_0px_rgba(26,26,26,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
          title="Inserir Emoji Alvo"
          id="quick-add-emoji-btn"
        >
          🎯 <span>Alvo</span>
        </button>
        <button
          onClick={() => addSyntax("💡 ")}
          className="px-2 py-1 bg-white hover:bg-paper-dark dark:bg-slate-900 dark:hover:bg-slate-800 border border-charcoal dark:border-slate-850 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 text-charcoal dark:text-slate-300 shadow-[1px_1px_0px_rgba(26,26,26,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
          title="Inserir Emoji Ideia"
          id="quick-add-idea-btn"
        >
          💡 <span>Ideia</span>
        </button>
        <button
          onClick={() => addSyntax("[ ] ")}
          className="px-2 py-1 bg-white hover:bg-paper-dark dark:bg-slate-900 dark:hover:bg-slate-800 border border-charcoal dark:border-slate-850 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 text-charcoal dark:text-slate-300 shadow-[1px_1px_0px_rgba(26,26,26,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
          title="Inserir Caixa de Seleção"
          id="quick-add-chk-btn"
        >
          <CheckSquare className="w-3 h-3 text-emerald-600" /> <span>Checkbox</span>
        </button>
        <button
          onClick={() => addSyntax(" #urgente")}
          className="px-2 py-1 bg-white hover:bg-paper-dark dark:bg-slate-900 dark:hover:bg-slate-800 border border-charcoal dark:border-slate-850 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 text-charcoal dark:text-slate-300 shadow-[1px_1px_0px_rgba(26,26,26,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
          title="Inserir Tag Urgente"
          id="quick-add-tag-btn"
        >
          <span className="text-blue-600 font-extrabold font-mono">#</span><span>urgente</span>
        </button>
        <button
          onClick={() => addSyntax(" (Minha observação aqui)")}
          className="px-2 py-1 bg-white hover:bg-paper-dark dark:bg-slate-900 dark:hover:bg-slate-800 border border-charcoal dark:border-slate-850 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 text-charcoal dark:text-slate-300 shadow-[1px_1px_0px_rgba(26,26,26,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
          title="Inserir Observação"
          id="quick-add-note-btn"
        >
          <span className="text-amber-600 font-extrabold">( )</span> <span>Nota</span>
        </button>
      </div>
 
      {/* Editor Status Bar Footer */}
      <div className="px-4 py-2 bg-paper-dark dark:bg-slate-950 border-t-2 border-charcoal dark:border-slate-900 flex items-center justify-between text-[9px] text-charcoal/60 dark:text-slate-400 font-mono font-bold uppercase tracking-wider">
        <div className="flex gap-4">
          <span>Linhas: <strong className="text-charcoal dark:text-slate-200">{lines.length}</strong></span>
          <span>Palavras: <strong className="text-charcoal dark:text-slate-200">{text.trim() === "" ? 0 : text.split(/\s+/).length}</strong></span>
        </div>
        <div>
          <span>Tabulação: <strong className="text-charcoal dark:text-slate-200">4 Espaços</strong></span>
        </div>
      </div>
    </div>
  );
}
