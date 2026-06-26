import React, { useState, useEffect, useRef } from "react";
import EditorPanel from "./components/EditorPanel";
import MindMapCanvas from "./components/MindMapCanvas";
import Toolbar from "./components/Toolbar";
import { parseTextToLines, buildTreeStructure } from "./utils/textParser";
import { reconcileTree } from "./utils/reconciler";
import { applyLayout, computeNodeDimensions } from "./utils/layout";
import { 
  MindMapNode, 
  ExtraLink, 
  AppConfig, 
  LayoutType, 
  HistoryState, 
  SavedMapData, 
  NodeMetadata, 
  SearchState 
} from "./types";

const LOCAL_STORAGE_KEY = "mapamental_pwa_saved_data";

const DEFAULT_MAP_TEXT = `🎯 Projeto de Casa Nova #construção (Plano Diretor Geral)
    💡 Objetivos principais
        [ ] Comprar terreno #urgente https://terrenos.com (Verificar escritura e topografia do lote)
        [ ] Definir arquiteto #planejamento (Definição do estilo contemporâneo)
        [ ] Obter alvará de obras
    💰 Custos e Orçamento #finanças
        Material de fundação // Estimativa de R$ 45.000,00
        Mão de obra contratada // Contratos de empreitada
        Acabamentos finos #estética
    ⏳ Fases do cronograma
        Projeto conceitual
        Fundação e Estrutura // Previsão de início em Outubro
        Acabamento e Paisagismo`;

const DEFAULT_CONFIG: AppConfig = {
  theme: "light",
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  levelSpacing: 60,
  siblingSpacing: 25,
  lineThickness: 2,
  borderRadius: 8,
  nodeShape: "rounded",
  accentColor: "#4f46e5"
};

