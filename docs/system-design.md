# 系统设计：常见业务场景

> 短链接系统 · 秒杀系统 · 推送系统 · IM系统 · 支付系统

---

## 核心 CAP 定理

```mermaid
graph TB
    subgraph "CAP 定理（三选二）"
        C[一致性<br/>Consistency]
        A[可用性<br/>Availability]
        P[分区容错<br/>Partition Tolerance]
    end

    CA --> CAonly[CA: 放弃分区容错]
    CP --> CPonly[CP: 放弃可用性]
    AP --> APonly[AP: 放弃强一致性]

    style CAonly fill:#ffcdd2
    style CPonly fill:#fff9c4
    style APonly fill:#c8e6c9
```

| 系统类型 | 选择 | 典型代表 |
|:---------|:-----|:---------|
| **CA** | 放弃 P | 传统单机数据库 |
| **CP** | 放弃 A | Redis、HBase、MongoDB |
| **AP** | 放弃 C | Cassandra、DynamoDB、CouchDB |

---

## 场景 1：短链接系统

### 需求分析

| 需求 | 说明 |
|:-----|:-----|
| **高并发** | 瞬间大量请求 |
| **短生命周期** | 一次使用后失效 |
| **防重复** | 同一短链不能重复 |
| **高可用** | 服务不能宕机 |

### 架构设计

```mermaid
flowchart TB
    subgraph "短链接系统架构"
        Client[客户端]

        Gateway[API 网关<br/>限流/熔断]

        subgraph "应用层"
            Web[Web 服务]
            Cache[(Redis 缓存)]
        end

        subgraph "存储层"
            DB[(MySQL<br/>长链存储)]
            Bloom[布隆过滤器<br/>去重]
        end
    end

    Client --> Gateway
    Gateway --> Web
    Web --> Cache
    Web --> DB
    Web --> Bloom

    Cache -.->|miss| DB
    Bloom -.->|已存在| Web

    style Cache fill:#c8e6c9
    style DB fill:#fff9c4
    style Bloom fill:#ffcdd2
```

### 核心流程

**1. 生成短链**
```mermaid
sequenceDiagram
    participant C as Client
    participant W as Web
    participant R as Redis
    participant B as Bloom
    participant D as DB

    C->>W: POST /shorten (url)
    W->>B: 检查是否重复
    B-->>W: 不存在
    W->>W: 生成短码 (Base62)
    W->>R: 存储缓存
    W->>D: 持久化存储
    W-->>C: 返回短链
```

**2. 访问重定向**
```mermaid
sequenceDiagram
    participant C as Client
    participant W as Web
    participant R as Redis
    participant D as DB

    C->>W: GET /abc123
    W->>R: 查询缓存
    alt 缓存命中
        R-->>W: 返回长链
        W-->>C: 302 重定向
    else 缓存未命中
        W->>D: 查询数据库
        D-->>W: 返回长链
        W->>R: 写入缓存
        W-->>C: 302 重定向
    end
```

### 技术选型

| 组件 | 方案 | 说明 |
|:-----|:-----|:-----|
| **短码生成** | Base62 编码 | 0-9a-zA-Z，62 进制 |
| **去重** | 布隆过滤器 | 内存友好，有误判 |
| **缓存** | Redis String | 热点数据缓存 |
| **存储** | MySQL 分表 | 按时间/字符分表 |

### 代码示例

```go
// 短码生成（Base62）
const base62Chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func ToBase62(id uint64) string {
    var result []byte
    for id > 0 {
        result = append(result, base62Chars[id%62])
        id /= 62
    }
    // 反转
    for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
        result[i], result[j] = result[j], result[i]
    }
    return string(result)
}

// 布隆过滤器去重
var bloomFilter = bloom.NewWithEstimates(10000000, 0.001)

func CheckDuplicate(url string) (bool, error) {
    // 布隆过滤器判断（可能有误判）
    if bloomFilter.Test([]byte(url)) {
        // 二次确认
        exists, err := db.CheckURLExists(url)
        if err != nil {
            return false, err
        }
        return exists, nil
    }
    return false, nil
}

// 缓存预热
func WarmupCache() error {
    // 从数据库加载热点短链
    urls, err := db.GetHotURLs(10000)
    if err != nil {
        return err
    }

    pipe := redis.Pipeline()
    for _, url := range urls {
        pipe.Set(ctx, url.ShortCode, url.OriginalURL, time.Hour*24)
    }
    _, err = pipe.Exec(ctx)
    return err
}
```

