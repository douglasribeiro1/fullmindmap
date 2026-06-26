import React, { useRef, useState, useEffect, useMemo } from "react";
import { 
  MindMapNode, 
  ExtraLink, 
  AppConfig, 
  ThemeType, 
  SearchState 
} from "../types";
import { 
  Maximize, 
  ZoomIn, 
  ZoomOut, 
  Anchor, 
  Lock, 
  Unlock, 
  Link2, 
  Trash2, 
  Plus, 
  Sparkles,
  RefreshCw,
  Copy,
  FolderMinus,
  CheckCircle,
  EyeOff
} from "lucide-react";

interface MindMapCanvasProps {
  nodes: MindMapNode[];
  extraLinks: ExtraLink[];
  config: AppConfig;
  selectedNodeIds: string[];
  searchState: SearchState;
  onSelectNodes: (ids: string[]) => void;
  onUpdateNodeMetadata: (nodeId: string, updates: Partial<any>) => void;
  onToggleCollapse: (nodeId: string) => void;
  onAddExtraLink: (fromId: string, toId: string) => void;
  onDeleteExtraLink: (linkId: string) => void;
  onMoveNodes: (positions: Record<string, { x: number; y: number }>) => void;
  onDeleteNodes: (ids: string[]) => void;
  onReorganize: () => void;
  
  // Drag and drop branches helper
  onCopyBranch: (nodeId: string) => void;
  onPasteBranch: (targetParentId: string) => void;
  canPaste: boolean;
}

