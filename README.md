实践题目：教务管理系统 (EMIS)
班级：信安231
学号：2207310503
姓名：吴泽原
指导老师：黄保华

系统功能概述：-学生、教师、管理员三角色权限管理 -敏感信息加密存储（AES-256）-成绩完整性验证（SHA-256哈希）-完整的课程选课和成绩管理 -操作日志审计

下面是一些说明：
如果你想运行这个系统，你需要：1.确保电脑上安装了python依赖、MySQL、VScode 。2.用VScode打开EMIS这个文件夹3.修改配置文件.env,把数据库密码设为你的。4.创建新的虚拟环境，即在VScode的cmd终端输入python -m venv venv 。5.激活虚拟环境，终端输入venv\Scripts\activate 。6.安装依赖，终端输入pip install Flask Flask-SQLAlchemy pymysql bcrypt cryptography python-dotenv 7.运行，终端输入python run.py 8.打开链接http://localhost:5000
