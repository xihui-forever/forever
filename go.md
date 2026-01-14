

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

``` go
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

``` go
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

#### map异步读写

``` go
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
``` go
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

*omitempty：为空不显示*

**yaml**
> 安全性不高且与项目相关的全局性配置

`role:"admin", validator: require`
*自定义role/不用写的validator*
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
``` go
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
``` go
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
5、不能panic
> 业务底层逻辑 非编译错误
```go
f, err := os.CreateTemp("", "test")
if err != nil {
    //panic("failed to set up test")
    log.Error("failed to set up test")
```





### Github

#### vi ~/.ssh/config

``` go
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
- api表【字段：roleId、resource enum、描述说明】 --- 系统自动增删，admin查
  - api、roleId 唯一索引
- 用户角色表 -- admin查增删
  - user、roleId 唯一索引

2.0

- 用户表（已有） 
  - 管理员表
  - 普通用户表
-  角色表 （包括备注和状态字段） 
- 用户角色关联表（用户与角色是多对多的关系） 
- 资源表 （可操作的资源项） 
  - 资源标识、类型、路径
  - 类似父级资源字段，树级资源列表
- 操作表 （操作名称、操作标识） 
- 权限表 （资源ID、操作ID、权限标识：前端通过拼接资源+操作作为权限标识） 
- 角色权限表 （角色与权限是多对多的关系） 

可根据情况考虑加入**数据权限表**控制角色的数据访问范围

3.0