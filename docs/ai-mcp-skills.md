# MCP 与 Skills 工具体系

> Model Context Protocol · Agent Skills · 工具调用 · 扩展生态

---

## 核心概念（精简版）

### 什么是 MCP？

**MCP (Model Context Protocol)** 是 AI 应用之间通信的开放标准协议，使 LLM 能够安全地访问外部数据和工具：

```mermaid
graph LR
    subgraph "MCP 架构"
        Client["MCP Client<br/>Claude/GPT"]
        Server["MCP Server<br/>工具/数据源"]
        Transport["Transport<br/>stdio/SSE/HTTP"]
    end

    Client <--"JSON-RPC 2.0"--> Transport
    Transport <--"JSON-RPC 2.0"--> Server

    style Client fill:#e1f5fe
    style Server fill:#c8e6c9
    style Transport fill:#fff9c4
```

### MCP 核心组件

| 组件 | 描述 | 示例 |
|:-----|:-----|:-----|
| **Host** | 运行 MCP Client 的应用 | Claude Desktop、Cursor |
| **Client** | MCP 协议客户端实现 | @modelcontextprotocol/sdk-* |
| **Server** | 提供工具/资源/提示的服务 | filesystem、github、postgres |
| **Transport** | 通信传输层 | stdio、SSE、HTTP |

### 什么是 Skills？

**Skills** 是预定义的 AI 能力模块，封装了特定任务的执行逻辑：

```mermaid
graph TD
    subgraph "Skill 架构"
        User["用户输入"] --> Router["Skill Router"]

        Router --> S1["/commit<br/>代码提交"]
        Router --> S2["/review<br/>代码审查"]
        Router --> S3["/test<br/>测试生成"]
        Router --> S4["/deploy<br/>部署流程"]
    end

    S1 --> Agent["Agent 执行"]
    S2 --> Agent
    S3 --> Agent
    S4 --> Agent

    Agent --> Tools["工具调用"]
    Tools --> Result["返回结果"]

    style Router fill:#e1f5fe
    style Agent fill:#c8e6c9
    style Tools fill:#fff9c4
```

### MCP vs Skills 对比

| 特性 | MCP | Skills |
|:-----|:-----|:-------|
| **定位** | 通信协议 | 任务封装 |
| **粒度** | 工具级别 | 工作流级别 |
| **扩展性** | 需要实现 Server | 配置即用 |
| **复杂度** | 较低 | 较高 |
| **使用场景** | 通用工具集成 | 领域特定任务 |

### 常见 MCP Servers

| Server | 功能 | 工具示例 |
|:-------|:-----|:---------|
| **filesystem** | 文件系统操作 | read_file, write_file, list_directory |
| **github** | GitHub API | create_issue, search_repos, view_file |
| **postgres** | 数据库操作 | query, execute, list_tables |
| **brave-search** | 网页搜索 | search, search_web |
| **slack** | Slack 集成 | send_message, list_channels |
| **postgres** | PostgreSQL 交互 | query, execute, list_tables |
| **sequential-thinking** | 复杂推理 | 分步思考、反思验证 |

---

## 深入原理（深入版）

### MCP 协议详解

#### 协议层次结构

```mermaid
graph TB
    subgraph "MCP 协议栈"
        App["应用层<br/>Resources/Prompts/Tools"]
        RPC["传输层<br/>JSON-RPC 2.0"]
        Trans["通信层<br/>stdio/SSE/HTTP"]
    end

    App --> RPC
    RPC --> Trans

    style App fill:#c8e6c9
    style RPC fill:#fff9c4
    style Trans fill:#e1f5fe
```

#### JSON-RPC 消息格式

```json
// 请求消息
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/path/to/file.txt"
    }
  }
}

// 响应消息
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "文件内容..."
      }
    ]
  }
}

// 错误消息
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {}
  }
}
```

#### MCP 三大核心能力

##### 1. Resources（资源）

资源是 Server 提供的数据实体，支持订阅和更新：

