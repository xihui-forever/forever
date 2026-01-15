### 基础类型

#### struct

```go
var u User      // struct
var u1 *User    // nil
u1 = &u         // u的内存地址
u2 := &User{}   // 内存地址
u3 := new(User) // == u2
```

#### slice

```go
var l []int          // nil
//ll := make([]int, 0) // len(ll) == 0
l1 := make([]int, 10)
/*
头加
l1 = append([]int{1}, l...)
copy(l1[1:], ll)
l1[0] = 1*/

//追加
l2 := make([]int, 11)
copy(l2[0:9], l1)
l2[10] = 1
```

#### map

```go
m := make(map[int]int, 10) // 底层开发 0000000000
/*
    len 使用的大小
    cap 拥有的大小
*/
m2 := map[string]int{} // 业务开发
m[1] = 1
```

#### channel

```go
c := make(chan int) // <- c 然后 c <-

//c关闭即阻塞
for range c {

}

close(c)
cc := <-c // 可读不可写

c1 := make(chan int, 10)

for i := 0; i < 20; i++ {
    select {
    case c1 <- i:
    //case <-time.After(time.Second * 10):
    default:
    }

}

for i := 0; i < 20; i++ {
    // 阻塞
    c1 <- i
}

/*  mm := map[int]bool{}

    mm1 := map[int]struct{}{}
    if _, ok := mm1[1]; !ok {
    }*/
for {
    select {
    case _, ok := <-c:
       if !ok {
          return
       }
    }
}
```

### 锁

```go
var mux sync.Mutex    // 只写
var muxr sync.RWMutex // 读写

mux.Lock()
defer mux.Unlock()

if mux.TryLock() {
    defer mux.Unlock()
}

//"go.uber.org/atomic"
a := atomic.NewInt32()

/*等价
mux.Lock()
a += 1
mux.Unlock()
*/
a.Add(1) // 原子操作
```

#### 协程并发

```go
var w sync.WaitGroup
for i := 0; i < 20; i++ {
    w.Add(1)
    go func() {
        defer w.Done()
        fmt.Println(i)
    }()
}
w.Wait()

//通道阻塞
ccc := make(chan bool)
for i := 0; i < 20; i++ {
    go func() {
        ccc <- true
        fmt.Println(i)
    }()
}

for i := 0; i < 20; i++ {
    <-ccc
}

//加锁
var mux sync.Mutex
var cnt int

for i := 0; i < 10; i++ {
    mux.Lock()
    cnt++
    mux.Unlock()

    go func() {
        defer func() {
            fmt.println(i)
            mux.Lock()
            cnt--
            mux.Unlock()
        }()
    }()
}

for {
    mux.Lock()
    c := cnt
    mux.Unlock()
    if c <= 0 {
        break
    }
    time.Sleep(time.Millisecond * 200)
}


// sync.Pool
Wpg := sync.Pool{
    New: func() interface{} {
       return &sync.WaitGroup{}
    },
}

ww := Wpg.Get().(*sync.WaitGroup)
defer Wpg.Put(ww)
```

#### 主动退出协程

```go
ctx := context.TODO()

ctx, cancel := context.WithTimeout(ctx, time.Second*10)
defer cancel()

select {
case <-ctx.Done():
    return
default:
}

var once sync.Once
once.Do(func() {
    // 全局只执行一遍
})
```

#### map 异步读写

```go
var uniqueMap sync.Map
uniqueMap.Range(func(key, value interface{}) bool {
    return true // 继续Range
    //return false: break range
})
```

### defer close

```go
defer func() {
    // 2
}()
defer func() {
    // 1
    if err := recover(); err != nil {
       fmt.Println(err)
    }
}()
defer func() {
    _ = (&os.File{}).Close()
}()
```

### time

```go
t1 := time.NewTimer(time.Second * 10) // 触发一次
defer t1.Stop()
t2 := time.NewTicker(2 * time.Second) // 多次

location, err := time.LoadLocation("Asia/Shanghai")
tm := time.Now()
tm.In(location).Format("2006-01-02 15:04:05")
tm.UnixMilli()

time.Since(tm)
tm.Sub(time.Now())
```