---

## 场景 2：秒杀系统

### 需求分析

| 需求 | 说明 |
|:-----|:-----|
| **超卖不卖** | 库存准确性 |
| **高并发** | 瞬间流量峰值 |
| **防刷** | 限制单用户购买 |
| **一致性** | 订单与库存一致 |

### 架构设计

```mermaid
flowchart TB
    subgraph "秒杀系统架构"
        User[用户]

        subgraph "接入层"
            LB[负载均衡]
            GW[API 网关<br/>限流/签名验证]
        end

        subgraph "服务层"
            Order[订单服务]
            Stock[库存服务]
            Notify[通知服务]
        end

        subgraph "缓存层"
            RC[(Redis<br/>库存缓存)]
            RL[(Redis<br/>购买名单)]
            MQ[RabbitMQ/Kafka<br/>消息队列]
        end

        subgraph "存储层"
            DB[(MySQL<br/>订单/库存)]
        end
    end

    User --> LB
    LB --> GW
    GW --> Order
    Order --> Stock
    Order --> RL
    Stock --> RC
    Order --> MQ
    MQ --> Notify
    Order --> DB

    style RC fill:#c8e6c9
    style MQ fill:#fff9c4
    style DB fill:#ffcdd2
```

### 核心流程

**1. 秒杀流程**
```mermaid
flowchart TD
    A[用户请求] --> B{限流检查}
    B -->|超出| C[直接拒绝]
    B -->|通过| D{签名验证}

    D -->|失败| C
    D -->|成功| E{是否已购买}

    E -->|是| C
    E -->|否| F{Redis 预减库存}

    F -->|失败| G[库存不足]
    F -->|成功| H[创建订单]
    H --> I[发送 MQ 消息]
    I --> J[更新数据库]

    style C fill:#ffcdd2
    style F fill:#c8e6c9
    style H fill:#fff9c4
```

**2. 库存扣减方案对比**

| 方案 | 优点 | 缺点 |
|:-----|:-----|:-----|
| **数据库直接扣减** | 数据一致 | 性能瓶颈，可能超卖 |
| **Redis 缓存 + 异步落库** | 高性能 | 可能丢失，需补偿 |
| **Redis Lua 原子操作** | 原子性，高性能 | Redis 宕机需恢复 |

### 代码示例

```go
// Redis Lua 原子扣减库存
const stockLuaScript = `
    local key = KEYS[1]
    local userKey = KEYS[2]
    local buyNum = tonumber(ARGV[1])

    -- 检查是否已购买
    if redis.call("HEXISTS", userKey, userKey) == 1 then
        return -1
    end

    -- 检查库存
    local stock = tonumber(redis.call("GET", key))
    if stock < buyNum then
        return 0
    end

    -- 扣减库存
    redis.call("DECRBY", key, buyNum)

    -- 标记已购买
    redis.call("HSET", userKey, userKey, "1")

    return 1