export default function MindMapCanvas({
  nodes,
  extraLinks,
  config,
  selectedNodeIds,
  searchState,
  onSelectNodes,
  onUpdateNodeMetadata,
  onToggleCollapse,
  onAddExtraLink,
  onDeleteExtraLink,
  onMoveNodes,
  onDeleteNodes,
  onReorganize,
  onCopyBranch,
  onPasteBranch,
  canPaste,
}: MindMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport transformation states
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // Interaction states
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingNodes, setIsDraggingNodes] = useState<boolean>(false);
  const [isSelectingArea, setIsSelectingArea] = useState<boolean>(false);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  
  // Connecting nodes (for Extra Links)
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [connectionMousePos, setConnectionMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isConnectionMode, setIsConnectionMode] = useState<boolean>(false);

  // Node relative dragging tracking
  const [nodeDragOffsets, setNodeDragOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  
  // Note tooltip info
  const [hoveredNode, setHoveredNode] = useState<MindMapNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map of nodes for quick reference
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Handle resizing
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial sizing

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Center map around viewport
  const centerMap = () => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    // Find bounding box of all nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + n.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;
    const mapCenterX = minX + mapWidth / 2;
    const mapCenterY = minY + mapHeight / 2;

    // Use client dimensions (logical size) for centering math
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const scaleX = (width * 0.8) / mapWidth;
    const scaleY = (height * 0.8) / mapHeight;
    const nextZoom = Math.max(0.3, Math.min(1.5, Math.min(scaleX, scaleY)));

    setZoom(nextZoom);
    setPanX(width / 2 - mapCenterX * nextZoom);
    setPanY(height / 2 - mapCenterY * nextZoom);
  };

  // Center on mount once if loaded
  useEffect(() => {
    if (nodes.length > 0) {
      centerMap();
    }
  }, [nodes.length === 0]);

  // Convert screen to world coordinates
  const screenToWorld = (sx: number, sy: number) => {
    return {
      x: (sx - panX) / zoom,
      y: (sy - panY) / zoom
    };
  };

  // Convert world to screen coordinates
  const worldToScreen = (wx: number, wy: number) => {
    return {
      x: wx * zoom + panX,
      y: wy * zoom + panY
    };
  };

  // Get node under mouse coordinates
  const getNodeAt = (wx: number, wy: number): MindMapNode | null => {
    // Search in reverse order to select top-most rendered node first
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      
      // Check if node's parent is collapsed
      let parent = node.parentId ? nodeMap.get(node.parentId) : null;
      let isHidden = false;
      while (parent) {
        if (parent.metadata.collapsed) {
          isHidden = true;
          break;
        }
        parent = parent.parentId ? nodeMap.get(parent.parentId) : null;
      }
      if (isHidden) continue;

      if (
        wx >= node.x &&
        wx <= node.x + node.width &&
        wy >= node.y &&
        wy <= node.y + node.height
      ) {
        return node;
      }
    }
    return null;
  };

  // Check if click was inside a node's checkbox
  const isCheckboxClicked = (node: MindMapNode, wx: number, wy: number): boolean => {
    if (!node.metadata.hasCheckbox) return false;
    
    const { fontSize } = config;
    const boxSize = fontSize * 1.1;
    const boxX = node.x + fontSize * 0.8;
    const boxY = node.y + (node.height - boxSize) / 2;

    return (
      wx >= boxX &&
      wx <= boxX + boxSize &&
      wy >= boxY &&
      wy <= boxY + boxSize
    );
  };

  // Check if click was inside a node's fold/unfold collapse handle
  const isCollapseHandleClicked = (node: MindMapNode, wx: number, wy: number): boolean => {
    if (node.childrenIds.length === 0) return false;
    
    // Position of collapse circle depends on layout
    const radius = 8;
    const handlePos = getCollapseHandlePos(node);
    
    const dx = wx - handlePos.x;
    const dy = wy - handlePos.y;
    return dx * dx + dy * dy <= radius * radius;
  };

  // Get positions of collapse handles based on where child lines come out
  const getCollapseHandlePos = (node: MindMapNode): { x: number; y: number } => {
    // For horizontal layouts, it is on the right-middle side of the node block
    return {
      x: node.x + node.width,
      y: node.y + node.height / 2
    };
  };

  // Check if click was inside a node's hyperlink icon
  const isLinkIconClicked = (node: MindMapNode, wx: number, wy: number): boolean => {
    if (!node.metadata.link) return false;
    
    // Link icon is drawn on the right side
    const { fontSize } = config;
    const iconSize = fontSize * 1.1;
    const iconX = node.x + node.width - fontSize * 1.4;
    const iconY = node.y + (node.height - iconSize) / 2;

    return (
      wx >= iconX &&
      wx <= iconX + iconSize &&
      wy >= iconY &&
      wy <= iconY + iconSize
    );
  };


  // Mouse Down handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    // 1. Check Collapse Handle Click
    const clickedNodeForCollapse = nodes.find(n => isCollapseHandleClicked(n, worldPos.x, worldPos.y));
    if (clickedNodeForCollapse) {
      onToggleCollapse(clickedNodeForCollapse.id);
      return;
    }

    // 2. Check Node Click
    const clickedNode = getNodeAt(worldPos.x, worldPos.y);

    if (clickedNode) {
      // Check checkbox interaction
      if (isCheckboxClicked(clickedNode, worldPos.x, worldPos.y)) {
        onUpdateNodeMetadata(clickedNode.id, { checked: !clickedNode.metadata.checked });
        return;
      }

      // Check hyperlink click
      if (isLinkIconClicked(clickedNode, worldPos.x, worldPos.y) && clickedNode.metadata.link) {
        window.open(clickedNode.metadata.link, "_blank", "noopener,noreferrer");
        return;
      }

      // If connection mode is active
      if (isConnectionMode && connectionSourceId) {
        if (connectionSourceId !== clickedNode.id) {
          onAddExtraLink(connectionSourceId, clickedNode.id);
        }
        setConnectionSourceId(null);
        setConnectionMousePos(null);
        setIsConnectionMode(false);
        return;
      }

      // Multi selection modifier
      const isMulti = e.ctrlKey || e.shiftKey;
      let nextSelected = [...selectedNodeIds];

      if (isMulti) {
        if (selectedNodeIds.includes(clickedNode.id)) {
          nextSelected = selectedNodeIds.filter(id => id !== clickedNode.id);
        } else {
          nextSelected.push(clickedNode.id);
        }
      } else {
        if (!selectedNodeIds.includes(clickedNode.id)) {
          nextSelected = [clickedNode.id];
        }
      }

      onSelectNodes(nextSelected);

      // Setup node dragging
      setIsDraggingNodes(true);
      const offsets: Record<string, { dx: number; dy: number }> = {};
      nextSelected.forEach(id => {
        const n = nodes.find(item => item.id === id);
        if (n) {
          offsets[id] = {
            dx: worldPos.x - n.x,
            dy: worldPos.y - n.y
          };
        }
      });
      setNodeDragOffsets(offsets);

    } else {
      // Clicked background: Either selection box or panning
      onSelectNodes([]);
      setConnectionSourceId(null);
      setIsConnectionMode(false);

      if (e.button === 0 && !e.shiftKey && !e.ctrlKey) {
        // Area Drag selection
        setIsSelectingArea(true);
        setSelectionBox({
          x1: worldPos.x,
          y1: worldPos.y,
          x2: worldPos.x,
          y2: worldPos.y
        });
      } else {
        // Pan background
        setIsPanning(true);
        setDragStart({ x: screenX - panX, y: screenY - panY });
      }
    }
  };

  // Mouse Move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    // Track hovered node for notes tooltip
    const hover = getNodeAt(worldPos.x, worldPos.y);
    if (hover && hover.metadata.notes) {
      setHoveredNode(hover);
      setTooltipPos({ x: e.clientX + 15, y: e.clientY + 15 });
    } else {
      setHoveredNode(null);
    }

    if (isPanning) {
      setPanX(screenX - dragStart.x);
      setPanY(screenY - dragStart.y);
    } else if (isDraggingNodes) {
      const positions: Record<string, { x: number; y: number }> = {};
      selectedNodeIds.forEach(id => {
        const offset = nodeDragOffsets[id];
        if (offset) {
          positions[id] = {
            x: Math.round(worldPos.x - offset.dx),
            y: Math.round(worldPos.y - offset.dy)
          };
        }
      });
      onMoveNodes(positions);
    } else if (isSelectingArea && selectionBox) {
      const box = { ...selectionBox, x2: worldPos.x, y2: worldPos.y };
      setSelectionBox(box);

      // Compute nodes captured inside selection box
      const x1 = Math.min(box.x1, box.x2);
      const x2 = Math.max(box.x1, box.x2);
      const y1 = Math.min(box.y1, box.y2);
      const y2 = Math.max(box.y1, box.y2);

      const captured = nodes.filter(n => {
        // Must intersect node rectangle
        return (
          n.x + n.width >= x1 &&
          n.x <= x2 &&
          n.y + n.height >= y1 &&
          n.y <= y2
        );
      }).map(n => n.id);

      onSelectNodes(captured);
    }

    // Connection tracking
    if (isConnectionMode && connectionSourceId) {
      setConnectionMousePos(worldPos);
    }
  };

  // Mouse Up handler
  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingNodes(false);
    setIsSelectingArea(false);
    setSelectionBox(null);
  };

  // Key Down listeners for canvas keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If we are typing in an input or textarea, don't trigger canvas shortcuts!
      if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        centerMap();
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeIds.length > 0) {
          onDeleteNodes(selectedNodeIds);
        }
      }

      if (e.ctrlKey && e.key === "c") {
        // Copy first selected node branch
        if (selectedNodeIds.length > 0) {
          onCopyBranch(selectedNodeIds[0]);
        }
      }

      if (e.ctrlKey && e.key === "v") {
        // Paste branch under selected parent node
        if (selectedNodeIds.length > 0 && canPaste) {
          onPasteBranch(selectedNodeIds[0]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeIds, canPaste]);

  // Non-passive Wheel event listener registered manually to prevent passive browser warnings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom speed
      const zoomFactor = 1.1;
      let nextZoom = zoom;
      if (e.deltaY < 0) {
        nextZoom = Math.min(3, zoom * zoomFactor);
      } else {
        nextZoom = Math.max(0.15, zoom / zoomFactor);
      }

      // Zoom centering relative to cursor position
      const worldX = (mouseX - panX) / zoom;
      const worldY = (mouseY - panY) / zoom;
      setZoom(nextZoom);
      setPanX(mouseX - worldX * nextZoom);
      setPanY(mouseY - worldY * nextZoom);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [zoom, panX, panY]);

  // RENDER DRAWING LOOP ON CANVAS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);

      const logicalWidth = canvas.width / dpr;
      const logicalHeight = canvas.height / dpr;

      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      // Draw beautiful grid background
      drawGrid(ctx, logicalWidth, logicalHeight);

      // Apply zoom & pan camera transformations (within nested save/restore to separate from DPR scale)
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      // Create a map helper of nodes that are hidden due to collapsed ancestors
      const collapsedNodeIds = new Set<string>();
      nodes.forEach(n => {
        let parent = n.parentId ? nodeMap.get(n.parentId) : null;
        while (parent) {
          if (parent.metadata.collapsed) {
            collapsedNodeIds.add(n.id);
            break;
          }
          parent = parent.parentId ? nodeMap.get(parent.parentId) : null;
        }
      });

      // 1. DRAW TREE BRANCHE LINES (Parent -> Child connections)
      drawTreeBranches(ctx, collapsedNodeIds);

      // 2. DRAW EXTRA VISUAL RELATIONSHIPS (Extra Links)
      drawExtraLinks(ctx, collapsedNodeIds);

      // 3. DRAW TEMPORARY CONNECTION WIRE (If drawing connection)
      if (isConnectionMode && connectionSourceId && connectionMousePos) {
        const source = nodeMap.get(connectionSourceId);
        if (source) {
          ctx.beginPath();
          ctx.moveTo(source.x + source.width / 2, source.y + source.height / 2);
          ctx.lineTo(connectionMousePos.x, connectionMousePos.y);
          ctx.strokeStyle = "#a78bfa"; // purple accent
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 4. DRAW NODES
      drawNodes(ctx, collapsedNodeIds);

      // 5. DRAW SELECTION RECTANGLE
      if (isSelectingArea && selectionBox) {
        ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(
          selectionBox.x1,
          selectionBox.y1,
          selectionBox.x2 - selectionBox.x1,
          selectionBox.y2 - selectionBox.y1
        );
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore(); // Restores the camera viewport scale and translation

      // 6. DRAW VISUAL MINI-MAP IN THE BOTTOM RIGHT USING LOGICAL DIMENSIONS
      drawMiniMap(ctx, logicalWidth, logicalHeight, collapsedNodeIds);

      ctx.restore(); // Restores the device pixel ratio scale

      animId = requestAnimationFrame(draw);
    };

    // Helper functions inside useEffect to share refs/context cleanly
    const drawGrid = (c: CanvasRenderingContext2D, w: number, h: number) => {
      const isDark = config.theme === "dark";
      const isHighContrast = config.theme === "high-contrast";

      c.fillStyle = isHighContrast 
        ? "#000000" 
        : isDark 
          ? "#0b101b" 
          : "#F8F7F4"; // Editorial theme warm paper background
      c.fillRect(0, 0, w, h);

      if (isHighContrast) return; // No grid for clean high contrast

      // Grid Dots
      c.fillStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(26, 26, 26, 0.06)";
      const gridSize = 40;
      
      const startX = (panX % (gridSize * zoom)) - (gridSize * zoom);
      const startY = (panY % (gridSize * zoom)) - (gridSize * zoom);

      for (let gx = startX; gx < w + gridSize * zoom; gx += gridSize * zoom) {
        for (let gy = startY; gy < h + gridSize * zoom; gy += gridSize * zoom) {
          c.beginPath();
          c.arc(gx, gy, 1.2 * zoom, 0, Math.PI * 2);
          c.fill();
        }
      }
    };

    const drawTreeBranches = (c: CanvasRenderingContext2D, hidden: Set<string>) => {
      const isDark = config.theme === "dark";
      const isHighContrast = config.theme === "high-contrast";
      
      c.lineWidth = config.lineThickness;
      c.strokeStyle = isHighContrast 
        ? "#ffffff" 
        : isDark 
          ? "rgba(255, 255, 255, 0.35)" 
          : "rgba(26, 26, 26, 0.35)"; // Editorial solid charcoal with mild opacity

      nodes.forEach(node => {
        if (hidden.has(node.id) || !node.parentId) return;
        const parent = nodeMap.get(node.parentId);
        if (!parent || hidden.has(parent.id)) return;

        // Custom curved connector line (Cubic Bezier curve from right of parent to left of child)
        c.beginPath();
        
        // Start side is parent right end
        const startX = parent.x + parent.width;
        const startY = parent.y + parent.height / 2;
        
        // End side is child left end
        const endX = node.x;
        const endY = node.y + node.height / 2;

        // Control points
        const cp1X = startX + (endX - startX) * 0.45;
        const cp1Y = startY;
        const cp2X = startX + (endX - startX) * 0.55;
        const cp2Y = endY;

        c.moveTo(startX, startY);
        c.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
        c.stroke();
      });
    };

    const drawExtraLinks = (c: CanvasRenderingContext2D, hidden: Set<string>) => {
      // Helper to find intersection of the line from node center to target point (ox, oy) with the node's bounding box
      const getBoxIntersection = (
        node: { x: number; y: number; width: number; height: number },
        ox: number,
        oy: number
      ): { x: number; y: number } => {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        
        const dx = ox - cx;
        const dy = oy - cy;
        
        if (dx === 0 && dy === 0) {
          return { x: cx, y: cy };
        }
        
        const w2 = node.width / 2;
        const h2 = node.height / 2;
        
        let tx = Infinity;
        let ty = Infinity;
        
        if (dx > 0) {
          tx = w2 / dx;
        } else if (dx < 0) {
          tx = -w2 / dx;
        }
        
        if (dy > 0) {
          ty = h2 / dy;
        } else if (dy < 0) {
          ty = -h2 / dy;
        }
        
        const t = Math.min(1, Math.min(tx, ty));
        return {
          x: cx + dx * t,
          y: cy + dy * t
        };
      };

      extraLinks.forEach(link => {
        if (hidden.has(link.fromId) || hidden.has(link.toId)) return;
        const fromNode = nodeMap.get(link.fromId);
        const toNode = nodeMap.get(link.toId);
        if (!fromNode || !toNode) return;

        c.save();
        c.strokeStyle = link.color || (config.theme === "dark" ? "#ffffff" : "#1a1a1a");
        c.lineWidth = link.thickness || 2;
        c.fillStyle = link.color || (config.theme === "dark" ? "#ffffff" : "#1a1a1a");

        const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
        const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

        c.beginPath();
        if (link.style === "curved") {
          // 1. Calculate control point first using center-to-center line
          const midX = (fromCenter.x + toCenter.x) / 2;
          const midY = (fromCenter.y + toCenter.y) / 2;
          
          const dx = toCenter.x - fromCenter.x;
          const dy = toCenter.y - fromCenter.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          
          let cpX = midX;
          let cpY = midY;
          
          if (len > 0) {
            const nx = -dy / len;
            const ny = dx / len;
            const offset = Math.min(len * 0.25, 60);
            cpX = midX + nx * offset;
            cpY = midY + ny * offset;
          }

          // 2. Intersect curve's entry vectors with node borders
          const start = getBoxIntersection(fromNode, cpX, cpY);
          const end = getBoxIntersection(toNode, cpX, cpY);

          c.moveTo(start.x, start.y);
          c.quadraticCurveTo(cpX, cpY, end.x, end.y);
          c.stroke();

          // Draw arrowhead if specified at the border endpoint
          if (link.hasArrow) {
            const angle = Math.atan2(end.y - cpY, end.x - cpX);
            drawArrowhead(c, end.x, end.y, angle, link.thickness);
          }

          // Draw label if present
          if (link.label) {
            c.font = `10px ${config.fontFamily}`;
            c.fillStyle = config.theme === "dark" ? "#e2e8f0" : "#1a1a1a";
            c.fillText(link.label, cpX, cpY);
          }

        } else {
          // Straight line
          const start = getBoxIntersection(fromNode, toCenter.x, toCenter.y);
          const end = getBoxIntersection(toNode, fromCenter.x, fromCenter.y);

          c.moveTo(start.x, start.y);
          c.lineTo(end.x, end.y);
          c.stroke();

          if (link.hasArrow) {
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            drawArrowhead(c, end.x, end.y, angle, link.thickness);
          }

          if (link.label) {
            c.font = `10px ${config.fontFamily}`;
            c.fillStyle = config.theme === "dark" ? "#e2e8f0" : "#1a1a1a";
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            c.fillText(link.label, midX, midY - 4);
          }
        }
        c.restore();
      });
    };

    const drawArrowhead = (c: CanvasRenderingContext2D, tx: number, ty: number, angle: number, thickness: number) => {
      const size = 6 + thickness;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(tx - size * Math.cos(angle - Math.PI / 6), ty - size * Math.sin(angle - Math.PI / 6));
      c.lineTo(tx - size * Math.cos(angle + Math.PI / 6), ty - size * Math.sin(angle + Math.PI / 6));
      c.closePath();
      c.fill();
    };

    const drawNodes = (c: CanvasRenderingContext2D, hidden: Set<string>) => {
      const isDark = config.theme === "dark";
      const isHighContrast = config.theme === "high-contrast";

      nodes.forEach(node => {
        if (hidden.has(node.id)) return;

        c.save();

        const isSelected = selectedNodeIds.includes(node.id);
        const isSearchHighlight = searchState.results.includes(node.id);
        const isCurrentSearchItem = searchState.results[searchState.currentIndex] === node.id;

        // Custom or default color choices
        let bgColor = node.metadata.color;
        let txtColor = node.metadata.textColor;

        if (!bgColor) {
          if (isHighContrast) {
            bgColor = "#000000";
            txtColor = "#ffffff";
          } else if (isDark) {
            // Distinct dark colors based on hierarchical nesting levels
            bgColor = node.level === 0 
              ? "#ffffff" // root is white in dark mode
              : node.level === 1 
                ? "#1e293b" 
                : "#0f172a";
            txtColor = node.level === 0 ? "#1a1a1a" : "#f1f5f9";
          } else {
            // Editorial Aesthetic hierarchical presets for light theme
            bgColor = node.level === 0 
              ? "#1a1a1a" // root is charcoal
              : node.level === 1 
                ? "#fdfdfb" // paper-light cream
                : "#f0efec"; // paper-dark
            txtColor = node.level === 0 ? "#f8f7f4" : "#1a1a1a";
          }
        }

        if (!txtColor) {
          txtColor = isDark || isHighContrast ? "#ffffff" : "#1a1a1a";
        }

        // Draw node bubble border/glow shadow
        c.strokeStyle = isHighContrast 
          ? "#ffffff" 
          : isSelected 
            ? (isDark ? "#ffffff" : "#1a1a1a") // bold selection
            : isDark 
              ? "#334155" 
              : "#1a1a1a"; // solid charcoal border in light mode

        c.lineWidth = isSelected ? 3 : isHighContrast ? 2 : 1;

        // Search highlights
        if (isSearchHighlight) {
          c.strokeStyle = isCurrentSearchItem ? "#ef4444" : "#eab308"; // red active / yellow others
          c.lineWidth = 3;
          c.shadowColor = isCurrentSearchItem ? "#f87171" : "#fef08a";
          c.shadowBlur = 10;
        }

        // Fill background
        c.fillStyle = bgColor;

        // Draw shape (rectangle, rounded, capsule, ellipse)
        const radius = config.borderRadius;
        const shape = config.nodeShape;

        c.beginPath();
        if (shape === "capsule") {
          const capRad = node.height / 2;
          drawRoundedRect(c, node.x, node.y, node.width, node.height, capRad);
        } else if (shape === "ellipse") {
          c.ellipse(
            node.x + node.width / 2,
            node.y + node.height / 2,
            node.width / 2,
            node.height / 2,
            0, 0, Math.PI * 2
          );
        } else if (shape === "rounded") {
          drawRoundedRect(c, node.x, node.y, node.width, node.height, radius);
        } else {
          // rectangle
          c.rect(node.x, node.y, node.width, node.height);
        }
        c.fill();
        c.stroke();

        // Clear shadow effects for inner parts
        c.shadowBlur = 0;

        // Draw checkbox if active
        let contentOffsetX = config.fontSize * 1.0;
        if (node.metadata.hasCheckbox) {
          const boxSize = config.fontSize * 1.1;
          const boxX = node.x + config.fontSize * 0.8;
          const boxY = node.y + (node.height - boxSize) / 2;
          
          c.save();
          c.strokeStyle = isDark ? "#475569" : "#cbd5e1";
          c.fillStyle = node.metadata.checked 
            ? "#10b981" // green checked
            : isDark 
              ? "#0f172a" 
              : "#ffffff";
          
          c.lineWidth = 1.5;
          c.beginPath();
          c.rect(boxX, boxY, boxSize, boxSize);
          c.fill();
          c.stroke();
          
          if (node.metadata.checked) {
            c.strokeStyle = "#ffffff";
            c.lineWidth = 2;
            c.beginPath();
            // Draw a neat check mark vector
            c.moveTo(boxX + boxSize * 0.25, boxY + boxSize * 0.5);
            c.lineTo(boxX + boxSize * 0.45, boxY + boxSize * 0.75);
            c.lineTo(boxX + boxSize * 0.8, boxY + boxSize * 0.3);
            c.stroke();
          }
          c.restore();
          
          contentOffsetX += boxSize + 6;
        }

        // Draw emoji
        if (node.metadata.emoji) {
          c.font = `${config.fontSize * 1.2}px ${config.fontFamily}`;
          c.textBaseline = "middle";
          c.fillText(
            node.metadata.emoji,
            node.x + contentOffsetX,
            node.y + node.height / 2
          );
          contentOffsetX += config.fontSize * 1.4;
        }

        // Text rendering properties
        c.fillStyle = txtColor;
        c.font = `500 ${config.fontSize}px ${config.fontFamily}`;
        c.textBaseline = "middle";
        
        // Compute text vertical alignment considering tags/notes space
        let textY = node.y + node.height / 2;
        if (node.metadata.tags && node.metadata.tags.length > 0) {
          textY = node.y + config.fontSize * 0.9;
        }

        c.fillText(node.text, node.x + contentOffsetX, textY);

        // Draw tags below text if present
        if (node.metadata.tags && node.metadata.tags.length > 0) {
          let tagX = node.x + contentOffsetX;
          const tagY = textY + config.fontSize * 1.1;

          node.metadata.tags.forEach(tag => {
            c.save();
            c.font = `${config.fontSize * 0.7}px ${config.fontFamily}`;
            const tagText = `#${tag}`;
            const tagW = c.measureText(tagText).width + 8;
            
            c.fillStyle = isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.08)";
            c.strokeStyle = "rgba(59, 130, 246, 0.4)";
            c.beginPath();
            drawRoundedRect(c, tagX, tagY - config.fontSize * 0.4, tagW, config.fontSize * 0.8, 3);
            c.fill();
            c.stroke();
            
            c.fillStyle = isDark ? "#93c5fd" : "#1d4ed8";
            c.textBaseline = "middle";
            c.fillText(tagText, tagX + 4, tagY);
            c.restore();

            tagX += tagW + 4;
          });
        }

        // Hyperlink Icon indication (drawn on the extreme right)
        if (node.metadata.link) {
          const iconSize = config.fontSize * 1.0;
          const iconX = node.x + node.width - config.fontSize * 1.4;
          const iconY = node.y + (node.height - iconSize) / 2;

          c.save();
          c.strokeStyle = isDark ? "#60a5fa" : "#2563eb";
          c.lineWidth = 1.5;
          // Render a clean miniature chain-link icon
          c.beginPath();
          c.arc(iconX + iconSize * 0.3, iconY + iconSize * 0.7, iconSize * 0.25, Math.PI * 0.75, Math.PI * 1.75);
          c.stroke();
          c.beginPath();
          c.arc(iconX + iconSize * 0.7, iconY + iconSize * 0.3, iconSize * 0.25, -Math.PI * 0.25, Math.PI * 0.75);
          c.stroke();
          c.restore();
        }

        // Draw note indicator (tiny sheet of paper indicator icon if notes exist)
        if (node.metadata.notes) {
          c.save();
          c.fillStyle = "#eab308"; // yellow
          c.beginPath();
          // Draw a tiny post-it triangle/dot at top-right corner of node
          c.arc(node.x + node.width - 4, node.y + 4, 3, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }

        // Draw Fold/Collapse Circular handle on the right edge if this node has children
        if (node.childrenIds.length > 0) {
          const radius = 6;
          const handlePos = getCollapseHandlePos(node);

          c.save();
          c.fillStyle = isDark ? "#1e293b" : "#ffffff";
          c.strokeStyle = isDark ? "#475569" : "#cbd5e1";
          c.lineWidth = 1.5;
          
          c.beginPath();
          c.arc(handlePos.x, handlePos.y, radius, 0, Math.PI * 2);
          c.fill();
          c.stroke();

          // Draw '+' or '-' sign
          c.strokeStyle = isDark ? "#f1f5f9" : "#1e293b";
          c.lineWidth = 1;
          c.beginPath();
          if (node.metadata.collapsed) {
            // Draw '+' sign
            c.moveTo(handlePos.x - radius * 0.5, handlePos.y);
            c.lineTo(handlePos.x + radius * 0.5, handlePos.y);
            c.moveTo(handlePos.x, handlePos.y - radius * 0.5);
            c.lineTo(handlePos.x, handlePos.y + radius * 0.5);
          } else {
            // Draw '-' sign
            c.moveTo(handlePos.x - radius * 0.5, handlePos.y);
            c.lineTo(handlePos.x + radius * 0.5, handlePos.y);
          }
          c.stroke();
          c.restore();
        }

        c.restore();
      });
    };

    const drawRoundedRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
    };

    // VISUAL MINI-MAP IN BOTTOM RIGHT CORNER
    const drawMiniMap = (c: CanvasRenderingContext2D, cw: number, ch: number, hidden: Set<string>) => {
      if (nodes.length === 0) return;

      const mw = 160; // Mini-map panel width
      const mh = 110; // Mini-map panel height
      const mx = cw - mw - 15; // Bottom-right corner offset
      const my = ch - mh - 15;

      c.save();
      // Panel Box border and fill
      c.fillStyle = config.theme === "dark" ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.85)";
      c.strokeStyle = config.theme === "dark" ? "#334155" : "#e2e8f0";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect ? c.roundRect(mx, my, mw, mh, 8) : c.rect(mx, my, mw, mh);
      c.fill();
      c.stroke();

      // Find boundaries of all nodes in map space
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x + n.width);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y + n.height);
      });

      // Pad map limits to keep boundary visible
      const mapW = (maxX - minX) || 1;
      const mapH = (maxY - minY) || 1;
      const padding = 60;
      const boundsW = mapW + padding * 2;
      const boundsH = mapH + padding * 2;
      const boundsX = minX - padding;
      const boundsY = minY - padding;

      // Scale map to fit minimap frame
      const scale = Math.min((mw - 10) / boundsW, (mh - 10) / boundsH);
      const offsetX = mx + (mw - boundsW * scale) / 2;
      const offsetY = my + (mh - boundsH * scale) / 2;

      // Render miniature tree lines
      c.strokeStyle = config.theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";
      c.lineWidth = 1;
      nodes.forEach(node => {
        if (hidden.has(node.id) || !node.parentId) return;
        const parent = nodeMap.get(node.parentId);
        if (!parent || hidden.has(parent.id)) return;

        const sx = offsetX + (parent.x + parent.width / 2 - boundsX) * scale;
        const sy = offsetY + (parent.y + parent.height / 2 - boundsY) * scale;
        const ex = offsetX + (node.x + node.width / 2 - boundsX) * scale;
        const ey = offsetY + (node.y + node.height / 2 - boundsY) * scale;

        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(ex, ey);
        c.stroke();
      });

      // Render miniature node dots
      nodes.forEach(node => {
        if (hidden.has(node.id)) return;

        const isSelected = selectedNodeIds.includes(node.id);
        const nx = offsetX + (node.x - boundsX) * scale;
        const ny = offsetY + (node.y - boundsY) * scale;
        const nw = node.width * scale;
        const nh = node.height * scale;

        c.fillStyle = isSelected 
          ? "#3b82f6" 
          : node.level === 0 
            ? "#ef4444" 
            : config.theme === "dark" 
              ? "#475569" 
              : "#cbd5e1";
        
        c.beginPath();
        c.rect(nx, ny, Math.max(2, nw), Math.max(2, nh));
        c.fill();
      });

      // Draw Viewport Red Frame (representing currently visible screen area)
      const viewWx1 = -panX / zoom;
      const viewWy1 = -panY / zoom;
      const viewWx2 = (cw - panX) / zoom;
      const viewWy2 = (ch - panY) / zoom;

      const vX = offsetX + (viewWx1 - boundsX) * scale;
      const vY = offsetY + (viewWy1 - boundsY) * scale;
      const vW = (viewWx2 - viewWx1) * scale;
      const vH = (viewWy2 - viewWy1) * scale;

      c.strokeStyle = "#ef4444"; // red frame
      c.lineWidth = 1.2;
      c.beginPath();
      c.rect(
        Math.max(mx, vX),
        Math.max(my, vY),
        Math.min(mw - (vX - mx), vW),
        Math.min(mh - (vY - my), vH)
      );
      c.stroke();

      c.restore();
    };

    animId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animId);
  }, [nodes, extraLinks, config, selectedNodeIds, searchState, zoom, panX, panY, isSelectingArea, selectionBox, isConnectionMode, connectionSourceId, connectionMousePos]);

  // Node formatting updates (color, custom emoji, reset manual, tags etc)
  const [selectedColor, setSelectedColor] = useState<string>("#3b82f6");
  const [selectedTextColor, setSelectedTextColor] = useState<string>("#ffffff");

  return (
    <div 
      ref={containerRef}
      className="flex-1 h-full relative overflow-hidden select-none"
      id="canvas-container"
    >
      {/* Absolute floating canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="block cursor-grab active:cursor-grabbing w-full h-full"
        id="mindmap-main-canvas"
      />

      {/* Floating Toolbar Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2.5 z-10" id="canvas-floating-controls">
        <div className="flex gap-1 p-1.5 bg-white dark:bg-slate-900 border-2 border-charcoal dark:border-slate-800 rounded-none shadow-[3px_3px_0px_rgba(26,26,26,1)] dark:shadow-none">
          <button
            onClick={centerMap}
            className="p-1.5 text-charcoal hover:bg-paper-dark dark:text-slate-400 dark:hover:text-slate-100 rounded-none transition cursor-pointer"
            title="Centralizar Mapa (Espaço)"
            id="center-map-btn"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom(prev => Math.min(3, prev * 1.15));
            }}
            className="p-1.5 text-charcoal hover:bg-paper-dark dark:text-slate-400 dark:hover:text-slate-100 rounded-none transition cursor-pointer"
            title="Aumentar Zoom (Ctrl + Roda do Mouse)"
            id="canvas-zoom-in-btn"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom(prev => Math.max(0.15, prev / 1.15));
            }}
            className="p-1.5 text-charcoal hover:bg-paper-dark dark:text-slate-400 dark:hover:text-slate-100 rounded-none transition cursor-pointer"
            title="Diminuir Zoom"
            id="canvas-zoom-out-btn"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onReorganize}
            className="p-1.5 text-charcoal hover:bg-paper-dark dark:text-slate-400 dark:hover:text-slate-100 rounded-none transition cursor-pointer"
            title="Reorganizar Layout"
            id="reorganize-layout-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Relationship Connection Trigger */}
        <div className="flex gap-1 p-1.5 bg-white dark:bg-slate-900 border-2 border-charcoal dark:border-slate-800 rounded-none shadow-[3px_3px_0px_rgba(26,26,26,1)] dark:shadow-none">
          <button
            onClick={() => {
              if (selectedNodeIds.length === 1) {
                setIsConnectionMode(true);
                setConnectionSourceId(selectedNodeIds[0]);
              } else {
                alert("Selecione EXATAMENTE um nó para iniciar a conexão extra.");
              }
            }}
            className={`p-1.5 rounded-none transition text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${isConnectionMode ? "bg-charcoal text-white dark:bg-white dark:text-charcoal" : "text-charcoal hover:bg-paper-dark dark:text-slate-400 dark:hover:text-slate-100"}`}
            title="Criar Ligação Visual Extra"
            id="create-extra-link-btn"
          >
            <Anchor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vincular Nós</span>
          </button>

          {selectedNodeIds.length > 0 && (
            <button
              onClick={() => {
                // Clear manual coordinates (resets to autolayout position)
                selectedNodeIds.forEach(id => {
                  onUpdateNodeMetadata(id, { manualX: undefined, manualY: undefined });
                });
              }}
              className="p-1.5 text-charcoal hover:bg-paper-dark dark:text-slate-400 dark:hover:text-slate-100 rounded-none transition cursor-pointer"
              title="Limpar Posição Manual (Fixar na árvore)"
              id="clear-manual-pos-btn"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Node Styling Panel (Opens only when node is selected) */}
      {selectedNodeIds.length > 0 && (
        <div 
          className="absolute top-4 right-4 bg-white dark:bg-slate-900 border-2 border-charcoal dark:border-slate-850 rounded-none shadow-[6px_6px_0px_rgba(26,26,26,0.15)] p-4.5 w-60 flex flex-col gap-3.5 z-10 transition-all duration-200 animate-in fade-in slide-in-from-top-1"
          id="node-properties-floating-panel"
        >
          <div className="flex items-center justify-between border-b border-charcoal dark:border-slate-800 pb-2">
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-charcoal dark:text-slate-300">Formatar Nós ({selectedNodeIds.length})</span>
            <button 
              onClick={() => onSelectNodes([])} 
              className="text-[9px] font-bold font-mono uppercase text-charcoal/50 hover:text-charcoal cursor-pointer"
              id="close-format-panel-btn"
            >
              [fechar]
            </button>
          </div>

          {/* Color Presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Cor de Fundo:</span>
            <div className="grid grid-cols-6 gap-1">
              {[
                "#ffffff", "#fecdd3", "#fed7aa", "#fef08a", "#d9f99d", "#bfdbfe",
                "#f3f4f6", "#f43f5e", "#f97316", "#eab308", "#84cc16", "#3b82f6",
                "#1a1a1a", "#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#64748b"
              ].map(color => (
                <button
                  key={color}
                  onClick={() => {
                    selectedNodeIds.forEach(id => {
                      onUpdateNodeMetadata(id, { color });
                    });
                  }}
                  className={`w-6 h-6 rounded-none border hover:scale-105 transition-all cursor-pointer ${color === "#1a1a1a" ? "border-white" : "border-charcoal/30 dark:border-slate-700"}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Text Color Selection */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Cor da Fonte:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Charcoal", value: "#1a1a1a" },
                { label: "Paper", value: "#f8f7f4" },
                { label: "Azul", value: "#1d4ed8" },
                { label: "Vermelho", value: "#b91c1c" }
              ].map(item => (
                <button
                  key={item.value}
                  onClick={() => {
                    selectedNodeIds.forEach(id => {
                      onUpdateNodeMetadata(id, { textColor: item.value });
                    });
                  }}
                  className="px-2 py-1 text-[9px] font-bold font-mono uppercase tracking-wider bg-white hover:bg-paper-dark dark:bg-slate-800 dark:hover:bg-slate-700 rounded-none border border-charcoal dark:border-slate-700 text-charcoal dark:text-slate-200 transition cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add custom Emoji or Icons preset */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Emoji Rápido:</span>
            <div className="flex flex-wrap gap-1">
              {["📌", "⭐", "✅", "❌", "🔥", "⚠️", "🚀", "📊", "⏳", "❤️"].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    selectedNodeIds.forEach(id => {
                      onUpdateNodeMetadata(id, { emoji });
                    });
                  }}
                  className="p-1 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-sm hover:scale-110 transition cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-charcoal-muted dark:bg-slate-800 my-0.5" />

          {/* Branch Actions (Copy / Paste / Duplicate / Delete) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-charcoal/50 dark:text-slate-400 font-bold font-mono uppercase tracking-wider">Ações de Ramo:</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onCopyBranch(selectedNodeIds[0])}
                className="py-1.5 px-2 bg-white hover:bg-paper-dark border border-charcoal dark:bg-slate-800 dark:hover:bg-slate-700 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1 text-charcoal dark:text-slate-300 transition cursor-pointer"
                title="Copiar Ramo Inteiro (Ctrl+C)"
              >
                <Copy className="w-3 h-3" /> Copiar
              </button>
              <button
                onClick={() => onPasteBranch(selectedNodeIds[0])}
                disabled={!canPaste}
                className={`py-1.5 px-2 border rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1 transition cursor-pointer ${canPaste ? "bg-white hover:bg-paper-dark border-charcoal text-charcoal dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300" : "bg-white/50 border-charcoal-muted text-charcoal/30 dark:text-slate-700 cursor-not-allowed"}`}
                title="Colar Ramo Sob Este (Ctrl+V)"
              >
                <Plus className="w-3 h-3" /> Colar
              </button>
              <button
                onClick={() => {
                  // Duplicate
                  onCopyBranch(selectedNodeIds[0]);
                  // paste as sibling under parent
                  const current = nodes.find(n => n.id === selectedNodeIds[0]);
                  if (current && current.parentId) {
                    onPasteBranch(current.parentId);
                  } else {
                    // is root, duplicate as root
                    onPasteBranch(""); // paste as root
                  }
                }}
                className="py-1.5 px-2 bg-white hover:bg-paper-dark border border-charcoal dark:bg-slate-800 dark:hover:bg-slate-700 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1 text-charcoal dark:text-slate-300 transition cursor-pointer"
                title="Duplicar Ramo (Ctrl+D)"
              >
                <Sparkles className="w-3 h-3" /> Duplicar
              </button>
              <button
                onClick={() => onDeleteNodes(selectedNodeIds)}
                className="py-1.5 px-2 bg-red-600 hover:bg-red-700 rounded-none text-[9px] font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1 text-white transition cursor-pointer shadow-[2px_2px_0px_rgba(26,26,26,0.15)]"
                title="Excluir Ramos (Delete)"
              >
                <Trash2 className="w-3 h-3" /> Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection indicator banner when in link creation mode */}
      {isConnectionMode && (
        <div className="absolute top-16 left-4 bg-charcoal text-white dark:bg-white dark:text-charcoal px-3 py-2 rounded-none border border-black dark:border-white shadow-[4px_4px_0px_rgba(26,26,26,0.15)] text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-2 animate-pulse z-10" id="connection-banner">
          <Anchor className="w-3.5 h-3.5" />
          <span>Selecione outro nó para conectar!</span>
          <button 
            onClick={() => {
              setIsConnectionMode(false);
              setConnectionSourceId(null);
            }} 
            className="ml-2 font-black hover:underline bg-white/20 dark:bg-black/20 px-2 py-0.5 rounded-none cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Extra Links Manager List (Shows only if extra links exist in the map) */}
      {extraLinks.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-900 border-2 border-charcoal dark:border-slate-800 p-3 rounded-none shadow-[4px_4px_0px_rgba(0,0,0,0.1)] w-60 max-h-48 overflow-auto z-10" id="extra-links-manager-panel">
          <div className="flex items-center gap-1.5 border-b border-charcoal-muted dark:border-slate-800 pb-1.5 mb-2">
            <Link2 className="w-3.5 h-3.5 text-charcoal/60 dark:text-slate-400" />
            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-charcoal dark:text-slate-300">Ligações Extras ({extraLinks.length})</span>
          </div>
          <div className="flex flex-col gap-1">
            {extraLinks.map(link => {
              const fromN = nodeMap.get(link.fromId);
              const toN = nodeMap.get(link.toId);
              if (!fromN || !toN) return null;

              return (
                <div key={link.id} className="flex items-center justify-between gap-2 p-1 hover:bg-paper-dark dark:hover:bg-slate-800 rounded-none text-[10px] font-mono transition">
                  <span className="truncate text-charcoal dark:text-slate-300 flex-1">
                    <strong>{fromN.text}</strong> → <strong>{toN.text}</strong>
                  </span>
                  <button
                    onClick={() => onDeleteExtraLink(link.id)}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 transition rounded-none cursor-pointer"
                    title="Remover Ligação Extra"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Note hovered Tooltip (Rendered absolutely above everything based on state) */}
      {hoveredNode && hoveredNode.metadata.notes && (
        <div 
          className="fixed bg-white dark:bg-slate-900 border-2 border-charcoal dark:border-slate-800 text-charcoal dark:text-slate-100 rounded-none shadow-[6px_6px_0px_rgba(26,26,26,0.15)] p-3 max-w-xs text-xs z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            left: `${tooltipPos.x}px`, 
            top: `${tooltipPos.y}px` 
          }}
          id="notes-hover-tooltip"
        >
          <div className="font-bold text-charcoal/60 dark:text-slate-400 mb-1.5 flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider border-b border-charcoal-muted dark:border-slate-850 pb-1">
            <span>Observação</span>
          </div>
          <div className="leading-relaxed font-sans text-[11px] whitespace-pre-wrap">{hoveredNode.metadata.notes}</div>
        </div>
      )}
    </div>
  );
}
