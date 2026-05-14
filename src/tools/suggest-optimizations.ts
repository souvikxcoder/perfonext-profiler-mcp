import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getProfile } from '../store.js';
import { getHotspots } from '../parser/call-tree.js';

interface Suggestion {
  function: string;
  file: string;
  line: number;
  selfPercent: string;
  issue: string;
  suggestion: string;
}

export function registerSuggestOptimizations(server: McpServer) {
  server.registerTool('suggest_optimizations', {
    title: 'Suggest Optimizations',
    description: 'Analyzes the profile and returns deterministic, pattern-based optimization suggestions for the hottest functions.',
    inputSchema: {
      profileId: z.string().describe('Profile ID returned by load_profile'),
      limit: z.number().min(1).max(20).default(5).describe('Number of functions to analyze'),
    },
  }, async ({ profileId, limit }) => {
    const profile = getProfile(profileId);
    if (!profile) {
      return {
        content: [{ type: 'text' as const, text: `Error: Profile "${profileId}" not found.` }],
        isError: true,
      };
    }

    const hotspots = getHotspots(profile, limit);
    const suggestions: Suggestion[] = [];

    for (const h of hotspots) {
      const patterns = detectPatterns(h, profile);
      suggestions.push({
        function: h.functionName,
        file: h.url,
        line: h.lineNumber,
        selfPercent: `${h.selfPercent.toFixed(1)}%`,
        issue: patterns.issue,
        suggestion: patterns.suggestion,
      });
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(suggestions, null, 2),
      }],
    };
  });
}

function detectPatterns(
  hotspot: { functionName: string; url: string; selfPercent: number; totalPercent: number; hitCount: number; selfTime: number; totalTime: number },
  profile: { nodes: Map<number, { callFrame: { functionName: string }; selfTime: number; totalTime: number; hitCount: number; children: number[] }> },
): { issue: string; suggestion: string } {
  const fnName = hotspot.functionName;

  // Pattern: GC-related functions
  if (fnName.includes('GC') || fnName.includes('gc') || fnName.includes('Scavenge') || fnName.includes('MarkCompact')) {
    return {
      issue: 'Garbage collection is consuming significant CPU time',
      suggestion: 'Reduce object allocations in hot paths. Consider object pooling, pre-allocating buffers, or reusing objects instead of creating new ones.',
    };
  }

  // Pattern: JSON parsing/stringify
  if (fnName === 'JSON.parse' || fnName === 'JSON.stringify' || fnName.includes('JSON')) {
    return {
      issue: 'JSON serialization/deserialization is a bottleneck',
      suggestion: 'Consider streaming JSON parsers (e.g., json-stream), schema-based serializers (e.g., protobuf, avro), or caching parsed results.',
    };
  }

  // Pattern: RegExp
  if (fnName.includes('RegExp') || fnName.includes('regexp') || fnName.includes('match') || fnName.includes('replace')) {
    return {
      issue: 'Regular expression execution is expensive',
      suggestion: 'Pre-compile regex patterns outside loops. Consider replacing complex regex with string operations. Check for catastrophic backtracking.',
    };
  }

  // Pattern: Compilation/optimization
  if (fnName.includes('Compile') || fnName.includes('Optimize') || fnName.includes('compile') || fnName.includes('Recompile')) {
    return {
      issue: 'V8 is spending time compiling/optimizing code',
      suggestion: 'Functions may be getting deoptimized repeatedly. Avoid polymorphic call sites, hidden class transitions, and arguments object usage in hot functions.',
    };
  }

  // Pattern: I/O related
  if (fnName.includes('read') || fnName.includes('write') || fnName.includes('Read') || fnName.includes('Write') || fnName.includes('Stream')) {
    return {
      issue: 'I/O operations are consuming CPU time',
      suggestion: 'Consider batching I/O operations, using buffered streams, or moving to async I/O if using sync APIs.',
    };
  }

  // Pattern: High hit count with significant self-time (a frequently called leaf function)
  const matchingNodes = Array.from(profile.nodes.values()).filter(n => n.callFrame.functionName === fnName);
  const totalChildren = matchingNodes.reduce((sum, n) => sum + n.children.length, 0);
  const isLeaf = totalChildren === 0;

  if (isLeaf && hotspot.hitCount > 100) {
    return {
      issue: `Leaf function called frequently (${hotspot.hitCount} hits) with high self-time`,
      suggestion: 'This function is CPU-bound. Consider algorithmic optimizations, caching results (memoization), or reducing call frequency.',
    };
  }

  // Pattern: Self-time much lower than total-time (orchestrator)
  if (hotspot.selfPercent < hotspot.totalPercent * 0.1) {
    return {
      issue: 'Function is an orchestrator — most time is in callees',
      suggestion: 'Optimize the callees rather than this function itself. Check if unnecessary work is being delegated.',
    };
  }

  // Default
  return {
    issue: `Function consumes ${hotspot.selfPercent.toFixed(1)}% of CPU time`,
    suggestion: 'Review this function for algorithmic complexity, unnecessary allocations, or repeated computations that could be cached.',
  };
}