`

func Seckill(ctx context.Context, userID, productID string) error {
    // 1. 限流检查
    if !limiter.Allow() {
        return errors.New("请求过于频繁")
    }

    // 2. Redis 原子操作
    stockKey := fmt.Sprintf("stock:%s", productID)
    userKey := fmt.Sprintf("purchased:%s:%s", productID, userID)

    result, err := rdb.Eval(ctx, stockLuaScript, []string{stockKey, userKey}, []string{1}).Result()
    if err != nil {
        return err
    }

    switch result.(int64) {
    case -1:
        return errors.New("已购买，不能重复购买")
    case 0:
        return errors.New("库存不足")
    case 1:
        // 3. 创建订单（异步）
        go createOrder(userID, productID)
        return nil
    }

    return nil
}

// 创建订单
func createOrder(userID, productID string) {
    order := &Order{
        UserID:    userID,
        ProductID: productID,
        Status:    "pending",
        CreatedAt: time.Now(),
    }

    if err := db.Create(order); err != nil {
        // 发送到延迟队列重试
        mq.Publish("retry_order", order)
        return
    }

    // 更新数据库库存
    db.UpdateStock(productID, -1)
}
```

---

## 场景 3：推送系统

### 需求分析

| 需求 | 说明 |
|:-----|:-----|
| **实时性** | 消息及时送达 |
| **高吞吐** | 支持千万级用户 |
| **可靠性** | 消息不丢失 |
| **多端推送** | iOS / Android / Web |

### 架构设计

```mermaid
flowchart TB
    subgraph "推送系统架构"
        Biz[业务系统]

        subgraph "推送服务层"
            API[推送 API]
            Dispatcher[消息分发器]
        end

        subgraph "消息队列层"
            MQ[消息队列<br/>Kafka/RabbitMQ]
            PT[持久化表]
        end

        subgraph "推送通道层"
            APNs[Apple Push<br/>APNs]
            FCM[Android Push<br/>FCM]
            HMS[华为 Push<br/>HMS]
            WSC[WebSocket<br/>Web 推送]
        end

        subgraph "设备管理"
            DM[设备管理服务]
            DeviceDB[(设备数据库)]
        end
    end

    Biz --> API
    API --> Dispatcher
    Dispatcher --> MQ
    MQ --> APNs
    MQ --> FCM
    MQ --> HMS
    MQ --> PT

    Dispatcher --> DM
    DM --> DeviceDB

    style MQ fill:#c8e6c9
    style PT fill:#ffcdd2
    style DeviceDB fill:#fff9c4
```

### 核心流程

**推送处理流程**
```mermaid
flowchart TD
    A[业务请求] --> B[参数校验]
    B --> C{推送目标}

    C -->|单个用户| D[查询设备 Token]
    C -->|全员/标签| E[从 DB 批量查询]

    D --> F[写入消息队列]
    E --> F

    F --> G[推送服务消费]
    G --> H{推送通道}

    H -->|iOS| I[APNs 推送]
    H -->|Android| J[FCM/HMS 推送]
    H -->|Web| K[WebSocket 推送]

    I --> L[更新推送状态]
    J --> L
    K --> L

    L --> M{推送结果}
    M -->|成功| N[更新送达状态]
    M -->|失败| O[进入重试队列]

    O --> P{重试次数}
    P -->|< 3次| Q[延迟重试]
    P -->|≥ 3次| R[标记失败]

    style F fill:#c8e6c9
    style O fill:#ffcdd2
    style Q fill:#fff9c4
```

### 推送可靠性设计

| 策略 | 实现方式 |
|:-----|:---------|
| **持久化** | 推送前先落库 |
| **重试机制** | 指数退避重试 |
| **去重** | 设备级别去重窗口 |
| **限速** | 防止推送厂商限流 |
| **多通道** | APNs + FCM + 备用通道 |

---

## 场景 4：IM 即时通讯系统

### 需求分析

| 需求 | 说明 |
|:-----|:-----|
| **低延迟** | 消息秒级送达 |
| **高并发** | 支持群聊、大量在线 |
| **消息可靠** | 不丢消息、有序 |
| **离线消息** | 上线后推送 |

### 架构设计

