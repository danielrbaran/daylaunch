#!/usr/bin/env node

/**
 * DayLaunch MCP Server
 * 
 * Exposes tools and resources to LLM for:
 * - Journal entry queries
 * - Daily plan creation
 * - Capacity assessment
 * - Feedback analysis
 * - Pattern insights
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as journalTools from './tools/journalTools.js';
import * as planTools from './tools/planTools.js';
import * as feedbackTools from './tools/feedbackTools.js';
import prisma from './services/database.js';

// Initialize MCP server
const server = new Server(
  {
    name: 'daylaunch-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_journal_entries',
        description: 'Retrieve journal entries for analysis within a date range',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            limit: { type: 'number', description: 'Maximum number of entries to return' },
          },
          required: ['start_date', 'end_date'],
        },
      },
      {
        name: 'get_recent_mental_state',
        description: 'Get summarized mental state from recent journal entries',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'number', default: 7, description: 'Number of days to look back' },
          },
        },
      },
      {
        name: 'query_capacity_indicators',
        description: 'Assess current capacity for planning based on recent data',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date', description: 'Date to assess capacity for' },
          },
          required: ['date'],
        },
      },
      {
        name: 'get_task_history',
        description: 'Get historical task completion patterns',
        inputSchema: {
          type: 'object',
          properties: {
            category_id: { type: 'string', description: 'Optional category filter' },
            days: { type: 'number', default: 30, description: 'Lookback period in days' },
          },
        },
      },
      {
        name: 'create_daily_plan',
        description: 'Generate and store a daily plan with tasks',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            plan_data: {
              type: 'object',
              description: 'Plan data including tasks, capacity score, and mental state summary',
            },
          },
          required: ['date', 'plan_data'],
        },
      },
      {
        name: 'get_recent_feedback',
        description: 'Retrieve recent end-of-day feedback for learning',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'number', default: 14, description: 'Lookback period' },
            category_id: { type: 'string', description: 'Optional category filter' },
          },
        },
      },
      {
        name: 'get_pattern_insights',
        description: 'Get identified patterns from historical data',
        inputSchema: {
          type: 'object',
          properties: {
            pattern_type: { type: 'string', description: 'Optional pattern type filter' },
            min_confidence: { type: 'number', description: 'Minimum confidence threshold' },
          },
        },
      },
      {
        name: 'save_daily_feedback',
        description: 'Store end-of-day feedback and extract insights',
        inputSchema: {
          type: 'object',
          properties: {
            daily_plan_id: { type: 'string' },
            overall_rating: { type: 'string', enum: ['about_right', 'too_much', 'one_area'] },
            affected_category_id: { type: 'string' },
            text_elaboration: { type: 'string' },
            activity_log: { type: 'string' },
          },
          required: ['daily_plan_id', 'overall_rating'],
        },
      },
    ],
  };
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'journal://entries/{date}',
        name: 'Journal Entry',
        description: 'Specific journal entry by date',
        mimeType: 'application/json',
      },
      {
        uri: 'plan://daily/{date}',
        name: 'Daily Plan',
        description: 'Daily plan for a specific date',
        mimeType: 'application/json',
      },
      {
        uri: 'stats://completion/{category_id}',
        name: 'Completion Statistics',
        description: 'Completion statistics for a category',
        mimeType: 'application/json',
      },
      {
        uri: 'capacity://indicators/{date}',
        name: 'Capacity Indicators',
        description: 'Capacity assessment for a date',
        mimeType: 'application/json',
      },
      {
        uri: 'feedback://daily/{date}',
        name: 'Daily Feedback',
        description: 'End-of-day feedback for a specific date',
        mimeType: 'application/json',
      },
      {
        uri: 'patterns://insights/{type}',
        name: 'Pattern Insights',
        description: 'Pattern insights by type',
        mimeType: 'application/json',
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'get_journal_entries':
        result = await journalTools.getJournalEntries(args);
        break;

      case 'get_recent_mental_state':
        result = await journalTools.getRecentMentalState(args);
        break;

      case 'query_capacity_indicators':
        result = await planTools.queryCapacityIndicators(args);
        break;

      case 'get_task_history':
        result = await planTools.getTaskHistory(args);
        break;

      case 'create_daily_plan':
        result = await planTools.createDailyPlan(args);
        break;

      case 'get_recent_feedback':
        result = await feedbackTools.getRecentFeedback(args);
        break;

      case 'get_pattern_insights':
        result = await feedbackTools.getPatternInsights(args);
        break;

      case 'save_daily_feedback':
        result = await feedbackTools.saveDailyFeedback(args);
        break;

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    // Parse URI pattern: journal://entries/{date}
    if (uri.startsWith('journal://entries/')) {
      const dateStr = uri.replace('journal://entries/', '');
      const date = new Date(dateStr);
      
      const entries = await prisma.journalEntry.findMany({
        where: {
          timestamp: {
            gte: new Date(date.setHours(0, 0, 0, 0)),
            lt: new Date(date.setHours(23, 59, 59, 999)),
          },
        },
      });

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(entries, null, 2),
          },
        ],
      };
    }

    // Parse URI pattern: plan://daily/{date}
    if (uri.startsWith('plan://daily/')) {
      const dateStr = uri.replace('plan://daily/', '');
      const date = new Date(dateStr);
      
      const plan = await prisma.dailyPlan.findFirst({
        where: {
          date: {
            gte: new Date(date.setHours(0, 0, 0, 0)),
            lt: new Date(date.setHours(23, 59, 59, 999)),
          },
        },
        include: {
          tasks: {
            include: {
              category: true,
            },
          },
          feedback: true,
        },
      });

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(plan || { message: 'No plan found for this date' }, null, 2),
          },
        ],
      };
    }

    // Default: return error
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            error: `Resource handler not implemented for: ${uri}`,
          }),
        },
      ],
    };
  } catch (error: any) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            error: error.message,
          }),
        },
      ],
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DayLaunch MCP Server running on stdio');
}

main().catch(console.error);
