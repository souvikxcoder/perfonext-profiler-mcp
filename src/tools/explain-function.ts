import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getProfile } from '../store.js';
import { getCallersOf, getCalleesOf } from '../parser/call-tree.js';

export function registerExplainFunction(server: McpServer) {
  server.registerTool('explain_function', {
    title: 'Explain Function',
    description: 'Returns detailed timing info for a specific function: self-time, total-time, callers, and callees. Use this to understand why a function is slow.',
    inputSchema: {
      profileId: z.string().describe('Profile ID returned by load_profile'),
      functionName: z.string().describe('Exact function name to look up'),
    },
  }, async ({ profileId, functionName }) => {
    const profile = getProfile(profileId);
    if (!profile) {
      return {
        content: [{ type: 'text' as const, text: `Error: Profile "${profileId}" not found.` }],
        isError: true,
      };
    }

    // Find all nodes matching this function name
    const matches = Array.from(profile.nodes.values())
      .filter(n => n.callFrame.functionName === functionName);

    if (matches.length === 0) {
      return {
        content: [{ type: 'text' as const, text: `Function "${functionName}" not found in profile. Check the exact name using get_hotspots.` }],
        isError: true,
      };
    }

    const aggregated = {
      functionName,
      occurrences: matches.length,
      selfTime: matches.reduce((sum, n) => sum + n.selfTime, 0),
      totalTime: matches.reduce((sum, n) => sum + n.totalTime, 0),
      hitCount: matches.reduce((sum, n) => sum + n.hitCount, 0),
      locations: matches.map(n => ({
        file: n.callFrame.url,
        line: n.callFrame.lineNumber + 1,
      })),
    };

    const callers = getCallersOf(profile, functionName).map(c => ({
      function: c.callFrame.functionName || '(anonymous)',
      file: c.callFrame.url,
      totalTime: `${(c.totalTime / 1000).toFixed(1)}ms`,
    }));

    const callees = getCalleesOf(profile, functionName).map(c => ({
      function: c.callFrame.functionName || '(anonymous)',
      file: c.callFrame.url,
      selfTime: `${(c.selfTime / 1000).toFixed(1)}ms`,
      totalTime: `${(c.totalTime / 1000).toFixed(1)}ms`,
    }));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ...aggregated,
          selfTime: `${(aggregated.selfTime / 1000).toFixed(1)}ms`,
          selfPercent: `${((aggregated.selfTime / profile.totalDuration) * 100).toFixed(1)}%`,
          totalTime: `${(aggregated.totalTime / 1000).toFixed(1)}ms`,
          totalPercent: `${((aggregated.totalTime / profile.totalDuration) * 100).toFixed(1)}%`,
          callers,
          callees,
        }, null, 2),
      }],
    };
  });
}
