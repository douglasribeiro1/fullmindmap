import { MindMapNode, AppConfig, LayoutType } from "../types";

// Helper to compute node dimensions based on text content and metadata
export function computeNodeDimensions(
  node: MindMapNode,
  config: AppConfig
): { width: number; height: number } {
  const { fontSize, borderRadius, nodeShape } = config;
  
  // Base text length estimation
  const textLen = node.text.length;
  const charWidth = fontSize * 0.55;
  
  // Width elements
  let contentWidth = textLen * charWidth;
  if (node.metadata.emoji) contentWidth += fontSize + 12;
  if (node.metadata.hasCheckbox) contentWidth += fontSize + 12;
  
  // Padding
  const padX = fontSize * 1.4;
  let width = Math.max(120, contentWidth + padX);
  
  // Height elements
  let height = fontSize * 1.8;
  if (node.metadata.tags && node.metadata.tags.length > 0) {
    height += fontSize * 1.1;
  }
  if (node.metadata.notes) {
    height += fontSize * 0.8;
  }

  // Adjustments based on shape
  if (nodeShape === "capsule") {
    width += fontSize;
  } else if (nodeShape === "ellipse") {
    width = Math.max(width * 1.2, height * 1.5);
    height *= 1.2;
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

// Layout orchestrator
export function applyLayout(
  nodes: MindMapNode[],
  layoutType: LayoutType,
  config: AppConfig
): MindMapNode[] {
  if (nodes.length === 0) return [];

  // 1. First, compute sizes for all nodes
  const nodesWithSizes = nodes.map(node => {
    const { width, height } = computeNodeDimensions(node, config);
    return { ...node, width, height };
  });

  // Find root nodes (level === 0, or parentId is null or parent is missing)
  const rootNodes = nodesWithSizes.filter(n => n.parentId === null);
  
  if (rootNodes.length === 0 && nodesWithSizes.length > 0) {
    // Fallback: make the first node a root
    nodesWithSizes[0].parentId = null;
    nodesWithSizes[0].level = 0;
    rootNodes.push(nodesWithSizes[0]);
  }

  let positionedNodes: MindMapNode[] = [];

  switch (layoutType) {
    case "vertical":
      positionedNodes = layoutVertical(nodesWithSizes, rootNodes, config);
      break;
    case "radial":
      positionedNodes = layoutRadial(nodesWithSizes, rootNodes, config);
      break;
    case "organogram":
      positionedNodes = layoutOrganogram(nodesWithSizes, rootNodes, config);
      break;
    case "organic":
      positionedNodes = layoutOrganic(nodesWithSizes, rootNodes, config);
      break;
    case "flowchart":
      positionedNodes = layoutFlowchart(nodesWithSizes, rootNodes, config);
      break;
    case "horizontal":
    default:
      positionedNodes = layoutHorizontal(nodesWithSizes, rootNodes, config);
      break;
  }

  // Apply manual positions on top of layout if they exist
  return positionedNodes.map(node => {
    if (node.metadata.manualX !== undefined && node.metadata.manualY !== undefined) {
      return {
        ...node,
        x: node.metadata.manualX,
        y: node.metadata.manualY
      };
    }
    return node;
  });
}

// 1. HORIZONTAL TREE LAYOUT (Left to Right)
function layoutHorizontal(
  nodes: MindMapNode[],
  roots: MindMapNode[],
  config: AppConfig
): MindMapNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const levelSpacing = config.levelSpacing + 50;
  const siblingSpacing = config.siblingSpacing + 15;

  // Compute subtree height for each node recursively
  const subtreeHeights = new Map<string, number>();
  
  function getSubtreeHeight(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node) return 0;
    if (node.metadata.collapsed || node.childrenIds.length === 0) {
      subtreeHeights.set(nodeId, node.height);
      return node.height;
    }
    let childrenHeightSum = 0;
    node.childrenIds.forEach(childId => {
      childrenHeightSum += getSubtreeHeight(childId);
    });
    const totalSpacing = (node.childrenIds.length - 1) * siblingSpacing;
    const finalHeight = Math.max(node.height, childrenHeightSum + totalSpacing);
    subtreeHeights.set(nodeId, finalHeight);
    return finalHeight;
  }

  roots.forEach(root => getSubtreeHeight(root.id));

  // Recursively position nodes
  function positionNode(nodeId: string, currentX: number, startY: number) {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    node.x = currentX;
    const totalSubtreeH = subtreeHeights.get(nodeId) || node.height;
    node.y = startY + totalSubtreeH / 2; // Centered vertically in its subtree space

    if (!node.metadata.collapsed && node.childrenIds.length > 0) {
      let childYOffset = startY;
      const nextX = currentX + node.width + levelSpacing;
      
      node.childrenIds.forEach(childId => {
        const childSubtreeH = subtreeHeights.get(childId) || 0;
        positionNode(childId, nextX, childYOffset);
        childYOffset += childSubtreeH + siblingSpacing;
      });
    }
  }

  // Layout all roots side-by-side (vertically stacked)
  let rootYOffset = 0;
  roots.forEach(root => {
    const rootSubtreeH = subtreeHeights.get(root.id) || root.height;
    positionNode(root.id, 0, rootYOffset);
    rootYOffset += rootSubtreeH + siblingSpacing * 2;
  });

  // Center entire map around (0,0)
  centerNodes(nodes);
  return nodes;
}

