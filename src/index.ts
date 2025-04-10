#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  Tool, // Corrected type name
  CallToolResultSchema, // Corrected type name based on error suggestion
  ListToolsResultSchema, // Corrected type name based on error suggestion
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { z } from 'zod';

// --- Environment Variable Check ---
const API_KEY = process.env.DEEPL_API_KEY;
if (!API_KEY) {
  console.error('DEEPL_API_KEY environment variable is not set.');
  process.exit(1); // Exit if API key is missing
}

// --- Input Schemas (using Zod) ---
const TranslateTextInputSchema = z.object({
  text: z.array(z.string()).min(1, "The 'text' array cannot be empty."),
  target_lang: z.string(),
  source_lang: z.string().optional(),
});

const ListLanguagesInputSchema = z.object({
  type: z.enum(['source', 'target']).optional(),
});

// --- DeepL API Response Types ---
interface DeepLTranslation {
  detected_source_language: string;
  text: string;
}

interface DeepLLanguage {
  language: string;
  name: string;
  supports_formality: boolean;
}

// --- DeepL Server Class ---
class DeepLServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private readonly baseUrl = 'https://api-free.deepl.com';

  constructor() {
    this.server = new Server(
      {
        name: 'deepl-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          // Resources not implemented in this version
          resources: {},
          tools: {}, // Tool handlers are registered below
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `DeepL-Auth-Key ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupToolHandlers();

    // Basic error logging for the server itself
    this.server.onerror = (error) => console.error('[MCP Server Error]', error);
    process.on('SIGINT', async () => {
        console.error('Received SIGINT, shutting down server...');
        await this.server.close();
        process.exit(0);
      });
  }

  private setupToolHandlers() {
    // --- ListTools Handler ---
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async (): Promise<z.infer<typeof ListToolsResultSchema>> => { // Corrected response type
        const tools: Tool[] = [ // Corrected type name
          {
            name: 'translate_text',
            description: 'Translates one or more text strings using the DeepL API.',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Text(s) to translate',
                },
                target_lang: {
                  type: 'string',
                  description: 'Target language code (e.g., DE, FR)',
                },
                source_lang: {
                  type: 'string',
                  description: 'Source language code; auto-detected if omitted',
                },
              },
              required: ['text', 'target_lang'],
            },
          },
          {
            name: 'list_languages',
            description: 'Retrieves the list of languages supported by the DeepL API.',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['source', 'target'],
                  description: "Filter by 'source' or 'target' languages",
                },
              },
              required: [],
            },
          },
        ];
        return { tools };
      }
    );

    // --- CallTool Handler ---
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request): Promise<z.infer<typeof CallToolResultSchema>> => { // Corrected response type
        try {
          switch (request.params.name) {
            case 'translate_text':
              return await this.callTranslateText(request.params.arguments);
            case 'list_languages':
              return await this.callListLanguages(request.params.arguments);
            default:
              throw new McpError(ErrorCode.MethodNotFound, `Tool '${request.params.name}' not found.`);
          }
        } catch (error) {
            return this.handleToolError(error);
        }
      }
    );
  }

  // --- Specific Tool Implementations ---
  private async callTranslateText(args: any): Promise<z.infer<typeof CallToolResultSchema>> { // Corrected response type
    const validatedArgs = TranslateTextInputSchema.parse(args); // Validate input (throws ZodError on failure)

    const response = await this.axiosInstance.post<{ translations: DeepLTranslation[] }>(
      '/v2/translate',
      {
        text: validatedArgs.text,
        target_lang: validatedArgs.target_lang,
        ...(validatedArgs.source_lang && { source_lang: validatedArgs.source_lang }),
      }
    );

    const content: TextContent = {
        type: 'text',
        text: JSON.stringify(response.data.translations, null, 2), // Pretty print JSON
        mimeType: 'application/json',
    };

    return { content: [content] };
  }

  private async callListLanguages(args: any): Promise<z.infer<typeof CallToolResultSchema>> { // Corrected response type
    const validatedArgs = ListLanguagesInputSchema.parse(args); // Validate input

    const params: { type?: 'source' | 'target' } = {};
    if (validatedArgs.type) {
      params.type = validatedArgs.type;
    }

    const response = await this.axiosInstance.get<DeepLLanguage[]>(
      '/v2/languages',
      { params }
    );

    const content: TextContent = {
        type: 'text',
        text: JSON.stringify(response.data, null, 2), // Pretty print JSON
        mimeType: 'application/json',
    };

    return { content: [content] };
  }

  // --- Centralized Error Handling for Tools ---
  private handleToolError(error: unknown): z.infer<typeof CallToolResultSchema> { // Corrected response type
    let mcpError: McpError;

    if (error instanceof McpError) {
      mcpError = error; // Use existing McpError
    } else if (error instanceof z.ZodError) {
      // Handle Zod validation errors
      mcpError = new McpError(ErrorCode.InvalidParams, "Input validation failed", error.errors);
    } else if (axios.isAxiosError(error)) {
      // Handle Axios errors specifically
      const axiosError = error as AxiosError<any>;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;
      const message = data?.message || axiosError.message;

      let errorCode = ErrorCode.InternalError; // Default
      if (status === 400) errorCode = ErrorCode.InvalidParams; // Use available code
      // Map other client errors (like auth) to InvalidRequest for now
      if (status && status >= 401 && status < 500 && status !== 400) {
          errorCode = ErrorCode.InvalidRequest;
      }
      // Map server errors (5xx) to InternalError (as UpstreamError isn't available)
      if (status && status >= 500) {
          errorCode = ErrorCode.InternalError; // Using InternalError as UpstreamError is not available
      }

      mcpError = new McpError(errorCode, `DeepL API Error (${status}): ${message}`, data);
    } else {
      // Handle other unexpected errors
      console.error('Unexpected error calling tool:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      mcpError = new McpError(ErrorCode.InternalError, `An unexpected error occurred: ${errorMessage}`);
    }

    // Format error for MCP response
    const errorContent: TextContent = {
        type: 'text',
        text: `Error: ${mcpError.message}${mcpError.data ? `\nDetails: ${JSON.stringify(mcpError.data)}` : ''}`,
    };
    return { content: [errorContent], isError: true, errorCode: mcpError.code };
  }


  // --- Server Start Method ---
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DeepL MCP Server started and listening via stdio.'); // Log to stderr
  }
}

// --- Initialize and Run ---
const server = new DeepLServer();
server.run().catch(error => {
    console.error("Failed to start DeepL MCP Server:", error);
    process.exit(1);
});