string

```go
strconv.ParseInt()
strconv.FormatInt()
strconv.Itoa(10)
strconv.Atoi("10")
```

### byte

`[]rune 1`
`[]byte 3`

```go
b := bytes.NewBufferString("a \n b")
bb := bufio.NewScanner(b)
bb.Split(bufiox.ScanBy([]byte("."))) // 指定.切割

for bb.Scan() {
	fmt.Println(bb.Text()) // 默认/n切割
}
```

### uuid

> github.com/google/uuid

### struct tag

`json:name,omitempty yaml:name,omitempty,inline`

_omitempty：为空不显示_

**yaml**

> 安全性不高且与项目相关的全局性配置

`role:"admin", validator: require`
_自定义 role/不用写的 validator_
github.com/go-playground/v

### go build/mod

`go build -v .// 展示编译过程`

// indirect 间接引用

```go
go mod init

go mod tidy // 更新

go get -u xxx@hash[6]/1.2.3 // 不一定有版本号
```

### 编码规范

1、同类型常量放一起

```go
type Operation int

const (
  Add Operation = iota + 1
  Subtract
  Multiply
)

const  EnvVar = "MY_ENV"
```

2、减少嵌套、尽早退出

```go
for _, v := range data {
    if v.F1 != 1 {
    log.Printf("Invalid v: %v", v)
    continue
    }

    v = process(v)
    if err := v.Call(); err != nil {
    	return err
    }

    v.Send()
}
```

3、嵌入式类型

> 嵌入式类型（例如 mutex）应位于结构体内的字段列表的顶部，并且必须有一个空行将嵌入式字段与常规字段分隔开。

```go
type User struct {}

type Person struct {
	User // 引用类型

	name string
}
```

3、`` 避免反斜杠转义

```go
wantError := "unknown \nname:\"test\""
wantError := `unknown
name:"test"`
```

4、指定字段填入/忽略零值

```go
/*
user := User{
    FirstName:  "John",
    LastName:   "Doe",
    MiddleName: "",
    Admin:      false,
}
*/

user := User{
    FirstName: "John",
    LastName:  "Doe",
}
```

5、不能 panic

> 业务底层逻辑 非编译错误

```go
f, err := os.CreateTemp("", "test")
if err != nil {
    //panic("failed to set up test")
    log.Error("failed to set up test")
```

### Github

#### vi ~/.ssh/config

```go
Host *
	HostkeyAlgorithms +ssh-rsa
	PubkeyAcceptedAlgorithms +ssh-rsa
	ConnectTimeout 5
	Compression yes
	ServerAliveInterval 60
	ServerAliveCountMax 5
	ControlMaster auto
	ControlPersist 4h
	ConnectTimeout 5
Host gitlab.xxx.com
	IdentityFile ~/.ssh/id_rsa_xxx
```

#### git config user.name luoxin

### RBAC

1.0

- 用户表
- 角色表【字段：access resource list - enum】
- api 表【字段：roleId、resource enum、描述说明】 --- 系统自动增删，admin 查
  - api、roleId 唯一索引
- 用户角色表 -- admin 查增删

  - user、roleId 唯一索引

    2.0

- 用户表（已有）
  - 管理员表
  - 普通用户表
- 角色表 （包括备注和状态字段）
- 用户角色关联表（用户与角色是多对多的关系）
- 资源表 （可操作的资源项）
  - 资源标识、类型、路径
  - 类似父级资源字段，树级资源列表
- 操作表 （操作名称、操作标识）
- 权限表 （资源 ID、操作 ID、权限标识：前端通过拼接资源+操作作为权限标识）
- 角色权限表 （角色与权限是多对多的关系）

可根据情况考虑加入**数据权限表**控制角色的数据访问范围

3.0

#### 数据库表

##### 角色表