```go
type Resource struct {
    URI         string            `json:"uri"`                   // 资源标识符
    Name        string            `json:"name"`                  // 资源名称
    Description string            `json:"description,omitempty"` // 描述
    MimeType    string            `json:"mimeType,omitempty"`    // MIME 类型
}

type ResourceContent struct {
    URI      string `json:"uri"`
    MimeType string `json:"mimeType,omitempty"`
    Text     string `json:"text,omitempty"`     // 文本内容
    Blob     string `json:"blob,omitempty"`     // 二进制内容（base64）
}

// 列出资源
// Client → Server: {"method": "resources/list"}
// Server → Client: {"result": {"resources": [...]}}

// 读取资源
// Client → Server: {"method": "resources/read", "params": {"uri": "file:///path"}}
// Server → Client: {"result": {"contents": [...]}}
```

##### 2. Prompts（提示模板）

预定义的提示模板，支持参数化：

```go
type Prompt struct {
    Name        string            `json:"name"`
    Description string            `json:"description,omitempty"`
    Arguments   []PromptArgument  `json:"arguments,omitempty"`
}

type PromptArgument struct {
    Name        string `json:"name"`
    Description string `json:"description,omitempty"`
    Required    bool   `json:"required,omitempty"`
}

// 列出提示
// Client → Server: {"method": "prompts/list"}

// 获取提示
// Client → Server: {
//   "method": "prompts/get",
//   "params": {
//     "name": "summarize",
//     "arguments": {"filePath": "/path/to/file.txt"}
//   }
// }
// Server → Client: {
//   "result": {
//     "messages": [
//       {"role": "user", "content": {"type": "text", "text": "请总结文件：/path/to/file.txt"}}
//     ]
//   }
// }
```

##### 3. Tools（工具）

可被 LLM 调用的函数：

```go
type Tool struct {
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    InputSchema map[string]interface{} `json:"inputSchema"` // JSON Schema
}

// 列出工具
// Client → Server: {"method": "tools/list"}
// Server → Client: {
//   "result": {
//     "tools": [
//       {
//         "name": "read_file",
//         "description": "读取文件内容",
//         "inputSchema": {
//           "type": "object",
//           "properties": {
//             "path": {"type": "string", "description": "文件路径"}
//           },
//           "required": ["path"]
//         }
//       }
//     ]
//   }
// }

// 调用工具
// Client → Server: {
//   "method": "tools/call",
//   "params": {
//     "name": "read_file",
//     "arguments": {"path": "/etc/hosts"}
//   }
// }
```

### MCP Server 实现

#### Go 语言实现

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "os"
)

// MCP Server 结构
type MCPServer struct {
    name    string
    version string
    tools   map[string]ToolFunc
}

type ToolFunc func(ctx context.Context, args map[string]interface{}) (interface{}, error)

func NewMCPServer(name, version string) *MCPServer {
    return &MCPServer{
        name:    name,
        version: version,
        tools:   make(map[string]ToolFunc),
    }
}

// 注册工具
func (s *MCPServer) RegisterTool(name, description string, schema map[string]interface{}, fn ToolFunc) {
    s.tools[name] = fn
}

// 处理请求
func (s *MCPServer) HandleRequest(ctx context.Context, raw []byte) ([]byte, error) {
    var req struct {
        JSONRPC string                 `json:"jsonrpc"`
        ID      interface{}            `json:"id"`
        Method   string                 `json:"method"`
        Params   map[string]interface{} `json:"params,omitempty"`
    }

    if err := json.Unmarshal(raw, &req); err != nil {
        return nil, err
    }

    // 路由处理
    switch req.Method {
    case "tools/list":
        return s.toolsList(req.ID)
    case "tools/call":
        return s.toolsCall(ctx, req.ID, req.Params)
    case "initialize":
        return s.initialize(req.ID)
    default:
        return nil, fmt.Errorf("unknown method: %s", req.Method)
    }
}

