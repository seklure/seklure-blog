---
title: "Fastjson 反序列化漏洞史：从 1.2.24 到 AutoType 攻防拉锯战"
date: 2026-09-22T10:00:00+08:00
description: "梳理 Fastjson 反序列化漏洞的演化历程（CVE-2017-18349 等）、AutoType 机制的风险本质，以及安全的升级与配置方案。"
tags: ["Fastjson", "反序列化", "CVE-2017-18349", "Java安全", "漏洞分析"]
categories: ["中间件安全"]
---

## 前言

Fastjson 是阿里巴巴开源的 Java JSON 序列化库，曾是国内 Java 项目的标配组件。2017 年起，围绕其 **AutoType 机制**爆发了一系列反序列化远程代码执行漏洞（CVE-2017-18349、CVE-2022-25845 等），官方与安全研究者之间展开了长达数年的"黑名单封堵 — 绕过 — 再封堵"拉锯战。2022 年后官方推出 Fastjson2 并宣布 Fastjson 1.x 进入维护模式，迁移成为最终答案。

<!--more-->

## 漏洞根源：AutoType 机制

Fastjson 为了在反序列化时还原多态对象，支持在 JSON 中通过 `@type` 字段**显式指定目标类**：

```json
{"@type": "com.example.User", "name": "test"}
```

问题在于：如果攻击者控制了输入的 JSON，就可以把 `@type` 指向**任意恶意类**——只要这个类的 setter/构造方法中存在危险操作（如加载远程字节码、发起 JNDI 查询），反序列化过程就会触发代码执行。历史上被滥用的 Gadget 类包括 `TemplatesImpl`、`JdbcRowSetImpl` 等。

## 攻防时间线（简版）

| 版本节点 | 事件 |
|---|---|
| ≤1.2.24 | AutoType **默认开启**，CVE-2017-18349 爆发 |
| 1.2.25+ | AutoType 默认关闭，引入黑名单 |
| 1.2.25 ~ 1.2.47 | 黑名单被**十余次绕过**（缓存缺陷、编码混淆、类名变形等），1.2.47 为影响最广的版本之一 |
| 1.2.48 ~ 1.2.83 | 改为哈希黑名单 + checkAutoType 安全模式，仍持续被绕过 |
| 1.2.83+ | safeMode 强化；官方主推迁移 Fastjson2 |
| Fastjson2 | 默认更安全的 AutoType 策略，提供 JSONB 白名单机制 |

## 排查方法

1. **依赖确认**：`mvn dependency:tree | grep fastjson`，注意排查**传递依赖**（很多 SDK 内嵌了老版本 Fastjson）
2. **制品库扫描**：用 SCA 工具扫描私服仓库中所有制品的 Fastjson 版本
3. **运行态确认**：部分应用通过 shading 打包，需检查 fat jar 内部类路径
4. **日志回溯**：检索请求日志中 `"@type"` 特征，尤其是指向 `com.sun.`、`java.net.` 等可疑类名的记录

## 修复方案（按优先级）

1. **迁移至 Fastjson2** 或 Jackson/Gson：一劳永逸，官方提供兼容包 `fastjson2-extension` 降低迁移成本
2. 无法迁移时**升级到 1.2.83 最新维护版**，并开启 safeMode：

```java
// JVM 启动参数
Parser.getGlobalInstance().setSafeMode(true);
// 或 -Dfastjson.parser.safeMode=true
```

3. **架构层缓解**：应用服务器禁止出网访问 LDAP/RMI；WAF 拦截请求体中的 `@type` 可疑特征
4. **输入侧收敛**：对外接口的 JSON 入参尽量映射到明确的 DTO，避免直接 `JSONObject.parse()`

## 启示

- "用黑名单防御反序列化"被证明是死路——Java 生态的 Gadget 类几乎无穷无尽，**白名单与默认拒绝才是出路**
- 组件选型时把"历史安全记录"纳入评估维度；对停止维护的组件要有主动替换计划
- 反序列化漏洞的攻击载荷最终多落在 JNDI/远程类加载上，**出网管控依然是性价比最高的兜底**

---

> **免责声明**：本文仅基于公开漏洞信息进行防御性分析，不包含任何绕过方式与利用代码。未经授权的测试属违法行为，请遵守《中华人民共和国网络安全法》。