|   字段名    | 类型            | 长度 | 允许 NULL | 默认值 | 键  | 说明                 |
| :---------: | :-------------- | :--- | :-------- | :----- | :-- | :------------------- |
|     id      | BIGINT UNSIGNED | -    | NO        | -      | PRI | 主键 ID              |
| created_at  | BIGINT          | -    | YES       | -      | -   | 创建时间(时间戳)     |
| updated_at  | BIGINT          | -    | YES       | -      | -   | 更新时间(时间戳)     |
| deleted_at  | BIGINT          | -    | YES       | -      | MUL | 软删除时间戳         |
|    name     | VARCHAR         | 50   | NO        | -      | MUL | 角色名称(唯一)       |
| description | VARCHAR         | 200  | YES       | -      | -   | 角色描述/备注        |
|    state    | TINYINT         | -    | NO        | 0      | -   | 状态：0-正常, 1-禁用 |

```
id=2, name='管理员'
```

##### 权限表

| 字段名     | 类型            | 长度 | 允许 NULL | 默认值 | 键  | 说明                                      |
| :--------- | :-------------- | :--- | :-------- | :----- | :-- | :---------------------------------------- |
| id         | BIGINT UNSIGNED | -    | NO        | -      | PRI | 主键 ID                                   |
| created_at | BIGINT          | -    | YES       | -      | -   | 创建时间(时间戳)                          |
| updated_at | BIGINT          | -    | YES       | -      | -   | 更新时间(时间戳)                          |
| deleted_at | BIGINT          | -    | YES       | -      | MUL | 软删除时间戳                              |
| name       | VARCHAR         | 50   | NO        | -      | -   | 资源名称                                  |
| type       | TINYINT         | -    | NO        | 0      | -   | 资源类型：1:后端，2:前端                  |
| perm_code  | VARCHAR         | 200  | YES       | -      | -   | 前端资源路径、后端资源路径（method:path） |
| parent_id  | BIGINT UNSIGNED | -    | YES       | 0      | MUL | 父资源 ID(0 表示顶级资源)                 |
| state      | TINYINT         | -    | NO        | 0      | -   | 状态：0-正常, 1-禁用                      |

id、deleted_at、resouce_id、action_id：唯一索引

##### 角色权限表

| 字段名     | 类型            | 长度 | 允许 NULL | 默认值 | 键  | 说明             |
| :--------- | :-------------- | :--- | :-------- | :----- | :-- | :--------------- |
| id         | BIGINT UNSIGNED | -    | NO        | -      | PRI | 主键 ID          |
| created_at | BIGINT          | -    | YES       | -      | -   | 创建时间(时间戳) |
| updated_at | BIGINT          | -    | YES       | -      | -   | 更新时间(时间戳) |
| deleted_at | BIGINT          | -    | YES       | -      | MUL | 软删除时间戳     |
| role_id    | BIGINT UNSIGNED | -    | NO        | -      | MUL | 角色 ID          |
| perm_id    | BIGINT UNSIGNED | -    | NO        | -      | MUL | 权限 ID          |

#### API 接口列表

##### 1. 角色管理接口

| 接口                      | 方法 | 路径                            | 说明         |
| :------------------------ | :--- | :------------------------------ | :----------- |
| AdminAddRole              | POST | /api/rbac/role/AddRole          | 添加角色     |
| AdminDelRole              | POST | /api/rbac/role/DelRole          | 删除角色     |
| AdminUpdateRole           | POST | /api/rbac/role/UpdateRole       | 更新角色     |
| AdminListRole             | POST | /api/rbac/role/ListRole         | 查询角色列表 |
| AdminGetRole              | POST | /api/rbac/role/GetRole          | 查询角色详情 |
| AdminSetStateRole         | POST | /api/rbac/role/SetStateRole     | 设置角色状态 |
| AdminAssignPermissionRole | POST | /api/rbac/role/AssignPermission | 分配角色权限 |
| AdminGetPermissionRole    | POST | /api/rbac/role/GetPermission    | 获取角色权限 |

