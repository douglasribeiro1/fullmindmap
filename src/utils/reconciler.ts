import { TempNode } from "./textParser";
import { MindMapNode, NodeMetadata } from "../types";

export function reconcileTree(
  tempNodes: TempNode[],
  oldNodes: MindMapNode[],
  savedMetadata: Record<string, NodeMetadata>
): { nodes: MindMapNode[]; updatedMetadata: Record<string, NodeMetadata> } {
  const reconciledNodes: MindMapNode[] = [];
  const updatedMetadata: Record<string, NodeMetadata> = { ...savedMetadata };
  
  // Track matched old node IDs to avoid double matching
  const matchedOldIds = new Set<string>();

  // 1st pass: Match by line number and exact rawText (highly stable editing)
  const tempMatches = new Map<string, string>(); // tempId -> stableId

  tempNodes.forEach(temp => {
    const matchingOld = oldNodes.find(old => 
      old.lineNumber === temp.lineNumber && 
      old.rawText === temp.rawText &&
      !matchedOldIds.has(old.id)
    );
    if (matchingOld) {
      tempMatches.set(temp.tempId, matchingOld.id);
      matchedOldIds.add(matchingOld.id);
    }
  });

  // 2nd pass: Match by exact rawText and level nearby (moved lines or lines shifted)
  tempNodes.forEach(temp => {
    if (tempMatches.has(temp.tempId)) return;
    const matchingOld = oldNodes.find(old => 
      old.rawText === temp.rawText &&
      Math.abs(old.lineNumber - temp.lineNumber) <= 5 &&
      !matchedOldIds.has(old.id)
    );
    if (matchingOld) {
      tempMatches.set(temp.tempId, matchingOld.id);
      matchedOldIds.add(matchingOld.id);
    }
  });

  // 3rd pass: Match by exact rawText anywhere
  tempNodes.forEach(temp => {
    if (tempMatches.has(temp.tempId)) return;
    const matchingOld = oldNodes.find(old => 
      old.rawText === temp.rawText && 
      !matchedOldIds.has(old.id)
    );
    if (matchingOld) {
      tempMatches.set(temp.tempId, matchingOld.id);
      matchedOldIds.add(matchingOld.id);
    }
  });

  // 4th pass: Match by exact lineNumber and level (editing the text of a node in-place)
  tempNodes.forEach(temp => {
    if (tempMatches.has(temp.tempId)) return;
    const matchingOld = oldNodes.find(old => 
      old.lineNumber === temp.lineNumber && 
      old.level === temp.level &&
      !matchedOldIds.has(old.id)
    );
    if (matchingOld) {
      tempMatches.set(temp.tempId, matchingOld.id);
      matchedOldIds.add(matchingOld.id);
    }
  });

  // 5th pass: Assign new IDs for remaining unmatched nodes
  tempNodes.forEach(temp => {
    if (tempMatches.has(temp.tempId)) return;
    const newId = `node_${Math.random().toString(36).substring(2, 11)}`;
    tempMatches.set(temp.tempId, newId);
  });

  // Now, build the final MindMapNode list and sync metadata
  const tempIdToStableId = (tempId: string | null) => tempId ? (tempMatches.get(tempId) || tempId) : null;

  tempNodes.forEach(temp => {
    const stableId = tempIdToStableId(temp.tempId)!;
    const parentId = tempIdToStableId(temp.parentId);
    const childrenIds = temp.childrenIds.map(cid => tempIdToStableId(cid)!);

    // Ensure we have metadata in the dictionary
    if (!updatedMetadata[stableId]) {
      updatedMetadata[stableId] = { id: stableId };
    }

    // Merge automatic attributes extracted from parser into the persistent metadata if needed
    const meta = updatedMetadata[stableId];
    
    // Extracted values take precedence if present
    if (temp.emoji) meta.emoji = temp.emoji;
    if (temp.link) meta.link = temp.link;
    if (temp.tags) meta.tags = temp.tags;
    if (temp.notes) meta.notes = temp.notes;
    
    if (temp.hasCheckbox) {
      meta.hasCheckbox = true;
      // Only overwrite checkbox value if it's explicitly typed differently or not set yet
      if (meta.checked === undefined || (temp.checked !== undefined && temp.checked !== meta.checked)) {
        meta.checked = temp.checked;
      }
    } else if (meta.hasCheckbox === undefined) {
      meta.hasCheckbox = false;
    }

    reconciledNodes.push({
      id: stableId,
      text: temp.text,
      rawText: temp.rawText,
      indent: temp.indent,
      level: temp.level,
      parentId,
      childrenIds,
      lineNumber: temp.lineNumber,
      metadata: meta,
      // Coordinates to be computed by layout
      x: 0,
      y: 0,
      width: 0,
      height: 0
    });
  });

  // Clean up metadata keys for nodes that are no longer in the map
  const activeIds = new Set(reconciledNodes.map(n => n.id));
  Object.keys(updatedMetadata).forEach(id => {
    if (!activeIds.has(id)) {
      delete updatedMetadata[id];
    }
  });

  return {
    nodes: reconciledNodes,
    updatedMetadata
  };
}