func (s *MCPServer) toolsList(id interface{}) ([]byte, error) {
    tools := make([]map[string]interface{}, 0, len(s.tools))
    for name := range s.tools {
        tools = append(tools, map[string]interface{}{
            "name":        name,
            "description": "Tool description",
            "inputSchema": map[string]interface{}{
                "type": "object",
                "properties": map[string]interface{}{
                    "arg": map[string]interface{}{
                        "type":        "string",
                        "description": "Argument description",
                    },
                },
                "required": []string{"arg"},
            },
        })
    }

    resp := map[string]interface{}{
        "jsonrpc": "2.0",
        "id":      id,
        "result":  map[string]interface{}{"tools": tools},
    }

    return json.Marshal(resp)
}

func (s *MCPServer) toolsCall(ctx context.Context, id interface{}, params map[string]interface{}) ([]byte, error) {
    name, _ := params["name"].(string)
    args, _ := params["arguments"].(map[string]interface{})

    tool, ok := s.tools[name]
    if !ok {
        return nil, fmt.Errorf("tool not found: %s", name)
    }

    result, err := tool(ctx, args)
    if err != nil {
        return nil, err
    }

    resp := map[string]interface{}{
        "jsonrpc": "2.0",
        "id":      id,
        "result": map[string]interface{}{
            "content": []map[string]interface{}{
                {"type": "text", "text": fmt.Sprintf("%v", result)},
            },
        },
    }

    return json.Marshal(resp)
}

func main() {
    server := NewMCPServer("example-server", "1.0.0")

    // 注册工具
    server.RegisterTool("echo", "Echo back the input", nil, func(ctx context.Context, args map[string]interface{}) (interface{}, error) {
        msg, _ := args["message"].(string)
        return fmt.Sprintf("Echo: %s", msg), nil
    })

    // 从 stdin 读取请求，写入响应到 stdout
    decoder := json.NewDecoder(os.Stdin)
    encoder := json.NewEncoder(os.Stdout)

    for {
        var raw json.RawMessage
        if err := decoder.Decode(&raw); err != nil {
            break
        }

        resp, err := server.HandleRequest(context.Background(), raw)
        if err != nil {
            continue
        }

        encoder.Encode(resp)
    }
}
```

#### Python 实现

```python
import json
import sys
from typing import Any, Callable, Dict

class MCPServer:
    def __init__(self, name: str, version: str):
        self.name = name
        self.version = version
        self.tools: Dict[str, Callable] = {}

    def register_tool(self, name: str, description: str, schema: dict, fn: Callable):
        """注册工具"""
        self.tools[name] = {
            "description": description,
            "schema": schema,
            "function": fn
        }

    def handle_request(self, request: dict) -> dict:
        """处理 MCP 请求"""
        method = request.get("method")
        params = request.get("params", {})
        req_id = request.get("id")

        if method == "initialize":
            return self._initialize(req_id)
        elif method == "tools/list":
            return self._tools_list(req_id)
        elif method == "tools/call":
            return self._tools_call(req_id, params)
        else:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": "Method not found"}
            }

    def _initialize(self, req_id):
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": self.name,
                    "version": self.version
                },
                "capabilities": {
                    "tools": {}
                }
            }
        }

    def _tools_list(self, req_id):
        tools = []
        for name, tool in self.tools.items():
            tools.append({
                "name": name,
                "description": tool["description"],
                "inputSchema": tool["schema"]
            })

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": tools}
        }

    def _tools_call(self, req_id, params):
        name = params.get("name")
        arguments = params.get("arguments", {})

        if name not in self.tools:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32602, "message": f"Tool not found: {name}"}
            }

        try:
            result = self.tools[name]["function"](**arguments)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": str(result)}]
                }
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32603, "message": str(e)}
            }

    def run(self):
        """运行服务器（stdio 模式）"""
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                response = self.handle_request(request)
                print(json.dumps(response))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({
                    "jsonrpc": "2.0",
                    "error": {"code": -32700, "message": str(e)}
                }))
                sys.stdout.flush()