##### 2. 资源管理接口

| 接口                 | 方法 | 路径                              | 说明         |
| :------------------- | :--- | :-------------------------------- | :----------- |
| AdminAddResource     | POST | /api/rbac/resource/AddResource    | 添加资源     |
| AdminDelResource     | POST | /api/rbac/resource/DelResource    | 删除资源     |
| AdminUpdateResource  | POST | /api/rbac/resource/UpdateResource | 更新资源     |
| AdminListResource    | POST | /api/rbac/resource/ListResource   | 查询资源列表 |
| AdminGetTreeResource | POST | /api/rbac/resource/GetTree        | 获取资源树   |

##### 3. 权限管理接口

| 接口                | 方法 | 路径                                | 说明         |
| :------------------ | :--- | :---------------------------------- | :----------- |
| AdminAddPermission  | POST | /api/rbac/permission/AddPermission  | 添加权限     |
| AdminDelPermission  | POST | /api/rbac/permission/DelPermission  | 删除权限     |
| AdminListPermission | POST | /api/rbac/permission/ListPermission | 查询权限列表 |

##### 4. 用户角色接口

| 接口                 | 方法 | 路径                           | 说明         |
| :------------------- | :--- | :----------------------------- | :----------- |
| AdminAssignUserRole  | POST | /api/rbac/user/AssignRole      | 分配用户角色 |
| AdminGetUserRole     | POST | /api/rbac/user/GetRole         | 获取用户角色 |
| AdminGetMyPermission | POST | /api/rbac/user/GetMyPermission | 获取我的权限 |

---

#### proto

##### role

```protobuf
// @table: mysql
// @model: 角色
// @desc: 角色表
message ModelRole {
    // State 角色状态枚举
    enum State {
        // @desc: 正常
        Normal = 0;

        // @desc: 禁用
        Disabled = 1;
    }

    // @desc: 角色主键ID
    // @gorm:index:idx_role,unique
    uint64 id = 1;
    int64 created_at = 2;
    int64 updated_at = 3;
    // @gorm:index:idx_role,unique
    int64 deleted_at = 4;

    // @desc: 角色名称
    // @example: 管理员
    // @gorm: type:varchar(50);not null
    // @validate: required,max=50
    string name = 11;

    // @desc: 角色描述
    // @example: 系统管理员角色
    // @gorm: type:varchar(200)
    string description = 13;

    // @desc: 角色状态
    // @example: 0
    State state = 15;
}
```

##### resource

```protobuf
// @table: mysql
// @model: 资源
// @desc: 资源表
message ModelResource {
    // Type 资源类型枚举
    // todo:暂定
    enum Type {
        // @desc: 模块
        Module = 0;

        // @desc: 菜单
        Menu = 1;

        // @desc: 页面
        Page = 2;

        // @desc: 按钮
        Button = 3;

        // @desc: API
        Api = 4;
    }

    // State 资源状态枚举
    enum State {
        // @desc: 正常
        Normal = 0;

        // @desc: 禁用
        Disabled = 1;
    }

    // @desc: 资源主键ID
    // @gorm:index:idx_resource,unique
    uint64 id = 1;
    int64 created_at = 2;
    int64 updated_at = 3;
    // @gorm:index:idx_resource,unique
    int64 deleted_at = 4;

    // @desc: 资源名称
    // @example: 管理员管理
    // @gorm: type:varchar(50);not null
    string name = 11;

    // @desc: 资源类型
    // @example: 1
    // @required
    Type type = 12;

    // @desc: 前端资源路径
    // @example: /system/admin
    // @gorm: type:varchar(200)
    string path = 13;

    // @desc: 后端资源路径
    // @example: /system/admin
    // @gorm: type:varchar(200)
    string api = 14;

    // @desc: HTTP方法(仅API类型)
    // @example: POST
    // @gorm: type:varchar(10)
    string method = 15;

     // @desc: 父资源ID(0表示顶级资源)
    // @example: 0
    // @gorm: default:0
    uint64 parent_id = 16;

    // @desc: 前端组件路径
    // @example: /views/system/admin/index.vue
    // @gorm: type:varchar(200)
    string component = 17;

    // @desc: 状态
    // @example: 0
    State state = 18;
}
```