```mermaid
flowchart TB
    subgraph "IM 系统架构"
        Client[客户端]

        subgraph "接入层"
            GW[网关<br/>连接管理]
            LB[负载均衡]
        end

        subgraph "服务层"
            Route[路由服务<br/>定位用户节点]
            MSG[消息服务<br/>存储转发]
            Group[群组服务]
            Push[推送服务]
        end

        subgraph "存储层"
            MSGDB[(消息存储<br/>MySQL/MongoDB)]
            SEQ[(序列号生成器<br/>Redis)]
            SYNC[(同步队列<br/>Redis)]
        end

        subgraph "持久化"
            Kafka[消息队列<br/>Kafka]
            ES[Elasticsearch<br/>消息搜索]
        end
    end

    Client --> GW
    GW --> LB
    LB --> Route
    Route --> MSG
    Route --> Group

    MSG --> MSGDB
    MSG --> SEQ
    MSG --> SYNC
    MSG --> Kafka
    Kafka --> ES
    SYNC --> Push

    style SEQ fill:#c8e6c9
    style SYNC fill:#fff9c4
    style Kafka fill:#ffcdd2
```

### 消息投递模型

```mermaid
sequenceDiagram
    participant S as 发送者
    participant G as 网关
    participant M as 消息服务
    participant R as Redis
    participant Q as 推送队列
    participant Rcv as 接收者

    S->>G: 发送消息
    G->>M: 转发消息
    M->>R: 生成本地序列号
    M->>R: 存储消息
    M->>R: 写入同步队列

    alt 接收者在线
        Rcv-->>M: WebSocket 推送
        M->>R: 更新 ACK
    else 接收者离线
        M->>Q: 写入推送队列
    end
```

### 关键技术点

| 问题 | 解决方案 |
|:-----|:---------|
| **消息有序** | 单线程写入 + ACK 机制 |
| **消息去重** | 消息 ID + 本地已读表 |
| **离线消息** | 推送服务 + 离线存储 |
| **群聊优化** | 批量推送 + 只推一次 |
| **扩容** | 一致性哈希定位用户节点 |

---

## 场景 5：支付系统

### 需求分析

| 需求 | 优先级 |
|:-----|:-------|
| **资金安全** | 最高 |
| **数据一致性** | 最高 |
| **高可用** | 高 |
| **性能** | 中 |

### 架构设计

```mermaid
flowchart TB
    subgraph "支付系统架构"
        User[用户]
        Merchant[商户]

        subgraph "接入层"
            API[支付 API]
        end

        subgraph "核心服务层"
            Payment[支付服务<br/>核心交易]
            Account[账户服务<br/>记账]
            Risk[风控服务<br/>规则引擎]
            Notify[通知服务]
        end

        subgraph "渠道层"
            Channel1[微信支付]
            Channel2[支付宝]
            Channel3[银行卡]
        end

        subgraph "存储层"
            DB[(MySQL<br/>分库分表)]
            Ledger[(账本数据库<br/>强一致性)]
        end

        subgraph "基础服务"
            Sequence[序列号服务]
            Lock[分布式锁服务]
        end
    end

    User --> API
    Merchant --> API
    API --> Payment
    Payment --> Account
    Payment --> Risk
    Payment --> Channel1
    Payment --> Channel2
    Payment --> Channel3
    Payment --> Sequence
    Payment --> Lock
    Account --> Ledger
    Payment --> DB

    style Risk fill:#ffcdd2
    style Ledger fill:#c8e6c9
    style Lock fill:#fff9c4
```

### 核心流程

**支付流程**
```mermaid
stateDiagram-v2
    [*] --> 创建支付单
    创建支付单 --> 风控检查

    风控检查 --> 拒绝: 风险过高
    风控检查 --> 冻结金额: 通过

    冻结金额 --> 调用渠道
    调用渠道 --> 支付成功: 渠道返回成功
    调用渠道 --> 支付失败: 渠道返回失败
    调用渠道 --> 处理中: 渠道处理中

    支付成功 --> 记账
    记账 --> 发送通知
    发送通知 --> [*]

    支付失败 --> 释放冻结
    释放冻结 --> [*]

    处理中 --> 查询结果: 轮询查询
    查询结果 --> 支付成功
    查询结果 --> 支付失败

    拒绝 --> [*]
    释放冻结 --> [*]

    note right of 风控检查
        黑名单、
        异常交易、
        限额检查
    end note

    note right of 冻结金额
        幂等性、
        分布式锁
    end note
```

