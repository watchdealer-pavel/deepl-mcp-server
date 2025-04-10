# DeepL MCP Server

An MCP (Model Context Protocol) server providing DeepL translation capabilities.

## Features

This server exposes the following tools via MCP:

*   **`translate_text`**: Translates one or more text strings between supported languages using the DeepL API.
*   **`list_languages`**: Retrieves the list of languages supported by the DeepL API (either source or target languages).

## Prerequisites

*   **Node.js and npm/yarn:** Required to install dependencies and run the server.
*   **DeepL API Key:** You need an API key from DeepL. Both Free and Pro plans provide API access. Sign up or learn more at [https://www.deepl.com/pro-api](https://www.deepl.com/pro-api).

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/deepl-mcp-server.git # Replace with the actual repository URL
    cd deepl-mcp-server
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Build the server:**
    ```bash
    npm run build
    ```
    This command compiles the TypeScript source code into JavaScript, placing the output in the `build/` directory (specifically `build/index.js`).

## Configuration

The server requires your DeepL API key to be provided via the `DEEPL_API_KEY` environment variable. You need to configure your MCP client (like Cline/Roo Code or the Claude Desktop App) to run this server and pass the environment variable.

**Example Configuration:**

Below are examples for common MCP clients. **Remember to replace `/path/to/your/deepl-mcp-server/build/index.js` with the actual absolute path to the compiled server file on your system, and `YOUR_DEEPL_API_KEY` with your real DeepL API key.**

### Cline / Roo Code (VS Code Extension)

1.  Open your VS Code settings for MCP servers. On macOS, this is typically located at:
    `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
    *(Note: The exact path might vary based on your operating system and VS Code installation type (e.g., Insiders).)*

2.  Add the following configuration block under the `mcpServers` key:

    ```json
    "deepl-translator": {
      "command": "node",
      "args": ["/path/to/your/deepl-mcp-server/build/index.js"], // <-- IMPORTANT: Replace with the ACTUAL absolute path to build/index.js
      "env": {
        "DEEPL_API_KEY": "YOUR_DEEPL_API_KEY" // <-- IMPORTANT: Replace with your DeepL API Key
      },
      "disabled": false,
      "alwaysAllow": []
    }
    ```

### Claude Desktop App

1.  Open the Claude Desktop App configuration file. On macOS, this is typically located at:
    `~/Library/Application Support/Claude/claude_desktop_config.json`
    *(Note: The exact path might vary based on your operating system.)*

2.  Add the following configuration block under the `mcpServers` key:

    ```json
    "deepl-translator": {
      "command": "node",
      "args": ["/path/to/your/deepl-mcp-server/build/index.js"], // <-- IMPORTANT: Replace with the ACTUAL absolute path to build/index.js
      "env": {
        "DEEPL_API_KEY": "YOUR_DEEPL_API_KEY" // <-- IMPORTANT: Replace with your DeepL API Key
      },
      "disabled": false,
      "alwaysAllow": []
    }
    ```

## Usage

Once configured, you can invoke the server's tools from your AI assistant using the `use_mcp_tool` command/tool.

### `list_languages` Example

```xml
<use_mcp_tool>
  <server_name>deepl-translator</server_name>
  <tool_name>list_languages</tool_name>
  <arguments>
    {
      "type": "target" // Optional: "source" or "target". Defaults to listing all if omitted.
    }
  </arguments>
</use_mcp_tool>
```

### `translate_text` Example

```xml
<use_mcp_tool>
  <server_name>deepl-translator</server_name>
  <tool_name>translate_text</tool_name>
  <arguments>
    {
      "text": ["Hello world", "How are you?"], // Required: An array of strings to translate
      "target_lang": "DE", // Required: Target language code (e.g., DE, FR, ES)
      "source_lang": "EN" // Optional: Source language code. DeepL will auto-detect if omitted.
    }
  </arguments>
</use_mcp_tool>
```

## License

License TBD. Consider using a permissive license like MIT.