// 2. VERTICAL TREE LAYOUT (Top to Bottom)
function layoutVertical(
  nodes: MindMapNode[],
  roots: MindMapNode[],
  config: AppConfig
): MindMapNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const levelSpacing = config.levelSpacing + 50;
  const siblingSpacing = config.siblingSpacing + 20;

  const subtreeWidths = new Map<string, number>();

  function getSubtreeWidth(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node) return 0;
    if (node.metadata.collapsed || node.childrenIds.length === 0) {
      subtreeWidths.set(nodeId, node.width);
      return node.width;
    }
    let childrenWidthSum = 0;
    node.childrenIds.forEach(childId => {
      childrenWidthSum += getSubtreeWidth(childId);
    });
    const totalSpacing = (node.childrenIds.length - 1) * siblingSpacing;
    const finalWidth = Math.max(node.width, childrenWidthSum + totalSpacing);
    subtreeWidths.set(nodeId, finalWidth);
    return finalWidth;
  }

  roots.forEach(root => getSubtreeWidth(root.id));

  function positionNode(nodeId: string, startX: number, currentY: number) {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const totalSubtreeW = subtreeWidths.get(nodeId) || node.width;
    node.x = startX + totalSubtreeW / 2; // Center horizontally
    node.y = currentY;

    if (!node.metadata.collapsed && node.childrenIds.length > 0) {
      let childXOffset = startX;
      const nextY = currentY + node.height + levelSpacing;

      node.childrenIds.forEach(childId => {
        const childSubtreeW = subtreeWidths.get(childId) || 0;
        positionNode(childId, childXOffset, nextY);
        childXOffset += childSubtreeW + siblingSpacing;
      });
    }
  }

  let rootXOffset = 0;
  roots.forEach(root => {
    const rootSubtreeW = subtreeWidths.get(root.id) || root.width;
    positionNode(root.id, rootXOffset, 0);
    rootXOffset += rootSubtreeW + siblingSpacing * 2;
  });

  centerNodes(nodes);
  return nodes;
}

// 3. ORGANOGRAM LAYOUT (Structured Vertical Tree with Orthogonal paths)
// Same node positioning as Vertical, but connects nodes with orthogonal shapes
function layoutOrganogram(
  nodes: MindMapNode[],
  roots: MindMapNode[],
  config: AppConfig
): MindMapNode[] {
  // Positioning matches vertical tree layout
  const positioned = layoutVertical(nodes, roots, config);
  return positioned;
}