# 使用示例
if __name__ == "__main__":
    server = MCPServer("my-server", "1.0.0")

    # 注册工具
    server.register_tool(
        name="add",
        description="Add two numbers",
        schema={
            "type": "object",
            "properties": {
                "a": {"type": "number"},
                "b": {"type": "number"}
            },
            "required": ["a", "b"]
        },
        fn=lambda a, b: a + b
    )

    server.run()
```

### Skills 体系详解

#### Skill 结构定义

```yaml
# skill.yaml
name: code-review
version: 1.0.0
description: "代码审查 Skill"
author: "your-name"

# 触发词
triggers:
  - /review
  - /code-review

# 参数定义
parameters:
  - name: file
    type: string
    description: "要审查的文件路径"
    required: true

  - name: depth
    type: enum
    values: [quick, standard, thorough]
    default: standard
    description: "审查深度"

# 执行步骤
steps:
  - name: read_file
    tool: filesystem.read_file
    arguments:
      path: "{{parameters.file}}"

  - name: analyze_code
    agent: code-analyzer
    prompt: |
      分析以下代码的质量、安全性和最佳实践：
      {{steps.read_file.content}}

  - name: generate_report
    agent: report-generator
    template: review_template.md
    input:
      analysis: "{{steps.analyze_code.result}}"

# 输出格式
output:
  format: markdown
  template: |
    # 代码审查报告

    文件: {{parameters.file}}
    审查时间: {{timestamp}}

    ## 发现的问题
    {{steps.generate_report.issues}}

    ## 建议改进
    {{steps.generate_report.suggestions}}
```

#### Skill 执行引擎

```go
package skills

import (
    "context"
    "fmt"
    "reflect"
    "regexp"
    "strings"
    "text/template"
)

// Skill 引擎
type SkillEngine struct {
    skills      map[string]*Skill
    agents      map[string]Agent
    toolInvoker ToolInvoker
}

type Skill struct {
    Name        string
    Version     string
    Description string
    Triggers    []string
    Parameters  []Parameter
    Steps       []Step
    Output      Output
}

type Parameter struct {
    Name        string
    Type        string
    Description string
    Required    bool
    Default     interface{}
    Values      []interface{} // for enum
}

type Step struct {
    Name      string
    Tool      string
    Agent     string
    Prompt    string
    Template  string
    Arguments map[string]interface{}
}

type Output struct {
    Format   string
    Template string
}

type Agent interface {
    Execute(ctx context.Context, prompt string, input map[string]interface{}) (map[string]interface{}, error)
}

type ToolInvoker interface {
    Invoke(ctx context.Context, tool string, args map[string]interface{}) (interface{}, error)
}

// 执行 Skill
func (e *SkillEngine) Execute(ctx context.Context, trigger string, userInput string) (string, error) {
    // 1. 匹配 Skill
    skill := e.matchSkill(trigger)
    if skill == nil {
        return "", fmt.Errorf("no skill found for trigger: %s", trigger)
    }

    // 2. 解析参数
    params, err := e.parseParameters(skill, userInput)
    if err != nil {
        return "", err
    }

    // 3. 执行步骤
    results := make(map[string]interface{})
    for _, step := range skill.Steps {
        result, err := e.executeStep(ctx, step, params, results)
        if err != nil {
            return "", err
        }
        results[step.Name] = result
    }

    // 4. 格式化输出
    return e.formatOutput(skill, results, params)
}

// 匹配 Skill
func (e *SkillEngine) matchSkill(trigger string) *Skill {
    for _, skill := range e.skills {
        for _, t := range skill.Triggers {
            if matched, _ := regexp.MatchString(t, trigger); matched {
                return skill
            }
        }
    }
    return nil
}