### 资金安全设计

| 措施 | 说明 |
|:-----|:-----|
| **幂等性** | 支付单号唯一，重复调用不重复扣款 |
| **分布式锁** | 冻结金额时加锁，防止并发 |
| **对账系统** | T+1 对账，发现异常交易 |
| **流水记录** | 每笔操作记录详细流水 |
| **熔断降级** | 渠道异常时快速失败 |
| **加密验签** | 所有接口加签验签 |

---

## 系统设计面试题精选

### Q1：如何设计一个分布式唯一 ID 生成器？

**参考答案**：

| 方案 | 优点 | 缺点 |
|:-----|:-----|:-----|
| **UUID** | 简单、无中心化 | 无序、长度长 |
| **数据库自增** | 严格递增 | 单点、性能瓶颈 |
| **Redis INCR** | 高性能 | 单点 |
| **Snowflake** | 有序、高性能 | 时钟回拨问题 |
| **号段模式** | 高性能、本地生成 | 需要协调 |

**Snowflake 算法结构**：
```
0 | 0000000000 0000000000 0000000000 0000000000 0 | 0000000000 | 0000000000 00000000
↑   ↑                    ↑              ↑
符号位   时间戳(41位)      工作机器ID(10位)  序列号(12位)
```

### Q2：如何保证消息不丢失、不重复消费？

**参考答案**：

| 问题 | 解决方案 |
|:-----|:---------|
| **生产者丢失** | ACK 机制 + 重试 |
| **MQ 丢失 | 持久化 + 集群 |
| **消费者丢失 | 手动 ACK + 幂等处理 |
| **重复消费 | 业务幂等 + 去重表 |

### Q3：如何设计一个限流系统？

**参考答案**：

```mermaid
flowchart LR
    A[请求] --> B{限流算法选择}

    B --> C[固定窗口]
    B --> D[滑动窗口]
    B --> E[漏桶]
    B --> F[令牌桶]

    C --> G[简单实现<br/>边界问题]
    D --> H[精确实现<br/>性能开销]
    E --> I[恒定流出<br/>无法应对突发]
    F --> J[灵活配置<br/>允许突发]

    style C fill:#ffcdd2
    style D fill:#fff9c4
    style E fill:#e1f5fe
    style F fill:#c8e6c9
```

**Redis 实现令牌桶**：
```go
func AllowRequest(ctx context.Context, key string, capacity, rate int) (bool, error) {
    now := time.Now().Unix()

    // Lua 脚本保证原子性
    script := `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local rate = tonumber(ARGV[3])

        local info = redis.call("HMGET", key, "tokens", "last")
        local tokens = tonumber(info[1]) or capacity
        local last = tonumber(info[2]) or now

        -- 计算需要补充的令牌
        local delta = math.max(0, now - last)
        local filled = math.min(capacity, tokens + delta * rate)

        -- 消耗一个令牌
        if filled < 1 then
            return 0
        end

        redis.call("HMSET", key, "tokens", filled - 1, "last", now)
        redis.call("EXPIRE", key, math.ceil(capacity / rate))
        return 1
    `

    result, err := rdb.Eval(ctx, script, []string{key}, []any{now, capacity, rate}).Result()
    return result.(int64) == 1, err
}
```

---

## 参考资料

- [System Design - Grokking the System Design Interview](https://www.systemdesign.one/)
- [Designing Data-Intensive Applications - Martin Kleppmann](https://dataintensive.net/)
- [短链系统设计 - 掘金](https://juejin.cn/post/68449039037726921252)
- [秒杀系统设计 - 知乎](https://zhuanlan.zhihu.com/p/354649742398488608)
- [IM 系统设计 - 极客时间](https://time.geekbang.org/column/intro/100036801)