// 4. RADIAL LAYOUT
function layoutRadial(
  nodes: MindMapNode[],
  roots: MindMapNode[],
  config: AppConfig
): MindMapNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const levelSpacing = config.levelSpacing + 80;

  // Radial layout assigns angular slices to children
  function positionRadialNode(
    nodeId: string,
    centerX: number,
    centerY: number,
    startAngle: number,
    endAngle: number,
    currentRadius: number
  ) {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    // Center node in its angular slice
    const angle = (startAngle + endAngle) / 2;
    node.x = centerX + currentRadius * Math.cos(angle);
    node.y = centerY + currentRadius * Math.sin(angle);

    if (!node.metadata.collapsed && node.childrenIds.length > 0) {
      const children = node.childrenIds.map(cid => nodeMap.get(cid)).filter(Boolean) as MindMapNode[];
      const childCount = children.length;
      const angleSpan = endAngle - startAngle;
      const sliceSize = angleSpan / childCount;

      children.forEach((child, idx) => {
        const cStart = startAngle + idx * sliceSize;
        const cEnd = cStart + sliceSize;
        positionRadialNode(
          child.id,
          centerX,
          centerY,
          cStart,
          cEnd,
          currentRadius + levelSpacing
        );
      });
    }
  }

  // Handle roots layout
  if (roots.length === 1) {
    // Single root in center, children spread 360 degrees
    const root = roots[0];
    root.x = 0;
    root.y = 0;
    
    if (!root.metadata.collapsed && root.childrenIds.length > 0) {
      const childCount = root.childrenIds.length;
      const sliceSize = (Math.PI * 2) / childCount;
      root.childrenIds.forEach((childId, idx) => {
        const cStart = idx * sliceSize;
        const cEnd = cStart + sliceSize;
        positionRadialNode(childId, 0, 0, cStart, cEnd, levelSpacing);
      });
    }
  } else {
    // Multiple roots laid out in a circle
    const rootCount = roots.length;
    const rootRadius = levelSpacing * 1.5;
    const rootSlice = (Math.PI * 2) / rootCount;
    
    roots.forEach((root, idx) => {
      const angle = idx * rootSlice;
      root.x = rootRadius * Math.cos(angle);
      root.y = rootRadius * Math.sin(angle);
      
      if (!root.metadata.collapsed && root.childrenIds.length > 0) {
        // Spread children outwards in an arc (+/- 45 degrees from root angle)
        const arcSpread = Math.PI / 2; // 90 degrees
        const startAngle = angle - arcSpread / 2;
        const endAngle = angle + arcSpread / 2;
        const childCount = root.childrenIds.length;
        const sliceSize = arcSpread / childCount;
        
        root.childrenIds.forEach((childId, cIdx) => {
          const cStart = startAngle + cIdx * sliceSize;
          const cEnd = cStart + sliceSize;
          positionRadialNode(childId, root.x, root.y, cStart, cEnd, levelSpacing);
        });
      }
    });
  }

  centerNodes(nodes);
  return nodes;
}