// 执行步骤
func (e *SkillEngine) executeStep(ctx context.Context, step Step, params map[string]interface{}, previousResults map[string]interface{}) (interface{}, error) {
    // 渲染模板变量
    renderedArgs := e.renderTemplate(step.Arguments, params, previousResults)

    if step.Tool != "" {
        // 调用工具
        return e.toolInvoker.Invoke(ctx, step.Tool, renderedArgs)
    }

    if step.Agent != "" {
        // 调用 Agent
        agent := e.agents[step.Agent]
        if agent == nil {
            return "", fmt.Errorf("agent not found: %s", step.Agent)
        }

        prompt := e.renderString(step.Prompt, params, previousResults)
        return agent.Execute(ctx, prompt, renderedArgs)
    }

    return nil, fmt.Errorf("step has no tool or agent")
}

// 渲染模板
func (e *SkillEngine) renderTemplate(data interface{}, params map[string]interface{}, results map[string]interface{}) map[string]interface{} {
    // 简化实现：使用 Go template
    rendered := make(map[string]interface{})

    dataMap, ok := data.(map[string]interface{})
    if !ok {
        return rendered
    }

    for key, value := range dataMap {
        strValue := fmt.Sprintf("%v", value)

        // 替换 {{parameters.xxx}}
        re := regexp.MustCompile(`\{\{parameters\.(\w+)\}\}`)
        strValue = re.ReplaceAllStringFunc(strValue, func(match string) string {
            paramName := re.FindStringSubmatch(match)[1]
            if val, ok := params[paramName]; ok {
                return fmt.Sprintf("%v", val)
            }
            return match
        })

        // 替换 {{steps.xxx.yyy}}
        re = regexp.MustCompile(`\{\{steps\.(\w+)\.(\w+)\}\}`)
        strValue = re.ReplaceAllStringFunc(strValue, func(match string) string {
            submatches := re.FindStringSubmatch(match)
            stepName := submatches[1]
            field := submatches[2]

            if stepResult, ok := results[stepName]; ok {
                if resultMap, ok := stepResult.(map[string]interface{}); ok {
                    if val, ok := resultMap[field]; ok {
                        return fmt.Sprintf("%v", val)
                    }
                }
            }
            return match
        })

        rendered[key] = strValue
    }

    return rendered
}

func (e *SkillEngine) renderString(template string, params map[string]interface{}, results map[string]interface{}) string {
    // 简化实现
    return e.renderTemplate(map[string]interface{}{"value": template}, params, results)["value"].(string)
}

func (e *SkillEngine) formatOutput(skill *Skill, results map[string]interface{}, params map[string]interface{}) (string, error) {
    output := skill.Output
    rendered := e.renderString(output.Template, params, results)
    return rendered, nil
}
```

### Skill 配置示例

#### 代码提交 Skill

```yaml
# skills/commit.yaml
name: git-commit
version: 1.0.0
description: "智能代码提交"
triggers:
  - /commit
  - /gc

parameters:
  - name: scope
    type: enum
    values: [feat, fix, docs, style, refactor, test, chore]
    description: "提交类型"

  - name: message
    type: string
    required: false
    description: "提交信息（可选）"

steps:
  - name: check_status
    tool: git.status
    arguments: {}

  - name: analyze_changes
    agent: code-analyzer
    prompt: |
      分析以下 git 变更，生成符合规范的提交信息：
      {{steps.check_status.changes}}
      提交类型：{{parameters.scope}}

  - name: generate_commit_msg
    agent: commit-message-generator
    input:
      scope: "{{parameters.scope}}"
      analysis: "{{steps.analyze_changes.result}}"
      custom_message: "{{parameters.message}}"

  - name: execute_commit
    tool: git.commit
    arguments:
      message: "{{steps.generate_commit_msg.message}}"

output:
  format: markdown
  template: |
    ✅ 提交成功

    **提交信息**: {{steps.generate_commit_msg.message}}
    **修改文件**: {{steps.check_status.files_count}}
    **新增行**: {{steps.check_status.additions}}
    **删除行**: {{steps.check_status.deletions}}
```

#### 代码审查 Skill

```yaml
# skills/review.yaml
name: code-review
version: 1.0.0
description: "深度代码审查"
triggers:
  - /review
  - /cr

