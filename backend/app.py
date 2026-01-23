from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text  # 新增导入
from backend.config import Config

# 初始化应用
app = Flask(__name__)
app.config.from_object(Config)

# 初始化数据库
db = SQLAlchemy(app)

@app.route('/')
def hello():
    return "教务系统后端启动成功！🎉"

# 测试数据库连接的路由
@app.route('/test-db')
def test_db():
    try:
        # 使用新的SQLAlchemy 2.0方式
        result = db.session.execute(text("SELECT 1"))
        data = result.fetchone()
        return f"数据库连接成功！✓ 查询结果: {data[0]}"
    except Exception as e:
        return f"数据库连接失败：{str(e)}"

if __name__ == '__main__':
    app.run(debug=True)