// 5. ORGANIC LAYOUT (Radial wave with overlap relaxation force)
function layoutOrganic(
  nodes: MindMapNode[],
  roots: MindMapNode[],
  config: AppConfig
): MindMapNode[] {
  // Step 1: Start with a radial-like arrangement
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const levelSpacing = config.levelSpacing + 70;

  function initialPlacement(nodeId: string, px: number, py: number, parentAngle: number, currentLevel: number) {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (currentLevel === 0) {
      node.x = 0;
      node.y = 0;
    } else {
      // Add slight jitter/variation for organic appearance
      const angle = parentAngle + (Math.random() - 0.5) * 0.4;
      node.x = px + levelSpacing * Math.cos(angle);
      node.y = py + levelSpacing * Math.sin(angle);
    }

    if (!node.metadata.collapsed && node.childrenIds.length > 0) {
      const childCount = node.childrenIds.length;
      let angleRange = Math.PI; // 180 deg spread for children
      if (currentLevel === 0) angleRange = Math.PI * 2; // 360 deg for main root
      
      const startAngle = parentAngle - angleRange / 2;
      const angleStep = childCount > 1 ? angleRange / (childCount - 1) : 0;

      node.childrenIds.forEach((childId, idx) => {
        const childAngle = childCount > 1 ? startAngle + idx * angleStep : parentAngle;
        initialPlacement(childId, node.x, node.y, childAngle, currentLevel + 1);
      });
    }
  }

  if (roots.length === 1) {
    initialPlacement(roots[0].id, 0, 0, 0, 0);
  } else {
    roots.forEach((root, idx) => {
      const angle = (idx / roots.length) * Math.PI * 2;
      const rx = levelSpacing * 1.5 * Math.cos(angle);
      const ry = levelSpacing * 1.5 * Math.sin(angle);
      root.x = rx;
      root.y = ry;
      initialPlacement(root.id, rx, ry, angle, 0);
    });
  }

  // Step 2: High-speed overlap resolution simulation (Relaxation)
  // Run 50 quick force steps to push nodes apart and keep connections springy
  const iterations = 60;
  for (let step = 0; step < iterations; step++) {
    // 2.1 Spring forces towards parents (pull nodes back to connections)
    nodes.forEach(node => {
      if (node.parentId) {
        const p = nodeMap.get(node.parentId);
        if (p) {
          const dx = p.x - node.x;
          const dy = p.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const targetDist = levelSpacing;
          if (dist > 0) {
            const force = (dist - targetDist) * 0.15; // spring constant
            node.x += (dx / dist) * force;
            node.y += (dy / dist) * force;
          }
        }
      }
    });

    // 2.2 Repulsive forces between any two nodes to prevent overlapping
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Safety margin based on sizes
        const minDist = (n1.width + n2.width) / 2 + 30;
        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          // Push away
          const forceX = (dx / dist) * overlap * 0.25;
          const forceY = (dy / dist) * overlap * 0.25;
          
          if (n1.parentId) { // Roots stay near center
            n1.x -= forceX;
            n1.y -= forceY;
          }
          if (n2.parentId) {
            n2.x += forceX;
            n2.y += forceY;
          }
        }
      }
    }
  }

  centerNodes(nodes);
  return nodes;
}

// 6. FLOWCHART LAYOUT (Horizontal Sequential Pipeline)
function layoutFlowchart(
  nodes: MindMapNode[],
  roots: MindMapNode[],
  config: AppConfig
): MindMapNode[] {
  // Arranges nodes strictly level-by-level in a left-to-right pipe
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const levelSpacing = config.levelSpacing + 70;
  const siblingSpacing = config.siblingSpacing + 20;

  // Group nodes by level
  const levels: Record<number, string[]> = {};
  let maxLevel = 0;

  nodes.forEach(node => {
    if (!levels[node.level]) {
      levels[node.level] = [];
    }
    levels[node.level].push(node.id);
    if (node.level > maxLevel) maxLevel = node.level;
  });

  // Lay out column-by-column
  for (let l = 0; l <= maxLevel; l++) {
    const nodeIds = levels[l] || [];
    const count = nodeIds.length;
    
    // Total height of this column
    let colHeight = 0;
    const heights = nodeIds.map(nid => {
      const n = nodeMap.get(nid)!;
      colHeight += n.height;
      return n.height;
    });
    const totalSpacing = (count - 1) * siblingSpacing;
    const startY = -(colHeight + totalSpacing) / 2;

    let yOffset = startY;
    nodeIds.forEach(nid => {
      const n = nodeMap.get(nid)!;
      n.x = l * (150 + levelSpacing);
      n.y = yOffset + n.height / 2;
      yOffset += n.height + siblingSpacing;
    });
  }

  centerNodes(nodes);
  return nodes;
}

// Helper to center the entire layout around the viewport (0, 0)
function centerNodes(nodes: MindMapNode[]) {
  if (nodes.length === 0) return;
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  nodes.forEach(n => {
    n.x -= centerX;
    n.y -= centerY;
  });
}