parameters:
  - name: target
    type: string
    description: "审查目标（文件路径或 commit hash）"

  - name: focus
    type: enum
    values: [all, security, performance, style, bugs]
    default: all
    description: "审查重点"

steps:
  - name: get_diff
    tool: git.diff
    arguments:
      target: "{{parameters.target}}"

  - name: analyze_security
    agent: security-analyzer
    condition: "{{parameters.focus}} in [all, security]"
    prompt: |
      安全分析以下代码变更：
      {{steps.get_diff.diff}}

  - name: analyze_performance
    agent: performance-analyzer
    condition: "{{parameters.focus}} in [all, performance]"
    prompt: |
      性能分析以下代码变更：
      {{steps.get_diff.diff}}

  - name: analyze_style
    agent: style-analyzer
    condition: "{{parameters.focus}} in [all, style]"
    prompt: |
      代码风格检查以下代码变更：
      {{steps.get_diff.diff}}

  - name: generate_report
    agent: report-generator
    input:
      security: "{{steps.analyze_security.result}}"
      performance: "{{steps.analyze_performance.result}}"
      style: "{{steps.analyze_style.result}}"
      focus: "{{parameters.focus}}"

output:
  format: markdown
  template: |
    # 代码审查报告

    ## 📊 概览
    - 审查目标: {{parameters.target}}
    - 审查重点: {{parameters.focus}}

    {{#if steps.analyze_security.result}}
    ## 🔒 安全问题
    {{steps.analyze_security.result}}
    {{/if}}

    {{#if steps.analyze_performance.result}}
    ## ⚡ 性能建议
    {{steps.analyze_performance.result}}
    {{/if}}

    {{#if steps.analyze_style.result}}
    ## 🎨 代码风格
    {{steps.analyze_style.result}}
    {{/if}}
```

---

## 实战案例

### 案例 1：创建自定义 MCP Server

```go
// main.go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "os"
    "os/exec"
)

// Slack MCP Server
type SlackMCPServer struct {
    token string
}

func NewSlackServer(token string) *SlackMCPServer {
    return &SlackMCPServer{token: token}
}

func (s *SlackMCPServer) ListChannels(ctx context.Context) ([]Channel, error) {
    cmd := exec.CommandContext(ctx, "slack", "channel", "list", "--token", s.token)
    output, err := cmd.Output()
    if err != nil {
        return nil, err
    }

    var result struct {
        Channels []Channel `json:"channels"`
    }
    json.Unmarshal(output, &result)
    return result.Channels, nil
}

func (s *SlackMCPServer) SendMessage(ctx context.Context, channel, message string) error {
    cmd := exec.CommandContext(ctx, "slack", "message", "send",
        "--channel", channel,
        "--text", message,
        "--token", s.token,
    )
    return cmd.Run()
}

func main() {
    token := os.Getenv("SLACK_TOKEN")
    server := NewSlackServer(token)

    // 注册到 MCP
    mcp := NewMCPServer("slack-server", "1.0.0")

    mcp.RegisterTool("list_channels", "列出所有频道", nil, func(ctx context.Context, args map[string]interface{}) (interface{}, error) {
        return server.ListChannels(ctx)
    })

    mcp.RegisterTool("send_message", "发送消息", map[string]interface{}{
        "type": "object",
        "properties": map[string]interface{}{
            "channel": map[string]interface{}{"type": "string"},
            "message": map[string]interface{}{"type": "string"},
        },
        "required": []string{"channel", "message"},
    }, func(ctx context.Context, args map[string]interface{}) (interface{}, error) {
        channel, _ := args["channel"].(string)
        message, _ := args["message"].(string)
        return nil, server.SendMessage(ctx, channel, message)
    })

    mcp.Run()
}
```

### 案例 2：实现 Skill 引擎

```go
// skills/engine.go
package skills

import (
    "context"
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "gopkg.in/yaml.v3"
)

type SkillManager struct {
    skills map[string]*Skill
    agents map[string]Agent
}

func NewSkillManager(skillsDir string) (*SkillManager, error) {
    sm := &SkillManager{
        skills: make(map[string]*Skill),
        agents: make(map[string]Agent),
    }

    // 加载所有 Skill 定义
    err := filepath.Walk(skillsDir, func(path string, info os.FileInfo, err error) error {
        if filepath.Ext(path) != ".yaml" && filepath.Ext(path) != ".yml" {
            return nil
        }

        data, err := os.ReadFile(path)
        if err != nil {
            return err
        }

        var skill Skill
        if err := yaml.Unmarshal(data, &skill); err != nil {
            return err
        }

        sm.skills[skill.Name] = &skill
        return nil
    })

    return sm, err
}

func (sm *SkillManager) RegisterAgent(name string, agent Agent) {
    sm.agents[name] = agent
}

func (sm *SkillManager) Execute(ctx context.Context, trigger string, input map[string]interface{}) (string, error) {
    // 查找匹配的 Skill
    var skill *Skill
    for _, s := range sm.skills {
        for _, t := range s.Triggers {
            if t == trigger {
                skill = s
                break
            }
        }
    }

    if skill == nil {
        return "", fmt.Errorf("no skill found for trigger: %s", trigger)
    }

    // 执行 Skill
    return sm.executeSkill(ctx, skill, input)
}

func (sm *SkillManager) executeSkill(ctx context.Context, skill *Skill, input map[string]interface{}) (string, error) {
    results := make(map[string]interface{})

    // 执行每个步骤
    for _, step := range skill.Steps {
        result, err := sm.executeStep(ctx, step, input, results)
        if err != nil {
            return "", err
        }
        results[step.Name] = result
    }

    // 格式化输出
    return sm.formatOutput(skill, results, input)
}

// main.go
func main() {
    sm, err := NewSkillManager("./skills")
    if err != nil {
        log.Fatal(err)
    }

    // 注册 Agents
    sm.RegisterAgent("code-analyzer", &CodeAnalyzerAgent{})
    sm.RegisterAgent("commit-generator", &CommitGeneratorAgent{})

    // 监听命令
    for {
        var command string
        fmt.Scanln(&command)

        parts := strings.SplitN(command, " ", 2)
        trigger := parts[0]
        input := make(map[string]interface{})

        if len(parts) > 1 {
            input["message"] = parts[1]
        }

        result, err := sm.Execute(context.Background(), trigger, input)
        if err != nil {
            fmt.Println("Error:", err)
        } else {
            fmt.Println(result)
        }
    }
}
```

### 案例 3：Claude Desktop MCP 配置

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    },
    "slack": {
      "command": "node",
      "args": ["/path/to/slack-mcp-server/build/index.js"],
      "env": {
        "SLACK_TOKEN": "xoxb-your-token-here"
      }
    },
    "custom-server": {
      "command": "go",
      "args": ["run", "./cmd/my-mcp-server"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  },
  "skills": {
    "code-review": {
      "path": "./skills/review.yaml"
    },
    "git-commit": {
      "path": "./skills/commit.yaml"
    }
  }
}
```

---

## 面试真题精选

### Q1: 解释 MCP 的设计理念和解决的问题

**参考答案**：

**设计理念**：
MCP 旨在解决 AI 应用与外部世界交互的标准化问题，提供统一的协议和工具生态。

**解决的核心问题**：

1. **碎片化问题**
   - 各 AI 应用使用不同的工具格式
   - 工具开发者需要适配多个平台
   - MCP 提供统一的 JSON-RPC 接口

2. **数据隔离问题**
   - LLM 无法直接访问本地/私有数据
   - MCP Server 可安全暴露资源
   - 支持文件系统、数据库、API 等

3. **可组合性**
   - 工具可独立开发和测试
   - 客户端按需加载 Server
   - 支持动态发现和调用

```mermaid
graph LR
    A[问题] --> B[统一协议]
    A --> C[工具生态]
    A --> D[安全访问]

    B --> E[MCP]
    C --> E
    D --> E

    E --> F[通用 AI 应用]
```

### Q2: MCP 中的 Transport 层有哪些类型？各有什么特点？

**参考答案**：

| Transport | 描述 | 优点 | 缺点 | 适用场景 |
|:----------|:-----|:-----|:-----|:---------|
| **stdio** | 标准输入/输出 | 简单、通用 | 单次请求响应 | CLI 工具、本地应用 |
| **SSE** | Server-Sent Events | 支持推送 | 需要服务器 | 浏览器、Web 应用 |
| **HTTP** | REST API | 灵活、易集成 | 需要状态管理 | 云服务、微服务 |

**stdio 示例**：
```json
// Client → Server (stdin)
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}

// Server → Client (stdout)
{"jsonrpc": "2.0", "id": 1, "result": {"tools": [...]}}
```

**SSE 示例**：
```
// 客户端订阅事件
GET /events?token=xxx

// 服务端推送
event: resource_updated
data: {"uri": "file:///path", "content": "..."}

event: message
data: {"role": "assistant", "content": "..."}
```

### Q3: Skills 与 MCP Tools 的关系是什么？

**参考答案**：

```mermaid
graph TD
    User[用户指令] --> Skill[Skill 工作流]
    Skill --> Tools[MCP Tools]

    Skill --> S1[步骤1: 读取文件]
    Skill --> S2[步骤2: 分析代码]
    Skill --> S3[步骤3: 生成报告]

    S1 --> T1[filesystem.read_file]
    S2 --> T2[llm.complete]
    S3 --> T3[filesystem.write_file]

    style Skill fill:#c8e6c9
    style Tools fill:#fff9c4
```

**关系**：
- **MCP Tools**: 原子操作，单一功能
- **Skills**: 工作流编排，多步骤任务
- **Skill 可以组合多个 MCP Tools**
- **Skill 可以调用 Agent 进行复杂推理**

**示例对比**：
```yaml
# MCP Tool: 单一功能
tool: read_file
input: {path: "/path/to/file"}
output: {content: "..."}

# Skill: 多步骤工作流
skill: code_review
steps:
  - tool: read_file
  - agent: analyze_code
  - tool: write_comment
```

### Q4: 如何设计一个高质量的 MCP Server？

**参考答案**：

**设计原则**：

1. **单一职责**
   - 每个 Server 聚焦一个领域
   - 工具功能明确、互不重叠

2. **清晰的 Schema**
   - 使用 JSON Schema 定义输入
   - 提供详细的描述信息
   - 标注必需/可选字段

3. **错误处理**
   ```go
   // 返回标准错误格式
   return map[string]interface{}{
       "jsonrpc": "2.0",
       "id": req.ID,
       "error": map[string]interface{}{
           "code":    -32602, // JSON-RPC 错误码
           "message": "Invalid params",
           "data": map[string]interface{}{
               "field": "path",
               "reason": "must be absolute path",
           },
       },
   }
   ```

4. **资源管理**
   - 支持资源订阅和更新
   - 提供变化通知
   - 合理设置缓存策略

5. **性能优化**
   ```go
   // 连接池复用
   type CachedConnection struct {
       conn *sql.DB
       ttl  time.Time
   }

   // 批量操作
   func batchRead(paths []string) ([]Content, error) {
       // 并行读取多个文件
   }
   ```

---

## 参考资料

### 官方文档
- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [MCP SDK - TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)

### 开发资源
- [Building an MCP Server](https://modelcontextprotocol.io/docs/concepts/servers)
- [Claude Desktop MCP Integration](https://help.anthropic.com/en/docs/claude-desktop/mcp)
- [Skills Development Guide](https://docs.anthropic.com/claude/docs/skills)

### 示例项目
- [MCP Server Templates](https://github.com/modelcontextprotocol/create-mcp-server)
- [Community MCP Servers](https://github.com/modelcontextprotocol/awesome-mcp-servers)