export default function App() {
  // Core application states
  const [text, setText] = useState<string>("");
  const [metadata, setMetadata] = useState<Record<string, NodeMetadata>>({});
  const [extraLinks, setExtraLinks] = useState<ExtraLink[]>([]);
  const [layout, setLayout] = useState<LayoutType>("horizontal");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  
  // Rendered positioned node list
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  
  // UI Selection states
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activeLineNumber, setActiveLineNumber] = useState<number | null>(null);

  // Search state
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    results: [],
    currentIndex: 0
  });

  // History stack for Undo/Redo
  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clipboard for branch copy & paste operations
  const [branchClipboard, setBranchClipboard] = useState<{
    text: string;
    rootLevel: number;
    metadata: Record<string, NodeMetadata>;
    originalRootText: string;
  } | null>(null);

  const prevNodesRef = useRef<MindMapNode[]>([]);
  const isLoadedRef = useRef<boolean>(false);

  // 1. INITIAL MOUNT: Load from LocalStorage or use beautiful default demo map
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed: SavedMapData = JSON.parse(saved);
        setText(parsed.text || DEFAULT_MAP_TEXT);
        setMetadata(parsed.metadata || {});
        setExtraLinks(parsed.extraLinks || []);
        setLayout(parsed.layout || "horizontal");
        setConfig(parsed.config || DEFAULT_CONFIG);
      } else {
        // Load default map and pre-seed beautiful custom colors & default extra link
        setText(DEFAULT_MAP_TEXT);
        setMetadata({});
        setLayout("horizontal");
        setConfig(DEFAULT_CONFIG);
      }
    } catch (e) {
      console.warn("Falha ao carregar do localStorage, usando padrões.", e);
      setText(DEFAULT_MAP_TEXT);
    }
    isLoadedRef.current = true;
  }, []);

  // 2. BACKEND/STATE RECONCILIATION & AUTO-LAYOUT ENGINE PIPELINE
  useEffect(() => {
    if (!isLoadedRef.current) return;

    // 2.1 Parse Text into hierarchical structures
    const parsedLines = parseTextToLines(text);
    const tempTree = buildTreeStructure(parsedLines);

    // 2.2 Reconcile new structures with existing metadata & stable IDs
    const { nodes: reconciled, updatedMetadata } = reconcileTree(tempTree, prevNodesRef.current, metadata);

    // Self-healing default extra link initialization on first run if empty
    let finalExtraLinks = [...extraLinks];
    if (extraLinks.length === 0 && reconciled.length > 5) {
      const alvaraNode = reconciled.find(n => n.text.toLowerCase().includes("alvará"));
      const estruturaNode = reconciled.find(n => n.text.toLowerCase().includes("estrutura"));
      if (alvaraNode && estruturaNode) {
        finalExtraLinks = [{
          id: "default_extra_link",
          fromId: alvaraNode.id,
          toId: estruturaNode.id,
          style: "curved",
          color: "#8b5cf6", // Purple
          thickness: 2,
          hasArrow: true,
          label: "Insumo técnico"
        }];
        setExtraLinks(finalExtraLinks);
      }
    }

    // 2.3 Compute Layout positions
    const positioned = applyLayout(reconciled, layout, config);

    // 2.4 Update states
    setNodes(positioned);
    
    // Avoid infinite loop by only updating metadata state if key structures have changed
    const keys1 = Object.keys(metadata);
    const keys2 = Object.keys(updatedMetadata);
    let keysChanged = keys1.length !== keys2.length;
    if (!keysChanged) {
      for (const k of keys1) {
        if (!updatedMetadata[k]) {
          keysChanged = true;
          break;
        }
      }
    }
    if (keysChanged) {
      setMetadata(updatedMetadata);
    }
    
    prevNodesRef.current = positioned;

    // 2.5 Auto-save work to LocalStorage
    const saveData: SavedMapData = {
      version: "1.0",
      text,
      metadata: updatedMetadata,
      extraLinks: finalExtraLinks,
      layout,
      config,
      zoom: 1,
      panX: 0,
      panY: 0
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));

    // Sync HTML theme class for full Dark Mode support
    const rootClass = document.documentElement.classList;
    if (config.theme === "dark") {
      rootClass.add("dark");
      rootClass.remove("high-contrast");
    } else if (config.theme === "high-contrast") {
      rootClass.add("high-contrast", "dark");
    } else {
      rootClass.remove("dark", "high-contrast");
    }

  }, [text, layout, config, metadata]);

  // 3. SEARCH ENGINE IMPLEMENTATION
  useEffect(() => {
    if (!searchState.query.trim()) {
      setSearchState(prev => ({ ...prev, results: [], currentIndex: 0 }));
      return;
    }

    const q = searchState.query.toLowerCase();
    const matches = nodes.filter(node => {
      const textMatch = node.text.toLowerCase().includes(q);
      const notesMatch = node.metadata.notes?.toLowerCase().includes(q) || false;
      const tagsMatch = node.metadata.tags?.some(tag => tag.toLowerCase().includes(q)) || false;
      const linkMatch = node.metadata.link?.toLowerCase().includes(q) || false;
      return textMatch || notesMatch || tagsMatch || linkMatch;
    }).map(n => n.id);

    setSearchState(prev => ({ ...prev, results: matches, currentIndex: 0 }));
  }, [searchState.query, nodes.length]);

  // Navigate cursor in search highlights
  useEffect(() => {
    if (searchState.results.length > 0) {
      const currentMatchedNodeId = searchState.results[searchState.currentIndex];
      const matchNode = nodes.find(n => n.id === currentMatchedNodeId);
      if (matchNode) {
        setActiveLineNumber(matchNode.lineNumber);
      }
    }
  }, [searchState.currentIndex, searchState.results]);

  // 4. DEBOUNCED HISTORY MANAGER (UNDO/REDO)
  const saveHistoryState = (customText: string = text, customMetadata: any = metadata, customLinks: any = extraLinks) => {
    const currentState: HistoryState = {
      text: customText,
      metadata: JSON.parse(JSON.stringify(customMetadata)),
      extraLinks: JSON.parse(JSON.stringify(customLinks)),
      config: { ...config },
      layout
    };
    setUndoStack(prev => [...prev, currentState]);
    setRedoStack([]); // Clear redo on action
  };

  const handleTextChange = (newText: string) => {
    // Live update text in state immediately for responsive layout updates
    setText(newText);

    // Debounce pushing onto the undo history stack so every single keypress isn't a state
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      saveHistoryState(newText, metadata, extraLinks);
    }, 800);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    // Save current as redo
    const currentAsRedo: HistoryState = { text, metadata, extraLinks, config, layout };
    setRedoStack(prev => [...prev, currentAsRedo]);
    setUndoStack(newUndoStack);

    // Apply previous
    setText(previous.text);
    setMetadata(previous.metadata);
    setExtraLinks(previous.extraLinks);
    setConfig(previous.config);
    setLayout(previous.layout);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    // Save current as undo
    const currentAsUndo: HistoryState = { text, metadata, extraLinks, config, layout };
    setUndoStack(prev => [...prev, currentAsUndo]);
    setRedoStack(newRedoStack);

    // Apply next
    setText(next.text);
    setMetadata(next.metadata);
    setExtraLinks(next.extraLinks);
    setConfig(next.config);
    setLayout(next.layout);
  };

  // 5. NODE & CANVAS METADATA UPDATES
  const handleUpdateNodeMetadata = (nodeId: string, updates: Partial<NodeMetadata>) => {
    saveHistoryState(text, metadata, extraLinks);
    const updated = { ...metadata };
    updated[nodeId] = {
      ...(updated[nodeId] || { id: nodeId }),
      ...updates
    };
    
    // Special handling: if checkbox is checked/unchecked, update the physical [ ] or [x] in the editor text!
    if (updates.checked !== undefined) {
      const targetNode = nodes.find(n => n.id === nodeId);
      if (targetNode) {
        const linesArray = text.split("\n");
        const lineContent = linesArray[targetNode.lineNumber];
        
        // Replace checkbox state syntax [ ] -> [x]
        const nextStateChar = updates.checked ? "x" : " ";
        const updatedLine = lineContent.replace(/^([ \t]*)\[([ xX])\]/, `$1[${nextStateChar}]`);
        linesArray[targetNode.lineNumber] = updatedLine;
        
        const nextText = linesArray.join("\n");
        setText(nextText);
        saveHistoryState(nextText, updated, extraLinks);
        return;
      }
    }

    setMetadata(updated);
  };

  const handleToggleCollapse = (nodeId: string) => {
    saveHistoryState(text, metadata, extraLinks);
    const nodeMeta = metadata[nodeId] || { id: nodeId };
    handleUpdateNodeMetadata(nodeId, { collapsed: !nodeMeta.collapsed });
  };

  // Create links between any two nodes
  const handleAddExtraLink = (fromId: string, toId: string) => {
    saveHistoryState(text, metadata, extraLinks);
    const newLink: ExtraLink = {
      id: `link_${Math.random().toString(36).substring(2, 11)}`,
      fromId,
      toId,
      style: "curved",
      color: "#8b5cf6", // Purple accent
      thickness: 2,
      hasArrow: true,
      label: ""
    };
    setExtraLinks(prev => [...prev, newLink]);
  };

  const handleDeleteExtraLink = (linkId: string) => {
    saveHistoryState(text, metadata, extraLinks);
    setExtraLinks(prev => prev.filter(l => l.id !== linkId));
  };

  // Manual Node Dragging Persistence
  const handleMoveNodes = (positions: Record<string, { x: number; y: number }>) => {
    // Dragging updates positions in metadata dynamically. We only save history on drag end.
    const updatedMeta = { ...metadata };
    Object.entries(positions).forEach(([id, pos]) => {
      updatedMeta[id] = {
        ...(updatedMeta[id] || { id }),
        manualX: pos.x,
        manualY: pos.y,
        pinned: true
      };
    });
    setMetadata(updatedMeta);
  };

  // Delete Node Branches directly by manipulating Text Outlines
  const handleDeleteNodes = (ids: string[]) => {
    saveHistoryState(text, metadata, extraLinks);
    
    // Find all line numbers of selected nodes and their descendants
    const lineNumbersToDelete = new Set<number>();
    
    ids.forEach(id => {
      const node = nodes.find(n => n.id === id);
      if (!node) return;

      lineNumbersToDelete.add(node.lineNumber);
      
      // Add all descendants recursively
      const getDescendantLines = (nodeId: string) => {
        const item = nodes.find(n => n.id === nodeId);
        if (item) {
          item.childrenIds.forEach(cid => {
            const childNode = nodes.find(n => n.id === cid);
            if (childNode) {
              lineNumbersToDelete.add(childNode.lineNumber);
              getDescendantLines(cid);
            }
          });
        }
      };
      getDescendantLines(id);
    });

    // Reconstruct editor text without those deleted line indices
    const linesArray = text.split("\n");
    const updatedLines = linesArray.filter((_, idx) => !lineNumbersToDelete.has(idx));
    
    setText(updatedLines.join("\n"));
    setSelectedNodeIds([]);
    setActiveLineNumber(null);
  };

  // 6. BRANCH COPY & PASTE BUSINESS LOGIC
  const handleCopyBranch = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Find all descendants recursively
    const descendants: MindMapNode[] = [];
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = nodes.find(n => n.id === currentId);
      if (current) {
        descendants.push(current);
        queue.push(...current.childrenIds);
      }
    }

    // Sort by line number to maintain layout sequence
    descendants.sort((a, b) => a.lineNumber - b.lineNumber);

    // Build indented plain-text clipboard representation
    const linesText = descendants.map(d => {
      const relativeLevel = d.level - node.level;
      const relativeIndent = "    ".repeat(relativeLevel);
      return relativeIndent + d.rawText.trim();
    }).join("\n");

    const clipboardMeta: Record<string, NodeMetadata> = {};
    descendants.forEach(d => {
      if (metadata[d.id]) {
        clipboardMeta[d.id] = metadata[d.id];
      }
    });

    setBranchClipboard({
      text: linesText,
      rootLevel: node.level,
      metadata: clipboardMeta,
      originalRootText: node.text
    });
  };

  const handlePasteBranch = (targetParentId: string) => {
    if (!branchClipboard) return;

    const targetParent = nodes.find(n => n.id === targetParentId);
    const targetIndentLevel = targetParent ? targetParent.level + 1 : 0;

    // Shift spacing of pasted text block to align with the target parent nesting depth
    const clipboardLines = branchClipboard.text.split("\n");
    const shiftedLines = clipboardLines.map(line => {
      const leadingSpaces = line.match(/^( *)/)?.[1]?.length || 0;
      const currentRelativeLevel = Math.floor(leadingSpaces / 4);
      const computedLevel = targetIndentLevel + currentRelativeLevel;
      return "    ".repeat(computedLevel) + line.trim();
    });

    const textBlock = shiftedLines.join("\n");
    const linesArray = text.split("\n");

    let updatedText = "";
    if (targetParent) {
      // Insert block immediately after target parent's line index
      linesArray.splice(targetParent.lineNumber + 1, 0, textBlock);
      updatedText = linesArray.join("\n");
    } else {
      // Paste at the very bottom
      updatedText = text + "\n" + textBlock;
    }

    saveHistoryState(updatedText, metadata, extraLinks);
    setText(updatedText);
  };

  // Reorganize automatically resets all manual dragged nodes positions
  const handleReorganize = () => {
    saveHistoryState(text, metadata, extraLinks);
    const cleared = { ...metadata };
    Object.keys(cleared).forEach(id => {
      delete cleared[id].manualX;
      delete cleared[id].manualY;
      delete cleared[id].pinned;
    });
    setMetadata(cleared);
  };

  // 7. UNIVERSAL EXPORTER & FILE WRITER MODULES
  const handleExport = (format: "pdf" | "png" | "svg" | "json" | "txt" | "html", pdfSettings?: any) => {
    const sanitizeFilename = (nameStr: string) => nameStr.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const baseName = nodes[0] ? sanitizeFilename(nodes[0].text) : "mapa_mental";

    if (format === "txt") {
      // Export original plain text outline
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } 
    
    else if (format === "json") {
      // Export JSON .mmap format
      const saveData: SavedMapData = {
        version: "1.0",
        text,
        metadata,
        extraLinks,
        layout,
        config,
        zoom: 1,
        panX: 0,
        panY: 0
      };
      const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.mmap`;
      a.click();
      URL.revokeObjectURL(url);
    } 

    else if (format === "html") {
      // Export standalone offline interactive HTML presentation card
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${nodes[0]?.text || "Mapa Mental"}</title>
  <style>
    body { font-family: sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; margin: 0; }
    .card { background: white; border-radius: 12px; padding: 30px; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    h1 { color: #4f46e5; margin-top: 0; font-size: 24px; border-b: 2px solid #e2e8f0; pb: 10px; }
    pre { background: #0f172a; color: #f1f5f9; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${nodes[0]?.text || "Mapa Mental"}</h1>
    <p>Este arquivo contem a estrutura hierárquica do seu mapa mental. Você pode copiar o conteúdo abaixo e importar de volta no aplicativo MapaMental PWA.</p>
    <pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  </div>
</body>
</html>`;
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }

    else if (format === "png") {
      // Export Canvas PNG
      const canvas = document.getElementById("mindmap-main-canvas") as HTMLCanvasElement;
      if (canvas) {
        // Instant full resolution PNG export
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${baseName}.png`;
        a.click();
      }
    }

    else if (format === "svg") {
      // Export highly structured vector graphics (SVG)
      let svgCode = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="-600 -400 1200 800" style="background:#f8fafc">\n`;
      svgCode += `  <style>\n`;
      svgCode += `    .node-rect { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1px; }\n`;
      svgCode += `    .node-text { font-family: Inter, sans-serif; font-size: 12px; fill: #1e293b; font-weight: 500; }\n`;
      svgCode += `    .branch-line { fill: none; stroke: #cbd5e1; stroke-width: 2px; }\n`;
      svgCode += `    .extra-link { fill: none; stroke: #8b5cf6; stroke-width: 2px; stroke-dasharray: 4,4; }\n`;
      svgCode += `  </style>\n`;

      // 1. Draw Lines
      nodes.forEach(node => {
        if (!node.parentId) return;
        const parent = nodes.find(n => n.id === node.parentId);
        if (!parent) return;

        const startX = parent.x + parent.width;
        const startY = parent.y + parent.height / 2;
        const endX = node.x;
        const endY = node.y + node.height / 2;

        const cp1X = startX + (endX - startX) * 0.45;
        const cp1Y = startY;
        const cp2X = startX + (endX - startX) * 0.55;
        const cp2Y = endY;

        svgCode += `  <path d="M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}" class="branch-line" />\n`;
      });

      // 2. Draw Nodes
      nodes.forEach(node => {
        const bg = node.metadata.color || "#ffffff";
        const tc = node.metadata.textColor || "#1e293b";
        
        svgCode += `  <g>\n`;
        svgCode += `    <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="6" style="fill:${bg}; stroke:#cbd5e1; stroke-width:1" />\n`;
        svgCode += `    <text x="${node.x + 12}" y="${node.y + node.height / 2 + 4}" class="node-text" style="fill:${tc}">${node.metadata.emoji ? node.metadata.emoji + " " : ""}${node.text}</text>\n`;
        svgCode += `  </g>\n`;
      });

      svgCode += `</svg>`;

      const blob = new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }

    else if (format === "pdf") {
      // Dynamic offline printing using window.print() of a stylized printable frame
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const isDark = config.theme === "dark";
        const linesTextHTML = text.split("\n").map(l => {
          const depth = (l.match(/^( *)/)?.[1]?.length || 0);
          return `<div style="margin-left: ${depth * 6}px; margin-bottom: 4px; font-size: 14px;">• ${l.trim()}</div>`;
        }).join("");

        printWindow.document.write(`
          <html>
            <head>
              <title>${nodes[0]?.text || "Mapa Mental"}</title>
              <style>
                @page { size: ${pdfSettings.size || "A4"} ${pdfSettings.orientation || "landscape"}; margin: ${pdfSettings.margins || 10}mm; }
                body { font-family: system-ui, sans-serif; background: #ffffff; color: #000000; padding: 20px; }
                h1 { font-size: 24px; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; }
                .tree-outline { padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; line-height: 1.6; }
                .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-t: 1px solid #e2e8f0; padding-top: 10px; }
              </style>
            </head>
            <body>
              <h1>${nodes[0]?.text || "Esquema de Mapa Mental"}</h1>
              <div class="tree-outline">
                ${linesTextHTML}
              </div>
              <div class="footer">Gerado via MapaMental PWA - Totalmente Offline</div>
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  const handleImportJSON = async (file: File) => {
    try {
      const textData = await file.text();
      const parsed: SavedMapData = JSON.parse(textData);
      
      saveHistoryState(text, metadata, extraLinks);
      
      setText(parsed.text || "");
      setMetadata(parsed.metadata || {});
      setExtraLinks(parsed.extraLinks || []);
      setLayout(parsed.layout || "horizontal");
      if (parsed.config) setConfig(parsed.config);
      
    } catch (e) {
      alert("Falha ao analisar o arquivo .mmap. Certifique-se que o formato JSON está correto.");
    }
  };

  const handleClearAll = () => {
    saveHistoryState("", {}, []);
    setText("Novo Mapa");
    setMetadata({});
    setExtraLinks([]);
    setSelectedNodeIds([]);
    setActiveLineNumber(null);
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-paper dark:bg-slate-950 text-charcoal dark:text-slate-100 transition-colors duration-200" id="application-container">
      {/* Dynamic Header toolbar */}
      <Toolbar
        config={config}
        onUpdateConfig={updates => setConfig(prev => ({ ...prev, ...updates }))}
        layout={layout}
        onChangeLayout={setLayout}
        searchState={searchState}
        onUpdateSearch={updates => setSearchState(prev => ({ ...prev, ...updates }))}
        onExport={handleExport}
        onImportJSON={handleImportJSON}
        onClearAll={handleClearAll}
      />

      {/* Main split work area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Side: Outliner Code Editor */}
        <div className="w-full md:w-80 lg:w-96 h-1/2 md:h-full flex-shrink-0 relative z-10 border-r border-charcoal dark:border-slate-800">
          <EditorPanel
            text={text}
            onChange={handleTextChange}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            activeLineNumber={activeLineNumber}
            onSelectLine={setActiveLineNumber}
          />
        </div>

        {/* Right Side: High Performance Visual Mind Map Rendering Stage */}
        <div className="flex-1 h-1/2 md:h-full relative bg-paper dark:bg-slate-900/60 z-0">
          <MindMapCanvas
            nodes={nodes}
            extraLinks={extraLinks}
            config={config}
            selectedNodeIds={selectedNodeIds}
            searchState={searchState}
            onSelectNodes={setSelectedNodeIds}
            onUpdateNodeMetadata={handleUpdateNodeMetadata}
            onToggleCollapse={handleToggleCollapse}
            onAddExtraLink={handleAddExtraLink}
            onDeleteExtraLink={handleDeleteExtraLink}
            onMoveNodes={handleMoveNodes}
            onDeleteNodes={handleDeleteNodes}
            onReorganize={handleReorganize}
            onCopyBranch={handleCopyBranch}
            onPasteBranch={handlePasteBranch}
            canPaste={branchClipboard !== null}
          />
        </div>
      </div>
    </div>
  );
}