##### permisssion

```protobuf
// @table: mysql
// @model: 权限
// @desc: 权限表
message ModelPermission {
    // @desc: 权限主键ID
    // @gorm:index:idx_permisssion,unique
    uint64 id = 1;
    int64 created_at = 2;
    int64 updated_at = 3;
    // @gorm:index:idx_permisssion,unique
    int64 deleted_at = 4;


    // @desc: 权限名称
    // @example: 管理员管理-添加
    // @gorm: type:varchar(100);not null
    string name = 11;

    // @desc: 资源ID
    // @example: 1
    // @gorm:index:idx_permisssion,unique
    uint64 resource_id = 12;

    // @desc: 权限描述
    // @example: 添加管理员的权限
    // @gorm: type:varchar(200)
    string description = 13;

    // @desc: 关联的资源信息(仅用于查询返回)
    ModelResource resource = 20;
    // @desc: 关联的操作信息(仅用于查询返回)
    ModelAction action = 21;
}
```

##### user_role

```protobuf
// @table: mysql
// @model: 用户角色关联
// @desc: 用户角色关联表
message ModelUserRole {
    // @desc: 主键ID
    // @gorm:index:idx_user_role,unique
    uint64 id = 1;
    int64 created_at = 2;
    int64 updated_at = 3;
    // @gorm:index:idx_user_role,unique
    int64 deleted_at = 4;

    // @desc: 用户ID
    // @example: 1
    // @gorm:index:idx_user_role,unique
    uint64 user_id = 11;

    // @desc: 角色ID
    // @example: 1
    // @gorm:index:idx_user_role,unique
    uint64 role_id = 13;

    // @desc: 关联的角色信息(仅用于查询返回)
    ModelRole role = 20;
}
```

##### role_permisssion

```protobuf
// @table: mysql
// @model: 角色权限关联
// @desc: 角色权限关联表
message ModelRolePermission {
    // @desc: 主键ID
    // @gorm:index:idx_role_permisssion,unique
     int64 created_at = 2;
    int64 updated_at = 3;
    // @gorm:index:idx_role_permisssion,unique
    int64 deleted_at = 4;

    // @desc: 角色ID
    // @example: 1
    // @gorm:index:idx_role_permisssion,unique
    uint64 role_id = 11;

    // @desc: 权限ID
    // @example: 1
    // @gorm:index:idx_role_permisssion,unique
    uint64 permission_id = 12;

    // @desc: 关联的权限信息(仅用于查询返回)
    ModelPermission permission = 20;
}
```

##### api

_参考 API 接口列表_

#### 缓存更新策略

| 操作           | 更新的缓存                                      |
| :------------- | :---------------------------------------------- |
| 分配角色给用户 | 删除用户权限缓存                                |
| 移除用户角色   | 删除用户权限缓存                                |
| 分配权限给角色 | 删除角色权限缓存 + 所有拥有该角色的用户权限缓存 |
| 移除角色权限   | 删除角色权限缓存 + 所有拥有该角色的用户权限缓存 |

#### 错误码定义

| 错误码                 | 说明                       |
| :--------------------- | :------------------------- |
| ErrRoleNotFound        | 角色不存在                 |
| ErrRoleHasUsers        | 角色已分配给用户，无法删除 |
| ErrResourceNotFound    | 资源不存在                 |
| ErrResourceHasChildren | 资源存在子资源，无法删除   |
| ErrPermissionNotFound  | 权限不存在                 |
| ErrPermissionDuplicate | 权限重复                   |
| ErrUserNotFound        | 用户不存在                 |
| ErrRoleAlreadyAssigned | 角色已分配                 |
