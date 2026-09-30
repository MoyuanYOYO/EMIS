# EMIS · 教务管理系统

一个基于 **Flask + MySQL + 原生前端** 的教务管理系统，实现了学生、教师、管理员三角色权限体系，并在敏感数据存储与成绩完整性上做了安全设计。

## 功能特性

| 模块 | 说明 |
|---|---|
| 三角色权限 | 学生 / 教师 / 管理员，基于 Session + 装饰器做接口级鉴权 |
| 敏感信息加密 | 身份证号、手机号使用 **AES-256（Fernet）** 加密后落库，非明文存储 |
| 成绩完整性校验 | 成绩写入时计算 **SHA-256** 哈希（含盐），读取时校验，防止被篡改 |
| 课程与选课 | 课程管理、教学任务、选课与退课 |
| 成绩管理 | 教师录入/修改成绩，学生查询成绩 |
| 操作日志审计 | 关键操作写入 `audit_logs` 表，可追溯 |

## 技术栈

- **后端**：Python 3 / Flask / Flask-SQLAlchemy / PyMySQL
- **数据库**：MySQL 5.7+
- **安全**：bcrypt（密码哈希）、cryptography-Fernet（AES-256）、hashlib-SHA256（成绩校验）
- **前端**：原生 HTML / CSS / JavaScript + Bootstrap 5 + Font Awesome（无构建步骤）

## 项目结构

```
EMIS/
├── backend/
│   ├── app.py            # Flask 主应用：蓝图注册 + 静态文件服务
│   ├── config.py         # 配置：从 .env 读取数据库与密钥
│   ├── models.py         # ORM 模型（用户/学生/教师/课程/选课/成绩/日志）
│   ├── routes/           # 按角色拆分的 API 蓝图
│   │   ├── auth.py       #   登录 / 登出 / 当前用户
│   │   ├── student.py    #   学生端接口
│   │   ├── teacher.py    #   教师端接口
│   │   ├── course.py     #   课程 / 选课接口
│   │   └── admin.py      #   管理端接口
│   └── utils/
│       ├── security.py   # 加解密与哈希工具
│       └── decorators.py # 登录与角色校验装饰器
├── frontend/
│   ├── index.html        # 登录页
│   ├── pages/            # 三个角色的仪表板
│   ├── css/  js/         # 样式与脚本
├── init_database.py      # 建表 + 写入演示数据
├── generate_key.py       # 生成 SECRET_KEY / ENCRYPTION_KEY / SALT_VALUE
├── run.py                # 启动入口
└── .env.example          # 环境变量模板（复制为 .env 使用）
```

## 快速开始

### 1. 环境准备

需要本机已安装 **Python 3.8+** 和 **MySQL 5.7+**。

### 2. 获取代码并创建虚拟环境

```bash
git clone https://github.com/MoyuanYOYO/EMIS.git
cd EMIS

python -m venv venv
# Windows (CMD)
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 配置环境变量

```bash
# Windows
copy .env.example .env
# Linux / macOS
cp .env.example .env
```

然后编辑 `.env`，填入你的 MySQL 密码。**密钥请务必重新生成**：

```bash
python generate_key.py
```

把输出的 `SECRET_KEY` / `ENCRYPTION_KEY` / `SALT_VALUE` 三行替换进 `.env`。

> ⚠️ `ENCRYPTION_KEY` 用于解密已入库的身份证号与手机号。**一旦更换，历史数据将无法解密**，请在首次初始化前确定好并妥善保管。

### 5. 创建数据库并初始化

在 MySQL 中新建一个名为 `edu_sys` 的数据库（字符集建议 `utf8mb4`）：

```sql
CREATE DATABASE edu_sys DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

然后执行初始化脚本（建表 + 写入演示数据）：

```bash
python init_database.py
```

### 6. 启动

```bash
python run.py
```

浏览器打开 <http://localhost:5000>。

### 演示账号

| 角色 | 用户名 | 密码 |
|---|---|---|
| 管理员 | `admin` | `123456` |
| 教师 | `huang_prof` | `123456` |
| 学生 | `zhangsan` | `123456` |

> 演示账号仅用于本地体验，部署到任何真实环境前请先修改。

## 安全说明

- `.env` 已被 `.gitignore` 忽略，**不会**被提交。仓库中只提供不含真实值的 `.env.example`。
- 身份证号、手机号以 AES-256 加密存储，数据库中不出现明文。
- 成绩写入 SHA-256 哈希，读取时校验，可发现被直接改库的篡改。
- 密码使用 bcrypt 加盐哈希，不可逆。
- 调试模式由环境变量 `FLASK_DEBUG` 控制，**默认关闭**；服务默认仅监听 `127.0.0.1`，不对外网暴露调试器。

## 许可

本项目为课程实践作品，仅供学习交流使用。
